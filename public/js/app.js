(function () {
  function loadUserName() {
    var el = document.getElementById('user-name');
    if (!el) return;
    var u = window.MediaiAuth && window.MediaiAuth.getUser();
    if (u && u.name) el.textContent = u.name.split(' ')[0] || u.name;
    else if (window.MediaiApi && window.MediaiAuth.isAuthenticated()) {
      window.MediaiApi.users.getProfile().then(function (r) {
        if (r.user && r.user.name && el) el.textContent = r.user.name.split(' ')[0] || r.user.name;
      }).catch(function () {});
    }
  }
  function initAuthForms() {
    var loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var errEl = document.getElementById('login-error');
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      if (!window.MediaiApi) return;
      if (window.MediaiUI) window.MediaiUI.showSpinner();
      window.MediaiApi.auth.login(email, password).then(function (r) {
        if (window.MediaiUI) window.MediaiUI.hideSpinner();
        window.MediaiAuth.setUser(r.user, r.accessToken, r.refreshToken);
        if (window.MediaiUI) window.MediaiUI.success('Signed in');
        if (window.navigateTo) window.navigateTo('dashboard');
      }).catch(function (err) {
        if (window.MediaiUI) window.MediaiUI.hideSpinner();
        if (errEl) { errEl.textContent = err.message || 'Login failed'; errEl.style.display = 'block'; }
      });
    });
    var regForm = document.getElementById('register-form');
    if (regForm) regForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('reg-name').value.trim();
      var email = document.getElementById('reg-email').value.trim();
      var password = document.getElementById('reg-password').value;
      var errEl = document.getElementById('register-error');
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      if (!window.MediaiApi) return;
      if (window.MediaiUI) window.MediaiUI.showSpinner();
      window.MediaiApi.auth.register(name, email, password).then(function (r) {
        if (window.MediaiUI) window.MediaiUI.hideSpinner();
        window.MediaiAuth.setUser(r.user, null, null);
        if (window.MediaiUI) window.MediaiUI.success('Account created. Please sign in.');
        if (window.navigateTo) window.navigateTo('login');
      }).catch(function (err) {
        if (window.MediaiUI) window.MediaiUI.hideSpinner();
        if (errEl) { errEl.textContent = (err.data && err.data.details) ? err.data.details.map(function (d) { return d.message; }).join(' ') : (err.message || 'Registration failed'); errEl.style.display = 'block'; }
      });
    });
  }
  function showAdminLink() {
    if (window.MediaiAuth && window.MediaiAuth.isAdmin()) {
      var link = document.getElementById('admin-link');
      if (link) link.style.display = 'flex';
    }
  }
  function init() {
    loadUserName();
    if (typeof initThemeToggle === 'function') initThemeToggle();
    initAuthForms();
    showAdminLink();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
