/* ==========================================================================
   Settings page: profile info, account (email/password), notification
   preferences, appearance, and account deletion.
   ========================================================================== */

let settingsUid = null;
let settingsUserData = null;

const DEFAULT_NOTIF_PREFS = {
  notifyOnReply: true,
  notifyOnMention: true,
  notifyOnReaction: true,
  notifyOnFollow: true,
  notifyOnMessage: true
};

function setSaving(btn, saving, labelIdle) {
  btn.disabled = saving;
  btn.innerHTML = saving ? '<span class="spinner"></span> Сохранение...' : labelIdle;
}

/* -------------------- Panels navigation -------------------- */
function setupPanelNav() {
  qsa('#settings-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('#settings-nav button').forEach(b => b.classList.remove('active'));
      qsa('.settings-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      qs(`.settings-panel[data-panel="${btn.dataset.panel}"]`).classList.add('active');
      history.replaceState({}, '', `#${btn.dataset.panel}`);
    });
  });
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const target = qs(`#settings-nav button[data-panel="${hash}"]`);
    if (target) target.click();
  }
}

/* -------------------- Load user data -------------------- */
async function loadSettingsData(uid) {
  settingsUid = uid;
  const snap = await db.collection('users').doc(uid).get();
  settingsUserData = snap.data() || {};

  qs('#settings-avatar').src = settingsUserData.photoURL || 'assets/images/default-avatar.svg';
  qs('#f-name').value = settingsUserData.displayName || '';
  qs('#f-bio').value = settingsUserData.bio || '';
  qs('#f-skills').value = (settingsUserData.skills || []).join(', ');
  qs('#f-website').value = settingsUserData.website || '';
  qs('#f-github').value = settingsUserData.github || '';
  qs('#f-telegram').value = settingsUserData.telegram || '';
  qs('#f-discord').value = settingsUserData.discord || '';

  qs('#current-email').textContent = auth.currentUser.email || '';

  const prefs = Object.assign({}, DEFAULT_NOTIF_PREFS, settingsUserData.notificationPrefs || {});
  qsa('#notif-toggles input[data-pref]').forEach(input => {
    input.checked = !!prefs[input.dataset.pref];
  });

  qs('input[data-pref="showEmail"]').checked = !!settingsUserData.showEmail;
}

/* -------------------- Profile form -------------------- */
function setupProfileForm() {
  qs('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = qs('#profile-save-btn');
    const name = qs('#f-name').value.trim();
    if (name.length < 3) { showToast('Имя должно быть не короче 3 символов', 'error'); return; }

    const updates = {
      displayName: name,
      displayNameLower: name.toLowerCase(),
      bio: qs('#f-bio').value.trim(),
      skills: qs('#f-skills').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 15),
      website: qs('#f-website').value.trim(),
      github: qs('#f-github').value.trim().replace('@', ''),
      telegram: qs('#f-telegram').value.trim().replace('@', ''),
      discord: qs('#f-discord').value.trim()
    };

    setSaving(btn, true, 'Сохранить изменения');
    try {
      await db.collection('users').doc(settingsUid).update(updates);
      if (auth.currentUser.displayName !== name) await auth.currentUser.updateProfile({ displayName: name });
      Object.assign(settingsUserData, updates);
      showToast('Профиль обновлён', 'success');
    } catch (err) {
      console.error(err);
      showToast('Не удалось сохранить профиль', 'error');
    } finally {
      setSaving(btn, false, 'Сохранить изменения');
    }
  });

  qs('#change-avatar-btn').addEventListener('click', () => qs('#avatar-file-input').click());
  qs('#avatar-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // Resized in-browser and stored directly on the user doc — no Firebase Storage needed.
      const dataUrl = await fileToResizedDataUrl(file, 256, 0.82);
      await db.collection('users').doc(settingsUid).update({ photoURL: dataUrl });
      qs('#settings-avatar').src = dataUrl;
      const navAvatar = qs('#nav-avatar');
      if (navAvatar) navAvatar.src = dataUrl;
      showToast('Аватар обновлён', 'success');
    } catch (err) {
      console.error(err);
      showToast('Не удалось обновить аватар. Попробуйте другое изображение.', 'error');
    }
  });
}

/* -------------------- Reauthentication helper -------------------- */
async function reauthenticate(password) {
  const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, password);
  await auth.currentUser.reauthenticateWithCredential(credential);
}

function mapSettingsAuthError(code) {
  const map = {
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-credential': 'Неверный пароль',
    'auth/email-already-in-use': 'Этот email уже используется',
    'auth/invalid-email': 'Некорректный email',
    'auth/weak-password': 'Пароль слишком простой',
    'auth/requires-recent-login': 'Пожалуйста, подтвердите пароль ещё раз и повторите попытку',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже'
  };
  return map[code] || 'Произошла ошибка. Попробуйте снова';
}

/* -------------------- Email form -------------------- */
function setupEmailForm() {
  qs('#email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = qs('#f-new-email').value.trim();
    const password = qs('#f-email-password').value;
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    setSaving(btn, true, 'Изменить email');
    try {
      await reauthenticate(password);
      await auth.currentUser.verifyBeforeUpdateEmail(newEmail);
      showToast('Письмо для подтверждения отправлено на ' + newEmail, 'success');
      form.reset();
    } catch (err) {
      console.error(err);
      showToast(mapSettingsAuthError(err.code), 'error');
    } finally {
      setSaving(btn, false, 'Изменить email');
    }
  });
}

/* -------------------- Password form -------------------- */
function setupPasswordForm() {
  qs('#password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = qs('#f-current-password').value;
    const next = qs('#f-new-password').value;
    const confirm = qs('#f-confirm-password').value;
    if (next !== confirm) { showToast('Пароли не совпадают', 'error'); return; }
    if (next.length < 8) { showToast('Новый пароль должен быть не короче 8 символов', 'error'); return; }

    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    setSaving(btn, true, 'Изменить пароль');
    try {
      await reauthenticate(current);
      await auth.currentUser.updatePassword(next);
      showToast('Пароль изменён', 'success');
      form.reset();
    } catch (err) {
      console.error(err);
      showToast(mapSettingsAuthError(err.code), 'error');
    } finally {
      setSaving(btn, false, 'Изменить пароль');
    }
  });
}

/* -------------------- Notification / privacy toggles -------------------- */
function setupToggles() {
  qsa('#notif-toggles input[data-pref]').forEach(input => {
    input.addEventListener('change', async () => {
      try {
        await db.collection('users').doc(settingsUid).update({
          [`notificationPrefs.${input.dataset.pref}`]: input.checked
        });
        showToast('Настройки уведомлений сохранены', 'success');
      } catch (err) {
        console.error(err);
        input.checked = !input.checked;
        showToast('Не удалось сохранить настройку', 'error');
      }
    });
  });

  const showEmailInput = qs('input[data-pref="showEmail"]');
  showEmailInput.addEventListener('change', async () => {
    try {
      await db.collection('users').doc(settingsUid).update({ showEmail: showEmailInput.checked });
      showToast('Настройки приватности сохранены', 'success');
    } catch (err) {
      console.error(err);
      showEmailInput.checked = !showEmailInput.checked;
      showToast('Не удалось сохранить настройку', 'error');
    }
  });
}

/* -------------------- Appearance -------------------- */
function setupAppearance() {
  const buttons = qsa('.theme-option');
  function syncActive() {
    const current = document.documentElement.getAttribute('data-theme');
    buttons.forEach(b => b.classList.toggle('active', b.dataset.themeChoice === current));
  }
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.themeChoice;
      document.documentElement.setAttribute('data-theme', choice);
      localStorage.setItem('devport-theme', choice);
      syncActive();
    });
  });
  syncActive();
}

/* -------------------- Logout / delete account -------------------- */
function setupDangerZone() {
  qs('#settings-logout-btn').addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'index.html';
  });

  const modal = qs('#delete-account-modal');
  qs('#delete-account-btn').addEventListener('click', () => modal.classList.add('open'));
  qs('#close-delete-modal').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  qs('#delete-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = qs('#f-delete-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    setSaving(btn, true, 'Удалить навсегда');
    try {
      await reauthenticate(password);
      const uid = settingsUid;
      await db.collection('users').doc(uid).delete();
      await auth.currentUser.delete();
      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      showToast(mapSettingsAuthError(err.code), 'error');
      setSaving(btn, false, 'Удалить навсегда');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupPanelNav();
  setupProfileForm();
  setupEmailForm();
  setupPasswordForm();
  setupToggles();
  setupAppearance();
  setupDangerZone();

  requireAuth((user) => loadSettingsData(user.uid));
});
