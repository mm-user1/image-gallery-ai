# Update 1 — Reordering & Copy Title

## Overview

Add drag-and-drop reordering for images, batches, and tabs in Edit Mode; add a dropdown to move batches between tabs; add a Copy Title button. All drag-and-drop implemented with native HTML5 Drag and Drop API (no external libraries).

All reordering features are active **only when Edit Mode is enabled**.

---

## 1. Reorder Images (within and between batches)

### Behaviour

- In Edit Mode, each `.thumbnail` gets `draggable="true"`.
- Dragging a single image: the browser's default drag ghost shows the thumbnail.
- Dragging with multi-select: if the dragged image is part of the current selection, **all selected images** move together. The drag ghost shows a small badge with the count (e.g. `[3]`). If the dragged image is **not** selected, only that one image moves (selection is cleared).
- A vertical insertion indicator line appears between thumbnails to show the drop position.
- Images can be dropped:
  - Within the same batch (reorder).
  - Into a different batch within the same tab (move between batches).
- When hovering over a different batch's thumbnail row, highlight the batch container with a border to make the drop target obvious.
- Empty batches (all images moved out) are **kept** — they may contain useful title/prompt data. User can delete them manually.
- Since all images within a tab share the same folder on disk, moving images between batches only changes `metadata.json` — no file system moves needed.

### Visual (Edit Mode)

```
Batch 3 · 2/21/2026
┌──────┐ ┌──────┐ ▌ ┌──────┐ ┌──────┐
│ img1 │ │ img2 │ ▌ │ img3 │ │ img4 │   ← insertion indicator (▌)
│  ☐   │ │  ☑   │   │  ☐   │ │  ☐   │
└──────┘ └──────┘   └──────┘ └──────┘

Batch 2 · 2/20/2026              ← highlighted border when hovering
┌──────┐ ┌──────┐ ┌──────┐
│ img5 │ │ img6 │ │ img7 │
└──────┘ └──────┘ └──────┘
```

Multi-select drag ghost:
```
┌─────┐
│ [3] │   ← count badge following cursor
└─────┘
```

### API

**`PUT /api/tabs/:name/reorder-images`**

Request body:
```json
{
  "operations": [
    {
      "sourceBatch": 0,
      "targetBatch": 1,
      "images": ["img2.png", "img5.png"],
      "insertIndex": 2
    }
  ]
}
```

Accepts an array of operations so that a multi-select drag across batches can be handled in a single request. Each operation specifies source batch index, target batch index, list of image filenames to move, and the insertion index in the target batch.

Response: updated metadata for the tab.

---

## 2. Reorder Tabs

### Behaviour

- In Edit Mode, each `.tab` element gets `draggable="true"`.
- Dragging a tab shows the default drag ghost (the tab element).
- A vertical insertion indicator appears between tabs to show the drop position.
- On drop, the tab order in `metadata.tabs` is updated. Batch contents are untouched.
- The "➕ New" button is never draggable and stays at the end.

### Visual (Edit Mode)

```
[Tab1 ✕]  [Tab2 ✕]  ▌  [Tab3 ✕]  [Tab4 ✕]   [➕ New]
                     ↑
           insertion indicator
```

### API

**`PUT /api/tabs/reorder`**

Request body:
```json
{
  "order": ["Tab3", "Tab1", "Tab2", "Tab4"]
}
```

Array of tab names in the desired order. Server validates that the set of names matches existing tabs exactly.

Response: updated full metadata.

---

## 3. Reorder Batches & Move Batches Between Tabs

### 3a. Reorder batches within a tab

#### Behaviour

- In Edit Mode, a **Move button** (styled like "Copy prompt") appears at the left side of `.batch-header`, pushing the batch title to the right. This button serves as the drag handle.
- The button text: `Move` (same visual style as Copy prompt button).
- Dragging the Move button initiates drag of the entire `.batch` block.
- A horizontal insertion indicator appears between batches to show the drop position.
- On drop, the batch order in the tab's `batches` array is updated.

#### Visual (Edit Mode)

```
[Move] Batch 3 · 2/21/2026     [Copy title] [Copy prompt] [Move to ▾] [+] [🗑️]
┌──────┐ ┌──────┐ ┌──────┐
│ img1 │ │ img2 │ │ img3 │
└──────┘ └──────┘ └──────┘

══════════════════════════════   ← horizontal insertion indicator

[Move] Batch 2 · 2/20/2026     [Copy title] [Copy prompt] [Move to ▾] [+] [🗑️]
┌──────┐ ┌──────┐
│ img4 │ │ img5 │
└──────┘ └──────┘
```

#### API

**`PUT /api/tabs/:name/reorder-batches`**

Request body:
```json
{
  "order": [2, 0, 1]
}
```

Array of old batch indices in the desired new order. Server rearranges `tab.batches` accordingly.

Response: updated metadata for the tab.

### 3b. Move batch to another tab

#### Behaviour

- In Edit Mode, each batch header shows a **"Move to ▾"** dropdown button (styled like other batch control buttons).
- Clicking the button opens a dropdown list of all other tabs (excluding the current tab).
- Clicking a tab name in the dropdown moves the entire batch (title, description, timestamps, images) to the **top** (index 0) of the target tab's batches array, so it's immediately visible when switching to that tab.
- Image files are physically moved from the source tab folder to the target tab folder on the server.
- The batch is removed from the source tab's batches array.
- After the move, the UI stays on the current tab (the batch disappears from the list).
- The dropdown closes after selection or on outside click.

#### Visual

```
[Move] Batch 3 · 2/21/2026     [Copy title] [Copy prompt] [Move to ▾] [+] [🗑️]
                                                           ┌───────────┐
                                                           │ Spring    │
                                                           │ Summer    │
                                                           │ Autumn    │
                                                           └───────────┘
```

#### API

**`POST /api/tabs/:sourceTab/batches/:batchIndex/move`**

Request body:
```json
{
  "targetTab": "Spring"
}
```

Server actions:
1. Validate source and target tabs exist, and they are different.
2. Get the batch data from source tab.
3. Move all image files from `data/{sourceTab}/` to `data/{targetTab}/`, handling filename collisions (rename with counter if needed).
4. Update image filenames in batch data if any were renamed.
5. Insert the batch at index 0 (top) of target tab's batches array.
6. Remove the batch from source tab's batches array.
7. Save metadata.

Response: updated full metadata.

---

## 4. Copy Title Button

### Behaviour

- A **"Copy title"** button is added to `.batch-controls`, positioned to the **left** of the existing "Copy prompt" button.
- The button is **always visible** (regardless of whether the title is empty).
- Copies `batch.title` to clipboard. If title is empty, copies an empty string.
- Shows "Copied!" for 1.5 seconds after click (same behaviour as "Copy prompt").
- Styled identically to the existing "Copy prompt" button.

### Visual

```
Batch 3 · 2/21/2026     [Copy title] [Copy prompt] [+] [🗑️]
```

In Edit Mode (with all new buttons):
```
[Move] Batch 3 · 2/21/2026     [Copy title] [Copy prompt] [Move to ▾] [+] [🗑️]
```

---

## Full Batch Header Layout (Edit Mode)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Move] Batch N · timestamp   [Copy title] [Copy prompt] [Move to ▾] [+] [🗑️] │
└──────────────────────────────────────────────────────────────────────────┘

 [Move]        — drag handle for batch reorder (edit-mode only)
 [Copy title]  — copy batch title to clipboard (always visible)
 [Copy prompt] — copy batch description to clipboard (always visible, existing)
 [Move to ▾]   — dropdown to move batch to another tab (edit-mode only)
 [+]           — toggle batch drop zone to add images (edit-mode only)
 [🗑️]          — delete batch (edit-mode only)
```

---

## New API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/api/tabs/reorder` | Reorder tabs |
| `PUT` | `/api/tabs/:name/reorder-batches` | Reorder batches within a tab |
| `PUT` | `/api/tabs/:name/reorder-images` | Move/reorder images within and between batches |
| `POST` | `/api/tabs/:sourceTab/batches/:index/move` | Move batch to another tab (with files) |

---

## Implementation Notes

### Drag-and-Drop (Native HTML5)

- All drag-and-drop uses the native HTML5 Drag and Drop API. No external libraries.
- `dragstart` — set `dataTransfer` data identifying the dragged element type (image / batch / tab) and its index/filename.
- `dragover` — `preventDefault()` to allow drop; show insertion indicator.
- `dragleave` — hide insertion indicator.
- `drop` — read `dataTransfer`, calculate new position, call API, refresh UI.
- `dragend` — cleanup any visual states.

### Drag Type Discrimination

Three drag types coexist in Edit Mode. Use `dataTransfer.setData()` with a type prefix to distinguish:
- `application/x-gallery-image` — image reorder
- `application/x-gallery-batch` — batch reorder
- `application/x-gallery-tab` — tab reorder

Each drop handler checks the type and ignores irrelevant drags.

### Custom Drag Ghost for Multi-Select

When dragging multiple selected images:
- Create a small DOM element off-screen: a rounded box with the count number (e.g. "3").
- Use `dataTransfer.setDragImage(element, offsetX, offsetY)` to set it as the drag image.
- Remove the element after `dragstart` fires.

### Polling Compatibility

- After any reorder/move API call, update `state.lastMetadataHash` so the next poll doesn't cause a redundant re-render.
- Reorder operations are quick metadata-only changes (except batch move between tabs which also moves files).

### Multi-User Considerations

- Reorder operations use the server's metadata lock (already implemented in `server.js`) to prevent concurrent modification issues.
- If another user reorders while a drag is in progress, the next poll will refresh the UI. This is acceptable — simultaneous reordering by multiple users is an edge case.

### CSS Additions Needed

- `.drag-indicator-vertical` — thin vertical line between thumbnails (for image reorder).
- `.drag-indicator-horizontal` — thin horizontal line between batches (for batch reorder).
- `.drag-indicator-tab` — thin vertical line between tabs (for tab reorder).
- `.batch.drag-over` — highlight border on batch when images are dragged over it.
- `.thumbnail.dragging` — reduced opacity on the image being dragged.
- `.batch.dragging` — reduced opacity on the batch being dragged.
- `.tab.dragging` — reduced opacity on the tab being dragged.
- `.move-to-dropdown` — dropdown styling for the "Move to" tab list.
- `.batch-move-btn` — styling for the Move drag handle button (edit-mode only).
