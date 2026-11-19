# -*- coding: utf-8 -*-
"""Автобэкап data.json при каждом запуске сервера."""
import os
import json
import time

def make_backup(data_file, backups_dir, keep=30):
    """Создаёт копию data.json с датой. Хранит последние keep версий."""
    if not os.path.exists(data_file):
        return None
    os.makedirs(backups_dir, exist_ok=True)
    ts = time.strftime('%Y-%m-%d_%H-%M-%S')
    backup_name = f'data-{ts}.json'
    backup_path = os.path.join(backups_dir, backup_name)
    try:
        with open(data_file, 'r', encoding='utf-8') as src:
            content = src.read()
        # Проверим, что JSON валидный
        json.loads(content)
        with open(backup_path, 'w', encoding='utf-8') as dst:
            dst.write(content)
    except Exception as e:
        print(f'⚠ Не удалось создать бэкап: {e}')
        return None

    # Чистим старые
    try:
        files = sorted(
            [f for f in os.listdir(backups_dir) if f.startswith('data-') and f.endswith('.json')],
            reverse=True
        )
        for old in files[keep:]:
            os.remove(os.path.join(backups_dir, old))
    except Exception as e:
        print(f'⚠ Ошибка очистки бэкапов: {e}')

    return backup_name