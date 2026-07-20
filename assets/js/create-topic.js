/* ==========================================================================
   Create topic page.
   ========================================================================== */

let topicEditor = null;

async function populateCategorySelect() {
  const select = qs('#topic-category-input');
  try {
    await DevPortData.seedCategoriesIfEmpty();
  } catch (err) {
    console.error('Category seeding failed:', err);
  }
  const cats = await DevPortData.getCategories();
  if (!cats.length) {
    select.innerHTML = '<option value="">Категории недоступны — обновите страницу</option>';
    showToast('Не удалось загрузить категории. Попробуйте обновить страницу.', 'error');
    return;
  }
  const presetCategory = getParam('category');
  select.innerHTML = cats.map(c => `<option value="${c.id}" data-name="${escapeHtml(c.name)}" ${c.id === presetCategory ? 'selected' : ''}>${c.icon || ''} ${escapeHtml(c.name)}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth(() => {
    populateCategorySelect();
    topicEditor = initEditor('#topic-editor-root', { draftKey: 'draft_new_topic' });

    const savedTitle = localStorage.getItem('draft_new_topic_title');
    if (savedTitle) qs('#topic-title-input').value = savedTitle;
    qs('#topic-title-input').addEventListener('input', debounce((e) => {
      localStorage.setItem('draft_new_topic_title', e.target.value);
    }, 200));

    qs('#create-topic-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = qs('#topic-title-input').value.trim();
      const content = topicEditor.getValue().trim();
      const categorySelect = qs('#topic-category-input');
      const categoryId = categorySelect.value;
      const categoryName = categorySelect.selectedOptions[0]?.dataset.name || '';
      const tags = qs('#topic-tags-input').value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 8);

      if (title.length < 8) {
        qs('#title-error').textContent = 'Заголовок должен быть не короче 8 символов';
        qs('#title-error').classList.add('show');
        return;
      }
      qs('#title-error').classList.remove('show');
      if (!content) { showToast('Опишите содержание темы', 'error'); return; }

      const submitBtn = qs('#create-topic-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Публикация...';

      try {
        const snap = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = snap.data();
        const topicId = await DevPortData.createTopic({
          title, categoryId, categoryName, tags,
          firstPostContent: content,
          authorId: auth.currentUser.uid,
          authorName: userData.displayName,
          authorPhoto: userData.photoURL,
          authorRole: userData.role
        });
        topicEditor.clearDraft();
        localStorage.removeItem('draft_new_topic_title');
        showToast('Тема опубликована', 'success');
        window.location.href = `topic.html?id=${topicId}`;
      } catch (err) {
        console.error('createTopic failed:', err, 'stage:', err.stage);
        const stageLabel = { 'topic-doc': 'создание темы', 'first-post': 'создание первого сообщения' }[err.stage] || 'неизвестный шаг';
        const detail = err.code === 'permission-denied'
          ? `Нет прав (шаг: ${stageLabel}). Проверьте правила Firestore.`
          : (err.message || 'Неизвестная ошибка');
        showToast(`Не удалось создать тему: ${detail}`, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Опубликовать тему';
      }
    });
  });
});
