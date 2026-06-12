# Puppy Jigsaw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free browser puzzle game for a 3.5-year-old child with four large draggable pieces, original puppy-family visuals, snap feedback, completion celebration, and restart.

**Architecture:** Keep pure puzzle rules in `game-logic.js` so they can be tested without a browser. Put DOM and pointer interaction in `game.js`, styling in `styles.css`, and markup/original SVG puzzle art in `index.html`. Use the existing Git Bash powered visual companion plus a static dev server for browser verification.

**Tech Stack:** Plain HTML, CSS, JavaScript, Node.js built-in test runner, no npm dependencies.

---

## File Structure

- Create `game-logic.js`: Pure state and snapping logic. Exports CommonJS functions for Node tests and attaches to `window.PuppyJigsawLogic` in the browser.
- Create `game-logic.test.js`: Node built-in test suite for placement, completion, and reset behavior.
- Create `index.html`: Actual playable game screen, inline original SVG scene split into four pieces.
- Create `styles.css`: Responsive layout, child-friendly visual design, large touch targets, celebration animations.
- Create `game.js`: Browser glue for rendering pieces, pointer drag, snap animations, progress, restart, and completion.

## Task 1: Pure Puzzle Logic

**Files:**
- Create: `game-logic.js`
- Create: `game-logic.test.js`

- [ ] **Step 1: Write the failing test**

Create `game-logic.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createGameState,
  tryPlacePiece,
  isComplete,
  resetGameState,
} = require('./game-logic');

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test game-logic.test.js`

Expected: FAIL with a module-not-found error for `./game-logic`.

- [ ] **Step 3: Write minimal implementation**

Create `game-logic.js`:

```javascript
(function attachLogic(root) {
  const PIECES = ['sky-puppy', 'sun-house', 'grass-puppy', 'garden-toys'];

  function createGameState() {
    const pieces = {};
    for (const id of PIECES) {
      pieces[id] = { id, targetId: id, placed: false };
    }
    return { pieces, placedCount: 0 };
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function cloneState(state) {
    const pieces = {};
    for (const [id, piece] of Object.entries(state.pieces)) {
      pieces[id] = { ...piece };
    }
    return { pieces, placedCount: state.placedCount };
  }

  function tryPlacePiece(state, options) {
    const next = cloneState(state);
    const piece = next.pieces[options.pieceId];
    if (!piece || piece.placed) return next;

    const isCorrectTarget = piece.targetId === options.targetId;
    const isCloseEnough = distance(options.pieceCenter, options.targetCenter) <= options.snapThreshold;
    if (isCorrectTarget && isCloseEnough) {
      piece.placed = true;
      next.placedCount += 1;
    }
    return next;
  }

  function isComplete(state) {
    return state.placedCount === PIECES.length;
  }

  function resetGameState() {
    return createGameState();
  }

  const api = {
    PIECES,
    createGameState,
    tryPlacePiece,
    isComplete,
    resetGameState,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PuppyJigsawLogic = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test game-logic.test.js`

Expected: PASS, 5 tests passing.

## Task 2: Static Game Markup And Visual Layout

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create the game markup**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>小狗院子拼图</title>
  <link rel="stylesheet" href="styles.css">
  <script src="game-logic.js" defer></script>
  <script src="game.js" defer></script>
</head>
<body>
  <main class="game-shell" aria-label="小狗院子拼图游戏">
    <section class="top-bar" aria-label="游戏状态">
      <div class="title-block">
        <h1>小狗院子拼图</h1>
        <p>把四块拼图放回院子里</p>
      </div>
      <div class="progress" aria-label="完成进度">
        <span class="star" data-star="0">★</span>
        <span class="star" data-star="1">★</span>
        <span class="star" data-star="2">★</span>
        <span class="star" data-star="3">★</span>
      </div>
      <button class="icon-button" id="reset-button" type="button" aria-label="重新开始">
        ↻
      </button>
    </section>

    <section class="play-area">
      <div class="board-wrap">
        <div class="board" id="board" aria-label="拼图板">
          <svg class="guide-art" viewBox="0 0 600 420" role="img" aria-label="完成后的院子图">
            <defs>
              <linearGradient id="skyGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stop-color="#8bd7f8"></stop>
                <stop offset="1" stop-color="#d7f5ff"></stop>
              </linearGradient>
            </defs>
            <rect width="600" height="420" rx="28" fill="url(#skyGradient)"></rect>
            <circle cx="500" cy="82" r="44" fill="#ffd95a"></circle>
            <path d="M0 285 C120 250 220 306 330 270 C430 238 520 262 600 230 V420 H0 Z" fill="#7fc969"></path>
            <rect x="62" y="182" width="170" height="124" rx="18" fill="#ffcf7a" stroke="#6e4c33" stroke-width="10"></rect>
            <path d="M45 190 L147 108 L250 190 Z" fill="#ef6b63" stroke="#6e4c33" stroke-width="10"></path>
            <circle cx="170" cy="244" r="18" fill="#7fb9e8"></circle>
            <g transform="translate(335 128)">
              <ellipse cx="76" cy="122" rx="70" ry="58" fill="#f0a35a" stroke="#5b4636" stroke-width="10"></ellipse>
              <circle cx="68" cy="68" r="56" fill="#ffbd79" stroke="#5b4636" stroke-width="10"></circle>
              <path d="M25 28 L12 -8 L55 10 Z" fill="#ffbd79" stroke="#5b4636" stroke-width="9"></path>
              <path d="M112 28 L128 -8 L85 10 Z" fill="#ffbd79" stroke="#5b4636" stroke-width="9"></path>
              <circle cx="50" cy="62" r="7" fill="#302820"></circle>
              <circle cx="88" cy="62" r="7" fill="#302820"></circle>
              <ellipse cx="70" cy="82" rx="15" ry="10" fill="#5b4636"></ellipse>
              <path d="M52 98 Q70 114 90 98" fill="none" stroke="#5b4636" stroke-width="7" stroke-linecap="round"></path>
            </g>
            <g transform="translate(118 278)">
              <ellipse cx="52" cy="42" rx="52" ry="34" fill="#62b8e8" stroke="#254f73" stroke-width="9"></ellipse>
              <circle cx="42" cy="28" r="32" fill="#80cff8" stroke="#254f73" stroke-width="9"></circle>
              <circle cx="31" cy="26" r="5" fill="#1d405c"></circle>
              <circle cx="53" cy="26" r="5" fill="#1d405c"></circle>
              <path d="M34 42 Q44 50 56 42" fill="none" stroke="#1d405c" stroke-width="5" stroke-linecap="round"></path>
            </g>
            <circle cx="455" cy="330" r="22" fill="#ff7d79" stroke="#6e4c33" stroke-width="7"></circle>
            <rect x="474" y="312" width="58" height="34" rx="17" fill="#5fc57a" stroke="#356c3d" stroke-width="7"></rect>
          </svg>
          <div class="slot" data-target-id="sky-puppy"></div>
          <div class="slot" data-target-id="sun-house"></div>
          <div class="slot" data-target-id="grass-puppy"></div>
          <div class="slot" data-target-id="garden-toys"></div>
        </div>
      </div>

      <div class="tray" id="tray" aria-label="拼图片">
        <button class="piece" data-piece-id="sky-puppy" type="button" aria-label="天空和小狗拼图块"></button>
        <button class="piece" data-piece-id="sun-house" type="button" aria-label="太阳和小屋拼图块"></button>
        <button class="piece" data-piece-id="grass-puppy" type="button" aria-label="草地和小狗拼图块"></button>
        <button class="piece" data-piece-id="garden-toys" type="button" aria-label="花园玩具拼图块"></button>
      </div>
    </section>

    <section class="celebration" id="celebration" aria-live="polite" hidden>
      <div class="celebration-panel">
        <div class="big-stars">★ ★ ★</div>
        <h2>拼好了！</h2>
        <button class="replay-button" id="replay-button" type="button">再玩一次</button>
      </div>
    </section>
  </main>
</body>
</html>
```

- [ ] **Step 2: Create responsive visual styles**

Create `styles.css`:

```css
* { box-sizing: border-box; }

:root {
  --ink: #28323a;
  --cream: #fff7df;
  --sky: #8bd7f8;
  --green: #78c75a;
  --yellow: #ffd95a;
  --coral: #ef6b63;
  --blue: #62b8e8;
  --shadow: rgba(40, 50, 58, .18);
}

html, body { min-height: 100%; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--ink);
  background: var(--cream);
  overflow-x: hidden;
  touch-action: manipulation;
}

button {
  font: inherit;
}

.game-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 18px;
  width: min(1180px, calc(100% - 28px));
  margin: 0 auto;
  padding: 18px 0 28px;
}

.top-bar {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  align-items: center;
}

h1, h2, p {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.05;
}

.title-block p {
  margin-top: 4px;
  font-size: 18px;
  color: #596671;
}

.progress {
  display: flex;
  gap: 8px;
  min-width: 168px;
}

.star {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid var(--ink);
  color: #d2d7dc;
  font-size: 21px;
}

.star.filled {
  color: var(--yellow);
  background: #fff3b2;
}

.icon-button,
.replay-button {
  min-height: 56px;
  border: 3px solid var(--ink);
  background: #ffffff;
  color: var(--ink);
  box-shadow: 0 6px 0 var(--shadow);
  cursor: pointer;
}

.icon-button {
  width: 64px;
  border-radius: 50%;
  font-size: 34px;
  line-height: 1;
}

.play-area {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(250px, 330px);
  gap: 22px;
  align-items: center;
}

.board-wrap {
  display: grid;
  place-items: center;
  min-width: 0;
}

.board {
  position: relative;
  width: min(100%, 760px);
  aspect-ratio: 600 / 420;
  border: 8px solid #ffffff;
  border-radius: 32px;
  box-shadow: 0 12px 0 var(--shadow);
  background: #ffffff;
  overflow: hidden;
}

.guide-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: .28;
}

.slot {
  position: absolute;
  width: 50%;
  height: 50%;
  border: 3px dashed rgba(40, 50, 58, .42);
  background: rgba(255, 255, 255, .18);
}

.slot[data-target-id="sky-puppy"] { left: 0; top: 0; }
.slot[data-target-id="sun-house"] { left: 50%; top: 0; }
.slot[data-target-id="grass-puppy"] { left: 0; top: 50%; }
.slot[data-target-id="garden-toys"] { left: 50%; top: 50%; }

.slot.ready {
  background: rgba(255, 247, 145, .45);
  border-color: var(--yellow);
}

.tray {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-content: center;
}

.piece {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 300 / 210;
  border: 5px solid #ffffff;
  border-radius: 22px;
  background-color: #d8f3ff;
  background-image: var(--piece-bg);
  background-size: 200% 200%;
  box-shadow: 0 8px 0 var(--shadow);
  cursor: grab;
  touch-action: none;
}

.piece:focus-visible {
  outline: 5px solid #2457d6;
  outline-offset: 4px;
}

.piece.dragging {
  position: fixed;
  z-index: 20;
  cursor: grabbing;
  pointer-events: none;
  transform: scale(1.04);
}

.piece.placed {
  position: absolute;
  z-index: 5;
  width: 50%;
  height: 50%;
  border-radius: 0;
  box-shadow: none;
  pointer-events: none;
}

.piece[data-piece-id="sky-puppy"] {
  --piece-bg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 420'%3E%3Crect width='600' height='420' fill='%238bd7f8'/%3E%3Ccircle cx='500' cy='82' r='44' fill='%23ffd95a'/%3E%3Cg transform='translate(335 128)'%3E%3Cellipse cx='76' cy='122' rx='70' ry='58' fill='%23f0a35a' stroke='%235b4636' stroke-width='10'/%3E%3Ccircle cx='68' cy='68' r='56' fill='%23ffbd79' stroke='%235b4636' stroke-width='10'/%3E%3C/g%3E%3C/svg%3E");
  background-position: left top;
}

.piece[data-piece-id="sun-house"] {
  --piece-bg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 420'%3E%3Crect width='600' height='420' fill='%23bfefff'/%3E%3Ccircle cx='500' cy='82' r='44' fill='%23ffd95a'/%3E%3Crect x='62' y='182' width='170' height='124' rx='18' fill='%23ffcf7a' stroke='%236e4c33' stroke-width='10'/%3E%3Cpath d='M45 190 L147 108 L250 190 Z' fill='%23ef6b63' stroke='%236e4c33' stroke-width='10'/%3E%3C/svg%3E");
  background-position: right top;
}

.piece[data-piece-id="grass-puppy"] {
  --piece-bg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 420'%3E%3Crect width='600' height='420' fill='%23d7f5ff'/%3E%3Cpath d='M0 285 C120 250 220 306 330 270 C430 238 520 262 600 230 V420 H0 Z' fill='%237fc969'/%3E%3Cg transform='translate(118 278)'%3E%3Cellipse cx='52' cy='42' rx='52' ry='34' fill='%2362b8e8' stroke='%23254f73' stroke-width='9'/%3E%3Ccircle cx='42' cy='28' r='32' fill='%2380cff8' stroke='%23254f73' stroke-width='9'/%3E%3C/g%3E%3C/svg%3E");
  background-position: left bottom;
}

.piece[data-piece-id="garden-toys"] {
  --piece-bg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 420'%3E%3Crect width='600' height='420' fill='%23d7f5ff'/%3E%3Cpath d='M0 285 C120 250 220 306 330 270 C430 238 520 262 600 230 V420 H0 Z' fill='%237fc969'/%3E%3Ccircle cx='455' cy='330' r='22' fill='%23ff7d79' stroke='%236e4c33' stroke-width='7'/%3E%3Crect x='474' y='312' width='58' height='34' rx='17' fill='%235fc57a' stroke='%23356c3d' stroke-width='7'/%3E%3C/svg%3E");
  background-position: right bottom;
}

.celebration {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(255, 247, 223, .82);
}

.celebration[hidden] {
  display: none;
}

.celebration-panel {
  width: min(420px, 100%);
  border: 4px solid var(--ink);
  border-radius: 8px;
  padding: 28px;
  text-align: center;
  background: #ffffff;
  box-shadow: 0 10px 0 var(--shadow);
}

.big-stars {
  color: var(--yellow);
  font-size: 48px;
}

.celebration-panel h2 {
  margin: 10px 0 20px;
  font-size: 42px;
}

.replay-button {
  min-width: 180px;
  border-radius: 8px;
  font-size: 24px;
  font-weight: 800;
}

@keyframes pop {
  0% { transform: scale(.92); }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

.pop {
  animation: pop .28s ease-out;
}

@media (max-width: 860px) {
  .top-bar {
    grid-template-columns: 1fr auto;
  }

  .progress {
    grid-column: 1 / -1;
    order: 3;
  }

  .play-area {
    grid-template-columns: 1fr;
  }

  .tray {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 560px) {
  .game-shell {
    width: min(100% - 20px, 1180px);
    padding-top: 12px;
  }

  .tray {
    grid-template-columns: 1fr 1fr;
  }

  .title-block p {
    font-size: 16px;
  }
}
```

- [ ] **Step 3: Open static markup manually**

Run: `Invoke-WebRequest -Uri file:///D:/code/jigsaw/index.html -UseBasicParsing`

Expected: the command reads the file without a missing-file error. Browser interaction is added in Task 3.

## Task 3: Browser Drag Interaction

**Files:**
- Create: `game.js`
- Modify: `styles.css`

- [ ] **Step 1: Create browser interaction implementation**

Create `game.js`:

```javascript
const logic = window.PuppyJigsawLogic;

const board = document.querySelector('#board');
const tray = document.querySelector('#tray');
const resetButton = document.querySelector('#reset-button');
const replayButton = document.querySelector('#replay-button');
const celebration = document.querySelector('#celebration');
const stars = Array.from(document.querySelectorAll('.star'));
const pieces = Array.from(document.querySelectorAll('.piece'));
const slots = Array.from(document.querySelectorAll('.slot'));

let state = logic.createGameState();
let active = null;

function slotForPiece(pieceId) {
  return slots.find((slot) => slot.dataset.targetId === pieceId);
}

function getCenter(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function updateProgress() {
  stars.forEach((star, index) => {
    star.classList.toggle('filled', index < state.placedCount);
  });
}

function setPieceLoose(piece) {
  piece.classList.remove('placed', 'dragging', 'pop');
  piece.style.left = '';
  piece.style.top = '';
  piece.style.width = '';
  piece.style.height = '';
  piece.style.transform = '';
  piece.style.zIndex = '';
  tray.appendChild(piece);
}

function placePiece(piece) {
  const slot = slotForPiece(piece.dataset.pieceId);
  const boardRect = board.getBoundingClientRect();
  const slotRect = slot.getBoundingClientRect();
  piece.classList.remove('dragging');
  piece.classList.add('placed', 'pop');
  piece.style.left = `${slotRect.left - boardRect.left}px`;
  piece.style.top = `${slotRect.top - boardRect.top}px`;
  piece.style.width = `${slotRect.width}px`;
  piece.style.height = `${slotRect.height}px`;
  piece.style.transform = '';
  board.appendChild(piece);
}

function finishIfComplete() {
  if (!logic.isComplete(state)) return;
  window.setTimeout(() => {
    celebration.hidden = false;
  }, 220);
}

function nearestSlot(point) {
  let best = null;
  for (const slot of slots) {
    const rect = slot.getBoundingClientRect();
    const center = getCenter(rect);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (!best || distance < best.distance) {
      best = { slot, center, distance };
    }
  }
  return best;
}

function onPointerDown(event) {
  const piece = event.currentTarget;
  if (state.pieces[piece.dataset.pieceId].placed) return;

  const rect = piece.getBoundingClientRect();
  active = {
    piece,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };

  piece.setPointerCapture(event.pointerId);
  piece.classList.add('dragging');
  piece.style.width = `${rect.width}px`;
  piece.style.height = `${rect.height}px`;
  moveActivePiece(event.clientX, event.clientY);
}

function moveActivePiece(clientX, clientY) {
  if (!active) return;
  active.piece.style.left = `${clientX - active.offsetX}px`;
  active.piece.style.top = `${clientY - active.offsetY}px`;
}

function onPointerMove(event) {
  if (!active || event.pointerId !== active.pointerId) return;
  moveActivePiece(event.clientX, event.clientY);
  const center = {
    x: event.clientX - active.offsetX + active.width / 2,
    y: event.clientY - active.offsetY + active.height / 2,
  };
  const nearest = nearestSlot(center);
  slots.forEach((slot) => slot.classList.toggle('ready', slot === nearest.slot && nearest.distance < 46));
}

function onPointerUp(event) {
  if (!active || event.pointerId !== active.pointerId) return;

  const piece = active.piece;
  const pieceId = piece.dataset.pieceId;
  const center = {
    x: event.clientX - active.offsetX + active.width / 2,
    y: event.clientY - active.offsetY + active.height / 2,
  };
  const nearest = nearestSlot(center);
  const beforeCount = state.placedCount;

  state = logic.tryPlacePiece(state, {
    pieceId,
    targetId: nearest.slot.dataset.targetId,
    pieceCenter: center,
    targetCenter: nearest.center,
    snapThreshold: 46,
  });

  slots.forEach((slot) => slot.classList.remove('ready'));
  active = null;

  if (state.placedCount > beforeCount) {
    placePiece(piece);
    updateProgress();
    finishIfComplete();
  } else {
    setPieceLoose(piece);
  }
}

function resetGame() {
  state = logic.resetGameState();
  celebration.hidden = true;
  for (const piece of pieces) {
    setPieceLoose(piece);
  }
  updateProgress();
}

for (const piece of pieces) {
  piece.addEventListener('pointerdown', onPointerDown);
  piece.addEventListener('pointermove', onPointerMove);
  piece.addEventListener('pointerup', onPointerUp);
  piece.addEventListener('pointercancel', () => {
    if (active && active.piece === piece) {
      active = null;
      slots.forEach((slot) => slot.classList.remove('ready'));
      setPieceLoose(piece);
    }
  });
}

resetButton.addEventListener('click', resetGame);
replayButton.addEventListener('click', resetGame);
updateProgress();
```

- [ ] **Step 2: Run logic tests again**

Run: `node --test game-logic.test.js`

Expected: PASS, 5 tests passing.

## Task 4: Browser Verification

**Files:**
- Read: `index.html`
- Read: `styles.css`
- Read: `game.js`

- [ ] **Step 1: Start a local static server**

Run: `python -m http.server 4173`

Expected: server listens on `http://localhost:4173`. If `python` is unavailable, run `npx http-server -p 4173` only if network/dependencies are already available; otherwise use `file:///D:/code/jigsaw/index.html`.

- [ ] **Step 2: Open browser preview**

Open: `http://localhost:4173`

Expected: the playable game appears as the first screen, with no marketing page.

- [ ] **Step 3: Verify desktop interaction**

Use browser automation or manual drag:

- Drag each of the four pieces to its matching board quadrant.
- Confirm each correct placement snaps and fills one star.
- Confirm completion overlay appears after the fourth piece.
- Click restart and confirm all pieces return to the tray.

- [ ] **Step 4: Verify mobile layout**

Set viewport near `390x844`.

Expected:

- Board remains visible without incoherent overlap.
- Tray becomes a two-column grid.
- Buttons and pieces remain large enough for touch.
- Text stays inside containers.

- [ ] **Step 5: Final verification commands**

Run:

```powershell
node --test game-logic.test.js
Invoke-WebRequest -Uri http://localhost:4173/ -UseBasicParsing | Select-Object StatusCode
```

Expected:

- Node test output reports 5 passing tests.
- Web request reports `StatusCode 200`.

## Self-Review Notes

- Spec coverage: Task 1 covers pure game rules, Task 2 covers original visuals and responsive layout, Task 3 covers drag/snap/progress/restart/completion, Task 4 covers browser verification.
- Marker scan: no unresolved markers are present.
- Type consistency: piece ids are consistent across tests, markup, styles, and browser code: `sky-puppy`, `sun-house`, `grass-puppy`, `garden-toys`.
