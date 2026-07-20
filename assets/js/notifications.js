/* ==========================================================================
   Notifications page — realtime feed of replies, reactions, mentions,
   follows. Click to open the relevant topic/profile and mark as read.
   ========================================================================== */

const NOTIF_ICON = {
  reply: '💬', reaction: '⭐', mention: '↩️', follow: '➕'
};

function notifTargetUrl(n) {
  if (n.topicId) return `topic.html?id=${n.topicId}`;
  if (n.type === 'follow') return `profile.html?uid=${n.actorId}`;
  return '#';
}

function notifItemHtml(n) {
  const icon = NOTIF_ICON[n.type] || '🔔';
  return `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-url="${notifTargetUrl(n)}" style="cursor:pointer">
      <div style="font-size:20px">${icon}</div>
      <div style="flex:1">
        <div class="notif-text"><b>${escapeHtml(n.actorName || 'Пользователь')}</b> ${escapeHtml(n.message || '')}${n.topicTitle ? ` — <span class="text-cyan">${escapeHtml(n.topicTitle)}</span>` : ''}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
      <button class="icon-btn" data-delete-notif="${n.id}" title="Удалить" style="align-self:flex-start">✕</button>
    </div>`;
}

function renderNotifications(items) {
  const list = qs('#notif-list');
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">Пока нет уведомлений</div>';
    return;
  }
  list.innerHTML = items.map(notifItemHtml).join('');

  qsa('.notif-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-delete-notif]')) return;
      const id = el.dataset.id;
      await DevPortData.markNotificationRead(id);
      const url = el.dataset.url;
      if (url && url !== '#') window.location.href = url;
    });
  });

  qsa('[data-delete-notif]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await DevPortData.deleteNotification(btn.dataset.deleteNotif);
      showToast('Уведомление удалено', 'success');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth((user) => {
    DevPortData.listenNotifications(user.uid, renderNotifications);

    qs('#mark-all-read-btn').addEventListener('click', async () => {
      await DevPortData.markAllNotificationsRead(user.uid);
      showToast('Все уведомления отмечены как прочитанные', 'success');
    });
  });
});
