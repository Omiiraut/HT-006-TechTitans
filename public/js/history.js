function loadHistory() {
  var listEl = document.getElementById('history-list');
  var footerEl = document.getElementById('history-footer');
  if (!listEl) return;
  if (!window.MediaiAuth || !window.MediaiAuth.isAuthenticated()) {
    listEl.innerHTML = '<p class="history-subtitle">Sign in to view history.</p>';
    if (footerEl) footerEl.textContent = '';
    return;
  }
  listEl.innerHTML = '<p class="history-subtitle">Loading...</p>';
  if (footerEl) footerEl.textContent = '';
  window.MediaiApi.consultations.listMine(1, 50)
    .then(function (r) {
      var items = r.items || [];
      if (items.length === 0) {
        listEl.innerHTML = '<p class="history-subtitle">No consultations yet.</p>';
        if (footerEl) footerEl.textContent = '';
        return;
      }
      listEl.innerHTML = items.map(function (x) {
        var d = x.createdAt ? new Date(x.createdAt) : null;
        var dateStr = d ? d.toLocaleDateString() : '';
        var timeStr = d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
        var risk = (x.riskLevel || 'LOW').toLowerCase();
        if (risk !== 'medium' && risk !== 'high') risk = 'mild';
        var summary = (x.aiResponse && x.aiResponse.summary) ? x.aiResponse.summary : '';
        return '<div class="history-item" data-id="' + x.id + '"><div class="history-item-content"><div class="history-date"><span class="date">' + dateStr + '</span><span class="time">' + timeStr + '</span></div><p class="history-symptom">' + String(x.symptoms || '').replace(/</g, '&lt;').slice(0, 80) + '</p><p class="history-summary">' + String(summary).replace(/</g, '&lt;').slice(0, 60) + '</p><span class="status-tag ' + risk + '">' + (x.riskLevel || 'LOW') + '</span></div><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>';
      }).join('');
      listEl.querySelectorAll('.history-item').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-id');
          if (id) try { localStorage.setItem('mediai_last_consultation_id', id); } catch (e) {}
          window.drAvaLastConsultation = null;
          if (window.navigateTo) window.navigateTo('chat');
        });
      });
      if (footerEl) footerEl.textContent = 'Showing ' + items.length + ' consultation(s)';
    })
    .catch(function () {
      listEl.innerHTML = '<p class="history-subtitle">Failed to load.</p>';
      if (footerEl) footerEl.textContent = '';
    });
}
window.loadHistory = loadHistory;
