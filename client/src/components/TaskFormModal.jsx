import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Modal } from './Modal';
import { STATUS_LABELS, PRIORITY_LABELS } from './taskLabels';

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  dueDate: '',
  assignedTo: '',
};

export function TaskFormModal({ open, onClose, onSaved, task = null, projectId, project = null }) {
  const { toast } = useToast();
  const isEdit = Boolean(task);
  const targetProjectId = task?.project_id || projectId;
  const [form, setForm] = useState(EMPTY_FORM);
  const [projectData, setProjectData] = useState(project?.members ? project : null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    setForm({
      title: task?.title || '',
      description: task?.description || '',
      status: task?.status || 'TODO',
      priority: task?.priority || 'MEDIUM',
      dueDate: task?.due_date || '',
      assignedTo: task?.assigned_to ? String(task.assigned_to) : '',
    });
    setError('');
    setSubmitting(false);

    if (project?.members) {
      setProjectData(project);
      return;
    }

    if (targetProjectId) {
      api
        .get(`/projects/${targetProjectId}`)
        .then(({ data }) => setProjectData(data))
        .catch((requestError) => setError(requestError.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, targetProjectId]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.title.trim().length < 2) {
      setError('Give the task a title (at least 2 characters).');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
    };
    if (!isEdit) payload.projectId = Number(targetProjectId);

    setSubmitting(true);
    try {
      const response = isEdit
        ? await api.patch(`/tasks/${task.id}`, payload)
        : await api.post('/tasks', payload);
      toast(isEdit ? 'Task updated.' : 'Task added to the project.');
      onSaved(response.data);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const members = projectData?.members || [];
  const assigneeNotOnTeam =
    isEdit &&
    task?.assigned_to &&
    !members.some((member) => member.id === task.assigned_to);

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? 'Edit task' : 'New task'}
      subtitle={
        isEdit
          ? 'Keep the details current so everyone knows what “done” means.'
          : 'Add enough context to make the next action obvious.'
      }
      size="lg"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="task-form"
            className="button button--primary"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
          </button>
        </>
      }
    >
      {error && (
        <div className="form-alert" role="alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      <form id="task-form" className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Task title</span>
          <input
            type="text"
            value={form.title}
            onChange={update('title')}
            placeholder="What needs to happen?"
            maxLength={160}
            autoFocus
          />
        </label>

        <label className="field">
          <span>Description <small>Optional</small></span>
          <textarea
            value={form.description}
            onChange={update('description')}
            placeholder="Add context, links, or acceptance criteria."
            rows={4}
            maxLength={5000}
          />
        </label>

        <div className="form-row form-row--three">
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={update('status')}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Priority</span>
            <select value={form.priority} onChange={update('priority')}>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Due date <small>Optional</small></span>
            <input type="date" value={form.dueDate} onChange={update('dueDate')} />
          </label>
        </div>

        <label className="field">
          <span>Assignee <small>Optional</small></span>
          <select value={form.assignedTo} onChange={update('assignedTo')}>
            <option value="">Unassigned</option>
            {assigneeNotOnTeam && (
              <option value={task.assigned_to}>{task.assignee_name} · former member</option>
            )}
            {members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
                {member.id === projectData?.manager_id ? ' · Project manager' : ''}
              </option>
            ))}
          </select>
          {assigneeNotOnTeam && (
            <small className="field-hint">
              This person is no longer on the team. Choose someone current or unassign the task.
            </small>
          )}
        </label>
      </form>
    </Modal>
  );
}
