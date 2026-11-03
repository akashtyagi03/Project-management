const bcrypt = require('bcryptjs');
const { User, Project, Task, Comment, AuditLog } = require('../models');

function dateFromNow(days) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function seedDemoData() {
  const userCount = await User.countDocuments();
  if (userCount > 0) return false;

  const passwordHash = (password) => bcrypt.hashSync(password, 10);

  // 1. Create Users
  const aarav = await User.create({
    name: 'Aarav Mehta',
    email: 'admin@groundwork.dev',
    password_hash: passwordHash('Admin@123'),
    role: 'ADMIN',
  });

  const priya = await User.create({
    name: 'Priya Sharma',
    email: 'priya@groundwork.dev',
    password_hash: passwordHash('Manager@123'),
    role: 'PROJECT_MANAGER',
  });

  const marcus = await User.create({
    name: 'Marcus Lee',
    email: 'marcus@groundwork.dev',
    password_hash: passwordHash('Manager@123'),
    role: 'PROJECT_MANAGER',
  });

  const rohan = await User.create({
    name: 'Rohan Iyer',
    email: 'rohan@groundwork.dev',
    password_hash: passwordHash('Member@123'),
    role: 'TEAM_MEMBER',
  });

  const neha = await User.create({
    name: 'Neha Kulkarni',
    email: 'neha@groundwork.dev',
    password_hash: passwordHash('Member@123'),
    role: 'TEAM_MEMBER',
  });

  const daniel = await User.create({
    name: 'Daniel Cho',
    email: 'daniel@groundwork.dev',
    password_hash: passwordHash('Member@123'),
    role: 'TEAM_MEMBER',
  });

  // 2. Create Projects
  const websiteProject = await Project.create({
    name: 'Website redesign',
    description:
      'Rebuild the marketing site on the new design system. Fast, clean, responsive, and easy to edit.',
    manager_id: priya._id,
    deadline: dateFromNow(18),
    created_by: aarav._id,
    members: [priya._id, rohan._id, neha._id, daniel._id],
  });

  const mobileProject = await Project.create({
    name: 'Mobile app v2.0',
    description:
      'Second major release of the mobile app: offline support, biometric login, and a cleaner task experience.',
    manager_id: priya._id,
    deadline: dateFromNow(45),
    created_by: aarav._id,
    members: [priya._id, rohan._id, neha._id, daniel._id],
  });

  const socProject = await Project.create({
    name: 'SOC 2 readiness',
    description:
      'Close the gaps identified in the readiness assessment and get the evidence pack ready for the auditor.',
    manager_id: marcus._id,
    deadline: dateFromNow(62),
    created_by: marcus._id,
    members: [marcus._id, rohan._id, neha._id, daniel._id],
  });

  // 3. Create Tasks
  const task1 = await Task.create({
    project_id: websiteProject._id,
    title: 'Audit existing marketing page content',
    description: 'Catalog current pages, identify outdated screenshots, and note copy changes.',
    status: 'COMPLETED',
    priority: 'HIGH',
    due_date: dateFromNow(-4),
    assigned_to: neha._id,
    created_by: priya._id,
  });

  const task2 = await Task.create({
    project_id: websiteProject._id,
    title: 'Design component tokens in Figma',
    description: 'Publish typography, spacing, and color variables matching the new palette.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    due_date: dateFromNow(3),
    assigned_to: rohan._id,
    created_by: priya._id,
  });

  const task3 = await Task.create({
    project_id: websiteProject._id,
    title: 'Set up Vite + React frontend boilerplate',
    description: 'Configure router, layouts, and typography fonts.',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    due_date: dateFromNow(7),
    assigned_to: daniel._id,
    created_by: priya._id,
  });

  const task4 = await Task.create({
    project_id: websiteProject._id,
    title: 'Implement responsive navigation header and drawer',
    description: 'Ensure smooth layout on desktop, tablet, and mobile views.',
    status: 'TODO',
    priority: 'MEDIUM',
    due_date: dateFromNow(12),
    assigned_to: rohan._id,
    created_by: priya._id,
  });

  const task5 = await Task.create({
    project_id: mobileProject._id,
    title: 'Research biometric authentication libraries',
    description: 'Compare React Native FaceID / TouchID plugins across iOS and Android.',
    status: 'COMPLETED',
    priority: 'HIGH',
    due_date: dateFromNow(-1),
    assigned_to: daniel._id,
    created_by: priya._id,
  });

  const task6 = await Task.create({
    project_id: mobileProject._id,
    title: 'Build offline storage caching layer',
    description: 'Cache active project and task data locally using SQLite or MMKV.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    due_date: dateFromNow(10),
    assigned_to: rohan._id,
    created_by: priya._id,
  });

  const task7 = await Task.create({
    project_id: socProject._id,
    title: 'Review employee access policies and 2FA coverage',
    description: 'Verify all admin accounts enforce MFA and documented offboarding workflows.',
    status: 'TODO',
    priority: 'HIGH',
    due_date: dateFromNow(14),
    assigned_to: neha._id,
    created_by: marcus._id,
  });

  // 4. Create Comments
  await Comment.create({
    task_id: task2._id,
    user_id: priya._id,
    body: 'The color palette tokens look fantastic! Moving this into development.',
  });

  await Comment.create({
    task_id: task2._id,
    user_id: rohan._id,
    body: 'Will have the typography scale finished by this afternoon.',
  });

  // 5. Create Audit Logs
  await AuditLog.create({
    actor_id: aarav._id,
    action: 'project.created',
    entity_type: 'project',
    entity_id: String(websiteProject._id),
    details: { name: 'Website redesign' },
  });

  await AuditLog.create({
    actor_id: priya._id,
    action: 'task.created',
    entity_type: 'task',
    entity_id: String(task2._id),
    details: { title: 'Design component tokens in Figma' },
  });

  console.log('✅ Demo data successfully seeded into MongoDB.');
  return true;
}

module.exports = { seedDemoData };
