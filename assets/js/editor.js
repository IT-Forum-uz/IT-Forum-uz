/* ==========================================================================
   Markdown editor: toolbar formatting, live preview, drag & drop images,
   local autosave. Attach with initEditor('#my-editor-root', { draftKey }).
   ========================================================================== */

function initEditor(rootSelector, { draftKey = null, uploadPath = 'attachments' } = {}) {
  const root = qs(rootSelector);
  if (!root) return null;

  const textarea = qs('.editor-textarea', root);
  const preview = qs('.editor-preview', root);
  const toolbar = qs('.editor-toolbar', root);
  const dropHint = qs('.editor-drop-hint', root);

  const wrapSelection = (before, after = before) => {
    const start = textarea.selectionStart, end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.slice(start, end) || 'текст';
    textarea.value = value.slice(0, start) + before + selected + after + value.slice(end);
    textarea.focus();
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + selected.length;
    syncPreview();
  };

  const insertAtCursor = (text) => {
    const start = textarea.selectionStart;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(textarea.selectionEnd);
    textarea.focus();
    syncPreview();
  };

  const actions = {
    bold: () => wrapSelection('**'),
    italic: () => wrapSelection('*'),
    underline: () => wrapSelection('<u>', '</u>'),
    strike: () => wrapSelection('~~'),
    code: () => wrapSelection('`'),
    codeblock: () => insertAtCursor('\n```js\nconsole.log("hello");\n```\n'),
    quote: () => insertAtCursor('\n> Цитата\n'),
    link: () => wrapSelection('[', '](https://)'),
    image: () => insertAtCursor('\n![описание](https://)\n'),
    list: () => insertAtCursor('\n- пункт 1\n- пункт 2\n- пункт 3\n'),
    table: () => insertAtCursor('\n| Заголовок 1 | Заголовок 2 |\n| --- | --- |\n| ячейка | ячейка |\n'),
    spoiler: () => wrapSelection('[spoiler]', '[/spoiler]'),
    emoji: () => insertAtCursor('🙂')
  };

  if (toolbar) {
    qsa('[data-action]', toolbar).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fn = actions[btn.dataset.action];
        if (fn) fn();
      });
    });
  }

  function syncPreview() {
    if (!preview) return;
    preview.innerHTML = renderMarkdownSafe(textarea.value);
    enhanceRenderedContent(preview);
    if (draftKey) localStorage.setItem(draftKey, textarea.value);
  }

  textarea.addEventListener('input', debounce(syncPreview, 150));

  // Restore autosaved draft
  if (draftKey) {
    const saved = localStorage.getItem(draftKey);
    if (saved && !textarea.value) {
      textarea.value = saved;
    }
  }
  syncPreview();

  // Drag & drop images -> Firebase Storage -> markdown image tag
  if (dropHint) {
    ['dragover', 'dragenter'].forEach(evt => root.addEventListener(evt, (e) => {
      e.preventDefault(); dropHint.classList.add('active');
    }));
    ['dragleave', 'drop'].forEach(evt => root.addEventListener(evt, (e) => {
      e.preventDefault(); dropHint.classList.remove('active');
    }));
    root.addEventListener('drop', async (e) => {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      for (const file of files) {
        await uploadAndInsertImage(file);
      }
    });
  }

  async function uploadAndInsertImage(file) {
    if (!auth.currentUser) { showToast('Войдите, чтобы прикреплять файлы', 'error'); return; }
    insertAtCursor(`\n![Загрузка ${file.name}...]()\n`);
    const path = `${uploadPath}/${auth.currentUser.uid}/${Date.now()}_${file.name}`;
    try {
      const ref = storage.ref(path);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      textarea.value = textarea.value.replace(`![Загрузка ${file.name}...]()`, `![${file.name}](${url})`);
      syncPreview();
    } catch (err) {
      console.error(err);
      textarea.value = textarea.value.replace(`![Загрузка ${file.name}...]()`, '');
      syncPreview();
      showToast('Загрузка изображений недоступна: Firebase Storage не подключён для этого проекта', 'error');
    }
  }

  const fileInput = qs('.editor-file-input', root);
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      for (const file of Array.from(e.target.files)) await uploadAndInsertImage(file);
      fileInput.value = '';
    });
  }

  return {
    getValue: () => textarea.value,
    setValue: (val) => { textarea.value = val; syncPreview(); },
    clearDraft: () => draftKey && localStorage.removeItem(draftKey)
  };
}
