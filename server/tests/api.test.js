const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'groundwork-test-uploads-'));

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/project_management_test';
process.env.UPLOADS_DIR = uploadsDir;
process.env.SEED_DEMO = 'true';
process.env.JWT_SECRET = 'groundwork-test-secret';

const request = require('supertest');
const app = require('../src/app');
const { closeDatabase } = require('../src/db');

const tokens = {};

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function login(email, password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  assert.equal(response.status, 200);
  return response.body.token;
}

before(async () => {
  tokens.admin = await login('admin@groundwork.dev', 'Admin@123');
  tokens.manager = await login('priya@groundwork.dev', 'Manager@123');
  tokens.member = await login('rohan@groundwork.dev', 'Member@123');
  tokens.otherMember = await login('neha@groundwork.dev', 'Member@123');

  const [resAdmin, resManager, resMember, resOther] = await Promise.all([
    request(app).get('/api/auth/me').set(auth(tokens.admin)),
    request(app).get('/api/auth/me').set(auth(tokens.manager)),
    request(app).get('/api/auth/me').set(auth(tokens.member)),
    request(app).get('/api/auth/me').set(auth(tokens.otherMember)),
  ]);

  tokens.adminUser = resAdmin.body.user;
  tokens.managerUser = resManager.body.user;
  tokens.memberUser = resMember.body.user;
  tokens.otherMemberUser = resOther.body.user;
});

after(async () => {
  await closeDatabase();
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

test('health check is public', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.service, 'groundwork-api');
});

test('API documentation is available', async () => {
  const response = await request(app).get('/api/docs/');

  assert.equal(response.status, 200);
  assert.match(response.text, /Groundwork API/);
  assert.match(response.text, /swagger-ui/);
});

test('protected routes require a token', async () => {
  const projects = await request(app).get('/api/projects');
  const tasks = await request(app).get('/api/tasks');

  assert.equal(projects.status, 401);
  assert.equal(tasks.status, 401);
});

test('login returns the current user and rejects bad credentials', async () => {
  const current = await request(app).get('/api/auth/me').set(auth(tokens.admin));

  assert.equal(current.status, 200);
  assert.equal(current.body.user.email, 'admin@groundwork.dev');
  assert.equal(current.body.user.role, 'ADMIN');

  const badPassword = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@groundwork.dev', password: 'not-the-password' });

  assert.equal(badPassword.status, 401);
});

test('registration creates a team member and blocks duplicate emails', async () => {
  const payload = {
    name: 'Test Person',
    email: 'test.person@groundwork.dev',
    password: 'Member@123',
  };

  const created = await request(app).post('/api/auth/register').send(payload);

  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, 'TEAM_MEMBER');
  assert.ok(created.body.token);

  const duplicate = await request(app).post('/api/auth/register').send(payload);
  assert.equal(duplicate.status, 409);
});

test('audit logs are restricted to admins', async () => {
  const forbidden = await request(app)
    .get('/api/audit')
    .set(auth(tokens.member));

  assert.equal(forbidden.status, 403);

  const response = await request(app)
    .get('/api/audit')
    .set(auth(tokens.admin));

  assert.equal(response.status, 200);
  assert.ok(response.body.data.length > 0);
  assert.ok(response.body.meta.total >= 6);
});

test('dashboard and task filters validate input', async () => {
  const dashboard = await request(app)
    .get('/api/dashboard')
    .set(auth(tokens.admin));

  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.body.summary.projects >= 4);
  assert.ok(dashboard.body.summary.tasks >= 18);

  const badStatus = await request(app)
    .get('/api/tasks?status=NOT_A_STATUS')
    .set(auth(tokens.admin));

  assert.equal(badStatus.status, 400);

  const filtered = await request(app)
    .get('/api/tasks?status=TODO&priority=HIGH&limit=5')
    .set(auth(tokens.admin));

  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.data.length <= 5);
  assert.ok(filtered.body.data.every((task) => task.status === 'TODO'));
  assert.ok(filtered.body.data.every((task) => task.priority === 'HIGH'));
});

test('admins can change roles but cannot change their own', async () => {
  const selfChange = await request(app)
    .patch(`/api/users/${tokens.adminUser.id}/role`)
    .set(auth(tokens.admin))
    .send({ role: 'PROJECT_MANAGER' });

  assert.equal(selfChange.status, 400);

  const changed = await request(app)
    .patch(`/api/users/${tokens.otherMemberUser.id}/role`)
    .set(auth(tokens.admin))
    .send({ role: 'PROJECT_MANAGER' });

  assert.equal(changed.status, 200);
  assert.equal(changed.body.data.role, 'PROJECT_MANAGER');

  await request(app)
    .patch(`/api/users/${tokens.otherMemberUser.id}/role`)
    .set(auth(tokens.admin))
    .send({ role: 'TEAM_MEMBER' });
});

describe('project and task workflow', () => {
  let projectId;
  let taskId;
  let commentId;
  let attachmentId;

  before(async () => {
    const response = await request(app)
      .post('/api/projects')
      .set(auth(tokens.manager))
      .send({
        name: 'Internal test project',
        description: 'Created by the API test suite.',
        deadline: '2026-12-15',
      });

    assert.equal(response.status, 201);
    projectId = response.body.data.id;
    assert.equal(response.body.data.manager_id, tokens.managerUser.id);
    assert.equal(response.body.data.progress, 0);
  });

  test('members cannot create projects', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set(auth(tokens.member))
      .send({ name: 'Member project' });

    assert.equal(response.status, 403);
  });

  test('project access is limited to its team and admins', async () => {
    const hidden = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(tokens.member));

    assert.equal(hidden.status, 403);

    const adminView = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(tokens.admin));

    assert.equal(adminView.status, 200);
    assert.equal(adminView.body.data.name, 'Internal test project');
  });

  test('the manager can add project members', async () => {
    const added = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set(auth(tokens.manager))
      .send({ userId: tokens.memberUser.id });

    assert.equal(added.status, 201);
    assert.equal(added.body.data.name, 'Rohan Iyer');

    const duplicate = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set(auth(tokens.manager))
      .send({ userId: tokens.memberUser.id });

    assert.equal(duplicate.status, 409);
  });

  test('tasks can only be assigned to project members', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(auth(tokens.manager))
      .send({
        projectId,
        title: 'Assigned to an outsider',
        assignedTo: tokens.otherMemberUser.id,
        dueDate: '2026-12-01',
      });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /project team/i);
  });

  test('the manager can create a task for a member', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(auth(tokens.manager))
      .send({
        projectId,
        title: 'Write the test plan',
        description: 'Cover the happy path and the permission rules.',
        status: 'TODO',
        priority: 'HIGH',
        dueDate: '2026-12-01',
        assignedTo: tokens.memberUser.id,
      });

    assert.equal(response.status, 201);
    taskId = response.body.data.id;
    assert.equal(response.body.data.assignee_name, 'Rohan Iyer');
    assert.equal(response.body.data.comments_count, 0);
  });

  test('members can update status but not manager-only fields', async () => {
    const status = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth(tokens.member))
      .send({ status: 'IN_PROGRESS' });

    assert.equal(status.status, 200);
    assert.equal(status.body.data.status, 'IN_PROGRESS');

    const title = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth(tokens.member))
      .send({ title: 'Renamed by a member' });

    assert.equal(title.status, 403);
  });

  test('tasks on private projects are not visible to outsiders', async () => {
    const response = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set(auth(tokens.otherMember));

    assert.equal(response.status, 403);
  });

  test('comments can be added and moderated by the manager', async () => {
    const created = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set(auth(tokens.member))
      .send({ body: 'Working through the edge cases now.' });

    assert.equal(created.status, 201);
    commentId = created.body.data.id;

    const comments = await request(app)
      .get(`/api/tasks/${taskId}/comments`)
      .set(auth(tokens.member));

    assert.equal(comments.status, 200);
    assert.equal(comments.body.data.length, 1);
    assert.equal(comments.body.data[0].user_name, 'Rohan Iyer');

    const removed = await request(app)
      .delete(`/api/tasks/${taskId}/comments/${commentId}`)
      .set(auth(tokens.manager));

    assert.equal(removed.status, 204);
  });

  test('attachments can be uploaded, downloaded, and removed', async () => {
    const uploaded = await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .set(auth(tokens.member))
      .attach('file', Buffer.from('groundwork attachment'), 'notes.txt');

    assert.equal(uploaded.status, 201);
    attachmentId = uploaded.body.data.id;
    assert.equal(uploaded.body.data.original_name, 'notes.txt');

    const download = await request(app)
      .get(`/api/tasks/${taskId}/attachments/${attachmentId}/download`)
      .set(auth(tokens.member));

    assert.equal(download.status, 200);
    assert.equal(download.text, 'groundwork attachment');

    const removed = await request(app)
      .delete(`/api/tasks/${taskId}/attachments/${attachmentId}`)
      .set(auth(tokens.member));

    assert.equal(removed.status, 204);
  });

  test('project progress reflects completed tasks', async () => {
    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth(tokens.member))
      .send({ status: 'COMPLETED' });

    const response = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(tokens.manager));

    assert.equal(response.status, 200);
    assert.equal(response.body.data.completed_tasks, 1);
    assert.equal(response.body.data.progress, 100);
    assert.equal(response.body.data.members.length, 2);
  });

  test('only managers can delete tasks', async () => {
    const forbidden = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set(auth(tokens.member));

    assert.equal(forbidden.status, 403);

    const removed = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set(auth(tokens.manager));

    assert.equal(removed.status, 204);
  });

  test('the project can be deleted by an admin', async () => {
    const removed = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set(auth(tokens.admin));

    assert.equal(removed.status, 204);

    const missing = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(tokens.admin));

    assert.equal(missing.status, 404);
  });
});
