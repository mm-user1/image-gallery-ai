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

## Data locations

- All galleries are stored under the folder configured by `dataPath` (default `./data`).
- Each tab corresponds to a subdirectory, and `metadata.json` inside that folder tracks batch descriptions and image references.
- Uploaded files are first staged in the `uploads/` directory before being moved to their target tab.

## API overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/tabs` | GET | List all tabs |
| `/api/tabs` | POST | Create a tab |
| `/api/tabs/:name` | PUT | Rename a tab |
| `/api/tabs/:name` | DELETE | Delete a tab and its files |
| `/api/tabs/:name/batches` | GET | Retrieve batches for a tab |
| `/api/tabs/:name/batches` | POST | Create a batch |
| `/api/tabs/:name/batches/:index` | PUT | Update batch description |
| `/api/tabs/:name/batches/:index` | DELETE | Delete a batch |
| `/api/tabs/:name/batches/:batchIndex/images/:filename` | DELETE | Delete a single image |
| `/api/upload` | POST | Upload images (multipart/form-data) |
| `/api/images/:tab/:filename` | GET | Stream an image |
| `/api/metadata` | GET | Retrieve the entire metadata file |

All endpoints return JSON responses with clear error messages and HTTP status codes.

## Graceful shutdown

Press `Ctrl + C` in the terminal to stop the server. It will close existing connections before exiting.

## Cross-platform notes

- Paths are resolved with `path.join()` ensuring compatibility across Windows, macOS, and Linux.
- Filenames and tab names are validated to avoid unsafe characters or path traversal.
- Tested with Firefox and Chromium-based browsers.
