const PIECES = Object.freeze([
  'sky-puppy',
  'sun-house',
  'grass-puppy',
  'garden-toys',
]);

function createPiecesState() {
  return PIECES.reduce((pieces, pieceId) => {
    pieces[pieceId] = {
      placed: false,
      targetId: pieceId,
    };
    return pieces;
  }, {});
}

function createGameState() {
  return {
    pieces: createPiecesState(),
    placedCount: 0,
  };
}

function cloneGameState(state) {
  return {
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

function tryPlacePiece(state, options) {
  const next = cloneGameState(state);
  const piece = next.pieces[options.pieceId];

  if (!piece || piece.placed || piece.targetId !== options.targetId) {
    return next;
  }

  const distance = getDistance(options.pieceCenter, options.targetCenter);

  if (distance <= options.snapThreshold) {
    piece.placed = true;
    piece.targetId = options.targetId;
    next.placedCount += 1;
  }

  return next;
}

function isComplete(state) {
  return PIECES.every((pieceId) => state.pieces[pieceId]?.placed === true);
}

function resetGameState() {
  return createGameState();
}

const PuppyJigsawLogic = {
  PIECES,
  createGameState,
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
