(function () {
  var form = document.getElementById('onboarding-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!window.MediaiApi || !window.MediaiAuth.isAuthenticated()) return;
    var payload = {
      age: document.getElementById('age') ? parseInt(document.getElementById('age').value, 10) || null : null,
      gender: document.getElementById('gender') ? document.getElementById('gender').value || null : null,
      height: document.getElementById('height') ? parseInt(document.getElementById('height').value, 10) || null : null,
      weight: document.getElementById('weight') ? parseFloat(document.getElementById('weight').value) || null : null,
      medicalHistory: document.getElementById('medicalHistory') ? document.getElementById('medicalHistory').value.trim() || null : null,
      allergies: document.getElementById('allergies') ? document.getElementById('allergies').value.trim() || null : null,
      medications: document.getElementById('medications') ? document.getElementById('medications').value.trim() || null : null,
    };
    if (window.MediaiUI) window.MediaiUI.showSpinner();
    window.MediaiApi.users.updateProfile(payload)
      .then(function (r) {
        if (window.MediaiUI) { window.MediaiUI.hideSpinner(); window.MediaiUI.success('Profile saved'); }
        if (window.navigateTo) window.navigateTo('dashboard');
      })
      .catch(function (err) {
        if (window.MediaiUI) { window.MediaiUI.hideSpinner(); window.MediaiUI.error(err.message || 'Failed to save'); }
      });
  });
})();
