/* ============================================================
   common.js — минимальная версия, которая работает
   ============================================================ */

// ============================================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
window.state = {
  data: null,
  user: null,
  loading: false
};

// ============================================================
// ПОЛЬЗОВАТЕЛЬ
// ============================================================
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('portal_user') || 'null');
  } catch (e) { return null; }
}

function isManager() {
  const u = getCurrentUser();
  return !!(u && u.role === 'manager');
}

function matchesUser(name) {
  const u = getCurrentUser();
  if (!u) return false;
  return u.name === name;
}

function updateUserBadge() {
  const badge = document.getElementById('userBadge');
  const btn = document.getElementById('loginBtn');
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  const avatar = document.getElementById('userAvatar');
  const user = getCurrentUser();
  if (!badge || !btn) return;
  if (user) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    btn.classList.add('hidden');
    if (nameEl) nameEl.textContent = user.name || 'Пользователь';
    if (roleEl) roleEl.textContent = user.role === 'manager' ? 'Руководитель' : 'Сотрудник';
    if (avatar) avatar.textContent = (user.name || '?').charAt(0).toUpperCase();
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
    btn.classList.remove('hidden');
  }
}

function setCurrentUser(user) {
  try {
    if (user) localStorage.setItem('portal_user', JSON.stringify(user));
    else localStorage.removeItem('portal_user');
  } catch (e) {}
  state.user = user;
  updateUserBadge();
  if (typeof onUserChanged === 'function') onUserChanged();
}

function openLogin() {
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function onLoginChange() {
  const val = document.getElementById('loginSelect').value;
  const block = document.getElementById('passwordBlock');
  if (val === '__manager__') block.classList.remove('hidden');
  else block.classList.add('hidden');
}

async function doLogin() {
  const val = document.getElementById('loginSelect').value;
  const pwd = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  err.classList.add('hidden');
  if (val === '__manager__') {
    if (pwd === '1405') {
      setCurrentUser({ name: 'Руководитель', role: 'manager' });
      document.getElementById('loginModal').classList.add('hidden');
      document.getElementById('loginModal').classList.remove('flex');
      toast('Вход выполнен');
    } else {
      err.textContent = 'Неверный пароль';
      err.classList.remove('hidden');
    }
  }
}

function logoutUser() {
  setCurrentUser(null);
  toast('Вы вышли');
}

// ============================================================
// ЗАГРУЗКА / СОХРАНЕНИЕ ДАННЫХ
// ============================================================
async function loadData() {
  if (state.loading) return;
  state.loading = true;
  try {
    const res = await fetch('/api/data?_=' + Date.now()).then(r => r.json());
    if (res && res.ok && res.data) {
      state.data = res.data;
      if (typeof onDataChanged === 'function') onDataChanged();
    }
  } catch (e) {
    console.error('Ошибка загрузки данных:', e);
  } finally {
    state.loading = false;
  }
}

async function saveToServer() {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: state.data })
    });
    const json = await res.json();
    if (json.ok) return true;
    toast('Ошибка сохранения', 'error');
    return false;
  } catch (e) {
    console.error('Ошибка сохранения:', e);
    toast('Ошибка сохранения', 'error');
    return false;
  }
}

// ============================================================
// ТОСТ
// ============================================================
function toast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) { console.log(msg); return; }
  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastMsg');
  if (text) text.textContent = msg;
  if (icon) icon.className = type === 'error'
    ? 'fa-solid fa-circle-exclamation text-rose-400'
    : 'fa-solid fa-circle-check text-emerald-400';
  t.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 2400);
}

// ============================================================
// ТЁМНАЯ ТЕМА
// ============================================================
function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const root = document.documentElement;
  const sync = () => {
    const dark = root.classList.contains('dark');
    btn.innerHTML = dark
      ? '<i class="fa-solid fa-sun mr-1.5"></i> Тема'
      : '<i class="fa-solid fa-moon mr-1.5"></i> Тема';
  };
  btn.addEventListener('click', () => {
    root.classList.toggle('dark');
    try {
      localStorage.setItem('ecp.theme', root.classList.contains('dark') ? 'dark' : 'light');
    } catch (e) {}
    sync();
  });
  sync();
}

// ============================================================
// ГЛОБАЛЬНЫЕ УТИЛИТЫ (для timeoff.js, checks.js и др.)
// ============================================================
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
window.escapeHTML = escapeHtml;

function escapeAttr(s) { return escapeHtml(s); }

function formatDateRu(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();
}

function avatarClass(name) {
  const colors = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700',
                  'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700',
                  'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h += name.charCodeAt(i);
  return colors[h % colors.length];
}

function plural(n, one, few, many) {
  const m = Math.abs(n) % 100;
  if (m >= 11 && m <= 14) return many;
  const d = m % 10;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function uid() { return Math.random().toString(36).slice(2, 10); }

function checksStateIsEditor() { return isManager(); }

// ============================================================
// API: /api/me (заглушка)
// ============================================================
async function me() {
  try {
    const res = await fetch('/api/me?_=' + Date.now());
    if (res.ok) {
      const json = await res.json();
      return json.user || null;
    }
  } catch (e) {}
  return null;
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  state.user = getCurrentUser();
  updateUserBadge();
  initTheme();
  loadData();

  // Подсветка активного пункта меню
  const path = location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.nav === path) {
      link.classList.add('bg-indigo-50', 'dark:bg-indigo-900/30', 'text-indigo-700', 'dark:text-indigo-300');
      link.classList.remove('text-slate-700', 'dark:text-slate-300');
    }
  });
});
// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ДЛЯ КАНБАН-ЧЕКЛИСТА
// ============================================================
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
window.escapeHTML = escapeHtml;