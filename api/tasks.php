<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/config.php';

if (!isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Please log in first.']);
    exit;
}

$userId = (int) $_SESSION['user']['id'];

function body(): array
{
    $decoded = json_decode(file_get_contents('php://input'), true);
    return is_array($decoded) ? $decoded : [];
}

function taskResponse(array $task): array
{
    return [
        'id' => (int) $task['id'],
        'title' => $task['title'],
        'dueDate' => $task['due_date'],
        'reminderTime' => $task['reminder_time'] ? substr($task['reminder_time'], 0, 5) : '',
        'priority' => $task['priority'],
        'completed' => (bool) $task['completed'],
        'position' => (int) $task['position'],
        'createdAt' => $task['created_at'],
    ];
}

function invalidInput(string $message): never
{
    http_response_code(400);
    echo json_encode(['error' => $message]);
    exit;
}

function validDateOrNull(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        invalidInput('Due date must be a date in YYYY-MM-DD format.');
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', trim($value));
    $errors = DateTimeImmutable::getLastErrors();

    if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) || $date->format('Y-m-d') !== trim($value)) {
        invalidInput('Due date must be a valid date in YYYY-MM-DD format.');
    }

    return $date->format('Y-m-d');
}

function validTimeOrNull(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        invalidInput('Reminder time must be a time in HH:MM format.');
    }

    $time = trim($value);
    $parsedTime = DateTimeImmutable::createFromFormat('!H:i', $time);
    $errors = DateTimeImmutable::getLastErrors();

    if ($parsedTime === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) || $parsedTime->format('H:i') !== $time) {
        invalidInput('Reminder time must be a valid time in HH:MM format.');
    }

    return $parsedTime->format('H:i:00');
}

function requiredTaskFields(array $data): array
{
    if (!is_string($data['title'] ?? null)) {
        invalidInput('Title is required.');
    }

    $title = trim($data['title']);
    $dueDate = validDateOrNull($data['dueDate'] ?? null);
    $reminderTime = validTimeOrNull($data['reminderTime'] ?? null);
    $priority = $data['priority'] ?? 'Medium';
    $completed = !empty($data['completed']) ? 1 : 0;
    $position = (int) ($data['position'] ?? 0);

    if ($title === '' || strlen($title) > 255 || !is_string($priority) || !in_array($priority, ['Low', 'Medium', 'High'], true)) {
        invalidInput('Enter a title of 1-255 characters and a valid priority.');
    }

    return [$title, $dueDate, $reminderTime, $priority, $completed, $position];
}

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

try {
    if ($method === 'GET') {
        $statement = $pdo->prepare('SELECT * FROM tasks WHERE user_id = :userId ORDER BY position ASC, created_at DESC');
        $statement->execute(['userId' => $userId]);
        echo json_encode(array_map('taskResponse', $statement->fetchAll()));
        exit;
    }

    if ($method === 'POST') {
        [$title, $dueDate, $reminderTime, $priority, $completed, $position] = requiredTaskFields(body());
        $statement = $pdo->prepare(
            'INSERT INTO tasks (user_id, title, due_date, reminder_time, priority, completed, position)
             VALUES (:userId, :title, :dueDate, :reminderTime, :priority, :completed, :position)'
        );
        $statement->execute(compact('title', 'dueDate', 'reminderTime', 'priority', 'completed', 'position') + ['userId' => $userId]);
        $newId = (int) $pdo->lastInsertId();

        $statement = $pdo->prepare('SELECT * FROM tasks WHERE id = :id AND user_id = :userId');
        $statement->execute(['id' => $newId, 'userId' => $userId]);
        echo json_encode(taskResponse($statement->fetch()));
        exit;
    }

    if ($method === 'PUT' && $id > 0) {
        [$title, $dueDate, $reminderTime, $priority, $completed, $position] = requiredTaskFields(body());
        $statement = $pdo->prepare(
            'UPDATE tasks
             SET title = :title, due_date = :dueDate, reminder_time = :reminderTime,
                 priority = :priority, completed = :completed, position = :position
              WHERE id = :id AND user_id = :userId'
        );
         $statement->execute(compact('title', 'dueDate', 'reminderTime', 'priority', 'completed', 'position', 'id') + ['userId' => $userId]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($method === 'PATCH' && isset($_GET['order'])) {
        $order = body()['order'] ?? [];
        $pdo->beginTransaction();
        $statement = $pdo->prepare('UPDATE tasks SET position = :position WHERE id = :id AND user_id = :userId');
        foreach ($order as $position => $taskId) {
            $statement->execute(['position' => (int) $position, 'id' => (int) $taskId, 'userId' => $userId]);
        }
        $pdo->commit();
        echo json_encode(['success' => true]);
        exit;
    }

    if ($method === 'DELETE' && $id > 0) {
        $statement = $pdo->prepare('DELETE FROM tasks WHERE id = :id AND user_id = :userId');
        $statement->execute(['id' => $id, 'userId' => $userId]);
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Invalid request.']);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'The server could not complete the request.']);
}
