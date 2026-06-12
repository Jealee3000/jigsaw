# Viewport Fitted Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit the puzzle board and right-side piece tray inside the current browser viewport, with a scrollable image list on the left and no scrollbars on the right tray.

**Architecture:** Keep the three-column DOM structure. Let `game.js` calculate board dimensions from current viewport, header height, left library width, gaps, and selected image ratio, then expose CSS variables for board, tray, and piece sizes.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node static server, Playwright browser verification.

---

### Task 1: Regression Coverage

**Files:**
- Modify: `verify-browser.js`

- [ ] Check document dimensions do not exceed the viewport.
- [ ] Check `.image-list` is vertically scrollable.
- [ ] Check `.tray` has no scrollbars.
- [ ] Check `.tray` dimensions match the puzzle slot layer dimensions.
- [ ] Check loose pieces match slot dimensions.

### Task 2: CSS Layout

**Files:**
- Modify: `styles.css`

- [ ] Make the page height exactly `100vh` and hide body scrolling.
- [ ] Compact the header into four columns so reset stays in the first row.
- [ ] Give `.game-layout` a fixed-height row below the header.
- [ ] Make left image list the only scrollable area.
- [ ] Make right tray use computed width/height with no scrolling.

### Task 3: Dynamic Sizing

**Files:**
- Modify: `game.js`

- [ ] Store the active puzzle image ratio.
- [ ] Compute board size from viewport and available two-board horizontal space.
- [ ] Set `--board-width`, `--board-height`, `--piece-width`, `--piece-height`, `--tray-width`, and `--tray-height`.
- [ ] Recompute on image change, grid change, render, and window resize.

### Task 4: Verification

**Files:**
- Modify: `verify-browser.js`

- [ ] Run unit tests.
- [ ] Run syntax checks.
- [ ] Run full browser verification.
- [ ] Inspect desktop screenshot.
- [ ] Commit the layout change.
