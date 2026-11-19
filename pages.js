/* ============================================================
   РАЗДЕЛЫ И СТРАНИЦЫ ПОРТАЛА
   ============================================================ */

const PORTAL_SECTIONS = [
  { url: '/',              icon: 'fa-house',           color: '#4f46e5', title: 'Главная',              desc: 'Обзор всех разделов портала' },
  { url: '/timeoff',       icon: 'fa-business-time',   color: '#6366f1', title: 'Ведомости отгулов',     desc: 'Учёт переработок и отгулов сотрудников' },
  { url: '/checks',        icon: 'fa-clipboard-check', color: '#059669', title: 'Реестр проверок',       desc: 'Правила проверок показаний по филиалам' },
  { url: '/checklist',     icon: 'fa-calendar-check',  color: '#d97706', title: 'Чек-лист предбиллинга', desc: 'Контроль сроков этапов предбиллинга' },
  { url: '/learning',      icon: 'fa-graduation-cap',  color: '#0284c7', title: 'Обучение',              desc: 'Материалы и курсы для сотрудников' },
];

const SECTION_PAGE_IDS = ['learning'];

function onUserChanged() { if (document.getElementById('pagesGrid')) renderPagesList(); }
function onDataChanged() { if (document.getElementById('pagesGrid')) renderPagesList(); }

function renderSections() {
  const grid = document.getElementById('sectionsGrid');
  const cnt = document.getElementById('sectionsCount');
  if (!grid) return;
  cnt.textContent = PORTAL_SECTIONS.length;

  grid.innerHTML = PORTAL_SECTIONS.map(s => `
    <a href="${s.url}" class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all block group">
      <div class="flex items-start gap-3">
        <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style="background:${s.color}18;color:${s.color}">
          <i class="fa-solid ${s.icon}"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="mb-1">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600">раздел</span>
          </div>
          <div class="font-bold text-slate-900 text-sm truncate">${escapeHtml(s.title)}</div>
          <div class="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">${escapeHtml(s.desc)}</div>
        </div>
        <i class="fa-solid fa-arrow-right text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all text-xs mt-1"></i>
      </div>
    </a>
  `).join('');
}

function renderPagesList() {
  if (!state.data) return;
  renderSections();

  const allPages = state.data.pages || [];
  const pages = allPages.filter(p => !SECTION_PAGE_IDS.includes(p.id));

  const grid = document.getElementById('pagesGrid');
  const empty = document.getElementById('pagesEmpty');
  const cnt = document.getElementById('pagesCount');
  if (!grid) return;

  cnt.textContent = pages.length;

  if (!pages.length) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  grid.innerHTML = pages.map(p => {
    const icon = p.icon || 'fa-file-lines';
    const color = p.color || '#64748b';
    const canDel = isManager() && p.canDelete !== false;
    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
        <a href="/page/${p.id}" class="flex items-start gap-3 mb-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style="background:${color}18;color:${color}">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-1">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-50 text-violet-600">страница</span>
            </div>
            <div class="font-bold text-slate-900 text-sm truncate">${escapeHtml(p.title)}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">ID: ${p.id}</div>
          </div>
          <i class="fa-solid fa-arrow-right text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all text-xs mt-1"></i>
        </a>
        <div class="flex gap-1.5">
          <a href="/page/${p.id}" class="flex-1 text-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-medium rounded-lg transition-colors">Открыть</a>
          ${canDel ? `<button onclick="deletePage('${p.id}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs rounded-lg transition-colors" title="Удалить"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function createNewPage() {
  if (!isManager()) { toast('Только руководитель может создавать страницы', 'error'); return; }
  const title = prompt('Название новой страницы:');
  if (!title || !title.trim()) return;
  const id = 'page_' + Date.now().toString(36);
  if (!state.data.pages) state.data.pages = [];
  state.data.pages.push({
    id,
    title: title.trim(),
    icon: 'fa-file-lines',
    color: '#64748b',
    content: '<h2>Новая страница</h2><p>Нажмите «Редактировать», чтобы наполнить содержимым.</p>',
    createdAt: Date.now(),
    canDelete: true
  });
  await saveToServer();
  window.location.href = '/page/' + id;
}

async function deletePage(id) {
  if (!isManager()) return;
  if (SECTION_PAGE_IDS.includes(id)) { toast('Это раздел портала, а не страница', 'error'); return; }
  if (!confirm('Удалить страницу?')) return;
  state.data.pages = (state.data.pages || []).filter(p => p.id !== id);
  await saveToServer();
  renderPagesList();
  toast('Удалено');
}

function startEditPage() {
  if (!isManager()) { toast('Только руководитель', 'error'); return; }
  const pc = document.getElementById('pageContent');
  const pe = document.getElementById('pageEditor');
  const ea = document.getElementById('editArea');
  if (!pc || !pe || !ea) return;
  ea.innerHTML = pc.innerHTML;
  pc.classList.add('hidden');
  pe.classList.remove('hidden');
  document.getElementById('editPageBtn').classList.add('hidden');
  document.getElementById('savePageBtn').classList.remove('hidden');
  document.getElementById('cancelEditBtn').classList.remove('hidden');
  document.getElementById('pageSubtitle').textContent = 'Режим редактирования';
}

async function savePageContent() {
  const pc = document.getElementById('pageContent');
  if (!pc) return;
  const pid = pc.dataset.pageId;
  const page = (state.data.pages || []).find(p => p.id === pid);
  if (!page) return;
  page.content = document.getElementById('editArea').innerHTML;
  await saveToServer();
  pc.innerHTML = page.content;
  cancelEditPage();
  toast('Сохранено');
}

function cancelEditPage() {
  const pc = document.getElementById('pageContent');
  const pe = document.getElementById('pageEditor');
  if (!pc || !pe) return;
  pc.classList.remove('hidden');
  pe.classList.add('hidden');
  document.getElementById('editPageBtn').classList.remove('hidden');
  document.getElementById('savePageBtn').classList.add('hidden');
  document.getElementById('cancelEditBtn').classList.add('hidden');
  document.getElementById('pageSubtitle').textContent = 'Страница портала';
}

function insertLink() {
  const url = prompt('URL ссылки:');
  if (url) document.execCommand('createLink', false, url);
}

async function insertImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast('Загрузка...');
    const res = await API.upload(file);
    if (res.ok) {
      document.execCommand('insertImage', false, '/uploads/' + res.file);
      toast('Картинка вставлена');
    } else toast('Ошибка загрузки', 'error');
  };
  input.click();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('pagesGrid')) {
    if (state.data) renderPagesList();
    else setTimeout(() => { if (state.data) renderPagesList(); }, 500);
  }
});