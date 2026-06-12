const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPieceIds,
  createGameState,
  tryPlacePiece,
  isComplete,
  resetGameState,
} = require('./game-logic');

test('creates ordered piece ids for supported grid sizes', () => {
  assert.deepEqual(createPieceIds(2), [
    'piece-0-0',
    'piece-0-1',
    'piece-1-0',
    'piece-1-1',
  ]);
  assert.equal(createPieceIds(3).length, 9);
  assert.equal(createPieceIds(4).length, 16);
  assert.equal(createPieceIds(4)[15], 'piece-3-3');
});

test('rejects unsupported grid sizes', () => {
  assert.throws(() => createPieceIds(1), /grid size/i);
  assert.throws(() => createPieceIds(5), /grid size/i);
});

test('initializes dynamic state with matching target ids', () => {
  const pieceIds = createPieceIds(3);
  const state = createGameState(pieceIds);

  assert.equal(Object.keys(state.pieces).length, 9);
  for (const pieceId of pieceIds) {
    assert.equal(state.pieces[pieceId].targetId, pieceId);
    assert.equal(state.pieces[pieceId].placed, false);
  }
});

test('places a dynamic piece at its matching target', () => {
  const pieceIds = createPieceIds(3);
  const state = createGameState(pieceIds);

  const next = tryPlacePiece(state, {
    pieceId: 'piece-2-1',
    targetId: 'piece-2-1',
    pieceCenter: { x: 3, y: 4 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 5,
  });

  assert.equal(next.pieces['piece-2-1'].placed, true);
  assert.equal(next.placedCount, 1);
  assert.equal(state.pieces['piece-2-1'].placed, false);
});

test('does not place a dynamic piece just outside the euclidean snap threshold', () => {
  const state = createGameState(createPieceIds(2));

  const next = tryPlacePiece(state, {
    pieceId: 'piece-0-0',
    targetId: 'piece-0-0',
    pieceCenter: { x: 3, y: 4 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 4.99,
  });

  assert.equal(next.pieces['piece-0-0'].placed, false);
  assert.equal(next.placedCount, 0);
});

test('does not place a dynamic piece on a wrong target', () => {
  const state = createGameState(createPieceIds(4));

  const next = tryPlacePiece(state, {
    pieceId: 'piece-3-3',
    targetId: 'piece-0-0',
    pieceCenter: { x: 0, y: 0 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 20,
  });

  assert.equal(next.pieces['piece-3-3'].placed, false);
  assert.equal(next.placedCount, 0);
});

test('places a dynamic piece on an equivalent target', () => {
  const state = createGameState(createPieceIds(2));

  const next = tryPlacePiece(state, {
    pieceId: 'piece-0-0',
    targetId: 'piece-0-1',
    equivalentTargets: {
      'piece-0-0': ['piece-0-0', 'piece-0-1'],
    },
    pieceCenter: { x: 0, y: 0 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 20,
  });

  assert.equal(next.pieces['piece-0-0'].placed, true);
  assert.equal(next.pieces['piece-0-0'].currentTargetId, 'piece-0-1');
  assert.equal(next.placedCount, 1);
});

test('does not mutate input state or count an already placed dynamic piece twice', () => {
  const state = createGameState(createPieceIds(2));
  const placed = tryPlacePiece(state, {
    pieceId: 'piece-0-0',
    targetId: 'piece-0-0',
    pieceCenter: { x: 0, y: 0 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 20,
  });
  const repeated = tryPlacePiece(placed, {
    pieceId: 'piece-0-0',
    targetId: 'piece-0-0',
    pieceCenter: { x: 0, y: 0 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 20,
  });

  assert.equal(state.pieces['piece-0-0'].placed, false);
  assert.equal(state.placedCount, 0);
  assert.equal(repeated.placedCount, 1);
});

test('completion depends on all current dynamic pieces', () => {
  const pieceIds = createPieceIds(4);
  let state = createGameState(pieceIds);

  for (const pieceId of pieceIds) {
    state = tryPlacePiece(state, {
      pieceId,
      targetId: pieceId,
      pieceCenter: { x: 0, y: 0 },
      targetCenter: { x: 0, y: 0 },
      snapThreshold: 20,
    });
  }

  assert.equal(state.placedCount, 16);
  assert.equal(isComplete(state), true);
});

test('does not report completion for inconsistent dynamic placed count state', () => {
  const pieceIds = createPieceIds(3);
  const state = createGameState(pieceIds);
  state.placedCount = 9;
  state.pieces['piece-0-0'].placed = true;

  assert.equal(isComplete(state), false);
});

test('reset rebuilds state for the current dynamic pieces', () => {
  const pieceIds = createPieceIds(4);
  let state = createGameState(pieceIds);
  state = tryPlacePiece(state, {
    pieceId: 'piece-0-0',
    targetId: 'piece-0-0',
    pieceCenter: { x: 0, y: 0 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 20,
  });

  const reset = resetGameState(pieceIds);

  assert.equal(reset.placedCount, 0);
  assert.equal(Object.keys(reset.pieces).length, 16);
  assert.equal(reset.pieces['piece-0-0'].placed, false);
});
