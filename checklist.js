/* ============================================================
   ЧЕК-ЛИСТ ПРЕДБИЛЛИНГА — v12
   (модалки, Excel, массовые даты, одиночные задачи с фактом)
   ============================================================ */

const CL_PHASES = [
  { id: 'prep',    title: 'Подготовка',  color: '#4f46e5', tasks: ['t3', 't4', 't5'] },
  { id: 'check',   title: 'Сверка',      color: '#059669', tasks: ['t2', 't6'] },
  { id: 'prebil',  title: 'Предбиллинг', color: '#d97706', tasks: ['t1', 't7', 't8'] },
  { id: 'analysis',title: 'Анализ',      color: '#9333ea', tasks: ['t9', 't10', 't11'] },
];

function clCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

let clState = {
  view: 'list',
  activeTab: null,
  month: clCurrentMonth(),
  currentStageId: null,
};

/* ---------- Утилиты ---------- */
function clPlural(n, one, few, many) {
  const m = n % 100;
  if (m >= 11 && m <= 14) return many;
  const d = n % 10;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}
function clToday() { return new Date().toISOString().slice(0, 10); }
function clPlanDate(item) {
  if (!item.day) return '';
  const [y, m] = clState.month.split('-').map(Number);
  let ty = y, tm = m;
  if (item.isNext) { tm++; if (tm > 12) { tm = 1; ty++; } }
  return `${ty}-${String(tm).padStart(2,'0')}-${String(item.day).padStart(2,'0')}`;
}
function clStatus(plan, fact) {
  if (fact) {
    if (!plan) return { cls: 'status-done', text: '✓ Выполнено' };
    return fact <= plan ? { cls: 'status-done', text: '✓ В срок' } : { cls: 'status-danger', text: '✕ С опозданием' };
  }
  if (!plan) return { cls: 'status-idle', text: '⚪ Без срока' };
  return plan < clToday()
    ? { cls: 'status-danger', text: '✕ Просрочено' }
    : { cls: 'status-warn', text: '⏳ В работе' };
}
function clCountTasks(tasks) {
  if (!tasks) return 0;
  let n = 0;
  tasks.forEach(t => { n++; if (t.children) n += t.children.length; });
  return n;
}
function clCountDone(tasks, key) {
  if (!tasks) return 0;
  const data = clEnsureData().data[`${clState.month}_${key}`] || {};
  let n = 0;
  tasks.forEach(t => {
    if (data[t.id]?.fact) n++;
    if (t.children) t.children.forEach(c => { if (data[c.id]?.fact) n++; });
  });
  return n;
}
function clCurrentTasks() {
  const cl = clEnsureData();
  return cl.structure[clState.activeTab]?.tasks || [];
}
function clStoreKey() { return `${clState.month}_${clState.activeTab}`; }
function clLoadData() { return clEnsureData().data[clStoreKey()] || {}; }
function checksStateIsEditor() {
  try {
    const saved = JSON.parse(localStorage.getItem('portal_user') || 'null');
    return !!(saved && saved.role === 'manager');
  } catch(e) { return false; }
}

/* ---------- Данные ---------- */
function clEnsureData() {
  if (!state.data) return { structure: {}, data: {} };
  if (!state.data.checklist) {
    state.data.checklist = { structure: {}, data: {} };
  }
  const cl = state.data.checklist;
  if (!cl.data) cl.data = {};
  if (!cl.structure) cl.structure = {};
  return cl;
}
async function clSave() { return await saveToServer(); }

/* ---------- Инструкции ---------- */
const CL_INSTR_MAP = {
  't1':    { block: 'gvs',    lesson: 'gvs-1' },
  't3_1':  { block: 'ipb',    lesson: 'ipb-1' },
  't3_2':  { block: 'ipb',    lesson: 'ipb-1' },
  't3_3':  { block: 'ipb',    lesson: 'ipb-1' },
  't3_4':  { block: 'ipb',    lesson: 'ipb-1' },
  't3_5':  { block: 'ipb',    lesson: 'ipb-1' },
  't3_6':  { block: 'ipb',    lesson: 'ipb-1' },
  't4':    { block: 'plan',   lesson: 'plan-1' },
  't5':    { block: 'plan',   lesson: 'plan-2' },
  't6':    { block: 'obj',    lesson: 'obj-1' },
  't6_1':  { block: 'pu',     lesson: 'pu-1' },
  't6_2':  { block: 'obj',    lesson: 'obj-1' },
  't7':    { block: 'prebil', lesson: 'prebil-1' },
  't7_1':  { block: 'prebil', lesson: 'prebil-1' },
  't7_2':  { block: 'prebil', lesson: 'prebil-1' },
  't7_3':  { block: 'prebil', lesson: 'prebil-1' },
  't8':    { block: 'src',    lesson: 'src-1' },
  't10':   { block: 'ved',    lesson: 'ved-1' },
  't11':   { block: 'ocr',    lesson: 'ocr-1' },
};
function clGetInstruction(itemId) {
  const map = CL_INSTR_MAP[itemId];
  if (!map) return null;
  const blocks = (state.data && state.data.learning && state.data.learning.blocks) || [];
  const block = blocks.find(b => b.id === map.block);
  if (!block) return null;
  const lesson = (block.lessons || []).find(l => l.id === map.lesson);
  if (!lesson) return null;
  return { block, lesson };
}

/* ---------- Список филиалов ---------- */
function clRenderFilialList() {
  const cl = clEnsureData();
  const grid = document.getElementById('clFilialGrid');
  const empty = document.getElementById('clFilialEmpty');
  if (!grid) return;
  const keys = Object.keys(cl.structure);
  if (!keys.length) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  grid.innerHTML = keys.map(key => {
    const f = cl.structure[key];
    const total = clCountTasks(f.tasks);
    const done = clCountDone(f.tasks, key);
    const pct = total ? Math.round(done / total * 100) : 0;
    return `
      <div class="filial-card" onclick="clOpenFilial('${key}')">
        <div class="flex items-start gap-3.5 mb-3 pr-8">
          <div class="filial-icon"><i class="fa-solid ${f.icon || 'fa-building'}"></i></div>
          <div class="min-w-0 flex-1">
            <div class="filial-name">${escapeHtml(f.name)}</div>
            <div class="filial-meta">${total} ${clPlural(total, 'задача', 'задачи', 'задач')} · выполнено ${done}</div>
          </div>
        </div>
        <div class="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
          <span>Прогресс</span><span>${pct}%</span>
        </div>
        <div class="filial-progress-track"><div class="filial-progress-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

function clOpenFilial(key) {
  clState.activeTab = key;
  clState.view = 'detail';
  clRender();
}
function clBackToList() {
  clState.view = 'list';
  clState.activeTab = null;
  clRender();
}

/* ---------- Детальный экран ---------- */
function clRenderDetail() {
  const cl = clEnsureData();
  const f = cl.structure[clState.activeTab];
  if (!f) { clBackToList(); return; }

  const iconEl = document.getElementById('clDetailIcon');
  if (iconEl) iconEl.innerHTML = `<i class="fa-solid ${f.icon || 'fa-building'}"></i>`;
  const nameEl = document.getElementById('clDetailName');
  if (nameEl) nameEl.textContent = f.name;

  const total = clCountTasks(f.tasks);
  const done = clCountDone(f.tasks, clState.activeTab);
  const metaEl = document.getElementById('clDetailMeta');
  if (metaEl) metaEl.textContent = `${total} ${clPlural(total, 'задача', 'задачи', 'задач')} · выполнено ${done}`;

  const monthInput = document.getElementById('clMonthInput');
  if (monthInput) monthInput.value = clState.month;

  const list = document.getElementById('clTaskList');
  if (!list) return;

  if (!f.tasks || !f.tasks.length) {
    list.innerHTML = '<div class="py-12 text-center text-slate-400">В филиале пока нет задач</div>';
    return;
  }

  const tasksById = {};
  f.tasks.forEach(t => { tasksById[t.id] = t; });

  list.innerHTML = CL_PHASES.map(phase => {
    const phaseTasks = phase.tasks.map(id => tasksById[id]).filter(Boolean);
    if (!phaseTasks.length) return '';
    return clRenderPhase(phase, phaseTasks);
  }).join('');

  const pct = total ? Math.round(done / total * 100) : 0;
  const pf = document.getElementById('clProgressFill');
  const pp = document.getElementById('clProgressPercent');
  if (pf) pf.style.width = pct + '%';
  if (pp) pp.textContent = pct + '%';
}

function clRenderPhase(phase, tasks) {
  let total = 0, done = 0;
  tasks.forEach(t => { total += clCountTasks([t]); done += clCountDone([t], clState.activeTab); });
  const pct = total ? Math.round(done / total * 100) : 0;

  const cards = tasks.map(t => clRenderCard(t)).join('');

  return `
    <section class="phase" style="--pc:${phase.color}">
      <div class="phase-header">
        <div class="phase-color"></div>
        <div class="min-w-0">
          <div class="phase-title">${escapeHtml(phase.title)}</div>
          <div class="phase-sub">${tasks.length} ${clPlural(tasks.length, 'этап', 'этапа', 'этапов')} · ${done} из ${total}</div>
        </div>
        <div class="phase-progress">
          <div class="phase-progress-track"><div class="phase-progress-fill" style="width:${pct}%"></div></div>
          <span class="phase-progress-text">${pct}%</span>
        </div>
      </div>
      <div class="phase-body">${cards}</div>
    </section>`;
}

function clRenderCard(g) {
  const data = clLoadData();
  const hasChildren = (g.children || []).length > 0;
  const all = hasChildren ? [g, ...g.children] : [g];
  let hasDanger = false, hasWarn = false, allDone = true, anyData = false;
  all.forEach(t => {
    const st = data[t.id] || {};
    const plan = st.plan !== undefined ? st.plan : clPlanDate(t);
    const fact = st.fact || '';
    if (plan || fact) anyData = true;
    if (!fact) allDone = false;
    const s = clStatus(plan, fact);
    if (s.cls === 'status-danger') hasDanger = true;
    if (s.cls === 'status-warn') hasWarn = true;
  });
  const status = !anyData ? 'status-idle' : allDone ? 'status-done' : hasDanger ? 'status-danger' : hasWarn ? 'status-warn' : 'status-idle';
  const doneItems = all.filter(t => (data[t.id] || {}).fact).length;

  // Ближайший срок
  let nearest = null;
  all.forEach(t => {
    const st = data[t.id] || {};
    const plan = st.plan !== undefined ? st.plan : clPlanDate(t);
    const fact = st.fact || '';
    if (!fact && plan) {
      if (!nearest || plan < nearest) nearest = plan;
    }
  });

  let nearestHtml = '';
  if (nearest) {
    const today = clToday();
    const isOverdue = nearest < today;
    nearestHtml = `<div class="text-[10px] mt-1 ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}">
      <i class="fa-solid fa-clock"></i> ${isOverdue ? 'Просрочено' : 'Ближайший'}: ${nearest}
    </div>`;
  } else if (allDone) {
    nearestHtml = `<div class="text-[10px] mt-1 text-emerald-600"><i class="fa-solid fa-check"></i> Все выполнены</div>`;
  }

  return `
    <article class="task-card ${status}" onclick="clOpenStage('${g.id}')">
      <div class="task-card-header">
        <span class="task-num">${escapeHtml(g.num || '')}</span>
        <div class="task-title">${escapeHtml(g.title || '')}</div>
      </div>
      <div class="task-meta">
        <span class="task-meta-badge"><i class="fa-solid fa-check"></i> ${doneItems}/${all.length}</span>
        ${g.isNext ? '<span class="task-meta-badge" style="background:#fef3c7;color:#92400e">след. месяц</span>' : ''}
      </div>
      ${nearestHtml}
      <div class="task-hint"><i class="fa-solid fa-arrow-up-right-from-square"></i> Открыть для ввода дат</div>
    </article>`;

}

/* ---------- Модалка этапа (план + факт) ---------- */
function clOpenStage(stageId) {
  const g = clCurrentTasks().find(t => t.id === stageId);
  if (!g) return;
  clState.currentStageId = stageId;

  document.getElementById('clStageTitle').textContent = `${g.num}. ${g.title}`;
  const hasChildren = (g.children || []).length > 0;
  const total = hasChildren ? g.children.length + 1 : 1;
  document.getElementById('clStageSub').textContent = `Задач: ${total} · ${clState.month}`;

  const rows = [];
  if (hasChildren) {
    rows.push(clRenderWideRow(g, true, 0));
    (g.children || []).forEach((c, i) => rows.push(clRenderWideRow(c, false, i + 1)));
  } else {
    rows.push(clRenderWideRow(g, false, 0));
  }

  document.getElementById('clStageBody').innerHTML = `
    <table class="wide-table">
      <thead>
        <tr>
          <th>Задача</th>
          <th class="col-plan">План</th>
          <th class="col-fact">Факт</th>
          <th class="col-status">Статус</th>
          <th class="col-instr">Инструкция</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;

  document.getElementById('clStageModal').classList.add('open');
}

function clCloseStageModal() {
  document.getElementById('clStageModal').classList.remove('open');
  clState.currentStageId = null;
  clRenderDetail();
}

function clRenderWideRow(item, isParent, subNum) {
  const data = clLoadData();
  const st = data[item.id] || {};
  const plan = st.plan !== undefined ? st.plan : clPlanDate(item);
  const fact = st.fact || '';
  const status = clStatus(plan, fact);
  const editable = checksStateIsEditor();
  const isDone = !!fact;

  const instr = clGetInstruction(item.id);
  const instrHtml = instr
    ? `<button class="instr-btn" onclick="event.stopPropagation();clViewInstr('${item.id}')"><i class="fa-solid fa-book-open"></i> Открыть</button>`
    : `<span class="instr-btn empty"><i class="fa-solid fa-book"></i> нет</span>`;

  const numHtml = isParent
    ? `<b>${escapeHtml(item.num || '')}.</b> `
    : (subNum === 0
        ? `<b>${escapeHtml(item.num || '')}.</b> `
        : `<span style="color:#94a3b8">${escapeHtml(item.num || '')}</span> `);

  return `
    <tr class="${isParent ? '' : 'sub'}">
      <td>${numHtml}${escapeHtml(item.title || '')}</td>
      <td>
        <input type="date" value="${plan}" ${editable ? `onchange="clSetDate('${item.id}','plan',this.value)"` : 'disabled'}>
      </td>
      <td>
        ${isParent ? '<span style="color:#94a3b8;font-size:11px">—</span>' : `<input type="date" value="${fact}" ${editable ? `onchange="clSetDate('${item.id}','fact',this.value)"` : 'disabled'}>`}
      </td>
      <td>
        ${isParent ? `<span class="status-pill ${status.cls}">${status.text}</span>` : `
          <div style="display:flex;align-items:center;gap:6px">
            <button onclick="clToggleDone('${item.id}')" class="apply-btn ${isDone ? 'on' : 'off'}">${isDone ? '✓' : '✗'}</button>
            <span class="status-pill ${status.cls}">${status.text}</span>
          </div>`}
      </td>
      <td>${instrHtml}</td>
    </tr>`;
}

async function clSetDate(itemId, field, value) {
  const cl = clEnsureData();
  const key = clStoreKey();
  if (!cl.data[key]) cl.data[key] = {};
  if (!cl.data[key][itemId]) cl.data[key][itemId] = {};
  cl.data[key][itemId][field] = value;
  await clSave();
}

async function clToggleDone(itemId) {
  if (!checksStateIsEditor()) { toast('Войдите как редактор', 'error'); return; }
  const cl = clEnsureData();
  const key = clStoreKey();
  if (!cl.data[key]) cl.data[key] = {};
  if (!cl.data[key][itemId]) cl.data[key][itemId] = {};
  const cur = cl.data[key][itemId].fact || '';
  cl.data[key][itemId].fact = cur ? '' : clToday();
  await clSave();
  const g = clCurrentTasks().find(t => t.id === clState.currentStageId);
  if (g) clOpenStage(clState.currentStageId);
}

/* ---------- Модалка «Даты» ---------- */
function clOpenBulkDates() {
  if (!clState.activeTab) return;
  const rows = [];
  clCurrentTasks().forEach(t => {
    rows.push(clRenderDatesRow(t, true));
    (t.children || []).forEach(c => rows.push(clRenderDatesRow(c, false)));
  });

  document.getElementById('clDatesTableWrap').innerHTML = `
    <table class="wide-table">
      <thead>
        <tr>
          <th>Задача</th>
          <th class="col-plan">План</th>
          <th class="col-status">Статус</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;

  document.getElementById('clDatesModal').classList.add('open');
}

function clRenderDatesRow(item, isParent) {
  const data = clLoadData();
  const st = data[item.id] || {};
  const plan = st.plan !== undefined ? st.plan : clPlanDate(item);
  const fact = st.fact || '';
  const status = clStatus(plan, fact);
  const editable = checksStateIsEditor();

  return `
    <tr class="${isParent ? '' : 'sub'}" data-id="${item.id}">
      <td>${isParent ? `<b>${escapeHtml(item.num || '')}.</b> ` : `<span style="color:#94a3b8">${escapeHtml(item.num || '')}</span> `}${escapeHtml(item.title || '')}</td>
      <td><input type="date" value="${plan}" ${editable ? `onchange="clSetDate('${item.id}','plan',this.value)"` : 'disabled'} data-plan-input></td>
      <td><span class="status-pill ${status.cls}">${status.text}</span></td>
    </tr>`;
}

function clCloseDatesModal() {
  document.getElementById('clDatesModal').classList.remove('open');
  clRenderDetail();
}

function clBulkApplyDay() {
  const day = parseInt(document.getElementById('clBulkDayInput').value || '5', 10);
  if (day < 1 || day > 31) { toast('День от 1 до 31', 'error'); return; }
  const [y, m] = clState.month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const dd = Math.min(day, lastDay);
  const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

  document.querySelectorAll('#clDatesTableWrap tr[data-id]').forEach(tr => {
    const input = tr.querySelector('input[data-plan-input]');
    if (input) { input.value = dateStr; clSetDate(tr.dataset.id, 'plan', dateStr); }
  });
  toast('Даты проставлены');
}

function clBulkShiftDays(delta) {
  document.querySelectorAll('#clDatesTableWrap tr[data-id]').forEach(tr => {
    const input = tr.querySelector('input[data-plan-input]');
    if (!input || !input.value) return;
    const d = new Date(input.value + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    const val = d.toISOString().slice(0, 10);
    input.value = val;
    clSetDate(tr.dataset.id, 'plan', val);
  });
}

async function clBulkClearPlan() {
  document.querySelectorAll('#clDatesTableWrap tr[data-id]').forEach(tr => {
    const input = tr.querySelector('input[data-plan-input]');
    if (input) { input.value = ''; clSetDate(tr.dataset.id, 'plan', ''); }
  });
  toast('План очищен');
}

/* ---------- Excel (CSV с BOM) ---------- */
function clExportExcel() {
  const cl = clEnsureData();
  const f = cl.structure[clState.activeTab];
  if (!f) return;
  const data = clLoadData();

  const rows = [['№', 'Задача', 'План', 'Факт', 'Статус']];
  f.tasks.forEach(t => {
    const st = data[t.id] || {};
    const plan = st.plan !== undefined ? st.plan : clPlanDate(t);
    const fact = st.fact || '';
    const hasChildren = (t.children || []).length > 0;
    rows.push([t.num || '', t.title || '', plan, hasChildren ? '' : fact, clStatus(plan, hasChildren ? '' : fact).text]);
    (t.children || []).forEach(c => {
      const sc = data[c.id] || {};
      const p2 = sc.plan !== undefined ? sc.plan : clPlanDate(c);
      const f2 = sc.fact || '';
      rows.push([c.num || '', '  ' + (c.title || ''), p2, f2, clStatus(p2, f2).text]);
    });
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Предбиллинг_${clState.activeTab}_${clState.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Excel выгружен');
}

/* ---------- Инструкция ---------- */
function clViewInstr(itemId) {
  const instr = clGetInstruction(itemId);
  if (!instr) { toast('Инструкция не найдена', 'error'); return; }
  document.getElementById('clInstrViewTitle').textContent = `${instr.lesson.num}. ${instr.lesson.title}`;
  document.getElementById('clInstrViewBody').innerHTML = instr.lesson.content || '<p>Содержимое пустое</p>';
  document.getElementById('clInstrViewModal').classList.add('open');
}
function clCloseInstrView() {
  document.getElementById('clInstrViewModal').classList.remove('open');
}

/* ---------- Синхронизация ---------- */
function onUserChanged() { if (document.getElementById('clScreenList')) clRender(); }
function onDataChanged() { if (document.getElementById('clScreenList')) clRender(); }

/* ---------- Рендер ---------- */
function clRender() {
  const listEl = document.getElementById('clScreenList');
  const detailEl = document.getElementById('clScreenDetail');
  if (!listEl || !detailEl) return;

  if (clState.view === 'list') {
    listEl.classList.remove('hidden');
    detailEl.classList.add('hidden');
    clRenderFilialList();
  } else {
    listEl.classList.add('hidden');
    detailEl.classList.remove('hidden');
    clRenderDetail();
  }
}

/* ---------- Старт ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const monthInput = document.getElementById('clMonthInput');
  if (monthInput) {
    monthInput.value = clState.month;
    monthInput.addEventListener('change', e => {
      clState.month = e.target.value;
      clRender();
    });
  }

  ['clStageModal', 'clDatesModal', 'clInstrViewModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => {
      if (e.target.id === id) el.classList.remove('open');
    });
  });

  if (state.data) clRender();
  else setTimeout(() => { if (state.data) clRender(); }, 800);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('clStageModal')?.classList.remove('open');
    document.getElementById('clDatesModal')?.classList.remove('open');
    document.getElementById('clInstrViewModal')?.classList.remove('open');
  }
});
/* ============================================================
   ДОБАВЛЕНИЕ ЗАДАЧ / ПОДЗАДАЧ
   ============================================================ */
async function clAddTask() {
  if (!checksStateIsEditor()) { toast('Войдите как редактор', 'error'); return; }
  if (!clState.activeTab) return;
  const title = prompt('Название задачи:');
  if (!title || !title.trim()) return;
  const cl = clEnsureData();
  const f = cl.structure[clState.activeTab];
  if (!f.tasks) f.tasks = [];
  const maxNum = f.tasks.reduce((m, t) => Math.max(m, parseInt(t.num) || 0), 0);
  f.tasks.push({
    id: 't_' + Date.now(),
    num: String(maxNum + 1),
    title: title.trim(),
    day: 1,
    isNext: false,
    children: []
  });
  const ok = await clSave();
  if (ok) { clRenderDetail(); toast('Задача добавлена'); }
  else toast('Ошибка сохранения', 'error');
}

async function clAddSub(stageId) {
  if (!checksStateIsEditor()) { toast('Войдите как редактор', 'error'); return; }
  const g = clCurrentTasks().find(t => t.id === stageId);
  if (!g) return;
  const title = prompt('Название подзадачи:');
  if (!title || !title.trim()) return;
  if (!g.children) g.children = [];
  const maxSub = g.children.reduce((m, c) => Math.max(m, parseInt((c.num || '').split('.')[1]) || 0), 0);
  g.children.push({
    id: stageId + '_' + Date.now(),
    num: `${g.num}.${maxSub + 1}`,
    title: title.trim(),
    day: 1,
    isNext: false
  });
  const ok = await clSave();
  if (ok) { clRenderDetail(); toast('Подзадача добавлена'); }
  else toast('Ошибка сохранения', 'error');
}

/* ============================================================
   EXCEL (XLSX) ДЛЯ ЧЕК-ЛИСТА
   ============================================================ */
function clExportXlsx() {
  if (!clState.activeTab) return;
  const url = `/api/checklist/${clState.activeTab}/xlsx?month=${encodeURIComponent(clState.month)}`;
  window.location.href = url;
  toast('Excel выгружен');
}