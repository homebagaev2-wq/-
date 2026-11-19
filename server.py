# -*- coding: utf-8 -*-
import json, os, time, uuid
from io import BytesIO

from flask import Flask, request, jsonify, render_template, send_from_directory, abort, redirect, send_file
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

# Импорт данных реестра проверок из отдельного файла
from checks_data import DEFAULT_CHECKS

# Импорт автобэкапа
from data_backup import make_backup

# Импорт уроков обучения
from learning_content import (
    LESSON_GVS_1, LESSON_GVS_2,
    LESSON_IPB_1, LESSON_IPB_2,
    LESSON_SRC_1, LESSON_SRC_2,
    LESSON_OBJ_1, LESSON_OBJ_2,
    LESSON_PU_1, LESSON_PU_2,
    LESSON_PLAN_1, LESSON_PLAN_2,
    LESSON_PREBIL_1,
    LESSON_ODPU_1,
    LESSON_VED_1,
    LESSON_OCR_1
)

app = Flask(__name__, static_folder='static', template_folder='templates')
BASE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE, 'data.json')
UPLOADS = os.path.join(BASE, 'uploads')
BACKUPS_DIR = os.path.join(BASE, 'data.json.backups')
MAX_SIZE = 20 * 1024 * 1024

MANAGER_PASSWORD = '1405'

os.makedirs(UPLOADS, exist_ok=True)
os.makedirs(BACKUPS_DIR, exist_ok=True)


# ============================================================
# ОБУЧЕНИЕ (DEFAULT_LEARNING)
# ============================================================
DEFAULT_LEARNING = {
    "blocks": [
        {
            "id": "gvs",
            "title": "Некачественная поставка ГВС",
            "desc": "Нормативная база, механизм снижения платы по ПП РФ 354 и работа с отчётом АИИС",
            "icon": "fa-droplet",
            "color": "sky",
            "lessons": [
                {"id": "gvs-1", "num": "Урок", "title": "Расчёт снижения платы за некачественную поставку ГВС", "content": LESSON_GVS_1},
                {"id": "gvs-2", "num": "Памятка", "title": "Формирование выгрузки из АИИС и анализ отчёта", "content": LESSON_GVS_2},
            ]
        },
        {
            "id": "ipb",
            "title": "Формирование СЗ и выгрузок по ИПБ",
            "desc": "Три перечня ПУ для ОКУ по результатам интервального предбиллинга и шаблон служебной записки",
            "icon": "fa-file-invoice",
            "color": "emerald",
            "lessons": [
                {"id": "ipb-1", "num": "Памятка", "title": "Формирование перечней ПУ для ОКУ", "content": LESSON_IPB_1},
                {"id": "ipb-2", "num": "Шаблон", "title": "Служебная записка с приложениями", "content": LESSON_IPB_2},
            ]
        },
        {
            "id": "src",
            "title": "Работа со сторонними источниками",
            "desc": "Формирование объёмов по источникам, проверка достоверности, согласование с поставщиками",
            "icon": "fa-plug",
            "color": "amber",
            "lessons": [
                {"id": "src-1", "num": "Памятка", "title": "Расчёт объёмов по источникам и согласование", "content": LESSON_SRC_1},
                {"id": "src-2", "num": "Шаблон", "title": "Сводная таблица и письмо поставщику", "content": LESSON_SRC_2},
            ]
        },
        {
            "id": "objects",
            "title": "Сверка объектов 1С ↔ АИИС",
            "desc": "Интеграция объектов, работа в Qlik, поиск и устранение расхождений",
            "icon": "fa-object-group",
            "color": "teal",
            "lessons": [
                {"id": "obj-1", "num": "Урок", "title": "Интеграция объектов и работа в Qlik", "content": LESSON_OBJ_1},
                {"id": "obj-2", "num": "Памятка", "title": "Пошаговая инструкция по сверке объектов", "content": LESSON_OBJ_2},
            ]
        },
        {
            "id": "pu",
            "title": "Сверка приборов учёта (ПУ)",
            "desc": "Ежемесячная сверка ПУ между Модулем предбиллинга и 1С",
            "icon": "fa-gauge-high",
            "color": "violet",
            "lessons": [
                {"id": "pu-1", "num": "Урок", "title": "Ежемесячная сверка ПУ и работа с формой сопоставления", "content": LESSON_PU_1},
                {"id": "pu-2", "num": "Памятка", "title": "Пошаговая инструкция по сверке ПУ", "content": LESSON_PU_2},
            ]
        },
        {
            "id": "plan",
            "title": "План-график и информирование",
            "desc": "Составление план-графика предбиллинга и информирование потребителей",
            "icon": "fa-calendar-days",
            "color": "rose",
            "lessons": [
                {"id": "plan-1", "num": "Памятка", "title": "Составление и согласование план-графика", "content": LESSON_PLAN_1},
                {"id": "plan-2", "num": "Памятка", "title": "Информирование потребителей через СЭДД", "content": LESSON_PLAN_2},
            ]
        },
        {
            "id": "prebil",
            "title": "Проведение предбиллинга",
            "desc": "Полный порядок: от расчёта в МП до выгрузки итоговых показаний в клиентский сервис",
            "icon": "fa-calculator",
            "color": "indigo",
            "lessons": [
                {"id": "prebil-1", "num": "Памятка", "title": "Проведение предбиллинга: МП, ручной ввод, СЗ, выгрузка", "content": LESSON_PREBIL_1},
            ]
        },
        {
            "id": "odpu",
            "title": "Согласование показаний ОДПУ",
            "desc": "Проверка столбцов, гиперссылки, согласование актов, цветовая заливка",
            "icon": "fa-check-double",
            "color": "orange",
            "lessons": [
                {"id": "odpu-1", "num": "Инструкция", "title": "Согласование показаний ОДПУ (шаги 1–3)", "content": LESSON_ODPU_1},
            ]
        },
        {
            "id": "ved",
            "title": "Предоставление ведомостей с ПУ",
            "desc": "По запросу через почту или СЭДД: выгрузка через ПО «Выгрузка подробных отчётов»",
            "icon": "fa-file-export",
            "color": "cyan",
            "lessons": [
                {"id": "ved-1", "num": "Памятка", "title": "Предоставление ведомостей с ПУ по запросу", "content": LESSON_VED_1},
            ]
        },
        {
            "id": "ocr",
            "title": "Анализ распознавания ведомостей OCR",
            "desc": "Ручные ведомости через ТП Элдис: загрузка, сверка, свод расхождений",
            "icon": "fa-eye",
            "color": "slate",
            "lessons": [
                {"id": "ocr-1", "num": "Памятка", "title": "Проверка распознавания ручных ведомостей", "content": LESSON_OCR_1},
            ]
        },
    ]
}


# ============================================================
# ЧЕК-ЛИСТ (DEFAULT_CHECKLIST)
# ============================================================
_DAY = lambda y, m, d: f"{y}-{m:02d}-{d:02d}"

def _make_checklist_tasks():
    """Общая структура для трёх филиалов, план — ноябрь 2026."""
    return [
        {"id": "t1", "num": "1", "title": "Формирование выгрузки «Некачественной поставки ГВС ПП 354 РФ» в рамках беззаявительного перерасчёта", "day": 5, "isNext": False, "children": []},
        {"id": "t2", "num": "2", "title": "Формирование перечня сущностей имеющих незаполненные или неактуальные параметры в АИИС", "day": 23, "isNext": False, "children": [
            {"id": "t2_1", "num": "2.1", "title": "Формирование перечня сущностей для ОКУ/ТИ/Продаж", "day": 9, "isNext": False},
            {"id": "t2_2", "num": "2.2", "title": "Кодирование информации в АИИС по результатам отработки", "day": 13, "isNext": False},
            {"id": "t2_3", "num": "2.3", "title": "Формирование выгрузки для ОКУ/ТИ/Продаж", "day": 23, "isNext": False},
            {"id": "t2_4", "num": "2.4", "title": "Кодирование информации в АИИС по результатам отработки", "day": 27, "isNext": False},
        ]},
        {"id": "t3", "num": "3", "title": "Проведение интервального предбиллинга", "day": 23, "isNext": False, "children": [
            {"id": "t3_1", "num": "3.1", "title": "Проведение 1-го интервального расчёта", "day": 10, "isNext": False},
            {"id": "t3_2", "num": "3.2", "title": "Формирование СЗ по результатам 1 ИПБ для отдела ком. учёта", "day": 10, "isNext": False},
            {"id": "t3_3", "num": "3.3", "title": "Проведение 2-го интервального расчёта", "day": 16, "isNext": False},
            {"id": "t3_4", "num": "3.4", "title": "Формирование СЗ по результатам 2 ИПБ для отдела ком. учёта", "day": 16, "isNext": False},
            {"id": "t3_5", "num": "3.5", "title": "Проведение 3-го интервального расчёта", "day": 23, "isNext": False},
            {"id": "t3_6", "num": "3.6", "title": "Формирование СЗ по результатам 3 ИПБ для отдела ком. учёта", "day": 23, "isNext": False},
        ]},
        {"id": "t4", "num": "4", "title": "Составление и согласование План графика на отчётный период", "day": 16, "isNext": False, "children": []},
        {"id": "t5", "num": "5", "title": "Информирование потребителей о сроках предбиллинга", "day": 17, "isNext": False, "children": []},
        {"id": "t6", "num": "6", "title": "Сверка/сопоставление приборов учёта и объектов АИИС и 1С ЭБ", "day": 20, "isNext": False, "children": [
            {"id": "t6_1", "num": "6.1", "title": "Сверка/сопоставление приборов учёта АИИС и 1С ЭБ", "day": 20, "isNext": False},
            {"id": "t6_2", "num": "6.2", "title": "Сверка/сопоставление объектов АИИС и 1С ЭБ", "day": 20, "isNext": False},
        ]},
        {"id": "t7", "num": "7", "title": "Проведение предбиллинга", "day": 5, "isNext": True, "children": [
            {"id": "t7_1", "num": "7.1", "title": "Сохранение ручных ведомостей и автоматических на сетевом ресурсе", "day": 5, "isNext": True},
            {"id": "t7_2", "num": "7.2", "title": "Формирование СЗ по результатам предбиллинга для отдела ком. учёта", "day": 5, "isNext": True},
            {"id": "t7_3", "num": "7.3", "title": "Выгрузка итоговых показаний для клиентского сервиса", "day": 26, "isNext": True},
        ]},
        {"id": "t8", "num": "8", "title": "Проведение предбиллинга источников", "day": 5, "isNext": True, "children": []},
        {"id": "t9", "num": "9", "title": "Анализ расхождений Сверки ПО (по запросу)", "day": 30, "isNext": False, "children": []},
        {"id": "t10", "num": "10", "title": "Предоставление ведомостей с ПУ (по запросу)", "day": 30, "isNext": False, "children": []},
        {"id": "t11", "num": "11", "title": "Проведение анализа распознавания ведомостей OCR (по запросу)", "day": 1, "isNext": False, "children": []},
    ]


DEFAULT_CHECKLIST = {
    "structure": {
        "kirov": {"name": "Кировский филиал", "icon": "fa-building", "color": "#4f46e5", "tasks": _make_checklist_tasks()},
        "penza": {"name": "Пензенский филиал", "icon": "fa-building", "color": "#059669", "tasks": _make_checklist_tasks()},
        "mordovia": {"name": "Мордовский филиал", "icon": "fa-building", "color": "#9333ea", "tasks": _make_checklist_tasks()},
    },
    "data": {
        # Реальные отметки на ноябрь 2026 (только для Кирова, если нужно — продублируем)
        "2026-11_kirov": {
            "t1": {"fact": "2026-11-05"},
            "t3_1": {"fact": "2026-11-10"},
            "t3_2": {"fact": "2026-11-10"},
        },
    }
}


# ============================================================
# ОБЩИЕ ДАННЫЕ
# ============================================================
DEFAULT = {
    "employees": {},
    "timeoff": {"initialBalances": {}, "records": [], "history": [], "trash": []},
    "checks": DEFAULT_CHECKS,
    "pages": [
        {"id": "learning", "title": "Обучение", "icon": "fa-graduation-cap", "color": "sky",
         "content": "<h2>Раздел переехал</h2><p>Откройте меню «Обучение».</p>",
         "createdAt": 0, "canDelete": False}
    ],
    "learning": DEFAULT_LEARNING,
    "checklist": DEFAULT_CHECKLIST,
    "version": int(time.time() * 1000),
    "_checks_version": "2026-11-11",
    "_learning_version": "2026-11-11",
    "_checklist_version": "2026-11-11",
}


def load():
    if not os.path.exists(DATA_FILE):
        save(DEFAULT)
        return json.loads(json.dumps(DEFAULT))
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            d = json.load(f)

        # МИГРАЦИИ ОТКЛЮЧЕНЫ, чтобы не перезаписывать данные пользователя.
        # Если понадобится принудительное обновление — раскомментируйте блок ниже
        # и запустите сервер ОДИН раз, затем снова закомментируйте.
        #
        # need_save = False
        #
        # if d.get('_checks_version') != '2026-11-11':
        #     d['checks'] = json.loads(json.dumps(DEFAULT_CHECKS))
        #     d['_checks_version'] = '2026-11-11'
        #     need_save = True
        #     print('⚠ Обновлены данные Проверок')
        #
        # if d.get('_learning_version') != '2026-11-11':
        #     d['learning'] = json.loads(json.dumps(DEFAULT_LEARNING))
        #     d['_learning_version'] = '2026-11-11'
        #     need_save = True
        #     print('⚠ Обновлены данные Обучения')
        #
        # if d.get('_checklist_version') != '2026-11-11':
        #     d['checklist'] = json.loads(json.dumps(DEFAULT_CHECKLIST))
        #     d['_checklist_version'] = '2026-11-11'
        #     need_save = True
        #     print('⚠ Обновлены данные Чек-листа')
        #
        # if need_save:
        #     save(d)

        return d
    except Exception as e:
        print('Ошибка чтения data.json:', e)
        return json.loads(json.dumps(DEFAULT))


def save(d):
    d['version'] = int(time.time() * 1000)
    tmp = DATA_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_FILE)
    return d['version']
# ============================================================
# РОУТЫ СТРАНИЦ
# ============================================================
@app.route('/')
def index():
    return render_template('checklist.html')

@app.route('/timeoff')
def timeoff():
    return render_template('timeoff.html')

@app.route('/checks')
def checks():
    return render_template('checks.html')

@app.route('/checklist')
def checklist():
    return render_template('checklist.html')

@app.route('/learning')
def learning_list():
    return render_template('learning_list.html')

@app.route('/learning/block/<bid>')
def learning_block(bid):
    d = load()
    blocks = d.get('learning', {}).get('blocks', [])
    block = next((b for b in blocks if b['id'] == bid), None)
    if not block:
        abort(404)
    return render_template('learning_block.html', block=block)

@app.route('/learning/lesson/<bid>/<lid>')
def learning_lesson(bid, lid):
    d = load()
    blocks = d.get('learning', {}).get('blocks', [])
    block = next((b for b in blocks if b['id'] == bid), None)
    if not block:
        abort(404)
    lesson = next((l for l in block['lessons'] if l['id'] == lid), None)
    if not lesson:
        abort(404)
    return render_template('learning_lesson.html', block=block, lesson=lesson)

@app.route('/pages')
def pages_list():
    return render_template('pages_list.html')

@app.route('/page/<pid>')
def page_view(pid):
    d = load()
    page = next((p for p in d['pages'] if p['id'] == pid), None)
    if not page:
        abort(404)
    return render_template('page.html', page=page)

@app.route('/page/learning')
def page_learning_redirect():
    return redirect('/learning')

# ============================================================
# ПРИКАЗЫ И РЕГЛАМЕНТЫ (PDF)
# ============================================================
@app.route('/orders')
def orders():
    return render_template('docs.html', section='orders', title='Приказы', icon='fa-file-invoice')

@app.route('/regulations')
def regulations():
    return render_template('docs.html', section='regulations', title='Регламенты', icon='fa-file-contract')

@app.route('/api/docs/<section>', methods=['GET'])
def api_docs_list(section):
    if section not in ('orders', 'regulations'):
        abort(404)
    d = load()
    return jsonify({'ok': True, 'items': d.get(section, [])})

@app.route('/api/docs/<section>', methods=['POST'])
def api_docs_add(section):
    if section not in ('orders', 'regulations'):
        abort(404)
    p = request.get_json(silent=True) or {}
    title = (p.get('title') or '').strip()
    file = (p.get('file') or '').strip()
    date = (p.get('date') or '').strip()
    if not title or not file:
        return jsonify({'ok': False, 'error': 'title и file обязательны'}), 400
    d = load()
    if section not in d:
        d[section] = []
    item = {
        'id': uuid.uuid4().hex[:12],
        'title': title,
        'file': file,
        'date': date or time.strftime('%Y-%m-%d'),
        'createdAt': int(time.time() * 1000)
    }
    d[section].append(item)
    save(d)
    return jsonify({'ok': True, 'item': item})

@app.route('/api/docs/<section>/<item_id>', methods=['DELETE'])
def api_docs_delete(section, item_id):
    if section not in ('orders', 'regulations'):
        abort(404)
    d = load()
    items = d.get(section, [])
    before = len(items)
    d[section] = [x for x in items if x.get('id') != item_id]
    if len(d[section]) == before:
        return jsonify({'ok': False, 'error': 'not found'}), 404
    save(d)
    return jsonify({'ok': True})

# ============================================================
# API
# ============================================================
@app.route('/api/data', methods=['GET'])
def api_get():
    return jsonify({'ok': True, 'data': load()})

@app.route('/api/data', methods=['POST'])
def api_post():
    p = request.get_json(silent=True)
    if not p or 'data' not in p:
        return jsonify({'ok': False, 'error': 'no data'}), 400
    d = p['data']
    save(d)
    return jsonify({'ok': True, 'version': d['version']})

@app.route('/api/ping')
def api_ping():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return jsonify({'ok': True, 'version': json.load(f).get('version', 0)})
    except Exception:
        return jsonify({'ok': True, 'version': 0})

@app.route('/api/auth/manager', methods=['POST'])
def api_auth_manager():
    p = request.get_json(silent=True) or {}
    if p.get('password') == MANAGER_PASSWORD:
        return jsonify({'ok': True})
    return jsonify({'ok': False, 'error': 'wrong'}), 401

@app.route('/api/learning/lesson/<bid>/<lid>', methods=['POST'])
def api_learning_save(bid, lid):
    p = request.get_json(silent=True)
    if not p or 'content' not in p:
        return jsonify({'ok': False, 'error': 'no content'}), 400
    d = load()
    blocks = d.get('learning', {}).get('blocks', [])
    block = next((b for b in blocks if b['id'] == bid), None)
    if not block:
        return jsonify({'ok': False, 'error': 'block not found'}), 404
    lesson = next((l for l in block['lessons'] if l['id'] == lid), None)
    if not lesson:
        return jsonify({'ok': False, 'error': 'lesson not found'}), 404
    lesson['content'] = p['content']
    save(d)
    return jsonify({'ok': True})


@app.route('/api/backup/download')
def api_backup_download():
    """Скачивание data.json как резервной копии."""
    if not os.path.exists(DATA_FILE):
        abort(404)
    return send_from_directory(
        BASE, 'data.json', as_attachment=True,
        download_name=f'data-{time.strftime("%Y-%m-%d_%H-%M")}.json'
    )

@app.route('/api/me')
def api_me():
    return jsonify({'ok': True, 'user': None})

# ============================================================
# ФАЙЛЫ
# ============================================================
@app.route('/api/upload', methods=['POST'])
def api_upload():
    if 'file' not in request.files:
        return jsonify({'ok': False, 'error': 'no file'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'ok': False, 'error': 'empty'}), 400
    f.seek(0, os.SEEK_END)
    size = f.tell()
    f.seek(0)
    if size > MAX_SIZE:
        return jsonify({'ok': False, 'error': 'too large'}), 413
    ext = os.path.splitext(f.filename)[1].lower()
    name = uuid.uuid4().hex + ext
    f.save(os.path.join(UPLOADS, name))
    return jsonify({'ok': True, 'file': name, 'name': f.filename})

@app.route('/uploads/<path:fn>')
def up(fn):
    s = os.path.basename(fn)
    if not os.path.exists(os.path.join(UPLOADS, s)):
        abort(404)
    return send_from_directory(UPLOADS, s)


# ============================================================
# СТАРТ
# ============================================================
# ============================================================
# ПЛАН-ГРАФИК ПРЕДБИЛЛИНГА (по месяцам)
# ============================================================
PLAN_SCHEDULE_STRUCTURE = {
    "kirov": {
        "name": "Кировский филиал",
        "rows": [
            {"id": "p1", "sender": "Отдел ком.учёта", "receiver": "ОКиР", "to": "МКД", "title": "Информация о вновь допущенных и замененных приборах учета"},
            {"id": "p2", "sender": "Отдел ком.учёта", "receiver": "система АИИС", "to": "МКД", "title": "Актуализация в АИИС всех статусов УУ"},
            {"id": "p3", "sender": "ОКиР", "receiver": "1С", "to": "МКД", "title": "Актуализация информации по вновь допущенным и замененным ПУ"},
            {"id": "p4", "sender": "Тепловая инспекция", "receiver": "ОКиР", "to": "МКД", "title": "Заполненные шаблоны отключений в ОКиР"},
            {"id": "p5", "sender": "Отдел ком.учёта", "receiver": "АИИС и предбиллинг", "to": "МКД", "title": "Ручные ведомости приборов учета"},
            {"id": "p6", "sender": "АИИС и предбиллинг", "receiver": "Отдел ком.учёта", "to": "МКД", "title": "Перечень ТУ на согласование с признаком \"Не принятые к расчёту\""},
            {"id": "p7", "sender": "Отдел ком.учёта", "receiver": "АИИС и предбиллинг", "to": "МКД", "title": "Перечень ТУ на согласование с признаком \"Не принятые к расчёту\" - акцептованный"},
            {"id": "p8", "sender": "АИИС и предбиллинг", "receiver": "ОКиР", "to": "МКД", "title": "Передача информации по поломкам в ОКиР"},
            {"id": "p9", "sender": "АИИС и предбиллинг", "receiver": "ОКиР", "to": "МКД", "title": "Передача информации по показания в ОКиР"},
            {"id": "p10", "sender": "АИИС и предбиллинг", "receiver": "", "to": "МКД", "title": "Уведомление клиентов об отказе в принятии показаний"},
            {"id": "p11", "sender": "АИИС и предбиллинг", "receiver": "ОКиР", "to": "МКД", "title": "Предоставления отчета для беззаявительного перерасчета по ГВС"},
            {"id": "p12", "sender": "Отдел ком.учёта", "receiver": "ОКиР", "to": "Прочие", "title": "Информация о вновь допущенных и замененных приборах учета"},
            {"id": "p13", "sender": "Отдел ком.учёта", "receiver": "система АИИС", "to": "Прочие", "title": "Актуализация в АИИС всех статусов УУ"},
            {"id": "p14", "sender": "ОКиР", "receiver": "1С", "to": "Прочие", "title": "Актуализация информации по вновь допущенным и замененным ПУ"},
            {"id": "p15", "sender": "Тепловая инспекция", "receiver": "ОКиР", "to": "Прочие", "title": "Заполненные шаблоны отключений в ОКиР"},
            {"id": "p16", "sender": "Отдел ком.учёта", "receiver": "АИИС и предбиллинг", "to": "Прочие", "title": "Ручные ведомости приборов учета"},
            {"id": "p17", "sender": "АИИС и предбиллинг", "receiver": "Отдел ком.учёта", "to": "Прочие", "title": "Перечень ТУ на согласование с признаком \"Не принятые к расчёту\""},
            {"id": "p18", "sender": "Отдел ком.учёта", "receiver": "АИИС и предбиллинг", "to": "Прочие", "title": "Перечень ТУ на согласование с признаком \"Не принятые к расчёту\" - акцептованный"},
            {"id": "p19", "sender": "АИИС и предбиллинг", "receiver": "ОКиР", "to": "Прочие", "title": "Передача информации по поломкам в ОКиР"},
            {"id": "p20", "sender": "АИИС и предбиллинг", "receiver": "ОКиР", "to": "Прочие", "title": "Передача информации по показания в ОКиР"},
            {"id": "p21", "sender": "АИИС и предбиллинг", "receiver": "", "to": "Прочие", "title": "Уведомление клиентов об отказе в принятии показаний"}
        ]
    }
}


def _default_plan_month():
    """Структура для нового месяца — по всем филиалам из чек-листа.
       Строки — единые для всех, берутся из Кировского (эталона).
    """
    d = load()
    checklist = d.get('checklist', {}).get('structure', {})
    base_rows = PLAN_SCHEDULE_STRUCTURE.get('kirov', {}).get('rows', [])
    out = {}
    for filial_key, filial in checklist.items():
        out[filial_key] = {
            "name": filial.get('name', filial_key),
            "periods": {"mkd": "", "other": ""},
            "rows": [
                {
                    "id": r["id"],
                    "sender": r["sender"],
                    "receiver": r["receiver"],
                    "to": r["to"],
                    "title": r["title"],
                    "plan": "",
                    "fact": ""
                }
                for r in base_rows
            ]
        }
    return out


@app.route('/plan-schedule')
def plan_schedule():
    return render_template('plan_schedule.html')


@app.route('/api/plan-schedule/<month>', methods=['GET'])
def api_plan_schedule_get(month):
    d = load()
    if 'plan_schedule' not in d:
        d['plan_schedule'] = {}
    if month not in d['plan_schedule']:
        d['plan_schedule'][month] = _default_plan_month()
        save(d)
    else:
        # Проверяем, все ли филиалы из чек-листа есть в plan_schedule
        checklist = d.get('checklist', {}).get('structure', {})
        base_rows = PLAN_SCHEDULE_STRUCTURE.get('kirov', {}).get('rows', [])
        changed = False
        for filial_key, filial in checklist.items():
            if filial_key not in d['plan_schedule'][month]:
                # Новый филиал — добавляем структуру
                d['plan_schedule'][month][filial_key] = {
                    "name": filial.get('name', filial_key),
                    "periods": {"mkd": "", "other": ""},
                    "rows": [
                        {
                            "id": r["id"],
                            "sender": r["sender"],
                            "receiver": r["receiver"],
                            "to": r["to"],
                            "title": r["title"],
                            "plan": "",
                            "fact": ""
                        }
                        for r in base_rows
                    ]
                }
                changed = True
        if changed:
            save(d)
    return jsonify({'ok': True, 'month': month, 'data': d['plan_schedule'][month]})


@app.route('/api/plan-schedule/<month>', methods=['POST'])
def api_plan_schedule_save(month):
    p = request.get_json(silent=True) or {}
    data = p.get('data')
    if not isinstance(data, dict):
        return jsonify({'ok': False, 'error': 'data must be dict'}), 400
    d = load()
    if 'plan_schedule' not in d:
        d['plan_schedule'] = {}
    d['plan_schedule'][month] = data
    save(d)
    return jsonify({'ok': True})


@app.route('/api/plan-schedule/months', methods=['GET'])
def api_plan_schedule_months():
    d = load()
    months = list((d.get('plan_schedule') or {}).keys())
    months.sort(reverse=True)
    return jsonify({'ok': True, 'months': months})
@app.route('/api/plan-schedule/filials', methods=['GET'])
def api_plan_schedule_filials():
    """Список филиалов из чек-листа (у кого есть structure)."""
    d = load()
    checklist = d.get('checklist', {}).get('structure', {})
    filials = []
    for key, f in checklist.items():
        filials.append({
            'id': key,
            'name': f.get('name', key),
            'color': f.get('color', '#4f46e5')
        })
    return jsonify({'ok': True, 'filials': filials})
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter


@app.route('/api/plan-schedule/<month>/xlsx', methods=['GET'])
def api_plan_schedule_xlsx(month):
    from datetime import datetime
    d = load()
    ps = (d.get('plan_schedule') or {}).get(month, {})
    if not ps:
        abort(404)
    filial_key = request.args.get('filial', 'kirov')
    f = ps.get(filial_key)
    if not f:
        abort(404)

    wb = Workbook()
    ws = wb.active
    ws.title = 'План-график'

    thin = Side(border_style='thin', color='666666')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    header_fill = PatternFill('solid', fgColor='E2E8F0')
    title_font = Font(bold=True, size=14)
    header_font = Font(bold=True, size=11)

    ws.merge_cells('A1:G1')
    ws['A1'] = f'План-график закрытия предбиллинга {month}'
    ws['A1'].font = title_font
    ws['A1'].alignment = Alignment(horizontal='center')

    ws.merge_cells('A2:G2')
    ws['A2'] = f.get('name', '')
    ws['A2'].font = Font(bold=True, size=12)
    ws['A2'].alignment = Alignment(horizontal='center')

    periods = f.get('periods', {})
    ws['A4'] = 'Периоды съёма:'
    ws['A4'].font = Font(bold=True)
    ws['B4'] = 'МКД'
    ws['C4'] = periods.get('mkd', '')
    ws['B5'] = 'Прочие'
    ws['C5'] = periods.get('other', '')

    # Шапка (7-8 строки) — 7 колонок
    ws['A7'] = 'Ответственное подразделение'
    ws.merge_cells('A7:C7')
    ws['D7'] = 'Наименование'
    ws.merge_cells('D7:D8')
    ws['E7'] = 'План'
    ws.merge_cells('E7:E8')
    ws['F7'] = 'Факт'
    ws.merge_cells('F7:F8')
    ws['G7'] = 'Статус'
    ws.merge_cells('G7:G8')

    ws['A8'] = 'Отправитель'
    ws['B8'] = 'Получатель'
    ws['C8'] = 'Кому'

    for col in range(1, 8):
        for row in (7, 8):
            cell = ws.cell(row=row, column=col)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            cell.border = border

    def fmt_dt(s):
        if not s:
            return ''
        try:
            return datetime.fromisoformat(s).strftime('%d.%m.%Y %H:%M')
        except Exception:
            return s

    rows = f.get('rows', [])
    for i, r in enumerate(rows):
        row_num = 9 + i
        ws.cell(row=row_num, column=1, value=r.get('sender', ''))
        ws.cell(row=row_num, column=2, value=r.get('receiver', ''))
        ws.cell(row=row_num, column=3, value=r.get('to', ''))
        ws.cell(row=row_num, column=4, value=r.get('title', ''))
        ws.cell(row=row_num, column=5, value=fmt_dt(r.get('plan')))
        ws.cell(row=row_num, column=6, value=fmt_dt(r.get('fact')))
        st = 'Без срока'
        if r.get('fact'):
            st = 'Выполнено'
        elif r.get('plan'):
            try:
                if datetime.fromisoformat(r['plan']) < datetime.now():
                    st = 'Просрочено'
                else:
                    st = 'В работе'
            except Exception:
                pass
        ws.cell(row=row_num, column=7, value=st)
        for col in range(1, 8):
            cell = ws.cell(row=row_num, column=col)
            cell.border = border
            cell.alignment = Alignment(vertical='top', wrap_text=True)

    widths = [20, 20, 12, 50, 18, 18, 14]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[7].height = 30
    ws.row_dimensions[8].height = 30

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(
        buf,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'План-график_{filial_key}_{month}.xlsx'
    )
@app.route('/api/checklist/<filial>/xlsx', methods=['GET'])
def api_checklist_xlsx(filial):
    from datetime import datetime
    d = load()
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    cl = d.get('checklist', {})
    structure = cl.get('structure', {}).get(filial)
    if not structure:
        abort(404)
    data = cl.get('data', {}).get(f'{month}_{filial}', {})

    wb = Workbook()
    ws = wb.active
    ws.title = 'Чек-лист'

    thin = Side(border_style='thin', color='666666')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    header_fill = PatternFill('solid', fgColor='E2E8F0')
    title_font = Font(bold=True, size=14)
    header_font = Font(bold=True, size=11)

    ws.merge_cells('A1:E1')
    ws['A1'] = f'Чек-лист предбиллинга {structure.get("name", "")} — {month}'
    ws['A1'].font = title_font
    ws['A1'].alignment = Alignment(horizontal='center')

    headers = ['№', 'Задача', 'План', 'Факт', 'Статус']
    for i, h in enumerate(headers, 1):
        cell = ws.cell(row=3, column=i, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = border
        cell.alignment = Alignment(horizontal='center')

    def plan_date(item):
        if not item.get('day'):
            return ''
        y, m = month.split('-')
        y, m = int(y), int(m)
        if item.get('isNext'):
            m += 1
            if m > 12: m = 1; y += 1
        return f'{y}-{m:02d}-{item["day"]:02d}'

    def fmt(s):
        if not s:
            return ''
        try:
            return datetime.fromisoformat(s).strftime('%d.%m.%Y')
        except Exception:
            return s

    row_num = 4
    tasks = structure.get('tasks', [])
    for t in tasks:
        st = data.get(t['id'], {})
        plan = st.get('plan', plan_date(t))
        fact = st.get('fact', '')
        status = 'Без срока'
        if fact:
            status = 'Выполнено'
        elif plan:
            try:
                status = 'Просрочено' if datetime.fromisoformat(plan) < datetime.now() else 'В работе'
            except Exception:
                pass
        for col, val in enumerate([t.get('num', ''), t.get('title', ''), fmt(plan), fmt(fact), status], 1):
            c = ws.cell(row=row_num, column=col, value=val)
            c.border = border
            c.alignment = Alignment(vertical='top', wrap_text=True)
        row_num += 1
        for ch in t.get('children', []):
            sc = data.get(ch['id'], {})
            p2 = sc.get('plan', plan_date(ch))
            f2 = sc.get('fact', '')
            st2 = 'Без срока'
            if f2:
                st2 = 'Выполнено'
            elif p2:
                try:
                    st2 = 'Просрочено' if datetime.fromisoformat(p2) < datetime.now() else 'В работе'
                except Exception:
                    pass
            for col, val in enumerate(['', '  ' + ch.get('title', ''), fmt(p2), fmt(f2), st2], 1):
                c = ws.cell(row=row_num, column=col, value=val)
                c.border = border
                c.alignment = Alignment(vertical='top', wrap_text=True)
            row_num += 1

    widths = [6, 60, 14, 14, 14]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(
        buf,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'Чек-лист_{filial}_{month}.xlsx'
    )
@app.route('/templates')
def templates_page():
    return render_template('docs.html', section='templates', title='Шаблоны', icon='fa-file-lines')

@app.route('/api/docs/templates', methods=['GET'])
def api_templates_list():
    d = load()
    return jsonify({'ok': True, 'items': d.get('templates', [])})

@app.route('/api/docs/templates', methods=['POST'])
def api_templates_add():
    p = request.get_json(silent=True) or {}
    title = (p.get('title') or '').strip()
    file = (p.get('file') or '').strip()
    if not title or not file:
        return jsonify({'ok': False, 'error': 'title и file обязательны'}), 400
    d = load()
    if 'templates' not in d:
        d['templates'] = []
    item = {
        'id': uuid.uuid4().hex[:12],
        'title': title,
        'file': file,
        'date': p.get('date') or time.strftime('%Y-%m-%d'),
        'createdAt': int(time.time() * 1000)
    }
    d['templates'].append(item)
    save(d)
    return jsonify({'ok': True, 'item': item})

@app.route('/api/docs/templates/<item_id>', methods=['DELETE'])
def api_templates_delete(item_id):
    d = load()
    items = d.get('templates', [])
    before = len(items)
    d['templates'] = [x for x in items if x.get('id') != item_id]
    if len(d['templates']) == before:
        return jsonify({'ok': False, 'error': 'not found'}), 404
    save(d)
    return jsonify({'ok': True})
if __name__ == '__main__':
    # Автобэкап при запуске
    backup_name = make_backup(DATA_FILE, BACKUPS_DIR, keep=30)
    if backup_name:
        print(f'💾 Бэкап создан: data.json.backups/{backup_name}')
    else:
        print('ℹ Бэкап не создан (data.json отсутствует)')

    print('=' * 55)
    print('  Портал ЕЦП')
    print('  Локально:  http://localhost:8000/')
    print('  По сети:   http://<ваш-IP>:8000/')
    print('  Пароль руководителя:', MANAGER_PASSWORD)
    print('  Бэкапы:   data.json.backups/')
    print('  Ctrl+C — остановить')
    print('=' * 55)
    app.run(host='0.0.0.0', port=8000, threaded=True)