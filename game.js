(function () {
  const {
    createGameState,
    tryPlacePiece,
    isComplete,
    resetGameState,
  } = window.PuppyJigsawLogic;

  const board = document.querySelector('#board');
  const tray = document.querySelector('#tray');
  const pieces = Array.from(document.querySelectorAll('.piece'));
  const slots = Array.from(document.querySelectorAll('.slot'));
  const stars = Array.from(document.querySelectorAll('.star'));
  const progress = document.querySelector('.progress');
  const resetButton = document.querySelector('#reset-button');
  const replayButton = document.querySelector('#replay-button');
  const celebration = document.querySelector('#celebration');
  const pieceOrder = new Map(
    pieces.map((piece, index) => [piece.dataset.pieceId, index]),
  );
  const suppressedClicks = new WeakSet();

  let gameState = createGameState();
  let activeDrag = null;

  function getSnapThreshold(slotRect) {
    return Math.max(34, Math.min(72, Math.min(slotRect.width, slotRect.height) * 0.28));
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
    return slots
      .map((slot) => getSlotDetails(slot, point))
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function clearReadySlots() {
    for (const slot of slots) {
      slot.classList.remove('ready');
    }
  }

  function releasePointerCapture(piece, pointerId) {
    if (piece.hasPointerCapture(pointerId)) {
      piece.releasePointerCapture(pointerId);
    }
  }

  function insertPieceInOriginalOrder(piece) {
    const order = pieceOrder.get(piece.dataset.pieceId);
    const nextPiece = Array.from(tray.children).find((child) => (
      child.classList.contains('piece')
      && pieceOrder.get(child.dataset.pieceId) > order
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
    stars.forEach((star, index) => {
      star.classList.toggle('filled', index < gameState.placedCount);
    });

    progress.setAttribute(
      'aria-label',
      `\u5b8c\u6210 ${gameState.placedCount} / ${pieces.length}`,
    );
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
    const piece = pieces.find((candidate) => {
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
    const slot = slots.find((candidate) => candidate.dataset.targetId === targetId);

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

  function resetGame() {
    gameState = resetGameState();
    activeDrag = null;
    clearReadySlots();
    celebration.hidden = true;

    for (const piece of pieces) {
      setPieceLoose(piece);
    }

    updateProgress();
    resetButton.focus();
  }

  for (const piece of pieces) {
    piece.addEventListener('pointerdown', onPointerDown);
    piece.addEventListener('pointermove', onPointerMove);
    piece.addEventListener('pointerup', onPointerUp);
    piece.addEventListener('pointercancel', onPointerCancel);
    piece.addEventListener('click', onPieceClick);
    piece.addEventListener('keydown', onPieceKeyDown);
  }

  resetButton.addEventListener('click', resetGame);
  replayButton.addEventListener('click', resetGame);
  updateProgress();
})();
