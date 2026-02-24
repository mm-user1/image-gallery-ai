
'use strict';

const DND_TYPES = {
  IMAGE: 'application/x-gallery-image',
  TAB: 'application/x-gallery-tab'
};

function buildUrlWithQuery(path, query = null) {
  if (!query || typeof query !== 'object') return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function parseErrorMessage(res, fallback) {
  try {
    const payload = await res.json();
    if (payload && typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
  } catch (_) {
    // ignore
  }
  return fallback;
}

const api = {
  async getMetadata() {
    const res = await fetch(`/api/metadata?_=${Date.now()}`);
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to load metadata'));
    return res.json();
  },
  async createTab(name) {
    const res = await fetch('/api/tabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to create tab'));
    return res.json();
  },
  async renameTab(oldName, newName) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName })
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to rename tab'));
    return res.json();
  },
  async deleteTab(name) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to delete tab'));
  },
  async reorderTabs(order) {
    const res = await fetch('/api/tabs/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to reorder tabs'));
    return res.json();
  },
  async createBatch(tab, payload) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(tab)}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to create batch'));
    return res.json();
  },
  async updateBatch(tab, index, payload) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(tab)}/batches/${index}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to update batch'));
    return res.json();
  },
  async deleteBatch(tab, index, batchId) {
    const url = buildUrlWithQuery(`/api/tabs/${encodeURIComponent(tab)}/batches/${index}`, { batchId });
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to delete batch'));
  },
  async appendBatchImages(tab, index, payload) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(tab)}/batches/${index}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to add images to batch'));
    return res.json();
  },
  async deleteImage(tab, batchIndex, filename, batchId) {
    const url = buildUrlWithQuery(
      `/api/tabs/${encodeURIComponent(tab)}/batches/${batchIndex}/images/${encodeURIComponent(filename)}`,
      { batchId }
    );
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to delete image'));
  },
  async deleteImages(tab, batchIndex, filenames, batchId) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(tab)}/batches/${batchIndex}/images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames, batchId })
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to delete images'));
  },
  async reorderBatches(tab, order) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(tab)}/reorder-batches`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to reorder batches'));
    return res.json();
  },
  async reorderImages(tab, operations) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(tab)}/reorder-images`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations })
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to reorder images'));
    return res.json();
  },
  async moveBatch(sourceTab, batchIndex, payload) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(sourceTab)}/batches/${batchIndex}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to move batch'));
    return res.json();
  },
  async toggleLike(tab, batchIndex, payload) {
    const res = await fetch(`/api/tabs/${encodeURIComponent(tab)}/batches/${batchIndex}/like`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to update like'));
    return res.json();
  },
  async exportLiked(tab) {
    const res = await fetch('/api/export-liked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab })
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Unable to export liked images'));
    return res.json();
  }
};

function isTextInput(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el.type || '').toLowerCase();
  return type === 'text' || type === 'search';
}

function isInsideBatch(el, batchId) {
  if (!el || !batchId) return false;
  const holder = el.closest('[data-batch-id]');
  if (!holder) return false;
  return String(holder.getAttribute('data-batch-id')) === String(batchId);
}

function hasType(types, type) {
  if (!types) return false;
  if (typeof types.includes === 'function') return types.includes(type);
  if (typeof types.contains === 'function') return types.contains(type);
  return false;
}

function hasDragType(event, type) {
  const dt = event?.dataTransfer;
  if (!dt) return false;
  return hasType(dt.types, type) || hasType(dt.types, 'text/plain');
}

function hasFileDrag(event) {
  const dt = event?.dataTransfer;
  if (!dt) return false;
  return hasType(dt.types, 'Files');
}

function setDragPayload(dataTransfer, type, payload) {
  if (!dataTransfer) return;
  const value = JSON.stringify(payload || {});
  dataTransfer.setData(type, value);
  dataTransfer.setData('text/plain', JSON.stringify({ galleryType: type, payload: payload || {} }));
}

function getDragPayload(event, type) {
  const dt = event?.dataTransfer;
  if (!dt) return null;
  const direct = dt.getData(type);
  if (direct) {
    try {
      return JSON.parse(direct);
    } catch (_) {
      return null;
    }
  }
  const fallback = dt.getData('text/plain');
  if (!fallback) return null;
  try {
    const parsed = JSON.parse(fallback);
    if (parsed && parsed.galleryType === type) return parsed.payload || null;
  } catch (_) {
    // ignore
  }
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeSelector(value) {
  if (typeof value !== 'string') return '';
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[\\"']/g, '\\$&');
}

function normalizeBatchId(batch, fallback) {
  const raw = typeof batch?.id === 'string' ? batch.id.trim() : '';
  if (raw) return raw;
  const id = `legacy-${fallback}`;
  batch.id = id;
  return id;
}

function createCountDragImage(count) {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '-9999px';
  el.style.background = '#ffffff';
  el.style.border = '1px solid rgba(0, 0, 0, 0.2)';
  el.style.borderRadius = '10px';
  el.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
  el.style.padding = '8px 12px';
  el.style.fontWeight = '700';
  el.style.fontSize = '14px';
  el.style.color = '#1f1f1f';
  el.style.pointerEvents = 'none';
  el.textContent = `[${count}]`;
  return el;
}

class GalleryApp {
  constructor() {
    this.state = {
      metadata: { tabs: [] },
      activeTab: null,
      viewer: { source: null, tabName: null, items: [], index: -1 },
      favoritesFilterActive: false,
      search: {
        inputValue: '',
        query: '',
        debounceTimer: null
      },
      clipboardUploadInProgress: false,
      pendingPasteCapture: null,
      exportInProgress: false,
      pendingLikeRequests: new Set(),
      selectedImages: new Map(),
      pollingTimer: null,
      lastMetadataHash: null,
      batchUpdateTimers: new Map(),
      activeBatchDropZones: new Set(),
      pendingBatchRefresh: new Set(),
      pendingRemoteRender: false,
      openMoveDropdownBatchId: null,
      keyboardBatchMove: {
        activeBatchId: null,
        inFlight: false
      },
      drag: {
        inProgress: false,
        type: null,
        payload: null,
        tabInsertIndex: null,
        imageTarget: null,
        cleanupTimer: null,
        dragGhost: null
      }
    };

    this.elements = {
      tabList: document.getElementById('tabList'),
      createTabBtn: document.getElementById('createTab'),
      toggleEdit: document.getElementById('toggleEdit'),
      batchList: document.getElementById('batchList'),
      mainDropzoneCard: document.getElementById('mainDropzoneCard'),
      dropZone: document.getElementById('dropZone'),
      filePickerBtn: document.getElementById('filePickerBtn'),
      pasteImageBtn: document.getElementById('pasteImageBtn'),
      fileInput: document.getElementById('fileInput'),
      searchInput: document.getElementById('searchInput'),
      searchClear: document.getElementById('searchClear'),
      favoritesFilter: document.getElementById('favoritesFilter'),
      exportLiked: document.getElementById('exportLiked'),
      uploadProgress: document.getElementById('uploadProgress'),
      uploadProgressBar: document.getElementById('uploadProgressBar'),
      selectionActions: document.getElementById('selectionActions'),
      selectionSummary: document.getElementById('selectionSummary'),
      deleteSelected: document.getElementById('deleteSelected'),
      clearSelected: document.getElementById('clearSelected'),
      viewer: document.getElementById('viewer'),
      viewerContent: document.getElementById('viewerContent'),
      viewerImage: document.getElementById('viewerImage'),
      viewerPrev: document.getElementById('viewerPrev'),
      viewerNext: document.getElementById('viewerNext'),
      viewerClose: document.getElementById('viewerClose'),
      viewerLike: document.getElementById('viewerLike')
    };
  }

  async init() {
    this.bindGlobalEvents();
    this.updateHeaderControls();
    await this.refreshMetadata(true);
    this.startPolling();
  }

  isEditMode() {
    return document.body.classList.contains('edit-mode');
  }

  isSearchMode() {
    return Boolean(this.state.search.query);
  }

  isViewerOpen() {
    return this.elements.viewer.classList.contains('show');
  }

  setEditMode(enabled, options = {}) {
    const shouldEnable = Boolean(enabled);
    if (shouldEnable && this.isSearchMode()) {
      return;
    }
    const currentlyEnabled = this.isEditMode();
    if (shouldEnable === currentlyEnabled) {
      this.updateHeaderControls();
      return;
    }

    document.body.classList.toggle('edit-mode', shouldEnable);
    if (!shouldEnable) {
      this.state.activeBatchDropZones.clear();
      this.state.openMoveDropdownBatchId = null;
      this.deactivateKeyboardBatchMove({ render: false });
      this.clearSelection(false);
    }
    this.clearAllDragIndicators();
    if (options.render === false) {
      this.updateHeaderControls();
      return;
    }
    this.renderTabs();
    this.renderBatches();
  }

  getActiveTabEntry() {
    return this.state.metadata.tabs.find((tab) => tab.name === this.state.activeTab) || null;
  }

  getBatchKey(tabName, batchId) {
    return `${tabName || ''}:${batchId || ''}`;
  }

  getBatchById(tabName, batchId) {
    const tab = this.state.metadata.tabs.find((item) => item.name === tabName);
    if (!tab || !Array.isArray(tab.batches)) {
      return { tab: null, batch: null, index: -1 };
    }
    const index = tab.batches.findIndex((batch, idx) => normalizeBatchId(batch, `${tabName}-${idx}`) === batchId);
    if (index === -1) return { tab, batch: null, index: -1 };
    return { tab, batch: tab.batches[index], index };
  }

  getBatchIndexById(tabName, batchId) {
    return this.getBatchById(tabName, batchId).index;
  }

  isKeyboardBatchMoveActive() {
    return Boolean(this.state.keyboardBatchMove.activeBatchId) && this.isEditMode();
  }

  deactivateKeyboardBatchMove(options = {}) {
    const { render = true } = options;
    const hadActive = Boolean(this.state.keyboardBatchMove.activeBatchId);
    this.state.keyboardBatchMove.activeBatchId = null;
    if (render && hadActive) {
      this.renderBatches();
    }
  }

  activateKeyboardBatchMove(batchId) {
    if (!this.isEditMode()) return;
    if (!batchId) return;
    if (this.state.keyboardBatchMove.activeBatchId === batchId) {
      this.deactivateKeyboardBatchMove();
      return;
    }
    this.state.keyboardBatchMove.activeBatchId = batchId;
    this.renderBatches();
    this.scrollBatchIntoView(batchId);
    this.focusBatchMoveButton(batchId);
  }

  ensureKeyboardBatchMoveIsValid(options = {}) {
    const { render = false } = options;
    if (!this.state.keyboardBatchMove.activeBatchId) return;
    if (!this.isEditMode()) {
      this.deactivateKeyboardBatchMove({ render });
      return;
    }
    const index = this.getBatchIndexById(this.state.activeTab, this.state.keyboardBatchMove.activeBatchId);
    if (index === -1) {
      this.deactivateKeyboardBatchMove({ render });
    }
  }

  focusBatchMoveButton(batchId) {
    if (!batchId) return;
    requestAnimationFrame(() => {
      const selector = `.batch-move-btn[data-batch-id="${escapeSelector(batchId)}"]`;
      const button = this.elements.batchList.querySelector(selector);
      if (button && typeof button.focus === 'function') {
        button.focus({ preventScroll: true });
      }
    });
  }

  scrollBatchIntoView(batchId) {
    if (!batchId) return;
    requestAnimationFrame(() => {
      const selector = `.batch[data-batch-id="${escapeSelector(batchId)}"]`;
      const batchEl = this.elements.batchList.querySelector(selector);
      if (batchEl && typeof batchEl.scrollIntoView === 'function') {
        batchEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  getBatchMoveActionByKey(key) {
    if (key === 'ArrowUp') return { type: 'delta', value: -1 };
    if (key === 'ArrowDown') return { type: 'delta', value: 1 };
    if (key === 'PageUp') return { type: 'delta', value: -5 };
    if (key === 'PageDown') return { type: 'delta', value: 5 };
    if (key === 'Home') return { type: 'absolute', value: 0 };
    if (key === 'End') return { type: 'end' };
    return null;
  }

  async handleKeyboardBatchMove(action) {
    const moveState = this.state.keyboardBatchMove;
    if (!moveState.activeBatchId || moveState.inFlight) return;

    const tab = this.getActiveTabEntry();
    if (!tab || !Array.isArray(tab.batches) || !tab.batches.length) return;

    const activeBatchId = moveState.activeBatchId;
    const sourceIndex = this.getBatchIndexById(this.state.activeTab, activeBatchId);
    if (sourceIndex === -1) {
      this.deactivateKeyboardBatchMove();
      return;
    }

    let targetIndex = sourceIndex;
    if (action.type === 'delta') {
      targetIndex = clamp(sourceIndex + action.value, 0, tab.batches.length - 1);
    } else if (action.type === 'absolute') {
      targetIndex = clamp(action.value, 0, tab.batches.length - 1);
    } else if (action.type === 'end') {
      targetIndex = tab.batches.length - 1;
    }

    if (targetIndex === sourceIndex) {
      this.scrollBatchIntoView(activeBatchId);
      return;
    }

    moveState.inFlight = true;
    try {
      await this.flushPendingBatchUpdates();
      const order = tab.batches.map((batch, idx) => normalizeBatchId(batch, `${tab.name}-${idx}`));
      const currentSource = order.indexOf(activeBatchId);
      if (currentSource === -1) {
        this.deactivateKeyboardBatchMove();
        return;
      }

      const [moved] = order.splice(currentSource, 1);
      order.splice(targetIndex, 0, moved);

      const response = await api.reorderBatches(this.state.activeTab, order);
      if (response?.tab) {
        const tabIndex = this.state.metadata.tabs.findIndex((item) => item.name === this.state.activeTab);
        if (tabIndex !== -1) {
          this.state.metadata.tabs[tabIndex] = response.tab;
        }
      } else {
        await this.refreshMetadata(true, { forceRender: true });
        return;
      }

      this.state.lastMetadataHash = JSON.stringify(this.state.metadata);
      this.renderBatches();
      this.scrollBatchIntoView(activeBatchId);
      this.focusBatchMoveButton(activeBatchId);
    } catch (error) {
      alert(error.message);
      await this.refreshMetadata(true, { forceRender: true });
    } finally {
      moveState.inFlight = false;
    }
  }

  pruneBatchDropZones() {
    const tab = this.getActiveTabEntry();
    if (!tab) {
      this.state.activeBatchDropZones.clear();
      return;
    }

    const valid = new Set();
    tab.batches.forEach((batch, idx) => {
      const batchId = normalizeBatchId(batch, `${tab.name}-${idx}`);
      valid.add(this.getBatchKey(tab.name, batchId));
    });

    for (const key of Array.from(this.state.activeBatchDropZones)) {
      if (!valid.has(key)) {
        this.state.activeBatchDropZones.delete(key);
      }
    }
  }

  pruneSelection() {
    const tab = this.getActiveTabEntry();
    if (!tab) {
      if (this.state.selectedImages.size) {
        this.state.selectedImages.clear();
      }
      this.updateSelectionUI();
      return;
    }

    const valid = new Set();
    tab.batches.forEach((batch, idx) => {
      const batchId = normalizeBatchId(batch, `${tab.name}-${idx}`);
      for (const filename of batch.images || []) {
        valid.add(`${batchId}:${filename}`);
      }
    });

    for (const key of Array.from(this.state.selectedImages.keys())) {
      if (!valid.has(key)) {
        this.state.selectedImages.delete(key);
      }
    }

    this.updateSelectionUI();
  }

  clearSelection(render = true) {
    this.state.selectedImages.clear();
    this.updateSelectionUI();
    if (render) this.renderBatches();
  }
  bindGlobalEvents() {
    this.elements.createTabBtn.addEventListener('click', () => this.promptCreateTab());

    this.elements.toggleEdit.addEventListener('click', () => {
      if (this.isSearchMode()) return;
      this.setEditMode(!this.isEditMode());
    });

    this.elements.searchInput.addEventListener('input', () => this.handleSearchInput());
    this.elements.searchClear.addEventListener('click', () => this.clearSearch({ focusInput: true }));
    this.elements.favoritesFilter.addEventListener('click', () => this.toggleFavoritesFilter());
    this.elements.exportLiked.addEventListener('click', () => this.handleExportLiked());

    this.elements.filePickerBtn.addEventListener('click', () => this.elements.fileInput.click());
    this.elements.pasteImageBtn.addEventListener('click', () => this.handleClipboardPaste({ triggerButton: this.elements.pasteImageBtn }));
    this.elements.fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length) this.handleUpload(files);
      this.elements.fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      this.elements.dropZone.addEventListener(eventName, (e) => {
        if (!hasFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        this.elements.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      this.elements.dropZone.addEventListener(eventName, (e) => {
        if (!hasFileDrag(e) && eventName !== 'dragleave') return;
        e.preventDefault();
        e.stopPropagation();
        this.elements.dropZone.classList.remove('dragover');
      });
    });

    this.elements.dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) this.handleUpload(files);
    });

    this.elements.deleteSelected.addEventListener('click', () => this.deleteSelectedImages());
    this.elements.clearSelected.addEventListener('click', () => this.clearSelection());

    this.elements.viewerPrev.addEventListener('click', () => this.navigateViewer(-1));
    this.elements.viewerNext.addEventListener('click', () => this.navigateViewer(1));
    this.elements.viewerClose.addEventListener('click', () => this.closeViewer());
    this.elements.viewerLike.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleViewerLike();
    });
    this.elements.viewer.addEventListener('click', (e) => {
      if (e.target === this.elements.viewer || e.target === this.elements.viewerContent) {
        this.closeViewer();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (this.isViewerOpen()) {
        if (e.key === 'ArrowLeft') this.navigateViewer(-1);
        if (e.key === 'ArrowRight') this.navigateViewer(1);
        if (e.key === 'Escape') this.closeViewer();
        if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyF') {
          e.preventDefault();
          this.toggleViewerLike();
        }
        return;
      }

      if (this.isKeyboardBatchMoveActive()) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.deactivateKeyboardBatchMove();
          return;
        }

        const editingText = isTextInput(document.activeElement) || Boolean(document.activeElement?.isContentEditable);
        if (!editingText && !e.repeat) {
          const moveAction = this.getBatchMoveActionByKey(e.key);
          if (moveAction) {
            e.preventDefault();
            this.handleKeyboardBatchMove(moveAction);
            return;
          }
        }
      }

      if (e.key === 'Escape' && this.isEditMode()) {
        this.setEditMode(false);
      }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    this.elements.viewer.addEventListener('touchstart', (e) => {
      if (!this.elements.viewer.classList.contains('show')) return;
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    this.elements.viewer.addEventListener('touchend', (e) => {
      if (!this.elements.viewer.classList.contains('show')) return;
      const endX = e.changedTouches[0].screenX;
      const endY = e.changedTouches[0].screenY;
      this.handleSwipe(touchStartX, touchStartY, endX, endY);
    }, { passive: true });

    this.elements.viewerImage.addEventListener('click', (e) => {
      const rect = this.elements.viewerImage.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const imageWidth = rect.width;
      if (clickX < imageWidth / 2) {
        this.navigateViewer(-1);
      } else {
        this.navigateViewer(1);
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.move-to-wrap') && this.state.openMoveDropdownBatchId) {
        this.state.openMoveDropdownBatchId = null;
        this.renderBatches();
      }
    });

    this.elements.tabList.addEventListener('dragover', (e) => this.handleTabListDragOver(e));
    this.elements.tabList.addEventListener('drop', (e) => this.handleTabListDrop(e));
  }

  async refreshMetadata(initial = false, options = {}) {
    try {
      const metadata = await api.getMetadata();
      const tabs = Array.isArray(metadata?.tabs) ? metadata.tabs : [];
      this.state.metadata = {
        ...(metadata || {}),
        tabs: tabs
          .filter((tab) => tab && typeof tab.name === 'string' && tab.name !== '+EXPORT')
          .map((tab) => ({
            ...tab,
            batches: Array.isArray(tab?.batches)
              ? tab.batches.map((batch) => {
                const images = Array.isArray(batch?.images)
                  ? batch.images.filter((name) => typeof name === 'string' && name)
                  : [];
                const imageSet = new Set(images);
                const liked = Array.isArray(batch?.liked)
                  ? batch.liked.filter((name) => typeof name === 'string' && imageSet.has(name))
                  : [];
                return {
                  ...batch,
                  images,
                  liked
                };
              })
              : []
          }))
      };

      if (!this.state.activeTab || !this.state.metadata.tabs.find((tab) => tab.name === this.state.activeTab)) {
        this.state.activeTab = this.state.metadata.tabs[0]?.name || null;
      }

      this.pruneBatchDropZones();
      this.pruneSelection();
      this.ensureKeyboardBatchMoveIsValid({ render: false });

      const hash = JSON.stringify(this.state.metadata);
      if (!initial && hash === this.state.lastMetadataHash) {
        this.updateHeaderControls();
        return;
      }
      this.state.lastMetadataHash = hash;

      if (this.state.drag.inProgress && !options.forceRender) {
        this.state.pendingRemoteRender = true;
        this.updateHeaderControls();
        return;
      }

      this.syncViewerAfterDataChange();

      this.renderTabs();
      if (isTextInput(document.activeElement)) {
        this.state.pendingBatchRefresh.add('__all__');
      } else {
        this.renderBatches();
      }
      this.updateHeaderControls();
    } catch (error) {
      console.error(error);
      if (initial || options.forceRender) {
        alert(error.message);
      }
    }
  }

  startPolling() {
    if (this.state.pollingTimer) clearInterval(this.state.pollingTimer);
    this.state.pollingTimer = setInterval(() => this.refreshMetadata(false), 5000);
  }

  handleSearchInput() {
    const raw = this.elements.searchInput.value || '';
    this.state.search.inputValue = raw;
    if (this.state.search.debounceTimer) {
      clearTimeout(this.state.search.debounceTimer);
    }
    this.state.search.debounceTimer = setTimeout(() => this.applySearchQuery(raw), 300);
    this.updateHeaderControls();
  }

  applySearchQuery(rawValue) {
    const query = String(rawValue || '').trim().toLowerCase();
    if (query === this.state.search.query) {
      this.updateHeaderControls();
      return;
    }
    this.state.search.query = query;
    if (query && this.isEditMode()) {
      this.setEditMode(false, { render: false });
    }
    this.renderTabs();
    this.renderBatches();
    this.syncViewerAfterDataChange();
    this.updateHeaderControls();
  }

  clearSearch(options = {}) {
    const { render = true, focusInput = false } = options;
    if (this.state.search.debounceTimer) {
      clearTimeout(this.state.search.debounceTimer);
      this.state.search.debounceTimer = null;
    }
    this.state.search.inputValue = '';
    this.state.search.query = '';
    this.elements.searchInput.value = '';
    if (render) {
      this.renderTabs();
      this.renderBatches();
      this.syncViewerAfterDataChange();
    }
    this.updateHeaderControls();
    if (focusInput) this.elements.searchInput.focus();
  }

  toggleFavoritesFilter() {
    this.state.favoritesFilterActive = !this.state.favoritesFilterActive;
    this.syncViewerAfterDataChange();
    this.updateHeaderControls();
  }

  getLikedCountInTab(tabName) {
    if (!tabName) return 0;
    const tab = this.state.metadata.tabs.find((item) => item.name === tabName);
    if (!tab || !Array.isArray(tab.batches)) return 0;
    let total = 0;
    for (const batch of tab.batches) {
      if (Array.isArray(batch?.liked)) {
        total += batch.liked.length;
      }
    }
    return total;
  }

  updateHeaderControls() {
    const rawSearch = this.elements.searchInput.value || '';
    this.elements.searchClear.classList.toggle('visible', rawSearch.trim().length > 0);

    const hasActiveTab = Boolean(this.state.activeTab);
    const likedCount = this.getLikedCountInTab(this.state.activeTab);
    const favoritesText = likedCount > 0
      ? `${this.state.favoritesFilterActive ? '♥' : '♡'} ${likedCount}`
      : (this.state.favoritesFilterActive ? '♥' : '♡');
    this.elements.favoritesFilter.textContent = favoritesText;
    this.elements.favoritesFilter.classList.toggle('active', this.state.favoritesFilterActive);
    this.elements.favoritesFilter.setAttribute('aria-pressed', this.state.favoritesFilterActive ? 'true' : 'false');
    this.elements.favoritesFilter.disabled = !hasActiveTab;

    const showExport = this.state.favoritesFilterActive && likedCount > 0 && hasActiveTab;
    this.elements.exportLiked.classList.toggle('is-hidden', !showExport);
    this.elements.exportLiked.disabled = this.state.exportInProgress;

    this.elements.toggleEdit.disabled = this.isSearchMode();
  }

  async handleExportLiked() {
    if (!this.state.activeTab || this.state.exportInProgress) return;
    this.state.exportInProgress = true;
    this.updateHeaderControls();
    try {
      await api.exportLiked(this.state.activeTab);
    } catch (error) {
      alert(error.message);
    } finally {
      this.state.exportInProgress = false;
      this.updateHeaderControls();
    }
  }

  batchMatchesSearch(batch, query) {
    if (!query) return false;
    const title = typeof batch?.title === 'string' ? batch.title.toLowerCase() : '';
    const description = typeof batch?.description === 'string' ? batch.description.toLowerCase() : '';
    return title.includes(query) || description.includes(query);
  }

  getSearchResults() {
    const query = this.state.search.query;
    if (!query) return [];
    const groups = [];
    for (const tab of this.state.metadata.tabs) {
      const batches = [];
      const tabBatches = Array.isArray(tab?.batches) ? tab.batches : [];
      for (let batchIndex = 0; batchIndex < tabBatches.length; batchIndex += 1) {
        const batch = tabBatches[batchIndex];
        if (!this.batchMatchesSearch(batch, query)) continue;
        const batchId = normalizeBatchId(batch, `${tab.name}-${batchIndex}`);
        batches.push({ batch, batchId, batchIndex });
      }
      if (batches.length) {
        groups.push({
          tabName: tab.name,
          totalBatches: tabBatches.length,
          batches
        });
      }
    }
    return groups;
  }

  createHighlightedFragment(text, query) {
    const source = typeof text === 'string' ? text : '';
    const fragment = document.createDocumentFragment();
    if (!query) {
      fragment.appendChild(document.createTextNode(source));
      return fragment;
    }

    const lowered = source.toLowerCase();
    let cursor = 0;
    while (cursor < source.length) {
      const foundAt = lowered.indexOf(query, cursor);
      if (foundAt === -1) {
        fragment.appendChild(document.createTextNode(source.slice(cursor)));
        break;
      }
      if (foundAt > cursor) {
        fragment.appendChild(document.createTextNode(source.slice(cursor, foundAt)));
      }
      const mark = document.createElement('mark');
      mark.textContent = source.slice(foundAt, foundAt + query.length);
      fragment.appendChild(mark);
      cursor = foundAt + query.length;
    }

    return fragment;
  }

  createSearchMetaRow(label, value, query) {
    const wrap = document.createElement('div');
    wrap.className = 'search-meta';

    const labelEl = document.createElement('div');
    labelEl.className = 'search-meta-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const valueEl = document.createElement('div');
    valueEl.className = 'search-meta-value';
    valueEl.appendChild(this.createHighlightedFragment(value || '', query));
    wrap.appendChild(valueEl);
    return wrap;
  }

  renderSearchResults() {
    const list = this.elements.batchList;
    list.innerHTML = '';
    const query = this.state.search.query;
    const groups = this.getSearchResults();
    if (!groups.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = `No results for "${this.elements.searchInput.value || query}"`;
      list.appendChild(empty);
      return;
    }

    groups.forEach((group) => {
      const groupEl = document.createElement('section');
      groupEl.className = 'search-tab-group';

      const groupTitle = document.createElement('div');
      groupTitle.className = 'search-tab-header';
      groupTitle.textContent = `Tab: ${group.tabName}`;
      groupEl.appendChild(groupTitle);

      group.batches.forEach(({ batch, batchIndex, batchId }) => {
        const batchEl = document.createElement('section');
        batchEl.className = 'batch search-result-batch';
        batchEl.dataset.batchId = batchId;
        batchEl.dataset.tab = group.tabName;

        const title = document.createElement('div');
        title.className = 'batch-title';
        title.textContent = this.formatBatchLabel(batch, batchIndex, group.totalBatches);
        batchEl.appendChild(title);

        const thumbRow = document.createElement('div');
        thumbRow.className = 'thumbnail-row';
        (batch.images || []).forEach((filename, imageIndex) => {
          const thumb = document.createElement('div');
          thumb.className = 'thumbnail';
          thumb.dataset.filename = filename;
          thumb.dataset.batchIndex = String(batchIndex);
          thumb.dataset.batchId = batchId;

          const img = document.createElement('img');
          img.src = `/api/images/${encodeURIComponent(group.tabName)}/${encodeURIComponent(filename)}`;
          img.alt = filename;
          img.loading = 'lazy';

          const likeBtn = this.createLikeButton({
            tabName: group.tabName,
            batchIndex,
            batchId,
            filename
          });

          thumb.addEventListener('click', (e) => {
            e.preventDefault();
            this.openViewerFromSearch(group.tabName, batchIndex, imageIndex, batchId);
          });

          thumb.appendChild(img);
          thumb.appendChild(likeBtn);
          thumbRow.appendChild(thumb);
        });
        batchEl.appendChild(thumbRow);

        batchEl.appendChild(this.createSearchMetaRow('Title', batch.title || '', query));
        batchEl.appendChild(this.createSearchMetaRow('Description', batch.description || '', query));

        groupEl.appendChild(batchEl);
      });

      list.appendChild(groupEl);
    });
  }

  createLikeButton({ tabName, batchIndex, batchId, filename }) {
    const button = document.createElement('button');
    button.className = 'thumb-like';
    button.type = 'button';
    button.draggable = false;
    button.dataset.tab = tabName;
    button.dataset.batchIndex = String(batchIndex);
    button.dataset.batchId = batchId;
    button.dataset.filename = filename;
    button.title = 'Toggle favorite';
    this.setLikeButtonVisual(button, this.isBatchLiked(tabName, batchId, filename));
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleLikeForImage({ tabName, batchIndex, batchId, filename });
    });
    return button;
  }

  setLikeButtonVisual(button, liked) {
    if (!button) return;
    button.classList.toggle('liked', liked);
    button.textContent = liked ? '♥' : '♡';
    button.setAttribute('aria-pressed', liked ? 'true' : 'false');
  }

  getLikeRequestKey(tabName, batchId, filename) {
    return `${tabName || ''}:${batchId || ''}:${filename || ''}`;
  }

  isBatchLiked(tabName, batchId, filename) {
    const { batch } = this.getBatchById(tabName, batchId);
    return Boolean(Array.isArray(batch?.liked) && batch.liked.includes(filename));
  }

  setBatchLikedState(tabName, batchId, filename, liked) {
    const { batch } = this.getBatchById(tabName, batchId);
    if (!batch) return;
    if (!Array.isArray(batch.liked)) batch.liked = [];
    const likeSet = new Set(batch.liked);
    if (liked) {
      likeSet.add(filename);
    } else {
      likeSet.delete(filename);
    }
    batch.liked = Array.from(likeSet);
  }

  refreshLikeButtonsForImage(tabName, batchId, filename) {
    const liked = this.isBatchLiked(tabName, batchId, filename);
    const selector = `.thumb-like[data-tab="${escapeSelector(tabName)}"][data-batch-id="${escapeSelector(batchId)}"][data-filename="${escapeSelector(filename)}"]`;
    this.elements.batchList.querySelectorAll(selector).forEach((button) => {
      this.setLikeButtonVisual(button, liked);
    });

    const current = this.state.viewer.items[this.state.viewer.index] || null;
    const sameAsViewer = current
      && current.tabName === tabName
      && current.batchId === batchId
      && current.filename === filename;
    if (sameAsViewer) {
      this.setLikeButtonVisual(this.elements.viewerLike, liked);
    }
  }

  async toggleLikeForImage({ tabName, batchIndex, batchId, filename }) {
    if (!tabName || !batchId || !filename) return;

    const requestKey = this.getLikeRequestKey(tabName, batchId, filename);
    if (this.state.pendingLikeRequests.has(requestKey)) return;

    const resolvedIndex = Number.isInteger(batchIndex) ? batchIndex : this.getBatchIndexById(tabName, batchId);
    if (resolvedIndex === -1) return;

    const previousLiked = this.isBatchLiked(tabName, batchId, filename);
    const optimisticLiked = !previousLiked;
    this.setBatchLikedState(tabName, batchId, filename, optimisticLiked);
    this.refreshLikeButtonsForImage(tabName, batchId, filename);
    this.updateHeaderControls();
    this.syncViewerAfterDataChange();

    this.state.pendingLikeRequests.add(requestKey);
    try {
      const response = await api.toggleLike(tabName, resolvedIndex, { filename, batchId });
      if (typeof response?.liked === 'boolean' && response.liked !== optimisticLiked) {
        this.setBatchLikedState(tabName, batchId, filename, response.liked);
        this.refreshLikeButtonsForImage(tabName, batchId, filename);
        this.syncViewerAfterDataChange();
      }
      this.state.lastMetadataHash = JSON.stringify(this.state.metadata);
    } catch (error) {
      this.setBatchLikedState(tabName, batchId, filename, previousLiked);
      this.refreshLikeButtonsForImage(tabName, batchId, filename);
      this.syncViewerAfterDataChange();
      alert(error.message);
    } finally {
      this.state.pendingLikeRequests.delete(requestKey);
      this.updateHeaderControls();
    }
  }

  toggleViewerLike() {
    const current = this.state.viewer.items[this.state.viewer.index] || null;
    if (!current) return;
    this.toggleLikeForImage(current);
  }

  async promptCreateTab() {
    const name = prompt('Enter a name for the new tab (letters, numbers, hyphen, underscore):');
    if (!name) return;
    try {
      const created = await api.createTab(name.trim());
      await this.refreshMetadata(true, { forceRender: true });
      this.state.activeTab = created?.name || name.trim();
      this.clearSelection(false);
      this.renderTabs();
      this.renderBatches();
    } catch (error) {
      alert(error.message);
    }
  }

  async renameTab(oldName, newName) {
    if (!newName || newName === oldName) return;
    try {
      await this.flushPendingBatchUpdates();
      await api.renameTab(oldName, newName);
      if (this.state.activeTab === oldName) this.state.activeTab = newName;
      await this.refreshMetadata(true, { forceRender: true });
    } catch (error) {
      alert(error.message);
      await this.refreshMetadata(true, { forceRender: true });
    }
  }

  async deleteTab(name) {
    if (!confirm(`Delete tab "${name}" and all of its batches?`)) return;
    try {
      await this.flushPendingBatchUpdates();
      await api.deleteTab(name);
      this.clearSelection(false);
      await this.refreshMetadata(true, { forceRender: true });
    } catch (error) {
      alert(error.message);
    }
  }

  beginDrag(type, payload) {
    this.state.drag.inProgress = true;
    this.state.drag.type = type;
    this.state.drag.payload = payload || null;
    this.state.drag.tabInsertIndex = null;
    this.state.drag.imageTarget = null;
  }

  scheduleDragCleanup() {
    if (this.state.drag.cleanupTimer) {
      clearTimeout(this.state.drag.cleanupTimer);
    }
    this.state.drag.cleanupTimer = setTimeout(() => this.finishDragCleanup(), 0);
  }

  finishDragCleanup() {
    if (this.state.drag.cleanupTimer) {
      clearTimeout(this.state.drag.cleanupTimer);
      this.state.drag.cleanupTimer = null;
    }

    if (this.state.drag.dragGhost && this.state.drag.dragGhost.parentNode) {
      this.state.drag.dragGhost.parentNode.removeChild(this.state.drag.dragGhost);
    }
    this.state.drag.dragGhost = null;

    const hadPendingRemoteRender = this.state.pendingRemoteRender;
    this.state.drag.inProgress = false;
    this.state.drag.type = null;
    this.state.drag.payload = null;
    this.state.drag.tabInsertIndex = null;
    this.state.drag.imageTarget = null;
    this.clearAllDragIndicators();

    if (hadPendingRemoteRender) {
      this.state.pendingRemoteRender = false;
      if (isTextInput(document.activeElement)) {
        this.state.pendingBatchRefresh.add('__all__');
      } else {
        this.renderTabs();
        this.renderBatches();
      }
    }
  }
  clearTabDragIndicators() {
    this.elements.tabList.querySelectorAll('.tab').forEach((el) => {
      el.classList.remove('drop-before', 'drop-after', 'dragging');
    });
  }

  applyTabDragIndicators() {
    this.clearTabDragIndicators();
    if (!this.state.drag.inProgress || this.state.drag.type !== DND_TYPES.TAB) return;

    const tabs = Array.from(this.elements.tabList.querySelectorAll('.tab'));
    if (!tabs.length) return;

    const draggedTabName = this.state.drag.payload?.tabName;
    if (draggedTabName) {
      const dragged = this.elements.tabList.querySelector(`.tab[data-tab="${escapeSelector(draggedTabName)}"]`);
      if (dragged) dragged.classList.add('dragging');
    }

    if (this.state.drag.tabInsertIndex === null || this.state.drag.tabInsertIndex === undefined) return;
    const insertIndex = clamp(this.state.drag.tabInsertIndex, 0, tabs.length);
    if (insertIndex <= 0) {
      tabs[0].classList.add('drop-before');
    } else if (insertIndex >= tabs.length) {
      tabs[tabs.length - 1].classList.add('drop-after');
    } else {
      tabs[insertIndex].classList.add('drop-before');
    }
  }

  clearImageDragIndicators() {
    this.elements.batchList.querySelectorAll('.thumbnail').forEach((el) => {
      el.classList.remove('drop-before', 'drop-after', 'dragging');
    });
    this.elements.batchList.querySelectorAll('.batch').forEach((el) => {
      el.classList.remove('drag-over');
    });
    this.elements.batchList.querySelectorAll('.thumbnail-row').forEach((el) => {
      el.classList.remove('drop-active');
      el.style.removeProperty('--drop-x');
      el.style.removeProperty('--drop-top');
      el.style.removeProperty('--drop-height');
    });
  }

  applyImageDragIndicators() {
    this.clearImageDragIndicators();
    if (!this.state.drag.inProgress || this.state.drag.type !== DND_TYPES.IMAGE) return;

    const payload = this.state.drag.payload;
    for (const group of payload?.groups || []) {
      for (const filename of group.images || []) {
        const selector = `.thumbnail[data-batch-id="${escapeSelector(group.batchId)}"][data-filename="${escapeSelector(filename)}"]`;
        const thumb = this.elements.batchList.querySelector(selector);
        if (thumb) thumb.classList.add('dragging');
      }
    }

    const target = this.state.drag.imageTarget;
    if (!target || !target.targetBatchId) return;

    const batchEl = this.elements.batchList.querySelector(`.batch[data-batch-id="${escapeSelector(target.targetBatchId)}"]`);
    if (!batchEl) return;
    batchEl.classList.add('drag-over');

    const row = batchEl.querySelector('.thumbnail-row');
    if (!row) return;
    if (
      Number.isFinite(target.indicatorX) &&
      Number.isFinite(target.indicatorTop) &&
      Number.isFinite(target.indicatorHeight)
    ) {
      row.style.setProperty('--drop-x', `${target.indicatorX}px`);
      row.style.setProperty('--drop-top', `${target.indicatorTop}px`);
      row.style.setProperty('--drop-height', `${target.indicatorHeight}px`);
      row.classList.add('drop-active');
    }
  }

  getThumbnailRowGap(rowEl) {
    if (!rowEl) return 16;
    const styles = window.getComputedStyle(rowEl);
    const raw = styles.columnGap || styles.gap || '16';
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 16;
  }

  collectThumbnailRows(rowEl) {
    const thumbs = Array.from(rowEl?.querySelectorAll('.thumbnail') || []);
    const tolerance = 8;
    const rows = [];

    thumbs.forEach((thumb, index) => {
      const rect = thumb.getBoundingClientRect();
      const item = {
        index,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2
      };

      const current = rows[rows.length - 1];
      if (!current || Math.abs(item.top - current.top) > tolerance) {
        rows.push({
          top: item.top,
          bottom: item.bottom,
          items: [item]
        });
      } else {
        current.items.push(item);
        current.top = Math.min(current.top, item.top);
        current.bottom = Math.max(current.bottom, item.bottom);
      }
    });

    return rows;
  }

  pickThumbnailRow(rows, clientY) {
    if (!rows.length) return null;
    if (clientY <= rows[0].top) return rows[0];

    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx];
      if (clientY >= row.top && clientY <= row.bottom) {
        return row;
      }

      const next = rows[idx + 1];
      if (!next) continue;
      if (clientY > row.bottom && clientY < next.top) {
        const midpoint = (row.bottom + next.top) / 2;
        return clientY < midpoint ? row : next;
      }
    }

    return rows[rows.length - 1];
  }

  calculateImageDropPosition(targetBatchId, rowEl, clientX, clientY) {
    const batchInfo = this.getBatchById(this.state.activeTab, targetBatchId);
    const current = Array.isArray(batchInfo?.batch?.images) ? batchInfo.batch.images : [];
    const rowRect = rowEl?.getBoundingClientRect?.();
    const rowHeight = rowRect?.height || 0;
    const rowWidth = rowRect?.width || 0;
    const fallbackX = clamp(
      Number.isFinite(clientX) && rowRect ? clientX - rowRect.left : 12,
      8,
      Math.max(8, rowWidth - 8)
    );
    const fallbackTop = 6;
    const fallbackHeight = Math.max(12, rowHeight - 12);

    const rows = this.collectThumbnailRows(rowEl);
    if (!rows.length) {
      return {
        insertIndex: 0,
        indicatorX: fallbackX,
        indicatorTop: fallbackTop,
        indicatorHeight: fallbackHeight
      };
    }

    const targetRow = this.pickThumbnailRow(rows, clientY) || rows[rows.length - 1];
    const rowItems = targetRow.items || [];
    if (!rowItems.length) {
      return {
        insertIndex: current.length,
        indicatorX: fallbackX,
        indicatorTop: fallbackTop,
        indicatorHeight: fallbackHeight
      };
    }

    let insertIndex = rowItems[rowItems.length - 1].index + 1;
    for (const item of rowItems) {
      if (clientX < item.centerX) {
        insertIndex = item.index;
        break;
      }
    }

    const gap = this.getThumbnailRowGap(rowEl);
    const first = rowItems[0];
    const last = rowItems[rowItems.length - 1];
    let indicatorX;

    if (insertIndex <= first.index) {
      indicatorX = first.left - rowRect.left - gap / 2;
    } else if (insertIndex > last.index) {
      indicatorX = last.right - rowRect.left + gap / 2;
    } else {
      const rightPos = rowItems.findIndex((item) => item.index === insertIndex);
      if (rightPos <= 0) {
        indicatorX = rowItems[0].left - rowRect.left - gap / 2;
      } else {
        const leftItem = rowItems[rightPos - 1];
        const rightItem = rowItems[rightPos];
        indicatorX = (leftItem.right + rightItem.left) / 2 - rowRect.left;
      }
    }

    indicatorX = clamp(indicatorX, 2, Math.max(2, rowWidth - 2));
    const indicatorTop = clamp(targetRow.top - rowRect.top + 6, 0, Math.max(0, rowHeight - 2));
    const rowBottom = clamp(targetRow.bottom - rowRect.top - 6, indicatorTop + 1, Math.max(indicatorTop + 1, rowHeight));
    const indicatorHeight = clamp(rowBottom - indicatorTop, 8, Math.max(8, rowHeight - indicatorTop));
    return {
      insertIndex: clamp(insertIndex, 0, current.length),
      indicatorX,
      indicatorTop,
      indicatorHeight
    };
  }

  clearAllDragIndicators() {
    this.clearTabDragIndicators();
    this.elements.batchList.querySelectorAll('.batch').forEach((el) => {
      el.classList.remove('dragging', 'drop-before', 'drop-after');
    });
    this.clearImageDragIndicators();
  }

  handleTabDragStart(event, tabName, tabEl) {
    if (!this.isEditMode()) {
      event.preventDefault();
      return;
    }
    const payload = { tabName };
    this.beginDrag(DND_TYPES.TAB, payload);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      setDragPayload(event.dataTransfer, DND_TYPES.TAB, payload);
    }
    tabEl.classList.add('dragging');
  }

  calculateTabInsertIndex(clientX) {
    const tabs = Array.from(this.elements.tabList.querySelectorAll('.tab'));
    if (!tabs.length) return 0;
    for (let idx = 0; idx < tabs.length; idx += 1) {
      const rect = tabs[idx].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return idx;
    }
    return tabs.length;
  }

  handleTabListDragOver(event) {
    if (!this.isEditMode()) return;
    if (!hasDragType(event, DND_TYPES.TAB)) return;
    const payload = this.state.drag.payload || getDragPayload(event, DND_TYPES.TAB);
    if (!payload?.tabName) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    this.state.drag.tabInsertIndex = this.calculateTabInsertIndex(event.clientX);
    this.applyTabDragIndicators();
  }

  async handleTabListDrop(event) {
    if (!this.isEditMode()) return;
    if (!hasDragType(event, DND_TYPES.TAB)) return;
    event.preventDefault();
    event.stopPropagation();
    const payload = getDragPayload(event, DND_TYPES.TAB) || this.state.drag.payload;
    if (!payload?.tabName) return;
    const insertIndex = this.state.drag.tabInsertIndex ?? this.calculateTabInsertIndex(event.clientX);
    await this.reorderTabsByDrag(payload, insertIndex);
  }

  async reorderTabsByDrag(payload, insertIndexRaw) {
    try {
      await this.flushPendingBatchUpdates();
      const tabs = Array.isArray(this.state.metadata.tabs) ? this.state.metadata.tabs : [];
      const sourceIndex = tabs.findIndex((tab) => tab.name === payload.tabName);
      if (sourceIndex === -1) return;

      let insertIndex = clamp(insertIndexRaw, 0, tabs.length);
      if (insertIndex > sourceIndex) insertIndex -= 1;
      if (insertIndex === sourceIndex) return;

      const names = tabs.map((tab) => tab.name);
      const [moved] = names.splice(sourceIndex, 1);
      names.splice(insertIndex, 0, moved);

      const metadata = await api.reorderTabs(names);
      this.state.metadata = metadata && Array.isArray(metadata.tabs) ? metadata : { tabs: [] };
      this.state.lastMetadataHash = JSON.stringify(this.state.metadata);
      this.renderTabs();
      this.renderBatches();
    } catch (error) {
      alert(error.message);
      await this.refreshMetadata(true, { forceRender: true });
    } finally {
      this.scheduleDragCleanup();
    }
  }

  collectDraggedSelection(batchId, filename) {
    const tab = this.getActiveTabEntry();
    if (!tab) {
      return { tab: this.state.activeTab, groups: [{ batchId, images: [filename] }], totalCount: 1 };
    }

    const draggedKey = `${batchId}:${filename}`;
    const draggedSelected = this.state.selectedImages.has(draggedKey);
    if (!draggedSelected || this.state.selectedImages.size === 0) {
      if (this.state.selectedImages.size) this.clearSelection(false);
      return { tab: this.state.activeTab, groups: [{ batchId, images: [filename] }], totalCount: 1 };
    }

    const groups = [];
    tab.batches.forEach((batch, idx) => {
      const currentBatchId = normalizeBatchId(batch, `${tab.name}-${idx}`);
      const picked = (batch.images || []).filter((img) => this.state.selectedImages.has(`${currentBatchId}:${img}`));
      if (picked.length) {
        groups.push({ batchId: currentBatchId, images: picked });
      }
    });

    if (!groups.length) {
      return { tab: this.state.activeTab, groups: [{ batchId, images: [filename] }], totalCount: 1 };
    }

    const totalCount = groups.reduce((acc, group) => acc + group.images.length, 0);
    return { tab: this.state.activeTab, groups, totalCount };
  }

  handleThumbnailDragStart(event, batchId, filename, thumbEl) {
    if (!this.isEditMode()) {
      event.preventDefault();
      return;
    }

    const payload = this.collectDraggedSelection(batchId, filename);
    this.beginDrag(DND_TYPES.IMAGE, payload);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      setDragPayload(event.dataTransfer, DND_TYPES.IMAGE, payload);

      if (payload.totalCount > 1) {
        const ghost = createCountDragImage(payload.totalCount);
        document.body.appendChild(ghost);
        this.state.drag.dragGhost = ghost;
        event.dataTransfer.setDragImage(ghost, 18, 18);
      }
    }

    thumbEl.classList.add('dragging');
  }

  setImageDropTarget(targetBatchId, insertIndex, indicatorX, indicatorTop, indicatorHeight) {
    const batchInfo = this.getBatchById(this.state.activeTab, targetBatchId);
    const max = Array.isArray(batchInfo?.batch?.images) ? batchInfo.batch.images.length : 0;
    this.state.drag.imageTarget = {
      targetBatchId,
      insertIndex: clamp(insertIndex, 0, max),
      indicatorX: Number.isFinite(indicatorX) ? indicatorX : null,
      indicatorTop: Number.isFinite(indicatorTop) ? indicatorTop : null,
      indicatorHeight: Number.isFinite(indicatorHeight) ? indicatorHeight : null
    };
    this.applyImageDragIndicators();
  }

  handleThumbnailRowDragOver(event, targetBatchId, rowEl) {
    if (!this.isEditMode()) return;
    if (!hasDragType(event, DND_TYPES.IMAGE)) return;
    const payload = this.state.drag.payload || getDragPayload(event, DND_TYPES.IMAGE);
    if (!payload?.tab || payload.tab !== this.state.activeTab) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const position = this.calculateImageDropPosition(targetBatchId, rowEl, event.clientX, event.clientY);
    this.setImageDropTarget(
      targetBatchId,
      position.insertIndex,
      position.indicatorX,
      position.indicatorTop,
      position.indicatorHeight
    );
  }

  async handleThumbnailRowDrop(event, targetBatchId, rowEl) {
    if (!this.isEditMode()) return;
    if (!hasDragType(event, DND_TYPES.IMAGE)) return;
    event.preventDefault();
    event.stopPropagation();
    const payload = getDragPayload(event, DND_TYPES.IMAGE) || this.state.drag.payload;
    if (!payload?.tab || payload.tab !== this.state.activeTab) return;

    const position = this.calculateImageDropPosition(targetBatchId, rowEl, event.clientX, event.clientY);
    await this.submitImageReorder(payload, targetBatchId, position.insertIndex);
  }

  adjustInsertIndexForSameSource(sourceImages, movingImages, insertIndex) {
    const movingSet = new Set(movingImages);
    let removedBeforeInsert = 0;
    for (let i = 0; i < Math.min(insertIndex, sourceImages.length); i += 1) {
      if (movingSet.has(sourceImages[i])) removedBeforeInsert += 1;
    }
    return clamp(insertIndex - removedBeforeInsert, 0, sourceImages.length - movingImages.length);
  }

  applyOperationLocal(localByBatchId, operation) {
    const sourceId = operation.sourceBatchId;
    const targetId = operation.targetBatchId;
    if (!sourceId || !targetId) return;

    const source = [...(localByBatchId.get(sourceId) || [])];
    const target = sourceId === targetId ? source : [...(localByBatchId.get(targetId) || [])];
    const requestSet = new Set(operation.images || []);
    const moving = source.filter((filename) => requestSet.has(filename));
    if (!moving.length) return;

    const sourceAfter = source.filter((filename) => !requestSet.has(filename));
    const parsedInsert = parseInt(operation.insertIndex, 10);

    if (sourceId === targetId) {
      const insert = clamp(Number.isNaN(parsedInsert) ? sourceAfter.length : parsedInsert, 0, sourceAfter.length);
      sourceAfter.splice(insert, 0, ...moving);
      localByBatchId.set(sourceId, sourceAfter);
      return;
    }

    const movingSet = new Set(moving);
    const targetAfter = target.filter((filename) => !movingSet.has(filename));
    const insert = clamp(Number.isNaN(parsedInsert) ? targetAfter.length : parsedInsert, 0, targetAfter.length);
    targetAfter.splice(insert, 0, ...moving);
    localByBatchId.set(sourceId, sourceAfter);
    localByBatchId.set(targetId, targetAfter);
  }

  buildImageReorderOperations(payload, targetBatchId, insertIndexRaw) {
    const tab = this.getActiveTabEntry();
    if (!tab) return [];

    const localByBatchId = new Map();
    tab.batches.forEach((batch, idx) => {
      const batchId = normalizeBatchId(batch, `${tab.name}-${idx}`);
      localByBatchId.set(batchId, [...(batch.images || [])]);
    });

    const targetCurrent = localByBatchId.get(targetBatchId) || [];
    let insertIndex = clamp(insertIndexRaw, 0, targetCurrent.length);
    const operations = [];

    for (const group of payload.groups || []) {
      const source = localByBatchId.get(group.batchId);
      if (!source || !source.length) continue;

      const images = (group.images || []).filter((filename) => source.includes(filename));
      if (!images.length) continue;

      const sourceBatchIndex = this.getBatchIndexById(this.state.activeTab, group.batchId);
      const targetBatchIndex = this.getBatchIndexById(this.state.activeTab, targetBatchId);
      if (sourceBatchIndex === -1 || targetBatchIndex === -1) continue;

      let opInsertIndex = insertIndex;
      if (group.batchId === targetBatchId) {
        opInsertIndex = this.adjustInsertIndexForSameSource(source, images, opInsertIndex);
      }

      const operation = {
        sourceBatch: sourceBatchIndex,
        targetBatch: targetBatchIndex,
        sourceBatchId: group.batchId,
        targetBatchId,
        images,
        insertIndex: opInsertIndex
      };
      operations.push(operation);
      this.applyOperationLocal(localByBatchId, operation);
      const targetAfter = localByBatchId.get(targetBatchId) || [];
      insertIndex = clamp(opInsertIndex + images.length, 0, targetAfter.length);
    }

    return operations;
  }

  async submitImageReorder(payload, targetBatchId, insertIndex) {
    try {
      await this.flushPendingBatchUpdates();
      const operations = this.buildImageReorderOperations(payload, targetBatchId, insertIndex);
      if (!operations.length) return;

      const response = await api.reorderImages(this.state.activeTab, operations);
      if (response?.tab) {
        const tabIndex = this.state.metadata.tabs.findIndex((item) => item.name === this.state.activeTab);
        if (tabIndex !== -1) {
          this.state.metadata.tabs[tabIndex] = response.tab;
        }
      } else {
        await this.refreshMetadata(true, { forceRender: true });
        return;
      }
      this.clearSelection(false);
      this.state.lastMetadataHash = JSON.stringify(this.state.metadata);
      this.renderBatches();
    } catch (error) {
      alert(error.message);
      await this.refreshMetadata(true, { forceRender: true });
    } finally {
      this.scheduleDragCleanup();
    }
  }
  renderTabs() {
    this.elements.tabList.innerHTML = '';
    const tabs = this.state.metadata.tabs;
    if (!tabs.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Create a tab to get started.';
      this.elements.batchList.innerHTML = '';
      this.elements.batchList.appendChild(empty);
      this.updateHeaderControls();
      return;
    }

    tabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      const isActive = !this.isSearchMode() && tab.name === this.state.activeTab;
      tabEl.className = `tab${isActive ? ' active' : ''}`;
      tabEl.dataset.tab = tab.name;

      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = tab.name;
      titleEl.title = 'Double-click to rename';
      titleEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        titleEl.setAttribute('contenteditable', 'true');
        titleEl.focus();
        document.execCommand('selectAll', false, null);
      });
      titleEl.addEventListener('blur', () => {
        if (!titleEl.isContentEditable) return;
        const next = titleEl.textContent.trim();
        titleEl.removeAttribute('contenteditable');
        if (next && next !== tab.name) {
          this.renameTab(tab.name, next);
        } else {
          titleEl.textContent = tab.name;
        }
      });
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          titleEl.blur();
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          titleEl.textContent = tab.name;
          titleEl.blur();
        }
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'tab-remove';
      removeBtn.type = 'button';
      removeBtn.textContent = 'x';
      removeBtn.title = 'Delete tab';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTab(tab.name);
      });

      tabEl.appendChild(titleEl);
      tabEl.appendChild(removeBtn);
      tabEl.addEventListener('click', () => {
        const wasSearchMode = this.isSearchMode();
        if (wasSearchMode) {
          this.clearSearch({ render: false });
        }
        if (this.state.activeTab === tab.name) {
          if (wasSearchMode) {
            this.renderTabs();
            this.renderBatches();
          }
          return;
        }
        this.state.activeTab = tab.name;
        this.state.activeBatchDropZones.clear();
        this.state.openMoveDropdownBatchId = null;
        this.deactivateKeyboardBatchMove({ render: false });
        this.clearSelection(false);
        this.renderTabs();
        this.renderBatches();
      });

      tabEl.draggable = this.isEditMode();
      tabEl.addEventListener('dragstart', (e) => this.handleTabDragStart(e, tab.name, tabEl));
      tabEl.addEventListener('dragend', () => this.scheduleDragCleanup());
      this.elements.tabList.appendChild(tabEl);
    });

    this.applyTabDragIndicators();
    this.updateHeaderControls();
  }

  formatBatchLabel(batch, batchIndex, totalBatches) {
    const batchNumber = totalBatches - batchIndex;
    if (!batch?.createdAt) return `Batch ${batchNumber}`;
    const created = new Date(batch.createdAt);
    if (Number.isNaN(created.getTime())) return `Batch ${batchNumber}`;
    return `Batch ${batchNumber} · ${created.toLocaleString()}`;
  }

  renderBatches() {
    const list = this.elements.batchList;
    list.innerHTML = '';
    if (this.elements.mainDropzoneCard) {
      this.elements.mainDropzoneCard.classList.toggle('is-hidden', this.isSearchMode());
    }

    if (this.isSearchMode()) {
      this.renderSearchResults();
      this.updateSelectionUI();
      this.updateHeaderControls();
      return;
    }

    const activeTab = this.getActiveTabEntry();
    if (!activeTab) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Create a tab to start uploading batches.';
      list.appendChild(empty);
      this.updateHeaderControls();
      return;
    }

    if (!activeTab.batches || !activeTab.batches.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No batches yet. Upload images to create a batch.';
      list.appendChild(empty);
      this.updateSelectionUI();
      this.updateHeaderControls();
      return;
    }

    const editMode = this.isEditMode();
    const keyboardMoveActiveId = this.state.keyboardBatchMove.activeBatchId;
    this.pruneBatchDropZones();
    this.pruneSelection();

    const totalBatches = activeTab.batches.length;
    activeTab.batches.forEach((batch, batchIndex) => {
      const batchId = normalizeBatchId(batch, `${activeTab.name}-${batchIndex}`);
      const batchKey = this.getBatchKey(activeTab.name, batchId);

      const batchEl = document.createElement('section');
      batchEl.className = 'batch';
      batchEl.dataset.batchIndex = String(batchIndex);
      batchEl.dataset.batchId = batchId;
      if (editMode && keyboardMoveActiveId === batchId) {
        batchEl.classList.add('keyboard-moving');
      }

      const header = document.createElement('div');
      header.className = 'batch-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'batch-title-wrap';

      if (editMode) {
        const moveHandle = document.createElement('button');
        moveHandle.className = 'copy-btn batch-move-btn batch-edit-only';
        moveHandle.type = 'button';
        const isKeyboardMoveActive = keyboardMoveActiveId === batchId;
        moveHandle.textContent = isKeyboardMoveActive ? 'Moving' : 'Move';
        moveHandle.title = 'Keyboard move: Arrow Up/Down, PgUp/PgDown, Home/End, Esc to cancel';
        moveHandle.dataset.batchId = batchId;
        moveHandle.setAttribute('aria-pressed', isKeyboardMoveActive ? 'true' : 'false');
        if (isKeyboardMoveActive) {
          moveHandle.classList.add('active');
        }
        moveHandle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.activateKeyboardBatchMove(batchId);
        });
        titleWrap.appendChild(moveHandle);
      }

      const title = document.createElement('div');
      title.className = 'batch-title';
      title.textContent = this.formatBatchLabel(batch, batchIndex, totalBatches);
      titleWrap.appendChild(title);

      const controls = document.createElement('div');
      controls.className = 'batch-controls';

      const copyTitleBtn = document.createElement('button');
      copyTitleBtn.className = 'copy-btn';
      copyTitleBtn.type = 'button';
      copyTitleBtn.textContent = 'Copy title';
      copyTitleBtn.title = 'Copy title';
      copyTitleBtn.addEventListener('click', async () => {
        await this.copyTextWithFeedback(copyTitleBtn, batch.title || '', 'Copy title');
      });

      const copyPromptBtn = document.createElement('button');
      copyPromptBtn.className = 'copy-btn';
      copyPromptBtn.type = 'button';
      copyPromptBtn.textContent = 'Copy prompt';
      copyPromptBtn.title = 'Copy prompt';
      copyPromptBtn.addEventListener('click', async () => {
        await this.copyTextWithFeedback(copyPromptBtn, batch.description || '', 'Copy prompt');
      });

      controls.appendChild(copyTitleBtn);
      controls.appendChild(copyPromptBtn);

      if (editMode) {
        const moveWrap = document.createElement('div');
        moveWrap.className = 'move-to-wrap batch-edit-only';
        moveWrap.addEventListener('click', (e) => e.stopPropagation());

        const moveBtn = document.createElement('button');
        moveBtn.className = 'copy-btn';
        moveBtn.type = 'button';
        moveBtn.textContent = 'Move to ▾';
        moveBtn.title = 'Move batch to another tab';
        moveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.openMoveDropdownBatchId = this.state.openMoveDropdownBatchId === batchId ? null : batchId;
          this.renderBatches();
        });
        moveWrap.appendChild(moveBtn);

        if (this.state.openMoveDropdownBatchId === batchId) {
          const options = this.state.metadata.tabs
            .map((tab) => tab.name)
            .filter((tabName) => tabName !== this.state.activeTab);

          if (options.length) {
            const dropdown = document.createElement('div');
            dropdown.className = 'move-to-dropdown';
            options.forEach((targetTab) => {
              const optionBtn = document.createElement('button');
              optionBtn.type = 'button';
              optionBtn.className = 'move-to-option';
              optionBtn.textContent = targetTab;
              optionBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.moveBatchToTab(batchIndex, batchId, targetTab);
              });
              dropdown.appendChild(optionBtn);
            });
            moveWrap.appendChild(dropdown);
          }
        }

        controls.appendChild(moveWrap);
      }

      const addBtn = document.createElement('button');
      addBtn.className = 'icon-btn batch-edit-only';
      addBtn.type = 'button';
      addBtn.textContent = '+';
      addBtn.title = 'Add images to this batch';
      addBtn.addEventListener('click', () => {
        if (!this.isEditMode()) return;
        if (this.state.activeBatchDropZones.has(batchKey)) {
          this.state.activeBatchDropZones.delete(batchKey);
        } else {
          this.state.activeBatchDropZones.add(batchKey);
        }
        this.renderBatches();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn danger batch-edit-only';
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'x';
      deleteBtn.title = 'Delete batch';
      deleteBtn.addEventListener('click', () => this.handleDeleteBatch(batchIndex, batchId));

      controls.appendChild(addBtn);
      controls.appendChild(deleteBtn);

      header.appendChild(titleWrap);
      header.appendChild(controls);
      batchEl.appendChild(header);

      const showDropZone = editMode && this.state.activeBatchDropZones.has(batchKey);
      if (showDropZone) {
        batchEl.appendChild(this.createBatchDropZone(batchIndex, batchId));
      }
      const thumbRow = document.createElement('div');
      thumbRow.className = 'thumbnail-row';
      thumbRow.addEventListener('dragover', (e) => this.handleThumbnailRowDragOver(e, batchId, thumbRow));
      thumbRow.addEventListener('drop', (e) => this.handleThumbnailRowDrop(e, batchId, thumbRow));
      if (editMode && (!batch.images || !batch.images.length)) {
        thumbRow.classList.add('empty-drop-target');
        const emptyHint = document.createElement('div');
        emptyHint.className = 'thumbnail-row-empty-hint';
        emptyHint.textContent = 'Drop images here';
        thumbRow.appendChild(emptyHint);
      }

      (batch.images || []).forEach((filename, imageIndex) => {
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail';
        thumb.dataset.filename = filename;
        thumb.dataset.batchIndex = String(batchIndex);
        thumb.dataset.batchId = batchId;

        if (this.isSelected(batchId, filename)) {
          thumb.classList.add('selected');
        }

        if (editMode) {
          thumb.draggable = true;
          thumb.addEventListener('dragstart', (e) => this.handleThumbnailDragStart(e, batchId, filename, thumb));
          thumb.addEventListener('dragend', () => this.scheduleDragCleanup());
        }

        const img = document.createElement('img');
        img.src = `/api/images/${encodeURIComponent(this.state.activeTab)}/${encodeURIComponent(filename)}`;
        img.alt = filename;
        img.loading = 'lazy';

        const likeBtn = this.createLikeButton({
          tabName: this.state.activeTab,
          batchIndex,
          batchId,
          filename
        });

        thumb.addEventListener('click', (e) => {
          e.preventDefault();
          if (editMode) {
            this.toggleSelection(batchId, filename);
            thumb.classList.toggle('selected');
            this.updateSelectionUI();
          } else {
            this.openViewer(batchIndex, imageIndex);
          }
        });

        const actions = document.createElement('div');
        actions.className = 'thumb-actions';
        const remove = document.createElement('button');
        remove.className = 'icon-btn danger';
        remove.type = 'button';
        remove.textContent = 'x';
        remove.title = 'Delete image';
        remove.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteImage(batchIndex, batchId, filename);
        });
        actions.appendChild(remove);

        thumb.appendChild(img);
        thumb.appendChild(likeBtn);
        thumb.appendChild(actions);
        thumbRow.appendChild(thumb);
      });

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'batch-title-input';
      titleInput.placeholder = 'Add a title for this batch...';
      titleInput.value = batch.title || '';
      titleInput.dataset.batchIndex = String(batchIndex);
      titleInput.dataset.batchId = batchId;
      titleInput.dataset.field = 'title';
      titleInput.addEventListener('input', () => {
        this.scheduleBatchUpdate(batchId, { title: titleInput.value });
      });
      titleInput.addEventListener('blur', () => this.handleFieldBlur());

      const textarea = document.createElement('textarea');
      textarea.value = batch.description || '';
      textarea.placeholder = 'Describe this batch...';
      textarea.dataset.batchIndex = String(batchIndex);
      textarea.dataset.batchId = batchId;
      textarea.dataset.field = 'description';
      textarea.addEventListener('input', () => {
        this.scheduleBatchUpdate(batchId, { description: textarea.value });
      });
      textarea.addEventListener('blur', () => this.handleFieldBlur());

      batchEl.appendChild(thumbRow);
      batchEl.appendChild(titleInput);
      batchEl.appendChild(textarea);
      list.appendChild(batchEl);
    });

    this.updateSelectionUI();
    this.applyImageDragIndicators();
    this.updateHeaderControls();
  }

  async copyTextWithFeedback(button, text, baseLabel) {
    const ok = await this.copyToClipboard(text);
    button.textContent = ok ? 'Copied!' : 'Copy failed';
    setTimeout(() => {
      button.textContent = baseLabel;
    }, 1500);
  }

  async copyToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // fallback below
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (_) {
      copied = false;
    } finally {
      document.body.removeChild(textarea);
    }
    return copied;
  }

  async moveBatchToTab(batchIndex, batchId, targetTab) {
    if (!targetTab || targetTab === this.state.activeTab) return;
    try {
      await this.flushPendingBatchUpdates();
      const metadata = await api.moveBatch(this.state.activeTab, batchIndex, {
        targetTab,
        batchId
      });
      this.state.openMoveDropdownBatchId = null;
      this.state.metadata = metadata && Array.isArray(metadata.tabs) ? metadata : this.state.metadata;
      this.pruneBatchDropZones();
      this.pruneSelection();
      this.state.lastMetadataHash = JSON.stringify(this.state.metadata);
      this.renderTabs();
      this.renderBatches();
    } catch (error) {
      alert(error.message);
      await this.refreshMetadata(true, { forceRender: true });
    }
  }
  updateLocalBatchById(tabName, batchId, nextBatch) {
    if (!nextBatch || !tabName || !batchId) return;
    const { tab, index } = this.getBatchById(tabName, batchId);
    if (!tab || index === -1) return;
    const current = tab.batches[index] || {};
    tab.batches[index] = { ...current, ...nextBatch };
  }

  scheduleBatchUpdate(batchId, updates) {
    const tabName = this.state.activeTab;
    if (!tabName || !batchId || !updates || typeof updates !== 'object') return;
    const key = this.getBatchKey(tabName, batchId);
    const existing = this.state.batchUpdateTimers.get(key);
    if (existing?.timer) clearTimeout(existing.timer);

    const merged = { ...(existing?.updates || {}), ...updates };
    const timer = setTimeout(() => this.commitBatchUpdate(key), 1000);
    this.state.batchUpdateTimers.set(key, {
      tabName,
      batchId,
      updates: merged,
      timer
    });
  }

  async commitBatchUpdate(key) {
    const entry = this.state.batchUpdateTimers.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);

    const { tabName, batchId, updates } = entry;
    if (!updates || !Object.keys(updates).length) {
      this.state.batchUpdateTimers.delete(key);
      return;
    }

    const batchIndex = this.getBatchIndexById(tabName, batchId);
    if (batchIndex === -1) {
      this.state.batchUpdateTimers.delete(key);
      return;
    }

    const focusState = this.captureFocusState();
    const activeEl = document.activeElement;
    const editingAny = isTextInput(activeEl);
    const editingSameBatch = editingAny && isInsideBatch(activeEl, batchId);
    const restoreState = !editingAny && focusState && document.activeElement === focusState.element
      ? {
          batchId: focusState.batchId,
          field: focusState.field,
          selectionStart: focusState.selectionStart,
          selectionEnd: focusState.selectionEnd
        }
      : null;

    try {
      const response = await api.updateBatch(tabName, batchIndex, { ...updates, batchId });
      if (response?.batch) {
        this.updateLocalBatchById(tabName, batchId, response.batch);
      }
      this.state.lastMetadataHash = JSON.stringify(this.state.metadata);

      if (editingAny) {
        if (!editingSameBatch) {
          this.state.pendingBatchRefresh.add('__all__');
        }
        this.state.pendingBatchRefresh.add(key);
      } else {
        this.state.pendingBatchRefresh.delete(key);
        this.renderTabs();
        this.renderBatches();
        if (restoreState) {
          this.restoreFocusState(restoreState);
        }
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
      await this.refreshMetadata(true, { forceRender: true });
    } finally {
      this.state.batchUpdateTimers.delete(key);
    }
  }

  async flushPendingBatchUpdates() {
    const keys = Array.from(this.state.batchUpdateTimers.keys());
    for (const key of keys) {
      // Sequential flush keeps update order deterministic.
      // eslint-disable-next-line no-await-in-loop
      await this.commitBatchUpdate(key);
    }
  }

  handleFieldBlur() {
    setTimeout(() => this.maybeRefreshAfterEditing(), 0);
  }

  maybeRefreshAfterEditing() {
    if (isTextInput(document.activeElement)) return;
    if (!this.state.pendingBatchRefresh.size) return;
    this.state.pendingBatchRefresh.clear();
    this.renderTabs();
    this.renderBatches();
  }

  captureFocusState() {
    const el = document.activeElement;
    if (!el) return null;
    const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    if (!isInput) return null;
    const { batchId, field } = el.dataset || {};
    if (!batchId || !field) return null;
    let selectionStart = null;
    let selectionEnd = null;
    if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      selectionStart = el.selectionStart;
      selectionEnd = el.selectionEnd;
    }
    return {
      element: el,
      batchId,
      field,
      selectionStart,
      selectionEnd
    };
  }

  restoreFocusState(state) {
    if (!state || !state.batchId || !state.field) return;
    const selector = `[data-batch-id="${escapeSelector(state.batchId)}"][data-field="${escapeSelector(state.field)}"]`;
    requestAnimationFrame(() => {
      const target = document.querySelector(selector);
      if (!target) return;
      if (typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
      if (
        typeof state.selectionStart === 'number' &&
        typeof state.selectionEnd === 'number' &&
        typeof target.setSelectionRange === 'function'
      ) {
        const valueLength = typeof target.value === 'string' ? target.value.length : 0;
        const start = Math.min(state.selectionStart, valueLength);
        const end = Math.min(state.selectionEnd, valueLength);
        target.setSelectionRange(start, end);
      }
    });
  }

  createBatchDropZone(batchIndex, batchId) {
    const dropZone = document.createElement('div');
    dropZone.className = 'batch-drop-zone';

    const title = document.createElement('strong');
    title.textContent = 'Drop images here to add to this batch';
    dropZone.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'drop-zone-actions';

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.textContent = 'Select files';
    actions.appendChild(selectBtn);

    const pasteBtn = document.createElement('button');
    pasteBtn.type = 'button';
    pasteBtn.textContent = 'Paste image';
    actions.appendChild(pasteBtn);

    dropZone.appendChild(actions);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    dropZone.appendChild(fileInput);

    const handleFiles = (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      this.handleBatchUpload(batchIndex, batchId, files);
    };

    selectBtn.addEventListener('click', () => fileInput.click());
    pasteBtn.addEventListener('click', () => this.handleClipboardPaste({ batchIndex, batchId, triggerButton: pasteBtn }));
    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        if (!hasFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        if (!hasFileDrag(e) && eventName !== 'dragleave') return;
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      handleFiles(files);
    });

    return dropZone;
  }

  padDatePart(value) {
    return String(value).padStart(2, '0');
  }

  createClipboardFilename() {
    const now = new Date();
    const timestamp = `${now.getFullYear()}${this.padDatePart(now.getMonth() + 1)}${this.padDatePart(now.getDate())}-${this.padDatePart(now.getHours())}${this.padDatePart(now.getMinutes())}${this.padDatePart(now.getSeconds())}`;
    return `clipboard-${timestamp}.png`;
  }

  flashButtonLabel(button, label, duration = 1200) {
    if (!button) return;
    const previous = button.dataset.prevLabel || button.textContent;
    button.dataset.prevLabel = previous;
    button.textContent = label;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = previous;
      delete button.dataset.prevLabel;
      button.disabled = false;
    }, duration);
  }

  getPasteShortcutHint() {
    const platform = String(navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
    return platform.includes('mac') ? 'Cmd+V' : 'Ctrl+V';
  }

  setPasteButtonWaiting(button, waiting) {
    if (!button) return;
    if (waiting) {
      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.textContent || 'Paste image';
      }
      button.textContent = `Press ${this.getPasteShortcutHint()}`;
      button.disabled = true;
      return;
    }
    button.textContent = button.dataset.defaultLabel || 'Paste image';
    delete button.dataset.defaultLabel;
    button.disabled = false;
  }

  clearPendingPasteCapture() {
    const pending = this.state.pendingPasteCapture;
    this.state.pendingPasteCapture = null;
    if (pending && typeof pending.cleanup === 'function') {
      pending.cleanup();
    }
  }

  extractImageFromClipboardData(clipboardData) {
    if (!clipboardData) return null;

    const files = Array.from(clipboardData.files || []);
    const imageFile = files.find((file) => file && typeof file.type === 'string' && file.type.startsWith('image/'));
    if (imageFile) {
      return imageFile;
    }

    const items = Array.from(clipboardData.items || []);
    for (const item of items) {
      if (!item || item.kind !== 'file') continue;
      if (typeof item.type !== 'string' || !item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (file) return file;
    }

    return null;
  }

  createPasteCancelledError() {
    const error = new Error('Paste cancelled.');
    error.code = 'PASTE_CANCELLED';
    return error;
  }

  waitForPastedImageBlob(options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 15000;
    const shortcut = this.getPasteShortcutHint();

    return new Promise((resolve, reject) => {
      let settled = false;
      let cleanup = () => {};
      const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const pasteTrap = document.createElement('textarea');
      pasteTrap.setAttribute('aria-hidden', 'true');
      pasteTrap.setAttribute('tabindex', '-1');
      pasteTrap.style.position = 'fixed';
      pasteTrap.style.left = '-9999px';
      pasteTrap.style.top = '-9999px';
      pasteTrap.style.width = '1px';
      pasteTrap.style.height = '1px';
      pasteTrap.style.opacity = '0';
      pasteTrap.style.pointerEvents = 'none';
      document.body.appendChild(pasteTrap);

      const finish = (handler, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        handler(value);
      };

      const onPaste = (event) => {
        const blob = this.extractImageFromClipboardData(event.clipboardData);
        if (!blob) {
          event.preventDefault();
          event.stopPropagation();
          finish(reject, new Error('Clipboard does not contain an image. Copy an image and try again.'));
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        finish(resolve, blob);
      };

      const onKeyDown = (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        finish(reject, this.createPasteCancelledError());
      };

      const timeoutId = setTimeout(() => {
        finish(reject, new Error(`Paste timed out. Click "Paste image" and press ${shortcut}.`));
      }, timeoutMs);

      cleanup = () => {
        clearTimeout(timeoutId);
        document.removeEventListener('paste', onPaste, true);
        pasteTrap.removeEventListener('paste', onPaste, true);
        document.removeEventListener('keydown', onKeyDown, true);
        if (pasteTrap.parentNode) {
          pasteTrap.parentNode.removeChild(pasteTrap);
        }
        if (
          previousActive
          && previousActive !== pasteTrap
          && document.contains(previousActive)
          && typeof previousActive.focus === 'function'
        ) {
          try {
            previousActive.focus({ preventScroll: true });
          } catch (_) {
            // Ignore focus restore failures.
          }
        }
        if (this.state.pendingPasteCapture?.cleanup === cleanup) {
          this.state.pendingPasteCapture = null;
        }
      };

      this.state.pendingPasteCapture = { cleanup };
      document.addEventListener('paste', onPaste, true);
      pasteTrap.addEventListener('paste', onPaste, true);
      document.addEventListener('keydown', onKeyDown, true);

      requestAnimationFrame(() => {
        try {
          pasteTrap.focus({ preventScroll: true });
          pasteTrap.select();
        } catch (_) {
          // Ignore focus failures.
        }
      });
    });
  }

  async handleClipboardPaste(options = {}) {
    const { batchIndex, batchId, triggerButton } = options;
    if (!this.state.activeTab) {
      alert('Create a tab first.');
      return;
    }
    if (this.state.clipboardUploadInProgress) return;

    this.clearPendingPasteCapture();
    this.state.clipboardUploadInProgress = true;
    this.setPasteButtonWaiting(triggerButton, true);

    try {
      const blob = await this.waitForPastedImageBlob();

      const file = new File([blob], this.createClipboardFilename(), {
        type: blob.type || 'image/png'
      });
      const formData = new FormData();
      formData.append('files', file);
      formData.append('tab', this.state.activeTab);

      const filenames = await this.uploadWithProgress(formData);
      if (!filenames.length) return;

      if (typeof batchIndex === 'number' && batchId) {
        await api.appendBatchImages(this.state.activeTab, batchIndex, { images: filenames, batchId });
      } else {
        await api.createBatch(this.state.activeTab, {
          title: '',
          description: '',
          images: filenames
        });
      }

      await this.refreshMetadata(true, { forceRender: true });
    } catch (error) {
      if (error?.code !== 'PASTE_CANCELLED') {
        console.error(error);
        alert(error.message || 'Failed to paste image from clipboard.');
      }
    } finally {
      this.clearPendingPasteCapture();
      this.state.clipboardUploadInProgress = false;
      this.setPasteButtonWaiting(triggerButton, false);
      this.hideProgress();
    }
  }

  async handleBatchUpload(batchIndex, batchId, files) {
    if (!this.state.activeTab) {
      alert('Create a tab first.');
      return;
    }

    const fileArray = Array.from(files || []).filter(Boolean);
    if (!fileArray.length) return;
    if (fileArray.length > 50) {
      alert('You can upload up to 50 files at once.');
      return;
    }

    const formData = new FormData();
    fileArray.forEach((file) => formData.append('files', file));
    formData.append('tab', this.state.activeTab);

    try {
      const filenames = await this.uploadWithProgress(formData);
      if (!filenames.length) return;
      await api.appendBatchImages(this.state.activeTab, batchIndex, { images: filenames, batchId });
      await this.refreshMetadata(true, { forceRender: true });
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      this.hideProgress();
    }
  }

  async handleUpload(files) {
    if (!this.state.activeTab) {
      alert('Create a tab first.');
      return;
    }

    if (files.length > 50) {
      alert('You can upload up to 50 files at once.');
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('tab', this.state.activeTab);

    try {
      const filenames = await this.uploadWithProgress(formData);
      await api.createBatch(this.state.activeTab, {
        title: '',
        description: '',
        images: filenames
      });
      await this.refreshMetadata(true, { forceRender: true });
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      this.hideProgress();
    }
  }
  uploadWithProgress(formData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        this.showProgress(percent);
      };

      xhr.onload = () => {
        const responseText = xhr.responseText || '';
        const parsePayload = () => {
          if (!responseText) return {};
          try {
            return JSON.parse(responseText);
          } catch (_) {
            return {};
          }
        };

        if (xhr.status >= 200 && xhr.status < 300) {
          const payload = parsePayload();
          resolve(payload.filenames || []);
        } else {
          const payload = parsePayload();
          const message = payload.message || responseText || 'Upload failed';
          reject(new Error(message));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
      this.showProgress(0);
    });
  }

  showProgress(percent) {
    this.elements.uploadProgress.style.display = 'block';
    this.elements.uploadProgressBar.style.width = `${percent}%`;
  }

  hideProgress() {
    this.elements.uploadProgressBar.style.width = '0%';
    this.elements.uploadProgress.style.display = 'none';
  }

  async handleDeleteBatch(batchIndex, batchId) {
    if (!confirm('Delete this batch and all images?')) return;
    try {
      await this.flushPendingBatchUpdates();
      this.state.activeBatchDropZones.delete(this.getBatchKey(this.state.activeTab, batchId));
      if (this.state.openMoveDropdownBatchId === batchId) {
        this.state.openMoveDropdownBatchId = null;
      }
      await api.deleteBatch(this.state.activeTab, batchIndex, batchId);
      this.clearSelection(false);
      await this.refreshMetadata(true, { forceRender: true });
    } catch (error) {
      alert(error.message);
    }
  }

  async deleteImage(batchIndex, batchId, filename) {
    if (!confirm('Delete this image?')) return;
    try {
      await api.deleteImage(this.state.activeTab, batchIndex, filename, batchId);
      this.state.selectedImages.delete(`${batchId}:${filename}`);
      this.updateSelectionUI();
      await this.refreshMetadata(true, { forceRender: true });
    } catch (error) {
      alert(error.message);
    }
  }

  toggleSelection(batchId, filename) {
    const key = `${batchId}:${filename}`;
    if (this.state.selectedImages.has(key)) {
      this.state.selectedImages.delete(key);
    } else {
      this.state.selectedImages.set(key, { batchId, filename });
    }
  }

  isSelected(batchId, filename) {
    return this.state.selectedImages.has(`${batchId}:${filename}`);
  }

  updateSelectionUI() {
    const count = this.state.selectedImages.size;
    this.elements.selectionSummary.textContent = `${count} selected`;
    this.elements.selectionActions.classList.toggle('show', count > 0);
  }

  async deleteSelectedImages() {
    if (!this.state.selectedImages.size) return;
    if (!confirm('Delete all selected images?')) return;

    try {
      await this.flushPendingBatchUpdates();
      const byBatch = new Map();
      this.state.selectedImages.forEach(({ batchId, filename }) => {
        if (!byBatch.has(batchId)) byBatch.set(batchId, []);
        byBatch.get(batchId).push(filename);
      });

      for (const [batchId, filenames] of byBatch.entries()) {
        const batchIndex = this.getBatchIndexById(this.state.activeTab, batchId);
        if (batchIndex === -1) continue;
        // eslint-disable-next-line no-await-in-loop
        await api.deleteImages(this.state.activeTab, batchIndex, filenames, batchId);
      }

      this.clearSelection(false);
      await this.refreshMetadata(true, { forceRender: true });
    } catch (error) {
      alert(error.message);
    }
  }

  buildTabViewerItems(tabName) {
    const tab = this.state.metadata.tabs.find((item) => item.name === tabName);
    if (!tab || !Array.isArray(tab.batches)) return [];
    const onlyLiked = this.state.favoritesFilterActive;
    const items = [];
    tab.batches.forEach((batch, batchIndex) => {
      const batchId = normalizeBatchId(batch, `${tab.name}-${batchIndex}`);
      const likedSet = new Set(Array.isArray(batch?.liked) ? batch.liked : []);
      (batch.images || []).forEach((filename, imageIndex) => {
        if (onlyLiked && !likedSet.has(filename)) return;
        items.push({
          tabName: tab.name,
          batchIndex,
          batchId,
          imageIndex,
          filename
        });
      });
    });
    return items;
  }

  buildSearchViewerItems() {
    const groups = this.getSearchResults();
    const onlyLiked = this.state.favoritesFilterActive;
    const items = [];
    groups.forEach((group) => {
      group.batches.forEach(({ batch, batchIndex, batchId }) => {
        const likedSet = new Set(Array.isArray(batch?.liked) ? batch.liked : []);
        (batch.images || []).forEach((filename, imageIndex) => {
          if (onlyLiked && !likedSet.has(filename)) return;
          items.push({
            tabName: group.tabName,
            batchIndex,
            batchId,
            imageIndex,
            filename
          });
        });
      });
    });
    return items;
  }

  sameViewerItem(a, b) {
    if (!a || !b) return false;
    return a.tabName === b.tabName
      && a.batchId === b.batchId
      && a.filename === b.filename
      && a.imageIndex === b.imageIndex;
  }

  openViewerFromItemList(items, preferredItem, source, tabName = null) {
    if (!Array.isArray(items) || !items.length) return;
    let index = -1;
    if (preferredItem) {
      index = items.findIndex((item) => this.sameViewerItem(item, preferredItem));
    }
    if (index === -1) {
      index = 0;
    }
    this.state.viewer = {
      source,
      tabName,
      items,
      index
    };
    this.renderViewerCurrentItem();
    this.elements.viewer.classList.add('show');
    document.body.classList.add('viewer-open');
  }

  openViewer(batchIndex, imageIndex) {
    const tabName = this.state.activeTab;
    if (!tabName) return;
    const tab = this.state.metadata.tabs.find((item) => item.name === tabName);
    if (!tab || !Array.isArray(tab.batches)) return;
    const batch = tab.batches[batchIndex];
    if (!batch) return;
    const filename = batch.images?.[imageIndex];
    const items = this.buildTabViewerItems(tabName);
    if (!items.length) return;
    const preferred = {
      tabName,
      batchIndex,
      batchId: normalizeBatchId(batch, `${tabName}-${batchIndex}`),
      imageIndex,
      filename
    };
    this.openViewerFromItemList(items, preferred, 'tab', tabName);
  }

  openViewerFromSearch(tabName, batchIndex, imageIndex, batchId) {
    const items = this.buildSearchViewerItems();
    if (!items.length) return;
    const tab = this.state.metadata.tabs.find((item) => item.name === tabName);
    const filename = tab?.batches?.[batchIndex]?.images?.[imageIndex];
    const preferred = {
      tabName,
      batchIndex,
      batchId,
      imageIndex,
      filename
    };
    this.openViewerFromItemList(items, preferred, 'search', null);
  }

  renderViewerCurrentItem() {
    const current = this.state.viewer.items[this.state.viewer.index];
    if (!current) {
      this.closeViewer();
      return;
    }
    this.elements.viewerImage.src = `/api/images/${encodeURIComponent(current.tabName)}/${encodeURIComponent(current.filename)}`;
    this.setLikeButtonVisual(this.elements.viewerLike, this.isBatchLiked(current.tabName, current.batchId, current.filename));
  }

  syncViewerAfterDataChange() {
    if (!this.isViewerOpen()) return;
    const current = this.state.viewer.items[this.state.viewer.index] || null;
    let nextItems = [];
    if (this.state.viewer.source === 'search') {
      nextItems = this.buildSearchViewerItems();
    } else if (this.state.viewer.source === 'tab') {
      nextItems = this.buildTabViewerItems(this.state.viewer.tabName || this.state.activeTab);
    }

    if (!nextItems.length) {
      this.closeViewer();
      return;
    }

    let nextIndex = current ? nextItems.findIndex((item) => this.sameViewerItem(item, current)) : -1;
    if (nextIndex === -1) {
      nextIndex = Math.min(this.state.viewer.index, nextItems.length - 1);
      if (nextIndex < 0) nextIndex = 0;
    }

    this.state.viewer.items = nextItems;
    this.state.viewer.index = nextIndex;
    this.renderViewerCurrentItem();
  }

  closeViewer() {
    this.elements.viewer.classList.remove('show');
    document.body.classList.remove('viewer-open');
    this.state.viewer = { source: null, tabName: null, items: [], index: -1 };
    this.setLikeButtonVisual(this.elements.viewerLike, false);
  }

  navigateViewer(delta) {
    if (!this.isViewerOpen()) return;
    const total = this.state.viewer.items.length;
    if (!total) return;

    if (this.state.favoritesFilterActive) {
      const wrapped = ((this.state.viewer.index + delta) % total + total) % total;
      this.state.viewer.index = wrapped;
      this.renderViewerCurrentItem();
      return;
    }

    const nextIndex = this.state.viewer.index + delta;
    if (nextIndex < 0 || nextIndex >= total) return;
    this.state.viewer.index = nextIndex;
    this.renderViewerCurrentItem();
  }

  handleSwipe(startX, startY, endX, endY) {
    const minSwipeDistance = 50;
    const deltaY = endY - startY;
    if (deltaY > minSwipeDistance) {
      this.closeViewer();
    }
  }
}

const app = new GalleryApp();
app.init();
