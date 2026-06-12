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
  const modeState = {
    guide: true,
    correction: true,
  };

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
    board.classList.toggle('hide-guide', !modeState.guide);
    root.classList.toggle('free-placement', !modeState.correction);

    for (const button of modeButtons) {
      const isActive = Boolean(modeState[button.dataset.mode]);
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  }

  function getImageElement(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  async function findDetailedHintPieceId(url, size, allowedPieceIds = pieceIds) {
    const image = await getImageElement(url);
    const sampleSize = 32;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const width = sampleSize * size;
    const height = sampleSize * size;

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const allowed = new Set(allowedPieceIds);
    const scores = pieceIds.filter((pieceId) => allowed.has(pieceId)).map((pieceId) => {
      const { row, col } = parsePieceId(pieceId);
      const data = context.getImageData(
        col * sampleSize,
        row * sampleSize,
        sampleSize,
        sampleSize,
      ).data;
      let mean = 0;
      let meanSquared = 0;
      let saturation = 0;
      const pixels = data.length / 4;

      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const light = (red + green + blue) / 3;
        mean += light;
        meanSquared += light * light;
        saturation += Math.max(red, green, blue) - Math.min(red, green, blue);
      }

      mean /= pixels;
      meanSquared /= pixels;

      return {
        pieceId,
        score: Math.sqrt(Math.max(0, meanSquared - mean * mean)) + saturation / pixels / 3,
      };
    }).sort((first, second) => second.score - first.score);

    const usefulScores = scores.filter((entry) => entry.score > 8);
    const candidates = usefulScores.length > 0
      ? usefulScores.slice(0, Math.max(1, Math.ceil(usefulScores.length / 2)))
      : scores;
    return candidates[Math.floor(Math.random() * candidates.length)] || scores[0] || null;
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

    hintPieces.set(fallback, 0);
    updateGuideHint();
    setStatus(`已添加 ${hintPieces.size} 个提示`);

    findDetailedHintPieceId(url, size, candidates)
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

  function renderImageLibrary() {
    imageList.replaceChildren();

    if (imageLibrary.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'image-empty';
      empty.textContent = 'images 文件夹还没有图片';
      imageList.appendChild(empty);
      return;
    }

    for (const image of imageLibrary) {
      const button = document.createElement('button');
      const thumbnail = document.createElement('img');
      const name = document.createElement('span');

      button.className = 'image-card';
      button.type = 'button';
      button.dataset.imageName = image.name;
      button.classList.toggle('selected', image.url === currentImageUrl);
      button.setAttribute('aria-pressed', String(image.url === currentImageUrl));

      thumbnail.src = image.url;
      thumbnail.alt = image.name;
      thumbnail.loading = 'lazy';

      name.className = 'image-name';
      name.textContent = image.name;

      button.append(thumbnail, name);
      button.addEventListener('click', () => selectLibraryImage(image));
      imageList.appendChild(button);
    }
  }

  async function selectLibraryImage(image, options = {}) {
    if (!image) {
      return;
    }

    await setCurrentImage(image.url);
    clearHints();
    renderImageLibrary();
    resetGame({ preserveFocus: true });

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
      renderImageLibrary();

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
    root.style.setProperty('--grid-size', gridSize);
    root.style.setProperty('--tray-columns', gridSize);
  }

  function getPixels(value) {
    return Number.parseFloat(value) || 0;
  }

  function syncLayoutSize() {
    const shell = document.querySelector('.game-shell');
    const gameLayout = document.querySelector('.game-layout');
    const imageLibraryNode = document.querySelector('.image-library');
    const playArea = document.querySelector('.play-area');

    if (!shell || !gameLayout || !imageLibraryNode || !playArea) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const layoutRect = gameLayout.getBoundingClientRect();
    const libraryRect = imageLibraryNode.getBoundingClientRect();
    const layoutStyle = getComputedStyle(gameLayout);
    const playStyle = getComputedStyle(playArea);
    const boardStyle = getComputedStyle(board);
    const layoutGap = getPixels(layoutStyle.columnGap);
    const playGap = getPixels(playStyle.columnGap);
    const boardBorderX = getPixels(boardStyle.borderLeftWidth) + getPixels(boardStyle.borderRightWidth);
    const boardBorderY = getPixels(boardStyle.borderTopWidth) + getPixels(boardStyle.borderBottomWidth);
    const verticalRoom = window.innerHeight - layoutRect.top - 14;
    const maxOuterHeight = Math.max(180, verticalRoom);
    const contentRatio = Math.max(0.2, puzzleRatio);
    const widthFromHeight = (maxOuterHeight - boardBorderY) * contentRatio + boardBorderX;
    const horizontalRoom = shellRect.width - libraryRect.width - layoutGap - playGap;
    const maxByHorizontalRoom = Math.max(240, (horizontalRoom + boardBorderX) / 2);
    const boardOuterWidth = Math.max(240, Math.floor(Math.min(maxByHorizontalRoom, widthFromHeight)));
    const boardContentWidth = Math.max(160, boardOuterWidth - boardBorderX);
    const boardContentHeight = Math.max(120, Math.floor(boardContentWidth / contentRatio));
    const boardOuterHeight = boardContentHeight + boardBorderY;
    const pieceWidth = boardContentWidth / gridSize;
    const pieceHeight = boardContentHeight / gridSize;

    root.style.setProperty('--board-width', `${boardOuterWidth}px`);
    root.style.setProperty('--board-height', `${boardOuterHeight}px`);
    root.style.setProperty('--tray-width', `${boardContentWidth}px`);
    root.style.setProperty('--tray-height', `${boardContentHeight}px`);
    root.style.setProperty('--piece-width', `${pieceWidth}px`);
    root.style.setProperty('--piece-height', `${pieceHeight}px`);
  }

  function syncLoosePieceSize() {
    const slot = slotLayer.querySelector('.slot');
    if (!slot) {
      return;
    }

    const rect = slot.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    root.style.setProperty('--piece-width', `${rect.width}px`);
    root.style.setProperty('--piece-height', `${rect.height}px`);
    root.style.setProperty('--tray-width', `${rect.width * gridSize}px`);
    root.style.setProperty('--tray-height', `${rect.height * gridSize}px`);
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
    slot.style.setProperty('--piece-position', getPiecePosition(pieceId));
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

    trayPieceIds = shufflePieceIds(pieceIds);

    for (const pieceId of pieceIds) {
      slotLayer.appendChild(createSlot(pieceId));
    }

    updateGuideHint();

    for (const pieceId of trayPieceIds) {
      tray.appendChild(createPiece(pieceId));
    }

    requestAnimationFrame(() => {
      syncLayoutSize();
      syncLoosePieceSize();
    });
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

  function getBestOverlappedSlot(pieceRect, point) {
    return getSlots()
      .map((slot) => {
        const details = getSlotDetails(slot, point);
        const rect = details.rect;
        const overlapWidth = Math.max(
          0,
          Math.min(pieceRect.right, rect.right) - Math.max(pieceRect.left, rect.left),
        );
        const overlapHeight = Math.max(
          0,
          Math.min(pieceRect.bottom, rect.bottom) - Math.max(pieceRect.top, rect.top),
        );
        const overlapArea = overlapWidth * overlapHeight;
        const slotArea = Math.max(1, rect.width * rect.height);

        return {
          ...details,
          overlapArea,
          overlapRatio: overlapArea / slotArea,
        };
      })
      .sort((a, b) => b.overlapArea - a.overlapArea)[0] || null;
  }

  function getDropSlot(point, piece) {
    if (modeState.correction) {
      return getClosestSlot(point);
    }

    const pieceRect = piece.getBoundingClientRect();
    const overlappedSlot = getBestOverlappedSlot(pieceRect, point);
    return overlappedSlot?.overlapRatio > 0 ? overlappedSlot : getClosestSlot(point);
  }

  function isDropReady(slotDetails) {
    if (!slotDetails) {
      return false;
    }

    if (!modeState.correction && typeof slotDetails.overlapRatio === 'number') {
      return slotDetails.overlapRatio >= 0.35
        || slotDetails.distance <= slotDetails.snapThreshold;
    }

    return slotDetails.distance <= slotDetails.snapThreshold;
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
    const order = trayPieceIds.indexOf(piece.dataset.pieceId);
    const nextPiece = Array.from(tray.children).find((child) => (
      child.classList.contains('piece')
      && trayPieceIds.indexOf(child.dataset.pieceId) > order
    ));

    tray.insertBefore(piece, nextPiece || null);
  }

  function setReadySlot(slotDetails) {
    clearReadySlots();

    if (isDropReady(slotDetails)) {
      slotDetails.slot.classList.add('ready');
    }
  }

  function movePieceToPointer(piece, clientX, clientY) {
    const width = activeDrag?.width || piece.getBoundingClientRect().width;
    const height = activeDrag?.height || piece.getBoundingClientRect().height;
    const offsetX = activeDrag?.offsetX ?? width / 2;
    const offsetY = activeDrag?.offsetY ?? height / 2;

    piece.style.left = `${clientX - offsetX}px`;
    piece.style.top = `${clientY - offsetY}px`;
  }

  function updateProgress() {
    progress.textContent = `${gameState.placedCount} / ${pieceIds.length}`;
    progress.setAttribute('aria-label', `完成 ${gameState.placedCount} / ${pieceIds.length}`);
  }

  function isPuzzleSolved() {
    if (modeState.correction) {
      return isComplete(gameState);
    }

    return pieceIds.every((pieceId) => {
      const piece = gameState.pieces[pieceId];
      return piece?.placed === true && piece.currentTargetId === piece.targetId;
    });
  }

  function showCelebrationIfComplete() {
    if (isPuzzleSolved()) {
      celebration.hidden = false;
      window.setTimeout(() => replayButton.focus(), 0);
      return true;
    }

    return false;
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

    if (gameState.pieces[pieceId]?.placed && modeState.correction) {
      return;
    }

    const rect = piece.getBoundingClientRect();
    activeDrag = {
      piece,
      pieceId,
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
    markPieceLoose(pieceId);
    piece.setPointerCapture(event.pointerId);
    piece.style.setProperty('--drag-width', `${rect.width}px`);
    piece.style.setProperty('--drag-height', `${rect.height}px`);
    piece.classList.add('dragging');
    movePieceToPointer(piece, event.clientX, event.clientY);
    setReadySlot(getDropSlot({ x: event.clientX, y: event.clientY }, piece));
  }

  function onPointerMove(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    event.preventDefault();
    activeDrag.didMove = activeDrag.didMove
      || Math.hypot(event.clientX - activeDrag.startX, event.clientY - activeDrag.startY) > 6;
    movePieceToPointer(activeDrag.piece, event.clientX, event.clientY);
    setReadySlot(getDropSlot({ x: event.clientX, y: event.clientY }, activeDrag.piece));
  }

  function onPointerUp(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    const drag = activeDrag;
    const point = { x: event.clientX, y: event.clientY };
    movePieceToPointer(drag.piece, event.clientX, event.clientY);
    const closestSlot = getDropSlot(point, drag.piece);
    const nextState = closestSlot && modeState.correction
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

    if (
      !modeState.correction
      && closestSlot
      && isDropReady(closestSlot)
    ) {
      const blockingPiece = getPlacedPieceAtTarget(closestSlot.targetId, drag.pieceId);
      if (blockingPiece) {
        moveBlockingPiece(blockingPiece, drag);
      }
      markPiecePlaced(drag.pieceId, closestSlot.targetId);
      placePiece(drag.piece, closestSlot.slot);
      updateProgress();
      showCelebrationIfComplete();
      return;
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

  function onModeButtonClick(event) {
    const mode = event.currentTarget.dataset.mode;

    if (mode === 'hint') {
      addHintPiece();
      return;
    }

    modeState[mode] = !modeState[mode];
    updateModeControls();
    updateGuideHint();

    if (mode === 'correction') {
      resetGame({ preserveFocus: true });
      setStatus(modeState.correction ? '已开启纠错' : '已关闭纠错，可以放错位置');
      return;
    }

    setStatus(modeState[mode] ? `已开启${event.currentTarget.textContent}` : `已隐藏${event.currentTarget.textContent}`);
  }

  function resetGame(options = {}) {
    gameState = resetGameState(pieceIds);
    activeDrag = null;
    clearHints();
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
    trayPieceIds = shufflePieceIds(pieceIds);
    clearHints();
    setGridVariables();
    updateGridButtons();
    resetGame({ preserveFocus: true });
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
  replayButton.addEventListener('click', () => resetGame());

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(syncLoosePieceSize);
    resizeObserver.observe(board);
  } else {
    window.addEventListener('resize', syncLoosePieceSize);
  }
  window.addEventListener('resize', syncLayoutSize);

  setPuzzleImage(currentImageUrl);
  setPuzzleRatio(600, 420);
  setGridVariables();
  updateModeControls();
  renderPuzzle();
  updateProgress();
  loadImageLibrary();
})();
