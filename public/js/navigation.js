(function () {
  var PROTECTED = ['dashboard', 'onboarding', 'history', 'chat'];
  function navigateTo(screenId) {
    if (PROTECTED.indexOf(screenId) !== -1 && typeof window.MediaiAuth !== 'undefined' && !window.MediaiAuth.isAuthenticated()) {
      if (typeof window.navigateTo === 'function') return;
      screenId = 'login';
    }
    var screens = document.querySelectorAll('.screen');
    screens.forEach(function (s) {
      s.classList.remove('active');
      if (s.id === screenId + '-screen') s.classList.add('active');
    });
    if (screenId === 'dashboard') setActiveNav('home');
    if (screenId === 'history' && typeof window.loadHistory === 'function') window.loadHistory();
    if (screenId === 'chat' && typeof window.onChatScreenShow === 'function') window.onChatScreenShow();
  }
  function setActiveNav(navKey) {
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('active', item.getAttribute('data-nav') === navKey);
    });
  }
  window.navigateTo = navigateTo;
  window.setActiveNav = setActiveNav;
})();
