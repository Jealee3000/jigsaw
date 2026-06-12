# Custom Image Grid Jigsaw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the local puzzle game so a parent can choose a local image and play 2x2, 3x3, or 4x4 generated puzzles.

**Architecture:** Refactor fixed four-piece logic into dynamic piece ids derived from grid size. Render slots and pieces at runtime from the current image URL and grid size, while preserving pointer drag, tap/keyboard placement, reset, completion, and browser verification. Keep all image data local to the browser session.

**Tech Stack:** Plain HTML, CSS, JavaScript, Node.js built-in test runner, local Node static server, Playwright verification with system Chrome.

---

## File Structure

- Modify `game-logic.js`: Replace fixed `PIECES` state with dynamic piece id helpers while preserving pure placement behavior.
- Modify `game-logic.test.js`: Update tests for dynamic 2x2, 3x3, and 4x4 states.
- Modify `index.html`: Replace hard-coded slots/pieces/stars with containers and add local image and grid-size controls.
- Modify `styles.css`: Support dynamic CSS grid board, image-sliced pieces, compact labels, and responsive controls/tray.
- Modify `game.js`: Render puzzle DOM dynamically, support local image upload, grid-size changes, drag/tap/keyboard placement, and reset.
- Modify `verify-browser.js`: Verify dynamic grid counts, wrong-drop order, keyboard/tap placement, image upload, and mobile layout.

## Task 1: Dynamic Puzzle Logic

**Files:**
- Modify: `game-logic.js`
- Modify: `game-logic.test.js`

- [ ] **Step 1: Add failing tests for dynamic ids**

Update `game-logic.test.js` so it imports `createPieceIds` and uses dynamic ids:

```javascript
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
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test game-logic.test.js`

Expected: FAIL because `createPieceIds` is not exported and existing logic is fixed to four ids.

- [ ] **Step 3: Implement dynamic logic**

Replace `game-logic.js` with:

```javascript
const SUPPORTED_GRID_SIZES = Object.freeze([2, 3, 4]);

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
      placed: false,
      targetId: pieceId,
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

function tryPlacePiece(state, options) {
  const next = cloneGameState(state);
  const piece = next.pieces[options.pieceId];

  if (!piece || piece.placed || piece.targetId !== options.targetId) {
    return next;
  }

  const distance = getDistance(options.pieceCenter, options.targetCenter);
  if (distance <= options.snapThreshold) {
    piece.placed = true;
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
```

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test game-logic.test.js`

Expected: PASS, dynamic logic tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add game-logic.js game-logic.test.js
git commit -m "feat: support dynamic puzzle logic"
```

## Task 2: Dynamic Markup And Styles

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Replace hard-coded controls and containers**

Update `index.html` so the top controls and play area use dynamic containers:

```html
<header class="top-bar" aria-label="游戏状态">
  <div class="title-block">
    <h1>小狗家的拼图</h1>
    <p>选择本机图片，再挑一个拼图大小</p>
  </div>

  <div class="controls" aria-label="拼图设置">
    <label class="file-control">
      <span>选择图片</span>
      <input id="image-input" type="file" accept="image/*">
    </label>

    <div class="grid-control" role="group" aria-label="拼图大小">
      <button class="grid-button active" type="button" data-grid-size="2">2x2</button>
      <button class="grid-button" type="button" data-grid-size="3">3x3</button>
      <button class="grid-button" type="button" data-grid-size="4">4x4</button>
    </div>
  </div>

  <div class="progress" aria-label="完成 0 / 4"></div>

  <button class="reset-button" id="reset-button" type="button" aria-label="重新开始">
    <span aria-hidden="true">↻</span>
  </button>
</header>
```

Replace the board internals with:

```html
<div class="board" id="board" aria-label="拼图板">
  <div class="guide-image" id="guide-image" role="img" aria-label="当前拼图完整图片"></div>
  <div class="slot-layer" id="slot-layer" aria-label="拼图位置"></div>
</div>
```

Replace the tray with:

```html
<div class="tray" id="tray" aria-label="拼图片托盘"></div>
```

Add a status message:

```html
<p class="status-message" id="status-message" role="status" aria-live="polite">图片只在本机使用</p>
```

- [ ] **Step 2: Update CSS for dynamic board and pieces**

Update `styles.css` with these responsibilities:

```css
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.file-control {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 0 16px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: var(--paper);
  box-shadow: 0 5px 0 var(--shadow);
  font-weight: 800;
  cursor: pointer;
}

.file-control input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.grid-control {
  display: inline-flex;
  gap: 6px;
}

.grid-button {
  min-height: 48px;
  min-width: 64px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: var(--paper);
  box-shadow: 0 5px 0 var(--shadow);
  font-weight: 800;
  cursor: pointer;
}

.grid-button.active {
  background: #fff1a9;
}

.status-message {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--muted);
  font-size: 15px;
}

.guide-image,
.slot-layer {
  position: absolute;
  inset: 0;
}

.guide-image {
  background-image: var(--puzzle-image);
  background-size: cover;
  background-position: center;
  opacity: .32;
}

.slot-layer {
  display: grid;
  grid-template-columns: repeat(var(--grid-size), 1fr);
  grid-template-rows: repeat(var(--grid-size), 1fr);
}

.slot {
  position: relative;
  width: auto;
  height: auto;
  border: 2px dashed var(--slot-line);
}

.tray {
  grid-template-columns: repeat(var(--tray-columns, 2), minmax(0, 1fr));
}

.piece {
  aspect-ratio: 1 / 1;
  background-image: var(--puzzle-image);
  background-size: calc(var(--grid-size) * 100%) calc(var(--grid-size) * 100%);
  background-position: var(--piece-position);
}

.piece-label {
  display: none;
}

.piece.placed {
  width: calc(100% / var(--grid-size));
  height: calc(100% / var(--grid-size));
}
```

Keep existing drag, placed, completion, responsive, and focus styles where compatible.

- [ ] **Step 3: Verify static files**

Run:

```powershell
Get-Item index.html, styles.css | Select-Object Name,Length
```

Expected: both files exist and are readable.

- [ ] **Step 4: Commit**

Run:

```powershell
git add index.html styles.css
git commit -m "feat: add dynamic puzzle controls and layout"
```

## Task 3: Dynamic Browser Game Rendering

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Refactor browser state and rendering**

Rewrite `game.js` to own:

```javascript
let gridSize = 2;
let pieceIds = createPieceIds(gridSize);
let gameState = createGameState(pieceIds);
let currentImageUrl = null;
let activeDrag = null;
```

Required functions:

- `getFallbackImageUrl()` creates an SVG data URL for the original puppy-yard fallback.
- `setPuzzleImage(url)` sets `--puzzle-image` on `document.documentElement`.
- `setGridSize(size)` updates `gridSize`, `pieceIds`, board/tray CSS vars, and rebuilds puzzle.
- `renderPuzzle()` empties and recreates slots and pieces based on `pieceIds`.
- `createSlot(pieceId)` creates `.slot[data-target-id]`.
- `createPiece(pieceId, index)` creates `.piece[data-piece-id]` with background position.
- `getPiecePosition(pieceId)` parses row/col and returns CSS background-position.
- `getSlotForPiece(pieceId)` returns matching slot.
- `resetGame({ preserveFocus })` rebuilds current state and DOM for current grid/image.
- Preserve existing pointer, click, keyboard, ready-slot, place, completion, and progress behavior.

The placed coordinate logic should use matching slot offsets:

```javascript
piece.style.left = `${slot.offsetLeft}px`;
piece.style.top = `${slot.offsetTop}px`;
piece.style.width = `${slot.offsetWidth}px`;
piece.style.height = `${slot.offsetHeight}px`;
```

- [ ] **Step 2: Add image picker handling**

Add `change` handling for `#image-input`:

```javascript
function onImageChange(event) {
  const [file] = event.target.files;
  if (!file) return;
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
```

- [ ] **Step 3: Add grid-size controls**

Bind `.grid-button[data-grid-size]`:

```javascript
function onGridButtonClick(event) {
  const size = Number(event.currentTarget.dataset.gridSize);
  setGridSize(size);
}
```

Update active button and progress label when grid size changes.

- [ ] **Step 4: Verify syntax and tests**

Run:

```powershell
node --check game.js
node --test game-logic.test.js
```

Expected: both pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add game.js
git commit -m "feat: render puzzles from local images"
```

## Task 4: Browser Verification

**Files:**
- Modify: `verify-browser.js`

- [ ] **Step 1: Update verification for dynamic grids**

Modify `verify-browser.js` to verify:

```javascript
assert.equal(await page.locator('.piece').count(), 4);
assert.equal(await page.locator('.slot').count(), 4);

await page.locator('.grid-button[data-grid-size="3"]').click();
assert.equal(await page.locator('.piece').count(), 9);
assert.equal(await page.locator('.slot').count(), 9);

await page.locator('.grid-button[data-grid-size="4"]').click();
assert.equal(await page.locator('.piece').count(), 16);
assert.equal(await page.locator('.slot').count(), 16);
```

Keep existing checks for:

- Wrong drag returns to original tray order.
- Mouse drag placement.
- Enter/Space/click placement.
- Completion overlay.
- Replay/reset.
- Mobile no horizontal overflow.

- [ ] **Step 2: Add image upload verification**

Create a temporary SVG image in the verification script and upload it:

```javascript
const uploadPath = path.join(screenshotsDir, 'upload-test.svg');
fs.writeFileSync(uploadPath, `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420"><rect width="600" height="420" fill="#ffcc00"/><circle cx="300" cy="210" r="100" fill="#0077cc"/></svg>`);
await page.locator('#image-input').setInputFiles(uploadPath);
await page.waitForTimeout(100);
```

Then assert that `--puzzle-image` contains `blob:`.

- [ ] **Step 3: Run full verification**

Run the local server and:

```powershell
$root='C:\Users\Jealee.DESKTOP-6QJ1LKI\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:NODE_PATH="$root;$root\.pnpm\playwright-core@1.60.0\node_modules;$root\.pnpm\playwright@1.60.0\node_modules"
$env:BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
& 'C:\Users\Jealee.DESKTOP-6QJ1LKI\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' verify-browser.js
```

Expected: `browser verification passed`.

- [ ] **Step 4: Commit**

Run:

```powershell
git add verify-browser.js
git commit -m "test: verify dynamic image puzzle"
```

## Task 5: Final Verification And Handoff

**Files:**
- Read: all changed files

- [ ] **Step 1: Run final tests**

Run:

```powershell
node --test game-logic.test.js
node --check game.js
node --check dev-server.js
node --check verify-browser.js
```

Expected: all pass.

- [ ] **Step 2: Run browser verification**

Start `dev-server.js` and run `verify-browser.js`.

Expected: `browser verification passed`.

- [ ] **Step 3: Review git status**

Run:

```powershell
git status --short
git log --oneline -5
```

Expected: clean working tree and commits for each task.

## Self-Review Notes

- Spec coverage: Task 1 covers dynamic logic, Task 2 covers controls and layout, Task 3 covers local image upload and grid rendering, Task 4 covers browser verification including upload and dynamic sizes, Task 5 covers final evidence.
- Marker scan: no unresolved markers are present.
- Type consistency: dynamic ids use `piece-r-c`; grid sizes are 2, 3, and 4 across logic, UI, and tests.
