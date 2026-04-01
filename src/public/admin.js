const ROLE_OPTIONS = ['user', 'tester', 'moderator', 'admin'];
const ROLE_LABELS = {
  user: 'User',
  tester: 'Tester',
  moderator: 'Moderator',
  admin: 'Admin'
};
const ACTION_LABELS = {
  'user.role.updated': 'Rolle geändert',
  'user.banned': 'User gebannt',
  'user.unbanned': 'User entbannt',
  'user.badge.added': 'Badge hinzugefügt',
  'user.badge.removed': 'Badge entfernt',
  'user.notes.updated': 'Admin-Notiz geändert'
};

const state = {
  page: 1,
  totalPages: 1,
  selectedUserId: null,
  selectedUser: null
};

const statsEl = document.getElementById('stats');
const statsNoteEl = document.getElementById('stats-note');
const usersBodyEl = document.getElementById('users-body');
const detailsEl = document.getElementById('details');
const auditListEl = document.getElementById('audit-list');
const errorEl = document.getElementById('error');
const paginationInfoEl = document.getElementById('pagination-info');

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
}

function setError(message) {
  errorEl.textContent = message || '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return entities[char] || char;
  });
}

function formatRole(role) {
  return ROLE_LABELS[role] || ROLE_LABELS.user;
}

function formatDateTime(value, fallback = 'Nie') {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function statCard(label, value) {
  return `<div class="stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function renderBadges(badges, emptyLabel = 'Keine') {
  const entries = Array.isArray(badges) ? badges : [];
  if (!entries.length) return `<span class="small">${escapeHtml(emptyLabel)}</span>`;

  return entries.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join('');
}

function renderStatus(isBanned) {
  const label = isBanned ? 'Gebannt' : 'Aktiv';
  const className = isBanned ? 'status-badge status-banned' : 'status-badge status-active';
  return `<span class="${className}">${label}</span>`;
}

function describeAuditMetadata(entry) {
  const metadata = entry.metadata || {};

  switch (entry.action) {
    case 'user.role.updated':
      return `Von ${formatRole(metadata.from)} zu ${formatRole(metadata.to)}`;
    case 'user.banned':
      return 'Account wurde gesperrt';
    case 'user.unbanned':
      return 'Account wurde entsperrt';
    case 'user.badge.added':
      return metadata.badge ? `Badge: ${metadata.badge}` : 'Badge wurde hinzugefügt';
    case 'user.badge.removed':
      return metadata.badge ? `Badge: ${metadata.badge}` : 'Badge wurde entfernt';
    case 'user.notes.updated':
      return `Notizlänge ${metadata.previousLength ?? 0} -> ${metadata.nextLength ?? 0}`;
    default:
      return Object.keys(metadata).length ? JSON.stringify(metadata) : 'Keine Zusatzdaten';
  }
}

function renderAuditItems(entries, emptyLabel) {
  if (!entries.length) {
    return `<li class="small">${escapeHtml(emptyLabel)}</li>`;
  }

  return entries
    .map((entry) => {
      const actor = entry.actor?.displayName || entry.actor?.email || 'Unbekannt';
      const target = entry.target?.displayName || entry.target?.email || 'Unbekannt';

      return `
        <li>
          <div class="audit-title">${escapeHtml(ACTION_LABELS[entry.action] || entry.action)}</div>
          <div class="small">${escapeHtml(actor)} -> ${escapeHtml(target)}</div>
          <div class="small">${escapeHtml(describeAuditMetadata(entry))}</div>
          <div class="small">${escapeHtml(formatDateTime(entry.createdAt, '-'))}</div>
        </li>
      `;
    })
    .join('');
}

function readFilters() {
  return {
    search: document.getElementById('search').value.trim(),
    role: document.getElementById('role-filter').value,
    banned: document.getElementById('banned-filter').value,
    badge: document.getElementById('badge-filter').value.trim(),
    sortBy: document.getElementById('sort-by').value,
    sortOrder: document.getElementById('sort-order').value,
    limit: document.getElementById('limit-filter').value
  };
}

async function loadStats() {
  const stats = await request('/admin/stats/overview');
  statsEl.innerHTML = [
    statCard('Gesamtuser', stats.totalUsers),
    statCard('Neue User heute', stats.newUsersToday),
    statCard('Gebannte User', stats.bannedUsers),
    statCard('Admins', stats.adminUsers),
    statCard('Tester', stats.testerUsers),
    statCard(`Aktive User (${stats.activeUsersDefinitionDays}d)`, stats.activeUsers)
  ].join('');

  statsNoteEl.textContent = `Aktive User basieren aktuell auf lastLoginAt in den letzten ${stats.activeUsersDefinitionDays} Tagen.`;
}

function userRow(user) {
  return `
    <tr>
      <td>
        <div class="user-cell">
          <strong>${escapeHtml(user.displayName || '-')}</strong>
          <div class="small">${escapeHtml(user.email)}</div>
          <div class="small">${escapeHtml(user.id)}</div>
        </div>
      </td>
      <td>${escapeHtml(formatRole(user.role))}</td>
      <td>${renderStatus(user.isBanned)}</td>
      <td>${escapeHtml(formatDateTime(user.createdAt, '-'))}</td>
      <td>${escapeHtml(formatDateTime(user.lastLoginAt, 'Nie'))}</td>
      <td>${renderBadges(user.badges)}</td>
      <td>
        <div class="actions">
          <button data-action="open" data-id="${user.id}">Öffnen</button>
          <button data-action="ban-toggle" data-id="${user.id}" data-banned="${user.isBanned}">
            ${user.isBanned ? 'Entbannen' : 'Bannen'}
          </button>
        </div>
      </td>
    </tr>
  `;
}

async function loadUsers() {
  const filters = readFilters();
  const params = new URLSearchParams({
    page: String(state.page),
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  });

  if (filters.search) params.set('search', filters.search);
  if (filters.role) params.set('role', filters.role);
  if (filters.banned) params.set('banned', filters.banned);
  if (filters.badge) params.set('badge', filters.badge);

  const payload = await request(`/admin/users?${params.toString()}`);
  const users = payload.data || [];

  usersBodyEl.innerHTML =
    users.map(userRow).join('') ||
    '<tr><td colspan="7" class="small">Keine User gefunden.</td></tr>';

  state.totalPages = payload.meta?.totalPages || 1;
  paginationInfoEl.textContent = `Seite ${payload.meta?.page || 1} / ${state.totalPages} | Total: ${payload.meta?.total || 0}`;
}

function renderRoleOptions(selectedRole) {
  return ROLE_OPTIONS.map(
    (role) =>
      `<option value="${role}"${role === selectedRole ? ' selected' : ''}>${escapeHtml(formatRole(role))}</option>`
  ).join('');
}

function renderDetails(user, recentAuditLogs) {
  state.selectedUser = user;

  detailsEl.innerHTML = `
    <div class="detail-shell">
      <div class="detail-header">
        <div>
          <h2>${escapeHtml(user.displayName || '-')}</h2>
          <div class="small">${escapeHtml(user.email)}</div>
          <div class="small">ID: ${escapeHtml(user.id)}</div>
        </div>
        <div>${renderStatus(user.isBanned)}</div>
      </div>

      <div class="detail-grid">
        <section class="detail-section">
          <h3>Stammdaten</h3>
          <div class="detail-list">
            <div class="detail-row"><span class="label">Rolle</span><span>${escapeHtml(formatRole(user.role))}</span></div>
            <div class="detail-row"><span class="label">Registriert</span><span>${escapeHtml(formatDateTime(user.createdAt, '-'))}</span></div>
            <div class="detail-row"><span class="label">Letzter Login</span><span>${escapeHtml(formatDateTime(user.lastLoginAt, 'Nie'))}</span></div>
            <div class="detail-row"><span class="label">Badges</span><span>${renderBadges(user.badges)}</span></div>
          </div>
        </section>

        <section class="detail-section">
          <h3>Moderation</h3>
          <div class="stack">
            <label class="small" for="detail-role">Rolle</label>
            <div class="actions">
              <select id="detail-role">${renderRoleOptions(user.role)}</select>
              <button class="primary" data-action="save-role">Rolle speichern</button>
            </div>
          </div>
          <div class="stack">
            <label class="small" for="detail-badge-input">Badge</label>
            <div class="actions">
              <input id="detail-badge-input" placeholder="z. B. founder" />
              <button data-action="add-badge">Badge hinzufügen</button>
              <button data-action="remove-badge">Badge entfernen</button>
            </div>
          </div>
          <div class="actions">
            <button class="${user.isBanned ? '' : 'danger'}" data-action="toggle-ban">
              ${user.isBanned ? 'User entbannen' : 'User bannen'}
            </button>
          </div>
        </section>
      </div>

      <section class="detail-section">
        <h3>Admin-Notizen</h3>
        <textarea id="notes" rows="6" placeholder="Interne Hinweise für das Admin-Team">${escapeHtml(user.adminNotes || '')}</textarea>
        <div class="actions top-gap">
          <button class="primary" data-action="save-notes">Notiz speichern</button>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-header compact">
          <h3>Letzte Admin-Aktionen</h3>
          <button data-action="refresh-user">Neu laden</button>
        </div>
        <ul class="audit-list">${renderAuditItems(recentAuditLogs, 'Keine userbezogenen Audit-Einträge.')}</ul>
      </section>
    </div>
  `;
}

async function loadUserDetails(userId) {
  const payload = await request(`/admin/users/${userId}`);
  state.selectedUserId = userId;
  renderDetails(payload.user, payload.recentAuditLogs || []);
}

async function loadAudit() {
  const payload = await request('/admin/audit-logs?limit=50');
  auditListEl.innerHTML = renderAuditItems(payload.data || [], 'Keine Logs.');
}

async function refreshAll() {
  setError('');
  await Promise.all([loadStats(), loadUsers(), loadAudit()]);
  if (state.selectedUserId) {
    await loadUserDetails(state.selectedUserId);
  }
}

async function applyDetailAction(action) {
  const userId = state.selectedUserId;
  if (!userId || !state.selectedUser) return;

  if (action === 'refresh-user') {
    await loadUserDetails(userId);
    return;
  }

  if (action === 'save-role') {
    const role = document.getElementById('detail-role').value;
    await request(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    await refreshAll();
    return;
  }

  if (action === 'toggle-ban') {
    await request(`/admin/users/${userId}/ban`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBanned: !state.selectedUser.isBanned })
    });
    await refreshAll();
    return;
  }

  if (action === 'save-notes') {
    const adminNotes = document.getElementById('notes').value;
    await request(`/admin/users/${userId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes })
    });
    await refreshAll();
    return;
  }

  if (action === 'add-badge' || action === 'remove-badge') {
    const badge = document.getElementById('detail-badge-input').value.trim();
    if (!badge) {
      throw new Error('Bitte einen Badge-Namen eingeben');
    }

    await request(`/admin/users/${userId}/badges`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action === 'add-badge' ? 'add' : 'remove',
        badge
      })
    });
    await refreshAll();
  }
}

usersBodyEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const userId = button.dataset.id;

  try {
    if (action === 'open') {
      await loadUserDetails(userId);
      return;
    }

    if (action === 'ban-toggle') {
      const isBanned = button.dataset.banned !== 'true';
      await request(`/admin/users/${userId}/ban`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBanned })
      });
      await refreshAll();
    }
  } catch (error) {
    setError(error.message);
  }
});

detailsEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  try {
    await applyDetailAction(button.dataset.action);
  } catch (error) {
    setError(error.message);
  }
});

document.getElementById('filter-btn').addEventListener('click', async () => {
  state.page = 1;
  try {
    await loadUsers();
  } catch (error) {
    setError(error.message);
  }
});

document.getElementById('search').addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter') return;
  state.page = 1;

  try {
    await loadUsers();
  } catch (error) {
    setError(error.message);
  }
});

document.getElementById('prev-page').addEventListener('click', async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  try {
    await loadUsers();
  } catch (error) {
    setError(error.message);
  }
});

document.getElementById('next-page').addEventListener('click', async () => {
  if (state.page >= state.totalPages) return;
  state.page += 1;
  try {
    await loadUsers();
  } catch (error) {
    setError(error.message);
  }
});

document.getElementById('refresh-btn').addEventListener('click', async () => {
  try {
    await refreshAll();
  } catch (error) {
    setError(error.message);
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await request('/admin/logout', { method: 'POST' });
  } catch {}

  window.location.href = '/admin/login';
});

refreshAll().catch((error) => {
  setError(error.message);
});
