import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CalendarDays,
  Download,
  Flag,
  Paperclip,
  Pencil,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  dueInfo,
  formatBytes,
  formatDateTime,
  relativeTime,
  statusLabel,
} from '../utils/format';
import { Avatar } from './Avatar';
import { PriorityBadge, StatusBadge } from './Badge';
import { ConfirmDialog } from './Modal';
import { STATUS_LABELS } from './taskLabels';

export function TaskDrawer({ taskId, onClose, onChanged, onEdit, onDeleteRequest }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [task, setTask] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!taskId) return undefined;
    let active = true;

    setLoading(true);
    setError('');
    setTask(null);
    setAttachments([]);

    Promise.all([
      api.get(`/tasks/${taskId}`),
      api.get(`/tasks/${taskId}/attachments`),
    ])
      .then(([taskResponse, attachmentsResponse]) => {
        if (!active) return;
        setTask(taskResponse.data);
        setAttachments(attachmentsResponse.data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [taskId, onClose]);

  if (!taskId) return null;

  const canManage =
    task && (user.role === 'ADMIN' || task.project_manager_id === user.id);
  const canChangeStatus =
    task && (canManage || task.assigned_to === user.id);
  const due = task ? dueInfo(task.due_date, task.status) : null;

  const refreshTaskCounts = (attachmentsCount) => {
    setTask((current) =>
      current
        ? {
          ...current,
          attachments_count: attachmentsCount ?? current.attachments_count,
        }
        : current
    );
  };

  const handleStatusChange = async (event) => {
    const nextStatus = event.target.value;
    const previous = task.status;
    setTask((current) => ({ ...current, status: nextStatus }));
    setChangingStatus(true);

    try {
      const response = await api.patch(`/tasks/${task.id}`, { status: nextStatus });
      setTask(response.data);
      toast(`Task moved to ${statusLabel(nextStatus).toLowerCase()}.`);
      onChanged?.();
    } catch (requestError) {
      setTask((current) => ({ ...current, status: previous }));
      toast(requestError.message, 'error');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast('Files need to be under 10 MB.', 'error');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);

    try {
      const response = await api.upload(`/tasks/${task.id}/attachments`, formData);
      const nextAttachments = [response.data, ...attachments];
      setAttachments(nextAttachments);
      refreshTaskCounts(null, nextAttachments.length);
      toast('File attached.');
      onChanged?.();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const path = attachment.download_url.replace(/^\/api/, '');
      const { blob, fileName } = await api.download(path);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      toast(requestError.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await api.delete(`/tasks/${task.id}/attachments/${deleteTarget.id}`);
      const nextAttachments = attachments.filter(
        (attachment) => attachment.id !== deleteTarget.id
      );
      setAttachments(nextAttachments);
      refreshTaskCounts(nextAttachments.length);
      toast('File removed.');
      onChanged?.();
      setDeleteTarget(null);
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="task-drawer" role="dialog" aria-modal="true" aria-label="Task details">
        <header className="task-drawer__header">
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close task"
            ref={closeButtonRef}
          >
            <X size={19} />
          </button>
          {task && (
            <div className="task-drawer__header-actions">
              {canManage && (
                <>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onEdit(task)}
                    title="Edit task"
                    aria-label="Edit task"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    onClick={() => onDeleteRequest(task)}
                    title="Delete task"
                    aria-label="Delete task"
                  >
                    <Trash2 size={17} />
                  </button>
                </>
              )}
            </div>
          )}
        </header>

        <div className="task-drawer__scroll">
          {loading && (
            <div className="drawer-loading">
              <span className="skeleton skeleton--title" />
              <span className="skeleton skeleton--line" />
              <span className="skeleton skeleton--line" />
              <span className="skeleton skeleton--panel-small" />
            </div>
          )}

          {error && !loading && (
            <div className="drawer-error">
              <AlertTriangle size={24} />
              <h2>Task unavailable</h2>
              <p>{error}</p>
              <button type="button" className="button button--secondary" onClick={onClose}>
                Close
              </button>
            </div>
          )}

          {task && !loading && (
            <>
              <div className="task-drawer__title">
                <div className="task-drawer__badges">
                  {due?.tone === 'danger' && task.status !== 'COMPLETED' && (
                    <span className="badge badge--danger">Overdue</span>
                  )}
                </div>
                <h2>{task.title}</h2>
                <p>{task.project_name}</p>
              </div>

              <div className="task-details-grid">
                <div className="task-detail">
                  <span className="task-detail__label">Status</span>
                  {canChangeStatus ? (
                    <select
                      className="select select--inline"
                      value={task.status}
                      onChange={handleStatusChange}
                      disabled={changingStatus}
                      aria-label="Task status"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={task.status} />
                  )}
                </div>

                <div className="task-detail">
                  <span className="task-detail__label">Assignee</span>
                  <span className="task-detail__value">
                    {task.assignee_name ? (
                      <>
                        <Avatar name={task.assignee_name} size={24} />
                        {task.assignee_name}
                      </>
                    ) : (
                      <>
                        <UserRound size={16} /> Unassigned
                      </>
                    )}
                  </span>
                </div>

                <div className="task-detail">
                  <span className="task-detail__label">Due date</span>
                  <span className={`task-detail__value due due--${due?.tone || 'muted'}`}>
                    <CalendarDays size={16} /> {due?.label || 'No due date'}
                  </span>
                </div>

                <div className="task-detail">
                  <span className="task-detail__label">Priority</span>
                  <span className="task-detail__value">
                    <Flag size={16} /> {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>

              <section className="drawer-section">
                <h3>Description</h3>
                {task.description ? (
                  <p className="task-description">{task.description}</p>
                ) : (
                  <p className="muted-text">No description yet.</p>
                )}
              </section>

              <section className="drawer-section">
                <div className="drawer-section__heading">
                  <h3>
                    <Paperclip size={16} /> Attachments
                    {attachments.length > 0 && <span>{attachments.length}</span>}
                  </h3>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload size={15} /> {uploading ? 'Uploading…' : 'Attach file'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={handleUpload}
                    accept=".pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip"
                  />
                </div>

                {attachments.length === 0 ? (
                  <p className="muted-text">No files attached. Up to 10 MB per file.</p>
                ) : (
                  <ul className="attachment-list">
                    {attachments.map((attachment) => {
                      const canRemove =
                        canManage || attachment.uploaded_by === user.id;
                      return (
                        <li key={attachment.id} className="attachment-item">
                          <span className="attachment-item__icon">
                            <Paperclip size={16} />
                          </span>
                          <div className="attachment-item__text">
                            <strong title={attachment.original_name}>
                              {attachment.original_name}
                            </strong>
                            <span>
                              {formatBytes(attachment.size)} · {attachment.uploaded_by_name || 'Someone'} ·{' '}
                              {relativeTime(attachment.created_at)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="icon-button icon-button--small"
                            onClick={() => handleDownload(attachment)}
                            title="Download"
                            aria-label={`Download ${attachment.original_name}`}
                          >
                            <Download size={16} />
                          </button>
                          {canRemove && (
                            <button
                              type="button"
                              className="icon-button icon-button--small icon-button--danger"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'attachment',
                                  id: attachment.id,
                                  label: attachment.original_name,
                                })
                              }
                              title="Remove file"
                              aria-label={`Remove ${attachment.original_name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>


            </>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title={deleteTarget?.type === 'comment' ? 'Delete comment?' : 'Remove file?'}
        message={
          deleteTarget?.type === 'comment'
            ? 'This comment will be removed for everyone. This cannot be undone.'
            : `“${deleteTarget?.label || 'This file'}” will be removed from the task.`
        }
        confirmLabel={deleteTarget?.type === 'comment' ? 'Delete comment' : 'Remove file'}
      />
    </div>,
    document.body
  );
}
