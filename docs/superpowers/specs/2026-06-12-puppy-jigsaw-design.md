# Puppy Family Jigsaw Design

Date: 2026-06-12

## Goal

Build a browser-based jigsaw game for a 3.5-year-old child. The game should feel warm, bright, and family-friendly, inspired by the general appeal of preschool dog-family animation, while using original characters, original visuals, and original copy.

The first version uses a 2x2 puzzle with four large draggable pieces. The child should be able to complete the puzzle without reading instructions.

## IP Boundary

The game must not use Bluey, Bingo, Heeler family names, character likenesses, exact color identities, show dialogue, official artwork, or branded assets.

The creative direction is:

- Original dog-family characters.
- A sunny yard scene.
- Broad, simple shapes.
- Warm and playful preschool tone.
- No direct reuse of protected character designs or story details.

## User Experience

The game opens directly into the playable puzzle. There is no landing page.

The screen contains:

- A large puzzle board with a faint completed-image guide.
- Four large puzzle pieces placed around or below the board.
- A simple progress indicator using stars or filled dots.
- A restart button with an icon and short label.
- A celebratory completion state with confetti, stars, and a replay control.

The child interacts by dragging a piece to its matching board slot. If the piece is close enough to the correct slot, it snaps into place. If it is far away or in the wrong slot, it gently returns to its previous position without an error message.

## Accessibility And Child-Friendliness

- Pieces and controls must be large enough for imprecise touch input.
- The game must support mouse, touch, and pointer input.
- Feedback should be positive and non-punitive.
- Text should be minimal and not required to understand gameplay.
- Motion should be short and cheerful, not distracting.
- The full game should fit comfortably on common desktop and tablet viewports, with a stacked mobile layout.

## Visual Direction

Use a colorful original illustration made with HTML/CSS/SVG or Canvas:

- Sunny sky.
- Green yard.
- Two original puppy characters.
- Rounded geometric forms.
- High contrast between puzzle pieces.
- Friendly palette with blue, yellow, green, coral, and cream.

Avoid a one-hue palette and avoid copying the Bluey character silhouette, markings, or exact family composition.

## Technical Approach

Use plain HTML, CSS, and JavaScript with no external dependencies.

Suggested files:

- `index.html` for the game markup and SVG scene.
- `styles.css` for responsive layout, visual design, and animations.
- `game.js` for puzzle state, drag handling, snapping, progress, and reset.

The implementation should be easy to open locally and easy to preview in the browser visual workflow.

## Game Logic

State model:

- Four pieces.
- Four target slots.
- Each piece has a correct target id.
- A piece is either loose or placed.
- The puzzle is complete when all four pieces are placed.

Interaction:

- On pointer down, bring the piece to the front.
- On pointer move, follow the pointer.
- On pointer up, measure distance from the piece center to its correct slot center.
- If within snap threshold, place it and lock it.
- Otherwise, return it to its loose position.
- On completion, trigger celebration and show replay.

## Error Handling

The game should not show technical errors to the child.

If a pointer interaction is interrupted, the active piece returns to a valid loose position. Restart always restores all pieces and clears celebration state.

## Testing Plan

Automated tests should cover the pure game logic:

- Correct piece snaps when within threshold.
- Correct piece does not snap when outside threshold.
- Wrong target does not place the piece.
- Completion is detected only after all four pieces are placed.
- Reset clears placed state and completion.

Manual browser verification should cover:

- Page loads without errors.
- Pieces can be dragged with mouse.
- Touch-style pointer events work through the same path.
- Completion celebration appears.
- Layout works at desktop and mobile widths.
