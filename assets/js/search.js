/* ==========================================================================
   Search page: unified search across topics (by title keywords) and
   members (by name), driven by ?q= and a local input with debounce.
   ========================================================================== */

let searchTopicsResult = [];
let searchUsersResult = [];
let activeSearchTab = 'topics';

function topicResultHtml(t) {
  return `
    <div class="topic-row"><div class="topic-main">
      <div class="topic-title-line">
        ${t.isPinned ? '<span class="pin-icon">📌</span>' : ''}
        <a href="topic.html?id=${t.id}">${escapeHtml(t.title)}</a>
      </div>
      <div class="topic-subline"><span class="tag">${escapeHtml(t.categoryName || '')}</span> · автор ${escapeHtml(t.authorName || '')} · ${timeAgo(t.createdAt)}</div>
    </div>
    <div class="topic-stats">
      <div><div class="stat-num">${t.repliesCount || 0}</div><div class="stat-label">ответов</div></div>
      <div><div class="stat-num">${t.viewsCount || 0}</div><div class="stat-label">просмотров</div></div>
    </div></div>`;
}

function userResultHtml(u) {
  return `
    <div class="search-user-row">
      <img class="avatar avatar-md" src="${u.photoURL || 'assets/images/default-avatar.svg'}" alt="">
      <div class="info">
        <h4><a href="profile.html?uid=${u.id}">${escapeHtml(u.displayName || 'Без имени')}</a></h4>
        <p>${escapeHtml(u.bio || 'Пользователь пока не добавил описание')}</p>
      </div>
      <div class="text-muted mono" style="font-size:var(--fs-xs);flex-shrink:0">${u.reputation || 0} реп.</div>
    </div>`;
}

function renderTab() {
  const el = qs('#search-tab-content');
  if (activeSearchTab === 'topics') {
    el.innerHTML = searchTopicsResult.map(topicResultHtml).join('') || '<div class="empty-state">Темы не найдены</div>';
  } else {
    el.innerHTML = searchUsersResult.map(userResultHtml).join('') || '<div class="empty-state">Участники не найдены</div>';
  }
}

async function runSearch(queryText) {
  const promptEl = qs('#search-prompt');
  const wrapEl = qs('#search-results-wrap');

  if (!queryText || queryText.length < 2) {
    wrapEl.classList.add('hidden');
    promptEl.classList.remove('hidden');
    promptEl.querySelector('p:last-child').textContent = 'Введите минимум 2 символа, чтобы найти темы или участников.';
    return;
  }

  promptEl.classList.add('hidden');
  wrapEl.classList.remove('hidden');
  qs('#search-tab-content').innerHTML = Array.from({ length: 4 }).map(() => '<div class="skeleton" style="height:60px;margin:12px"></div>').join('');

  try {
    const [topics, users] = await Promise.all([
      DevPortData.searchTopics(queryText),
      DevPortData.searchUsers(queryText)
    ]);
    searchTopicsResult = topics;
    searchUsersResult = users;
    qs('#count-topics').textContent = `(${topics.length})`;
    qs('#count-users').textContent = `(${users.length})`;
    renderTab();
  } catch (err) {
    console.error(err);
    showToast('Ошибка при поиске', 'error');
    qs('#search-tab-content').innerHTML = '<div class="empty-state">Не удалось выполнить поиск. Попробуйте ещё раз.</div>';
  }
}

function setupTabs() {
  qsa('.search-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.search-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSearchTab = btn.dataset.tab;
      renderTab();
    });
  });
}

function setupInput() {
  const input = qs('#search-input');
  const initial = getParam('q') || '';
  input.value = initial;

  const debounced = debounce((val) => {
    const url = new URL(window.location);
    if (val) url.searchParams.set('q', val); else url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
    runSearch(val);
  }, 350);

  input.addEventListener('input', () => debounced(input.value.trim()));

  if (initial) runSearch(initial);
  input.focus();
}

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupInput();
});
