/* ==========================================================================
   Messages page — list of conversations + realtime chat window.
   ========================================================================== */

let currentUser = null;
let activeConvId = null;
let activeOtherUid = null;
let unsubMessages = null;
const userCache = {};

async function getUserCached(uid) {
  if (userCache[uid]) return userCache[uid];
  const u = await DevPortData.getUserPublic(uid);
  userCache[uid] = u || { displayName: 'Пользователь', photoURL: '' };
  return userCache[uid];
}

function otherParticipant(conv) {
  return conv.participants.find(p => p !== currentUser.uid);
}

async function renderConversationList(conversations) {
  const list = qs('#conversation-list');
  if (!conversations.length) {
    list.innerHTML = '<div class="empty-state">Пока нет диалогов</div>';
    return;
  }
  const rows = await Promise.all(conversations.map(async (conv) => {
    const otherUid = otherParticipant(conv);
    const other = await getUserCached(otherUid);
    return `
      <div class="conversation-item ${conv.id === activeConvId ? 'active' : ''}" data-conv="${conv.id}" data-other="${otherUid}">
        <img class="avatar avatar-md" src="${other.photoURL || 'assets/images/default-avatar.svg'}" alt="">
        <div style="flex:1; min-width:0">
          <div style="font-weight:600">${escapeHtml(other.displayName || 'Пользователь')}</div>
          <div class="text-muted" style="font-size:var(--fs-xs); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escapeHtml(conv.lastMessage || '')}</div>
        </div>
      </div>`;
  }));
  list.innerHTML = rows.join('');

  qsa('.conversation-item').forEach(el => {
    el.addEventListener('click', () => openConversation(el.dataset.conv, el.dataset.other));
  });
}

async function openConversation(convId, otherUid) {
  activeConvId = convId;
  activeOtherUid = otherUid;
  qsa('.conversation-item').forEach(el => el.classList.toggle('active', el.dataset.conv === convId));

  qs('#chat-empty-state').classList.add('hidden');
  qs('#chat-active').classList.remove('hidden');

  const other = await getUserCached(otherUid);
  qs('#chat-with-avatar').src = other.photoURL || 'assets/images/default-avatar.svg';
  qs('#chat-with-name').textContent = other.displayName || 'Пользователь';
  qs('#chat-with-name').href = `profile.html?uid=${otherUid}`;

  if (unsubMessages) unsubMessages();
  unsubMessages = DevPortData.listenMessages(convId, renderMessages);
}

function renderMessages(messages) {
  const container = qs('#chat-messages');
  container.innerHTML = messages.map(m => `
    <div class="chat-bubble ${m.senderId === currentUser.uid ? 'mine' : 'theirs'}">${escapeHtml(m.text)}</div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function setupChatForm() {
  qs('#chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = qs('#chat-input');
    const text = input.value.trim();
    if (!text || !activeConvId) return;
    input.value = '';
    try {
      await DevPortData.sendMessage(activeConvId, { senderId: currentUser.uid, text });
    } catch (err) {
      showToast('Не удалось отправить сообщение', 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth(async (user) => {
    currentUser = user;
    DevPortData.listenConversations(user.uid, renderConversationList);
    setupChatForm();

    // If arrived via profile.html "Написать" button (?uid=...), open/create that conversation.
    const targetUid = getParam('uid');
    if (targetUid && targetUid !== user.uid) {
      try {
        const convId = await DevPortData.getOrCreateConversation(user.uid, targetUid);
        openConversation(convId, targetUid);
      } catch (err) {
        console.error('Failed to open conversation:', err);
        showToast('Не удалось открыть диалог. Проверьте, что правила Firestore опубликованы.', 'error');
      }
    }
  });
});
