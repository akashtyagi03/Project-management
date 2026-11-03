// alll request from here to backend all the way
export const TOKEN_KEY = 'groundwork_token';
export const USER_KEY = 'groundwork_user';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers,
      body,
    });
  } catch (_error) {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() };

  if (!response.ok) {
    if (response.status === 401 && token && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new Event('groundwork:unauthorized'));
    }
    throw new ApiError(
      payload.error || 'Something went wrong. Please try again.',
      response.status,
      payload.details
    );
  }

  return payload;
}

async function download(path) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = 'The file could not be downloaded';
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch (_error) {
      // The response was not JSON.
    }
    throw new ApiError(message, response.status);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = encodedMatch
    ? decodeURIComponent(encodedMatch[1])
    : plainMatch
      ? plainMatch[1]
      : 'download';

  return { blob: await response.blob(), fileName };
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData }),
  download,
};
