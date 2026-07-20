/* ==========================================================================
   Shared utilities used across every page.
   ========================================================================== */

/** Show a toast notification. type: 'default' | 'success' | 'error' */
function showToast(message, type = 'default') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms ease, transform 200ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

/** Escape raw HTML — used anywhere user text is injected without markdown. */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/**
 * Render Markdown safely: marked.js -> DOMPurify sanitize -> highlight.js on code blocks.
 * This is the ONLY approved path for turning user content into HTML anywhere in the app.
 */
function renderMarkdownSafe(rawMarkdown) {
  if (!rawMarkdown) return '';
  const dirty = marked.parse(rawMarkdown, { breaks: true, gfm: true });
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p','br','strong','em','del','u','a','ul','ol','li','blockquote','code','pre','img','h1','h2','h3','h4','table','thead','tbody','tr','th','td','span','div','hr'],
    ALLOWED_ATTR: ['href','src','alt','title','class','target','rel']
  });
  return clean;
}

/** Post-process a rendered container: syntax highlight + safe external links + spoilers. */
function enhanceRenderedContent(container) {
  container.querySelectorAll('pre code').forEach((block) => {
    if (window.hljs) hljs.highlightElement(block);
  });
  container.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer nofollow');
  });
  // [spoiler]text[/spoiler] convention rendered client-side after markdown pass
  container.innerHTML = container.innerHTML.replace(
    /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi,
    '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>'
  );
}

/** Human-friendly relative time, e.g. "5 minutes ago". */
function timeAgo(date) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const steps = [
    [60, 'сек.'], [60, 'мин.'], [24, 'ч.'], [30, 'дн.'], [12, 'мес.'], [Infinity, 'г.']
  ];
  let value = seconds;
  let unitIndex = 0;
  const divisors = [1, 60, 3600, 86400, 2592000, 31536000];
  if (seconds < 60) return 'только что';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин. назад`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч. назад`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} дн. назад`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} мес. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDate(date) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Turn a title into a URL-safe slug (used for topic URLs). */
function slugify(text) {
  const map = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return text.toLowerCase().split('').map(ch => map[ch] ?? ch).join('')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

/** Extract lowercase keyword tokens from a title, for simple prefix search. */
function extractKeywords(title) {
  return Array.from(new Set(
    title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(w => w.length > 1)
  )).slice(0, 20);
}

/**
 * Resize an image file client-side and return it as a compact JPEG data URL.
 * Used for avatars: Firebase Storage isn't provisioned on this project, so instead
 * of uploading the raw file we shrink it in-browser and store the data URL straight
 * on the user document in Firestore — no Storage bucket required at all.
 */
function fileToResizedDataUrl(file, maxDim = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('not-an-image')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode-failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function qs(selector, scope = document) { return scope.querySelector(selector); }
function qsa(selector, scope = document) { return Array.from(scope.querySelectorAll(selector)); }

/** Read a query-string param from the current URL. */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** Simple client-side redirect guard for pages that require authentication. */
function requireAuth(onReady) {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    } else {
      onReady(user);
    }
  });
}
