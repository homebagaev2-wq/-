/* ============================================================
   ОБУЧЕНИЕ
   ============================================================ */

/* ---------- СПИСОК БЛОКОВ ---------- */
function renderLearningBlocks() {
  const grid = document.getElementById('blocksGrid');
  const empty = document.getElementById('blocksEmpty');
  if (!grid || !state.data) return;

  const blocks = (state.data.learning && state.data.learning.blocks) || [];
  if (!blocks.length) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  grid.innerHTML = blocks.map(b => {
    const color = b.color || 'sky';
    const colorHex = { sky: '#0284c7', indigo: '#4f46e5', emerald: '#059669', amber: '#d97706', violet: '#9333ea', rose: '#e11d48' }[color] || '#0284c7';
    const light = colorHex + '18';
    return `
      <a href="/learning/block/${b.id}" class="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 block">
        <div class="flex items-start gap-3.5 mb-3">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform" style="background:${light};color:${colorHex}">
            <i class="fa-solid ${b.icon || 'fa-book'} text-lg"></i>
          </div>
                    <div class="min-w-0 flex-1">
            <div class="font-bold text-slate-900 text-sm leading-tight flex items-start justify-between gap-2">
              <span class="flex-1 min-w-0">${escapeHtml(b.title)}</span>
              ${isManager() ? `<button onclick="event.preventDefault();event.stopPropagation();renameBlock('${b.id}')" class="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center" title="Переименовать"><i class="fa-solid fa-pen text-[10px]"></i></button>` : ''}
            </div>
            <div class="text-[11px] text-slate-500 mt-1">${b.lessons.length} ${plural(b.lessons.length, 'материал', 'материала', 'материалов')}</div>
          </div>
        </div>
        <p class="text-xs text-slate-500 line-clamp-2 leading-snug">${escapeHtml(b.desc || '')}</p>
        <div class="mt-3 flex items-center text-xs font-semibold" style="color:${colorHex}">
          Начать <i class="fa-solid fa-arrow-right ml-1.5 transition-transform group-hover:translate-x-1"></i>
        </div>
      </a>
    `;
  }).join('');
}

function plural(n, one, few, many) {
  const m = n % 100;
  if (m >= 11 && m <= 14) return many;
  const d = n % 10;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}
/* ---------- ПЕРЕИМЕНОВАНИЕ БЛОКОВ И УРОКОВ ---------- */
async function saveLearningToServer() {
  if (window.saveToServer) { await saveToServer(); return true; }
  // Фолбэк: сохраняем всё состояние напрямую
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: state.data })
    }).then(r => r.json());
    return !!res.ok;
  } catch (e) {
    return false;
  }
}

async function renameBlock(bid) {
  if (!isManager()) { toast('Только руководитель может переименовывать', 'error'); return; }
  const blocks = (state.data.learning && state.data.learning.blocks) || [];
  const block = blocks.find(b => b.id === bid);
  if (!block) return;
  const newTitle = prompt('Новое название блока:', block.title);
  if (!newTitle || !newTitle.trim()) return;
  block.title = newTitle.trim();
  const newDesc = prompt('Описание блока:', block.desc || '');
  if (newDesc !== null) block.desc = newDesc.trim();
  const ok = await saveLearningToServer();
  if (!ok) { toast('Ошибка сохранения', 'error'); return; }
  toast('Блок обновлён');
  renderLearningBlocks();
}

async function renameLesson(bid, lid) {
  if (!isManager()) { toast('Только руководитель может переименовывать', 'error'); return; }
  const blocks = (state.data.learning && state.data.learning.blocks) || [];
  const block = blocks.find(b => b.id === bid);
  if (!block) return;
  const lesson = (block.lessons || []).find(l => l.id === lid);
  if (!lesson) return;
  const newTitle = prompt('Новое название урока:', lesson.title);
  if (!newTitle || !newTitle.trim()) return;
  lesson.title = newTitle.trim();
  const ok = await saveLearningToServer();
  if (!ok) { toast('Ошибка сохранения', 'error'); return; }
  toast('Урок обновлён');
  if (window.renderLearningBlocks) renderLearningBlocks();
  else location.reload();
}

/* ---------- РЕДАКТИРОВАНИЕ УРОКА ---------- */
function openEditLesson() {
  if (!isManager()) { toast('Только руководитель может редактировать', 'error'); return; }
  const raw = document.getElementById('lessonContentRaw');
  if (!raw) return;
  document.getElementById('lessonEditor').value = raw.value;
  document.getElementById('editLessonModal').classList.remove('hidden');
  document.getElementById('editLessonModal').classList.add('flex');
  setTimeout(() => document.getElementById('lessonEditor').focus(), 100);
}

function closeEditLesson() {
  document.getElementById('editLessonModal').classList.add('hidden');
  document.getElementById('editLessonModal').classList.remove('flex');
}

async function saveLessonContent() {
  const content = document.getElementById('lessonEditor').value;
  const path = window.location.pathname; // /learning/lesson/<bid>/<lid>
  const parts = path.split('/');
  const bid = parts[3];
  const lid = parts[4];

  if (!bid || !lid) { toast('Не удалось определить урок', 'error'); return; }

  try {
    const res = await fetch(`/api/learning/lesson/${bid}/${lid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const j = await res.json();
    if (j.ok) {
      document.getElementById('lessonContent').innerHTML = content;
      document.getElementById('lessonContentRaw').value = content;
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise().catch(e => console.warn(e));
      }
      closeEditLesson();
      toast('Сохранено');
    } else {
      toast('Ошибка: ' + (j.error || 'не удалось'), 'error');
    }
  } catch (e) {
    toast('Ошибка сети', 'error');
  }
}

/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('blocksGrid');
  if (grid) {
    if (state.data) renderLearningBlocks();
    else setTimeout(() => { if (state.data) renderLearningBlocks(); }, 500);
  }

  const modal = document.getElementById('editLessonModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'editLessonModal') closeEditLesson();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('editLessonModal') && !document.getElementById('editLessonModal').classList.contains('hidden')) {
      closeEditLesson();
    }
  });
});