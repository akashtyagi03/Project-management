import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from './Modal';

export function ProjectFormModal({ open, onClose, onSaved, project = null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = Boolean(project);
  const [form, setForm] = useState({ name: '', description: '', deadline: '', managerId: '' });
  const [managers, setManagers] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = user.role === 'ADMIN';

  useEffect(() => {
    if (!open) return;

    setForm({
      name: project?.name || '',
      description: project?.description || '',
      deadline: project?.deadline || '',
      managerId: project?.manager_id ? String(project.manager_id) : '',
    });
    setError('');
    setSubmitting(false);

    if (isAdmin) {
      api
        .get('/users')
        .then(({ data }) => {
          const eligible = data.filter((person) =>
            ['PROJECT_MANAGER', 'ADMIN'].includes(person.role)
          );
          setManagers(eligible);
          setForm((current) => {
            if (current.managerId) return current;
            const defaultManager =
              eligible.find((person) => person.role === 'PROJECT_MANAGER') || eligible[0];
            return {
              ...current,
              managerId: String(defaultManager?.id || ''),
            };
          });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.name.trim().length < 2) {
      setError('Give the project a name (at least 2 characters).');
      return;
    }
    if (isAdmin && !form.managerId) {
      setError('Choose a project manager.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description,
      deadline: form.deadline || null,
    };
    if (isAdmin) payload.managerId = Number(form.managerId);

    setSubmitting(true);
    try {
      const response = isEdit
        ? await api.patch(`/projects/${project.id}`, payload)
        : await api.post('/projects', payload);
      toast(isEdit ? 'Project updated.' : 'Project created.');
      onSaved(response.data);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? 'Edit project' : 'New project'}
      subtitle={
        isEdit
          ? 'Update the project details and ownership.'
          : 'Set the direction, deadline, and owner. You can add the rest of the team next.'
      }
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="project-form"
            className="button button--primary"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
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

      <form id="project-form" className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Project name</span>
          <input
            type="text"
            value={form.name}
            onChange={update('name')}
            placeholder="e.g. Website redesign"
            maxLength={120}
            autoFocus
          />
        </label>

        <label className="field">
          <span>Description <small>Optional</small></span>
          <textarea
            value={form.description}
            onChange={update('description')}
            placeholder="What is this project trying to achieve?"
            rows={4}
            maxLength={5000}
          />
        </label>

        <div className="form-row">
          <label className="field">
            <span>Deadline <small>Optional</small></span>
            <input type="date" value={form.deadline} onChange={update('deadline')} />
          </label>

          {isAdmin ? (
            <label className="field">
              <span>Project manager</span>
              <select value={form.managerId} onChange={update('managerId')}>
                <option value="">Select a manager</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} · {manager.role === 'ADMIN' ? 'Admin' : 'Project manager'}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="field">
              <span>Project manager</span>
              <div className="readonly-field">
                <span>{user.name}</span>
                <small>You own this project</small>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
