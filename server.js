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
const EXPORT_DIR_NAME = '+EXPORT';

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
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
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
 * Preserve filesystem filename while preventing directory traversal.
 * Unlike sanitizeFilename, this keeps non-ASCII characters intact.
 * @param {string} filename
 */
function normalizeStoredFilename(filename) {
  if (typeof filename !== 'string') return null;
  const base = path.basename(filename).replace(/[\\/]/g, '').trim();
  return base || null;
}

/**
 * Creates a compact batch id.
 */
function createBatchId() {
  return `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Ensures all batches have unique stable IDs.
 * Returns true if any IDs were added or replaced.
 */
function ensureBatchIds(metadata) {
  let changed = false;
  const seen = new Set();
  for (const tab of metadata.tabs || []) {
    if (!Array.isArray(tab.batches)) {
      tab.batches = [];
      changed = true;
      continue;
    }
    tab.batches = tab.batches.map((batch) => {
      const next = batch && typeof batch === 'object' ? batch : {};
      let id = typeof next.id === 'string' ? next.id.trim() : '';
      if (!id || seen.has(id)) {
        do {
          id = createBatchId();
        } while (seen.has(id));
        changed = true;
      }
      seen.add(id);
      if (next.id !== id) {
        return { ...next, id };
      }
      return next;
    });
  }
  return changed;
}

/**
 * Ensures each batch has a normalized liked[] array that references existing images only.
 * Returns true if any batch liked state changed.
 */
function ensureBatchLikes(metadata) {
  let changed = false;
  for (const tab of metadata.tabs || []) {
    const batches = Array.isArray(tab?.batches) ? tab.batches : [];
    for (const batch of batches) {
      if (!batch || typeof batch !== 'object') continue;
      const images = Array.isArray(batch.images)
        ? batch.images
          .map((name) => normalizeStoredFilename(name))
          .filter((name) => name)
        : [];
      const imageSet = new Set(images);

      const rawLiked = Array.isArray(batch.liked) ? batch.liked : [];
      const nextLiked = [];
      const seen = new Set();
      for (const raw of rawLiked) {
        const filename = normalizeStoredFilename(raw);
        if (!filename || !imageSet.has(filename) || seen.has(filename)) {
          changed = true;
          continue;
        }
        seen.add(filename);
        nextLiked.push(filename);
      }

      if (!Array.isArray(batch.liked)) {
        batch.liked = [];
        changed = true;
      }

      if (
        !Array.isArray(batch.liked) ||
        batch.liked.length !== nextLiked.length ||
        batch.liked.some((name, idx) => name !== nextLiked[idx])
      ) {
        batch.liked = nextLiked;
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Ensures all batch-level metadata invariants.
 */
function ensureBatchMetadata(metadata) {
  let changed = false;
  if (ensureBatchIds(metadata)) changed = true;
  if (ensureBatchLikes(metadata)) changed = true;
  return changed;
}

/**
 * Resolve a batch index from optional index + optional batchId.
 * batchId wins if provided.
 */
function resolveBatchIndex(tab, indexRaw, batchIdRaw) {
  const batches = Array.isArray(tab?.batches) ? tab.batches : [];
  const batchId = typeof batchIdRaw === 'string' ? batchIdRaw.trim() : '';
  if (batchId) {
    return batches.findIndex((batch) => batch?.id === batchId);
  }
  const idx = typeof indexRaw === 'number' ? indexRaw : parseInt(indexRaw, 10);
  if (Number.isNaN(idx) || idx < 0 || idx >= batches.length) {
    return -1;
  }
  return idx;
}

/**
 * Clamp numeric value to [min, max].
 */
function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Count image references inside a tab.
 * Optionally skip one batch index.
 */
function buildTabImageUsage(tab, skipBatchIndex = -1) {
  const usage = new Map();
  const batches = Array.isArray(tab?.batches) ? tab.batches : [];
  for (let idx = 0; idx < batches.length; idx += 1) {
    if (idx === skipBatchIndex) continue;
    const images = Array.isArray(batches[idx]?.images) ? batches[idx].images : [];
    for (const raw of images) {
      const filename = normalizeStoredFilename(raw);
      if (!filename) continue;
      usage.set(filename, (usage.get(filename) || 0) + 1);
    }
  }
  return usage;
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
 * Only returns empty structure if the file does not exist.
 * Throws on corruption or permission errors to prevent silent data loss.
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
    if (error.code === 'ENOENT') {
      return { tabs: [] };
    }
    throw error;
  }
}

/**
 * Writes metadata to disk atomically.
 * Includes retry logic for transient EPERM errors on Windows (e.g. antivirus file locks).
 */
async function writeMetadata(metadataPath, data) {
  const tmpPath = `${metadataPath}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2));
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fsp.rename(tmpPath, metadataPath);
      return;
    } catch (err) {
      if (err.code === 'EPERM' && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Creates a backup copy of metadata.json.
 */
async function backupMetadata(metadataPath) {
  try {
    await fsp.copyFile(metadataPath, `${metadataPath}.bak`);
  } catch (_) {
    // Nothing to back up if the file doesn't exist
  }
}

/**
 * Simple promise-based mutex for serializing metadata read-modify-write cycles.
 */
let _metadataQueue = Promise.resolve();

function withMetadataLock(fn) {
  const result = _metadataQueue.then(() => fn());
  _metadataQueue = result.then(() => {}, () => {});
  return result;
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
 * Creates a unique export filename using "name (1).ext" convention.
 */
async function ensureUniqueExportFilename(dir, filename) {
  let target = filename;
  let counter = 1;
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  while (true) {
    try {
      await fsp.access(path.join(dir, target));
      target = `${basename} (${counter})${ext}`;
      counter += 1;
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

  const MAX_FILES_PER_UPLOAD = 50;

  const uploadMiddleware = multer({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: MAX_FILES_PER_UPLOAD
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
    await backupMetadata(metadataPath);
    const metadata = await readMetadata(metadataPath);
    metadata.tabs = metadata.tabs.reduce((acc, tab) => {
      const safeName = sanitizeTabName(tab.name);
      if (safeName === EXPORT_DIR_NAME) return acc;
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
      .filter((name) => {
        if (name.startsWith('.')) return false;
        if (name === EXPORT_DIR_NAME) return false;
        return Boolean(sanitizeTabName(name));
      });

    for (const name of directories) {
      if (!metadata.tabs.some((tab) => tab.name === name)) {
        metadata.tabs.unshift({ name, batches: [] });
      }
    }

    for (const tab of metadata.tabs) {
      const tabDir = path.join(dataDir, tab.name);
      await ensureDir(tabDir);
      if (!Array.isArray(tab.batches)) {
        tab.batches = [];
      }
    }

    ensureBatchMetadata(metadata);

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
      const tabs = (metadata.tabs || [])
        .filter((tab) => tab?.name !== EXPORT_DIR_NAME)
        .map((tab) => ({ name: tab.name, batches: (tab.batches || []).length }));
      res.json({ tabs });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/tabs - create new tab.
   */
  app.post('/api/tabs', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const rawName = req.body?.name;
        const name = sanitizeTabName(rawName || '');
        if (!name) {
          return res.status(400).json({ message: 'Invalid tab name. Use letters, numbers, hyphen or underscore.' });
        }

        const metadata = await readMetadata(metadataPath);
        if (metadata.tabs.some((tab) => tab.name === name)) {
          return res.status(409).json({ message: 'Tab already exists.' });
        }

        metadata.tabs.unshift({ name, batches: [] });
        await ensureDir(path.join(dataDir, name));
        await writeMetadata(metadataPath, metadata);
        log(`Created tab ${name}`);
        res.status(201).json({ name });
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/tabs/reorder - reorder tabs by name.
   */
  app.put('/api/tabs/reorder', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const order = Array.isArray(req.body?.order) ? req.body.order : null;
        if (!order || !order.length || !order.every((name) => typeof name === 'string')) {
          return res.status(400).json({ message: 'Provide tab order as an array of tab names.' });
        }

        const metadata = await readMetadata(metadataPath);
        const currentNames = metadata.tabs.map((tab) => tab.name);
        if (order.length !== currentNames.length) {
          return res.status(400).json({ message: 'Tab order length mismatch.' });
        }

        const safeOrder = order.map((name) => sanitizeTabName(name || ''));
        if (safeOrder.some((name) => !name)) {
          return res.status(400).json({ message: 'Tab order contains invalid names.' });
        }

        const unique = new Set(safeOrder);
        if (unique.size !== safeOrder.length) {
          return res.status(400).json({ message: 'Tab order must not contain duplicates.' });
        }

        const currentSet = new Set(currentNames);
        for (const name of safeOrder) {
          if (!currentSet.has(name)) {
            return res.status(400).json({ message: `Unknown tab in order: ${name}` });
          }
        }

        metadata.tabs = safeOrder.map((name) => metadata.tabs.find((tab) => tab.name === name));
        await writeMetadata(metadataPath, metadata);
        res.json(metadata);
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/tabs/:name - rename tab.
   */
  app.put('/api/tabs/:name', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
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
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/tabs/:name - delete tab and contents.
   */
  app.delete('/api/tabs/:name', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
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
      });
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
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        if (!name) {
          return res.status(400).json({ message: 'Invalid tab name.' });
        }
        const { title = '', description = '', images = [] } = req.body || {};
        if (!Array.isArray(images) || images.length === 0) {
          return res.status(400).json({ message: 'Provide at least one image for the batch.' });
        }

        const metadata = await readMetadata(metadataPath);
        const { index, tab } = findTab(metadata, name);
        if (!tab) {
          return res.status(404).json({ message: 'Tab not found.' });
        }
        ensureBatchMetadata(metadata);

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
          id: createBatchId(),
          title: typeof title === 'string' ? title : '',
          description: typeof description === 'string' ? description : '',
          images: safeImages,
          liked: [],
          createdAt: new Date().toISOString()
        };
        tab.batches = tab.batches || [];
        tab.batches.unshift(batch);
        metadata.tabs[index] = tab;
        await writeMetadata(metadataPath, metadata);
        log(`Created batch in tab ${name} with ${safeImages.length} images`);
        res.status(201).json({ index: 0, batch });
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/tabs/:name/batches/:index - update description.
   */
  app.put('/api/tabs/:name/batches/:index', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        if (!name) {
          return res.status(400).json({ message: 'Invalid batch reference.' });
        }
        const { description, title, batchId } = req.body || {};

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { tab } = findTab(metadata, name);
        if (!tab) {
          return res.status(404).json({ message: 'Tab not found.' });
        }
        const idx = resolveBatchIndex(tab, req.params.index, batchId);
        if (!Array.isArray(tab.batches) || idx === -1 || !tab.batches[idx]) {
          return res.status(404).json({ message: 'Batch not found.' });
        }
        const batch = tab.batches[idx];
        let updated = false;

        if (description !== undefined) {
          if (typeof description !== 'string') {
            return res.status(400).json({ message: 'Description must be a string.' });
          }
          batch.description = description;
          updated = true;
        }

        if (title !== undefined) {
          if (typeof title !== 'string') {
            return res.status(400).json({ message: 'Title must be a string.' });
          }
          batch.title = title;
          updated = true;
        }

        if (updated) {
          batch.updatedAt = new Date().toISOString();
          await writeMetadata(metadataPath, metadata);
        }

        res.json({ index: idx, batch });
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/tabs/:name/batches/:index/like - toggle liked state for one image in batch.
   * Body: { filename: string, batchId?: string }
   */
  app.put('/api/tabs/:name/batches/:index/like', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        const filename = normalizeStoredFilename(req.body?.filename);
        const batchId = typeof req.body?.batchId === 'string' ? req.body.batchId : '';
        if (!name || !filename) {
          return res.status(400).json({ message: 'Invalid like target.' });
        }

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { tab } = findTab(metadata, name);
        if (!tab || !Array.isArray(tab.batches)) {
          return res.status(404).json({ message: 'Tab not found.' });
        }

        const idx = resolveBatchIndex(tab, req.params.index, batchId);
        if (idx === -1 || !tab.batches[idx]) {
          return res.status(404).json({ message: 'Batch not found.' });
        }

        const batch = tab.batches[idx];
        if (!Array.isArray(batch.images) || !batch.images.includes(filename)) {
          return res.status(404).json({ message: 'Image not found in batch.' });
        }
        if (!Array.isArray(batch.liked)) {
          batch.liked = [];
        }

        let liked = false;
        const likeIdx = batch.liked.findIndex((name) => name === filename);
        if (likeIdx === -1) {
          batch.liked.push(filename);
          liked = true;
        } else {
          batch.liked.splice(likeIdx, 1);
          liked = false;
        }

        batch.updatedAt = new Date().toISOString();
        await writeMetadata(metadataPath, metadata);
        res.json({ liked });
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/tabs/:name/reorder-batches - reorder batches inside a tab.
   * Supports order by old indices or by batch IDs.
   */
  app.put('/api/tabs/:name/reorder-batches', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        if (!name) {
          return res.status(400).json({ message: 'Invalid tab name.' });
        }

        const order = Array.isArray(req.body?.order) ? req.body.order : null;
        if (!order || !order.length) {
          return res.status(400).json({ message: 'Provide the new batch order.' });
        }

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { index: tabIndex, tab } = findTab(metadata, name);
        if (!tab || !Array.isArray(tab.batches)) {
          return res.status(404).json({ message: 'Tab not found.' });
        }

        const batchCount = tab.batches.length;
        if (order.length !== batchCount) {
          return res.status(400).json({ message: 'Batch order length mismatch.' });
        }

        let reordered = null;
        if (order.every((value) => Number.isInteger(value))) {
          const unique = new Set(order);
          if (unique.size !== order.length) {
            return res.status(400).json({ message: 'Batch order contains duplicates.' });
          }
          if (order.some((idx) => idx < 0 || idx >= batchCount)) {
            return res.status(400).json({ message: 'Batch order contains invalid indices.' });
          }
          reordered = order.map((idx) => tab.batches[idx]);
        } else if (order.every((value) => typeof value === 'string')) {
          const unique = new Set(order);
          if (unique.size !== order.length) {
            return res.status(400).json({ message: 'Batch order contains duplicates.' });
          }
          const existing = new Set(tab.batches.map((batch) => batch.id));
          for (const batchId of order) {
            if (!existing.has(batchId)) {
              return res.status(400).json({ message: `Unknown batch id: ${batchId}` });
            }
          }
          reordered = order.map((batchId) => tab.batches.find((batch) => batch.id === batchId));
        } else {
          return res.status(400).json({ message: 'Batch order must be all indices or all batch IDs.' });
        }

        tab.batches = reordered;
        metadata.tabs[tabIndex] = tab;
        await writeMetadata(metadataPath, metadata);
        res.json({ tab });
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/tabs/:name/reorder-images - move/reorder images within and between batches.
   * Supports one or many operations in one request.
   */
  app.put('/api/tabs/:name/reorder-images', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        if (!name) {
          return res.status(400).json({ message: 'Invalid tab name.' });
        }

        const operations = Array.isArray(req.body?.operations) ? req.body.operations : null;
        if (!operations || !operations.length) {
          return res.status(400).json({ message: 'Provide at least one reorder operation.' });
        }

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { index: tabIndex, tab } = findTab(metadata, name);
        if (!tab || !Array.isArray(tab.batches)) {
          return res.status(404).json({ message: 'Tab not found.' });
        }

        const touchedBatchIds = new Set();
        for (const operation of operations) {
          if (!operation || typeof operation !== 'object') {
            return res.status(400).json({ message: 'Each operation must be an object.' });
          }

          const sourceIdx = resolveBatchIndex(tab, operation.sourceBatch, operation.sourceBatchId);
          const targetIdx = resolveBatchIndex(tab, operation.targetBatch, operation.targetBatchId);
          if (sourceIdx === -1 || targetIdx === -1) {
            return res.status(400).json({ message: 'Operation contains an invalid source or target batch.' });
          }

          const sourceBatch = tab.batches[sourceIdx];
          const targetBatch = tab.batches[targetIdx];
          if (!Array.isArray(sourceBatch.images)) sourceBatch.images = [];
          if (!Array.isArray(targetBatch.images)) targetBatch.images = [];
          if (!Array.isArray(sourceBatch.liked)) sourceBatch.liked = [];
          if (!Array.isArray(targetBatch.liked)) targetBatch.liked = [];

          const requestedRaw = Array.isArray(operation.images) ? operation.images : [];
          const requested = requestedRaw
            .map((value) => (typeof value === 'string' ? normalizeStoredFilename(value) : null))
            .filter((value) => value);
          if (!requested.length) {
            continue;
          }

          const requestedSet = new Set(requested);
          const moving = sourceBatch.images.filter((filename) => requestedSet.has(filename));
          if (!moving.length) {
            continue;
          }
          const movingSet = new Set(moving);
          const movingLiked = sourceBatch.liked.filter((filename) => movingSet.has(filename));

          sourceBatch.images = sourceBatch.images.filter((filename) => !requestedSet.has(filename));
          sourceBatch.liked = sourceBatch.liked.filter((filename) => !movingSet.has(filename));

          const parsedInsert = parseInt(operation.insertIndex, 10);
          if (sourceIdx === targetIdx) {
            const insertIndex = clamp(
              Number.isNaN(parsedInsert) ? sourceBatch.images.length : parsedInsert,
              0,
              sourceBatch.images.length
            );
            sourceBatch.images.splice(insertIndex, 0, ...moving);
            const sourceLikedSet = new Set(sourceBatch.liked || []);
            for (const filename of movingLiked) {
              sourceLikedSet.add(filename);
            }
            sourceBatch.liked = Array.from(sourceLikedSet).filter((filename) => sourceBatch.images.includes(filename));
          } else {
            targetBatch.images = targetBatch.images.filter((filename) => !movingSet.has(filename));
            const targetLikedSet = new Set(targetBatch.liked || []);
            for (const filename of movingLiked) {
              targetLikedSet.add(filename);
            }
            const insertIndex = clamp(
              Number.isNaN(parsedInsert) ? targetBatch.images.length : parsedInsert,
              0,
              targetBatch.images.length
            );
            targetBatch.images.splice(insertIndex, 0, ...moving);
            targetBatch.liked = Array.from(targetLikedSet).filter((filename) => targetBatch.images.includes(filename));
          }

          touchedBatchIds.add(sourceBatch.id);
          touchedBatchIds.add(targetBatch.id);
        }

        if (touchedBatchIds.size) {
          const now = new Date().toISOString();
          for (const batch of tab.batches) {
            if (touchedBatchIds.has(batch.id)) {
              batch.updatedAt = now;
            }
          }
          metadata.tabs[tabIndex] = tab;
          await writeMetadata(metadataPath, metadata);
        }

        res.json({ tab });
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/tabs/:sourceTab/batches/:batchIndex/move - move a batch to another tab.
   * Body: { targetTab: string, batchId?: string }
   */
  app.post('/api/tabs/:sourceTab/batches/:batchIndex/move', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const sourceTabName = sanitizeTabName(req.params.sourceTab);
        const targetTabName = sanitizeTabName(req.body?.targetTab || '');
        if (!sourceTabName || !targetTabName) {
          return res.status(400).json({ message: 'Invalid source or target tab.' });
        }
        if (sourceTabName === targetTabName) {
          return res.status(400).json({ message: 'Source and target tabs must differ.' });
        }

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { index: sourceTabIndex, tab: sourceTab } = findTab(metadata, sourceTabName);
        const { index: targetTabIndex, tab: targetTab } = findTab(metadata, targetTabName);
        if (!sourceTab || !targetTab) {
          return res.status(404).json({ message: 'Source or target tab not found.' });
        }

        const batchIndex = resolveBatchIndex(sourceTab, req.params.batchIndex, req.body?.batchId);
        if (batchIndex === -1) {
          return res.status(404).json({ message: 'Batch not found.' });
        }

        const sourceBatch = sourceTab.batches[batchIndex];
        const sourceDir = path.join(dataDir, sourceTabName);
        const targetDir = path.join(dataDir, targetTabName);
        await ensureDir(targetDir);

        const sourceUsage = new Map();
        for (let idx = 0; idx < sourceTab.batches.length; idx += 1) {
          if (idx === batchIndex) continue;
          for (const file of sourceTab.batches[idx].images || []) {
            const normalized = normalizeStoredFilename(file);
            if (!normalized) continue;
            sourceUsage.set(normalized, (sourceUsage.get(normalized) || 0) + 1);
          }
        }

        const copiedTargets = [];
        const exclusiveSources = new Set();
        const movedImages = [];
        const movedNameMap = new Map();
        try {
          for (const originalRaw of sourceBatch.images || []) {
            const originalName = normalizeStoredFilename(originalRaw);
            if (!originalName) continue;
            const sourcePath = path.join(sourceDir, originalName);
            const targetName = await ensureUniqueFilename(targetDir, originalName);
            const targetPath = path.join(targetDir, targetName);

            try {
              await fsp.access(sourcePath, fs.constants.F_OK);
            } catch (_) {
              log(`Missing image during batch move: ${sourcePath}`, 'WARN');
              movedNameMap.set(originalName, originalName);
              movedImages.push(originalName);
              continue;
            }

            await fsp.copyFile(sourcePath, targetPath);
            copiedTargets.push(targetPath);
            movedNameMap.set(originalName, targetName);
            movedImages.push(targetName);
            if ((sourceUsage.get(originalName) || 0) === 0) {
              exclusiveSources.add(sourcePath);
            }
          }
        } catch (error) {
          for (const copiedPath of copiedTargets) {
            await safeUnlink(copiedPath);
          }
          throw error;
        }

        const movedLiked = [];
        const movedLikedSeen = new Set();
        for (const rawLiked of sourceBatch.liked || []) {
          const sourceLikedName = normalizeStoredFilename(rawLiked);
          if (!sourceLikedName) continue;
          const targetLikedName = movedNameMap.get(sourceLikedName) || sourceLikedName;
          if (movedLikedSeen.has(targetLikedName)) continue;
          movedLikedSeen.add(targetLikedName);
          movedLiked.push(targetLikedName);
        }

        const movedBatch = {
          ...sourceBatch,
          images: movedImages,
          liked: movedLiked,
          updatedAt: new Date().toISOString()
        };

        sourceTab.batches.splice(batchIndex, 1);
        targetTab.batches.unshift(movedBatch);
        metadata.tabs[sourceTabIndex] = sourceTab;
        metadata.tabs[targetTabIndex] = targetTab;

        try {
          await writeMetadata(metadataPath, metadata);
        } catch (error) {
          for (const copiedPath of copiedTargets) {
            await safeUnlink(copiedPath);
          }
          throw error;
        }

        for (const sourcePath of exclusiveSources) {
          try {
            await fsp.unlink(sourcePath);
          } catch (error) {
            log(`Failed to remove source image after move: ${sourcePath} (${error.message})`, 'WARN');
          }
        }

        res.json(metadata);
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/tabs/:name/batches/:index/images - append images to batch.
   */
  app.post('/api/tabs/:name/batches/:index/images', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        if (!name) {
          return res.status(400).json({ message: 'Invalid batch reference.' });
        }

        const images = Array.isArray(req.body?.images) ? req.body.images : [];
        if (!images.length) {
          return res.status(400).json({ message: 'Provide images to append.' });
        }

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { tab } = findTab(metadata, name);
        const idx = resolveBatchIndex(tab, req.params.index, req.body?.batchId);
        if (!tab || !Array.isArray(tab.batches) || idx === -1 || !tab.batches[idx]) {
          return res.status(404).json({ message: 'Batch not found.' });
        }

        const batch = tab.batches[idx];
        if (!Array.isArray(batch.images)) {
          batch.images = [];
        }

        const tabDir = path.join(dataDir, name);
        const appended = [];
        for (const image of images) {
          const safe = sanitizeFilename(image);
          if (!safe) continue;
          const target = path.join(tabDir, safe);
          try {
            await fsp.access(target, fs.constants.F_OK);
            if (!batch.images.includes(safe)) {
              batch.images.push(safe);
            }
            appended.push(safe);
          } catch (_) {
            log(`Missing image referenced for append: ${target}`, 'WARN');
          }
        }

        if (!appended.length) {
          return res.status(400).json({ message: 'No valid images found to append.' });
        }

        batch.updatedAt = new Date().toISOString();
        await writeMetadata(metadataPath, metadata);
        res.json({ index: idx, batch, appended });
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/tabs/:name/batches/:index - delete batch and its files.
   */
  app.delete('/api/tabs/:name/batches/:index', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        if (!name) {
          return res.status(400).json({ message: 'Invalid batch reference.' });
        }

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { tab } = findTab(metadata, name);
        const idx = resolveBatchIndex(tab, req.params.index, req.body?.batchId || req.query?.batchId);
        if (!tab || !Array.isArray(tab.batches) || idx === -1 || !tab.batches[idx]) {
          return res.status(404).json({ message: 'Batch not found.' });
        }
        const usage = buildTabImageUsage(tab, idx);
        const removed = tab.batches.splice(idx, 1)[0];
        await writeMetadata(metadataPath, metadata);
        const tabDir = path.join(dataDir, name);
        for (const raw of removed.images || []) {
          const filename = normalizeStoredFilename(raw);
          if (!filename) continue;
          if ((usage.get(filename) || 0) > 0) continue;
          await safeUnlink(path.join(tabDir, filename));
        }
        log(`Deleted batch ${idx} from tab ${name}`);
        res.status(204).end();
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE images from batch (bulk). Body: { filenames: string[] }
   */
  app.delete('/api/tabs/:name/batches/:batchIndex/images', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        const filenames = Array.isArray(req.body?.filenames) ? req.body.filenames : [];
        if (!name || !filenames.length) {
          return res.status(400).json({ message: 'Invalid reference.' });
        }

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { tab } = findTab(metadata, name);
        const idx = resolveBatchIndex(tab, req.params.batchIndex, req.body?.batchId || req.query?.batchId);
        if (!tab || !Array.isArray(tab.batches) || idx === -1 || !tab.batches[idx]) {
          return res.status(404).json({ message: 'Batch not found.' });
        }
        const batch = tab.batches[idx];
        const usageInOtherBatches = buildTabImageUsage(tab, idx);
        const deleted = [];
        if (!Array.isArray(batch.liked)) {
          batch.liked = [];
        }
        for (const raw of filenames) {
          const filename = normalizeStoredFilename(raw);
          if (!filename) continue;
          const imageIdx = batch.images.findIndex((img) => img === filename);
          if (imageIdx === -1) continue;
          batch.images.splice(imageIdx, 1);
          batch.liked = batch.liked.filter((name) => name !== filename);
          if ((usageInOtherBatches.get(filename) || 0) === 0 && !batch.images.includes(filename)) {
            await safeUnlink(path.join(dataDir, name, filename));
          }
          deleted.push(filename);
        }

        if (deleted.length) {
          await writeMetadata(metadataPath, metadata);
          log(`Deleted ${deleted.length} images from batch ${idx} in tab ${name}`);
        }
        res.status(204).end();
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE single image from batch.
   */
  app.delete('/api/tabs/:name/batches/:batchIndex/images/:filename', async (req, res, next) => {
    try {
      await withMetadataLock(async () => {
        const name = sanitizeTabName(req.params.name);
        const filename = normalizeStoredFilename(req.params.filename);
        if (!name || !filename) {
          return res.status(400).json({ message: 'Invalid reference.' });
        }

        const metadata = await readMetadata(metadataPath);
        ensureBatchMetadata(metadata);
        const { tab } = findTab(metadata, name);
        const idx = resolveBatchIndex(tab, req.params.batchIndex, req.body?.batchId || req.query?.batchId);
        if (!tab || !Array.isArray(tab.batches) || idx === -1 || !tab.batches[idx]) {
          return res.status(404).json({ message: 'Batch not found.' });
        }
        const batch = tab.batches[idx];
        const imageIdx = batch.images.findIndex((img) => img === filename);
        if (imageIdx === -1) {
          return res.status(404).json({ message: 'Image not found.' });
        }
        if (!Array.isArray(batch.liked)) {
          batch.liked = [];
        }
        const usageInOtherBatches = buildTabImageUsage(tab, idx);
        batch.images.splice(imageIdx, 1);
        batch.liked = batch.liked.filter((name) => name !== filename);
        if ((usageInOtherBatches.get(filename) || 0) === 0 && !batch.images.includes(filename)) {
          await safeUnlink(path.join(dataDir, name, filename));
        }
        await writeMetadata(metadataPath, metadata);
        log(`Deleted image ${filename} from batch ${idx} in tab ${name}`);
        res.status(204).end();
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/upload - handle multipart image upload.
   */
  app.post('/api/upload', uploadMiddleware.array('files', MAX_FILES_PER_UPLOAD), async (req, res, next) => {
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
   * POST /api/export-liked - export liked images from a tab into data/+EXPORT.
   * Body: { tab: string }
   */
  app.post('/api/export-liked', async (req, res, next) => {
    try {
      const tabName = sanitizeTabName(req.body?.tab || '');
      if (!tabName) {
        return res.status(400).json({ message: 'Invalid tab name.' });
      }

      const metadata = await readMetadata(metadataPath);
      const { tab } = findTab(metadata, tabName);
      if (!tab || !Array.isArray(tab.batches)) {
        return res.status(404).json({ message: 'Tab not found.' });
      }

      const likedFilenames = new Set();
      for (const batch of tab.batches) {
        const images = new Set(Array.isArray(batch?.images) ? batch.images : []);
        for (const raw of batch?.liked || []) {
          const filename = normalizeStoredFilename(raw);
          if (!filename || !images.has(filename)) continue;
          likedFilenames.add(filename);
        }
      }

      if (!likedFilenames.size) {
        return res.json({ exported: 0 });
      }

      const sourceDir = path.join(dataDir, tabName);
      const exportDir = path.join(dataDir, EXPORT_DIR_NAME);
      await ensureDir(exportDir);

      let exported = 0;
      for (const filename of likedFilenames) {
        const sourcePath = path.join(sourceDir, filename);
        try {
          // eslint-disable-next-line no-await-in-loop
          await fsp.access(sourcePath, fs.constants.F_OK);
        } catch (_) {
          log(`Missing image during export-liked: ${sourcePath}`, 'WARN');
          continue;
        }
        const targetName = await ensureUniqueExportFilename(exportDir, filename);
        const targetPath = path.join(exportDir, targetName);
        // eslint-disable-next-line no-await-in-loop
        await fsp.copyFile(sourcePath, targetPath);
        exported += 1;
      }

      res.json({ exported });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/images/:tab/:filename - serve image.
   */
  app.get('/api/images/:tab/:filename', async (req, res, next) => {
    try {
      const tab = sanitizeTabName(req.params.tab);
      const filename = normalizeStoredFilename(req.params.filename);
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
      metadata.tabs = (metadata.tabs || []).filter((tab) => tab?.name !== EXPORT_DIR_NAME);
      res.json(metadata);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Generic error handler to avoid leaking stack traces to clients.
   */
  app.use((err, _req, res, _next) => {
    const isMulter = err instanceof multer.MulterError;
    const status = isMulter ? 400 : 500;
    let message = isMulter ? err.message : 'An unexpected error occurred.';
    if (isMulter && err.code === 'LIMIT_FILE_COUNT') {
      message = `You can upload up to ${MAX_FILES_PER_UPLOAD} files at once.`;
    }
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
