# Custom Image Grid Jigsaw Design

Date: 2026-06-12

## Goal

Extend the local browser puzzle game so a parent can choose a local image and generate a child-friendly jigsaw puzzle from it. The game should support 2x2, 3x3, and 4x4 puzzle sizes while keeping 2x2 as the default for a 3.5-year-old child.

## Image And IP Boundary

The app will not bundle, download, scrape, redistribute, or save Bluey artwork. Instead, it will provide a local image picker. The selected image is read only inside the browser with `FileReader` or `URL.createObjectURL`, used as a temporary puzzle image, and not uploaded anywhere.

This keeps the project suitable for local family play while avoiding shipping copyrighted character art in the repository. The fallback image remains the existing original puppy-yard artwork.

## User Experience

The game opens directly into the puzzle screen.

Controls:

- Image picker button: "选择图片".
- Difficulty segmented control: "2x2", "3x3", "4x4".
- Reset button.
- Replay button in the completion overlay.

Default state:

- Uses the existing original yard illustration.
- Starts at 2x2.
- Shows a short parent-facing hint near controls: "图片只在本机使用".

When the user selects a local image:

- The board guide uses that image.
- Pieces are generated from the same image.
- The image stays in memory only for the current page session.
- Changing difficulty rebuilds the puzzle from the current image.

## Puzzle Generation

For a grid size `N`, generate:

- `N * N` slot elements.
- `N * N` piece buttons.
- Piece ids in the format `piece-r-c`, where `r` and `c` are zero-based row and column numbers.
- Matching target ids in the same format.

Each piece uses CSS background slicing:

- `background-image: url(...)`
- `background-size: N * 100% N * 100%`
- `background-position` based on row and column.

Slots use CSS grid instead of hard-coded absolute positions. Placed pieces should still snap exactly into the corresponding slot.

## Game Logic

Refactor `game-logic.js` from fixed piece ids to dynamic ids:

- `createPieceIds(gridSize)` returns ordered ids.
- `createGameState(pieceIds)` creates state for the current puzzle.
- `tryPlacePiece(state, options)` remains pure and does not mutate input.
- `isComplete(state)` verifies all current pieces are placed.
- `resetGameState(pieceIds)` resets state for current puzzle.

The browser layer owns:

- Current grid size.
- Current image URL.
- Dynamic DOM rendering.
- Shuffling or ordering the tray.
- Drag, tap, keyboard placement, reset, and completion behavior.

## Interaction

Pointer drag remains the main toddler-friendly path:

- Drag a piece near its correct slot.
- If within snap threshold, it snaps into place.
- If wrong or too far, it returns to its original tray order.

Keyboard and click/tap accessibility path remains:

- Enter/Space or simple tap/click on a loose piece places it directly into its correct slot.
- This path is intended as an accessible fallback and a low-friction mode for very young children.

## Layout

Desktop:

- Board on the left.
- Controls and tray on the right.
- Tray uses a compact grid.

Mobile:

- Controls at top.
- Board below controls.
- Tray below board.
- Piece labels should not overflow or be covered by artwork.

For 4x4, piece labels may be hidden or shortened to avoid visual clutter.

## Error Handling

If the selected file is not an image, show a short parent-facing message and keep the current puzzle.

If image loading fails, keep the current puzzle and show a short message.

If the user changes grid size while dragging, cancel the drag and rebuild cleanly.

## Testing Plan

Automated logic tests:

- `createPieceIds(2)` returns 4 ids.
- `createPieceIds(3)` returns 9 ids.
- `createPieceIds(4)` returns 16 ids.
- Dynamic state initializes each piece with its matching target id.
- Placement works for dynamic ids.
- Completion depends on all current pieces, not a fixed count.
- Reset works for 2x2 and 4x4 states.

Browser verification:

- Page loads with fallback image and 2x2.
- Changing to 3x3 creates 9 pieces and 9 slots.
- Changing to 4x4 creates 16 pieces and 16 slots.
- Drag placement works at 2x2 and 3x3.
- Keyboard/tap placement works.
- Local image picker updates board and pieces.
- Reset preserves selected image and grid size.
- Mobile viewport has no horizontal overflow or label clipping.
