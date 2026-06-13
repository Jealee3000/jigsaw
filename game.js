(function () {
  const {
    createPieceIds,
    createGameState,
    isTargetAccepted,
    tryPlacePiece,
    isComplete,
    resetGameState,
  } = window.PuppyJigsawLogic;
  const {
    readSavedData,
    writeSavedData,
  } = window.PuppyJigsawStorage;
  const {
    analyzePieceFeatures,
    buildEquivalentTargets,
    createDefaultEquivalentTargets,
    findDetailedHintPieceId,
  } = window.PuppyJigsawImageAnalysis;
  const {
    buildGlueGroups,
    shiftedTargetId,
    targetOffset,
  } = window.PuppyJigsawGlue;
  const Drag = window.PuppyJigsawDrag;
  const Layout = window.PuppyJigsawDom;
  const Modes = window.PuppyJigsawModes;
  const Library = window.PuppyJigsawLibrary;

  const root = document.documentElement;
  const board = document.querySelector('#board');
  const slotLayer = document.querySelector('#slot-layer');
  const tray = document.querySelector('#tray');
  const progress = document.querySelector('.progress');
  const resetButton = document.querySelector('#reset-button');
  const seeAgainButton = document.querySelector('#see-again-button');
  const nextImageButton = document.querySelector('#next-image-button');
  const celebration = document.querySelector('#celebration');
  const completionCountdown = document.querySelector('#completion-countdown');
  const imageInput = document.querySelector('#image-input');
  const imageList = document.querySelector('#image-list');
  const statusMessage = document.querySelector('#status-message');
  const gridButtons = Array.from(document.querySelectorAll('.grid-button'));
  const modeButtons = Array.from(document.querySelectorAll('.mode-button'));
  const suppressedClicks = new WeakSet();
  const fallbackImageUrl = getFallbackImageUrl();

  let gridSize = 2;
  let pieceIds = createPieceIds(gridSize);
  let trayPieceIds = shufflePieceIds(pieceIds);
  let gameState = createGameState(pieceIds);
  let currentImageUrl = fallbackImageUrl;
  let imageLibrary = [];
  let imageLoadToken = 0;
  let activeDrag = null;
  let resizeObserver = null;
  let puzzleRatio = 600 / 420;
  const hintPieces = new Map();
  let hintGeneration = 0;
  let isRestoringState = false;
  let completionDismissed = false;
  let equivalentTargets = {};
  let equivalentAnalysisToken = 0;
  let pieceGlueIds = new Map();
  let glueMembers = new Map();
  const modeState = {
    guide: true,
    correction: true,
    glue: false,
    sound: false,
    autoNext: false,
  };
  const layout = Layout.createLayoutController({
    root,
    board,
    slotLayer,
    getGridSize: () => gridSize,
    getPuzzleRatio: () => puzzleRatio,
  });
  const completionFeedback = window.PuppyJigsawCompletion.createCompletionFeedback({
    countdownElement: completionCountdown,
    getImageCount: () => imageLibrary.length,
    getSoundEnabled: () => modeState.sound,
    getAutoNextEnabled: () => modeState.autoNext,
    goToNextImage: () => goToNextImage(),
  });

  function getFallbackImageUrl() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#8edcff"/>
            <stop offset="1" stop-color="#dff7ff"/>
          </linearGradient>
          <linearGradient id="yard" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#8ed866"/>
            <stop offset="1" stop-color="#54b86e"/>
          </linearGradient>
        </defs>
        <rect width="600" height="420" rx="24" fill="url(#sky)"/>
        <circle cx="506" cy="78" r="43" fill="#ffd958"/>
        <path d="M0 285 C82 249 168 276 246 268 C342 258 408 218 600 242 V420 H0 Z" fill="url(#yard)"/>
        <g transform="translate(66 139)">
          <rect x="2" y="69" width="170" height="122" rx="18" fill="#ffd37a" stroke="#5c4333" stroke-width="9"/>
          <path d="M-15 78 L86 0 L190 78 Z" fill="#ef6f63" stroke="#5c4333" stroke-width="9" stroke-linejoin="round"/>
          <rect x="28" y="114" width="44" height="77" rx="14" fill="#66b9e8" stroke="#5c4333" stroke-width="8"/>
          <rect x="102" y="108" width="41" height="35" rx="9" fill="#fff7df" stroke="#5c4333" stroke-width="7"/>
        </g>
        <g transform="translate(354 129)">
          <ellipse cx="73" cy="128" rx="72" ry="56" fill="#f0a25e" stroke="#5c4333" stroke-width="9"/>
          <circle cx="68" cy="66" r="56" fill="#ffbd79" stroke="#5c4333" stroke-width="9"/>
          <path d="M26 29 L12 -9 L56 11 Z" fill="#ffbd79" stroke="#5c4333" stroke-width="8" stroke-linejoin="round"/>
          <path d="M109 29 L126 -9 L84 11 Z" fill="#ffbd79" stroke="#5c4333" stroke-width="8" stroke-linejoin="round"/>
          <circle cx="48" cy="61" r="7" fill="#302820"/>
          <circle cx="88" cy="61" r="7" fill="#302820"/>
          <ellipse cx="69" cy="82" rx="15" ry="10" fill="#5c4333"/>
          <path d="M51 99 Q69 114 90 99" fill="none" stroke="#5c4333" stroke-width="7" stroke-linecap="round"/>
        </g>
        <g transform="translate(113 284)">
          <ellipse cx="58" cy="45" rx="58" ry="36" fill="#63b8e8" stroke="#254f73" stroke-width="8"/>
          <circle cx="45" cy="30" r="33" fill="#85d2fb" stroke="#254f73" stroke-width="8"/>
          <circle cx="33" cy="29" r="5" fill="#1d405c"/>
          <circle cx="56" cy="29" r="5" fill="#1d405c"/>
          <path d="M36 44 Q46 52 59 44" fill="none" stroke="#1d405c" stroke-width="5" stroke-linecap="round"/>
        </g>
        <g transform="translate(416 300)">
          <circle cx="35" cy="34" r="23" fill="#ff7777" stroke="#5c4333" stroke-width="7"/>
          <path d="M19 18 l32 32 M51 18 L19 50" stroke="#fff7df" stroke-width="6" stroke-linecap="round"/>
          <rect x="65" y="16" width="72" height="38" rx="19" fill="#58c87a" stroke="#356c3d" stroke-width="7"/>
        </g>
      </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function setStatus(message) {
    statusMessage.textContent = message;
  }

  function selectedImageName() {
    return imageLibrary.find((image) => image.url === currentImageUrl)?.name || null;
  }

  function selectedImage() {
    return imageLibrary.find((image) => image.url === currentImageUrl) || null;
  }

  function orderedPieceIds(ids) {
    const valid = new Set(pieceIds);
    const ordered = ids.filter((pieceId) => valid.has(pieceId));
    const missing = pieceIds.filter((pieceId) => !ordered.includes(pieceId));
    return [...ordered, ...missing];
  }

  function serializePieces() {
    return Object.fromEntries(pieceIds.map((pieceId) => {
      const piece = gameState.pieces[pieceId];
      return [pieceId, {
        placed: piece?.placed === true,
        currentTargetId: piece?.currentTargetId || null,
      }];
    }));
  }

  function serializeCurrentImageState() {
    return {
      gridSize,
      imageSignature: selectedImage()?.signature || null,
      trayPieceIds,
      modeState: {
        guide: modeState.guide,
        correction: modeState.correction,
        glue: modeState.glue,
        sound: modeState.sound,
        autoNext: modeState.autoNext,
      },
      pieces: serializePieces(),
      hints: Array.from(hintPieces.keys()),
      completionDismissed,
      solved: isPuzzleSolved(),
    };
  }

  function cleanSavedDataForLibrary() {
    const saved = readSavedData();
    const imagesByName = new Map(imageLibrary.map((image) => [image.name, image]));
    let changed = false;

    for (const [imageName, imageState] of Object.entries(saved.imageStates || {})) {
      const image = imagesByName.get(imageName);
      if (!image || imageState?.imageSignature !== image.signature) {
        delete saved.imageStates[imageName];
        changed = true;
      }
    }

    if (saved.currentImageName && !imagesByName.has(saved.currentImageName)) {
      saved.currentImageName = null;
      changed = true;
    }

    if (changed) {
      writeSavedData(saved);
    }
  }

  function saveState() {
    if (isRestoringState) {
      return;
    }

    const imageName = selectedImageName();
    const saved = readSavedData();
    saved.currentImageName = imageName;

    if (imageName) {
      saved.imageStates[imageName] = serializeCurrentImageState();
    }

    writeSavedData(saved);
  }

  function defaultEquivalentTargets() {
    return createDefaultEquivalentTargets(pieceIds);
  }

  function publishDebugState() {
    window.__puppyJigsawDebug = {
      equivalentTargets,
    };
  }

  function setEquivalentTargets(targets) {
    equivalentTargets = targets;
    publishDebugState();
  }

  function setPuzzleImage(url) {
    root.style.setProperty('--puzzle-image', `url("${url}")`);
  }

  function setPuzzleRatio(width, height) {
    if (!width || !height) {
      return;
    }

    puzzleRatio = width / height;
    root.style.setProperty('--puzzle-ratio', `${width} / ${height}`);
    syncLayoutSize();
  }

  function loadImageSize(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({
        width: image.naturalWidth || 600,
        height: image.naturalHeight || 420,
      });
      image.onerror = () => resolve({ width: 600, height: 420 });
      image.src = url;
    });
  }

  async function setCurrentImage(url) {
    const token = imageLoadToken + 1;
    imageLoadToken = token;
    currentImageUrl = url;
    setPuzzleImage(url);

    const size = await loadImageSize(url);
    if (token === imageLoadToken) {
      setPuzzleRatio(size.width, size.height);
      await refreshEquivalentTargets();
    }
  }

  function hasSameOrder(first, second) {
    return first.length === second.length
      && first.every((item, index) => item === second[index]);
  }

  function shufflePieceIds(ids) {
    const shuffled = [...ids];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    if (shuffled.length > 1 && hasSameOrder(shuffled, ids)) {
      shuffled.push(shuffled.shift());
    }

    return shuffled;
  }

  function updateModeControls() {
    Modes.updateModeControls({
      root,
      board,
      modeButtons,
      modeState,
    });
  }

  async function refreshEquivalentTargets() {
    const token = equivalentAnalysisToken + 1;
    const url = currentImageUrl;
    const size = gridSize;
    const signature = selectedImage()?.signature || '';

    equivalentAnalysisToken = token;
    setEquivalentTargets(defaultEquivalentTargets());

    try {
      const features = await analyzePieceFeatures(url, pieceIds, size, signature);
      if (token === equivalentAnalysisToken && url === currentImageUrl && size === gridSize) {
        setEquivalentTargets(buildEquivalentTargets(pieceIds, features));
      }
    } catch (error) {
      if (token === equivalentAnalysisToken) {
        setEquivalentTargets(defaultEquivalentTargets());
      }
    }
  }

  function getBlankHintCandidates() {
    const occupiedTargets = new Set(
      getPieces()
        .filter((piece) => piece.classList.contains('placed'))
        .map((piece) => piece.dataset.currentTargetId)
        .filter(Boolean),
    );

    return pieceIds.filter((pieceId) => (
      !occupiedTargets.has(pieceId)
      && !hintPieces.has(pieceId)
    ));
  }

  function addHintPiece() {
    const candidates = getBlankHintCandidates();
    if (candidates.length === 0) {
      setStatus('已经没有空白格可以提示了');
      return;
    }

    const fallback = candidates[Math.floor(Math.random() * candidates.length)];
    const generation = hintGeneration;
    const url = currentImageUrl;
    const size = gridSize;
    const signature = selectedImage()?.signature || '';

    hintPieces.set(fallback, 0);
    updateGuideHint();
    setStatus(`已添加 ${hintPieces.size} 个提示`);
    saveState();

    findDetailedHintPieceId(url, pieceIds, size, candidates, signature)
      .then((entry) => {
        if (generation !== hintGeneration || url !== currentImageUrl || size !== gridSize || !entry) {
          return;
        }

        if (!hintPieces.has(fallback) || (entry.pieceId !== fallback && hintPieces.has(entry.pieceId))) {
          return;
        }

        hintPieces.delete(fallback);
        hintPieces.set(entry.pieceId, entry.score);
        updateGuideHint();
        saveState();
      })
      .catch(() => {
        updateGuideHint();
      });
  }

  function clearHints() {
    hintPieces.clear();
    hintGeneration += 1;
    updateGuideHint();
  }

  function updateGuideHint() {
    for (const slot of getSlots()) {
      const score = hintPieces.get(slot.dataset.targetId) || 0;
      const isHint = hintPieces.has(slot.dataset.targetId);
      slot.classList.toggle('guide-hint', isHint);
      if (isHint) {
        slot.dataset.hintReady = String(score > 0);
        slot.dataset.hintScore = String(Math.round(score));
      } else {
        delete slot.dataset.hintReady;
        delete slot.dataset.hintScore;
      }
    }
  }

  function isImageCompleted(image, saved) {
    if (image.url === currentImageUrl) {
      return isPuzzleSolved();
    }

    return saved.imageStates?.[image.name]?.solved === true;
  }

  function renderImageLibrary() {
    const saved = readSavedData();
    Library.renderImageLibrary({
      imageList,
      imageLibrary,
      currentImageUrl,
      saved,
      isImageCompleted,
      onSelectImage: selectLibraryImage,
    });
  }

  async function selectLibraryImage(image, options = {}) {
    if (!image) {
      return;
    }

    if (!options.skipSave) {
      saveState();
    }

    const saved = readSavedData();
    const imageState = saved.imageStates?.[image.name];
    const restored = imageState
      ? await restoreImageState(image, imageState)
      : false;

    if (!restored) {
      await setCurrentImage(image.url);
      clearHints();
      completionDismissed = false;
      renderImageLibrary();
      resetGame({ preserveFocus: true });
    }

    renderImageLibrary();
    saveState();

    if (!options.silent) {
      setStatus(`已选择 ${image.name}`);
    }
  }

  async function loadImageLibrary() {
    try {
      const response = await fetch('/api/images');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '读取图片列表失败');
      }

      imageLibrary = Array.isArray(result.images) ? result.images : [];
      cleanSavedDataForLibrary();
      renderImageLibrary();

      if (await restoreSavedState()) {
        renderImageLibrary();
        setStatus(`已恢复 ${imageLibrary.length} 张图片`);
        return;
      }

      if (imageLibrary.length > 0 && currentImageUrl === fallbackImageUrl) {
        await selectLibraryImage(imageLibrary[0], { silent: true });
        setStatus(`已加载 ${imageLibrary.length} 张图片`);
        return;
      }

      setStatus(imageLibrary.length > 0 ? `已加载 ${imageLibrary.length} 张图片` : '可以先上传一张图片');
    } catch (error) {
      imageLibrary = [];
      renderImageLibrary();
      setStatus('图片服务未连接，请用本地服务打开页面');
    }
  }

  function setGridVariables() {
    layout.setGridVariables();
  }

  function syncLayoutSize() {
    layout.syncLayoutSize();
  }

  function syncLoosePieceSize() {
    layout.syncLoosePieceSize();
  }

  function createSlot(pieceId) {
    return Layout.createSlot(pieceId, gridSize);
  }

  function createPiece(pieceId) {
    return Layout.createPiece(pieceId, gridSize, bindPieceEvents);
  }

  function getPieces() {
    return Layout.getPieces(pieceIds);
  }

  function getSlots() {
    return Layout.getSlots(pieceIds);
  }

  function getSlotForPiece(pieceId) {
    return Layout.getSlotForPiece(pieceId);
  }

  function updateSlotOccupancy() {
    Layout.updateSlotOccupancy({
      gameState,
      slots: getSlots(),
    });
  }

  function renderPuzzle(options = {}) {
    for (const piece of Array.from(board.querySelectorAll('.piece'))) {
      piece.remove();
    }

    slotLayer.replaceChildren();
    tray.replaceChildren();

    if (!options.preserveTrayOrder) {
      trayPieceIds = shufflePieceIds(pieceIds);
    } else {
      trayPieceIds = orderedPieceIds(trayPieceIds);
    }

    for (const pieceId of pieceIds) {
      slotLayer.appendChild(createSlot(pieceId));
    }

    updateSlotOccupancy();
    updateGuideHint();

    for (const pieceId of trayPieceIds) {
      tray.appendChild(createPiece(pieceId));
    }

    requestAnimationFrame(() => {
      syncLayoutSize();
      syncLoosePieceSize();
    });
  }

  async function restoreImageState(image, saved) {
    if (!image || !saved) {
      return false;
    }

    if (saved.imageSignature !== image.signature) {
      return false;
    }

    const savedGridSize = Number(saved.gridSize);
    if (!window.PuppyJigsawLogic.SUPPORTED_GRID_SIZES.includes(savedGridSize)) {
      return false;
    }

    isRestoringState = true;
    activeDrag = null;
    gridSize = savedGridSize;
    pieceIds = createPieceIds(gridSize);
    trayPieceIds = orderedPieceIds(Array.isArray(saved.trayPieceIds) ? saved.trayPieceIds : []);
    gameState = resetGameState(pieceIds);
    modeState.guide = saved.modeState?.guide !== false;
    modeState.correction = saved.modeState?.correction !== false;
    modeState.glue = saved.modeState?.glue === true;
    modeState.sound = saved.modeState?.sound === true;
    modeState.autoNext = saved.modeState?.autoNext === true;
    completionDismissed = saved.completionDismissed === true;
    hintPieces.clear();
    hintGeneration += 1;

    await setCurrentImage(image.url);
    setGridVariables();
    updateGridButtons();
    updateModeControls();
    clearReadySlots();
    celebration.hidden = true;
    renderPuzzle({ preserveTrayOrder: true });

    const usedTargets = new Set();
    for (const pieceId of pieceIds) {
      const savedPiece = saved.pieces?.[pieceId];
      const targetId = savedPiece?.currentTargetId;
      if (!savedPiece?.placed || !pieceIds.includes(targetId) || usedTargets.has(targetId)) {
        continue;
      }

      const piece = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
      const slot = getSlotByTargetId(targetId);
      if (!piece || !slot) {
        continue;
      }

      usedTargets.add(targetId);
      markPiecePlaced(pieceId, targetId);
      placePiece(piece, slot);
    }

    for (const pieceId of Array.isArray(saved.hints) ? saved.hints : []) {
      if (pieceIds.includes(pieceId) && !usedTargets.has(pieceId)) {
        hintPieces.set(pieceId, 1);
      }
    }

    updateGuideHint();
    updateProgress();
    recomputeGlueGroups();
    showCelebrationIfComplete();
    isRestoringState = false;
    return true;
  }

  async function restoreSavedState() {
    const saved = readSavedData();
    const image = imageLibrary.find((candidate) => candidate.name === saved.currentImageName);
    if (!image) {
      return false;
    }

    return restoreImageState(image, saved.imageStates?.[image.name]);
  }

  function clearReadySlots() {
    for (const slot of getSlots()) {
      slot.classList.remove('ready');
    }
  }

  function insertPieceInOriginalOrder(piece) {
    const order = trayPieceIds.indexOf(piece.dataset.pieceId);
    const nextPiece = Array.from(tray.children).find((child) => (
      child.classList.contains('piece')
      && trayPieceIds.indexOf(child.dataset.pieceId) > order
    ));

    tray.insertBefore(piece, nextPiece || null);
  }

  function setReadySlot(slotDetails) {
    clearReadySlots();

    if (Drag.isDropReady(slotDetails, modeState.correction)) {
      slotDetails.slot.classList.add('ready');
    }
  }

  function placeGroupSwapTargets(swapTargets) {
    for (const [pieceId, targetId] of swapTargets.entries()) {
      const piece = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
      const slot = getSlotByTargetId(targetId);
      if (!piece || !slot) {
        continue;
      }

      markPiecePlaced(pieceId, targetId);
      placePiece(piece, slot);
    }
  }

  function placeDraggedGroup(drag, targets) {
    for (const [pieceId, targetId] of targets.entries()) {
      const item = drag.dragItems.find((candidate) => candidate.pieceId === pieceId);
      const slot = getSlotByTargetId(targetId);
      if (!item || !slot) {
        continue;
      }

      markPiecePlaced(pieceId, targetId);
      placePiece(item.piece, slot);
    }
  }

  function restoreDraggedGroup(drag) {
    for (const item of drag.dragItems || []) {
      const slot = getSlotByTargetId(item.originTargetId);
      if (slot) {
        markPiecePlaced(item.pieceId, item.originTargetId);
        placePiece(item.piece, slot);
      } else {
        markPieceLoose(item.pieceId);
        setPieceLoose(item.piece);
      }
    }
  }

  function updateProgress() {
    progress.textContent = `${gameState.placedCount} / ${pieceIds.length}`;
    progress.setAttribute('aria-label', `完成 ${gameState.placedCount} / ${pieceIds.length}`);
  }

  function isPuzzleSolved() {
    if (modeState.correction) {
      return isComplete(gameState);
    }

    const usedTargets = new Set();
    return pieceIds.every((pieceId) => {
      const piece = gameState.pieces[pieceId];
      if (
        piece?.placed !== true
        || !piece.currentTargetId
        || usedTargets.has(piece.currentTargetId)
        || !isTargetAccepted(piece, piece.currentTargetId, equivalentTargets)
      ) {
        return false;
      }

      usedTargets.add(piece.currentTargetId);
      return true;
    });
  }

  function showCelebrationIfComplete() {
    if (isPuzzleSolved()) {
      board.classList.add('solved');
      renderImageLibrary();
      if (!completionDismissed) {
        celebration.hidden = false;
        completionFeedback.playSound();
        completionFeedback.scheduleAutoNext();
        window.setTimeout(() => nextImageButton.focus(), 0);
      }
      return true;
    }

    board.classList.remove('solved');
    return false;
  }

  function hideCelebration() {
    completionFeedback.clear();
    celebration.hidden = true;
    completionDismissed = true;
    saveState();
  }

  async function goToNextImage() {
    if (imageLibrary.length === 0) {
      hideCelebration();
      return;
    }

    const currentName = selectedImageName();
    const currentIndex = Math.max(0, imageLibrary.findIndex((image) => image.name === currentName));
    const nextImage = imageLibrary[(currentIndex + 1) % imageLibrary.length];

    completionFeedback.clear();
    celebration.hidden = true;
    completionDismissed = true;
    saveState();
    completionDismissed = false;
    await selectLibraryImage(nextImage, { silent: true, skipSave: true });
    setStatus(`下一张 ${nextImage.name}`);
  }

  function markPieceLoose(pieceId) {
    const piece = gameState.pieces[pieceId];

    if (!piece) {
      return;
    }

    if (piece.placed) {
      gameState.placedCount = Math.max(0, gameState.placedCount - 1);
    }

    piece.placed = false;
    piece.currentTargetId = null;
    board.classList.remove('solved');
    completionFeedback.clear();
    updateSlotOccupancy();
    renderImageLibrary();
  }

  function markPiecePlaced(pieceId, targetId) {
    const piece = gameState.pieces[pieceId];

    if (!piece) {
      return;
    }

    if (!piece.placed) {
      gameState.placedCount += 1;
    }

    piece.placed = true;
    piece.currentTargetId = targetId;
    updateSlotOccupancy();
  }

  function placePiece(piece, slot) {
    if (hintPieces.delete(slot.dataset.targetId)) {
      updateGuideHint();
    }

    piece.classList.remove('dragging');
    piece.classList.add('placed');
    piece.style.removeProperty('--drag-width');
    piece.style.removeProperty('--drag-height');
    piece.style.left = `${slot.offsetLeft}px`;
    piece.style.top = `${slot.offsetTop}px`;
    piece.style.width = `${slot.offsetWidth}px`;
    piece.style.height = `${slot.offsetHeight}px`;
    piece.style.transform = '';
    piece.style.zIndex = '';
    piece.dataset.currentTargetId = slot.dataset.targetId;
    piece.tabIndex = modeState.correction ? -1 : 0;
    piece.setAttribute('aria-disabled', String(modeState.correction));

    board.appendChild(piece);

    if (document.activeElement === piece) {
      piece.blur();
    }
  }

  function setPieceLoose(piece) {
    piece.classList.remove('dragging', 'placed');
    piece.style.left = '';
    piece.style.top = '';
    piece.style.width = '';
    piece.style.height = '';
    piece.style.removeProperty('--drag-width');
    piece.style.removeProperty('--drag-height');
    piece.style.transform = '';
    piece.style.zIndex = '';
    piece.removeAttribute('data-current-target-id');
    piece.removeAttribute('aria-disabled');
    piece.removeAttribute('tabindex');
    insertPieceInOriginalOrder(piece);
  }

  function getPlacedPieceAtTarget(targetId, excludedPieceId) {
    return getPieces().find((piece) => (
      piece.dataset.pieceId !== excludedPieceId
      && piece.classList.contains('placed')
      && piece.dataset.currentTargetId === targetId
    )) || null;
  }

  function getSlotByTargetId(targetId) {
    return getSlots().find((slot) => slot.dataset.targetId === targetId) || null;
  }

  function clearGlueGroups() {
    pieceGlueIds = new Map();
    glueMembers = new Map();
    for (const piece of getPieces()) {
      piece.classList.remove('glued');
      piece.removeAttribute('data-glue-id');
    }
  }

  function recomputeGlueGroups() {
    clearGlueGroups();

    if (!modeState.glue) {
      return;
    }

    let groupIndex = 0;
    for (const members of buildGlueGroups(pieceIds, gameState.pieces)) {
      const glueId = `glue-${groupIndex}`;
      groupIndex += 1;
      glueMembers.set(glueId, members);

      for (const pieceId of members) {
        const piece = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
        pieceGlueIds.set(pieceId, glueId);
        piece?.classList.add('glued');
        piece?.setAttribute('data-glue-id', glueId);
      }
    }
  }

  function getDragGroupPieceIds(pieceId) {
    const glueId = pieceGlueIds.get(pieceId);
    return glueId ? [...(glueMembers.get(glueId) || [pieceId])] : [pieceId];
  }

  function moveBlockingPiece(blockingPiece, drag) {
    const blockingPieceId = blockingPiece.dataset.pieceId;

    if (drag.wasPlaced && drag.originTargetId) {
      const originSlot = getSlotByTargetId(drag.originTargetId);
      if (originSlot) {
        markPiecePlaced(blockingPieceId, drag.originTargetId);
        placePiece(blockingPiece, originSlot);
        return;
      }
    }

    markPieceLoose(blockingPieceId);
    setPieceLoose(blockingPiece);
  }

  function focusFirstLoosePiece() {
    const piece = getPieces().find((candidate) => {
      const pieceId = candidate.dataset.pieceId;
      return !gameState.pieces[pieceId]?.placed;
    });

    (piece || resetButton).focus();
  }

  function returnActivePieceToTray() {
    if (activeDrag?.piece) {
      setPieceLoose(activeDrag.piece);
    }

    activeDrag = null;
    clearReadySlots();
  }

  function onPointerDown(event) {
    if (activeDrag) {
      return;
    }

    const piece = event.currentTarget;
    const pieceId = piece.dataset.pieceId;

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const groupPieceIds = getDragGroupPieceIds(pieceId);
    if (gameState.pieces[pieceId]?.placed && modeState.correction && groupPieceIds.length < 2) {
      return;
    }

    const dragItems = groupPieceIds.map((groupPieceId) => {
      const groupPiece = document.querySelector(`.piece[data-piece-id="${groupPieceId}"]`);
      if (!groupPiece) {
        return null;
      }

      const rect = groupPiece.getBoundingClientRect();

      return {
        piece: groupPiece,
        pieceId: groupPieceId,
        originTargetId: groupPiece.dataset.currentTargetId || gameState.pieces[groupPieceId]?.currentTargetId || null,
        width: rect.width,
        height: rect.height,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
    }).filter(Boolean);
    const rect = piece.getBoundingClientRect();
    activeDrag = {
      piece,
      pieceId,
      groupPieceIds,
      dragItems,
      wasPlaced: Boolean(gameState.pieces[pieceId]?.placed),
      originTargetId: piece.dataset.currentTargetId || gameState.pieces[pieceId]?.currentTargetId || null,
      pointerId: event.pointerId,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      didMove: false,
    };

    event.preventDefault();
    for (const item of dragItems) {
      markPieceLoose(item.pieceId);
      Drag.prepareDraggingPiece(item);
    }
    piece.setPointerCapture(event.pointerId);
    Drag.moveDraggedPiecesToPointer(activeDrag, event.clientX, event.clientY);
    setReadySlot(Drag.getDropSlot({
      correction: modeState.correction,
      slots: getSlots(),
      point: { x: event.clientX, y: event.clientY },
      piece,
    }));
  }

  function onPointerMove(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    event.preventDefault();
    activeDrag.didMove = activeDrag.didMove
      || Math.hypot(event.clientX - activeDrag.startX, event.clientY - activeDrag.startY) > 6;
    Drag.moveDraggedPiecesToPointer(activeDrag, event.clientX, event.clientY);
    setReadySlot(Drag.getDropSlot({
      correction: modeState.correction,
      slots: getSlots(),
      point: { x: event.clientX, y: event.clientY },
      piece: activeDrag.piece,
    }));
  }

  function onPointerUp(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    const drag = activeDrag;
    const point = { x: event.clientX, y: event.clientY };
    Drag.moveDraggedPiecesToPointer(activeDrag, event.clientX, event.clientY);
    const closestSlot = Drag.getDropSlot({
      correction: modeState.correction,
      slots: getSlots(),
      point,
      piece: drag.piece,
    });
    const occupiedSlotPiece = closestSlot
      ? getPlacedPieceAtTarget(closestSlot.targetId, drag.pieceId)
      : null;
    const nextState = closestSlot && modeState.correction && !occupiedSlotPiece
      ? tryPlacePiece(gameState, {
        pieceId: drag.pieceId,
        targetId: closestSlot.targetId,
        equivalentTargets,
        pieceCenter: point,
        targetCenter: closestSlot.center,
        snapThreshold: closestSlot.snapThreshold,
      })
      : gameState;

    activeDrag = null;
    clearReadySlots();
    Drag.releasePointerCapture(drag.piece, event.pointerId);

    if (drag.didMove) {
      suppressedClicks.add(drag.piece);
    }

    if (drag.groupPieceIds?.length > 1) {
      const anchoredGroupDrop = closestSlot && Drag.isDropReady(closestSlot, modeState.correction)
        ? Drag.buildAnchoredGroupDrop({
          drag,
          anchorTargetId: closestSlot.targetId,
          gridSize,
          shiftedTargetId,
          targetOffset,
        })
        : null;
      const groupDrop = Drag.getBestGroupDrop({
        drag,
        slots: getSlots(),
        correction: modeState.correction,
        gridSize,
        shiftedTargetId,
        targetOffset,
      });
      const groupTargets = anchoredGroupDrop?.targets || groupDrop?.targets || null;
      const groupSwapTargets = groupTargets
        ? Drag.buildGroupSwapTargets({
          drag,
          targets: groupTargets,
          gridSize,
          gameState,
          modeState,
          equivalentTargets,
          getPlacedPieceAtTarget,
          isTargetAccepted,
          shiftedTargetId,
          targetOffset,
        })
        : null;

      if (
        groupTargets
        && groupSwapTargets
        && Drag.canPlaceGroup({
          targets: groupTargets,
          groupPieceIds: drag.groupPieceIds,
          swapTargets: groupSwapTargets,
          gameState,
          modeState,
          equivalentTargets,
          getSlotByTargetId,
          getPlacedPieceAtTarget,
          isTargetAccepted,
        })
      ) {
        placeGroupSwapTargets(groupSwapTargets);
        placeDraggedGroup(drag, groupTargets);
        updateProgress();
        recomputeGlueGroups();
        showCelebrationIfComplete();
        saveState();
        return;
      }

      restoreDraggedGroup(drag);
      updateProgress();
      recomputeGlueGroups();
      saveState();
      return;
    }

    if (
      !modeState.correction
      && closestSlot
      && Drag.isDropReady(closestSlot, modeState.correction)
    ) {
      const blockingPiece = getPlacedPieceAtTarget(closestSlot.targetId, drag.pieceId);
      if (blockingPiece) {
        moveBlockingPiece(blockingPiece, drag);
      }
      markPiecePlaced(drag.pieceId, closestSlot.targetId);
      placePiece(drag.piece, closestSlot.slot);
      updateProgress();
      recomputeGlueGroups();
      showCelebrationIfComplete();
      saveState();
      return;
    }

    if (nextState.pieces[drag.pieceId]?.placed) {
      gameState = nextState;
      placePiece(drag.piece, closestSlot.slot);
      updateProgress();
      recomputeGlueGroups();
      showCelebrationIfComplete();
      saveState();
      return;
    }

    setPieceLoose(drag.piece);
    recomputeGlueGroups();
    saveState();
    if (!drag.didMove) {
      placePieceByActivation(drag.piece);
    }
  }

  function onPointerCancel(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    Drag.releasePointerCapture(activeDrag.piece, event.pointerId);
    suppressedClicks.add(activeDrag.piece);
    if (activeDrag.groupPieceIds?.length > 1) {
      restoreDraggedGroup(activeDrag);
      activeDrag = null;
      clearReadySlots();
    } else {
      returnActivePieceToTray();
    }
    recomputeGlueGroups();
    saveState();
  }

  function placePieceByActivation(piece) {
    const pieceId = piece.dataset.pieceId;
    const targetId = gameState.pieces[pieceId]?.targetId;
    const slot = getSlotForPiece(targetId);

    if (activeDrag || gameState.pieces[pieceId]?.placed || !slot) {
      return;
    }

    const slotDetails = Drag.getSlotDetails(slot, { x: 0, y: 0 });
    if (getPlacedPieceAtTarget(targetId, pieceId)) {
      return;
    }

    const nextState = tryPlacePiece(gameState, {
      pieceId,
      targetId,
      equivalentTargets,
      pieceCenter: slotDetails.center,
      targetCenter: slotDetails.center,
      snapThreshold: slotDetails.snapThreshold,
    });

    if (!nextState.pieces[pieceId]?.placed) {
      return;
    }

    clearReadySlots();
    gameState = nextState;
    placePiece(piece, slot);
    updateProgress();
    recomputeGlueGroups();

    if (!showCelebrationIfComplete()) {
      focusFirstLoosePiece();
    }
    saveState();
  }

  function onPieceClick(event) {
    const piece = event.currentTarget;

    if (suppressedClicks.has(piece)) {
      suppressedClicks.delete(piece);
      return;
    }

    placePieceByActivation(piece);
  }

  function onPieceKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    placePieceByActivation(event.currentTarget);
  }

  function bindPieceEvents(piece) {
    piece.addEventListener('pointerdown', onPointerDown);
    piece.addEventListener('pointermove', onPointerMove);
    piece.addEventListener('pointerup', onPointerUp);
    piece.addEventListener('pointercancel', onPointerCancel);
    piece.addEventListener('click', onPieceClick);
    piece.addEventListener('keydown', onPieceKeyDown);
  }

  function updateGridButtons() {
    for (const button of gridButtons) {
      const isActive = Number(button.dataset.gridSize) === gridSize;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  }

  function onModeButtonClick(event) {
    const mode = event.currentTarget.dataset.mode;

    if (mode === 'hint') {
      addHintPiece();
      return;
    }

    modeState[mode] = !modeState[mode];
    updateModeControls();
    updateGuideHint();
    recomputeGlueGroups();

    if (mode === 'autoNext') {
      if (modeState.autoNext && !celebration.hidden && isPuzzleSolved()) {
        completionFeedback.scheduleAutoNext();
      } else {
        completionFeedback.clear();
      }
    }

    if (mode === 'correction') {
      resetGame({ preserveFocus: true });
      setStatus(modeState.correction ? '已开启纠错' : '已关闭纠错，可以放错位置');
      return;
    }

    saveState();
    setStatus(modeState[mode] ? `已开启 ${event.currentTarget.textContent}` : `已关闭 ${event.currentTarget.textContent}`);
  }

  function resetGame(options = {}) {
    gameState = resetGameState(pieceIds);
    activeDrag = null;
    completionDismissed = false;
    board.classList.remove('solved');
    completionFeedback.clear();
    clearHints();
    clearReadySlots();
    celebration.hidden = true;
    renderPuzzle();
    updateProgress();
    recomputeGlueGroups();
    saveState();
    renderImageLibrary();

    if (!options.preserveFocus) {
      resetButton.focus();
    }
  }

  function setGridSize(size) {
    if (size === gridSize) {
      return;
    }

    activeDrag = null;
    gridSize = size;
    pieceIds = createPieceIds(gridSize);
    trayPieceIds = shufflePieceIds(pieceIds);
    completionDismissed = false;
    clearHints();
    setGridVariables();
    updateGridButtons();
    resetGame({ preserveFocus: true });
    refreshEquivalentTargets();
    setStatus(`已切换为 ${gridSize}x${gridSize}`);
  }

  function onGridButtonClick(event) {
    setGridSize(Number(event.currentTarget.dataset.gridSize));
  }

  async function onImageChange(event) {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setStatus('请选择图片文件');
      imageInput.value = '';
      return;
    }

    setStatus('正在上传图片');

    try {
      const formData = new FormData();
      formData.append('image', file, file.name);

      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || '上传失败，请换一张图片');
      }

      imageLibrary = Array.isArray(result.images) ? result.images : [];
      renderImageLibrary();
      await selectLibraryImage(result.image, { silent: true });
      setStatus(`已上传 ${result.image.name}`);
    } catch (error) {
      setStatus(error.message || '上传失败，请换一张图片');
    } finally {
      imageInput.value = '';
    }
  }

  for (const button of gridButtons) {
    button.addEventListener('click', onGridButtonClick);
  }

  for (const button of modeButtons) {
    button.addEventListener('click', onModeButtonClick);
  }

  imageInput.addEventListener('change', onImageChange);
  resetButton.addEventListener('click', () => resetGame());
  seeAgainButton.addEventListener('click', hideCelebration);
  nextImageButton.addEventListener('click', goToNextImage);

  resizeObserver = layout.observeResize();

  setPuzzleImage(currentImageUrl);
  setPuzzleRatio(600, 420);
  setGridVariables();
  updateModeControls();
  renderPuzzle();
  updateProgress();
  loadImageLibrary();
})();

