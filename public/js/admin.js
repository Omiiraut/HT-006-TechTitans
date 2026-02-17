(function () {
  var gate = document.getElementById('admin-gate');
  var content = document.getElementById('admin-content');
  function checkAccess() {
    if (!window.MediaiApi || !window.MediaiApi.getAccessToken()) {
      gate.innerHTML = '<p class="text-danger">Not signed in.</p><a href="index.html" class="btn btn-primary">Go to login</a>';
      return;
    }
    var u = window.MediaiAuth && window.MediaiAuth.getUser();
    if (!u || u.role !== 'ADMIN') {
      gate.innerHTML = '<p class="text-danger">Admin access required.</p><a href="index.html" class="btn btn-primary">Back</a>';
      return;
    }
    gate.style.display = 'none';
    content.style.display = 'block';
    loadStats();
    loadUsers();
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('tab-users').style.display = btn.getAttribute('data-tab') === 'users' ? 'block' : 'none';
        document.getElementById('tab-consultations').style.display = btn.getAttribute('data-tab') === 'consultations' ? 'block' : 'none';
        if (btn.getAttribute('data-tab') === 'consultations') loadConsultations();
      });
    });
    document.getElementById('user-search').addEventListener('input', function () { loadUsers(this.value); });
  }
  function loadStats() {
    window.MediaiApi.consultations.stats().then(function (r) {
      var s = r.stats || {};
      document.getElementById('stat-low').textContent = s.LOW != null ? s.LOW : '-';
      document.getElementById('stat-medium').textContent = s.MEDIUM != null ? s.MEDIUM : '-';
      document.getElementById('stat-high').textContent = s.HIGH != null ? s.HIGH : '-';
    }).catch(function () {});
  }
  function loadUsers(search) {
    window.MediaiApi.users.listUsers(1, 50, search || '').then(function (r) {
      var tbody = document.getElementById('users-tbody');
      tbody.innerHTML = (r.items || []).map(function (u) {
        return '<tr><td>' + (u.name || '') + '</td><td>' + (u.email || '') + '</td><td>' + (u.role || '') + '</td><td>' + (u.isActive ? 'Yes' : 'No') + '</td><td>' + (u.role !== 'ADMIN' ? '<button class="btn btn-sm ' + (u.isActive ? 'btn-warning' : 'btn-success') + '" data-id="' + u.id + '" data-active="' + !u.isActive + '">' + (u.isActive ? 'Disable' : 'Enable') + '</button>' : '-') + '</td></tr>';
      }).join('');
      tbody.querySelectorAll('button[data-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var active = btn.getAttribute('data-active') === 'true';
          window.MediaiApi.users.setActive(id, active).then(function () { loadUsers(document.getElementById('user-search').value); });
        });
      });
    }).catch(function () {});
  }
  function loadConsultations() {
    window.MediaiApi.consultations.listAll(1, 50).then(function (r) {
      var tbody = document.getElementById('consultations-tbody');
      tbody.innerHTML = (r.items || []).map(function (c) {
        var user = c.user || {};
        var d = c.createdAt ? new Date(c.createdAt) : null;
        var dateStr = d ? d.toLocaleString() : '';
        return '<tr><td>' + dateStr + '</td><td>' + (user.email || user.name || '-') + '</td><td>' + String(c.symptoms || '').replace(/</g, '&lt;').slice(0, 60) + '</td><td>' + (c.riskLevel || '') + '</td></tr>';
      }).join('');
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkAccess);
  else checkAccess();
})();
