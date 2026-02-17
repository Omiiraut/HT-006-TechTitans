function submitSymptom() {
  var input = document.getElementById('symptom-input');
  var text = input && input.value && input.value.trim();
  if (!text) {
    if (window.MediaiUI) window.MediaiUI.error('Please describe your symptoms');
    return;
  }
  if (!window.MediaiAuth || !window.MediaiAuth.isAuthenticated()) {
    if (window.navigateTo) window.navigateTo('login');
    return;
  }
  var btn = document.getElementById('submit-symptom');
  if (btn) btn.disabled = true;
  if (window.MediaiUI) window.MediaiUI.showSpinner();
  var container = document.getElementById('chat-messages');
  if (container) container.innerHTML = '';
  addChatMessage(text, 'user');
  if (input) input.value = '';
  window.MediaiApi.consultations.create(text)
    .then(function (r) {
      if (window.MediaiUI) window.MediaiUI.hideSpinner();
      try { localStorage.setItem('mediai_last_consultation_id', r.consultation.id); } catch (e) {}
      window.drAvaLastConsultation = { id: r.consultation.id, symptomsText: text, summary: r.consultation.aiResponse && r.consultation.aiResponse.summary, aiResponse: r.consultation.aiResponse };
      if (window.navigateTo) window.navigateTo('chat');
      if (typeof window.renderChatConsultation === 'function') window.renderChatConsultation(window.drAvaLastConsultation);
    })
    .catch(function (err) {
      if (window.MediaiUI) { window.MediaiUI.hideSpinner(); window.MediaiUI.error(err.message || 'Request failed'); }
      if (window.navigateTo) window.navigateTo('chat');
      if (typeof window.renderChatConsultation === 'function') window.renderChatConsultation({ summary: 'Unable to load analysis.', aiResponse: {} });
    })
    .finally(function () { if (btn) btn.disabled = false; });
}
function quickSymptom(s) {
  var input = document.getElementById('symptom-input');
  if (input) input.value = (input.value ? input.value + ', ' : '') + s;
}
function addChatMessage(text, role) {
  var c = document.getElementById('chat-messages');
  if (!c) return;
  var d = document.createElement('div');
  d.className = 'message ' + role;
  var p = document.createElement('p');
  p.textContent = text;
  d.appendChild(p);
  c.appendChild(d);
}
function initThemeToggle() {
  var toggle = document.getElementById('theme-toggle');
  var iconSun = toggle && toggle.querySelector('.icon-sun');
  var iconMoon = toggle && toggle.querySelector('.icon-moon');
  var saved = localStorage.getItem('drAvaTheme') || 'light';
  document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : '');
  if (iconSun) iconSun.style.display = saved === 'dark' ? 'none' : 'block';
  if (iconMoon) iconMoon.style.display = saved === 'dark' ? 'block' : 'none';
  if (toggle) toggle.addEventListener('click', function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next === 'dark' ? 'dark' : '');
    if (iconSun) iconSun.style.display = next === 'dark' ? 'none' : 'block';
    if (iconMoon) iconMoon.style.display = next === 'dark' ? 'block' : 'none';
    try { localStorage.setItem('drAvaTheme', next); } catch (e) {}
  });
}
window.submitSymptom = submitSymptom;
window.quickSymptom = quickSymptom;
window.addChatMessage = addChatMessage;
window.initThemeToggle = initThemeToggle;
