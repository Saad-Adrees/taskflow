# TaskFlow

A React to-do list application with a PHP and MySQL backend.

## Features

- User registration, login, logout, and password recovery
- Add, edit, complete, and delete tasks
- Task priorities and due dates
- Calendar view and reminder times
- Search, filtering, and sorting
- Drag-and-drop task ordering
- Light and dark themes
- Server-side validation
- MySQL persistence through a PHP API

## Local setup

### Requirements

- Node.js and npm
- XAMPP with Apache, MySQL, and PHP

### Database

1. Start Apache and MySQL in XAMPP.
2. Open `http://localhost/phpmyadmin`.
3. Import these files in order:
   - `database/schema.sql`
   - `database/auth-migration.sql`
   - `database/password-reset-migration.sql`
4. Copy the `api` folder to `C:\xampp\htdocs\api`.
5. Copy `api/config.example.php` to `api/config.php` and update the database credentials if needed.

### Frontend

From the project folder:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The Vite development server proxies `/api` requests to Apache at `http://localhost`.

## Production build

```bash
npm run build
```

The production frontend is created in `dist/`. Do not upload `node_modules`, `dist` during development, or `api/config.php` with private credentials.

## Project structure

```text
src/       React frontend
api/       PHP API and authentication
 database/ MySQL schema and migrations
```
