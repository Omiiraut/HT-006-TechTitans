function toggleCollapsible(btn) {
  var item = btn.closest('.cause-item');
  if (item) item.classList.toggle('expanded');
}
function showEmergencyModal() {
  var m = document.getElementById('emergency-modal');
  if (m) m.classList.add('active');
}
function hideEmergencyModal() {
  var m = document.getElementById('emergency-modal');
  if (m) m.classList.remove('active');
}
function renderChatConsultation(consultation) {
  if (!consultation) return;
  var data = consultation.aiResponse || {};
  var summaryEl = document.getElementById('ai-summary-text');
  var causesEl = document.getElementById('ai-causes-list');
  var redFlagsEl = document.getElementById('ai-red-flags-list');
  var nextStepsEl = document.getElementById('ai-next-steps-list');
  var aiBlock = document.getElementById('ai-response');
  if (!aiBlock) return;
  if (summaryEl) summaryEl.textContent = data.summary || consultation.summary || 'Assessment recorded.';
  var causes = data.possible_causes || [];
  if (causesEl) {
    causesEl.innerHTML = causes.length ? causes.map(function (c) {
      var t = typeof c === 'string' ? c : (c.title || c);
      return '<div class="cause-item"><button class="collapsible-trigger" onclick="toggleCollapsible(this)"><div class="cause-header"><span class="cause-title">' + String(t).replace(/</g, '&lt;') + '</span></div><svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="collapsible-content"><p>' + (typeof c === 'object' && c.description ? String(c.description).replace(/</g, '&lt;') : '') + '</p></div></div>';
    }).join('') : '<p class="summary-text">None listed.</p>';
  }
  var flags = data.red_flags || [];
  if (redFlagsEl) redFlagsEl.innerHTML = flags.map(function (f) { return '<li>' + String(f).replace(/</g, '&lt;') + '</li>'; }).join('') || '<li>None</li>';
  var steps = data.recommendations || [];
  if (nextStepsEl) nextStepsEl.innerHTML = steps.map(function (s) { return '<li>' + String(s).replace(/</g, '&lt;') + '</li>'; }).join('') || '<li>Consult a healthcare provider.</li>';
  var chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    var summary = data.summary || consultation.summary || 'Assessment recorded.';
    var existing = chatMessages.querySelectorAll('.message.assistant');
    existing.forEach(function (m) { m.remove(); });
    var div = document.createElement('div');
    div.className = 'message assistant';
    var p = document.createElement('p');
    p.textContent = summary;
    div.appendChild(p);
    chatMessages.appendChild(div);
  }
  aiBlock.style.display = 'block';
}
function onChatScreenShow() {
  if (window.drAvaLastConsultation) {
    renderChatConsultation(window.drAvaLastConsultation);
    window.drAvaLastConsultation = null;
    return;
  }
  var id;
  try { id = localStorage.getItem('mediai_last_consultation_id'); } catch (e) {}
  if (id && window.MediaiApi) {
    window.MediaiApi.consultations.get(id).then(function (r) {
      renderChatConsultation({ id: r.consultation.id, symptomsText: r.consultation.symptoms, summary: r.consultation.aiResponse && r.consultation.aiResponse.summary, aiResponse: r.consultation.aiResponse });
    }).catch(function () {});
  }
}
window.toggleCollapsible = toggleCollapsible;
window.showEmergencyModal = showEmergencyModal;
window.hideEmergencyModal = hideEmergencyModal;
window.renderChatConsultation = renderChatConsultation;
window.onChatScreenShow = onChatScreenShow;
