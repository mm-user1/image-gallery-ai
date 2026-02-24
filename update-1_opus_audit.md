# Update 1 — Audit Report

**Auditor:** Claude Opus 4.6
**Scope:** Commit `f3efd60e` (Update-1) — полная проверка на соответствие плану `update-1_opus.md`, корректность реализации, edge cases, и потенциальные проблемы.

---

## 1. Соответствие плану (update-1_opus.md)

### 1.1 Reorder Images — РЕАЛИЗОВАНО

| Требование | Статус | Примечания |
|---|---|---|
| Drag-and-drop thumbnails в Edit Mode | OK | `thumb.draggable = true` при `editMode`, app.js:1501 |
| Single image drag — default ghost | OK | Стандартный ghost браузера |
| Multi-select drag — badge с числом | OK | `createCountDragImage()`, app.js:228-244 |
| Vertical insertion indicator | OK | CSS pseudo-element `.thumbnail-row.drop-active::before`, row-aware position |
| Drag within same batch (reorder) | OK | `sourceBatch === targetBatch` ветка, server.js:823-829 |
| Drag between batches (move) | OK | Cross-batch ветка, server.js:830-838 |
| Highlight target batch on hover | OK | `.batch.drag-over` CSS class |
| Empty batches kept | OK | Сервер не удаляет пустые батчи |
| No file moves (same tab folder) | OK | Только metadata.json изменяется |

### 1.2 Reorder Tabs — РЕАЛИЗОВАНО

| Требование | Статус | Примечания |
|---|---|---|
| Tabs draggable в Edit Mode | OK | `tabEl.draggable = this.isEditMode()`, app.js:1309 |
| Vertical indicator between tabs | OK | `.tab.drop-before::before`, `.tab.drop-after::after` |
| Batch contents untouched | OK | Только порядок `metadata.tabs` меняется |
| New tab button stays at end | OK | Кнопка вне `tabList`, не затрагивается |
| API `PUT /api/tabs/reorder` | OK | server.js:462-500, валидация set-match |

### 1.3 Reorder Batches — РЕАЛИЗОВАНО

| Требование | Статус | Примечания |
|---|---|---|
| Move button как drag handle | OK | `batch-move-btn`, app.js:1368-1376 |
| Button styled like Copy prompt | OK | Использует класс `copy-btn` |
| Horizontal indicator between batches | OK | `.batch.drop-before::before`, `.batch.drop-after::after` |
| API `PUT /api/tabs/:name/reorder-batches` | OK | server.js:704-763, поддержка indices и batch IDs |

### 1.4 Move Batch to Another Tab — РЕАЛИЗОВАНО

| Требование | Статус | Примечания |
|---|---|---|
| "Move to ▾" dropdown button | OK | `move-to-wrap` + `move-to-dropdown`, app.js:1408-1449 |
| Dropdown excludes current tab | OK | `.filter(tabName => tabName !== this.state.activeTab)` |
| Batch inserted at top (index 0) | OK | `targetTab.batches.unshift(movedBatch)`, server.js:947 |
| Physical file move | OK | Copy-first + delete source, server.js:910-966 |
| Filename collision handling | OK | `ensureUniqueFilename()`, server.js:915 |
| Rollback on failure | OK | Copied files cleaned up if write fails, server.js:933-937, 951-958 |
| Dropdown closes on outside click | OK | Global click handler, app.js:469-474 |
| UI stays on current tab | OK | `activeTab` не меняется после move |

### 1.5 Copy Title Button — РЕАЛИЗОВАНО

| Требование | Статус | Примечания |
|---|---|---|
| "Copy title" button left of "Copy prompt" | OK | app.js:1387-1406 |
| Always visible | OK | Не обёрнут в `batch-edit-only` |
| Shows "Copied!" for 1.5s | OK | `copyTextWithFeedback()`, app.js:1575-1581 |
| Same style as Copy prompt | OK | Класс `copy-btn` |

---

## 2. Дополнения от исполнителя (не запланированные, но полезные)

### 2.1 Stable Batch IDs — ХОРОШЕЕ РЕШЕНИЕ

Исполнитель добавил уникальные ID для батчей (`createBatchId()`, `ensureBatchIds()`). Это решает реальную проблему: при reorder индексы батчей меняются, и если одновременно идёт debounced update для title/description по старому индексу, он попадёт не в тот батч.

**Оценка:** Корректное архитектурное решение. Backward-compatible (автоматическое присвоение ID при отсутствии).

### 2.2 Extraction to app.js — НЕЙТРАЛЬНО

Inline-скрипт из index.html вынесен в отдельный `public/app.js`. Разумно при объёме 2100+ строк.

### 2.3 `buildTabImageUsage()` для защиты от удаления shared files — ХОРОШЕЕ

При удалении батча/изображения проверяется, нет ли ссылок на файл в других батчах того же таба. Если есть — файл не удаляется с диска.

### 2.4 `normalizeStoredFilename()` для non-ASCII — ХОРОШЕЕ

Новая функция сохраняет оригинальные символы в именах файлов, в отличие от `sanitizeFilename()`, которая заменяет non-ASCII на дефисы.

### 2.5 Clipboard API upgrade — ХОРОШЕЕ

Перешли с deprecated `document.execCommand('copy')` на `navigator.clipboard.writeText()` с fallback.

---

## 3. Обнаруженные проблемы

### 3.1 Хрупкий порядок маршрутов Express — НИЗКИЙ РИСК

**Проблема:** `PUT /api/tabs/reorder` (server.js:462) зарегистрирован ДО `PUT /api/tabs/:name` (server.js:505). Это работает корректно — Express матчит `reorder` на первый маршрут. Но если кто-то переставит маршруты, `:name` будет перехватывать "reorder" как имя таба.

**Уровень риска:** Низкий. Порядок правильный, менять маршруты вряд ли кто-то будет без понимания.

**Рекомендация:** Добавить комментарий перед `PUT /api/tabs/reorder` — "Must be registered before PUT /api/tabs/:name to avoid shadowing".

### 3.2 Tab name "reorder" — НИЗКИЙ РИСК

**Проблема:** Если пользователь создаст таб с именем "reorder", операции rename и delete для этого таба будут работать (разные HTTP методы/пути), но семантически это вызывает путаницу. Хотя на практике `PUT /api/tabs/reorder` обрабатывает только reorder, а `DELETE /api/tabs/reorder` корректно удалит таб, проблем нет.

**Уровень риска:** Минимальный, нет фактического бага.

### 3.3 `normalizeBatchId()` fallback на клиенте — ПОТЕНЦИАЛЬНАЯ ПРОБЛЕМА

**Проблема:** В `app.js:220-226` функция `normalizeBatchId()` генерирует fallback ID `legacy-{index}` для батчей без ID. Этот fallback зависит от `batchIndex`, который нестабилен при reorder. Однако сервер вызывает `ensureBatchIds()` при старте и при каждой мутации, поэтому батчи без ID в metadata.json существовать не должны.

**Уровень риска:** Минимальный на практике (сервер гарантирует наличие ID). Но если metadata.json будет отредактирован вручную с удалением ID, клиент получит нестабильные fallback-ID.

### 3.4 Отсутствие confirmation при "Move to" — ДИЗАЙНЕРСКОЕ РЕШЕНИЕ

**Наблюдение:** При клике на таб в dropdown "Move to" батч перемещается мгновенно без confirmation dialog. Для удаления есть confirm(), для move — нет. Это не ошибка (в плане не было требования), но может быть неожиданно при случайном клике. Файлы физически перемещаются — операция необратима.

**Рекомендация:** Опционально добавить `confirm('Move batch to "TabName"?')` перед перемещением. Решение за владельцем проекта.

### 3.5 Batch move: source files not deleted if shared — КОРРЕКТНО

Реализация правильно проверяет `sourceUsage` (server.js:897-905): если файл используется в других батчах того же таба, он не удаляется из source. Только "exclusive" файлы (используемые только в перемещаемом батче) удаляются после успешного копирования.

### 3.6 DnD на мобильных устройствах — ОЖИДАЕМОЕ ОГРАНИЧЕНИЕ

**Наблюдение:** HTML5 Drag and Drop API не работает на мобильных устройствах (touch). Это указано как ограничение в плане (нативный API, без библиотек). Приложение и раньше было touch-limited в edit mode (multi-select работал, но drag — нет).

**Уровень риска:** Осознанный trade-off. Основное использование — desktop.

### 3.7 Нет race condition protection при concurrent drag — ПРИЕМЛЕМО

**Наблюдение:** Если два пользователя одновременно перетаскивают батчи/изображения, результат зависит от порядка поступления запросов. Серверный `withMetadataLock()` сериализует операции, поэтому data corruption невозможно, но второй пользователь может увидеть неожиданный результат.

**Уровень риска:** Приемлемый. Одновременное перетаскивание — крайне редкий edge case.

### 3.8 Image drag between batches — Insert index calculation — ПРОВЕРЕНО

Алгоритм `calculateImageDropPosition()` (app.js:794-867) использует row-aware подход:
1. Группирует thumbnails по визуальным строкам
2. Определяет целевую строку по Y-координате курсора
3. Определяет позицию вставки по X-координатам центров элементов

Это решает проблему с grid-layout, где thumbnails wrap на новые строки. Алгоритм корректно обрабатывает edge cases (пустые строки, начало/конец ряда).

### 3.9 `adjustInsertIndexForSameSource()` — КОРРЕКТНО

При перетаскивании изображения внутри одного батча, элементы сначала удаляются из source, затем вставляются по новому индексу. `adjustInsertIndexForSameSource()` (app.js:1127-1134) корректно пересчитывает индекс вставки с учётом удалённых элементов перед позицией вставки.

---

## 4. Структурный анализ кода

### 4.1 server.js — 1301 строка

- Чистая структура: утилиты → конфигурация → IIFE с Express app
- Все мутации metadata через `withMetadataLock()` — корректно
- Atomic write через temp file + rename — корректно
- Retry logic для EPERM (Windows antivirus) — корректно
- `ensureBatchIds()` вызывается при каждой мутации — надёжно

### 4.2 app.js — 2119 строк

- Один класс `GalleryApp` с чёткой структурой
- API-клиент выделен в объект `api`
- DnD-утилиты (`setDragPayload`, `getDragPayload`, `hasDragType`) — чисто и без side effects
- Drag state management через `this.state.drag` — централизовано
- `scheduleDragCleanup()` через setTimeout(0) — корректное решение для cleanup после dragend

### 4.3 index.html — 825 строк (только HTML + CSS)

- JavaScript полностью вынесен в app.js
- CSS для новых элементов (drag indicators, move-to-dropdown, batch-move-btn) — аккуратно
- Responsive media queries сохранены

---

## 5. Проверка по требованиям (checklist)

| # | Требование из обсуждения | Реализовано | Корректно |
|---|---|---|---|
| 1 | Drag-and-drop images в Edit Mode | Да | Да |
| 2 | Multi-select + drag | Да | Да |
| 3 | Badge с числом при multi-drag | Да | Да |
| 4 | Перенос images между батчами | Да | Да |
| 5 | Пустые батчи сохраняются | Да | Да |
| 6 | Drag-and-drop tabs в Edit Mode | Да | Да |
| 7 | Batches не затрагиваются при reorder tabs | Да | Да |
| 8 | Кнопка Move как drag handle для батчей | Да | Да |
| 9 | "Move to ▾" dropdown для переноса между табами | Да | Да |
| 10 | Batch добавляется наверх (index 0) в целевом табе | Да | Да |
| 11 | Физический перенос файлов при move batch | Да | Да |
| 12 | Copy Title кнопка слева от Copy Prompt | Да | Да |
| 13 | Copy Title всегда видна | Да | Да |
| 14 | Нативный HTML5 DnD (без библиотек) | Да | Да |
| 15 | Визуальные индикаторы вставки | Да | Да |

---

## 6. API endpoints — Соответствие плану

| План | Реализация | Совпадение |
|---|---|---|
| `PUT /api/tabs/reorder` | `PUT /api/tabs/reorder` | Полное |
| `PUT /api/tabs/:name/reorder-batches` | `PUT /api/tabs/:name/reorder-batches` | Полное |
| `PUT /api/tabs/:name/reorder-images` | `PUT /api/tabs/:name/reorder-images` | Полное |
| `POST /api/tabs/:sourceTab/batches/:index/move` | `POST /api/tabs/:sourceTab/batches/:batchIndex/move` | Полное (param name differs, non-breaking) |

Форматы request body соответствуют плану. Дополнительно API поддерживает `batchId` в теле запроса (улучшение от исполнителя).

---

## 7. Backward Compatibility

| Аспект | Статус |
|---|---|
| Existing metadata.json | Совместимо (batch IDs добавляются автоматически) |
| Existing API consumers | Совместимо (индексы продолжают работать, batchId опционален) |
| Existing image files | Не затронуты |
| Existing tab structure | Не затронуто |
| Polling clients (multi-user) | Совместимо (hash-based change detection сохранён) |

---

## 8. Итоговая оценка

**Общая оценка: Апдейт реализован корректно и полностью.**

Все 4 функциональных требования из плана реализованы. Дополнительные архитектурные решения (stable batch IDs, file usage tracking, clipboard API upgrade) улучшают надёжность.

**Критических проблем не обнаружено.**

Обнаруженные замечания (хрупкий порядок маршрутов, отсутствие confirm при move, mobile DnD) — это осознанные trade-offs или минорные улучшения, не влияющие на работоспособность.

**Дополнительных доработок для функциональной полноты не требуется.** Апдейт решает все поставленные задачи.
