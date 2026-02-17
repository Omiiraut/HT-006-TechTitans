/**
 * app.js
 * Main entry: loads user name and initializes theme. Other modules handle navigation, onboarding, dashboard, and chat.
 */

(function () {
  function loadUserName() {
    try {
      const saved = localStorage.getItem('drAvaUser');
      if (saved) {
        const user = JSON.parse(saved);
        const nameEl = document.getElementById('user-name');
        if (nameEl && user.fullName) {
          var first = user.fullName.split(' ')[0] || user.fullName;
          nameEl.textContent = first;
        }
      }
    } catch (e) {
      console.warn('Could not load user name', e);
    }
  }

  function init() {
    loadUserName();
    if (typeof initThemeToggle === 'function') {
      initThemeToggle();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
