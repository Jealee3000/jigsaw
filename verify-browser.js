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

async function uploadTestImage(page, fileName, fill, accent) {
  const uploadPath = path.join(screenshotsDir, fileName);
  fs.writeFileSync(
    uploadPath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420"><rect width="600" height="420" fill="${fill}"/><circle cx="300" cy="210" r="100" fill="${accent}"/></svg>`,
  );

  await page.locator('#image-input').setInputFiles(uploadPath);
  const card = page.locator(`.image-card[data-image-name="${fileName}"]`);
  await card.waitFor({ state: 'visible' });
  await page.locator(`.image-card.selected[data-image-name="${fileName}"]`).waitFor({ state: 'visible' });

  const puzzleImage = await currentPuzzleImage(page);
  assert.match(puzzleImage, new RegExp(`/images/${fileName}`));
  return card;
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
  await verifyImageLibrary(page);

  await page.locator('.grid-button[data-grid-size="3"]').click();
  await assertGrid(page, 3);
  await page.locator('.grid-button[data-grid-size="4"]').click();
  await assertGrid(page, 4);

  await page.locator('.grid-button[data-grid-size="2"]').click();
  await assertGrid(page, 2);

  const initialOrder = ['piece-0-0', 'piece-0-1', 'piece-1-0', 'piece-1-1'];
  assert.deepEqual(await trayOrder(page), initialOrder);
  await dragPieceToSlot(page, 'piece-0-0', 'piece-0-1');
  assert.deepEqual(await trayOrder(page), initialOrder);
  assert.equal(await page.locator('.progress').getAttribute('aria-label'), '完成 0 / 4');

  for (const pieceId of initialOrder) {
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
  assert.deepEqual(await trayOrder(page), initialOrder);

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
  await dragPieceToSlot(page, 'piece-2-2');
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
