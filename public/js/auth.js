/**
 * Auth: login/register screens, token storage, auth guard, redirect when unauthenticated.
 */
(function () {
  function getUser() {
    try {
      var s = localStorage.getItem('mediai_user');
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  function setUser(user, accessToken, refreshToken) {
    try {
      if (user) localStorage.setItem('mediai_user', JSON.stringify(user));
      if (typeof window.MediaiApi !== 'undefined') window.MediaiApi.setTokens(accessToken, refreshToken);
    } catch (e) {}
  }

  function isAuthenticated() {
    return !!window.MediaiApi && !!window.MediaiApi.getAccessToken();
  }

  function isAdmin() {
    var u = getUser();
    return u && u.role === 'ADMIN';
  }

  function requireAuth() {
    if (!isAuthenticated()) {
      if (typeof window.navigateTo === 'function') window.navigateTo('login');
      return false;
    }
    return true;
  }

  function logout() {
    if (window.MediaiApi) window.MediaiApi.clearTokens();
    if (typeof window.navigateTo === 'function') window.navigateTo('landing');
  }

  window.onAuthRequired = function () {
    logout();
  };

  window.MediaiAuth = {
    getUser,
    setUser,
    isAuthenticated,
    isAdmin,
    requireAuth,
    logout,
  };
})();
