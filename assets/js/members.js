/* ==========================================================================
   Members directory page: sortable/paginated list backed by Firestore,
   plus live name search (switches into search mode while a query is typed).
   ========================================================================== */

let currentSortField = 'reputation';
let currentSortDir = 'desc';
let lastDoc = null;
let isSearchMode = false;
let loading = false;

function roleBadgeHtml(role) {
  if (role === 'admin' || role === 'super_admin') return '<span class="badge-role admin">Admin</span>';
  if (role === 'moderator') return '<span class="badge-role moderator">Мод</span>';
  if (role === 'vip') return '<span class="badge-role vip">VIP</span>';
  if (role === 'newbie') return '<span class="badge-role newbie">Новичок</span>';
  return '';
}

function isOnline(lastSeen) {
  if (!lastSeen) return false;
  const d = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  return (Date.now() - d.getTime()) < 5 * 60 * 1000;
}

function memberCardHtml(u) {
  return `
    <div class="card member-card">
      <span class="status-dot ${isOnline(u.lastSeen) ? 'online' : 'offline'}" title="${isOnline(u.lastSeen) ? 'В сети' : 'Не в сети'}"></span>
      <a href="profile.html?uid=${u.id}">
        <img class="avatar avatar-lg" src="${u.photoURL || 'assets/images/default-avatar.svg'}" alt="">
        <h4>${escapeHtml(u.displayName || 'Без имени')} ${roleBadgeHtml(u.role)}</h4>
      </a>
      <p class="bio-snippet">${escapeHtml(u.bio || '')}</p>
      <div class="member-skills">${(u.skills || []).slice(0, 3).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
      <div class="member-stats">
        <div><b>${u.topicsCount || 0}</b><span>тем</span></div>
        <div><b>${u.postsCount || 0}</b><span>постов</span></div>
        <div><b>${u.reputation || 0}</b><span>реп.</span></div>
        <div><b>${(u.followers || []).length}</b><span>подп.</span></div>
      </div>
    </div>`;
}

function renderMembers(items, append) {
  const grid = qs('#members-grid');
  const html = items.map(memberCardHtml).join('');
  grid.innerHTML = append ? grid.innerHTML + html : html;
  qs('#members-empty').classList.toggle('hidden', grid.children.length > 0);
}

async function loadMembers({ append = false } = {}) {
  if (loading) return;
  loading = true;
  const loadMoreBtn = qs('#load-more-btn');
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = 'Загрузка...';

  if (!append) {
    qs('#members-grid').innerHTML = Array.from({ length: 8 }).map(() => '<div class="skeleton" style="height:220px"></div>').join('');
    lastDoc = null;
  }

  try {
    const { docs, items } = await DevPortData.listMembers({
      orderField: currentSortField, direction: currentSortDir, limit: 24,
      startAfterDoc: append ? lastDoc : null
    });
    lastDoc = docs[docs.length - 1] || null;
    renderMembers(items, append);
    loadMoreBtn.classList.toggle('hidden', docs.length < 24);
  } catch (err) {
    console.error(err);
    showToast('Не удалось загрузить участников', 'error');
    if (!append) qs('#members-grid').innerHTML = '';
    qs('#members-empty').classList.remove('hidden');
  } finally {
    loading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Показать ещё';
  }
}

async function runMemberSearch(queryText) {
  isSearchMode = true;
  qs('#load-more-btn').classList.add('hidden');
  qs('#members-grid').innerHTML = Array.from({ length: 6 }).map(() => '<div class="skeleton" style="height:220px"></div>').join('');
  try {
    const items = await DevPortData.searchUsers(queryText);
    renderMembers(items, false);
    qs('#members-count').textContent = `forum / участники / результаты по «${queryText}» (${items.length})`;
  } catch (err) {
    console.error(err);
    showToast('Ошибка поиска участников', 'error');
    qs('#members-grid').innerHTML = '';
    qs('#members-empty').classList.remove('hidden');
  }
}

function setupSearch() {
  const input = qs('#members-search-input');
  const debounced = debounce((val) => {
    if (val) {
      runMemberSearch(val);
    } else {
      isSearchMode = false;
      qs('#members-count').textContent = 'forum / участники';
      loadMembers();
    }
  }, 350);
  input.addEventListener('input', () => debounced(input.value.trim()));
}

function setupSort() {
  qsa('#members-sort .filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('#members-sort .filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSortField = btn.dataset.sort;
      currentSortDir = btn.dataset.dir || 'desc';
      qs('#members-search-input').value = '';
      isSearchMode = false;
      qs('#members-count').textContent = 'forum / участники';
      loadMembers();
    });
  });
}

function setupLoadMore() {
  qs('#load-more-btn').addEventListener('click', () => {
    if (!isSearchMode) loadMembers({ append: true });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupSearch();
  setupSort();
  setupLoadMore();
  loadMembers();
});
