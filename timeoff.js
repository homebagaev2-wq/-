/* ============================================================
   ВЕДОМОСТЬ ОТГУЛОВ
   ============================================================ */
let timeoffState = { activeTab: 'balance', empFilter: 'all', empName: null, currentFile: null };

function ensureTimeoffData() {
  if (!state.data.timeoff) {
    state.data.timeoff = {initialBalances: {}, records: [], history: [], trash: []};
  }
  return state.data.timeoff;
}

function onUserChanged() { renderTimeoff(); }
function onDataChanged() { renderTimeoff(); }

function renderTimeoff() {
  if (!state.data) return;
  const d = ensureTimeoffData();
  renderStats();
  renderBalance();
  renderRecords();
  renderTrash();
  switchTab(timeoffState.activeTab);
}

function switchTab(tab) {
  timeoffState.activeTab = tab;
  ['balance','records','calendar','trash'].forEach(t => {
    const v = document.getElementById(t + 'View');
    if (v) v.classList.toggle('hidden', t !== tab);
    const b = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (b) {
      b.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium ' +
        (t === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900');
    }
  });
}

function renderStats() {
  const d = ensureTimeoffData();
  const init = Object.entries(d.initialBalances || {}).reduce((s, [,o]) => s + (parseFloat(o.hours) || 0), 0);
  const ot = (d.records || []).filter(r => r.type === 'overtime').reduce((s,r) => s + r.hours, 0);
  const to = (d.records || []).filter(r => r.type === 'timeoff').reduce((s,r) => s + r.hours, 0);
  const bal = init + ot - to;
  const emps = Object.keys(d.initialBalances || {}).length;
  document.getElementById('statsRow').innerHTML = `
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p class="text-[10px] font-medium text-slate-500 uppercase">Переработки</p><h3 class="text-xl font-bold text-emerald-600 mt-0.5">${init + ot} ч</h3></div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p class="text-[10px] font-medium text-slate-500 uppercase">Отгулы</p><h3 class="text-xl font-bold text-rose-600 mt-0.5">${to} ч</h3></div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p class="text-[10px] font-medium text-slate-500 uppercase">Баланс</p><h3 class="text-xl font-bold ${bal >= 0 ? 'text-indigo-600' : 'text-rose-600'} mt-0.5">${bal > 0 ? '+' : ''}${bal} ч</h3></div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p class="text-[10px] font-medium text-slate-500 uppercase">Сотрудников</p><h3 class="text-xl font-bold text-slate-900 mt-0.5">${emps}</h3></div>
  `;
}

function filterVisible(name) {
  if (!state.user) return false;
  if (isManager()) return true;
  return matchesUser(name);
}

function renderBalance() {
  const d = ensureTimeoffData();
  const all = new Set([...Object.keys(d.initialBalances || {}), ...(d.records || []).map(r => r.employeeName)]);
  const map = {};
  all.forEach(n => {
    map[n] = {
      init: (d.initialBalances[n] || {}).hours || 0,
      date: (d.initialBalances[n] || {}).date || '—',
      ot: 0, to: 0
    };
  });
  (d.records || []).forEach(r => {
    if (!map[r.employeeName]) map[r.employeeName] = {init:0, date:'—', ot:0, to:0};
    if (r.type === 'overtime') map[r.employeeName].ot += r.hours;
    else map[r.employeeName].to += r.hours;
  });

  let names = Array.from(all).filter(filterVisible);
  const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  if (q) names = names.filter(n => n.toLowerCase().includes(q));
  names.sort((a,b) => a.localeCompare(b));

  const container = document.getElementById('balanceView');
  if (!names.length) {
    container.innerHTML = `<div class="py-16 text-center"><div class="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"><i class="fa-solid fa-users"></i></div><h3 class="text-base font-bold text-slate-800">Нет сотрудников</h3>${isManager() ? '<button onclick="openInitialBalanceModal()" class="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl"><i class="fa-solid fa-user-plus mr-2"></i>Добавить первого</button>' : ''}</div>`;
    return;
  }

  container.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-left text-sm">
    <thead><tr class="border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase">
      <th class="py-3 px-3">Сотрудник</th><th class="py-3 px-3">Нач. баланс</th>
      <th class="py-3 px-3">Переработки (+)</th><th class="py-3 px-3">Отгулы (−)</th>
      <th class="py-3 px-3">Текущий</th><th class="py-3 px-3 text-right"></th>
    </tr></thead>
    <tbody class="divide-y divide-slate-100">${names.map(name => {
      const m = map[name];
      const bal = m.init + m.ot - m.to;
      const badge = bal > 0
        ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">+${bal} ч</span>`
        : bal < 0
        ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">${bal} ч</span>`
        : `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">${bal} ч</span>`;
      const canEdit = isManager() || matchesUser(name);
      const actions = canEdit ? `<div class="flex justify-end gap-1">
        <button onclick="event.stopPropagation();openAddFor('${escapeAttr(name)}')" class="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-xs rounded-lg" title="Добавить"><i class="fa-solid fa-plus"></i></button>
        ${isManager() ? `<button onclick="event.stopPropagation();deleteEmployee('${escapeAttr(name)}')" class="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-xs rounded-lg" title="Удалить"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>` : '';
      return `<tr class="hover:bg-slate-50 cursor-pointer ${bal < 0 ? 'bg-rose-50/40' : ''}" onclick="openEmpRecords('${escapeAttr(name)}')">
        <td class="py-3 px-3 font-medium">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${avatarClass(name)}">${getInitials(name)}</div>
            <span onclick="event.stopPropagation();openAnalytics('${escapeAttr(name)}')" class="cursor-pointer hover:text-indigo-600 hover:underline">${escapeHtml(name)}</span>
          </div>
        </td>
        <td class="py-3 px-3 text-slate-700">${m.init} ч</td>
        <td class="py-3 px-3 text-emerald-600 font-semibold">+${m.ot} ч</td>
        <td class="py-3 px-3 text-rose-600 font-semibold">−${m.to} ч</td>
        <td class="py-3 px-3">${badge}</td>
        <td class="py-3 px-3">${actions}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function renderRecords() {
  const d = ensureTimeoffData();
  const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const mf = document.getElementById('monthFilter').value;
  let list = (d.records || []).filter(r => {
    if (!filterVisible(r.employeeName)) return false;
    if (q && !(r.employeeName + ' ' + (r.reason||'')).toLowerCase().includes(q)) return false;
    if (mf && !(r.date || '').startsWith(mf)) return false;
    return true;
  }).sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  const container = document.getElementById('recordsView');
  if (!list.length) {
    container.innerHTML = '<div class="py-12 text-center text-slate-400 text-sm">Нет записей</div>';
    return;
  }
  container.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-left text-sm">
    <thead><tr class="border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase">
      <th class="py-3 px-3">Тип</th><th class="py-3 px-3">Сотрудник</th><th class="py-3 px-3">Дата</th>
      <th class="py-3 px-3">Часы</th><th class="py-3 px-3">Причина</th><th class="py-3 px-3">PDF</th><th class="py-3 px-3"></th>
    </tr></thead><tbody class="divide-y divide-slate-100">${list.map(r => {
      const isOt = r.type === 'overtime';
      const canEdit = isManager() || matchesUser(r.employeeName);
      const pdf = r.pdfFile ? `<button onclick="previewPdf('${r.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs rounded-lg"><i class="fa-solid fa-file-pdf mr-1"></i>${escapeHtml(r.pdfName||'PDF')}</button>` : '<span class="text-xs text-slate-400 italic">Нет</span>';
      const act = canEdit ? `<div class="flex justify-end gap-1"><button onclick="editRecord('${r.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"><i class="fa-solid fa-pen text-xs"></i></button><button onclick="deleteRecord('${r.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"><i class="fa-solid fa-trash text-xs"></i></button></div>` : '';
      return `<tr class="hover:bg-slate-50">
        <td class="py-3 px-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${isOt?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${isOt?'🟢 Переработка':'🔴 Отгул'}</span></td>
        <td class="py-3 px-3 font-medium">${escapeHtml(r.employeeName)}</td>
        <td class="py-3 px-3 text-slate-600">${formatDateRu(r.date)}</td>
        <td class="py-3 px-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${isOt?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${isOt?'+':'−'}${r.hours} ч</span></td>
        <td class="py-3 px-3 text-slate-600">${escapeHtml(r.reason||'—')}</td>
        <td class="py-3 px-3">${pdf}</td>
        <td class="py-3 px-3">${act}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function renderTrash() {
  const d = ensureTimeoffData();
  const items = d.trash || [];
  document.getElementById('trashCount').textContent = items.length;
  const c = document.getElementById('trashView');
  if (!items.length) { c.innerHTML = '<div class="py-12 text-center text-slate-400 text-sm">Корзина пуста</div>'; return; }
  c.innerHTML = items.map(t => {
    const r = t.original;
    return `<div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2">
      <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">${r.type === 'overtime' ? '+' : '−'}</div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold">${escapeHtml(r.employeeName)} <span class="text-xs font-normal text-slate-500">(${r.hours} ч, ${formatDateRu(r.date)})</span></div>
        <div class="text-[11px] text-slate-500">Удалил: ${escapeHtml(t.deletedBy)}</div>
      </div>
      <button onclick="restoreTrash('${t.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg">Вернуть</button>
    </div>`;
  }).join('');
}

/* ============== ФИЛЬТР ============== */
function applyFilters() { renderBalance(); renderRecords(); }

/* ============== МОДАЛКИ ============== */
let currentUpload = null;

function openModal(type) {
  if (!Object.keys(ensureTimeoffData().initialBalances || {}).length) {
    toast('Сначала добавьте сотрудника', 'error');
    if (isManager()) openInitialBalanceModal();
    return;
  }
  currentUpload = {name: null, file: null};
  document.getElementById('recordModal').classList.remove('hidden');
  document.getElementById('recordModal').classList.add('flex');
  document.getElementById('modalTitle').textContent = type === 'overtime' ? 'Добавить переработку' : 'Добавить отгул';
  document.getElementById('recordId').value = '';
  document.getElementById('recordType').value = type;
  document.getElementById('recordDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('recordReason').value = '';
  document.getElementById('fileNameDisplay').textContent = 'Нажмите для выбора PDF';
  document.getElementById('pdfFile').value = '';
  fillEmployeeSelect();
  if (!isManager()) {
    const sel = document.getElementById('employeeName');
    sel.value = state.user.name;
    sel.disabled = true;
    document.getElementById('employeeLockedHint').classList.remove('hidden');
  } else {
    document.getElementById('employeeName').disabled = false;
    document.getElementById('employeeLockedHint').classList.add('hidden');
  }
}
function openAddFor(name) {
  openModal('overtime');
  if (isManager()) document.getElementById('employeeName').value = name;
}
function fillEmployeeSelect() {
  const sel = document.getElementById('employeeName');
  sel.innerHTML = '';
  Object.keys(ensureTimeoffData().initialBalances || {}).sort().forEach(n => {
    const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o);
  });
}
function closeModal() {
  document.getElementById('recordModal').classList.add('hidden');
  document.getElementById('recordModal').classList.remove('flex');
}

function openInitialBalanceModal() {
  if (!isManager()) return;
  document.getElementById('initialBalanceModal').classList.remove('hidden');
  document.getElementById('initialBalanceModal').classList.add('flex');
  document.getElementById('initEmployeeName').value = '';
  document.getElementById('initHours').value = 0;
  document.getElementById('initCutoffDate').value = '2026-09-01';
}
function closeInitialBalanceModal() {
  document.getElementById('initialBalanceModal').classList.add('hidden');
  document.getElementById('initialBalanceModal').classList.remove('flex');
}

async function saveInitialBalance(e) {
  e.preventDefault();
  if (!isManager()) return;
  const d = ensureTimeoffData();
  const name = document.getElementById('initEmployeeName').value.trim();
  const hours = parseFloat(document.getElementById('initHours').value);
  const date = document.getElementById('initCutoffDate').value;
  if (!name || isNaN(hours)) return;
  d.initialBalances[name] = {hours, date};
  await saveToServer();
  closeInitialBalanceModal();
  renderTimeoff();
  toast('Сохранено');
}

async function saveRecord(e) {
  e.preventDefault();
  const d = ensureTimeoffData();
  const id = document.getElementById('recordId').value;
  const targetName = isManager() ? document.getElementById('employeeName').value : state.user.name;
  const rec = {
    id: id || Date.now().toString(),
    type: document.getElementById('recordType').value,
    employeeName: targetName,
    date: document.getElementById('recordDate').value,
    hours: parseFloat(document.getElementById('recordHours').value),
    reason: document.getElementById('recordReason').value.trim(),
    pdfName: currentUpload && currentUpload.name,
    pdfFile: currentUpload && currentUpload.file
  };
  if (id) {
    const i = d.records.findIndex(x => x.id === id);
    if (i !== -1) d.records[i] = rec;
  } else {
    d.records.push(rec);
  }
  await saveToServer();
  closeModal();
  renderTimeoff();
  toast('Сохранено');
}

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') { toast('Только PDF', 'error'); return; }
  if (file.size > 20 * 1024 * 1024) { toast('Файл > 20 МБ', 'error'); return; }
  document.getElementById('fileNameDisplay').textContent = 'Загрузка…';
  const res = await API.upload(file);
  if (!res.ok) { toast('Ошибка загрузки', 'error'); return; }
  currentUpload = {name: res.name, file: res.file};
  document.getElementById('fileNameDisplay').textContent = res.name;
}

function editRecord(id) {
  const d = ensureTimeoffData();
  const r = d.records.find(x => x.id === id);
  if (!r) return;
  if (!isManager() && !matchesUser(r.employeeName)) return;
  openModal(r.type);
  document.getElementById('modalTitle').textContent = 'Редактировать';
  document.getElementById('recordId').value = r.id;
  document.getElementById('recordType').value = r.type;
  document.getElementById('recordDate').value = r.date;
  document.getElementById('recordHours').value = r.hours;
  document.getElementById('recordReason').value = r.reason || '';
  document.getElementById('employeeName').value = r.employeeName;
  currentUpload = {name: r.pdfName, file: r.pdfFile};
  if (r.pdfName) document.getElementById('fileNameDisplay').textContent = r.pdfName;
}

async function deleteRecord(id) {
  const d = ensureTimeoffData();
  const r = d.records.find(x => x.id === id);
  if (!r) return;
  if (!isManager() && !matchesUser(r.employeeName)) return;
  if (!confirm('В корзину?')) return;
  d.trash.unshift({id: Date.now().toString(), deletedAt: Date.now(), deletedBy: state.user ? state.user.name : '—', original: r});
  d.records = d.records.filter(x => x.id !== id);
  await saveToServer();
  renderTimeoff();
  toast('В корзине');
}

async function restoreTrash(tid) {
  const d = ensureTimeoffData();
  const i = d.trash.findIndex(t => t.id === tid);
  if (i === -1) return;
  d.records.push(d.trash[i].original);
  d.trash.splice(i, 1);
  await saveToServer();
  renderTimeoff();
}

async function deleteEmployee(name) {
  if (!isManager()) return;
  const d = ensureTimeoffData();
  const recs = d.records.filter(r => r.employeeName === name);
  if (!confirm(`Удалить «${name}»? ${recs.length} записей уйдёт в корзину.`)) return;
  recs.forEach(r => d.trash.unshift({id: Date.now().toString() + Math.random(), deletedAt: Date.now(), deletedBy: state.user.name, original: r}));
  d.records = d.records.filter(r => r.employeeName !== name);
  delete d.initialBalances[name];
  await saveToServer();
  renderTimeoff();
}

function previewPdf(id) {
  const d = ensureTimeoffData();
  const r = d.records.find(x => x.id === id);
  if (!r || !r.pdfFile) return;
  document.getElementById('pdfModal').classList.remove('hidden');
  document.getElementById('pdfModal').classList.add('flex');
  document.getElementById('pdfModalTitle').textContent = `${r.employeeName} — ${formatDateRu(r.date)}`;
  const url = '/uploads/' + r.pdfFile;
  document.getElementById('pdfViewerFrame').src = url;
  const dl = document.getElementById('downloadPdfBtn');
  dl.href = url; dl.download = r.pdfName || 'doc.pdf';
}
function closePdfModal() {
  document.getElementById('pdfModal').classList.add('hidden');
  document.getElementById('pdfModal').classList.remove('flex');
  document.getElementById('pdfViewerFrame').src = '';
}

/* ============== ЗАПИСИ СОТРУДНИКА ============== */
function openEmpRecords(name) {
  timeoffState.empName = name;
  timeoffState.empFilter = 'all';
  document.getElementById('erAvatar').textContent = getInitials(name);
  document.getElementById('erAvatar').className = 'w-11 h-11 rounded-full text-sm font-bold flex items-center justify-center ' + avatarClass(name);
  document.getElementById('erName').textContent = name;
  document.getElementById('empRecordsModal').classList.remove('hidden');
  document.getElementById('empRecordsModal').classList.add('flex');
  renderEmpRecords();
}
function closeEmpRecords() {
  document.getElementById('empRecordsModal').classList.add('hidden');
  document.getElementById('empRecordsModal').classList.remove('flex');
}
function setErFilter(f) {
  timeoffState.empFilter = f;
  ['erTabAll','erTabOt','erTabTo'].forEach(id => {
    document.getElementById(id).className = 'px-3 py-1.5 rounded-md text-xs font-semibold ' +
      ((id === 'erTabAll' && f === 'all') || (id === 'erTabOt' && f === 'overtime') || (id === 'erTabTo' && f === 'timeoff')
        ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600');
  });
  renderEmpRecords();
}
function renderEmpRecords() {
  const name = timeoffState.empName;
  if (!name) return;
  const d = ensureTimeoffData();
  const init = (d.initialBalances[name] || {}).hours || 0;
  let list = (d.records || []).filter(r => r.employeeName === name);
  const ot = list.filter(r => r.type === 'overtime').reduce((s,r) => s + r.hours, 0);
  const to = list.filter(r => r.type === 'timeoff').reduce((s,r) => s + r.hours, 0);
  document.getElementById('erStatInit').textContent = init + ' ч';
  document.getElementById('erStatOt').textContent = '+' + ot + ' ч';
  document.getElementById('erStatTo').textContent = '−' + to + ' ч';
  const balEl = document.getElementById('erStatBal');
  balEl.textContent = (init + ot - to) + ' ч';
  balEl.className = 'text-base font-bold mt-0.5 ' + ((init + ot - to) >= 0 ? 'text-indigo-700' : 'text-rose-700');

  if (timeoffState.empFilter !== 'all') list = list.filter(r => r.type === timeoffState.empFilter);
  list.sort((a,b) => (b.date||'').localeCompare(a.date||''));

  document.getElementById('erCount').textContent = 'Записей: ' + list.length;
  const c = document.getElementById('erList');
  if (!list.length) {
    c.innerHTML = '';
    document.getElementById('erEmpty').classList.remove('hidden');
    return;
  }
  document.getElementById('erEmpty').classList.add('hidden');
  c.innerHTML = list.map(r => {
    const isOt = r.type === 'overtime';
    const canEdit = isManager() || matchesUser(r.employeeName);
    const pdfBlock = r.pdfFile
      ? `<button onclick="previewPdf('${r.id}')" class="inline-flex items-center px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-medium rounded-lg border border-rose-200"><i class="fa-solid fa-file-pdf mr-1.5"></i>${escapeHtml(r.pdfName||'PDF')}</button>`
      : `<span class="text-[11px] text-slate-400 italic"><i class="fa-solid fa-paperclip mr-1 opacity-50"></i>без файла</span>`;
    const actions = canEdit ? `<div class="flex gap-1">
      <button onclick="editRecord('${r.id}');closeEmpRecords();" class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"><i class="fa-solid fa-pen text-xs"></i></button>
      <button onclick="deleteRecord('${r.id}');renderEmpRecords();" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"><i class="fa-solid fa-trash text-xs"></i></button>
    </div>` : '';
    return `<div class="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
      <div class="w-10 h-10 rounded-xl ${isOt ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} flex items-center justify-center flex-shrink-0">
        <i class="fa-solid ${isOt ? 'fa-clock-rotate-left' : 'fa-person-walking-dashed-line-arrow-right'}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-bold uppercase ${isOt ? 'text-emerald-700' : 'text-rose-700'}">${isOt ? 'Переработка' : 'Отгул'}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isOt ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${isOt ? '+' : '−'}${r.hours} ч</span>
          <span class="text-[11px] text-slate-500">${formatDateRu(r.date)}</span>
        </div>
        ${r.reason ? `<div class="text-xs text-slate-600 mt-1.5 italic">«${escapeHtml(r.reason)}»</div>` : ''}
        <div class="mt-2 flex items-center justify-between gap-2 flex-wrap">${pdfBlock}${actions}</div>
      </div>
    </div>`;
  }).join('');
}

/* ============== АНАЛИТИКА ============== */
function openAnalytics(name) {
  toast('Аналитика для ' + name + ' — в разработке');
}

/* ============== СТАРТ ============== */
document.addEventListener('DOMContentLoaded', () => {
  if (state.data) renderTimeoff();
  else setTimeout(() => { if (state.data) renderTimeoff(); }, 500);
});