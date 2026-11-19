/* ============================================================
   РЕЕСТР ПРОВЕРОК — с drag&drop и динамическим фильтром групп
   ============================================================ */
const EDITOR_PASSWORD = '1405';

let checksState = {
  data: null,
  activeTab: 'kirov',
  isEditor: false,
  openGroups: {}
};

const dragState = {
  type: null,
  groupId: null,
  ruleId: null
};

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function toast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) { alert(msg); return; }
  const text = document.getElementById('toastMsg');
  if (text) text.textContent = msg;
  const i = document.getElementById('toastIcon');
  if (i) i.className = type === 'error' ? 'fa-solid fa-circle-exclamation text-rose-400' : 'fa-solid fa-circle-check text-emerald-400';
  t.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 2400);
}

/* ---------- ЗАГРУЗКА / СОХРАНЕНИЕ ---------- */
async function loadChecksFromServer() {
  if (!state.data) return;
  checksState.data = state.data.checks || {};
  if (!checksState.data[checksState.activeTab]) {
    checksState.activeTab = Object.keys(checksState.data)[0] || null;
  }
}

async function saveChecksToServer() {
  if (!state.data) return false;
  state.data.checks = checksState.data;
  return await saveToServer();
}

/* ---------- ВКЛАДКИ ---------- */
function renderChecksTabs() {
  const el = document.getElementById('tabs');
  if (!el) return;
  const keys = Object.keys(checksState.data || {});
  el.innerHTML = keys.map(key => {
    const f = checksState.data[key];
    const active = key === checksState.activeTab;
    const count = f.groups.length;
    const color = f.color || 'indigo';
    const activeCls = active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900';
    const closeBtn = (active && checksState.isEditor && keys.length > 1)
      ? `<button class="tab-close" onclick="event.stopPropagation(); deleteFilial('${key}')" title="Удалить филиал" style="margin-left:6px;width:18px;height:18px;border-radius:50%;border:none;background:#e2e8f0;color:#64748b;font-size:11px;line-height:1;cursor:pointer">×</button>`
      : '';
    return `
      <div class="tab-wrap inline-flex items-center rounded-lg ${active ? 'bg-white shadow-sm' : ''}">
        <button onclick="switchChecksTab('${key}')" class="inline-flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg ${activeCls}">
          <span class="w-2 h-2 rounded-full bg-${color}-500 mr-2"></span>
          ${escapeHTML(f.title)}
          <span class="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}">${count}</span>
        </button>
        ${closeBtn}
      </div>
    `;
  }).join('');
}

function switchChecksTab(key) {
  checksState.activeTab = key;
  renderChecks();
}

/* ---------- СТАТИСТИКА ---------- */
function renderChecksStats() {
  const el = document.getElementById('statsRow');
  if (!el) return;
  const f = checksState.data ? checksState.data[checksState.activeTab] : null;
  if (!f) { el.innerHTML = ''; return; }
  const totalGroups = f.groups.length;
  const totalRules = f.groups.reduce((s, g) => s + g.rules.length, 0);
  const devGroups = f.groups.filter(g => g.dev === true).length;
  const totalFilials = Object.keys(checksState.data).length;
  el.innerHTML = `
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <p class="text-[10px] text-slate-500 uppercase font-semibold">Групп проверок</p>
      <h3 class="text-xl font-bold text-slate-900">${totalGroups}</h3>
      <p class="text-[10px] text-slate-400 truncate">${escapeHTML(f.title)}</p>
    </div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <p class="text-[10px] text-slate-500 uppercase font-semibold">Правил всего</p>
      <h3 class="text-xl font-bold text-emerald-600">${totalRules}</h3>
    </div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <p class="text-[10px] text-slate-500 uppercase font-semibold">Заявлено доработок</p>
      <h3 class="text-xl font-bold text-amber-600">${devGroups}</h3>
    </div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <p class="text-[10px] text-slate-500 uppercase font-semibold">Филиалов</p>
      <h3 class="text-xl font-bold text-violet-600">${totalFilials}</h3>
    </div>
  `;
}

/* ---------- КОНТЕНТ ---------- */
function renderChecksContent() {
  const el = document.getElementById('content');
  if (!el) return;
  const f = checksState.data ? checksState.data[checksState.activeTab] : null;
  if (!f) { el.innerHTML = '<div class="py-12 text-center text-slate-400">Данные не загружены</div>'; return; }
  if (!f.groups.length) { el.innerHTML = '<div class="py-12 text-center text-slate-400">Групп нет</div>'; return; }
  el.innerHTML = f.groups.map((g, gi) => renderChecksGroup(g, gi)).join('');
  attachDragAndDrop();
}

function renderChecksGroup(g, gi) {
  const editable = checksState.isEditor;
  const isDev = g.dev === true;
  const groupId = g.id || ('g_' + gi);
  const isOpen = checksState.openGroups[groupId] !== false;

  const devBadge = isDev
    ? `<button onclick="toggleGroupDev('${groupId}')" ${editable ? '' : 'disabled'} class="dev-toggle yes"><i class="fa-solid fa-screwdriver-wrench"></i> Да</button>`
    : `<button onclick="toggleGroupDev('${groupId}')" ${editable ? '' : 'disabled'} class="dev-toggle no">Нет</button>`;

  const rulesHtml = g.rules.map(r => renderChecksRule(g, r)).join('');

  return `
    <div class="group ${isOpen ? 'open' : ''}" data-group="${groupId}">
      <div class="group-header" onclick="toggleChecksGroup('${groupId}')">
        ${editable ? '<span class="group-drag-handle" data-drag-handle="group" title="Перетащите для смены порядка">⠿</span>' : ''}
        <span class="group-num">${gi + 1}</span>
        <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap" onclick="event.stopPropagation()">
          <input type="text" value="${escapeHTML(g.title)}" ${editable ? '' : 'readonly'} onchange="renameChecksGroup('${groupId}', this.value)" class="group-title-input">
          ${devBadge}
        </div>
        <span class="group-count">${g.rules.length}</span>
        ${editable ? `<div style="display:flex;gap:4px" onclick="event.stopPropagation()">
          <button onclick="addChecksRule('${groupId}')" title="Добавить правило" style="width:28px;height:28px;color:#64748b;background:none;border:none;cursor:pointer;border-radius:6px"><i class="fa-solid fa-plus"></i></button>
          <button onclick="deleteChecksGroup('${groupId}')" title="Удалить группу" style="width:28px;height:28px;color:#64748b;background:none;border:none;cursor:pointer;border-radius:6px"><i class="fa-solid fa-trash"></i></button>
        </div>` : ''}
        <i class="fa-solid fa-chevron-down group-chevron"></i>
      </div>
      <div class="group-body">
        <div class="col-header">
          <div></div>
          <div>Условие / Проверка</div>
          <div>Действие</div>
          <div>Применение</div>
          <div>Примечание</div>
          <div></div>
        </div>
        <div class="rules-container" data-group="${groupId}">
          ${rulesHtml}
        </div>
      </div>
    </div>
  `;
}

function renderChecksRule(g, r) {
  const editable = checksState.isEditor;
  const isOn = r.check !== false;
  const icon = isOn ? '✓' : '✗';
  const cls = isOn ? 'on' : 'off';
  const checkText = isOn ? '<span class="check-text yes">✓</span>' : '<span class="check-text no">✗</span>';

  const editAttr = (field) => editable
    ? `contenteditable="true" onblur="updateRuleField('${g.id}','${r.id}','${field}',this.textContent)"`
    : '';

  const noteValue = (r.note || '').trim();
  const noteEmpty = !noteValue || noteValue === '—';
  const noteClass = noteEmpty ? 'rule-cell note editable empty' : 'rule-cell note editable';
  const noteDisplay = noteEmpty ? '—' : renderText(r.note);

  const badgeHtml = r.badge === 'only' ? ' <span class="badge only">эксклюзив</span>' : '';

  return `
    <div class="rule-grid" data-rule-id="${r.id}" data-type="${escapeHTML(r.type || '')}" data-group="${g.id}">
      ${editable ? '<span class="drag-handle" data-drag-handle="rule" title="Перетащите для смены порядка">⠿</span>' : '<span></span>'}
      <div class="rule-cell editable" ${editAttr('cond')}>${renderText(r.cond)}</div>
      <div class="rule-cell editable" ${editAttr('action')}>${renderText(r.action)}</div>
      <div class="rule-field-check" style="display:flex;justify-content:center;align-items:flex-start;padding-top:2px">
        <button onclick="event.stopPropagation(); toggleRuleCheck('${g.id}','${r.id}')" ${editable ? '' : 'disabled'} class="apply-btn ${cls}">${icon}</button>
        ${checkText}
      </div>
      <div class="${noteClass}" ${editAttr('note')}>${noteDisplay}${badgeHtml}</div>
      <div>
        ${editable ? `<button onclick="event.stopPropagation(); deleteChecksRule('${g.id}','${r.id}')" title="Удалить" style="width:26px;height:26px;color:#94a3b8;background:none;border:none;cursor:pointer;border-radius:4px"><i class="fa-solid fa-trash" style="font-size:11px"></i></button>` : ''}
      </div>
    </div>
  `;
}

/* ---------- ПОДСВЕТКА ---------- */
const VALUE_RE = new RegExp([
  '\\d+(?:[.,]\\d+)?\\s*%',
  '\\d{1,2}:\\d{2}',
  '\\d+\\s*[–\\-—]\\s*\\d+\\s*(?:час(?:ов|а)?|ч)\\b',
  '\\d+\\s*(?:час(?:ов|а)?|ч)\\b',
  '\\d+\\s*(?:суток|сутки|сут)\\b',
  '\\d+-[хx]\\b',
  '\\d{1,2}\\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\\S*'
].join('|'), 'gi');

function renderText(text) {
  return escapeHTML(text || '').replace(VALUE_RE, m => '<span class="val">' + m + '</span>');
}

/* ============================================================
   DRAG & DROP
   ============================================================ */
function attachDragAndDrop() {
  if (!checksState.isEditor) return;

  document.querySelectorAll('.drag-handle[data-drag-handle="rule"]').forEach(handle => {
    const row = handle.closest('.rule-grid');
    if (!row) return;
    handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'));
    handle.addEventListener('touchstart', () => row.setAttribute('draggable', 'true'), { passive: true });
    row.addEventListener('dragstart', onRuleDragStart);
    row.addEventListener('dragend', onDragEnd);
    row.addEventListener('dragover', onRuleDragOver);
    row.addEventListener('dragleave', onDragLeave);
    row.addEventListener('drop', onRuleDrop);
  });

  document.querySelectorAll('.group-drag-handle[data-drag-handle="group"]').forEach(handle => {
    const group = handle.closest('.group');
    if (!group) return;
    handle.addEventListener('mousedown', () => group.setAttribute('draggable', 'true'));
    handle.addEventListener('touchstart', () => group.setAttribute('draggable', 'true'), { passive: true });
    group.addEventListener('dragstart', onGroupDragStart);
    group.addEventListener('dragend', onDragEnd);
    group.addEventListener('dragover', onGroupDragOver);
    group.addEventListener('dragleave', onDragLeave);
    group.addEventListener('drop', onGroupDrop);
  });
}

function onRuleDragStart(e) {
  const row = e.currentTarget;
  dragState.type = 'rule';
  dragState.groupId = row.dataset.group;
  dragState.ruleId = row.dataset.ruleId;
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onRuleDragOver(e) {
  if (dragState.type !== 'rule') return;
  const row = e.currentTarget;
  if (row.dataset.group !== dragState.groupId) return;
  if (row.dataset.ruleId === dragState.ruleId) return;
  e.preventDefault();
  row.classList.add('drag-over');
}

function onRuleDrop(e) {
  if (dragState.type !== 'rule') return;
  const row = e.currentTarget;
  if (row.dataset.group !== dragState.groupId) return;
  e.preventDefault();
  row.classList.remove('drag-over');
  if (row.dataset.ruleId === dragState.ruleId) return;
  moveRule(dragState.groupId, dragState.ruleId, row.dataset.ruleId);
}

function onGroupDragStart(e) {
  const group = e.currentTarget;
  dragState.type = 'group';
  dragState.groupId = group.dataset.group;
  dragState.ruleId = null;
  group.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onGroupDragOver(e) {
  if (dragState.type !== 'group') return;
  const group = e.currentTarget;
  if (group.dataset.group === dragState.groupId) return;
  e.preventDefault();
  group.classList.add('drag-over');
}

function onGroupDrop(e) {
  if (dragState.type !== 'group') return;
  const group = e.currentTarget;
  e.preventDefault();
  group.classList.remove('drag-over');
  if (group.dataset.group === dragState.groupId) return;
  moveGroup(dragState.groupId, group.dataset.group);
}

function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onDragEnd(e) {
  const el = e.currentTarget;
  el.classList.remove('dragging');
  el.setAttribute('draggable', 'false');
  document.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
  dragState.type = null;
  dragState.groupId = null;
  dragState.ruleId = null;
}

async function moveGroup(fromId, toId) {
  const f = checksState.data[checksState.activeTab];
  const fromIdx = f.groups.findIndex(g => g.id === fromId);
  const toIdx = f.groups.findIndex(g => g.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = f.groups.splice(fromIdx, 1);
  f.groups.splice(toIdx, 0, moved);
  await saveChecksToServer();
  renderChecks();
  toast('Группа перемещена');
}

async function moveRule(gid, fromId, toId) {
  const g = findChecksGroup(gid);
  if (!g) return;
  const fromIdx = g.rules.findIndex(r => r.id === fromId);
  const toIdx = g.rules.findIndex(r => r.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = g.rules.splice(fromIdx, 1);
  g.rules.splice(toIdx, 0, moved);
  await saveChecksToServer();
  renderChecks();
  toast('Правило перемещено');
}

/* ---------- ДЕЙСТВИЯ ---------- */
function toggleChecksGroup(gid) {
  checksState.openGroups[gid] = checksState.openGroups[gid] === false ? true : false;
  renderChecksContent();
}

function findChecksGroup(gid) {
  const f = checksState.data[checksState.activeTab];
  return f ? f.groups.find(g => g.id === gid) : null;
}
function findChecksRule(gid, rid) {
  const g = findChecksGroup(gid);
  return g ? g.rules.find(r => r.id === rid) : null;
}

async function updateRuleField(gid, rid, field, value) {
  const r = findChecksRule(gid, rid);
  if (!r) return;
  const v = value.trim();
  if (r[field] === v) return;
  r[field] = v;
  await saveChecksToServer();
}

async function toggleRuleCheck(gid, rid) {
  if (!checksState.isEditor) { toast('Войдите как редактор', 'error'); return; }
  const r = findChecksRule(gid, rid);
  if (!r) return;
  r.check = !(r.check !== false);
  await saveChecksToServer();
  renderChecks();
}

async function toggleGroupDev(gid) {
  if (!checksState.isEditor) return;
  const g = findChecksGroup(gid);
  if (!g) return;
  g.dev = !g.dev;
  await saveChecksToServer();
  renderChecks();
}

async function renameChecksGroup(gid, v) {
  if (!checksState.isEditor) return;
  const g = findChecksGroup(gid);
  if (!g || !v.trim()) return;
  g.title = v.trim();
  await saveChecksToServer();
  renderChecks();
}

async function addChecksRule(gid) {
  if (!checksState.isEditor) { toast('Войдите как редактор', 'error'); return; }
  const g = findChecksGroup(gid);
  if (!g) return;
  g.rules.push({ id: 'r' + Date.now(), cond: 'Новое условие', action: 'Новое действие', note: '—', check: true });
  await saveChecksToServer();
  renderChecks();
}

async function deleteChecksRule(gid, rid) {
  if (!checksState.isEditor) { toast('Войдите как редактор', 'error'); return; }
  if (!confirm('Удалить правило?')) return;
  const g = findChecksGroup(gid);
  g.rules = g.rules.filter(r => r.id !== rid);
  await saveChecksToServer();
  renderChecks();
}

async function deleteChecksGroup(gid) {
  if (!checksState.isEditor) return;
  if (!confirm('Удалить группу?')) return;
  const f = checksState.data[checksState.activeTab];
  f.groups = f.groups.filter(g => g.id !== gid);
  await saveChecksToServer();
  renderChecks();
}

async function deleteFilial(key) {
  if (!checksState.isEditor) return;
  if (!confirm('Удалить филиал?')) return;
  delete checksState.data[key];
  checksState.activeTab = Object.keys(checksState.data)[0];
  await saveChecksToServer();
  renderChecks();
}

/* ---------- МОДАЛКИ ---------- */
function openModalFilial() {
  if (!checksState.isEditor) { toast('Войдите как редактор', 'error'); return; }
  document.getElementById('newFilialName').value = '';
  const sel = document.getElementById('copyFromFilial');
  sel.innerHTML = '<option value="">— Не копировать —</option>';
  Object.entries(checksState.data).forEach(([k, v]) => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = v.title + ' (' + v.groups.length + ' групп)';
    sel.appendChild(o);
  });
  document.getElementById('copyPreview').classList.add('hidden');
  document.getElementById('modalFilial').classList.remove('hidden');
  document.getElementById('modalFilial').classList.add('flex');
}
function closeModalFilial() {
  document.getElementById('modalFilial').classList.add('hidden');
  document.getElementById('modalFilial').classList.remove('flex');
}
function onCopySourceChange() {
  const key = document.getElementById('copyFromFilial').value;
  const prev = document.getElementById('copyPreview');
  if (!key) { prev.classList.add('hidden'); return; }
  const f = checksState.data[key];
  if (!f) return;
  const rules = f.groups.reduce((s, g) => s + g.rules.length, 0);
  document.getElementById('copyGroupsCount').textContent = f.groups.length;
  document.getElementById('copyRulesCount').textContent = rules;
  prev.classList.remove('hidden');
}
async function createFilial() {
  const name = document.getElementById('newFilialName').value.trim();
  if (!name) { document.getElementById('newFilialName').focus(); return; }
  const sourceKey = document.getElementById('copyFromFilial').value;
  const key = 'fil_' + Date.now();
  const colors = ['indigo','emerald','violet','amber','rose','sky','teal'];
  let groups = [];
  let color = colors[Object.keys(checksState.data).length % colors.length];
  if (sourceKey && checksState.data[sourceKey]) {
    groups = deepClone(checksState.data[sourceKey].groups);
    groups.forEach(g => {
      g.id = 'g' + Date.now() + Math.random().toString(36).slice(2, 6);
      g.rules.forEach(r => r.id = 'r' + Date.now() + Math.random().toString(36).slice(2, 6));
    });
    color = checksState.data[sourceKey].color || color;
  }
  checksState.data[key] = { title: name, color, groups };
  checksState.activeTab = key;
  await saveChecksToServer();
  closeModalFilial();
  renderChecks();
  toast('✓ Филиал создан');
}

function openModalGroup() {
  if (!checksState.isEditor) { toast('Войдите как редактор', 'error'); return; }
  document.getElementById('modalTitle').textContent = 'Новая группа';
  document.getElementById('modalLabel').textContent = 'Название группы';
  document.getElementById('modalField').value = '';
  document.getElementById('modalInput').classList.remove('hidden');
  document.getElementById('modalInput').classList.add('flex');
  setTimeout(() => document.getElementById('modalField').focus(), 100);
  document.getElementById('modalOkBtn').onclick = async () => {
    const v = document.getElementById('modalField').value.trim();
    if (!v) return;
    const f = checksState.data[checksState.activeTab];
    f.groups.push({ id: 'g' + Date.now(), title: v, type: 'custom', dev: false, rules: [] });
    closeModalInput();
    await saveChecksToServer();
    renderChecks();
  };
}
function closeModalInput() {
  document.getElementById('modalInput').classList.add('hidden');
  document.getElementById('modalInput').classList.remove('flex');
}

/* ============================================================
   ДИНАМИЧЕСКИЙ ФИЛЬТР ТИПОВ (из групп)
   ============================================================ */
function renderTypeFilter() {
  const sel = document.getElementById('filterType');
  if (!sel) return;
  const f = checksState.data ? checksState.data[checksState.activeTab] : null;
  if (!f || !f.groups) {
    sel.innerHTML = '<option value="">Все типы проверок</option>';
    return;
  }
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">Все типы проверок</option>' +
    f.groups.map(g => `<option value="${g.id}">${escapeHTML(g.title)}</option>`).join('');
  if (currentVal && f.groups.find(g => g.id === currentVal)) {
    sel.value = currentVal;
  }
}

/* ============================================================
   ФИЛЬТРАЦИЯ
   ============================================================ */
function applyFilters() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const typeId = document.getElementById('filterType')?.value || '';
  const dev = document.getElementById('filterDev')?.value || '';

  document.querySelectorAll('#content .group').forEach(groupEl => {
    const gid = groupEl.dataset.group;
    const g = findChecksGroup(gid);
    const groupDev = g && g.dev === true;
    const matchDev = !dev || (dev === 'yes' && groupDev) || (dev === 'no' && !groupDev);
    const matchGroup = !typeId || gid === typeId;

    if (!matchDev || !matchGroup) {
      groupEl.style.display = 'none';
      return;
    }
    groupEl.style.display = '';

    let groupVisible = 0;
    groupEl.querySelectorAll('.rule-grid').forEach(ruleEl => {
      const text = ruleEl.textContent.toLowerCase();
      const matchSearch = !q || text.includes(q);
      if (matchSearch) { ruleEl.classList.remove('hidden'); groupVisible++; }
      else { ruleEl.classList.add('hidden'); }
    });

    if (q && groupVisible === 0) groupEl.style.display = 'none';
  });
}

/* ============================================================
   ГЛАВНЫЙ РЕНДЕР
   ============================================================ */
function renderChecks() {
  if (!checksState.data) return;
  renderChecksTabs();
  renderChecksStats();
  renderChecksContent();
  renderTypeFilter();
}

/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */
async function loadChecksFromServer() {
  if (!state.data) return;
  checksState.data = state.data.checks || {};
  if (!checksState.data[checksState.activeTab]) {
    checksState.activeTab = Object.keys(checksState.data)[0] || null;
  }
}

function onUserChanged() {
  checksState.isEditor = isManager();
  document.body.classList.toggle('viewer', !checksState.isEditor);
  if (checksState.data) renderChecks();
}

function onDataChanged() {
  if (!state.data) return;
  checksState.data = state.data.checks || {};
  if (!checksState.data[checksState.activeTab]) {
    checksState.activeTab = Object.keys(checksState.data)[0] || null;
  }
  checksState.isEditor = isManager();
  document.body.classList.toggle('viewer', !checksState.isEditor);
  renderChecks();
}

document.addEventListener('DOMContentLoaded', () => {
  // Если данные уже загружены (common.js успел) — рендерим
  if (state.data) {
    checksState.data = state.data.checks || {};
    if (!checksState.data[checksState.activeTab]) {
      checksState.activeTab = Object.keys(checksState.data)[0] || null;
    }
    checksState.isEditor = isManager();
    document.body.classList.toggle('viewer', !checksState.isEditor);
    renderChecks();
  } else {
    // Ждём загрузки данных из common.js
    setTimeout(() => {
      if (state.data) {
        checksState.data = state.data.checks || {};
        if (!checksState.data[checksState.activeTab]) {
          checksState.activeTab = Object.keys(checksState.data)[0] || null;
        }
        checksState.isEditor = isManager();
        document.body.classList.toggle('viewer', !checksState.isEditor);
        renderChecks();
      }
    }, 800);
  }
});