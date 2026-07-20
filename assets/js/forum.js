/* ==========================================================================
   Forum listing page: category filter, sort chips, pagination.
   ========================================================================== */

let currentCategory = null;
let currentSort = 'lastReplyAt';
let pageDocs = [null]; // pageDocs[i] = last doc before page i (cursor stack)
let currentPage = 0;
const PAGE_SIZE = 15;

function topicRowHtmlLocal(topic) {
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

async function loadCategorySidebar() {
  const cats = await DevPortData.getCategories();
  const list = qs('#category-side-list');
  const activeId = getParam('category');
  list.innerHTML = `<a href="forum.html" class="${!activeId ? 'active' : ''}">Все темы</a>` +
    cats.map(c => `<a href="forum.html?category=${c.id}" class="${activeId === c.id ? 'active' : ''}">${c.icon || ''} ${escapeHtml(c.name)} <span class="count">${c.topicsCount || 0}</span></a>`).join('');

  if (activeId) {
    const cat = cats.find(c => c.id === activeId);
    if (cat) {
      qs('#forum-title').textContent = cat.name;
      qs('#forum-breadcrumb').textContent = `forum / ${cat.slug}`;
    }
  }
}

async function loadTopicsPage(reset = false) {
  if (reset) { currentPage = 0; pageDocs = [null]; }
  const list = qs('#topics-list');
  list.innerHTML = Array(6).fill('<div class="skeleton" style="height:70px;margin:10px"></div>').join('');

  const { docs, items } = await DevPortData.listTopics({
    categoryId: currentCategory, orderField: currentSort, limit: PAGE_SIZE,
    startAfterDoc: pageDocs[currentPage]
  });

  list.innerHTML = items.map(topicRowHtmlLocal).join('') || '<div class="empty-state">Тем пока нет. <a href="create-topic.html" class="text-cyan">Создать первую →</a></div>';

  if (docs.length) pageDocs[currentPage + 1] = docs[docs.length - 1];
  renderPagination(items.length < PAGE_SIZE);
}

function renderPagination(isLastPage) {
  const el = qs('#pagination');
  let html = '';
  for (let i = 0; i <= currentPage; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i + 1}</button>`;
  }
  if (!isLastPage) html += `<button data-page="next">→</button>`;
  el.innerHTML = html;
  qsa('button', el).forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.page === 'next') { currentPage++; }
    else { currentPage = parseInt(btn.dataset.page); }
    loadTopicsPage(false);
  }));
}

document.addEventListener('DOMContentLoaded', () => {
  currentCategory = getParam('category');
  loadCategorySidebar();
  loadTopicsPage(true);

  qsa('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      qsa('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentSort = chip.dataset.sort;
      loadTopicsPage(true);
    });
  });
});
