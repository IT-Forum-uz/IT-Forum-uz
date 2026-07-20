/* ==========================================================================
   Header behavior shared by every page: theme toggle, auth-aware nav,
   notification badge, mobile menu, quick search.
   ========================================================================== */

(function initTheme() {
  const saved = localStorage.getItem('devport-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('devport-theme', next);
}

function initHeader() {
  const themeBtn = qs('#theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const mobileToggle = qs('#mobile-nav-toggle');
  const mobileNav = qs('#mobile-nav');
  if (mobileToggle && mobileNav) {
    mobileToggle.addEventListener('click', () => mobileNav.classList.toggle('open'));
  }

  const searchInput = qs('#header-search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        window.location.href = `search.html?q=${encodeURIComponent(searchInput.value.trim())}`;
      }
    });
  }

  const logoutBtn = qs('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await auth.signOut();
      window.location.href = 'index.html';
    });
  }

  auth.onAuthStateChanged(async (user) => {
    const guestSlot = qs('#nav-guest');
    const userSlot = qs('#nav-user');
    if (!user) {
      if (guestSlot) guestSlot.classList.remove('hidden');
      if (userSlot) userSlot.classList.add('hidden');
      return;
    }
    if (guestSlot) guestSlot.classList.add('hidden');
    if (userSlot) userSlot.classList.remove('hidden');

    const snap = await db.collection('users').doc(user.uid).get();
    const data = snap.data() || {};
    if (data.displayName && !data.displayNameLower) {
      const lower = data.displayName.toLowerCase();
      db.collection('users').doc(user.uid).update({ displayNameLower: lower }).catch(() => {});
      data.displayNameLower = lower;
    }
    const navAvatar = qs('#nav-avatar');
    if (navAvatar) navAvatar.src = data.photoURL || 'assets/images/default-avatar.svg';
    const navName = qs('#nav-username');
    if (navName) navName.textContent = data.displayName || user.email;
    const profileLink = qs('#nav-profile-link');
    if (profileLink) profileLink.href = `profile.html?uid=${user.uid}`;
    const adminLink = qs('#nav-admin-link');
    if (adminLink) {
      if (['admin', 'super_admin'].includes(data.role)) adminLink.classList.remove('hidden');
      else adminLink.classList.add('hidden');
    }

    // Live unread notification badge
    db.collection('notifications')
      .where('recipientId', '==', user.uid)
      .where('read', '==', false)
      .onSnapshot((qsnap) => {
        const badge = qs('#notif-badge');
        if (badge) badge.classList.toggle('hidden', qsnap.empty);
      });
  });
}

document.addEventListener('DOMContentLoaded', initHeader);
