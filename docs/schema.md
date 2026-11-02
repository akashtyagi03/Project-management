# Database Schema

Groundwork uses SQLite through `better-sqlite3`. The schema is created
idempotently from `server/src/db/schema.sql` the first time the database opens.
Foreign keys and WAL mode are enabled for every connection.

## Tables

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `name` | TEXT | Required, 2–80 characters through the API |
| `email` | TEXT | Required, unique, case-insensitive |
| `password_hash` | TEXT | bcrypt hash, cost 10 |
| `role` | TEXT | `ADMIN`, `PROJECT_MANAGER`, or `TEAM_MEMBER` |
| `created_at` | TEXT | ISO-8601 UTC timestamp |

### `projects`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `name` | TEXT | Required |
| `description` | TEXT | Defaults to an empty string |
| `manager_id` | INTEGER | FK → `users.id`, required |
| `deadline` | TEXT | `YYYY-MM-DD`, nullable |
| `created_by` | INTEGER | FK → `users.id`, nullable |
| `created_at` | TEXT | ISO-8601 UTC timestamp |
| `updated_at` | TEXT | Updated by project and task edits |

### `project_members`

| Column | Type | Notes |
| --- | --- | --- |
| `project_id` | INTEGER | FK → `projects.id`, part of composite PK |
| `user_id` | INTEGER | FK → `users.id`, part of composite PK |
| `added_at` | TEXT | ISO-8601 UTC timestamp |

The project manager is always a member. Membership grants read access to the
project and its tasks.

### `tasks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `project_id` | INTEGER | FK → `projects.id`, required |
| `title` | TEXT | Required |
| `description` | TEXT | Defaults to an empty string |
| `status` | TEXT | `TODO`, `IN_PROGRESS`, or `COMPLETED` |
| `priority` | TEXT | `LOW`, `MEDIUM`, or `HIGH` |
| `due_date` | TEXT | `YYYY-MM-DD`, nullable |
| `assigned_to` | INTEGER | FK → `users.id`, nullable |
| `created_by` | INTEGER | FK → `users.id`, nullable |
| `created_at` | TEXT | ISO-8601 UTC timestamp |
| `updated_at` | TEXT | Updated on every task edit |

### `comments`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `task_id` | INTEGER | FK → `tasks.id`, required |
| `user_id` | INTEGER | FK → `users.id`, required |
| `body` | TEXT | Required, maximum 2,000 characters through the API |
| `created_at` | TEXT | ISO-8601 UTC timestamp |

### `attachments`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `task_id` | INTEGER | FK → `tasks.id`, required |
| `uploaded_by` | INTEGER | FK → `users.id`, nullable |
| `original_name` | TEXT | Name shown to users |
| `stored_name` | TEXT | Unique generated filename on disk |
| `mime_type` | TEXT | Reported upload MIME type |
| `size` | INTEGER | Size in bytes, maximum 10 MB |
| `created_at` | TEXT | ISO-8601 UTC timestamp |

### `audit_logs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `actor_id` | INTEGER | FK → `users.id`, nullable if user is removed |
| `action` | TEXT | Example: `task.updated` |
| `entity_type` | TEXT | `project`, `task`, or `user` |
| `entity_id` | INTEGER | Affected row, nullable |
| `details` | TEXT | JSON text; parsed by the API |
| `created_at` | TEXT | ISO-8601 UTC timestamp |

## Indexes

| Index | Purpose |
| --- | --- |
| `idx_projects_manager` | Projects managed by a user |
| `idx_project_members_user` | Projects a user belongs to |
| `idx_tasks_project` | Project task lists and progress counts |
| `idx_tasks_assignee` | “My tasks” and workload queries |
| `idx_tasks_status_due` | Status filters and overdue lookups |
| `idx_comments_task` | Task comment threads |
| `idx_attachments_task` | Task attachment lists |
| `idx_audit_created` | Newest-first audit pages |

## Cascade behavior

- `project_members` rows cascade when a project or user is deleted.
- `tasks` cascade when a project is deleted.
- `comments` and `attachments` cascade when a task is deleted.
- `projects.manager_id` restricts deletion of a user who still manages work.
- `tasks.assigned_to`, `tasks.created_by`, and `attachments.uploaded_by` are set
  to `NULL` if the referenced user is deleted.

## Data integrity

Validation happens in the API layer, while SQLite enforces the important
structural rules:

- Role, status, and priority check constraints.
- Unique, case-insensitive email addresses.
- Unique stored attachment names.
- Foreign keys on every relationship.
- Composite primary key prevents duplicate project memberships.

There is no soft-delete layer. Deleting a project or task is permanent, with
the action retained in `audit_logs`.
