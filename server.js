#!/usr/bin/env node
'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const http = require('http');
const multer = require('multer');
const { exec } = require('child_process');

const APP_ROOT = __dirname;
const DEFAULT_CONFIG = {
  port: 3000,
  dataPath: './data',
  autoOpenBrowser: true
};
const CONFIG_PATH = path.join(APP_ROOT, 'config.json');
const UPLOADS_DIR = path.join(APP_ROOT, 'uploads');

/**
 * Utility logger with timestamp.
 * @param {string} message
 * @param {string} level
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Parse CLI arguments like --port 8080 --data ./foo
 * @param {string[]} argv
 * @returns {Record<string, string|boolean>}
 */
function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i += 1;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

/**
 * Ensures the config file exists. Creates one with defaults if missing.
 */
async function ensureConfig() {
  try {
    await fsp.access(CONFIG_PATH, fs.constants.F_OK);
  } catch (_) {
    await fsp.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    log('Created default config.json', 'SETUP');
  }
}

/**
 * Loads configuration from config.json and merges CLI overrides.
 * @returns {Promise<{port:number,dataPath:string,autoOpenBrowser:boolean}>}
 */
async function loadConfig() {
  await ensureConfig();
  const raw = await fsp.readFile(CONFIG_PATH, 'utf8');
  let config = { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(raw);
    config = { ...config, ...parsed };
  } catch (error) {
    log('Failed to parse config.json, using defaults', 'WARN');
  }
  const args = parseArgs(process.argv.slice(2));
  if (args.port) {
    const port = parseInt(args.port, 10);
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      config.port = port;
    }
  }
  if (args.data) {
    config.dataPath = args.data;
  }
  if (typeof args['auto-open'] !== 'undefined') {
    config.autoOpenBrowser = args['auto-open'] !== 'false';
  }
  return config;
}

/**
 * Sanitise a tab name to prevent path traversal and invalid characters.
 * Allowed: alphanumeric characters and hyphen.
 * @param {string} name
 */
function sanitizeTabName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Sanitise filenames by stripping directory traversal characters.
 * @param {string} filename
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return null;
  const base = path.basename(filename).replace(/[\\/]/g, '');
  return base.replace(/[^A-Za-z0-9._-]/g, '-');
}

/**
 * Ensures directory exists.
 * @param {string} dir
 */
async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Reads metadata.json and returns structure.
 */
async function readMetadata(metadataPath) {
  try {
    const raw = await fsp.readFile(metadataPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.tabs)) {
      parsed.tabs = [];
    }
    return parsed;
  } catch (error) {
    return { tabs: [] };
  }
}

/**
 * Writes metadata to disk atomically.
 */
async function writeMetadata(metadataPath, data) {
  const tmpPath = `${metadataPath}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fsp.rename(tmpPath, metadataPath);
}

/**
 * Finds tab entry by name.
 */
function findTab(metadata, name) {
  const index = metadata.tabs.findIndex((tab) => tab.name === name);
  if (index === -1) return { index: -1, tab: null };
  return { index, tab: metadata.tabs[index] };
}

/**
 * Creates a unique filename if the target already exists.
 */
async function ensureUniqueFilename(dir, filename) {
  let target = filename;
  let counter = 1;
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  while (true) {
    try {
      await fsp.access(path.join(dir, target));
      counter += 1;
      target = `${basename}-${counter}${ext}`;
    } catch (_) {
      return target;
    }
  }
}

/**
 * Deletes a file if it exists. Ignores errors.
 */
async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (_) {
    // ignore
  }
}

(async () => {
  const config = await loadConfig();
  const dataDir = path.resolve(APP_ROOT, config.dataPath);
  const metadataPath = path.join(dataDir, 'metadata.json');

  await ensureDir(dataDir);
  await ensureDir(UPLOADS_DIR);

  if (!(await fsp.access(metadataPath).then(() => true).catch(() => false))) {
    await writeMetadata(metadataPath, { tabs: [] });
  }

  const app = express();
  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.static(path.join(APP_ROOT, 'public')));

  const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureDir(UPLOADS_DIR);
        cb(null, UPLOADS_DIR);
      } catch (error) {
        cb(error);
      }
    },
    filename: (_req, file, cb) => {
      const safe = sanitizeFilename(file.originalname) || `image-${Date.now()}`;
      cb(null, `${Date.now()}-${safe}`);
    }
  });

  const uploadMiddleware = multer({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 10
    },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image uploads are allowed'));
      }
    }
  });

  async function syncTabsWithFilesystem() {
    const metadata = await readMetadata(metadataPath);
    metadata.tabs = metadata.tabs.reduce((acc, tab) => {
      const safeName = sanitizeTabName(tab.name);
      if (!safeName) return acc;
      acc.push({
        name: safeName,
        batches: Array.isArray(tab.batches) ? tab.batches : []
      });
      return acc;
    }, []);
    const entries = await fsp.readdir(dataDir, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('.'));

    for (const name of directories) {
      if (!metadata.tabs.some((tab) => tab.name === name)) {
        metadata.tabs.push({ name, batches: [] });
      }
    }

    for (const tab of metadata.tabs) {
      const tabDir = path.join(dataDir, tab.name);
      await ensureDir(tabDir);
      if (!Array.isArray(tab.batches)) {
        tab.batches = [];
      }
    }

    await writeMetadata(metadataPath, metadata);
    return metadata;
  }

  await syncTabsWithFilesystem();

  /**
   * GET /api/tabs - list tabs.
   */
  app.get('/api/tabs', async (_req, res, next) => {
    try {
      const metadata = await readMetadata(metadataPath);
      res.json({ tabs: metadata.tabs.map((tab) => ({ name: tab.name, batches: tab.batches.length })) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/tabs - create new tab.
   */
  app.post('/api/tabs', async (req, res, next) => {
    try {
      const rawName = req.body?.name;
      const name = sanitizeTabName(rawName || '');
      if (!name) {
        return res.status(400).json({ message: 'Invalid tab name. Use letters, numbers, hyphen or underscore.' });
      }

      const metadata = await readMetadata(metadataPath);
      if (metadata.tabs.some((tab) => tab.name === name)) {
        return res.status(409).json({ message: 'Tab already exists.' });
      }

      metadata.tabs.push({ name, batches: [] });
      await ensureDir(path.join(dataDir, name));
      await writeMetadata(metadataPath, metadata);
      log(`Created tab ${name}`);
      res.status(201).json({ name });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/tabs/:name - rename tab.
   */
  app.put('/api/tabs/:name', async (req, res, next) => {
    try {
      const currentName = sanitizeTabName(req.params.name);
      const raw = req.body?.newName;
      const newName = sanitizeTabName(raw || '');
      if (!currentName || !newName) {
        return res.status(400).json({ message: 'Invalid tab name.' });
      }
      if (currentName === newName) {
        return res.status(200).json({ name: newName });
      }

      const metadata = await readMetadata(metadataPath);
      const { index } = findTab(metadata, currentName);
      if (index === -1) {
        return res.status(404).json({ message: 'Tab not found.' });
      }
      if (metadata.tabs.some((tab) => tab.name === newName)) {
        return res.status(409).json({ message: 'Target tab already exists.' });
      }

      const oldDir = path.join(dataDir, currentName);
      const newDir = path.join(dataDir, newName);
      await fsp.rename(oldDir, newDir);
      metadata.tabs[index].name = newName;
      await writeMetadata(metadataPath, metadata);
      log(`Renamed tab ${currentName} to ${newName}`);
      res.json({ name: newName });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/tabs/:name - delete tab and contents.
   */
  app.delete('/api/tabs/:name', async (req, res, next) => {
    try {
      const name = sanitizeTabName(req.params.name);
      if (!name) {
        return res.status(400).json({ message: 'Invalid tab name.' });
      }

      const metadata = await readMetadata(metadataPath);
      const { index } = findTab(metadata, name);
      if (index === -1) {
        return res.status(404).json({ message: 'Tab not found.' });
      }

      metadata.tabs.splice(index, 1);
      await writeMetadata(metadataPath, metadata);
      await fsp.rm(path.join(dataDir, name), { recursive: true, force: true });
      log(`Deleted tab ${name}`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/tabs/:name/batches - list batches.
   */
  app.get('/api/tabs/:name/batches', async (req, res, next) => {
    try {
      const name = sanitizeTabName(req.params.name);
      if (!name) {
        return res.status(400).json({ message: 'Invalid tab name.' });
      }
      const metadata = await readMetadata(metadataPath);
      const { tab } = findTab(metadata, name);
      if (!tab) {
        return res.status(404).json({ message: 'Tab not found.' });
      }
      res.json({ batches: tab.batches || [] });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/tabs/:name/batches - create batch.
   */
  app.post('/api/tabs/:name/batches', async (req, res, next) => {
    try {
      const name = sanitizeTabName(req.params.name);
      if (!name) {
        return res.status(400).json({ message: 'Invalid tab name.' });
      }
      const { description = '', images = [] } = req.body || {};
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ message: 'Provide at least one image for the batch.' });
      }

      const metadata = await readMetadata(metadataPath);
      const { index, tab } = findTab(metadata, name);
      if (!tab) {
        return res.status(404).json({ message: 'Tab not found.' });
      }

      const tabDir = path.join(dataDir, name);
      const safeImages = [];
      for (const image of images) {
        const safe = sanitizeFilename(image);
        if (!safe) continue;
        const imagePath = path.join(tabDir, safe);
        try {
          await fsp.access(imagePath, fs.constants.F_OK);
          safeImages.push(safe);
        } catch (_) {
          log(`Missing image referenced in batch creation: ${imagePath}`, 'WARN');
        }
      }

      if (!safeImages.length) {
        return res.status(400).json({ message: 'No valid images found for batch.' });
      }

      const batch = {
        description: typeof description === 'string' ? description : '',
        images: safeImages,
        createdAt: new Date().toISOString()
      };
      tab.batches = tab.batches || [];
      tab.batches.unshift(batch);
      metadata.tabs[index] = tab;
      await writeMetadata(metadataPath, metadata);
      log(`Created batch in tab ${name} with ${safeImages.length} images`);
      res.status(201).json({ index: 0, batch });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/tabs/:name/batches/:index - update description.
   */
  app.put('/api/tabs/:name/batches/:index', async (req, res, next) => {
    try {
      const name = sanitizeTabName(req.params.name);
      const idx = parseInt(req.params.index, 10);
      if (!name || Number.isNaN(idx) || idx < 0) {
        return res.status(400).json({ message: 'Invalid batch reference.' });
      }
      const { description = '' } = req.body || {};

      const metadata = await readMetadata(metadataPath);
      const { tab } = findTab(metadata, name);
      if (!tab) {
        return res.status(404).json({ message: 'Tab not found.' });
      }
      if (!Array.isArray(tab.batches) || !tab.batches[idx]) {
        return res.status(404).json({ message: 'Batch not found.' });
      }
      tab.batches[idx].description = typeof description === 'string' ? description : '';
      tab.batches[idx].updatedAt = new Date().toISOString();
      await writeMetadata(metadataPath, metadata);
      res.json({ batch: tab.batches[idx] });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/tabs/:name/batches/:index - delete batch and its files.
   */
  app.delete('/api/tabs/:name/batches/:index', async (req, res, next) => {
    try {
      const name = sanitizeTabName(req.params.name);
      const idx = parseInt(req.params.index, 10);
      if (!name || Number.isNaN(idx) || idx < 0) {
        return res.status(400).json({ message: 'Invalid batch reference.' });
      }

      const metadata = await readMetadata(metadataPath);
      const { tab } = findTab(metadata, name);
      if (!tab || !Array.isArray(tab.batches) || !tab.batches[idx]) {
        return res.status(404).json({ message: 'Batch not found.' });
      }
      const removed = tab.batches.splice(idx, 1)[0];
      await writeMetadata(metadataPath, metadata);
      const tabDir = path.join(dataDir, name);
      for (const filename of removed.images || []) {
        await safeUnlink(path.join(tabDir, sanitizeFilename(filename)));
      }
      log(`Deleted batch ${idx} from tab ${name}`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE single image from batch.
   */
  app.delete('/api/tabs/:name/batches/:batchIndex/images/:filename', async (req, res, next) => {
    try {
      const name = sanitizeTabName(req.params.name);
      const idx = parseInt(req.params.batchIndex, 10);
      const filename = sanitizeFilename(req.params.filename);
      if (!name || Number.isNaN(idx) || idx < 0 || !filename) {
        return res.status(400).json({ message: 'Invalid reference.' });
      }

      const metadata = await readMetadata(metadataPath);
      const { tab } = findTab(metadata, name);
      if (!tab || !Array.isArray(tab.batches) || !tab.batches[idx]) {
        return res.status(404).json({ message: 'Batch not found.' });
      }
      const batch = tab.batches[idx];
      const imageIdx = batch.images.findIndex((img) => img === filename);
      if (imageIdx === -1) {
        return res.status(404).json({ message: 'Image not found.' });
      }
      batch.images.splice(imageIdx, 1);
      await safeUnlink(path.join(dataDir, name, filename));
      await writeMetadata(metadataPath, metadata);
      log(`Deleted image ${filename} from batch ${idx} in tab ${name}`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/upload - handle multipart image upload.
   */
  app.post('/api/upload', uploadMiddleware.array('files', 10), async (req, res, next) => {
    try {
      const tab = sanitizeTabName(req.body?.tab || '');
      if (!tab) {
        return res.status(400).json({ message: 'Tab is required.' });
      }

      const metadata = await readMetadata(metadataPath);
      const { tab: tabEntry } = findTab(metadata, tab);
      if (!tabEntry) {
        return res.status(404).json({ message: 'Tab not found.' });
      }

      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ message: 'Upload at least one file.' });
      }

      const totalSize = files.reduce((acc, file) => acc + (file.size || 0), 0);
      const maxTotal = 50 * 1024 * 1024;
      if (totalSize > maxTotal) {
        return res.status(400).json({ message: 'Upload exceeds allowed total size of 50MB.' });
      }

      const tabDir = path.join(dataDir, tab);
      await ensureDir(tabDir);
      const storedNames = [];
      for (const file of files) {
        const safeOriginal = sanitizeFilename(file.originalname) || file.filename;
        const ext = path.extname(safeOriginal) || path.extname(file.filename) || '.png';
        const preferred = sanitizeFilename(path.basename(safeOriginal, ext)) || `image-${Date.now()}`;
        const filename = await ensureUniqueFilename(tabDir, `${preferred}${ext}`);
        const target = path.join(tabDir, filename);
        await fsp.copyFile(file.path, target);
        await safeUnlink(file.path);
        storedNames.push(filename);
      }

      res.status(201).json({ filenames: storedNames });
    } catch (error) {
      next(error);
    } finally {
      for (const file of req.files || []) {
        await safeUnlink(file.path);
      }
    }
  });

  /**
   * GET /api/images/:tab/:filename - serve image.
   */
  app.get('/api/images/:tab/:filename', async (req, res, next) => {
    try {
      const tab = sanitizeTabName(req.params.tab);
      const filename = sanitizeFilename(req.params.filename);
      if (!tab || !filename) {
        return res.status(400).json({ message: 'Invalid path.' });
      }
      const filePath = path.join(dataDir, tab, filename);
      res.sendFile(filePath, (err) => {
        if (err) next(err);
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/metadata - return metadata.json contents.
   */
  app.get('/api/metadata', async (_req, res, next) => {
    try {
      const metadata = await readMetadata(metadataPath);
      res.json(metadata);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Generic error handler to avoid leaking stack traces to clients.
   */
  app.use((err, _req, res, _next) => {
    const status = err instanceof multer.MulterError ? 400 : 500;
    const message = err instanceof multer.MulterError ? err.message : 'An unexpected error occurred.';
    log(err.message, 'ERROR');
    if (err.stack) {
      log(err.stack, 'DEBUG');
    }
    res.status(status).json({ message });
  });

  const server = http.createServer(app);

  server.listen(config.port, '0.0.0.0', () => {
    const networks = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(networks)) {
      for (const iface of networks[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }
    const localUrl = `http://localhost:${config.port}`;
    log('Server running at:');
    log(`  - Local: ${localUrl}`);
    if (addresses.length) {
      for (const address of addresses) {
        log(`  - Network: http://${address}:${config.port}`);
      }
    } else {
      log('  - Network: Unable to determine local IP', 'WARN');
    }

    if (config.autoOpenBrowser) {
      const url = localUrl;
      let command;
      if (process.platform === 'win32') {
        command = `start "" "${url}"`;
      } else if (process.platform === 'darwin') {
        command = `open "${url}"`;
      } else {
        command = `xdg-open "${url}"`;
      }
      exec(command, (error) => {
        if (error) {
          log(`Failed to auto-open browser: ${error.message}`, 'WARN');
        }
      });
    }
  });

  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down...');
    server.close(() => {
      log('Server stopped.');
      process.exit(0);
    });
  });
})();
