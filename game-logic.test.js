const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PIECES,
  createGameState,
  tryPlacePiece,
  isComplete,
  resetGameState,
} = require('./game-logic');

test('exports the expected puzzle piece ids', () => {
  assert.deepEqual(PIECES, [
    'sky-puppy',
    'sun-house',
    'grass-puppy',
    'garden-toys',
  ]);
});

test('exports frozen puzzle piece ids', () => {
  assert.equal(Object.isFrozen(PIECES), true);
});

test('initializes each piece with its correct target id', () => {
  const state = createGameState();

  for (const pieceId of PIECES) {
    assert.equal(state.pieces[pieceId].targetId, pieceId);
  }
});

test('places the correct piece when it is within the snap threshold', () => {
  const state = createGameState();

  const next = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'sky-puppy',
    pieceCenter: { x: 104, y: 98 },
    targetCenter: { x: 100, y: 100 },
    snapThreshold: 32,
  });

  assert.equal(next.pieces['sky-puppy'].placed, true);
  assert.equal(next.pieces['sky-puppy'].targetId, 'sky-puppy');
  assert.equal(next.placedCount, 1);
});

test('places a piece exactly at the euclidean snap threshold', () => {
  const state = createGameState();

  const next = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'sky-puppy',
    pieceCenter: { x: 3, y: 4 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 5,
  });

  assert.equal(next.pieces['sky-puppy'].placed, true);
  assert.equal(next.placedCount, 1);
});

test('does not place a piece just outside the euclidean snap threshold', () => {
  const state = createGameState();

  const next = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'sky-puppy',
    pieceCenter: { x: 3, y: 4 },
    targetCenter: { x: 0, y: 0 },
    snapThreshold: 4.99,
  });

  assert.equal(next.pieces['sky-puppy'].placed, false);
  assert.equal(next.placedCount, 0);
});

test('uses the piece target id from state when checking the target', () => {
  const state = createGameState();
  state.pieces['sky-puppy'] = {
    placed: false,
    targetId: 'grass-puppy',
  };

  const next = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'grass-puppy',
    pieceCenter: { x: 100, y: 100 },
    targetCenter: { x: 100, y: 100 },
    snapThreshold: 32,
  });

  assert.equal(next.pieces['sky-puppy'].placed, true);
  assert.equal(next.placedCount, 1);
});

test('does not place a piece when it is outside the snap threshold', () => {
  const state = createGameState();

  const next = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'sky-puppy',
    pieceCenter: { x: 20, y: 20 },
    targetCenter: { x: 100, y: 100 },
    snapThreshold: 32,
  });

  assert.equal(next.pieces['sky-puppy'].placed, false);
  assert.equal(next.placedCount, 0);
});

test('does not mutate the input state when placing a piece', () => {
  const state = createGameState();

  const next = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'sky-puppy',
    pieceCenter: { x: 50, y: 50 },
    targetCenter: { x: 50, y: 50 },
    snapThreshold: 32,
  });

  assert.notEqual(next, state);
  assert.notEqual(next.pieces, state.pieces);
  assert.equal(state.pieces['sky-puppy'].placed, false);
  assert.equal(state.placedCount, 0);
});

test('does not count an already placed piece again', () => {
  let state = createGameState();
  state = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'sky-puppy',
    pieceCenter: { x: 50, y: 50 },
    targetCenter: { x: 50, y: 50 },
    snapThreshold: 32,
  });

  const next = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'sky-puppy',
    pieceCenter: { x: 50, y: 50 },
    targetCenter: { x: 50, y: 50 },
    snapThreshold: 32,
  });

  assert.equal(next.pieces['sky-puppy'].placed, true);
  assert.equal(next.placedCount, 1);
});

test('does not place a piece on the wrong target', () => {
  const state = createGameState();

  const next = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'grass-puppy',
    pieceCenter: { x: 100, y: 100 },
    targetCenter: { x: 100, y: 100 },
    snapThreshold: 32,
  });

  assert.equal(next.pieces['sky-puppy'].placed, false);
  assert.equal(next.placedCount, 0);
});

test('detects completion only after all four pieces are placed', () => {
  let state = createGameState();

  for (const pieceId of ['sky-puppy', 'sun-house', 'grass-puppy', 'garden-toys']) {
    state = tryPlacePiece(state, {
      pieceId,
      targetId: pieceId,
      pieceCenter: { x: 50, y: 50 },
      targetCenter: { x: 50, y: 50 },
      snapThreshold: 32,
    });
  }

  assert.equal(isComplete(state), true);
  assert.equal(state.placedCount, 4);
});

test('does not report completion for inconsistent placed count state', () => {
  const state = createGameState();
  state.placedCount = 4;
  state.pieces['sky-puppy'].placed = true;
  state.pieces['sun-house'].placed = true;
  state.pieces['grass-puppy'].placed = true;

  assert.equal(isComplete(state), false);
});

test('reset clears placed state and completion', () => {
  let state = createGameState();
  state = tryPlacePiece(state, {
    pieceId: 'sky-puppy',
    targetId: 'sky-puppy',
    pieceCenter: { x: 50, y: 50 },
    targetCenter: { x: 50, y: 50 },
    snapThreshold: 32,
  });

  const reset = resetGameState(state);

  assert.equal(reset.placedCount, 0);
  assert.equal(isComplete(reset), false);
  assert.equal(reset.pieces['sky-puppy'].placed, false);
});
