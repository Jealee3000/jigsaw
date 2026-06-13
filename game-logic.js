const SUPPORTED_GRID_SIZES = Object.freeze([2, 3, 4, 5]);

function createPieceIds(gridSize) {
  if (!SUPPORTED_GRID_SIZES.includes(gridSize)) {
    throw new Error(`Unsupported grid size: ${gridSize}`);
  }

  const ids = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      ids.push(`piece-${row}-${col}`);
    }
  }
  return ids;
}

function createPiecesState(pieceIds) {
  return pieceIds.reduce((pieces, pieceId) => {
    pieces[pieceId] = {
      pieceId,
      placed: false,
      targetId: pieceId,
      currentTargetId: null,
    };
    return pieces;
  }, {});
}

function createGameState(pieceIds = createPieceIds(2)) {
  return {
    pieceIds: [...pieceIds],
    pieces: createPiecesState(pieceIds),
    placedCount: 0,
  };
}

function cloneGameState(state) {
  return {
    pieceIds: [...state.pieceIds],
    pieces: Object.fromEntries(
      Object.entries(state.pieces).map(([pieceId, piece]) => [
        pieceId,
        { ...piece },
      ]),
    ),
    placedCount: state.placedCount,
  };
}

function getDistance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function equivalentTargetList(equivalentTargets, pieceId) {
  if (!equivalentTargets) {
    return [];
  }

  if (equivalentTargets instanceof Map) {
    return equivalentTargets.get(pieceId) || [];
  }

  return equivalentTargets[pieceId] || [];
}

function isTargetAccepted(piece, targetId, equivalentTargets) {
  return piece.targetId === targetId
    || equivalentTargetList(equivalentTargets, piece.targetId).includes(targetId)
    || equivalentTargetList(equivalentTargets, piece.pieceId).includes(targetId);
}

function tryPlacePiece(state, options) {
  const next = cloneGameState(state);
  const piece = next.pieces[options.pieceId];

  if (!piece || piece.placed || !isTargetAccepted(piece, options.targetId, options.equivalentTargets)) {
    return next;
  }

  const distance = getDistance(options.pieceCenter, options.targetCenter);

  if (distance <= options.snapThreshold) {
    piece.placed = true;
    piece.currentTargetId = options.targetId;
    next.placedCount += 1;
  }

  return next;
}

function isComplete(state) {
  return state.pieceIds.every((pieceId) => state.pieces[pieceId]?.placed === true);
}

function resetGameState(pieceIds = createPieceIds(2)) {
  return createGameState(pieceIds);
}

const PuppyJigsawLogic = {
  SUPPORTED_GRID_SIZES,
  createPieceIds,
  createGameState,
  isTargetAccepted,
  tryPlacePiece,
  isComplete,
  resetGameState,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PuppyJigsawLogic;
}

if (typeof window !== 'undefined') {
  window.PuppyJigsawLogic = PuppyJigsawLogic;
}
