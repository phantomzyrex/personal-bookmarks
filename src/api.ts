export const API_BASE = (() => {
  if (typeof window === 'undefined') {
    return '';
  }

  const port = window.location.port;
  const hostname = window.location.hostname;

  // When running the client UI on a different local port than the backend,
  // route API calls to the local backend server.
  if (port && port !== '3000' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return 'http://localhost:3000';
  }

  return '';
})();

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
};
