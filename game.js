(function () {
  const {
    createPieceIds,
    createGameState,
    tryPlacePiece,
    isComplete,
    resetGameState,
  } = window.PuppyJigsawLogic;

  const root = document.documentElement;
  const board = document.querySelector('#board');
  const slotLayer = document.querySelector('#slot-layer');
  const tray = document.querySelector('#tray');
  const progress = document.querySelector('.progress');
  const resetButton = document.querySelector('#reset-button');
  const replayButton = document.querySelector('#replay-button');
  const celebration = document.querySelector('#celebration');
  const imageInput = document.querySelector('#image-input');
  const statusMessage = document.querySelector('#status-message');
  const gridButtons = Array.from(document.querySelectorAll('.grid-button'));
  const suppressedClicks = new WeakSet();

  let gridSize = 2;
  let pieceIds = createPieceIds(gridSize);
  let gameState = createGameState(pieceIds);
  let currentImageUrl = getFallbackImageUrl();
  let activeDrag = null;

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

  function setPuzzleImage(url) {
    root.style.setProperty('--puzzle-image', `url("${url}")`);
  }

  function setGridVariables() {
    root.style.setProperty('--grid-size', gridSize);
    root.style.setProperty('--tray-columns', gridSize === 4 ? 4 : gridSize);
  }

  function parsePieceId(pieceId) {
    const [, row, col] = pieceId.match(/^piece-(\d+)-(\d+)$/) || [];
    return {
      row: Number(row),
      col: Number(col),
    };
  }

  function getPiecePosition(pieceId) {
    const { row, col } = parsePieceId(pieceId);
    const max = gridSize - 1;
    const x = max === 0 ? 0 : (col / max) * 100;
    const y = max === 0 ? 0 : (row / max) * 100;
    return `${x}% ${y}%`;
  }

  function getPieceLabel(pieceId) {
    const { row, col } = parsePieceId(pieceId);
    return `${row + 1}-${col + 1}`;
  }

  function createSlot(pieceId) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.targetId = pieceId;
    slot.setAttribute('aria-label', `${getPieceLabel(pieceId)} 拼图位置`);
    return slot;
  }

  function createPiece(pieceId) {
    const piece = document.createElement('button');
    const label = document.createElement('span');
    piece.className = `piece${gridSize >= 4 ? ' compact' : ''}`;
    piece.dataset.pieceId = pieceId;
    piece.type = 'button';
    piece.style.setProperty('--piece-position', getPiecePosition(pieceId));
    piece.setAttribute('aria-label', `${getPieceLabel(pieceId)} 拼图片`);
    label.className = 'piece-label';
    label.textContent = getPieceLabel(pieceId);
    piece.appendChild(label);
    bindPieceEvents(piece);
    return piece;
  }

  function getPieces() {
    return pieceIds.map((pieceId) => document.querySelector(`.piece[data-piece-id="${pieceId}"]`))
      .filter(Boolean);
  }

  function getSlots() {
    return pieceIds.map((pieceId) => document.querySelector(`.slot[data-target-id="${pieceId}"]`))
      .filter(Boolean);
  }

  function getSlotForPiece(pieceId) {
    return document.querySelector(`.slot[data-target-id="${pieceId}"]`);
  }

  function renderPuzzle() {
    for (const piece of Array.from(board.querySelectorAll('.piece'))) {
      piece.remove();
    }

    slotLayer.replaceChildren();
    tray.replaceChildren();

    for (const pieceId of pieceIds) {
      slotLayer.appendChild(createSlot(pieceId));
      tray.appendChild(createPiece(pieceId));
    }
  }

  function getSnapThreshold(slotRect) {
    return Math.max(24, Math.min(72, Math.min(slotRect.width, slotRect.height) * 0.32));
  }

  function getSlotDetails(slot, point) {
    const rect = slot.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    return {
      slot,
      rect,
      center,
      distance: Math.hypot(point.x - center.x, point.y - center.y),
      snapThreshold: getSnapThreshold(rect),
      targetId: slot.dataset.targetId,
    };
  }

  function getClosestSlot(point) {
    return getSlots()
      .map((slot) => getSlotDetails(slot, point))
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function clearReadySlots() {
    for (const slot of getSlots()) {
      slot.classList.remove('ready');
    }
  }

  function releasePointerCapture(piece, pointerId) {
    if (piece.hasPointerCapture(pointerId)) {
      piece.releasePointerCapture(pointerId);
    }
  }

  function insertPieceInOriginalOrder(piece) {
    const order = pieceIds.indexOf(piece.dataset.pieceId);
    const nextPiece = Array.from(tray.children).find((child) => (
      child.classList.contains('piece')
      && pieceIds.indexOf(child.dataset.pieceId) > order
    ));

    tray.insertBefore(piece, nextPiece || null);
  }

  function setReadySlot(slotDetails) {
    clearReadySlots();

    if (slotDetails && slotDetails.distance <= slotDetails.snapThreshold) {
      slotDetails.slot.classList.add('ready');
    }
  }

  function movePieceToPointer(piece, clientX, clientY) {
    const width = activeDrag?.width || piece.getBoundingClientRect().width;
    const height = activeDrag?.height || piece.getBoundingClientRect().height;

    piece.style.left = `${clientX - width / 2}px`;
    piece.style.top = `${clientY - height / 2}px`;
  }

  function updateProgress() {
    progress.textContent = `${gameState.placedCount} / ${pieceIds.length}`;
    progress.setAttribute('aria-label', `完成 ${gameState.placedCount} / ${pieceIds.length}`);
  }

  function showCelebrationIfComplete() {
    if (isComplete(gameState)) {
      celebration.hidden = false;
      window.setTimeout(() => replayButton.focus(), 0);
      return true;
    }

    return false;
  }

  function placePiece(piece, slot) {
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
    piece.tabIndex = -1;
    piece.setAttribute('aria-disabled', 'true');

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
    piece.removeAttribute('aria-disabled');
    piece.removeAttribute('tabindex');
    insertPieceInOriginalOrder(piece);
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

    if (gameState.pieces[pieceId]?.placed) {
      return;
    }

    const rect = piece.getBoundingClientRect();
    activeDrag = {
      piece,
      pieceId,
      pointerId: event.pointerId,
      width: rect.width,
      height: rect.height,
      startX: event.clientX,
      startY: event.clientY,
      didMove: false,
    };

    event.preventDefault();
    piece.setPointerCapture(event.pointerId);
    piece.style.setProperty('--drag-width', `${rect.width}px`);
    piece.style.setProperty('--drag-height', `${rect.height}px`);
    piece.classList.add('dragging');
    movePieceToPointer(piece, event.clientX, event.clientY);
    setReadySlot(getClosestSlot({ x: event.clientX, y: event.clientY }));
  }

  function onPointerMove(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    event.preventDefault();
    activeDrag.didMove = activeDrag.didMove
      || Math.hypot(event.clientX - activeDrag.startX, event.clientY - activeDrag.startY) > 6;
    movePieceToPointer(activeDrag.piece, event.clientX, event.clientY);
    setReadySlot(getClosestSlot({ x: event.clientX, y: event.clientY }));
  }

  function onPointerUp(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    const drag = activeDrag;
    const point = { x: event.clientX, y: event.clientY };
    const closestSlot = getClosestSlot(point);
    const nextState = closestSlot
      ? tryPlacePiece(gameState, {
        pieceId: drag.pieceId,
        targetId: closestSlot.targetId,
        pieceCenter: point,
        targetCenter: closestSlot.center,
        snapThreshold: closestSlot.snapThreshold,
      })
      : gameState;

    activeDrag = null;
    clearReadySlots();
    releasePointerCapture(drag.piece, event.pointerId);

    if (drag.didMove) {
      suppressedClicks.add(drag.piece);
    }

    if (nextState.pieces[drag.pieceId]?.placed) {
      gameState = nextState;
      placePiece(drag.piece, closestSlot.slot);
      updateProgress();
      showCelebrationIfComplete();
      return;
    }

    setPieceLoose(drag.piece);
    if (!drag.didMove) {
      placePieceByActivation(drag.piece);
    }
  }

  function onPointerCancel(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    releasePointerCapture(activeDrag.piece, event.pointerId);
    suppressedClicks.add(activeDrag.piece);
    returnActivePieceToTray();
  }

  function placePieceByActivation(piece) {
    const pieceId = piece.dataset.pieceId;
    const targetId = gameState.pieces[pieceId]?.targetId;
    const slot = getSlotForPiece(targetId);

    if (activeDrag || gameState.pieces[pieceId]?.placed || !slot) {
      return;
    }

    const slotDetails = getSlotDetails(slot, { x: 0, y: 0 });
    const nextState = tryPlacePiece(gameState, {
      pieceId,
      targetId,
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

    if (!showCelebrationIfComplete()) {
      focusFirstLoosePiece();
    }
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

  function resetGame(options = {}) {
    gameState = resetGameState(pieceIds);
    activeDrag = null;
    clearReadySlots();
    celebration.hidden = true;
    renderPuzzle();
    updateProgress();

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
    setGridVariables();
    updateGridButtons();
    resetGame({ preserveFocus: true });
    setStatus(`已切换为 ${gridSize}x${gridSize}`);
  }

  function onGridButtonClick(event) {
    setGridSize(Number(event.currentTarget.dataset.gridSize));
  }

  function onImageChange(event) {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setStatus('请选择图片文件');
      return;
    }

    if (currentImageUrl && currentImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentImageUrl);
    }

    currentImageUrl = URL.createObjectURL(file);
    setPuzzleImage(currentImageUrl);
    setStatus('图片只在本机使用');
    resetGame({ preserveFocus: true });
  }

  for (const button of gridButtons) {
    button.addEventListener('click', onGridButtonClick);
  }

  imageInput.addEventListener('change', onImageChange);
  resetButton.addEventListener('click', () => resetGame());
  replayButton.addEventListener('click', () => resetGame());

  setPuzzleImage(currentImageUrl);
  setGridVariables();
  renderPuzzle();
  updateProgress();
})();
