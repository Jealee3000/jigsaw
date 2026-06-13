(function () {
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

  function getClosestSlot(slots, point) {
    return slots
      .map((slot) => getSlotDetails(slot, point))
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function getBestOverlappedSlot(slots, pieceRect, point) {
    return slots
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

  function getRectOverlapDetails(slot, pieceRect) {
    const point = {
      x: pieceRect.left + pieceRect.width / 2,
      y: pieceRect.top + pieceRect.height / 2,
    };
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
  }

  function getDropSlot({ correction, slots, point, piece }) {
    if (correction) {
      return getClosestSlot(slots, point);
    }

    const pieceRect = piece.getBoundingClientRect();
    const overlappedSlot = getBestOverlappedSlot(slots, pieceRect, point);
    return overlappedSlot?.overlapRatio > 0 ? overlappedSlot : getClosestSlot(slots, point);
  }

  function isDropReady(slotDetails, correction) {
    if (!slotDetails) {
      return false;
    }

    if (!correction && typeof slotDetails.overlapRatio === 'number') {
      return slotDetails.overlapRatio >= 0.35
        || slotDetails.distance <= slotDetails.snapThreshold;
    }

    return slotDetails.distance <= slotDetails.snapThreshold;
  }

  function releasePointerCapture(piece, pointerId) {
    if (piece.hasPointerCapture(pointerId)) {
      piece.releasePointerCapture(pointerId);
    }
  }

  function movePieceToPointer(activeDrag, piece, clientX, clientY) {
    const width = activeDrag?.width || piece.getBoundingClientRect().width;
    const height = activeDrag?.height || piece.getBoundingClientRect().height;
    const offsetX = activeDrag?.offsetX ?? width / 2;
    const offsetY = activeDrag?.offsetY ?? height / 2;

    piece.style.left = `${clientX - offsetX}px`;
    piece.style.top = `${clientY - offsetY}px`;
  }

  function moveDraggedPiecesToPointer(activeDrag, clientX, clientY) {
    if (!activeDrag?.dragItems) {
      movePieceToPointer(activeDrag, activeDrag.piece, clientX, clientY);
      return;
    }

    for (const item of activeDrag.dragItems) {
      item.piece.style.left = `${clientX - item.offsetX}px`;
      item.piece.style.top = `${clientY - item.offsetY}px`;
    }
  }

  function prepareDraggingPiece(item) {
    item.piece.style.setProperty('--drag-width', `${item.width}px`);
    item.piece.style.setProperty('--drag-height', `${item.height}px`);
    item.piece.classList.add('dragging');
  }

  function buildGroupDropTargets({ drag, activeTargetId, gridSize, shiftedTargetId, targetOffset }) {
    if (!drag.originTargetId || !activeTargetId) {
      return null;
    }

    const offset = targetOffset(drag.originTargetId, activeTargetId);
    const targets = new Map();

    for (const item of drag.dragItems) {
      if (!item.originTargetId) {
        return null;
      }

      const targetId = shiftedTargetId(item.originTargetId, offset, gridSize);
      if (!targetId || targets.has(targetId)) {
        return null;
      }

      targets.set(item.pieceId, targetId);
    }

    return targets;
  }

  function getBestGroupDrop({
    drag,
    slots,
    correction,
    gridSize,
    shiftedTargetId,
    targetOffset,
  }) {
    const slotsByTarget = new Map(slots.map((slot) => [slot.dataset.targetId, slot]));
    let bestDrop = null;

    for (const activeSlot of slots) {
      const targets = buildGroupDropTargets({
        drag,
        activeTargetId: activeSlot.dataset.targetId,
        gridSize,
        shiftedTargetId,
        targetOffset,
      });

      if (!targets) {
        continue;
      }

      let score = 0;
      let readyPieces = 0;
      let overlapTotal = 0;

      for (const item of drag.dragItems) {
        const targetId = targets.get(item.pieceId);
        const slot = slotsByTarget.get(targetId);
        if (!slot) {
          score = Number.NEGATIVE_INFINITY;
          break;
        }

        const details = getRectOverlapDetails(slot, item.piece.getBoundingClientRect());
        const ready = isDropReady(details, correction);
        if (ready) {
          readyPieces += 1;
        }
        overlapTotal += details.overlapRatio || 0;

        score += correction
          ? details.snapThreshold - details.distance
          : details.overlapRatio * 1000 - details.distance;
      }

      const averageOverlap = overlapTotal / Math.max(1, drag.dragItems.length);
      const groupReady = correction
        ? readyPieces === drag.dragItems.length
        : readyPieces === drag.dragItems.length || averageOverlap >= 0.28;

      if (!groupReady) {
        continue;
      }

      if (!bestDrop || score > bestDrop.score) {
        bestDrop = { targets, score };
      }
    }

    return bestDrop;
  }

  function collectGroupBlockers(targets, groupPieceIds, getPlacedPieceAtTarget) {
    const groupSet = new Set(groupPieceIds);
    const blockers = [];

    for (const [pieceId, targetId] of targets.entries()) {
      const occupiedPiece = getPlacedPieceAtTarget(targetId, pieceId);
      if (occupiedPiece && !groupSet.has(occupiedPiece.dataset.pieceId)) {
        blockers.push(occupiedPiece);
      }
    }

    return blockers;
  }

  function buildGroupSwapTargets({
    drag,
    targets,
    gridSize,
    gameState,
    modeState,
    equivalentTargets,
    getPlacedPieceAtTarget,
    isTargetAccepted,
    shiftedTargetId,
    targetOffset,
  }) {
    const activeTargetId = targets.get(drag.pieceId);
    if (!drag.originTargetId || !activeTargetId) {
      return null;
    }

    const blockers = collectGroupBlockers(targets, drag.groupPieceIds, getPlacedPieceAtTarget);
    if (!blockers.length) {
      return new Map();
    }

    const offset = targetOffset(drag.originTargetId, activeTargetId);
    const inverseOffset = { row: -offset.row, col: -offset.col };
    const groupSet = new Set(drag.groupPieceIds);
    const blockerSet = new Set(blockers.map((piece) => piece.dataset.pieceId));
    const swapTargets = new Map();
    const usedTargets = new Set();

    for (const blocker of blockers) {
      const pieceId = blocker.dataset.pieceId;
      const piece = gameState.pieces[pieceId];
      const currentTargetId = blocker.dataset.currentTargetId || piece?.currentTargetId;
      const swapTargetId = shiftedTargetId(currentTargetId, inverseOffset, gridSize);

      if (!piece || !swapTargetId || usedTargets.has(swapTargetId)) {
        return null;
      }

      const occupiedPiece = getPlacedPieceAtTarget(swapTargetId, pieceId);
      if (
        occupiedPiece
        && !groupSet.has(occupiedPiece.dataset.pieceId)
        && !blockerSet.has(occupiedPiece.dataset.pieceId)
      ) {
        return null;
      }

      if (
        modeState.correction
        && !isTargetAccepted(piece, swapTargetId, equivalentTargets)
      ) {
        return null;
      }

      swapTargets.set(pieceId, swapTargetId);
      usedTargets.add(swapTargetId);
    }

    return swapTargets;
  }

  function canPlaceGroup({
    targets,
    groupPieceIds,
    swapTargets = new Map(),
    gameState,
    modeState,
    equivalentTargets,
    getSlotByTargetId,
    getPlacedPieceAtTarget,
    isTargetAccepted,
  }) {
    const groupSet = new Set(groupPieceIds);
    const swappableBlockers = new Set(swapTargets.keys());

    for (const [pieceId, targetId] of targets.entries()) {
      if (!getSlotByTargetId(targetId)) {
        return false;
      }

      const occupiedPiece = getPlacedPieceAtTarget(targetId, pieceId);
      if (
        occupiedPiece
        && !groupSet.has(occupiedPiece.dataset.pieceId)
        && !swappableBlockers.has(occupiedPiece.dataset.pieceId)
      ) {
        return false;
      }

      if (
        modeState.correction
        && !isTargetAccepted(gameState.pieces[pieceId], targetId, equivalentTargets)
      ) {
        return false;
      }
    }

    return true;
  }

  window.PuppyJigsawDrag = {
    getSnapThreshold,
    getSlotDetails,
    getDropSlot,
    isDropReady,
    releasePointerCapture,
    moveDraggedPiecesToPointer,
    prepareDraggingPiece,
    buildGroupDropTargets,
    getBestGroupDrop,
    buildGroupSwapTargets,
    canPlaceGroup,
  };
})();
