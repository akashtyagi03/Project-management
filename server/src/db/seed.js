const bcrypt = require('bcryptjs');

function dateFromNow(days) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function timestampFromNow(days, hours = 0) {
  const date = new Date();
  date.setUTCHours(9 + hours, 30, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function seedDemoData(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount > 0) return false;

  const passwordHash = (password) => bcrypt.hashSync(password, 10);

  const users = [
    ['Aarav Mehta', 'admin@groundwork.dev', passwordHash('Admin@123'), 'ADMIN', 68],
    ['Priya Sharma', 'priya@groundwork.dev', passwordHash('Manager@123'), 'PROJECT_MANAGER', 54],
    ['Marcus Lee', 'marcus@groundwork.dev', passwordHash('Manager@123'), 'PROJECT_MANAGER', 51],
    ['Rohan Iyer', 'rohan@groundwork.dev', passwordHash('Member@123'), 'TEAM_MEMBER', 47],
    ['Neha Kulkarni', 'neha@groundwork.dev', passwordHash('Member@123'), 'TEAM_MEMBER', 41],
    ['Daniel Cho', 'daniel@groundwork.dev', passwordHash('Member@123'), 'TEAM_MEMBER', 36],
  ];

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  const insertProject = db.prepare(`
    INSERT INTO projects (name, description, manager_id, deadline, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMember = db.prepare(
    'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)'
  );

  const insertTask = db.prepare(`
    INSERT INTO tasks
      (project_id, title, description, status, priority, due_date, assigned_to, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertComment = db.prepare(
    'INSERT INTO comments (task_id, user_id, body, created_at) VALUES (?, ?, ?, ?)'
  );

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const seed = db.transaction(() => {
    users.forEach((user) => {
      insertUser.run(
        user[0],
        user[1],
        user[2],
        user[3],
        timestampFromNow(-user[4])
      );
    });

    const projects = [
      {
        name: 'Website redesign',
        description:
          'Rebuild the marketing site on the new design system. The current site is slow, hard to edit, and no longer reflects the product.',
        managerId: 2,
        deadline: dateFromNow(18),
        createdBy: 1,
        createdDaysAgo: 28,
        members: [2, 4, 5, 6],
      },
      {
        name: 'Mobile app v2.0',
        description:
          'Second major release of the mobile app: offline support, biometric login, and a cleaner task experience.',
        managerId: 2,
        deadline: dateFromNow(45),
        createdBy: 1,
        createdDaysAgo: 21,
        members: [2, 4, 5, 6],
      },
      {
        name: 'SOC 2 readiness',
        description:
          'Close the gaps identified in the readiness assessment and get the evidence pack ready for the auditor.',
        managerId: 3,
        deadline: dateFromNow(62),
        createdBy: 3,
        createdDaysAgo: 17,
        members: [3, 4, 5, 6],
      },
      {
        name: 'Customer onboarding revamp',
        description:
          'A shorter, clearer onboarding flow for new accounts. Shipped ahead of schedule last month.',
        managerId: 2,
        deadline: dateFromNow(-12),
        createdBy: 2,
        createdDaysAgo: 54,
        members: [2, 4, 5, 6],
      },
    ];

    projects.forEach((project) => {
      insertProject.run(
        project.name,
        project.description,
        project.managerId,
        project.deadline,
        project.createdBy,
        timestampFromNow(-project.createdDaysAgo),
        timestampFromNow(-Math.min(project.createdDaysAgo, 4))
      );
      const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
      project.id = projectId;
      project.members.forEach((userId) => insertMember.run(projectId, userId));
    });

    const tasks = [
      [1, 'Finalise homepage wireframes', 'Loose ends on the mobile breakpoints. Figma link is in the thread.', 'COMPLETED', 'HIGH', dateFromNow(-2), 4, 2],
      [1, 'Build responsive navigation', 'Includes the compact menu under 768px and keyboard focus states.', 'IN_PROGRESS', 'HIGH', dateFromNow(3), 5, 2],
      [1, 'Migrate case study content', 'Move the six existing case studies into the CMS and fix broken links.', 'TODO', 'MEDIUM', dateFromNow(8), 6, 2],
      [1, 'Accessibility audit', 'Run axe across the main templates and log the issues worth fixing this cycle.', 'TODO', 'MEDIUM', dateFromNow(6), 4, 2],
      [1, 'Set up analytics events', 'Confirm the event names with Priya before wiring anything up.', 'TODO', 'LOW', dateFromNow(12), 5, 4],
      [2, 'Push notification service', 'Needs a retry path before we can call it production ready.', 'IN_PROGRESS', 'HIGH', dateFromNow(5), 4, 2],
      [2, 'Offline mode for task list', 'Cache the last task list and queue mutations while offline.', 'TODO', 'HIGH', dateFromNow(10), 6, 2],
      [2, 'App store screenshots', 'New screenshots for the six key flows, light and dark mode.', 'TODO', 'LOW', dateFromNow(15), 5, 2],
      [2, 'Biometric login', 'Face ID and fingerprint unlock are now in the release build.', 'COMPLETED', 'MEDIUM', dateFromNow(-1), 4, 2],
      [2, 'Release checklist', 'Final QA pass, changelog, and staged rollout plan.', 'TODO', 'MEDIUM', dateFromNow(20), 6, 2],
      [3, 'Draft access control policy', 'First draft has been reviewed by legal. Small changes requested.', 'COMPLETED', 'HIGH', dateFromNow(-4), 5, 3],
      [3, 'Vendor risk register', 'Still waiting on two vendor questionnaires. Everything else is in.', 'IN_PROGRESS', 'MEDIUM', dateFromNow(7), 6, 3],
      [3, 'Incident response tabletop', 'Reschedule with the on-call group. This one slipped.', 'TODO', 'HIGH', dateFromNow(-1), 4, 3],
      [3, 'Employee security training', 'Target is 100% completion before the evidence pack is submitted.', 'TODO', 'LOW', dateFromNow(21), 5, 3],
      [3, 'Collect evidence for CC6', 'Pull the logs and screenshots for the CC6 controls into the shared folder.', 'IN_PROGRESS', 'MEDIUM', dateFromNow(14), 6, 3],
      [4, 'Map current onboarding flow', 'Interview notes and the current journey map are in the project folder.', 'COMPLETED', 'MEDIUM', dateFromNow(-20), 5, 2],
      [4, 'Write welcome email sequence', 'Three emails: welcome, first project, first invite.', 'COMPLETED', 'LOW', dateFromNow(-16), 6, 2],
      [4, 'Ship in-app checklist', 'Live for all new accounts since the release.', 'COMPLETED', 'HIGH', dateFromNow(-14), 4, 2],
    ];

    tasks.forEach((task, index) => {
      const createdDaysAgo = Math.max(1, 15 - Math.floor(index / 2));
      insertTask.run(
        task[0],
        task[1],
        task[2],
        task[3],
        task[4],
        task[5],
        task[6],
        task[7],
        timestampFromNow(-createdDaysAgo, index % 4),
        timestampFromNow(-Math.floor(createdDaysAgo / 3), index % 3)
      );
    });

    insertComment.run(1, 2, 'Wireframes look good. Let us lock the content before the next review.', timestampFromNow(-3, 1));
    insertComment.run(1, 4, 'Done. The only open question is whether we keep the customer logos on mobile.', timestampFromNow(-2, 2));
    insertComment.run(2, 5, 'Desktop nav is done. Working through the keyboard states now.', timestampFromNow(-1, 1));
    insertComment.run(13, 3, 'This needs to happen before the next audit checkpoint. I will send a new invite.', timestampFromNow(0, 1));
    insertComment.run(9, 2, 'Merged and tested on both devices. Nice work.', timestampFromNow(-1, 3));

    insertAudit.run(1, 'project.created', 'project', 1, JSON.stringify({ name: 'Website redesign' }), timestampFromNow(-28));
    insertAudit.run(1, 'task.created', 'task', 1, JSON.stringify({ title: 'Finalise homepage wireframes' }), timestampFromNow(-14));
    insertAudit.run(3, 'project.created', 'project', 3, JSON.stringify({ name: 'SOC 2 readiness' }), timestampFromNow(-17));
    insertAudit.run(4, 'task.updated', 'task', 9, JSON.stringify({ title: 'Biometric login', status: 'COMPLETED' }), timestampFromNow(-1));
    insertAudit.run(1, 'member.added', 'project', 1, JSON.stringify({ name: 'Daniel Cho' }), timestampFromNow(-10));
    insertAudit.run(1, 'user.role_updated', 'user', 3, JSON.stringify({ name: 'Marcus Lee', from: 'TEAM_MEMBER', to: 'PROJECT_MANAGER' }), timestampFromNow(-9));
  });

  seed();
  return true;
}

module.exports = { seedDemoData };
