# Adaptive Ratio Play Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the puzzle use the selected image's original aspect ratio, add toddler-friendly mode toggles, hide piece numbers by default, and randomize the tray by default.

**Architecture:** Keep game rules in `game.js` because this app is currently small and DOM-driven. Use CSS variables for image ratio and mode classes, and extend `verify-browser.js` to cover the user-visible behavior.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node static server, Playwright browser verification.

---

### Task 1: Browser Regression Coverage

**Files:**
- Modify: `verify-browser.js`

- [ ] Add assertions that the board and loose pieces share the same aspect ratio after uploading a deliberately non-600x420 image.
- [ ] Add assertions that piece labels are hidden by default and visible after toggling the labels mode.
- [ ] Add assertions that tray order is not the natural sorted order on reset.
- [ ] Add assertions that turning off correction lets a piece snap into the wrong slot.

### Task 2: UI Controls and Styling

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

- [ ] Add three mode buttons: guide image, correction, and labels.
- [ ] Add `--puzzle-ratio` and apply it to both board and pieces.
- [ ] Hide labels by default with a root class toggle.
- [ ] Add a class toggle for hiding the guide image.

### Task 3: Game Behavior

**Files:**
- Modify: `game.js`

- [ ] Load image intrinsic width and height with `Image().naturalWidth / naturalHeight`.
- [ ] Set `--puzzle-ratio` when selecting or uploading an image.
- [ ] Shuffle tray order on render/reset.
- [ ] Make correction mode optional: when disabled, snap to the nearest slot even if it is wrong.
- [ ] Allow placed pieces to be dragged again in free mode so mistakes can be fixed.

### Task 4: Verification and Commit

**Files:**
- Modify: `verify-browser.js`

- [ ] Run `node --test game-logic.test.js`.
- [ ] Run `node --check game.js dev-server.js verify-browser.js`.
- [ ] Run `verify-browser.js` against a fresh local server.
- [ ] Inspect desktop and mobile screenshots.
- [ ] Commit the implementation.
