/* ==========================================================================
   Authentication: register / login / forgot password.
   Used by register.html and login.html.
   ========================================================================== */

function setFieldError(inputEl, errorEl, message) {
  if (message) {
    inputEl.classList.add('invalid');
    errorEl.textContent = message;
    errorEl.classList.add('show');
  } else {
    inputEl.classList.remove('invalid');
    errorEl.classList.remove('show');
  }
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* -------------------- Registration -------------------- */
function initRegisterForm() {
  const form = qs('#register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = qs('#reg-name').value.trim();
    const email = qs('#reg-email').value.trim();
    const password = qs('#reg-password').value;
    const confirm = qs('#reg-confirm').value;

    let valid = true;
    setFieldError(qs('#reg-name'), qs('#reg-name-error'), name.length < 3 ? 'Минимум 3 символа' : '');
    if (name.length < 3) valid = false;

    setFieldError(qs('#reg-email'), qs('#reg-email-error'), !validEmail(email) ? 'Некорректный email' : '');
    if (!validEmail(email)) valid = false;

    setFieldError(qs('#reg-password'), qs('#reg-password-error'), password.length < 8 ? 'Минимум 8 символов' : '');
    if (password.length < 8) valid = false;

    setFieldError(qs('#reg-confirm'), qs('#reg-confirm-error'), password !== confirm ? 'Пароли не совпадают' : '');
    if (password !== confirm) valid = false;

    if (!valid) return;

    const submitBtn = qs('#register-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Создаём аккаунт...';

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });

      await db.collection('users').doc(cred.user.uid).set({
        displayName: name,
        displayNameLower: name.toLowerCase(),
        email,
        photoURL: '',
        coverURL: '',
        bio: '',
        skills: [],
        website: '',
        github: '',
        telegram: '',
        discord: '',
        role: 'user',
        banned: false,
        topicsCount: 0,
        postsCount: 0,
        likesCount: 0,
        reputation: 0,
        badges: [],
        followers: [],
        following: [],
        createdAt: FieldValue.serverTimestamp(),
        lastSeen: FieldValue.serverTimestamp()
      });

      showToast('Аккаунт создан! Добро пожаловать.', 'success');
      window.location.href = 'forum.html';
    } catch (err) {
      showToast(mapAuthError(err.code), 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Зарегистрироваться';
    }
  });
}

/* -------------------- Login -------------------- */
function initLoginForm() {
  const form = qs('#login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#login-email').value.trim();
    const password = qs('#login-password').value;

    if (!validEmail(email)) {
      setFieldError(qs('#login-email'), qs('#login-email-error'), 'Некорректный email');
      return;
    }

    const submitBtn = qs('#login-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Входим...';

    try {
      await auth.signInWithEmailAndPassword(email, password);
      await db.collection('users').doc(auth.currentUser.uid).update({ lastSeen: FieldValue.serverTimestamp() });
      const redirect = getParam('redirect');
      window.location.href = redirect || 'forum.html';
    } catch (err) {
      showToast(mapAuthError(err.code), 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Войти';
    }
  });

  const forgotLink = qs('#forgot-password-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = qs('#login-email').value.trim();
      if (!validEmail(email)) {
        showToast('Введите email в поле выше, затем нажмите "Забыли пароль?"', 'error');
        return;
      }
      try {
        await auth.sendPasswordResetEmail(email);
        showToast('Письмо для сброса пароля отправлено на ' + email, 'success');
      } catch (err) {
        showToast(mapAuthError(err.code), 'error');
      }
    });
  }
}

function mapAuthError(code) {
  const map = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/invalid-email': 'Некорректный email',
    'auth/weak-password': 'Пароль слишком простой',
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase не настроен: вставьте реальные ключи проекта в firebase/firebase-config.js',
    'auth/invalid-api-key': 'Firebase не настроен: вставьте реальные ключи проекта в firebase/firebase-config.js',
    'auth/configuration-not-found': 'В Firebase Console не включён метод входа Email/Password (Authentication → Sign-in method)',
    'auth/network-request-failed': 'Нет соединения с Firebase. Проверьте интернет и настройки проекта'
  };
  return map[code] || `Произошла ошибка${code ? ' (' + code + ')' : ''}. Проверьте настройку Firebase в firebase/firebase-config.js`;
}

document.addEventListener('DOMContentLoaded', () => {
  initRegisterForm();
  initLoginForm();
  // Redirect already-logged-in users away from auth pages
  const authPages = ['login.html', 'register.html'];
  const currentPage = window.location.pathname.split('/').pop();
  if (authPages.includes(currentPage)) {
    auth.onAuthStateChanged((user) => {
      if (user && !getParam('redirect')) {
        // stay silent — don't force-redirect if they intentionally navigated here
      }
    });
  }
});
