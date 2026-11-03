# Entity Relationship Diagram (ERD) - MongoDB

The data model uses **MongoDB collections** with document references to model relationships between users, projects, tasks, comments, attachments, and audit logs.

```mermaid
erDiagram
    users {
        ObjectId _id PK
        string name
        string email UK
        string password_hash
        string role
        Date created_at
        Date updated_at
    }

    projects {
        ObjectId _id PK
        string name
        string description
        ObjectId manager_id FK
        ObjectId[] members FK
        string deadline
        ObjectId created_by FK
        Date created_at
        Date updated_at
    }

    tasks {
        ObjectId _id PK
        ObjectId project_id FK
        string title
        string description
        string status
        string priority
        string due_date
        ObjectId assigned_to FK
        ObjectId created_by FK
        Date created_at
        Date updated_at
    }

    comments {
        ObjectId _id PK
        ObjectId task_id FK
        ObjectId user_id FK
        string body
        Date created_at
    }

    attachments {
        ObjectId _id PK
        ObjectId task_id FK
        ObjectId uploaded_by FK
        string original_name
        string stored_name UK
        string mime_type
        number size
        Date created_at
    }

    auditlogs {
        ObjectId _id PK
        ObjectId actor_id FK
        string action
        string entity_type
        string entity_id
        mixed details
        Date created_at
    }

    users ||--o{ projects : manages
    users ||--o{ projects : members
    projects ||--o{ tasks : contains
    users ||--o{ tasks : assigned
    tasks ||--o{ comments : has
    users ||--o{ comments : writes
    tasks ||--o{ attachments : has
    users ||--o{ attachments : uploads
    users ||--o{ auditlogs : acts
```

## Relationship & Integrity Rules

- **Projects**: Each project is managed by a single user (`manager_id` with role `PROJECT_MANAGER` or `ADMIN`) and maintains an array of assigned team members (`members`).
- **Tasks**: Belongs to a project (`project_id`). Can be assigned to a team member (`assigned_to`) who belongs to the project team.
- **Comments & Attachments**: Scoped directly to tasks (`task_id`). When a task or project is deleted, related comments and attachment documents/files are cleaned up.
- **Audit Logs**: Maintain independent system activity logs with actor reference and structured JSON details.
