/* ==========================================================================
   Profile page.
   ========================================================================== */

let profileUid = null;
let profileData = null;
let isOwnProfile = false;

function socialLinksHtml(u) {
  const links = [];
  if (u.website) links.push(`<a href="${escapeHtml(u.website)}" target="_blank" rel="noopener">🌐 Сайт</a>`);
  if (u.github) links.push(`<a href="https://github.com/${escapeHtml(u.github)}" target="_blank" rel="noopener">💻 GitHub</a>`);
  if (u.telegram) links.push(`<a href="https://t.me/${escapeHtml(u.telegram)}" target="_blank" rel="noopener">✈️ Telegram</a>`);
  if (u.discord) links.push(`<span>🎮 ${escapeHtml(u.discord)}</span>`);
  return links.join('');
}

async function loadProfile() {
  profileUid = getParam('uid');
  if (!profileUid && auth.currentUser) profileUid = auth.currentUser.uid;
  if (!profileUid) {
    auth.onAuthStateChanged(u => { if (u) { profileUid = u.uid; loadProfile(); } else window.location.href = 'login.html'; });
    return;
  }

  const snap = await db.collection('users').doc(profileUid).get();
  if (!snap.exists) { qs('#profile-name').textContent = 'Пользователь не найден'; return; }
  profileData = snap.data();

  document.title = `${profileData.displayName} — DevPort`;
  qs('#profile-name').innerHTML = `${escapeHtml(profileData.displayName)} ${roleBadgeHtmlProfile(profileData.role)}`;
  qs('#profile-joined').textContent = `на форуме с ${formatDate(profileData.createdAt)}`;
  qs('#profile-bio').textContent = profileData.bio || 'Пользователь пока не добавил описание.';
  qs('#profile-avatar').src = profileData.photoURL || 'assets/images/default-avatar.svg';
  if (profileData.coverURL) qs('#profile-cover').style.backgroundImage = `url(${profileData.coverURL})`;
  qs('#profile-links').innerHTML = socialLinksHtml(profileData);
  qs('#profile-skills').innerHTML = (profileData.skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('');
  qs('#stat-topics').textContent = profileData.topicsCount || 0;
  qs('#stat-posts').textContent = profileData.postsCount || 0;
  qs('#stat-reputation').textContent = profileData.reputation || 0;
  qs('#stat-followers').textContent = (profileData.followers || []).length;

  auth.onAuthStateChanged((user) => {
    isOwnProfile = user && user.uid === profileUid;
    qs('#edit-profile-btn').classList.toggle('hidden', !isOwnProfile);
    qs('#edit-avatar-btn').classList.toggle('hidden', !isOwnProfile);
    qs('#edit-cover-btn').classList.toggle('hidden', !isOwnProfile);
    const followBtn = qs('#follow-btn');
    const messageBtn = qs('#message-btn');
    if (user && !isOwnProfile) {
      followBtn.classList.remove('hidden');
      const following = (profileData.followers || []).includes(user.uid);
      followBtn.textContent = following ? '✓ Вы подписаны' : '+ Подписаться';
      messageBtn.classList.remove('hidden');
    }
  });

  loadTab('topics');
}

function roleBadgeHtmlProfile(role) {
  if (role === 'admin' || role === 'super_admin') return '<span class="badge-role admin">Admin</span>';
  if (role === 'moderator') return '<span class="badge-role moderator">Мод</span>';
  if (role === 'vip') return '<span class="badge-role vip">VIP</span>';
  if (role === 'newbie') return '<span class="badge-role newbie">Новичок</span>';
  return '';
}

async function loadTab(tab) {
  const el = qs('#profile-tab-content');
  el.innerHTML = '<div class="skeleton" style="height:100px;margin:16px"></div>';

  if (tab === 'topics') {
    const snap = await db.collection('topics').where('authorId', '==', profileUid).orderBy('createdAt', 'desc').limit(20).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    el.innerHTML = items.map(t => `
      <div class="topic-row"><div class="topic-main">
        <div class="topic-title-line"><a href="topic.html?id=${t.id}">${escapeHtml(t.title)}</a></div>
        <div class="topic-subline"><span class="tag">${escapeHtml(t.categoryName)}</span> · ${timeAgo(t.createdAt)}</div>
      </div></div>`).join('') || '<div class="empty-state">Пока нет тем</div>';
  }

  if (tab === 'bookmarks') {
    if (!auth.currentUser || auth.currentUser.uid !== profileUid) {
      el.innerHTML = '<div class="empty-state">Закладки видны только владельцу профиля</div>';
      return;
    }
    const items = await DevPortData.listBookmarks(profileUid);
    el.innerHTML = items.map(b => `
      <div class="topic-row"><div class="topic-main">
        <div class="topic-title-line"><a href="topic.html?id=${b.topicId}">${escapeHtml(b.topicTitle)}</a></div>
        <div class="topic-subline">добавлено ${timeAgo(b.createdAt)}</div>
      </div></div>`).join('') || '<div class="empty-state">Нет закладок</div>';
  }

  if (tab === 'posts') {
    el.innerHTML = '<div class="empty-state">Лента сообщений пользователя доступна из соответствующих тем.</div>';
  }
}

function setupTabs() {
  qsa('.profile-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.profile-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTab(btn.dataset.tab);
    });
  });
}

function setupEditModal() {
  const modal = qs('#edit-profile-modal');
  qs('#edit-profile-btn').addEventListener('click', () => {
    qs('#edit-name').value = profileData.displayName || '';
    qs('#edit-bio').value = profileData.bio || '';
    qs('#edit-skills').value = (profileData.skills || []).join(', ');
    qs('#edit-website').value = profileData.website || '';
    qs('#edit-github').value = profileData.github || '';
    qs('#edit-telegram').value = profileData.telegram || '';
    qs('#edit-discord').value = profileData.discord || '';
    modal.classList.add('open');
  });
  qs('#close-edit-modal').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  qs('#edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal = qs('#edit-name').value.trim();
    const updates = {
      displayName: nameVal,
      displayNameLower: nameVal.toLowerCase(),
      bio: qs('#edit-bio').value.trim(),
      skills: qs('#edit-skills').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 15),
      website: qs('#edit-website').value.trim(),
      github: qs('#edit-github').value.trim().replace('@', ''),
      telegram: qs('#edit-telegram').value.trim().replace('@', ''),
      discord: qs('#edit-discord').value.trim()
    };
    await db.collection('users').doc(profileUid).update(updates);
    Object.assign(profileData, updates);
    modal.classList.remove('open');
    showToast('Профиль обновлён', 'success');
    loadProfile();
  });
}

function setupImageUploads() {
  qs('#edit-avatar-btn').addEventListener('click', () => qs('#avatar-file-input').click());
  qs('#avatar-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // Resized in-browser and stored directly on the user doc — no Firebase Storage needed.
      const dataUrl = await fileToResizedDataUrl(file, 256, 0.82);
      await db.collection('users').doc(profileUid).update({ photoURL: dataUrl });
      qs('#profile-avatar').src = dataUrl;
      const navAvatar = qs('#nav-avatar');
      if (navAvatar && auth.currentUser && auth.currentUser.uid === profileUid) navAvatar.src = dataUrl;
      showToast('Аватар обновлён', 'success');
    } catch (err) {
      console.error(err);
      showToast('Не удалось обновить аватар. Попробуйте другое изображение.', 'error');
    }
  });

  qs('#edit-cover-btn').addEventListener('click', () => qs('#cover-file-input').click());
  qs('#cover-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const ref = storage.ref(`covers/${profileUid}/${Date.now()}_${file.name}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      await db.collection('users').doc(profileUid).update({ coverURL: url });
      qs('#profile-cover').style.backgroundImage = `url(${url})`;
      showToast('Обложка обновлена', 'success');
    } catch (err) {
      console.error(err);
      showToast('Загрузка изображений недоступна: Firebase Storage не подключён для этого проекта', 'error');
    }
  });
}

function setupFollowButton() {
  qs('#follow-btn').addEventListener('click', async () => {
    if (!auth.currentUser) { window.location.href = 'login.html'; return; }
    const ref = db.collection('users').doc(profileUid);
    const following = (profileData.followers || []).includes(auth.currentUser.uid);
    try {
      await ref.update({ followers: following ? FieldValue.arrayRemove(auth.currentUser.uid) : FieldValue.arrayUnion(auth.currentUser.uid) });
      if (!following) {
        DevPortData.createNotification({
          recipientId: profileUid, type: 'follow', actorId: auth.currentUser.uid,
          actorName: auth.currentUser.displayName, message: 'подписался(ась) на вас'
        });
      }
      loadProfile();
    } catch (err) {
      console.error('follow toggle failed:', err);
      showToast('Не удалось изменить подписку. Проверьте, что правила Firestore опубликованы.', 'error');
    }
  });
}

function setupMessageButton() {
  qs('#message-btn').addEventListener('click', () => {
    if (!auth.currentUser) { window.location.href = 'login.html'; return; }
    window.location.href = `messages.html?uid=${profileUid}`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  setupTabs();
  setupEditModal();
  setupImageUploads();
  setupFollowButton();
  setupMessageButton();
});
