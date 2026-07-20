/* ==========================================================================
   Homepage: loads live data from Firestore into every section.
   ========================================================================== */

const CATEGORY_ICON_FALLBACK = '💻';

function categoryCardHtml(cat) {
  return `
    <a href="forum.html?category=${cat.id}" class="card card-hover-lift category-card">
      <div class="category-icon">${cat.icon || CATEGORY_ICON_FALLBACK}</div>
      <div class="category-info">
        <h3>${escapeHtml(cat.name)}</h3>
        <div class="text-muted" style="font-size:var(--fs-xs)">${escapeHtml(cat.description || 'Обсуждения по теме ' + cat.name)}</div>
      </div>
      <div class="category-meta">
        <span><b>${cat.topicsCount || 0}</b> тем</span>
        <span><b>${cat.postsCount || 0}</b> постов</span>
      </div>
    </a>`;
}

function topicRowHtml(topic) {
  return `
    <div class="topic-row">
      <div class="topic-main">
        <div class="topic-title-line">
          ${topic.isPinned ? '<span class="pin-icon" title="Закреплено">📌</span>' : ''}
          ${topic.isClosed ? '<span class="lock-icon" title="Закрыто">🔒</span>' : ''}
          <a href="topic.html?id=${topic.id}">${escapeHtml(topic.title)}</a>
        </div>
        <div class="topic-subline">
          <span class="tag">${escapeHtml(topic.categoryName || '')}</span>
          &nbsp;автор <b>${escapeHtml(topic.authorName || 'Пользователь')}</b> · ${timeAgo(topic.createdAt)}
        </div>
      </div>
      <div class="topic-stats">
        <div><div class="stat-num">${topic.repliesCount || 0}</div><div class="stat-label">ответов</div></div>
        <div><div class="stat-num">${topic.viewsCount || 0}</div><div class="stat-label">просм.</div></div>
      </div>
      <div class="topic-last-reply">${escapeHtml(topic.lastReplyBy || '')}<br>${timeAgo(topic.lastReplyAt)}</div>
    </div>`;
}

async function loadHeroStats() {
  try {
    const stats = await DevPortData.getForumStats();
    qs('#stat-topics').textContent = stats.topicsCount;
    qs('#stat-posts').textContent = stats.postsCount;
    qs('#stat-users').textContent = stats.usersCount;
  } catch (e) { console.warn('stats error', e); }
}

async function loadCategories() {
  const grid = qs('#categories-grid');
  grid.innerHTML = Array(6).fill('<div class="skeleton" style="height:80px"></div>').join('');
  try {
    await DevPortData.seedCategoriesIfEmpty();
    const cats = await DevPortData.getCategories();
    grid.innerHTML = cats.slice(0, 8).map(categoryCardHtml).join('') || '<div class="empty-state">Категории появятся здесь</div>';
  } catch (e) {
    grid.innerHTML = '<div class="empty-state">Не удалось загрузить категории</div>';
  }
}

async function loadTopicLists() {
  const popularEl = qs('#popular-topics-list');
  const latestEl = qs('#latest-topics-list');
  popularEl.innerHTML = latestEl.innerHTML = Array(4).fill('<div class="skeleton" style="height:60px;margin:8px"></div>').join('');
  try {
    const latest = await DevPortData.listTopics({ orderField: 'lastReplyAt', limit: 8 });
    latestEl.innerHTML = latest.items.map(topicRowHtml).join('') || '<div class="empty-state">Пока нет тем — <a href="create-topic.html" class="text-cyan">создайте первую</a></div>';

    const popular = await DevPortData.listTopics({ orderField: 'viewsCount', limit: 5 });
    popularEl.innerHTML = popular.items.map(topicRowHtml).join('') || '<div class="empty-state">Нет данных</div>';
  } catch (e) {
    latestEl.innerHTML = popularEl.innerHTML = '<div class="empty-state">Не удалось загрузить темы</div>';
  }
}

async function loadMembers() {
  try {
    const top = await DevPortData.getTopMembers(5);
    qs('#top-members').innerHTML = top.map((u, i) => `
      <div class="member-row">
        <span class="mono text-muted" style="width:16px">${i + 1}</span>
        <img class="avatar avatar-sm" src="${u.photoURL || 'assets/images/default-avatar.svg'}" alt="">
        <a href="profile.html?uid=${u.id}">${escapeHtml(u.displayName)}</a>
        <span class="rep">${u.reputation || 0} ★</span>
      </div>`).join('') || '<div class="text-muted" style="font-size:var(--fs-sm)">Пока нет данных</div>';

    const newest = await DevPortData.getNewestMembers(5);
    qs('#newest-members').innerHTML = newest.map(u => `
      <div class="member-row">
        <img class="avatar avatar-sm" src="${u.photoURL || 'assets/images/default-avatar.svg'}" alt="">
        <a href="profile.html?uid=${u.id}">${escapeHtml(u.displayName)}</a>
        <span class="rep text-muted">${formatDate(u.createdAt)}</span>
      </div>`).join('') || '<div class="text-muted" style="font-size:var(--fs-sm)">Пока нет данных</div>';
  } catch (e) { console.warn(e); }
}

function watchOnlineUsers() {
  const fiveMinAgo = firebase.firestore.Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
  db.collection('users').where('lastSeen', '>=', fiveMinAgo).limit(8)
    .onSnapshot((snap) => {
      const el = qs('#online-users');
      const feed = qs('#terminal-feed');
      const users = snap.docs.map(d => d.data());
      el.innerHTML = users.map(u => `
        <div class="online-user-row"><span class="status-dot online"></span> ${escapeHtml(u.displayName)}</div>
      `).join('') || '<div class="text-muted" style="font-size:var(--fs-sm)">Сейчас никого нет онлайн</div>';

      if (feed) {
        feed.innerHTML = `<div class="t-line"><span class="t-prompt">$</span> online --watch</div>` +
          users.slice(0, 6).map(u => `<div class="t-line"><span class="t-status">●</span> ${escapeHtml(u.displayName)} — active</div>`).join('') +
          `<div class="t-line"><span class="t-prompt">$</span> <span class="terminal-cursor">_</span></div>`;
      }
    }, () => {});
}

document.addEventListener('DOMContentLoaded', () => {
  loadHeroStats();
  loadCategories();
  loadTopicLists();
  loadMembers();
  watchOnlineUsers();
});
