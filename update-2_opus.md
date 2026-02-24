# Update 2 — Specification

## Overview

Five new features for Image Gallery AI: clipboard paste, Esc exit from edit mode, favorites/likes system, export of liked images, and search across prompts/titles.

All changes go into existing files (`app.js`, `index.html`, `server.js`). No new JS files. New methods grouped with comment section headers in `app.js`.

---

## 1. Paste Image from Clipboard

### Description
Add a "Paste image" button next to "Select files" in both dropzones (main dropzone and per-batch dropzone in edit mode). Allows pasting screenshots (Win+Shift+S) and any other clipboard images.

### UI

Main dropzone:
```
┌─ Drop zone ──────────────────────────────────────┐
│  Drop images here or select up to 50 files...    │
│  [Select files]  [Paste image]                   │
└──────────────────────────────────────────────────┘
```

Per-batch dropzone (edit mode → "+" → dropzone appears on batch):
```
┌─ Batch drop zone ───────────────────────────────┐
│  Drop images here to add to this batch           │
│  [Select files]  [Paste image]                   │
└─────────────────────────────────────────────────┘
```

### Behavior
- Button click calls `navigator.clipboard.read()` to get image from clipboard.
- Expects `image/png` or `image/jpeg` blob. If clipboard has no image — do nothing (optionally show brief tooltip "No image in clipboard").
- Browser will show a one-time permission prompt "Allow site to read clipboard?" — this is unavoidable with the Clipboard API.
- Generated filename format: `clipboard-YYYYMMDD-HHmmss.png` (timestamp at moment of paste).
- In main dropzone: creates a new batch with the single pasted image (same flow as file upload).
- In batch dropzone: appends the pasted image to that specific batch.
- The pasted blob is sent to the server via the same `/api/upload` endpoint (as FormData with the generated filename).

### No global Ctrl+V handling
Paste works only via button click. No global keyboard shortcut to avoid conflicts with text editing.

### Files to modify
- `app.js`: add paste button creation in main dropzone setup and in `createBatchDropZone()`. Add helper method for clipboard read + upload.
- `index.html`: add paste button in the main dropzone HTML.

---

## 2. Esc to Exit Edit Mode

### Description
Pressing Escape key exits edit mode when no other modal/overlay is active.

### Priority chain for Esc key
```
Esc pressed:
  1. Viewer open? → close viewer (already implemented)
  2. Edit mode active? → exit edit mode
```

No blur behavior for text fields — if user is typing in title/description, Esc still follows the chain above. No special handling for search field Esc either.

### Implementation
Add to the existing `document.addEventListener('keydown', ...)` handler. After the viewer check (which returns early), add:

```js
if (e.key === 'Escape' && this.isEditMode()) {
  document.body.classList.remove('edit-mode');
  this.state.activeBatchDropZones.clear();
  this.state.openMoveDropdownBatchId = null;
  this.clearSelection(false);
  this.clearAllDragIndicators();
  this.renderTabs();
  this.renderBatches();
}
```

This mirrors the existing toggle edit logic in the `toggleEdit` click handler.

### Files to modify
- `app.js`: extend the existing keydown listener (currently at line ~436).

---

## 3. Favorites / Likes

### Description
Users can "like" individual images (mark as favorite). A heart icon on each thumbnail toggles liked state. A global filter button shows only liked images in the fullscreen viewer. Heart icon also available in the viewer itself.

### Data storage — metadata.json

Add `liked` array to each batch object:

```json
{
  "id": "b_abc123",
  "title": "Golden sunset",
  "description": "A beautiful sunset over mountains...",
  "images": ["img1.png", "img2.png", "img3.png"],
  "liked": ["img1.png", "img3.png"],
  "createdAt": "...",
  "updatedAt": "..."
}
```

- `liked` is an array of filenames that are liked within this batch.
- When a batch is created, `liked` defaults to `[]`.
- When a batch is moved to another tab, `liked` moves with it (automatic, since it's part of batch object).
- When an image is deleted, remove it from `liked` too.

### API

New endpoint to toggle like:

```
PUT /api/tabs/:name/batches/:index/like
Body: { "filename": "img1.png", "batchId": "b_abc123" }
Response: { "liked": true } or { "liked": false }
```

Server toggles: if filename is in `liked` array — remove it; if not — add it.

### UI — Heart on thumbnail

Position: bottom-left corner of each thumbnail. Visible ALWAYS (not just in edit mode).

```
┌──────────┐          ┌──────────┐
│          │          │          │
│   img    │          │   img    │
│          │          │          │
│ ♡       x│          │ ♥       x│
└──────────┘          └──────────┘
 (not liked)           (liked)
```

- `♡` — outline heart (not liked). Semi-transparent white with subtle shadow for visibility on any image.
- `♥` — filled white heart (liked).
- Click on heart: `e.stopPropagation()` to prevent opening viewer or toggling selection.
- Heart click sends API request to toggle like, updates local state optimistically.
- In edit mode: heart still works alongside selection. Clicking heart does NOT select/deselect the image.

CSS approach:
```css
.thumb-like {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 2;
  cursor: pointer;
  font-size: 1.2rem;
  /* white with text shadow for contrast on any background */
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  transition: transform 0.15s ease;
}
.thumb-like:hover {
  transform: scale(1.2);
}
.thumb-like.liked {
  color: #fff;
}
```

### UI — Filter button in header

Position: in header-actions, between search field and "Toggle edit mode" button.

```
┌──────────────────────────────────────────────────────────────┐
│  AI Image Gallery Manager                                     │
│  Organise AI generations...                                   │
│                    [🔍 Search...] [Export] [♡ 12] [Toggle edit]│
└──────────────────────────────────────────────────────────────┘
```

- `[♡ 12]` — heart icon + count of liked images in current tab.
- If 0 liked in current tab: show `[♡]` without number.
- Click toggles favorites filter mode on/off.
- When active: `[♥ 12]` — filled heart, visually distinct (e.g. different background/border).
- `[Export]` button appears ONLY when favorites filter is active AND liked count > 0 in current tab.

### UI — Heart in fullscreen viewer

Position: top-left corner of viewer (mirroring the close button `[x]` which is top-right).

```
┌──────────────────────────────────────┐
│ ♡                                  x │
│                                      │
│          < [  image  ] >             │
│                                      │
└──────────────────────────────────────┘
```

- Same outline/filled toggle behavior.
- Click toggles like for the currently displayed image.
- Updates both local state and sends API request.

### Favorites filter effect on viewer

When favorites filter is active (`♥` button pressed in header):
- **Thumbnail grid (normal view): NO change.** All images displayed as usual. Liked images show filled heart, non-liked show outline heart. No filtering in grid view.
- **Fullscreen viewer: FILTERED.** Arrow navigation only cycles through liked images (across all batches in the current tab). Non-liked images are skipped.
- If viewer is open and user unlikes the currently viewed image — close viewer or jump to next liked image.

Implementation: `navigateViewer()` and `getGlobalImageIndex()` / `getImageByGlobalIndex()` need to account for favorites filter. When filter is active, build a filtered image list (only liked) and navigate within that list.

### Files to modify
- `server.js`: new PUT endpoint for toggling like. Ensure `liked` array initialized on batch creation. Remove filename from `liked` when image deleted.
- `app.js`: heart on thumbnails, heart in viewer, filter button in header, filtered viewer navigation, like count calculation.
- `index.html`: heart button in viewer HTML, styles for `.thumb-like`, filter button styles, viewer heart styles.

---

## 4. Export Liked Images

### Description
Export (copy) all liked images from the current tab to `./data/+EXPORT/` directory.

### UI

Export button in header-actions, visible only when:
1. Favorites filter is active (heart button toggled on), AND
2. Current tab has > 0 liked images.

```
[Export] [♥ 12] [Toggle edit mode]
```

When favorites filter is off or liked count is 0, Export button is hidden.

### Behavior
- Click "Export" → sends API request with tab name.
- Server collects all liked filenames from all batches in the specified tab.
- Server copies each file from `./data/<TabName>/` to `./data/+EXPORT/`.
- Filenames are preserved. If a file with the same name already exists in `+EXPORT/`:
  - Append ` (1)` before extension: `image.png` → `image (1).png`
  - If `image (1).png` exists too → `image (2).png`, and so on.
  - Standard browser download naming convention.
- No success notification (user can check the folder).

### API

```
POST /api/export-liked
Body: { "tab": "Spring" }
Response: { "exported": 12 }
```

Server-side:
1. Read metadata, find tab by name.
2. Collect all filenames from `batch.liked` arrays across all batches in that tab.
3. Ensure `./data/+EXPORT/` directory exists (create if not).
4. Copy each file with dedup naming.

### Exclude +EXPORT from tabs

The `+EXPORT` directory must be excluded from tab listing. In `server.js`, when scanning `dataPath` for tabs or when loading metadata, filter out any tab/directory named `+EXPORT`. The `+` prefix makes it invalid as a tab name (tab names are alphanumeric + hyphen/underscore only), so it should naturally be excluded, but add an explicit check to be safe.

### Files to modify
- `server.js`: new POST endpoint `/api/export-liked`. Ensure `+EXPORT` dir excluded from tab scanning.
- `app.js`: Export button in header, visibility logic tied to favorites filter state and liked count.
- `index.html`: styles for Export button.

---

## 5. Search Across Prompts and Titles

### Description
Search field in header allows searching through batch titles and descriptions (prompts) across ALL tabs. Results displayed as filtered batch list grouped by tab.

### UI — Search field

Inline search input in header-actions, leftmost position:

```
┌──────────────────────────────────────────────────────────────┐
│  AI Image Gallery Manager                                     │
│  Organise AI generations...                                   │
│                    [🔍 Search...] [Export] [♡ 12] [Toggle edit]│
└──────────────────────────────────────────────────────────────┘
```

- Persistent input field (always visible, not collapsible).
- Placeholder: "Search..." with a search icon (🔍 or SVG magnifying glass).
- When text is entered, a small `[x]` clear button appears inside the input on the right side.

### Search behavior
- **Client-side only** — all metadata is already loaded, no server API needed.
- **Debounced**: 300ms after last keystroke before filtering.
- **Case-insensitive** search.
- **Searches in**: `batch.title` and `batch.description` fields only. NOT in tab names, NOT in filenames.
- **Across all tabs**: results include batches from every tab.
- Empty search field = normal mode (no filtering).

### Results display

When search has results, replace the normal batch list with search results view:

```
┌─────────────────────────────────────────────────────────┐
│  🔍 "sunset"                                        [x] │
├─────────────────────────────────────────────────────────┤
│  Tab: Summer                                             │
│  ─────────────────────────────────────────────────────── │
│  Batch 3 · Feb 24                                        │
│  [img1][img2][img3][img4]                                │
│  Title: "Golden **sunset** over mountains"               │
│  Description: "A beautiful **sunset** scene with..."     │
│  ─────────────────────────────────────────────────────── │
│  Tab: Portraits                                          │
│  ─────────────────────────────────────────────────────── │
│  Batch 1 · Feb 20                                        │
│  [img1][img2]                                            │
│  Title: "**Sunset** portrait session"                    │
│  Description: "Natural light portrait during **sunset**" │
└─────────────────────────────────────────────────────────┘
```

- Results grouped by tab with tab name as section header.
- Matched text highlighted (bold or background highlight) in title and description.
- Thumbnails displayed in their normal grid.
- Title and description inputs shown as read-only text (not editable in search results).
- If no results found: keep current display unchanged (no filtering applied). Alternatively, show "No results for '...'" message — to be decided during implementation.

### Clicking images in search results

- Clicking a thumbnail opens the fullscreen viewer.
- **Viewer navigation in search mode**: navigates across ALL images from ALL matching batches (cross-tab, cross-batch). Effectively a flat list of all images from search results.
- Closing the viewer returns to search results view.

### Exiting search mode

- Click `[x]` clear button inside search input → clears text, returns to normal view.
- Manually delete all text from input → returns to normal view (after debounce).
- No Esc shortcut for clearing search (to avoid conflict with edit mode Esc).

### Interaction with other features

- **Tab bar**: tabs remain visible during search but none is highlighted as "active" (since results are cross-tab). Clicking a tab exits search mode and switches to that tab.
- **Edit mode**: search results are read-only. Edit mode features (drag, delete, move, selection) are disabled while search is active. The "Toggle edit mode" button either exits search first or is disabled during search.
- **Favorites filter**: works independently. If both search and favorites filter are active, viewer navigates only liked images within search results.
- **Dropzone**: main dropzone hidden during search mode (can't create batches while searching).

### Files to modify
- `app.js`: search input creation, debounced search logic, filtered render method for search results, cross-tab viewer navigation for search mode, highlight matching text.
- `index.html`: styles for search input, clear button, search results layout, tab section headers in results.

---

## Header Layout (Final)

```
┌──────────────────────────────────────────────────────────────┐
│  AI Image Gallery Manager                                     │
│  Organise AI generations...                                   │
│                                                               │
│                    [🔍 Search...] [Export] [♡ 12] [Toggle edit]│
└──────────────────────────────────────────────────────────────┘
```

Order left-to-right: Search → Export (conditional) → Favorites filter → Toggle edit mode.

Export button visibility: only when favorites filter ON and liked count > 0 in current tab.

---

## Implementation Order

| Step | Feature                  | Complexity  |
|------|--------------------------|-------------|
| 1    | Esc to exit edit mode    | Very low    |
| 2    | Paste image              | Low-medium  |
| 3    | Favorites / Likes        | Medium      |
| 4    | Export liked images      | Low         |
| 5    | Search                   | Medium      |

Steps 3 and 4 are dependent (export requires likes to exist). The rest are independent.

---

## Technical Notes

- All new methods in `app.js` grouped with comment section headers:
  ```js
  // ─── Clipboard / Paste ───────────────────────────
  // ─── Favorites (Likes) ──────────────────────────
  // ─── Export ─────────────────────────────────────
  // ─── Search ─────────────────────────────────────
  ```
- No new JS files. Single `app.js` remains.
- Favorites state (`liked` arrays) stored in `metadata.json` — shared across all network users.
- Favorites filter state (on/off) is client-side only (not persisted) — each user controls their own view.
- Search is fully client-side — no new server endpoints for search.
