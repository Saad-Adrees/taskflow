<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/config.php';
$data = json_decode(file_get_contents('php://input'), true);
$data = is_array($data) ? $data : [];
$action = $_GET['action'] ?? 'me';

try {
    if ($action === 'me') {
        echo json_encode($_SESSION['user'] ?? null);
        exit;
    }

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'request-reset') {
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Enter a valid email address.']);
            exit;
        }

        $statement = $pdo->prepare('SELECT id FROM users WHERE email = :email');
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();

        if (!$user) {
            echo json_encode(['message' => 'If that email exists, a reset code has been created.']);
            exit;
        }

        $token = bin2hex(random_bytes(24));
        $statement = $pdo->prepare(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES (:userId, :tokenHash, DATE_ADD(NOW(), INTERVAL 15 MINUTE))'
        );
        $statement->execute([
            'userId' => $user['id'],
            'tokenHash' => hash('sha256', $token),
        ]);

        echo json_encode([
            'message' => 'Reset code created. In local development, use the code below.',
            'developmentToken' => $token,
        ]);
        exit;
    }

    if ($action === 'reset-password') {
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $token = trim((string) ($data['token'] ?? ''));
        $newPassword = (string) ($data['newPassword'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($newPassword) < 6 || $token === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Enter your email, reset code, and a password of at least 6 characters.']);
            exit;
        }

        $statement = $pdo->prepare(
            'SELECT password_reset_tokens.id, password_reset_tokens.user_id
             FROM password_reset_tokens
             INNER JOIN users ON users.id = password_reset_tokens.user_id
             WHERE users.email = :email AND password_reset_tokens.token_hash = :tokenHash
               AND password_reset_tokens.used_at IS NULL AND password_reset_tokens.expires_at > NOW()'
        );
        $statement->execute(['email' => $email, 'tokenHash' => hash('sha256', $token)]);
        $reset = $statement->fetch();

        if (!$reset) {
            http_response_code(400);
            echo json_encode(['error' => 'That reset code is invalid or expired.']);
            exit;
        }

        $pdo->beginTransaction();
        $statement = $pdo->prepare('UPDATE users SET password_hash = :password WHERE id = :userId');
        $statement->execute(['password' => password_hash($newPassword, PASSWORD_DEFAULT), 'userId' => $reset['user_id']]);
        $statement = $pdo->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = :id');
        $statement->execute(['id' => $reset['id']]);
        $pdo->commit();

        echo json_encode(['message' => 'Password reset successfully.']);
        exit;
    }

    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'Enter a valid email and a password of at least 6 characters.']);
        exit;
    }

    if ($action === 'register') {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Name is required.']);
            exit;
        }

        $statement = $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (:name, :email, :password)');
        $statement->execute([
            'name' => $name,
            'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
        ]);
        $userId = (int) $pdo->lastInsertId();
    } elseif ($action === 'login') {
        $statement = $pdo->prepare('SELECT id, name, email, password_hash FROM users WHERE email = :email');
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Email or password is incorrect.']);
            exit;
        }

        $userId = (int) $user['id'];
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Unknown authentication action.']);
        exit;
    }

    $statement = $pdo->prepare('SELECT id, name, email FROM users WHERE id = :id');
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();
    $_SESSION['user'] = ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email']];
    echo json_encode($_SESSION['user']);
} catch (PDOException $exception) {
    http_response_code($exception->getCode() === '23000' ? 409 : 500);
    echo json_encode(['error' => $exception->getCode() === '23000' ? 'That email is already registered.' : 'Authentication failed.']);
}
