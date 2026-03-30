const state = {
        page: 1,
        totalPages: 1,
        selectedUserId: null
      };

      const statsEl = document.getElementById('stats');
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

      function statCard(label, value) {
        return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`;
      }

      async function loadStats() {
        const stats = await request('/admin/stats/overview');
        statsEl.innerHTML = [
          statCard('Total Users', stats.totalUsers),
          statCard('Neu heute', stats.newUsersToday),
          statCard('Gebannt', stats.bannedUsers),
          statCard('Admins', stats.adminUsers),
          statCard('Tester', stats.testerUsers),
          statCard('Aktiv (30d)', stats.activeUsers)
        ].join('');
      }

      function userRow(user) {
        const badges = (user.badges || []).map((badge) => `<span class="badge">${badge}</span>`).join('');
        const bannedLabel = user.isBanned ? '<span class="badge" style="border-color:#ef4444;color:#991b1b;">BANNED</span>' : '<span class="badge">Aktiv</span>';
        return `
          <tr>
            <td>
              <div><strong>${user.displayName || '-'}</strong></div>
              <div class="small">${user.email}</div>
              <div class="small">${user.id}</div>
            </td>
            <td>${user.role}</td>
            <td>${bannedLabel}</td>
            <td>${badges || '<span class="small">Keine</span>'}</td>
            <td>
              <div class="actions">
                <button data-action="open" data-id="${user.id}">Details</button>
                <button data-action="ban-toggle" data-id="${user.id}" data-banned="${user.isBanned}">
                  ${user.isBanned ? 'Entsperren' : 'Sperren'}
                </button>
                <button data-action="badge-add" data-id="${user.id}">Badge +</button>
                <button data-action="badge-remove" data-id="${user.id}">Badge -</button>
                <button data-action="role" data-id="${user.id}">Rolle</button>
              </div>
            </td>
          </tr>
        `;
      }

      function readFilters() {
        return {
          search: document.getElementById('search').value.trim(),
          role: document.getElementById('role-filter').value,
          banned: document.getElementById('banned-filter').value,
          limit: document.getElementById('limit-filter').value
        };
      }

      async function loadUsers() {
        const filters = readFilters();
        const params = new URLSearchParams({ page: String(state.page), limit: filters.limit });
        if (filters.search) params.set('search', filters.search);
        if (filters.role) params.set('role', filters.role);
        if (filters.banned) params.set('banned', filters.banned);

        const payload = await request(`/admin/users?${params.toString()}`);
        const users = payload.data || [];

        usersBodyEl.innerHTML = users.map(userRow).join('') || '<tr><td colspan="5" class="small">Keine User gefunden.</td></tr>';

        state.totalPages = payload.meta?.totalPages || 1;
        paginationInfoEl.textContent = `Seite ${payload.meta?.page || 1} / ${state.totalPages} | Total: ${payload.meta?.total || 0}`;
      }

      function renderDetails(user) {
        const badges = (user.badges || []).map((badge) => `<span class="badge">${badge}</span>`).join('') || '<span class="small">Keine</span>';
        detailsEl.innerHTML = `
          <div><strong>${user.displayName || '-'}</strong> (${user.role})</div>
          <div class="small">${user.email}</div>
          <div class="small">ID: ${user.id}</div>
          <div class="small">Created: ${new Date(user.createdAt).toLocaleString()}</div>
          <div class="small">Last Login: ${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '-'}</div>
          <div style="margin:8px 0;">${badges}</div>
          <label class="small" for="notes">Admin Notes</label>
          <textarea id="notes" rows="5">${user.adminNotes || ''}</textarea>
          <div class="actions" style="margin-top:8px;">
            <button class="primary" id="save-notes-btn">Notes speichern</button>
          </div>
        `;

        const saveNotesButton = document.getElementById('save-notes-btn');
        saveNotesButton?.addEventListener('click', async () => {
          try {
            const adminNotes = document.getElementById('notes').value;
            await request(`/admin/users/${user.id}/notes`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adminNotes })
            });
            await refreshAll();
          } catch (error) {
            setError(error.message);
          }
        });
      }

      async function loadUserDetails(userId) {
        const payload = await request(`/admin/users/${userId}`);
        state.selectedUserId = userId;
        renderDetails(payload.user);
      }

      async function loadAudit() {
        const payload = await request('/admin/audit-logs?limit=50');
        auditListEl.innerHTML = (payload.data || [])
          .map((entry) => {
            const actor = entry.actor?.email || 'unknown';
            const target = entry.target?.email || 'unknown';
            return `
              <li>
                <div><strong>${entry.action}</strong></div>
                <div class="small">${actor} -> ${target}</div>
                <div class="small">${new Date(entry.createdAt).toLocaleString()}</div>
              </li>
            `;
          })
          .join('') || '<li class="small">Keine Logs.</li>';
      }

      async function refreshAll() {
        setError('');
        await Promise.all([loadStats(), loadUsers(), loadAudit()]);
        if (state.selectedUserId) {
          await loadUserDetails(state.selectedUserId);
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
            return;
          }

          if (action === 'badge-add' || action === 'badge-remove') {
            const badge = window.prompt('Badge Name');
            if (!badge) return;
            await request(`/admin/users/${userId}/badges`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: action === 'badge-add' ? 'add' : 'remove',
                badge
              })
            });
            await refreshAll();
            return;
          }

          if (action === 'role') {
            const role = window.prompt('Neue Rolle: user | tester | moderator | admin');
            if (!role) return;
            await request(`/admin/users/${userId}/role`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: role.trim() })
            });
            await refreshAll();
          }
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
