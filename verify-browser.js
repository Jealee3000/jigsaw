const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.BASE_URL || 'http://localhost:4173/';
const screenshotsDir = path.join(__dirname, 'artifacts');
const imagesDir = path.join(__dirname, 'images');

fs.mkdirSync(screenshotsDir, { recursive: true });

function cleanupBrowserTestImages() {
  if (!fs.existsSync(imagesDir)) {
    return;
  }

  for (const fileName of fs.readdirSync(imagesDir)) {
    if (fileName.startsWith('browser-test-')) {
      fs.unlinkSync(path.join(imagesDir, fileName));
    }
  }
}

async function waitForNoDraggingPiece(page) {
  await page.waitForFunction(() => !document.querySelector('.piece.dragging'));
}

async function dragPieceToSlot(page, pieceId, targetId = pieceId) {
  await page.evaluate(({ pieceId: id, targetId: target }) => {
    document.querySelector(`.piece[data-piece-id="${id}"]`)?.scrollIntoView({
      block: 'center',
      inline: 'center',
    });
  }, { pieceId, targetId });

  const coords = await page.evaluate(({ pieceId: id, targetId: target }) => {
    const piece = document.querySelector(`.piece[data-piece-id="${id}"]`);
    const slot = document.querySelector(`.slot[data-target-id="${target}"]`);
    if (!piece || !slot) return null;

    const pieceRect = piece.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    return {
      from: {
        x: pieceRect.left + pieceRect.width / 2,
        y: pieceRect.top + pieceRect.height / 2,
      },
      to: {
        x: slotRect.left + slotRect.width / 2,
        y: slotRect.top + slotRect.height / 2,
      },
    };
  }, { pieceId, targetId });

  assert.ok(coords, `missing piece ${pieceId} or slot ${targetId}`);
  await page.mouse.move(coords.from.x, coords.from.y);
  await page.mouse.down();
  await page.mouse.move(coords.to.x, coords.to.y, { steps: 10 });
  await page.mouse.up();
  await waitForNoDraggingPiece(page);
}

async function dragPieceToSlotByGrabOffset(page, pieceId, targetId, offsetXRatio, offsetYRatio) {
  const coords = await page.evaluate(({
    pieceId: id,
    targetId: target,
    offsetXRatio: xRatio,
    offsetYRatio: yRatio,
  }) => {
    const piece = document.querySelector(`.piece[data-piece-id="${id}"]`);
    const slot = document.querySelector(`.slot[data-target-id="${target}"]`);
    if (!piece || !slot) return null;

    const pieceRect = piece.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const offsetX = pieceRect.width * xRatio;
    const offsetY = pieceRect.height * yRatio;
    return {
      from: {
        x: pieceRect.left + offsetX,
        y: pieceRect.top + offsetY,
      },
      to: {
        x: slotRect.left + offsetX,
        y: slotRect.top + offsetY,
      },
    };
  }, {
    pieceId,
    targetId,
    offsetXRatio,
    offsetYRatio,
  });

  assert.ok(coords, `missing piece ${pieceId} or slot ${targetId}`);
  await page.mouse.move(coords.from.x, coords.from.y);
  await page.mouse.down();
  await page.mouse.move(coords.to.x, coords.to.y, { steps: 10 });
  await page.mouse.up();
  await waitForNoDraggingPiece(page);
}

async function dragPieceBySlotDeltaRatio(page, pieceId, originTargetId, targetId, ratio) {
  const coords = await page.evaluate(({
    pieceId: id,
    originTargetId: origin,
    targetId: target,
    ratio: moveRatio,
  }) => {
    const piece = document.querySelector(`.piece[data-piece-id="${id}"]`);
    const originSlot = document.querySelector(`.slot[data-target-id="${origin}"]`);
    const targetSlot = document.querySelector(`.slot[data-target-id="${target}"]`);
    if (!piece || !originSlot || !targetSlot) return null;

    const pieceRect = piece.getBoundingClientRect();
    const originRect = originSlot.getBoundingClientRect();
    const targetRect = targetSlot.getBoundingClientRect();
    const from = {
      x: pieceRect.left + pieceRect.width / 2,
      y: pieceRect.top + pieceRect.height / 2,
    };

    return {
      from,
      to: {
        x: from.x + (targetRect.left - originRect.left) * moveRatio,
        y: from.y + (targetRect.top - originRect.top) * moveRatio,
      },
    };
  }, {
    pieceId,
    originTargetId,
    targetId,
    ratio,
  });

  assert.ok(coords, `missing piece ${pieceId}, origin ${originTargetId}, or slot ${targetId}`);
  await page.mouse.move(coords.from.x, coords.from.y);
  await page.mouse.down();
  await page.mouse.move(coords.to.x, coords.to.y, { steps: 12 });
  await page.mouse.up();
  await waitForNoDraggingPiece(page);
}

async function visitWithEmptyStorage(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
}

async function trayOrder(page) {
  return page.locator('#tray > .piece').evaluateAll((nodes) => (
    nodes.map((node) => node.dataset.pieceId)
  ));
}

async function assertGrid(page, size) {
  assert.equal(await page.locator('.piece').count(), size * size);
  assert.equal(await page.locator('.slot').count(), size * size);
  assert.equal(await page.locator('.slot.occupied').count(), 0);
  assert.equal(await page.locator('#board').evaluate((node) => node.classList.contains('solved')), false);
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), `完成 0 / ${size * size}`);
}

async function assertSolvedSlotGuidesHidden(page, expectedCount) {
  const solvedView = await page.evaluate(() => ({
    guide: (() => {
      const style = getComputedStyle(document.querySelector('.guide-image'));
      return {
        opacity: style.opacity,
        zIndex: Number(style.zIndex),
      };
    })(),
    slots: Array.from(document.querySelectorAll('.slot')).map((slot) => {
      const style = getComputedStyle(slot);
      return {
        targetId: slot.dataset.targetId,
        borderTopColor: style.borderTopColor,
        backgroundImage: style.backgroundImage,
      };
    }),
  }));

  assert.equal(await page.locator('#board').evaluate((node) => node.classList.contains('solved')), true);
  assert.equal(solvedView.guide.opacity, '1');
  assert.ok(solvedView.guide.zIndex > 5, `guide should render above pieces: ${JSON.stringify(solvedView.guide)}`);
  assert.equal(solvedView.slots.length, expectedCount);
  assert.deepEqual(
    solvedView.slots.filter((slot) => slot.borderTopColor !== 'rgba(0, 0, 0, 0)'),
    [],
  );
  assert.deepEqual(
    solvedView.slots.filter((slot) => slot.backgroundImage !== 'none'),
    [],
  );
}

async function currentPuzzleImage(page) {
  return page.evaluate(() => (
    getComputedStyle(document.documentElement).getPropertyValue('--puzzle-image')
  ));
}

async function uploadTestImage(page, fileName, fill, accent, width = 600, height = 420) {
  return uploadSvgText(
    page,
    fileName,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="${accent}"/></svg>`,
  );
}

async function uploadSvgText(page, fileName, svgText) {
  const uploadPath = path.join(screenshotsDir, fileName);
  fs.writeFileSync(uploadPath, svgText);

  await page.locator('#image-input').setInputFiles(uploadPath);
  const card = page.locator(`.image-card[data-image-name="${fileName}"]`);
  await card.waitFor({ state: 'visible' });
  await page.locator(`.image-card.selected[data-image-name="${fileName}"]`).waitFor({ state: 'visible' });

  const puzzleImage = await currentPuzzleImage(page);
  assert.match(puzzleImage, new RegExp(`/images/${fileName}`));
  return card;
}

async function assertPuzzleAspect(page, expectedRatio) {
  const ratios = await page.evaluate(() => {
    const board = document.querySelector('.slot-layer').getBoundingClientRect();
    const piece = document.querySelector('.piece').getBoundingClientRect();
    return {
      board: board.width / board.height,
      piece: piece.width / piece.height,
    };
  });

  assert.ok(Math.abs(ratios.board - expectedRatio) < 0.03, `board ratio ${ratios.board}`);
  assert.ok(Math.abs(ratios.piece - expectedRatio) < 0.03, `piece ratio ${ratios.piece}`);
}

async function assertDesktopPuzzleLayout(page) {
  const layout = await page.evaluate(() => {
    const library = document.querySelector('.image-library').getBoundingClientRect();
    const imageList = document.querySelector('.image-list');
    const board = document.querySelector('.board').getBoundingClientRect();
    const slotLayer = document.querySelector('.slot-layer').getBoundingClientRect();
    const tray = document.querySelector('.tray').getBoundingClientRect();
    const slot = document.querySelector('.slot').getBoundingClientRect();
    const piece = document.querySelector('#tray > .piece').getBoundingClientRect();
    const trayStyle = getComputedStyle(document.querySelector('.tray'));
    const imageListStyle = getComputedStyle(imageList);

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      libraryToBoardGap: board.left - library.right,
      libraryRight: library.right,
      boardLeft: board.left,
      boardRight: board.right,
      trayLeft: tray.left,
      boardWidth: board.width,
      slotLayerWidth: slotLayer.width,
      slotLayerHeight: slotLayer.height,
      trayWidth: tray.width,
      trayHeight: tray.height,
      slotWidth: slot.width,
      slotHeight: slot.height,
      pieceWidth: piece.width,
      pieceHeight: piece.height,
      boardCenterDelta: Math.abs((board.left + board.width / 2) - (window.innerWidth / 2)),
      trayRight: tray.right,
      imageListCanScroll: imageList.scrollHeight > imageList.clientHeight,
      imageListOverflowY: imageListStyle.overflowY,
      trayOverflowX: trayStyle.overflowX,
      trayOverflowY: trayStyle.overflowY,
      trayCanScrollX: document.querySelector('.tray').scrollWidth > document.querySelector('.tray').clientWidth,
      trayCanScrollY: document.querySelector('.tray').scrollHeight > document.querySelector('.tray').clientHeight,
    };
  });

  assert.ok(layout.documentWidth <= layout.viewportWidth + 1, `page horizontal scroll: ${JSON.stringify(layout)}`);
  assert.ok(layout.documentHeight <= layout.viewportHeight + 1, `page vertical scroll: ${JSON.stringify(layout)}`);
  assert.ok(layout.libraryRight < layout.boardLeft, `library should be left of board: ${JSON.stringify(layout)}`);
  assert.ok(layout.libraryToBoardGap <= 40, `too much blank space before board: ${JSON.stringify(layout)}`);
  assert.ok(layout.boardRight < layout.trayLeft, `tray should be right of board: ${JSON.stringify(layout)}`);
  assert.ok(layout.boardWidth >= 400, `board should remain usable: ${layout.boardWidth}`);
  assert.ok(layout.trayRight <= layout.viewportWidth + 1, `tray should remain inside viewport: ${JSON.stringify(layout)}`);
  assert.ok(layout.imageListCanScroll, `image list should scroll: ${JSON.stringify(layout)}`);
  assert.equal(layout.imageListOverflowY, 'auto');
  assert.notEqual(layout.trayOverflowY, 'auto');
  assert.equal(layout.trayCanScrollX, false);
  assert.equal(layout.trayCanScrollY, false);
  assert.ok(Math.abs(layout.slotLayerWidth - layout.trayWidth) <= 3, `tray width ${layout.trayWidth} vs slot layer ${layout.slotLayerWidth}`);
  assert.ok(Math.abs(layout.slotLayerHeight - layout.trayHeight) <= 3, `tray height ${layout.trayHeight} vs slot layer ${layout.slotLayerHeight}`);
  assert.ok(Math.abs(layout.slotWidth - layout.pieceWidth) <= 3, `piece width ${layout.pieceWidth} vs slot ${layout.slotWidth}`);
  assert.ok(Math.abs(layout.slotHeight - layout.pieceHeight) <= 3, `piece height ${layout.pieceHeight} vs slot ${layout.slotHeight}`);
}

async function verifyPlayModes(page) {
  await uploadSvgText(
    page,
    'browser-test-wide.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300">
      <rect x="0" y="0" width="250" height="150" fill="#8edcff"/>
      <circle cx="92" cy="76" r="44" fill="#26313a"/>
      <rect x="250" y="0" width="250" height="150" fill="#ef6f63"/>
      <path d="M280 25 H470 M280 74 H470 M280 123 H470" stroke="#fff6dd" stroke-width="20"/>
      <rect x="0" y="150" width="250" height="150" fill="#67c86f"/>
      <path d="M0 278 C70 218 158 318 250 238" fill="none" stroke="#fff6dd" stroke-width="28"/>
      <rect x="250" y="150" width="250" height="150" fill="#ffd958"/>
      <path d="M376 170 L468 288 H286 Z" fill="#2457d6"/>
    </svg>`,
  );
  await assertPuzzleAspect(page, 500 / 300);

  assert.equal(await page.locator('.piece-label').first().isVisible(), false);
  assert.equal(await page.locator('.mode-button[data-mode="labels"]').count(), 0);
  assert.equal(await page.locator('.mode-button[data-mode="hint"]').count(), 1);
  assert.equal(await page.locator('.mode-button[data-mode="sound"]').count(), 1);
  assert.equal(await page.locator('.mode-button[data-mode="autoNext"]').count(), 1);
  assert.equal(await page.locator('.mode-button[data-mode="sound"]').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.mode-button[data-mode="autoNext"]').getAttribute('aria-pressed'), 'false');

  await page.locator('.mode-button[data-mode="hint"]').click();
  await page.locator('.slot.guide-hint[data-hint-ready="true"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.slot.guide-hint').count(), 1);
  await page.locator('.mode-button[data-mode="hint"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.slot.guide-hint').length === 2);
  assert.equal(await page.locator('.slot.guide-hint').count(), 2);
  assert.equal(await page.locator('.slot.guide-hint .piece').count(), 0);

  await page.locator('.mode-button[data-mode="guide"]').click();
  assert.equal(await page.locator('#board').evaluate((node) => node.classList.contains('hide-guide')), true);
  assert.equal(await page.locator('.slot.guide-hint').count(), 2);
  const hint = await page.locator('.slot.guide-hint').first().evaluate((slot) => ({
    backgroundImage: getComputedStyle(slot, '::before').backgroundImage,
    opacity: getComputedStyle(slot, '::before').opacity,
    score: Number(slot.dataset.hintScore || 0),
  }));
  assert.match(hint.backgroundImage, /url\(/);
  assert.equal(hint.opacity, '0.42');
  assert.ok(hint.score > 8, `hint should contain image detail, score=${hint.score}`);

  await page.locator('.mode-button[data-mode="correction"]').click();
  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-1');
  const wrongPlaced = await page.locator('.piece[data-piece-id="piece-0-0"]').evaluate((piece) => ({
    placed: piece.classList.contains('placed'),
    parentId: piece.parentElement.id,
    progress: document.querySelector('.progress').textContent,
  }));

  assert.equal(wrongPlaced.placed, true);
  assert.equal(wrongPlaced.parentId, 'board');
  assert.equal(wrongPlaced.progress, '1 / 4');

  await dragPieceToSlot(page, 'piece-0-1', 'piece-0-0');
  await dragPieceToSlot(page, 'piece-1-0', 'piece-1-1');
  await dragPieceToSlot(page, 'piece-1-1', 'piece-1-0');

  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 4 / 4');
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), true);

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="guide"]').click();
  await assertGrid(page, 2);
}

async function verifyFreePlacementBoardSwap(page) {
  await page.locator('.mode-button[data-mode="correction"]').click();
  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-1');
  await dragPieceToSlot(page, 'piece-0-1', 'piece-0-0');
  await dragPieceToSlotByGrabOffset(page, 'piece-0-0', 'piece-0-0', 0.86, 0.5);

  const placements = await page.evaluate(() => (
    Object.fromEntries(
      Array.from(document.querySelectorAll('.piece.placed')).map((piece) => [
        piece.dataset.pieceId,
        piece.dataset.currentTargetId,
      ]),
    )
  ));

  assert.equal(placements['piece-0-0'], 'piece-0-0');
  assert.equal(placements['piece-0-1'], 'piece-0-1');
  assert.equal(new Set(Object.values(placements)).size, Object.values(placements).length);
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 2 / 4');

  await page.locator('.mode-button[data-mode="correction"]').click();
  await assertGrid(page, 2);
}

async function verifyGlueMode(page) {
  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-0');
  await dragPieceToSlot(page, 'piece-0-1', 'piece-0-1');

  let glueState = await page.evaluate(() => ({
    gluedPieces: document.querySelectorAll('.piece.glued').length,
    glueIds: Array.from(
      new Set(Array.from(document.querySelectorAll('.piece.glued')).map((piece) => piece.dataset.glueId)),
    ).filter(Boolean),
  }));
  assert.equal(glueState.gluedPieces, 2);
  assert.equal(glueState.glueIds.length, 1);

  await dragPieceToSlot(page, 'piece-0-1', 'piece-1-1');

  const placements = await page.evaluate(() => (
    Object.fromEntries(
      Array.from(document.querySelectorAll('.piece.placed')).map((piece) => [
        piece.dataset.pieceId,
        piece.dataset.currentTargetId,
      ]),
    )
  ));
  assert.equal(placements['piece-0-0'], 'piece-1-0');
  assert.equal(placements['piece-0-1'], 'piece-1-1');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 2 / 4');

  glueState = await page.evaluate(() => ({
    gluedPieces: document.querySelectorAll('.piece.glued').length,
    glueIds: Array.from(
      new Set(Array.from(document.querySelectorAll('.piece.glued')).map((piece) => piece.dataset.glueId)),
    ).filter(Boolean),
  }));
  assert.equal(glueState.gluedPieces, 2);
  assert.equal(glueState.glueIds.length, 1);

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await assertGrid(page, 2);

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-0');
  await dragPieceToSlot(page, 'piece-0-1', 'piece-0-1');
  await dragPieceToSlot(page, 'piece-1-0', 'piece-1-1');
  await dragPieceToSlot(page, 'piece-1-1', 'piece-1-0');
  await dragPieceToSlot(page, 'piece-0-0', 'piece-1-0');

  const swappedPlacements = await page.evaluate(() => (
    Object.fromEntries(
      Array.from(document.querySelectorAll('.piece.placed')).map((piece) => [
        piece.dataset.pieceId,
        piece.dataset.currentTargetId,
      ]),
    )
  ));
  assert.equal(swappedPlacements['piece-0-0'], 'piece-1-0');
  assert.equal(swappedPlacements['piece-0-1'], 'piece-1-1');
  assert.equal(swappedPlacements['piece-1-0'], 'piece-0-1');
  assert.equal(swappedPlacements['piece-1-1'], 'piece-0-0');
  assert.equal(new Set(Object.values(swappedPlacements)).size, 4);
  assert.equal(await page.locator('.progress').textContent(), '4 / 4');
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), true);

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await assertGrid(page, 2);

  await page.locator('.grid-button[data-grid-size="3"]').click();
  await assertGrid(page, 3);
  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await dragPieceToSlot(page, 'piece-0-0', 'piece-1-1');
  await dragPieceToSlot(page, 'piece-0-1', 'piece-1-2');
  await dragPieceToSlot(page, 'piece-1-0', 'piece-2-1');
  await dragPieceToSlot(page, 'piece-1-1', 'piece-2-2');
  await dragPieceBySlotDeltaRatio(page, 'piece-1-1', 'piece-1-1', 'piece-0-0', 0.56);

  const cornerDragPlacements = await page.evaluate(() => (
    Object.fromEntries(
      Array.from(document.querySelectorAll('.piece.placed')).map((piece) => [
        piece.dataset.pieceId,
        piece.dataset.currentTargetId,
      ]),
    )
  ));
  assert.equal(cornerDragPlacements['piece-0-0'], 'piece-0-0');
  assert.equal(cornerDragPlacements['piece-0-1'], 'piece-0-1');
  assert.equal(cornerDragPlacements['piece-1-0'], 'piece-1-0');
  assert.equal(cornerDragPlacements['piece-1-1'], 'piece-1-1');

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await page.locator('.grid-button[data-grid-size="2"]').click();
  await assertGrid(page, 2);

  await page.locator('.grid-button[data-grid-size="4"]').click();
  await assertGrid(page, 4);
  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  for (const source of [
    ['piece-0-0', 'piece-1-1'],
    ['piece-0-1', 'piece-1-2'],
    ['piece-0-2', 'piece-1-3'],
    ['piece-1-0', 'piece-2-1'],
    ['piece-1-1', 'piece-2-2'],
    ['piece-1-2', 'piece-2-3'],
    ['piece-2-0', 'piece-3-1'],
    ['piece-2-1', 'piece-3-2'],
    ['piece-2-2', 'piece-3-3'],
  ]) {
    await dragPieceToSlot(page, source[0], source[1]);
  }
  await dragPieceBySlotDeltaRatio(page, 'piece-1-1', 'piece-1-1', 'piece-0-0', 0.56);

  const largeGroupPlacements = await page.evaluate(() => (
    Object.fromEntries(
      Array.from(document.querySelectorAll('.piece.placed')).map((piece) => [
        piece.dataset.pieceId,
        piece.dataset.currentTargetId,
      ]),
    )
  ));
  for (const pieceId of [
    'piece-0-0',
    'piece-0-1',
    'piece-0-2',
    'piece-1-0',
    'piece-1-1',
    'piece-1-2',
    'piece-2-0',
    'piece-2-1',
    'piece-2-2',
  ]) {
    assert.equal(largeGroupPlacements[pieceId], pieceId);
  }

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await page.locator('.grid-button[data-grid-size="2"]').click();
  await assertGrid(page, 2);

  await page.locator('.grid-button[data-grid-size="4"]').click();
  await assertGrid(page, 4);
  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  for (const source of [
    ['piece-0-0', 'piece-2-2'],
    ['piece-0-1', 'piece-2-3'],
    ['piece-1-0', 'piece-3-2'],
    ['piece-1-1', 'piece-3-3'],
  ]) {
    await dragPieceToSlot(page, source[0], source[1]);
  }
  await dragPieceToSlot(page, 'piece-1-1', 'piece-0-0');

  let anchoredPlacements = await page.evaluate(() => (
    Object.fromEntries(
      Array.from(document.querySelectorAll('.piece.placed')).map((piece) => [
        piece.dataset.pieceId,
        piece.dataset.currentTargetId,
      ]),
    )
  ));
  for (const pieceId of ['piece-0-0', 'piece-0-1', 'piece-1-0', 'piece-1-1']) {
    assert.equal(anchoredPlacements[pieceId], pieceId);
  }

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await page.locator('.grid-button[data-grid-size="2"]').click();
  await assertGrid(page, 2);

  await page.locator('.grid-button[data-grid-size="4"]').click();
  await assertGrid(page, 4);
  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  for (const source of [
    ['piece-0-0', 'piece-2-1'],
    ['piece-0-1', 'piece-2-2'],
    ['piece-0-2', 'piece-2-3'],
    ['piece-1-0', 'piece-3-1'],
    ['piece-1-1', 'piece-3-2'],
    ['piece-1-2', 'piece-3-3'],
  ]) {
    await dragPieceToSlot(page, source[0], source[1]);
  }
  await dragPieceToSlot(page, 'piece-1-2', 'piece-0-0');

  anchoredPlacements = await page.evaluate(() => (
    Object.fromEntries(
      Array.from(document.querySelectorAll('.piece.placed')).map((piece) => [
        piece.dataset.pieceId,
        piece.dataset.currentTargetId,
      ]),
    )
  ));
  for (const pieceId of [
    'piece-0-0',
    'piece-0-1',
    'piece-0-2',
    'piece-1-0',
    'piece-1-1',
    'piece-1-2',
  ]) {
    assert.equal(anchoredPlacements[pieceId], pieceId);
  }

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="glue"]').click();
  await page.locator('.grid-button[data-grid-size="2"]').click();
  await assertGrid(page, 2);
}

async function verifyEquivalentPieces(page) {
  await uploadSvgText(
    page,
    'browser-test-equivalent.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <rect x="0" y="0" width="200" height="200" fill="#c8b4f4"/>
      <rect x="200" y="0" width="200" height="200" fill="#c8b4f4"/>
      <rect x="0" y="200" width="200" height="200" fill="#67c86f"/>
      <rect x="200" y="200" width="200" height="200" fill="#ef6f63"/>
      <circle cx="100" cy="300" r="42" fill="#ffffff"/>
      <path d="M260 250 L350 350" stroke="#26313a" stroke-width="20"/>
    </svg>`,
  );

  const equivalentGroup = await page.evaluate(() => (
    window.__puppyJigsawDebug?.equivalentTargets?.['piece-0-0'] || []
  ));
  assert.deepEqual(new Set(equivalentGroup), new Set(['piece-0-0', 'piece-0-1']));

  const firstCacheStats = await page.evaluate(() => window.PuppyJigsawImageAnalysis.cacheStats());
  await page.locator('.grid-button[data-grid-size="3"]').click();
  await assertGrid(page, 3);
  await page.locator('.grid-button[data-grid-size="2"]').click();
  await assertGrid(page, 2);
  await page.waitForFunction((hits) => (
    window.PuppyJigsawImageAnalysis.cacheStats().featureHits > hits
  ), firstCacheStats.featureHits);

  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-1');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 1 / 4');
  assert.equal(
    await page.locator('.piece[data-piece-id="piece-0-0"]').getAttribute('data-current-target-id'),
    'piece-0-1',
  );

  await dragPieceToSlot(page, 'piece-0-1', 'piece-0-1');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 1 / 4');
  assert.equal(await page.locator('.piece[data-current-target-id="piece-0-1"]').count(), 1);

  await dragPieceToSlot(page, 'piece-0-1', 'piece-0-0');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 2 / 4');

  await dragPieceToSlot(page, 'piece-1-0', 'piece-1-1');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 2 / 4');

  await page.locator('#reset-button').click();
  await assertGrid(page, 2);

  await uploadSvgText(
    page,
    'browser-test-edge-detail.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <rect width="400" height="400" fill="#c8b4f4"/>
      <rect x="197" y="0" width="3" height="200" fill="#ffffff"/>
      <path d="M199 16 C200 42 199 64 200 88" fill="none" stroke="#bde04b" stroke-width="1"/>
      <rect x="0" y="200" width="200" height="200" fill="#67c86f"/>
      <rect x="200" y="200" width="200" height="200" fill="#ef6f63"/>
    </svg>`,
  );

  const edgeDetailGroup = await page.evaluate(() => (
    window.__puppyJigsawDebug?.equivalentTargets?.['piece-0-0'] || []
  ));
  assert.deepEqual(new Set(edgeDetailGroup), new Set(['piece-0-0']));

  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-1');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 0 / 4');
}

async function verifyBrowserPersistence(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await uploadTestImage(page, 'browser-test-persist.svg', '#cbb7f6', '#bde04b', 420, 420);
  await page.locator('.mode-button[data-mode="guide"]').click();
  await page.locator('.mode-button[data-mode="correction"]').click();
  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-1');
  await dragPieceToSlot(page, 'piece-0-1', 'piece-0-0');
  await page.locator('.mode-button[data-mode="hint"]').click();
  await page.locator('.slot.guide-hint[data-hint-ready="true"]').waitFor({ state: 'visible' });

  await page.reload({ waitUntil: 'networkidle' });

  const restored = await page.evaluate(() => ({
    image: getComputedStyle(document.documentElement).getPropertyValue('--puzzle-image'),
    gridSize: getComputedStyle(document.documentElement).getPropertyValue('--grid-size').trim(),
    hideGuide: document.querySelector('#board').classList.contains('hide-guide'),
    freePlacement: document.documentElement.classList.contains('free-placement'),
    progress: document.querySelector('.progress').getAttribute('aria-label'),
    placements: Object.fromEntries(
      Array.from(document.querySelectorAll('.piece.placed')).map((piece) => [
        piece.dataset.pieceId,
        piece.dataset.currentTargetId,
      ]),
    ),
    hintCount: document.querySelectorAll('.slot.guide-hint').length,
    selectedName: document.querySelector('.image-card.selected .image-name')?.textContent || '',
  }));

  assert.match(restored.image, /browser-test-persist\.svg/);
  assert.equal(restored.gridSize, '2');
  assert.equal(restored.hideGuide, true);
  assert.equal(restored.freePlacement, true);
  assert.equal(restored.progress, '完成 2 / 4');
  assert.equal(restored.placements['piece-0-0'], 'piece-0-1');
  assert.equal(restored.placements['piece-0-1'], 'piece-0-0');
  assert.equal(restored.hintCount, 1);
  assert.equal(restored.selectedName, 'browser-test-persist.svg');

  await page.evaluate(() => {
    const key = 'puppy-jigsaw-state-v2';
    const saved = JSON.parse(localStorage.getItem(key));
    saved.imageStates['missing-image.svg'] = {
      ...saved.imageStates['browser-test-persist.svg'],
      imageSignature: 'missing',
    };
    saved.imageStates['browser-test-persist.svg'].imageSignature = 'outdated';
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });
  const cleaned = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puppy-jigsaw-state-v2'));
    return {
      missing: saved.imageStates['missing-image.svg'] || null,
      persistSignature: saved.imageStates['browser-test-persist.svg']?.imageSignature || null,
      progress: document.querySelector('.progress').getAttribute('aria-label'),
    };
  });

  assert.equal(cleaned.missing, null);
  assert.notEqual(cleaned.persistSignature, 'outdated');
  assert.equal(cleaned.progress, '完成 0 / 4');

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await assertGrid(page, 2);
}

async function verifyImageLibrary(page) {
  const initialCards = await page.locator('.image-card').count();
  assert.ok(initialCards >= 0);

  const firstCard = await uploadTestImage(page, 'browser-test-yellow.svg', '#ffcc00', '#0077cc');
  const firstImage = await currentPuzzleImage(page);

  await uploadTestImage(page, 'browser-test-green.svg', '#5bd47a', '#ef6f63');
  const secondImage = await currentPuzzleImage(page);
  assert.notEqual(firstImage, secondImage);

  await firstCard.click();
  await page.locator('.image-card.selected[data-image-name="browser-test-yellow.svg"]').waitFor({ state: 'visible' });
  assert.equal(await currentPuzzleImage(page), firstImage);
}

async function verifyAutoNextCompletion(page) {
  const firstCard = await uploadTestImage(page, 'browser-test-auto-first.svg', '#8edcff', '#ef6f63');
  await uploadTestImage(page, 'browser-test-auto-second.svg', '#fff1a9', '#2457d6');
  await firstCard.click();
  await page.locator('.image-card.selected[data-image-name="browser-test-auto-first.svg"]').waitFor({ state: 'visible' });
  await assertGrid(page, 2);

  await page.locator('.mode-button[data-mode="autoNext"]').click();
  assert.equal(await page.locator('.mode-button[data-mode="autoNext"]').getAttribute('aria-pressed'), 'true');

  for (const pieceId of ['piece-0-0', 'piece-0-1', 'piece-1-0', 'piece-1-1']) {
    await dragPieceToSlot(page, pieceId);
  }

  await page.locator('#completion-countdown').waitFor({ state: 'visible' });
  await page.locator('.image-card.selected[data-image-name="browser-test-auto-second.svg"]').waitFor({
    state: 'visible',
    timeout: 6000,
  });
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), true);

  assert.equal(await page.locator('.mode-button[data-mode="autoNext"]').getAttribute('aria-pressed'), 'false');
  await page.locator('#reset-button').click();
  await assertGrid(page, 2);
}

async function verifyDesktop(page) {
  await page.setViewportSize({ width: 1280, height: 820 });
  await visitWithEmptyStorage(page);

  await assertGrid(page, 2);
  await assertDesktopPuzzleLayout(page);
  await verifyImageLibrary(page);
  await verifyAutoNextCompletion(page);
  await verifyPlayModes(page);
  await verifyFreePlacementBoardSwap(page);
  await verifyGlueMode(page);
  await verifyEquivalentPieces(page);
  await verifyBrowserPersistence(page);

  await page.locator('.grid-button[data-grid-size="3"]').click();
  await assertGrid(page, 3);
  await page.locator('.grid-button[data-grid-size="4"]').click();
  await assertGrid(page, 4);
  await page.locator('.grid-button[data-grid-size="5"]').click();
  await assertGrid(page, 5);
  const fiveByFivePieceSize = await page.locator('.piece').first().evaluate((piece) => {
    const rect = piece.getBoundingClientRect();
    return Math.min(rect.width, rect.height);
  });
  assert.ok(fiveByFivePieceSize >= 76, `5x5 piece too small: ${fiveByFivePieceSize}`);

  await page.locator('.grid-button[data-grid-size="2"]').click();
  await assertGrid(page, 2);

  const naturalOrder = ['piece-0-0', 'piece-0-1', 'piece-1-0', 'piece-1-1'];
  const initialOrder = await trayOrder(page);
  assert.notDeepEqual(initialOrder, naturalOrder);
  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-1');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 0 / 4');

  for (const pieceId of naturalOrder) {
    await dragPieceToSlot(page, pieceId);
    const placed = await page.locator(`.piece[data-piece-id="${pieceId}"]`).evaluate((piece) => ({
      parentId: piece.parentElement.id,
      placed: piece.classList.contains('placed'),
      tabIndex: piece.tabIndex,
      ariaDisabled: piece.getAttribute('aria-disabled'),
    }));

    assert.equal(placed.parentId, 'board');
    assert.equal(placed.placed, true);
    assert.equal(placed.tabIndex, -1);
    assert.equal(placed.ariaDisabled, 'true');
  }

  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), false);
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 4 / 4');
  await assertSolvedSlotGuidesHidden(page, 4);
  assert.equal(await page.locator('.image-card.selected.completed').count(), 1);
  assert.equal(await page.locator('.image-card.selected .completion-badge').count(), 1);
  assert.equal(await page.locator('#see-again-button').count(), 1);
  assert.equal(await page.locator('#next-image-button').count(), 1);
  await page.screenshot({ path: path.join(screenshotsDir, 'desktop-complete.png'), fullPage: true });

  const completedImageName = await page.locator('.image-card.selected').getAttribute('data-image-name');
  await page.locator('#see-again-button').click();
  await page.locator('#celebration').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), true);
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 4 / 4');
  assert.equal(await page.locator('.piece.placed').count(), 4);

  await page.locator('#reset-button').click();
  assert.equal(await page.locator('#tray > .piece').count(), 4);
  assert.equal(await page.locator('.slot.occupied').count(), 0);

  await page.locator('.piece[data-piece-id="piece-0-0"]').press('Enter');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 1 / 4');
  await page.locator('.piece[data-piece-id="piece-0-1"]').click();
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 2 / 4');
  await page.locator('.piece[data-piece-id="piece-1-0"]').press('Space');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 3 / 4');
  await page.locator('.piece[data-piece-id="piece-1-1"]').click();
  await page.locator('#celebration').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), false);

  await page.locator('#next-image-button').click();
  await page.waitForFunction((imageName) => (
    document.querySelector('.image-card.selected')?.dataset.imageName !== imageName
  ), completedImageName);
  assert.notEqual(await page.locator('.image-card.selected').getAttribute('data-image-name'), completedImageName);
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), true);

  await page.locator(`.image-card[data-image-name="${completedImageName}"]`).click();
  await page.locator(`.image-card.selected[data-image-name="${completedImageName}"]`).waitFor({ state: 'visible' });
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 4 / 4');
  assert.equal(await page.locator('.piece.placed').count(), 4);

  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), true);
  await page.locator('#reset-button').click();
  await page.locator('.grid-button[data-grid-size="3"]').click();
  await page.locator('.piece[data-piece-id="piece-2-2"]').press('Enter');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 1 / 9');
}

async function verifyMobile(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await visitWithEmptyStorage(page);
  await uploadTestImage(page, 'browser-test-mobile-square.svg', '#cbb7f6', '#58c87a', 420, 420);
  await page.locator('.grid-button[data-grid-size="4"]').click();

  const layout = await page.evaluate(() => {
    const tray = document.querySelector('.tray');
    const board = document.querySelector('.board');
    const pieces = Array.from(document.querySelectorAll('.piece')).map((piece) => {
      const rect = piece.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    return {
      bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      trayColumns: getComputedStyle(tray).gridTemplateColumns.split(' ').length,
      boardWidth: board.getBoundingClientRect().width,
      minPieceWidth: Math.min(...pieces.map((piece) => piece.width)),
      minPieceHeight: Math.min(...pieces.map((piece) => piece.height)),
    };
  });

  assert.ok(layout.bodyOverflow <= 1, `horizontal overflow ${layout.bodyOverflow}`);
  assert.equal(layout.trayColumns, 4);
  assert.ok(layout.boardWidth > 220, `board too small: ${layout.boardWidth}`);
  assert.ok(layout.minPieceWidth > 70, `piece too narrow: ${layout.minPieceWidth}`);
  assert.ok(layout.minPieceHeight > 70, `piece too short: ${layout.minPieceHeight}`);

  await page.screenshot({ path: path.join(screenshotsDir, 'mobile-start.png'), fullPage: true });
}

(async () => {
  cleanupBrowserTestImages();

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!text.includes('favicon.ico')) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  try {
    await verifyDesktop(page);
    await verifyMobile(page);
    assert.deepEqual(consoleErrors, []);
  } finally {
    await browser.close();
    cleanupBrowserTestImages();
  }

  console.log('browser verification passed');
})();
