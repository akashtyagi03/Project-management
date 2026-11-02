import { Check, Clock3 } from 'lucide-react';
import { Avatar } from './Avatar';

const TASKS = [
  { title: 'Finalise homepage wireframes', done: true, person: 'Rohan Iyer' },
  { title: 'Build responsive navigation', done: false, person: 'Neha Kulkarni' },
  { title: 'Migrate case study content', done: false, person: 'Daniel Cho' },
];

export function AuthPreview() {
  return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-preview__top">
        <div>
          <span>Website redesign</span>
          <small>Due in 18 days</small>
        </div>
        <strong>20%</strong>
      </div>
      <div className="auth-preview__progress">
        <span />
      </div>
      <ul className="auth-preview__tasks">
        {TASKS.map((task) => (
          <li key={task.title}>
            <span className={`auth-check ${task.done ? 'auth-check--done' : ''}`}>
              {task.done ? <Check size={13} /> : <Clock3 size={12} />}
            </span>
            <span className={task.done ? 'auth-task-done' : ''}>{task.title}</span>
            <Avatar name={task.person} size={22} />
          </li>
        ))}
      </ul>
      <div className="auth-preview__team">
        <span>Working on it</span>
        <div className="auth-preview__avatars">
          <Avatar name="Priya Sharma" size={24} />
          <Avatar name="Rohan Iyer" size={24} />
          <Avatar name="Neha Kulkarni" size={24} />
          <span className="auth-preview__more">+1</span>
        </div>
      </div>
    </div>
  );
}
