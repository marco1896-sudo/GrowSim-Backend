const form = document.getElementById('login-form');
const tokenInput = document.getElementById('token');
const errorBox = document.getElementById('error');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';

  const token = tokenInput.value.trim();
  if (!token) {
    errorBox.textContent = 'Token fehlt.';
    return;
  }

  try {
    const response = await fetch('/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Session konnte nicht erstellt werden.');
    }

    window.location.href = '/admin';
  } catch (error) {
    errorBox.textContent = error?.message || 'Unbekannter Fehler';
  }
});
