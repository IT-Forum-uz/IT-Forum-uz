/* ==========================================================================
   Admin dashboard. Gated to role === 'admin' | 'super_admin' only.
   Firestore security rules enforce the same restriction server-side, so this
   client-side check is a UX convenience, not the actual security boundary.
   ========================================================================== */

const ASSIGNABLE_ROLES = ['newbie', 'user', 'vip', 'moderator', 'admin'];
let allUsers = [];
let allTopics = [];
let currentAdminUid = null;

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* -------------------- Users tab -------------------- */
function userRowHtml(u) {
  const isSuperAdmin = u.role === 'super_admin';
  const roleOptions = ASSIGNABLE_ROLES.map(r =>
    `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`
  ).join('');

  return `
    <tr data-uid="${u.id}">
      <td>
        <div class="admin-user-cell">
          <img class="avatar avatar-sm" src="${u.photoURL || '../assets/images/default-avatar.svg'}" alt="">
          <a href="../profile.html?uid=${u.id}" target="_blank">${escapeHtml(u.displayName || '—')}</a>
        </div>
      </td>
      <td>${escapeHtml(u.email || '—')}</td>
      <td class="admin-uid">${u.id}</td>
      <td>
        ${isSuperAdmin
          ? `<span class="badge-role admin">super_admin</span>`
          : `<select class="admin-role-select" data-role-select="${u.id}">${roleOptions}</select>`}
      </td>
      <td>
        <div class="admin-rep-controls">
          <button data-rep-minus="${u.id}">−</button>
          <span data-rep-value="${u.id}">${u.reputation || 0}</span>
          <button data-rep-plus="${u.id}">+</button>
        </div>
      </td>
      <td>${u.banned ? '<span class="admin-status-banned">Забанен</span>' : '<span class="admin-status-active">Активен</span>'}</td>
      <td>
        ${isSuperAdmin ? '' : `<button class="admin-action-btn ${u.banned ? '' : 'danger'}" data-toggle-ban="${u.id}">${u.banned ? 'Разбанить' : 'Забанить'}</button>`}
      </td>
    </tr>`;
}

function renderUsersTable(users) {
  qs('#users-table-body').innerHTML = users.map(userRowHtml).join('') ||
    '<tr><td colspan="7" class="text-muted" style="text-align:center;padding:24px">Нет пользователей</td></tr>';

  qsa('[data-role-select]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const uid = sel.dataset.roleSelect;
      const newRole = sel.value;
      try {
        await DevPortData.adminSetUserRole(uid, newRole);
        const u = allUsers.find(x => x.id === uid);
        if (u) u.role = newRole;
        showToast('Роль обновлена', 'success');
        updateStats();
      } catch (e) {
        showToast('Не удалось изменить роль', 'error');
      }
    });
  });

  qsa('[data-toggle-ban]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.toggleBan;
      const u = allUsers.find(x => x.id === uid);
      const newBanned = !u.banned;
      if (newBanned && !confirm('Забанить этого пользователя? Он не сможет создавать темы, отвечать и писать сообщения.')) return;
      try {
        await DevPortData.adminSetBanned(uid, newBanned);
        u.banned = newBanned;
        renderUsersTable(filteredUsers());
        updateStats();
      } catch (e) {
        showToast('Не удалось изменить статус', 'error');
      }
    });
  });

  qsa('[data-rep-plus]').forEach(btn => {
    btn.addEventListener('click', () => adjustReputation(btn.dataset.repPlus, 10));
  });
  qsa('[data-rep-minus]').forEach(btn => {
    btn.addEventListener('click', () => adjustReputation(btn.dataset.repMinus, -10));
  });
}

async function adjustReputation(uid, delta) {
  try {
    await DevPortData.adminAdjustReputation(uid, delta);
    const u = allUsers.find(x => x.id === uid);
    if (u) {
      u.reputation = (u.reputation || 0) + delta;
      const span = qs(`[data-rep-value="${uid}"]`);
      if (span) span.textContent = u.reputation;
    }
  } catch (e) {
    showToast('Не удалось изменить репутацию', 'error');
  }
}

function filteredUsers() {
  const q = (qs('#user-search-input').value || '').toLowerCase().trim();
  if (!q) return allUsers;
  return allUsers.filter(u =>
    (u.displayName || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    u.id.toLowerCase().includes(q)
  );
}

function updateStats() {
  qs('#stat-total-users').textContent = allUsers.length;
  qs('#stat-total-topics').textContent = allTopics.length;
  qs('#stat-total-banned').textContent = allUsers.filter(u => u.banned).length;
  qs('#stat-total-staff').textContent = allUsers.filter(u => ['moderator', 'admin', 'super_admin'].includes(u.role)).length;
}

/* -------------------- Topics tab -------------------- */
function topicRowHtml(t) {
  return `
    <tr data-topic="${t.id}">
      <td><a href="../topic.html?id=${t.id}" target="_blank">${escapeHtml(t.title)}</a></td>
      <td>${escapeHtml(t.authorName || '—')}</td>
      <td>${escapeHtml(t.categoryName || '—')}</td>
      <td>${t.repliesCount || 0}</td>
      <td>${t.isPinned ? '📌 ' : ''}${t.isClosed ? '🔒 закрыта' : 'открыта'}</td>
      <td>
        <button class="admin-action-btn" data-toggle-pin="${t.id}">${t.isPinned ? 'Открепить' : 'Закрепить'}</button>
        <button class="admin-action-btn" data-toggle-close="${t.id}">${t.isClosed ? 'Открыть' : 'Закрыть'}</button>
        <button class="admin-action-btn danger" data-delete-topic="${t.id}">Удалить</button>
      </td>
    </tr>`;
}

function renderTopicsTable() {
  qs('#topics-table-body').innerHTML = allTopics.map(topicRowHtml).join('') ||
    '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:24px">Нет тем</td></tr>';

  qsa('[data-toggle-pin]').forEach(btn => btn.addEventListener('click', async () => {
    const t = allTopics.find(x => x.id === btn.dataset.togglePin);
    await DevPortData.setTopicFlag(t.id, 'isPinned', !t.isPinned);
    t.isPinned = !t.isPinned;
    renderTopicsTable();
  }));
  qsa('[data-toggle-close]').forEach(btn => btn.addEventListener('click', async () => {
    const t = allTopics.find(x => x.id === btn.dataset.toggleClose);
    await DevPortData.setTopicFlag(t.id, 'isClosed', !t.isClosed);
    t.isClosed = !t.isClosed;
    renderTopicsTable();
  }));
  qsa('[data-delete-topic]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Удалить тему безвозвратно?')) return;
    const id = btn.dataset.deleteTopic;
    await DevPortData.deleteTopic(id);
    allTopics = allTopics.filter(t => t.id !== id);
    renderTopicsTable();
    updateStats();
  }));
}

/* -------------------- Tabs / boot -------------------- */
function setupTabs() {
  qsa('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('[data-admin-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      qsa('.admin-tab-panel').forEach(p => p.classList.add('hidden'));
      qs(`#admin-tab-${btn.dataset.adminTab}`).classList.remove('hidden');
    });
  });
}

async function loadDashboard() {
  [allUsers, allTopics] = await Promise.all([
    DevPortData.adminListUsers(),
    DevPortData.adminListTopics()
  ]);
  renderUsersTable(allUsers);
  renderTopicsTable();
  updateStats();

  qs('#user-search-input').addEventListener('input', debounce(() => {
    renderUsersTable(filteredUsers());
  }, 200));
}

document.addEventListener('DOMContentLoaded', () => {
  qs('#logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await auth.signOut();
    window.location.href = '../index.html';
  });

  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = '../login.html'; return; }
    const snap = await db.collection('users').doc(user.uid).get();
    const data = snap.data() || {};
    qs('#admin-loading').classList.add('hidden');

    if (!['admin', 'super_admin'].includes(data.role)) {
      qs('#access-denied').classList.remove('hidden');
      return;
    }

    currentAdminUid = user.uid;
    qs('#admin-content').classList.remove('hidden');
    setupTabs();
    loadDashboard();
  });
});
