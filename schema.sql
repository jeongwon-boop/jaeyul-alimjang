CREATE DATABASE IF NOT EXISTS schedule_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE schedule_db;

CREATE TABLE IF NOT EXISTS projects (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  color       VARCHAR(7)   NOT NULL DEFAULT '#3b82f6',
  manager     VARCHAR(100) NOT NULL DEFAULT '',
  description TEXT         NOT NULL DEFAULT '',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id          VARCHAR(64)  NOT NULL,
  project_id  VARCHAR(64)  NOT NULL,
  `order`     INT          NOT NULL DEFAULT 0,
  name        VARCHAR(255) NOT NULL,
  category    VARCHAR(20)  NOT NULL DEFAULT '기획',
  assignee    VARCHAR(100) NOT NULL DEFAULT '',
  start_date  DATE         NULL,
  end_date    DATE         NULL,
  progress    TINYINT      NOT NULL DEFAULT 0,
  status      VARCHAR(20)  NOT NULL DEFAULT '대기',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_tasks_project_order ON tasks (project_id, `order`);
