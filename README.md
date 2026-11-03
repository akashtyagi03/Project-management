# Project & Task Management System

A full-stack project and task management application built with **React**, **Node.js/Express**, and **MongoDB (Mongoose)**. Features role-based access control (RBAC), real-time dashboard analytics, task workflow management (Kanban & List views, file attachments), and clean RESTful APIs.

---

## 📋 Table of Contents

- [Overview & Key Features](#-overview--key-features)
- [Tech Stack](#-tech-stack)
- [Demo Credentials](#-demo-credentials)
- [Role-Based Access Control (RBAC) Matrix](#-role-based-access-control-rbac-matrix)
- [User Registration & Security Architecture](#-user-registration--security-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Running with npm](#running-with-npm)
  - [Running with Docker Compose](#running-with-docker-compose)
- [API Documentation & Deliverables](#-api-documentation--deliverables)
- [API Endpoints Summary](#-api-endpoints-summary)
- [Automated Testing](#-automated-testing)
- [Available Scripts](#-available-scripts)

---

## 🚀 Overview & Key Features

### 1. Project Management
- **Lifecycle Tracking**: Create, update, archive, and delete projects.
- **Team Assignment**: Project Managers can add or remove team members from specific projects.
- **Dynamic Progress Calculation**: Project completion percentage auto-computes in real time based on task completion (`completed_tasks / total_tasks * 100`).

### 2. Task Management & Collaboration
- **Interactive Views**: Switch seamlessly between **Board (Kanban)** and **List** views, with a dedicated **"My Tasks"** view.
- **Workflow & Priorities**: Three status states (`To Do`, `In Progress`, `Completed`) and three priority levels (`Low`, `Medium`, `High`).
- **Deadlines & Alerts**: Visual indicators for upcoming deadlines and overdue tasks.
- **File Attachments**: Secure multipart file uploads (up to 10MB) with download streaming.

### 3. Analytics & Executive Dashboard
- High-level KPIs: Active projects, total tasks, team size, and overall completion rate.
- Status distribution breakdown across all active work.
- Overdue and upcoming deadline warnings.
- Team workload metrics tracking task volume and completion rate per member.

### 4. Authentication & Security
- **JWT Authentication** with password hashing via `bcrypt`.
- **Granular RBAC**: Strict separation of concerns across Admin, Project Manager, and Team Member roles.
- **Rate Limiting**: Brute-force protection on authentication endpoints.

---

## 🛠 Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, Vite, React Router 7, Lucide Icons, Vanilla CSS (Design Tokens & Glassmorphism) |
| **Backend** | Node.js (v20+), Express 4 |
| **Database & ODM** | MongoDB, Mongoose 8 |
| **Auth & Security** | JSON Web Tokens (JWT), bcryptjs, express-rate-limit |
| **File Handling** | Multer (with disk storage & MIME validation) |
| **Documentation** | OpenAPI 3.0, Swagger UI, Postman Collection |
| **Testing & CI** | Node.js Test Runner (`node:test`), Supertest |
| **DevOps** | Docker, Docker Compose (Multi-stage build) |

---

## 👥 Demo Credentials

The database is automatically seeded with realistic demo data on initial startup. You can test each role using the pre-configured accounts below:

| Role | Email | Password | Access Level |
| --- | --- | --- | --- |
| **Admin** | `admin@groundwork.dev` | `Admin@123` | Full system access, team role management |
| **Project Manager** | `priya@groundwork.dev` | `Manager@123` | Creates projects, assigns teams, manages tasks |
| **Project Manager** | `marcus@groundwork.dev` | `Manager@123` | Creates projects, assigns teams, manages tasks |
| **Team Member** | `rohan@groundwork.dev` | `Member@123` | Works on assigned tasks, updates status, comments |
| **Team Member** | `neha@groundwork.dev` | `Member@123` | Works on assigned tasks, updates status, comments |

> **Tip**: The login page includes a **"Demo accounts"** quick-fill button, allowing evaluators to log in instantly without manually typing credentials.

---

## 🔐 Role-Based Access Control (RBAC) Matrix

| Feature / Action | Admin | Project Manager | Team Member |
| --- | :---: | :---: | :---: |
| View Executive Dashboard | ✅ | ✅ | ✅ |
| View Projects & Tasks | All | Assigned / Managed | Assigned Only |
| Create Projects | ✅ | ✅ | ❌ |
| Edit / Delete Projects | ✅ | Project Manager (owner) | ❌ |
| Manage Project Members | ✅ | Project Manager (owner) | ❌ |
| Create / Assign Tasks | ✅ | Project Manager (owner) | ❌ |
| Update Task Status (`TODO` ➔ `IN_PROGRESS` ➔ `COMPLETED`) | ✅ | ✅ | Assigned Member |
| Edit Task Details (Title, Description, Due Date) | ✅ | Project Manager (owner) | ❌ |
| Delete Tasks | ✅ | Project Manager (owner) | ❌ |
| Attach Files | ✅ | ✅ | Project Members |
| Delete Attachments | ✅ | Project Manager (owner) | Author Only |
| Manage User Roles (`/api/users/:id/role`) | ✅ | ❌ | ❌ |

---

## 🛡 User Registration & Security Architecture

### Why does the registration form NOT ask for a user role?
In production enterprise and SaaS applications, **public self-registration forms never allow users to select their own role** (e.g. selecting "Admin" from a dropdown). Doing so would create a severe **Privilege Escalation** vulnerability, allowing any outsider to grant themselves administrative rights.

### How the system determines roles:
1. **Bootstrap Admin**: If the database has 0 users (`count === 0`), the very first account registered is automatically provisioned as the **`ADMIN`**.
2. **Default Least Privilege**: All subsequent registrations are automatically assigned the **`TEAM_MEMBER`** role.
3. **Controlled Role Elevation**: Only an active `ADMIN` can promote a team member to `PROJECT_MANAGER` or `ADMIN`. This is handled securely through the **Team** management page (`PATCH /api/users/:id/role`).

---

## 📁 Project Structure

```text
Project-management/
├── client/                     # Frontend Single Page App (React + Vite)
│   ├── src/
│   │   ├── api/                # Axios-like Fetch client with token interceptors
│   │   ├── components/         # Reusable UI (Modals, Drawers, Badges, Headers)
│   │   ├── context/            # AuthContext (state & tokens), ToastContext
│   │   ├── hooks/              # Custom hooks (e.g., useDebouncedValue)
│   │   ├── pages/              # App pages (Dashboard, Projects, Tasks, Team)
│   │   ├── styles/             # Modular CSS, design tokens & typography
│   │   └── utils/              # Formatting helpers (dates, status labels)
│   └── package.json
├── server/                     # Backend API (Node.js + Express + Mongoose)
│   ├── src/
│   │   ├── db/                 # MongoDB connection & seed runner
│   │   ├── middleware/         # Auth verification, RBAC guards, error handler
│   │   ├── models/             # Mongoose Schemas (User, Project, Task, Comment, Attachment, AuditLog)
│   │   ├── routes/             # REST API routes (auth, projects, tasks, dashboard, users, audit)
│   │   ├── utils/              # Access-control rules, audit logger, validators, upload handler
│   │   ├── app.js              # Express application configuration
│   │   └── server.js           # HTTP server bootstrap
│   ├── tests/                  # Integration test suite (Supertest + node:test)
│   └── package.json
├── docs/                       # Assignment Deliverables & Documentation
│   ├── openapi.yaml            # OpenAPI 3.0 API specification
│   ├── postman_collection.json # Ready-to-import Postman collection
│   ├── schema.md               # MongoDB collection schema & indexing details
│   └── ERD.md                  # Entity Relationship Diagram (Mermaid)
├── Dockerfile                  # Multi-stage container build
├── docker-compose.yml          # Container orchestration (Node.js API + MongoDB 7)
├── .env.example                # Environment variable template
├── package.json                # Root workspace configuration
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **MongoDB**: Local MongoDB instance (running on `mongodb://127.0.0.1:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) connection string.

---

### Environment Configuration

1. Copy the example environment file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Review the variables in `.env`:
   ```ini
   PORT=4000
   CLIENT_URL=http://localhost:5173
   JWT_SECRET=your-random-jwt-secret-key-change-this
   JWT_EXPIRES_IN=7d
   MONGODB_URI=mongodb://127.0.0.1:27017/project_management
   SEED_DEMO=true
   ```

---

### Running with npm

1. **Install dependencies** (installs root, client, and server packages):
   ```bash
   npm install
   ```

2. **Start both client and server in development mode**:
   ```bash
   npm run dev
   ```

3. Open your browser:
   - **Frontend App**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)
   - **Interactive API Docs (Swagger)**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

### Running with Docker Compose

To run the entire system in isolated containers (API + MongoDB):

```bash
docker compose up --build
```

- The API and built client will be served at **[http://localhost:4000](http://localhost:4000)**.
- MongoDB 7 runs automatically in the background on port `27017`.
- Uploads and MongoDB database files persist across container restarts using named volumes (`mongo-data` and `groundwork-uploads`).

---

## 📚 API Documentation & Deliverables

All required assignment deliverables are located in the repository:

1. **Interactive Swagger UI**: Available at [http://localhost:4000/api/docs](http://localhost:4000/api/docs) whenever the server is running.
2. **OpenAPI 3.0 Specification**: [`docs/openapi.yaml`](docs/openapi.yaml) (can be imported directly into Swagger Editor, Postman, or Insomnia).
3. **Postman Collection**: [`docs/postman_collection.json`](docs/postman_collection.json) (includes pre-configured environment variables and test scripts for token handling).
4. **Database Schema & Indexing Guide**: [`docs/schema.md`](docs/schema.md) detailing collections, field constraints, and indexes.
5. **Entity Relationship Diagram (ERD)**: [`docs/ERD.md`](docs/ERD.md) visualizing entity relationships using Mermaid diagrams.

---

## 📡 API Endpoints Summary

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Register a new user (defaults to `TEAM_MEMBER`) | Public |
| `POST` | `/api/auth/login` | Authenticate user & return JWT token | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Authenticated |

### Projects (`/api/projects`)
| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/api/projects` | List projects (with search, pagination, sort) | Authenticated |
| `POST` | `/api/projects` | Create a new project | Admin, Project Manager |
| `GET` | `/api/projects/:id` | Get project details, members, and stats | Team / Admin |
| `PUT` | `/api/projects/:id` | Update project metadata and deadline | Manager (owner), Admin |
| `DELETE` | `/api/projects/:id` | Delete project and cascade-delete tasks | Admin |
| `POST` | `/api/projects/:id/members` | Add a user to project team | Manager (owner), Admin |
| `DELETE` | `/api/projects/:id/members/:userId` | Remove user from project | Manager (owner), Admin |

### Tasks (`/api/tasks`)
| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/api/tasks` | List tasks (filter by project, assignee, status, priority) | Authenticated |
| `POST` | `/api/tasks` | Create task within a project | Manager (owner), Admin |
| `GET` | `/api/tasks/:id` | Get task details, comments, and attachments | Project Members, Admin |
| `PATCH` | `/api/tasks/:id` | Update task status or fields | Assignee (status), Manager/Admin |
| `DELETE` | `/api/tasks/:id` | Delete task | Manager (owner), Admin |
| `GET` | `/api/tasks/:id/comments` | List comments on task | Project Members, Admin |
| `POST` | `/api/tasks/:id/comments` | Post a comment on task | Project Members, Admin |
| `DELETE` | `/api/tasks/:id/comments/:commentId` | Delete a comment | Author, Manager, Admin |
| `POST` | `/api/tasks/:id/attachments` | Upload a file attachment | Project Members, Admin |
| `GET` | `/api/tasks/:id/attachments/:attachmentId/download` | Download attachment file | Project Members, Admin |
| `DELETE` | `/api/tasks/:id/attachments/:attachmentId` | Remove attachment | Author, Manager, Admin |

### Users & Dashboard (`/api/users`, `/api/dashboard`)
| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard` | Dashboard analytics & workload distribution | Authenticated |
| `GET` | `/api/users` | List workspace users with optional search | Authenticated |
| `PATCH` | `/api/users/:id/role` | Update user role (`ADMIN`, `PROJECT_MANAGER`, `TEAM_MEMBER`) | Admin only |
| `GET` | `/api/health` | Service health status check | Public |

---

## 🧪 Automated Testing

The project includes an integration test suite built with Node.js's native test runner (`node:test`) and **Supertest**:

```bash
npm test
```

### What the test suite covers:
- **Authentication**: Registration, login, duplicate email handling, and token verification.
- **RBAC Enforcement**: Verifying that Team Members cannot create projects or modify manager-only task fields, and that non-admins cannot access audit logs.
- **Project & Task Lifecycle**: Creation, member addition, assignment validations (e.g. cannot assign task to non-member), status updates, and deletion.
- **Collaboration**: Comment addition/deletion and file attachment upload/download cycles.
- **Input Validation**: Rejection of malformed ObjectIds, invalid statuses, and bad query parameters.

---

## ⚡ Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts Vite frontend (`:5173`) and Express backend (`:4000`) concurrently |
| `npm run build` | Builds the production React client into `client/dist` |
| `npm run start` | Runs the Node.js production server (serves API & static client) |
| `npm run seed` | Explicitly runs the MongoDB demo seed CLI script |
| `npm test` | Runs the backend integration test suite |
