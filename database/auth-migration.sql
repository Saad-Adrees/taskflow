USE taskflow;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tasks ADD COLUMN user_id INT UNSIGNED NULL AFTER id;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_user_position ON tasks (user_id, position);

-- After creating your first user, assign existing tasks if needed:
-- UPDATE tasks SET user_id = 1 WHERE user_id IS NULL;
