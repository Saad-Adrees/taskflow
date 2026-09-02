# TaskFlow PHP API

1. Start Apache and MySQL in XAMPP.
2. Copy this project's `api` folder to `C:\xampp\htdocs\api`.
3. Open phpMyAdmin at `http://localhost/phpmyadmin`.
4. Import `database/schema.sql` from this project.
5. Update `api/config.php` if your MySQL username or password differs from `root` and an empty password.
6. Keep the React dev server running at `http://localhost:5173`.

The React app calls `/api/tasks.php`. Vite proxies that path to Apache at `http://localhost`, where the copied API folder serves it.

## API checks

Open `http://localhost/api/tasks.php` in a browser. After importing the schema, it should return `[]` when no tasks exist. A database connection error means the credentials in `api/config.php` need to be updated.

## Password recovery

Import `database/password-reset-migration.sql` after the user table exists. The local app's **Forgot password?** flow creates a one-time code valid for 15 minutes. This project returns the code on screen for local development; production should email the code through an SMTP provider instead.
