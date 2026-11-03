# Database Schema (MongoDB / Mongoose)

The application uses **MongoDB** with **Mongoose** as the object data modeling (ODM) layer. Models are defined with strict schemas, validation, timestamps, and indexes.

---

## Collections

### `users`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Auto | Document ID |
| `name` | String | Yes | 2–80 characters, trimmed |
| `email` | String | Yes | Unique, lowercase, indexed |
| `password_hash` | String | Yes | bcrypt hash |
| `role` | String | Yes | `ADMIN`, `PROJECT_MANAGER`, or `TEAM_MEMBER` (Default: `TEAM_MEMBER`) |
| `created_at` | Date | Auto | Timestamp |
| `updated_at` | Date | Auto | Timestamp |

---

### `projects`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Auto | Document ID |
| `name` | String | Yes | Project title, trimmed |
| `description` | String | No | Project description |
| `manager_id` | ObjectId | Yes | Ref $\rightarrow$ `users` (Manager) |
| `members` | Array[ObjectId] | No | Array of User ObjectIds who belong to the team |
| `deadline` | String | No | Deadline date (`YYYY-MM-DD`) |
| `created_by` | ObjectId | No | Ref $\rightarrow$ `users` (Creator) |
| `created_at` | Date | Auto | Timestamp |
| `updated_at` | Date | Auto | Timestamp |

---

### `tasks`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Auto | Document ID |
| `project_id` | ObjectId | Yes | Ref $\rightarrow$ `projects`, indexed |
| `title` | String | Yes | Task title |
| `description` | String | No | Detailed task description |
| `status` | String | Yes | `TODO`, `IN_PROGRESS`, `COMPLETED` (Default: `TODO`) |
| `priority` | String | Yes | `LOW`, `MEDIUM`, `HIGH` (Default: `MEDIUM`) |
| `due_date` | String | No | Due date (`YYYY-MM-DD`) |
| `assigned_to` | ObjectId | No | Ref $\rightarrow$ `users` (Assignee), indexed |
| `created_by` | ObjectId | No | Ref $\rightarrow$ `users` |
| `created_at` | Date | Auto | Timestamp |
| `updated_at` | Date | Auto | Timestamp |

---

### `comments`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Auto | Document ID |
| `task_id` | ObjectId | Yes | Ref $\rightarrow$ `tasks`, indexed |
| `user_id` | ObjectId | Yes | Ref $\rightarrow$ `users` (Author) |
| `body` | String | Yes | Comment content |
| `created_at` | Date | Auto | Timestamp |

---

### `attachments`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Auto | Document ID |
| `task_id` | ObjectId | Yes | Ref $\rightarrow$ `tasks`, indexed |
| `uploaded_by` | ObjectId | No | Ref $\rightarrow$ `users` |
| `original_name` | String | Yes | Uploaded file name |
| `stored_name` | String | Yes | Stored unique filename on disk |
| `mime_type` | String | Yes | MIME type |
| `size` | Number | Yes | File size in bytes |
| `created_at` | Date | Auto | Timestamp |

---

### `auditlogs`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Auto | Document ID |
| `actor_id` | ObjectId | No | Ref $\rightarrow$ `users`, indexed |
| `action` | String | Yes | e.g., `project.created`, `task.updated` |
| `entity_type` | String | Yes | `project`, `task`, or `user` |
| `entity_id` | String | No | ID of affected resource |
| `details` | Mixed | No | Additional context / metadata payload |
| `created_at` | Date | Auto | Timestamp |
