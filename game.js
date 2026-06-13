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
  const State = window.PuppyJigsawState;
  const ImageTools = window.PuppyJigsawImage;
  const ImageService = window.PuppyJigsawImageService;
  const HintTools = window.PuppyJigsawHints;
  const CompletionFlow = window.PuppyJigsawCompletionFlow;

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
  const fallbackImageUrl = ImageTools.getFallbackImageUrl();

  let gridSize = 2;
  let pieceIds = createPieceIds(gridSize);
  let trayPieceIds = State.shufflePieceIds(pieceIds);
  let gameState = createGameState(pieceIds);
  let currentImageUrl = fallbackImageUrl;
  let imageLibrary = [];
  let imageLoadToken = 0;
  let activeDrag = null;
  let resizeObserver = null;
  let puzzleRatio = 600 / 420;
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
  const completionFlow = CompletionFlow.createCompletionFlow({
    board,
    celebration,
    nextImageButton,
    completionFeedback,
    getCompletionDismissed: () => completionDismissed,
    setCompletionDismissed: (value) => {
      completionDismissed = value;
    },
    getImageLibrary: () => imageLibrary,
    isPuzzleSolved,
    renderImageLibrary,
    saveState,
    selectLibraryImage,
    selectedImageName,
    setStatus,
  });
  const hints = HintTools.createHintController({
    getPieces,
    getPieceIds: () => pieceIds,
    getSlots,
    getCurrentImageUrl: () => currentImageUrl,
    getGridSize: () => gridSize,
    getImageSignature: () => selectedImage()?.signature || '',
    findDetailedHintPieceId,
    saveState,
    setStatus,
  });

  function setStatus(message) {
    statusMessage.textContent = message;
  }

  function selectedImageName() {
    return State.selectedImageName(imageLibrary, currentImageUrl);
  }

  function selectedImage() {
    return State.selectedImage(imageLibrary, currentImageUrl);
  }

  function orderedPieceIds(ids) {
    return State.orderedPieceIds(pieceIds, ids);
  }

  function serializeCurrentImageState() {
    return State.serializeCurrentImageState({
      gridSize,
      imageSignature: selectedImage()?.signature || null,
      trayPieceIds,
      modeState,
      pieceIds,
      gameState,
      hintPieces: hints.getHintPieces(),
      completionDismissed,
      solved: isPuzzleSolved(),
    });
  }

  function cleanSavedDataForLibrary() {
    const saved = readSavedData();
    if (State.pruneSavedDataForLibrary(saved, imageLibrary)) {
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

  async function setCurrentImage(url) {
    const token = imageLoadToken + 1;
    imageLoadToken = token;
    currentImageUrl = url;
    setPuzzleImage(url);

    const size = await ImageTools.loadImageSize(url);
    if (token === imageLoadToken) {
      setPuzzleRatio(size.width, size.height);
      await refreshEquivalentTargets();
    }
  }

  function shufflePieceIds(ids) {
    return State.shufflePieceIds(ids);
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

  function addHintPiece() {
    hints.addHintPiece();
  }

  function clearHints() {
    hints.clearHints();
  }

  function updateGuideHint() {
    hints.updateGuideHint();
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
      imageLibrary = await ImageService.fetchImageLibrary();
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
    clearHints();

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

    hints.restoreHints(Array.isArray(saved.hints) ? saved.hints : [], usedTargets);
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
    return completionFlow.showCelebrationIfComplete();
  }

  function hideCelebration() {
    completionFlow.hideCelebration();
  }

  async function goToNextImage() {
    await completionFlow.goToNextImage();
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
    if (hints.getHintPieces().delete(slot.dataset.targetId)) {
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
      const pointerGroupTargets = closestSlot && Drag.isDropReady(closestSlot, modeState.correction)
        ? Drag.buildGroupDropTargets({
          drag,
          activeTargetId: closestSlot.targetId,
          gridSize,
          shiftedTargetId,
          targetOffset,
        })
        : null;
      const groupBoxDrop = Drag.buildGroupBoxDrop({
        drag,
        slots: getSlots(),
        gridSize,
        shiftedTargetId,
        targetOffset,
      });
      const groupDrop = Drag.getBestGroupDrop({
        drag,
        slots: getSlots(),
        correction: modeState.correction,
        gridSize,
        shiftedTargetId,
        targetOffset,
      });
      const anchoredGroupDrop = closestSlot && Drag.isDropReady(closestSlot, modeState.correction)
        ? Drag.buildAnchoredGroupDrop({
          drag,
          anchorTargetId: closestSlot.targetId,
          gridSize,
          shiftedTargetId,
          targetOffset,
        })
        : null;
      const groupTargets = groupBoxDrop?.targets || groupDrop?.targets || pointerGroupTargets || anchoredGroupDrop?.targets || null;
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
      const result = await ImageService.uploadImage(file);
      imageLibrary = result.images;
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

