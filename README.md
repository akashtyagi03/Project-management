# Project & Task Management System

A full-stack web application built to help organizations manage projects, teams, and tasks in one place with role-based access control, task tracking, file attachments, and a real-time progress dashboard.

---

## Features

### 1. User Authentication & Roles
- User registration and login using JWT (JSON Web Tokens).
- Secure password hashing with `bcrypt`.
- Three user roles with distinct permissions:
  - **Admin**: Full access across all projects, tasks, user management, and audit logs.
  - **Project Manager**: Create projects, assign team members, create/assign tasks, and manage project progress.
  - **Team Member**: View assigned projects and tasks, update task status, leave comments, and upload attachments.

### 2. Project Management
- Create, update, and delete projects.
- Assign project managers and deadline dates.
- Add or remove team members from projects.
- Real-time project progress tracking based on completed tasks.

### 3. Task Management
- Create, assign, edit, and delete tasks within projects.
- Task priority levels: `Low`, `Medium`, `High`.
- Task status workflow: `To Do`, `In Progress`, `Completed`.
- Due date tracking with badges for upcoming and overdue tasks.
- Task collaboration: Comments feed and file attachments.
- Board (Kanban-style) and List views, plus a personal "My Tasks" screen.

### 4. Dashboard & Analytics
- Overview of total projects, tasks, and team members.
- Task status distribution (Completed vs. In Progress vs. To Do).
- Upcoming deadlines alert.
- Team member workload and task distribution.

### 5. Technical Highlights
- **Search, Filter & Pagination**: Filter tasks and projects by status, priority, and search keywords.
- **Audit Logging**: Admins can review a chronological log of changes made across projects and tasks.
- **Input Validation & Exception Handling**: Centralized error middleware returning clean error responses.
- **Responsive Layout**: Designed for mobile, tablet, and desktop screens.

---

## Tech Stack

- **Frontend**: React 19, Vite, React Router, Lucide Icons, CSS
- **Backend**: Node.js, Express
- **Database**: MongoDB (via `mongoose`)
- **Authentication**: JWT & `bcryptjs`
- **File Uploads**: `multer`

---

## Getting Started

### Prerequisites
- Node.js (v20 or higher)
- npm
- MongoDB (local MongoDB service or MongoDB Atlas cluster connection string)

### Installation & Setup

1. **Clone the repository and enter the directory**:
   ```bash
   cd Project-management
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set your `MONGODB_URI` (e.g. `mongodb://127.0.0.1:27017/project_management` or your MongoDB Atlas URI).

4. **Start the application**:
   ```bash
   npm run dev
   ```

   - **Frontend**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:4000](http://localhost:4000)

> Note: On initial startup, demo data is automatically seeded into your MongoDB database if it is empty.

---

## Demo Accounts

You can log in with any of the following pre-seeded test accounts:

| Role | Email | Password |
| --- | --- | --- |
| **Admin** | `admin@groundwork.dev` | `Admin@123` |
| **Project Manager** | `priya@groundwork.dev` | `Manager@123` |
| **Project Manager** | `marcus@groundwork.dev` | `Manager@123` |
| **Team Member** | `rohan@groundwork.dev` | `Member@123` |
| **Team Member** | `neha@groundwork.dev` | `Member@123` |

---

## Project Structure

```text
Project-management/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── api/            # API client and request helpers
│   │   ├── components/     # Reusable UI components (Modal, Drawer, Badge, etc.)
│   │   ├── context/        # Auth & Toast context providers
│   │   ├── pages/          # Application views (Dashboard, Projects, Tasks, etc.)
│   │   └── styles/         # CSS styles and design tokens
│   └── package.json
├── server/                 # Express backend API
│   ├── src/
│   │   ├── db/             # SQLite schema and seed script
│   │   ├── middleware/     # Auth and error middleware
│   │   ├── routes/         # Express API routes (auth, projects, tasks, etc.)
│   │   ├── utils/          # Helpers for access control, validation, and uploads
│   │   └── app.js          # Express app entry point
│   └── package.json
├── .env.example
├── package.json            # Root workspace config
└── README.md
```

---

## Documentation & Deliverables

- **Interactive API Documentation (Swagger UI)**: Available at `http://localhost:4000/api/docs` when the server is running.
- **OpenAPI 3.0 Specification**: [`docs/openapi.yaml`](docs/openapi.yaml)
- **Postman Collection**: [`docs/postman_collection.json`](docs/postman_collection.json)
- **Database Schema**: [`docs/schema.md`](docs/schema.md)
- **Entity Relationship Diagram (ERD)**: [`docs/ERD.md`](docs/ERD.md)

---

## Testing

Automated API integration test suite using Node's built-in test runner (`node:test`) and Supertest:

```bash
npm test
```

The test suite runs against an isolated in-memory SQLite database and validates:
- Public health check and Swagger docs availability
- Authentication, token verification, and password validation
- Role-based permissions (Admin, Project Manager, Team Member)
- Project & Task CRUD flows, status transitions, and cascade deletes
- Audit logging and task comments/attachments

---

## Docker Support

Run the entire application in a containerized environment using Docker and Docker Compose:

```bash
docker compose up --build
```

- Runs both the client build and the API on **[http://localhost:4000](http://localhost:4000)**.
- Uses named Docker volumes (`groundwork-data` and `groundwork-uploads`) for persistent SQLite storage and uploaded attachments across container restarts.
- Includes container healthcheck monitoring `/api/health`.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Runs both client (Vite) and server (Express) concurrently |
| `npm run build` | Builds the React frontend bundle into `client/dist` |
| `npm run start` | Runs the server in production mode |
| `npm run seed` | Re-seeds initial demo data into the SQLite database |
| `npm test` | Runs the API integration test suite |
