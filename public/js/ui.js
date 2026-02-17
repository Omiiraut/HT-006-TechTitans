/**
 * Loading spinner and toast notifications.
 */
(function () {
  function spinner(show) {
    var el = document.getElementById('global-spinner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-spinner';
      el.className = 'global-spinner';
      el.innerHTML = '<div class="spinner-overlay"><div class="spinner-border text-light" role="status"><span class="visually-hidden">Loading...</span></div></div>';
      document.body.appendChild(el);
    }
    el.style.display = show ? 'block' : 'none';
  }

  function toast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.setAttribute('role', 'alert');
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      el.classList.add('toast-show');
    }, 10);
    setTimeout(function () {
      el.classList.remove('toast-show');
      setTimeout(function () { el.remove(); }, 300);
    }, 3500);
  }

  window.MediaiUI = {
    showSpinner: function () { spinner(true); },
    hideSpinner: function () { spinner(false); },
    toast: toast,
    success: function (msg) { toast(msg, 'success'); },
    error: function (msg) { toast(msg, 'danger'); },
    info: function (msg) { toast(msg, 'info'); },
  };
})();
