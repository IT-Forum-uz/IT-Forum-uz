/* ==========================================================================
   Topic thread page.
   ========================================================================== */

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'idea', emoji: '💡', label: 'Idea' },
  { key: 'rocket', emoji: '🚀', label: 'Rocket' },
  { key: 'laugh', emoji: '😄', label: 'Laugh' },
  { key: 'dislike', emoji: '👎', label: 'Dislike' }
];

let topicId = null;
let topicData = null;
let currentUserData = null;
let editorInstance = null;
let quotedPost = null;

function roleBadgeHtml(role) {
  if (role === 'admin' || role === 'super_admin') return '<span class="badge-role admin">Admin</span>';
  if (role === 'moderator') return '<span class="badge-role moderator">Мод</span>';
  if (role === 'vip') return '<span class="badge-role vip">VIP</span>';
  if (role === 'newbie') return '<span class="badge-role newbie">Новичок</span>';
  return '';
}

function postCardHtml(post, index) {
  const reactionsHtml = REACTIONS.map(r => {
    const arr = (post.reactions && post.reactions[r.key]) || [];
    const mine = auth.currentUser && arr.includes(auth.currentUser.uid);
    return `<button class="reaction-btn ${mine ? 'active' : ''}" data-reaction="${r.key}" data-post="${post.id}" title="${r.label}">${r.emoji} <span class="count">${arr.length || ''}</span></button>`;
  }).join('');

  const isOwner = auth.currentUser && post.authorId === auth.currentUser.uid;
  const isStaff = currentUserData && ['moderator', 'admin', 'super_admin'].includes(currentUserData.role);

  return `
    <div class="post-card" id="post-${post.id}" data-post-id="${post.id}">
      <div class="post-author-col">
        <img class="avatar avatar-md" src="${post.authorPhoto || 'assets/images/default-avatar.svg'}" alt="">
        <a class="name" href="profile.html?uid=${post.authorId}">${escapeHtml(post.authorName)}</a>
        <div class="role">${roleBadgeHtml(post.authorRole)}</div>
      </div>
      <div class="post-body">
        <div class="post-meta">
          <span class="commit-hash">#${post.id.slice(0, 7)}</span>
          <span>${post.isFirstPost ? 'Автор темы' : `Ответ #${index}`}</span>
          <span>·</span>
          <span>${timeAgo(post.createdAt)}</span>
          ${post.isEdited ? '<span>· изменено</span>' : ''}
        </div>
        ${post.quotedPostId ? `<div class="post-quote-ref">↪ в ответ на #${post.quotedPostId.slice(0, 7)}</div>` : ''}
        <div class="post-content" data-raw="1"></div>
        <div class="reaction-bar">${reactionsHtml}</div>
        <div class="post-actions">
          <button data-quote="${post.id}">↩ Цитировать</button>
          ${isOwner ? `<button data-edit="${post.id}">✎ Редактировать</button>` : ''}
          ${(isOwner || isStaff) ? `<button data-delete="${post.id}">🗑 Удалить</button>` : ''}
        </div>
      </div>
    </div>`;
}

async function loadTopic() {
  topicId = getParam('id');
  if (!topicId) { window.location.href = 'forum.html'; return; }

  topicData = await DevPortData.getTopic(topicId);
  if (!topicData) {
    qs('#posts-container').innerHTML = '<div class="empty-state">Тема не найдена</div>';
    return;
  }

  document.title = `${topicData.title} — DevPort`;
  qs('#page-title').textContent = `${topicData.title} — DevPort`;
  qs('#topic-title').textContent = topicData.title;
  qs('#topic-breadcrumb').innerHTML = `forum / <a href="forum.html?category=${topicData.categoryId}" class="text-cyan">${escapeHtml(topicData.categoryName)}</a>`;
  qs('#topic-tags').innerHTML = (topicData.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
  qs('#topic-meta').textContent = `Автор ${topicData.authorName} · создано ${formatDate(topicData.createdAt)} · ${topicData.viewsCount || 0} просмотров`;

  if (topicData.isPinned) qs('#topic-title').insertAdjacentHTML('afterbegin', '📌 ');
  if (topicData.isClosed) qs('#reply-box').classList.add('hidden');

  // Count a view once per browser session
  const viewedKey = `viewed_${topicId}`;
  if (!sessionStorage.getItem(viewedKey)) {
    DevPortData.incrementViews(topicId);
    sessionStorage.setItem(viewedKey, '1');
  }

  setupToolbarPermissions();
  setupBookmarkButton();
  listenPosts();
}

function setupToolbarPermissions() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    const snap = await db.collection('users').doc(user.uid).get();
    currentUserData = snap.data();
    const isStaff = currentUserData && ['moderator', 'admin', 'super_admin'].includes(currentUserData.role);
    const isOwner = topicData.authorId === user.uid;
    if (isStaff || isOwner) {
      qs('#pin-btn').classList.toggle('hidden', !isStaff);
      qs('#close-btn').classList.remove('hidden');
      qs('#delete-topic-btn').classList.remove('hidden');
    }
    qs('#pin-btn').textContent = topicData.isPinned ? '📌 Открепить' : '📌 Закрепить';
    qs('#close-btn').textContent = topicData.isClosed ? '🔓 Открыть' : '🔒 Закрыть';
  });
}

function setupBookmarkButton() {
  const btn = qs('#bookmark-btn');
  btn.addEventListener('click', async () => {
    if (!auth.currentUser) { window.location.href = 'login.html'; return; }
    const nowBookmarked = await DevPortData.toggleBookmark(auth.currentUser.uid, topicId, topicData.title);
    btn.textContent = nowBookmarked ? '🔖 В закладках' : '🔖 В закладки';
    showToast(nowBookmarked ? 'Добавлено в закладки' : 'Убрано из закладок', 'success');
  });
  if (auth.currentUser) {
    DevPortData.isBookmarked(auth.currentUser.uid, topicId).then(is => {
      if (is) btn.textContent = '🔖 В закладках';
    });
  }

  qs('#pin-btn').addEventListener('click', async () => {
    topicData.isPinned = !topicData.isPinned;
    await DevPortData.setTopicFlag(topicId, 'isPinned', topicData.isPinned);
    qs('#pin-btn').textContent = topicData.isPinned ? '📌 Открепить' : '📌 Закрепить';
    showToast('Готово', 'success');
  });
  qs('#close-btn').addEventListener('click', async () => {
    topicData.isClosed = !topicData.isClosed;
    await DevPortData.setTopicFlag(topicId, 'isClosed', topicData.isClosed);
    qs('#close-btn').textContent = topicData.isClosed ? '🔓 Открыть' : '🔒 Закрыть';
    qs('#reply-box').classList.toggle('hidden', topicData.isClosed);
    showToast('Готово', 'success');
  });
  qs('#delete-topic-btn').addEventListener('click', async () => {
    if (!confirm('Удалить тему безвозвратно?')) return;
    await DevPortData.deleteTopic(topicId);
    window.location.href = 'forum.html';
  });
}

function listenPosts() {
  DevPortData.listenToPosts(topicId, (posts) => {
    const container = qs('#posts-container');
    container.innerHTML = posts.map((p, i) => postCardHtml(p, i)).join('');
    posts.forEach(p => {
      const el = qs(`#post-${p.id} .post-content`);
      if (el) { el.innerHTML = renderMarkdownSafe(p.content); enhanceRenderedContent(el); }
    });
    attachPostActions(posts);
  });
}

function attachPostActions(posts) {
  qsa('[data-reaction]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { window.location.href = 'login.html'; return; }
      const postId = btn.dataset.post;
      const type = btn.dataset.reaction;
      await DevPortData.toggleReaction(topicId, postId, type, auth.currentUser.uid);
      const post = posts.find(p => p.id === postId);
      if (post && post.authorId !== auth.currentUser.uid) {
        DevPortData.createNotification({
          recipientId: post.authorId, type: 'reaction', actorId: auth.currentUser.uid,
          actorName: currentUserData?.displayName || auth.currentUser.displayName, topicId, topicTitle: topicData.title,
          message: `отреагировал(а) на ваш пост`
        });
      }
    });
  });

  qsa('[data-quote]').forEach(btn => {
    btn.addEventListener('click', () => {
      const post = posts.find(p => p.id === btn.dataset.quote);
      if (!post) return;
      quotedPost = post;
      const quoteText = `> **${post.authorName}:** ${post.content.slice(0, 200).replace(/\n/g, ' ')}\n\n`;
      editorInstance.setValue(editorInstance.getValue() + quoteText);
      qs('#reply-editor-root').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  qsa('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const post = posts.find(p => p.id === btn.dataset.edit);
      const contentEl = qs(`#post-${post.id} .post-content`);
      const original = post.content;
      contentEl.innerHTML = `<textarea class="form-textarea edit-inline-textarea">${escapeHtml(original)}</textarea>
        <div class="flex gap-2" style="margin-top:8px">
          <button class="btn btn-primary btn-sm" data-save-edit="${post.id}">Сохранить</button>
          <button class="btn btn-ghost btn-sm" data-cancel-edit="${post.id}">Отмена</button>
        </div>`;
      qs(`[data-save-edit="${post.id}"]`).addEventListener('click', async () => {
        const val = qs(`#post-${post.id} .edit-inline-textarea`).value;
        await DevPortData.editPost(topicId, post.id, val);
        showToast('Сообщение обновлено', 'success');
      });
      qs(`[data-cancel-edit="${post.id}"]`).addEventListener('click', () => {
        contentEl.innerHTML = renderMarkdownSafe(original);
        enhanceRenderedContent(contentEl);
      });
    });
  });

  qsa('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить это сообщение?')) return;
      await DevPortData.deletePost(topicId, btn.dataset.delete);
      showToast('Сообщение удалено', 'success');
    });
  });
}

function setupReplyEditor() {
  editorInstance = initEditor('#reply-editor-root', { draftKey: `draft_reply_${topicId}` });

  qs('#submit-reply-btn').addEventListener('click', async () => {
    if (!auth.currentUser) { window.location.href = 'login.html'; return; }
    const content = editorInstance.getValue().trim();
    if (!content) { showToast('Напишите что-нибудь перед отправкой', 'error'); return; }

    const btn = qs('#submit-reply-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Отправка...';

    try {
      await DevPortData.addPost(topicId, {
        content,
        authorId: auth.currentUser.uid,
        authorName: currentUserData?.displayName || auth.currentUser.displayName,
        authorPhoto: currentUserData?.photoURL || '',
        authorRole: currentUserData?.role,
        quotedPostId: quotedPost ? quotedPost.id : null
      });

      if (topicData.authorId !== auth.currentUser.uid) {
        DevPortData.createNotification({
          recipientId: topicData.authorId, type: 'reply', actorId: auth.currentUser.uid,
          actorName: currentUserData?.displayName || auth.currentUser.displayName,
          topicId, topicTitle: topicData.title, message: 'ответил(а) в вашей теме'
        });
      }
      if (quotedPost && quotedPost.authorId !== auth.currentUser.uid && quotedPost.authorId !== topicData.authorId) {
        DevPortData.createNotification({
          recipientId: quotedPost.authorId, type: 'mention', actorId: auth.currentUser.uid,
          actorName: currentUserData?.displayName || auth.currentUser.displayName,
          topicId, topicTitle: topicData.title, message: 'процитировал(а) вас'
        });
      }

      editorInstance.setValue('');
      editorInstance.clearDraft();
      quotedPost = null;
      showToast('Ответ опубликован', 'success');
    } catch (e) {
      showToast('Не удалось отправить ответ', 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = 'Отправить ответ';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadTopic();
  setupReplyEditor();
});
