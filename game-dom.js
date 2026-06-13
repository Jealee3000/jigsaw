(function () {
  function getPixels(value) {
    return Number.parseFloat(value) || 0;
  }

  function createLayoutController({
    root,
    board,
    slotLayer,
    getGridSize,
    getPuzzleRatio,
  }) {
    function setGridVariables() {
      const gridSize = getGridSize();
      root.style.setProperty('--grid-size', gridSize);
      root.style.setProperty('--tray-columns', gridSize);
    }

    function syncLayoutSize() {
      const shell = document.querySelector('.game-shell');
      const gameLayout = document.querySelector('.game-layout');
      const imageLibraryNode = document.querySelector('.image-library');
      const playArea = document.querySelector('.play-area');

      if (!shell || !gameLayout || !imageLibraryNode || !playArea) {
        return;
      }

      const gridSize = getGridSize();
      const puzzleRatio = getPuzzleRatio();
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

      const gridSize = getGridSize();
      root.style.setProperty('--piece-width', `${rect.width}px`);
      root.style.setProperty('--piece-height', `${rect.height}px`);
      root.style.setProperty('--tray-width', `${rect.width * gridSize}px`);
      root.style.setProperty('--tray-height', `${rect.height * gridSize}px`);
    }

    function observeResize() {
      if ('ResizeObserver' in window) {
        const resizeObserver = new ResizeObserver(syncLoosePieceSize);
        resizeObserver.observe(board);
        window.addEventListener('resize', syncLayoutSize);
        return resizeObserver;
      }

      window.addEventListener('resize', syncLoosePieceSize);
      window.addEventListener('resize', syncLayoutSize);
      return null;
    }

    return {
      setGridVariables,
      syncLayoutSize,
      syncLoosePieceSize,
      observeResize,
    };
  }

  function parsePieceId(pieceId) {
    const [, row, col] = pieceId.match(/^piece-(\d+)-(\d+)$/) || [];
    return {
      row: Number(row),
      col: Number(col),
    };
  }

  function getPiecePosition(pieceId, gridSize) {
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

  function createSlot(pieceId, gridSize) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.targetId = pieceId;
    slot.style.setProperty('--piece-position', getPiecePosition(pieceId, gridSize));
    slot.setAttribute('aria-label', `${getPieceLabel(pieceId)} 拼图位置`);
    return slot;
  }

  function createPiece(pieceId, gridSize, bindPieceEvents) {
    const piece = document.createElement('button');
    const label = document.createElement('span');
    piece.className = `piece${gridSize >= 4 ? ' compact' : ''}`;
    piece.dataset.pieceId = pieceId;
    piece.type = 'button';
    piece.style.setProperty('--piece-position', getPiecePosition(pieceId, gridSize));
    piece.setAttribute('aria-label', `${getPieceLabel(pieceId)} 拼图片`);
    label.className = 'piece-label';
    label.textContent = getPieceLabel(pieceId);
    piece.appendChild(label);
    bindPieceEvents(piece);
    return piece;
  }

  function getPieces(pieceIds) {
    return pieceIds.map((pieceId) => document.querySelector(`.piece[data-piece-id="${pieceId}"]`))
      .filter(Boolean);
  }

  function getSlots(pieceIds) {
    return pieceIds.map((pieceId) => document.querySelector(`.slot[data-target-id="${pieceId}"]`))
      .filter(Boolean);
  }

  function getSlotForPiece(pieceId) {
    return document.querySelector(`.slot[data-target-id="${pieceId}"]`);
  }

  function updateSlotOccupancy({ gameState, slots }) {
    const occupiedTargets = new Set(
      Object.values(gameState.pieces)
        .filter((piece) => piece.placed && piece.currentTargetId)
        .map((piece) => piece.currentTargetId),
    );

    for (const slot of slots) {
      slot.classList.toggle('occupied', occupiedTargets.has(slot.dataset.targetId));
    }
  }

  window.PuppyJigsawDom = {
    createLayoutController,
    createPiece,
    createSlot,
    getPieces,
    getSlots,
    getSlotForPiece,
    updateSlotOccupancy,
  };
})();
