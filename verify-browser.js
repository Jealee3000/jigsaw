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
  await page.waitForTimeout(80);
}

async function trayOrder(page) {
  return page.locator('#tray > .piece').evaluateAll((nodes) => (
    nodes.map((node) => node.dataset.pieceId)
  ));
}

async function assertGrid(page, size) {
  assert.equal(await page.locator('.piece').count(), size * size);
  assert.equal(await page.locator('.slot').count(), size * size);
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), `完成 0 / ${size * size}`);
}

async function currentPuzzleImage(page) {
  return page.evaluate(() => (
    getComputedStyle(document.documentElement).getPropertyValue('--puzzle-image')
  ));
}

async function uploadTestImage(page, fileName, fill, accent, width = 600, height = 420) {
  const uploadPath = path.join(screenshotsDir, fileName);
  fs.writeFileSync(
    uploadPath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="${accent}"/></svg>`,
  );

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
    const board = document.querySelector('.board').getBoundingClientRect();
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
    const board = document.querySelector('.board').getBoundingClientRect();
    const tray = document.querySelector('.tray').getBoundingClientRect();
    const slot = document.querySelector('.slot').getBoundingClientRect();
    const piece = document.querySelector('#tray > .piece').getBoundingClientRect();

    return {
      libraryRight: library.right,
      boardLeft: board.left,
      boardRight: board.right,
      trayLeft: tray.left,
      boardWidth: board.width,
      slotWidth: slot.width,
      slotHeight: slot.height,
      pieceWidth: piece.width,
      pieceHeight: piece.height,
      boardCenterDelta: Math.abs((board.left + board.width / 2) - (window.innerWidth / 2)),
    };
  });

  assert.ok(layout.libraryRight < layout.boardLeft, `library should be left of board: ${JSON.stringify(layout)}`);
  assert.ok(layout.boardRight < layout.trayLeft, `tray should be right of board: ${JSON.stringify(layout)}`);
  assert.ok(layout.boardWidth >= 620, `board should be larger: ${layout.boardWidth}`);
  assert.ok(layout.boardCenterDelta < 110, `board should be near center: ${layout.boardCenterDelta}`);
  assert.ok(Math.abs(layout.slotWidth - layout.pieceWidth) <= 3, `piece width ${layout.pieceWidth} vs slot ${layout.slotWidth}`);
  assert.ok(Math.abs(layout.slotHeight - layout.pieceHeight) <= 3, `piece height ${layout.pieceHeight} vs slot ${layout.slotHeight}`);
}

async function verifyPlayModes(page) {
  await uploadTestImage(page, 'browser-test-wide.svg', '#8edcff', '#ef6f63', 500, 300);
  await assertPuzzleAspect(page, 500 / 300);

  assert.equal(await page.locator('.piece-label').first().isVisible(), false);

  await page.locator('.mode-button[data-mode="labels"]').click();
  assert.equal(await page.locator('.piece-label').first().isVisible(), true);

  await page.locator('.mode-button[data-mode="guide"]').click();
  assert.equal(await page.locator('#board').evaluate((node) => node.classList.contains('hide-guide')), true);

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

  for (const pieceId of ['piece-0-1', 'piece-1-0', 'piece-1-1']) {
    await dragPieceToSlot(page, pieceId);
  }

  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 4 / 4');
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), true);

  await page.locator('.mode-button[data-mode="correction"]').click();
  await page.locator('.mode-button[data-mode="guide"]').click();
  await page.locator('.mode-button[data-mode="labels"]').click();
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

async function verifyDesktop(page) {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await assertGrid(page, 2);
  await assertDesktopPuzzleLayout(page);
  await verifyImageLibrary(page);
  await verifyPlayModes(page);

  await page.locator('.grid-button[data-grid-size="3"]').click();
  await assertGrid(page, 3);
  await page.locator('.grid-button[data-grid-size="4"]').click();
  await assertGrid(page, 4);

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
  await page.screenshot({ path: path.join(screenshotsDir, 'desktop-complete.png'), fullPage: true });

  await page.locator('#replay-button').click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), true);
  assert.equal(await page.locator('#tray > .piece').count(), 4);

  await page.locator('.piece[data-piece-id="piece-0-0"]').press('Enter');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 1 / 4');
  await page.locator('.piece[data-piece-id="piece-0-1"]').click();
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 2 / 4');
  await page.locator('.piece[data-piece-id="piece-1-0"]').press('Space');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 3 / 4');
  await page.locator('.piece[data-piece-id="piece-1-1"]').click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#celebration').evaluate((node) => node.hidden), false);

  await page.locator('#replay-button').click();
  await page.locator('.grid-button[data-grid-size="3"]').click();
  await page.locator('.piece[data-piece-id="piece-2-2"]').press('Enter');
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 1 / 9');
}

async function verifyMobile(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
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
  assert.ok(layout.boardWidth > 300, `board too small: ${layout.boardWidth}`);
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
