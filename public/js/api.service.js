/**
 * API service: base URL, JWT attachment, refresh on 401, typed methods.
 */
(function () {
  function getBase() {
    if (typeof window === 'undefined') return '';
    if (window.MediaiApiBase) return window.MediaiApiBase;
    if (window.location.protocol === 'file:') return 'http://localhost:3000';
    return '';
  }

  function getAccessToken() {
    try {
      return localStorage.getItem('mediai_access_token');
    } catch (e) {
      return null;
    }
  }

  function getRefreshToken() {
    try {
      return localStorage.getItem('mediai_refresh_token');
    } catch (e) {
      return null;
    }
  }

  function setTokens(access, refresh) {
    try {
      if (access) localStorage.setItem('mediai_access_token', access);
      if (refresh) localStorage.setItem('mediai_refresh_token', refresh);
    } catch (e) {}
  }

  function clearTokens() {
    try {
      localStorage.removeItem('mediai_access_token');
      localStorage.removeItem('mediai_refresh_token');
      localStorage.removeItem('mediai_user');
    } catch (e) {}
  }

  let refreshing = null;
  function refreshAccessToken() {
    if (refreshing) return refreshing;
    const refresh = getRefreshToken();
    if (!refresh) return Promise.reject(new Error('No refresh token'));
    refreshing = fetch(getBase() + '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.accessToken) setTokens(data.accessToken, null);
        return data.accessToken;
      })
      .finally(() => { refreshing = null; });
    return refreshing;
  }

  function request(method, path, body, skipAuth) {
    const url = getBase() + path;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const token = getAccessToken();
    if (token && !skipAuth) opts.headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) opts.body = JSON.stringify(body);

    function doReq(access) {
      if (access) opts.headers.Authorization = 'Bearer ' + access;
      return fetch(url, opts).then((res) => {
        if (res.status === 401 && !skipAuth && path !== '/api/v1/auth/refresh') {
          return refreshAccessToken().then((newToken) => doReq(newToken)).catch((e) => {
            clearTokens();
            if (typeof window.onAuthRequired === 'function') window.onAuthRequired();
            return Promise.reject(e);
          });
        }
        const contentType = res.headers.get('Content-Type') || '';
        const isJson = contentType.indexOf('application/json') !== -1;
        const next = isJson ? res.json() : res.text();
        return next.then((data) => {
          if (!res.ok) {
            const err = new Error(data?.message || data || 'Request failed');
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      });
    }
    return doReq(token);
  }

  window.MediaiApi = {
    getBase,
    getAccessToken,
    setTokens,
    clearTokens,
    get: (path) => request('GET', path),
    post: (path, body, skipAuth) => request('POST', path, body, skipAuth),
    patch: (path, body) => request('PATCH', path, body),
    auth: {
      register: (name, email, password) =>
        request('POST', '/api/v1/auth/register', { name, email, password }, true),
      login: (email, password) =>
        request('POST', '/api/v1/auth/login', { email, password }, true),
      refresh: (refreshToken) =>
        request('POST', '/api/v1/auth/refresh', { refreshToken }, true),
    },
    users: {
      getProfile: () => request('GET', '/api/v1/users/profile'),
      updateProfile: (data) => request('PATCH', '/api/v1/users/profile', data),
      listUsers: (page, limit, search) =>
        request('GET', '/api/v1/users/users?page=' + (page || 1) + '&limit=' + (limit || 20) + (search ? '&search=' + encodeURIComponent(search) : '')),
      setActive: (id, isActive) => request('PATCH', '/api/v1/users/users/' + id + '/active', { isActive }),
    },
    consultations: {
      create: (symptoms) => request('POST', '/api/v1/consultations', { symptoms }),
      get: (id) => request('GET', '/api/v1/consultations/' + id),
      listMine: (page, limit) =>
        request('GET', '/api/v1/consultations/me?page=' + (page || 1) + '&limit=' + (limit || 20)),
      listAll: (page, limit, riskLevel) => {
        let q = 'page=' + (page || 1) + '&limit=' + (limit || 20);
        if (riskLevel) q += '&riskLevel=' + encodeURIComponent(riskLevel);
        return request('GET', '/api/v1/consultations/admin/all?' + q);
      },
      stats: () => request('GET', '/api/v1/consultations/admin/stats'),
    },
    health: () => request('GET', '/health', undefined, true),
  };
})();
