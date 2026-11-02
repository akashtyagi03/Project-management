# Groundwork ER Diagram

Groundwork uses a small relational model: users own and join projects, projects
contain tasks, and tasks carry comments and file attachments. Audit entries are
kept separately so activity history survives normal edits.

```mermaid
erDiagram
    users {
        integer id PK
        text name
        text email UK
        text password_hash
        text role
        text created_at
    }

    projects {
        integer id PK
        text name
        text description
        integer manager_id FK
        text deadline
        integer created_by FK
        text created_at
        text updated_at
    }

    project_members {
        integer project_id PK, FK
        integer user_id PK, FK
        text added_at
    }

    tasks {
        integer id PK
        integer project_id FK
        text title
        text description
        text status
        text priority
        text due_date
        integer assigned_to FK
        integer created_by FK
        text created_at
        text updated_at
    }

    comments {
        integer id PK
        integer task_id FK
        integer user_id FK
        text body
        text created_at
    }

    attachments {
        integer id PK
        integer task_id FK
        integer uploaded_by FK
        text original_name
        text stored_name UK
        text mime_type
        integer size
        text created_at
    }

    audit_logs {
        integer id PK
        integer actor_id FK
        text action
        text entity_type
        integer entity_id
        text details
        text created_at
    }

    users ||--o{ projects : manages
    users ||--o{ project_members : joins
    projects ||--o{ project_members : has
    users ||--o{ tasks : assigned
    projects ||--o{ tasks : contains
    tasks ||--o{ comments : has
    users ||--o{ comments : writes
    tasks ||--o{ attachments : has
    users ||--o{ attachments : uploads
    users ||--o{ audit_logs : acts
```

## Relationship rules

- A project has one manager. That person must have the `PROJECT_MANAGER` or
  `ADMIN` role.
- The manager is also inserted into `project_members`, so team membership can be
  queried in one place.
- Removing a project cascades to its memberships, tasks, comments, and
  attachment records. Attachment files are removed from disk by the API.
- Removing a user is not exposed by the API. `projects.manager_id` is
  `ON DELETE RESTRICT`; task assignments and upload references become `NULL`.
- A task assignee must be the project manager or a member of that project.
- Audit log details are stored as JSON text and returned as parsed JSON by the
  API.
