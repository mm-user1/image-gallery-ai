# AI Image Gallery Manager

Collaborative AI image gallery built with Node.js, Express, and a lightweight vanilla JavaScript frontend. The server exposes a REST API for managing project tabs, batches, and images across multiple machines on the same network.

## Installation

1. Install [Node.js](https://nodejs.org/) (version 16 or newer).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. When the server starts it opens your browser automatically (if enabled) at [http://localhost:3000](http://localhost:3000). You can adjust the port in `config.json` or via CLI flags.

## Network access

- On startup the console lists both the local and LAN URLs (e.g. `http://192.168.1.42:3000`).
- From another Windows 10 PC (or any device on the network) open Firefox and navigate to the LAN URL.
- Multiple users can collaborate simultaneously; the UI polls metadata every few seconds to stay in sync.

## Configuration

Settings are stored in `config.json`:

```json
{
  "port": 3000,
  "dataPath": "./data",
  "autoOpenBrowser": true
}
```

Override settings with CLI arguments:

```bash
node server.js --port 8080 --data "D:/AI Gallery" --auto-open false
```

## Project structure

```
image-gallery-ai/
├── server.js              # Express backend (~1300 lines): REST API, file management,
│                          #   metadata locking, atomic writes, batch ID system
├── public/
│   ├── index.html         # HTML layout + CSS (~825 lines): page structure, styling,
│   │                      #   drag indicators, responsive media queries, light theme
│   └── app.js             # Frontend logic (~2120 lines): GalleryApp class, API client,
│                          #   drag-and-drop (tabs/batches/images), viewer, polling,
│                          #   edit mode, selection, debounced batch updates
├── config.json            # Runtime settings: port, dataPath, autoOpenBrowser
├── package.json           # Dependencies: express, cors, multer, nodemon
├── data/
│   ├── metadata.json      # Central data store: tabs → batches → image references
│   └── <tab-folders>/     # One folder per tab, contains image files directly
└── uploads/               # Temporary staging for file uploads
```

## Data locations

- All galleries are stored under the folder configured by `dataPath` (default `./data`).
- `metadata.json` in the data root tracks all tabs, batches (with stable IDs), descriptions, and image references.
- Each tab corresponds to a subdirectory containing its image files (no batch subfolders).
- Uploaded files are first staged in the `uploads/` directory before being moved to their target tab.

## API overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/tabs` | GET | List all tabs |
| `/api/tabs` | POST | Create a tab |
| `/api/tabs/reorder` | PUT | Reorder tabs |
| `/api/tabs/:name` | PUT | Rename a tab |
| `/api/tabs/:name` | DELETE | Delete a tab and its files |
| `/api/tabs/:name/batches` | GET | Retrieve batches for a tab |
| `/api/tabs/:name/batches` | POST | Create a batch |
| `/api/tabs/:name/batches/:index` | PUT | Update batch title/description |
| `/api/tabs/:name/batches/:index` | DELETE | Delete a batch |
| `/api/tabs/:name/reorder-batches` | PUT | Reorder batches within a tab |
| `/api/tabs/:name/reorder-images` | PUT | Move/reorder images within and between batches |
| `/api/tabs/:name/batches/:index/move` | POST | Move a batch to another tab |
| `/api/tabs/:name/batches/:index/images` | POST | Append images to a batch |
| `/api/tabs/:name/batches/:index/images` | DELETE | Delete multiple images (bulk) |
| `/api/tabs/:name/batches/:index/images/:filename` | DELETE | Delete a single image |
| `/api/upload` | POST | Upload images (multipart/form-data) |
| `/api/images/:tab/:filename` | GET | Stream an image |
| `/api/metadata` | GET | Retrieve the entire metadata file |

All endpoints return JSON responses with clear error messages and HTTP status codes. Batch mutations accept an optional `batchId` parameter for stable targeting (indices may shift after reorder).

## Graceful shutdown

Press `Ctrl + C` in the terminal to stop the server. It will close existing connections before exiting.

## Cross-platform notes

- Paths are resolved with `path.join()` ensuring compatibility across Windows, macOS, and Linux.
- Filenames and tab names are validated to avoid unsafe characters or path traversal.
- Tested with Firefox and Chromium-based browsers.
