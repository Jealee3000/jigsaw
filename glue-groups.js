(function () {
  function parsePieceId(pieceId) {
    const [, row, col] = pieceId.match(/^piece-(\d+)-(\d+)$/) || [];
    return {
      row: Number(row || 0),
      col: Number(col || 0),
    };
  }

  function targetOffset(firstTargetId, secondTargetId) {
    const first = parsePieceId(firstTargetId);
    const second = parsePieceId(secondTargetId);
    return {
      row: second.row - first.row,
      col: second.col - first.col,
    };
  }

  function isAdjacentOffset(offset) {
    return Math.abs(offset.row) + Math.abs(offset.col) === 1;
  }

  function shiftedTargetId(targetId, offset, gridSize) {
    const { row, col } = parsePieceId(targetId);
    const nextRow = row + offset.row;
    const nextCol = col + offset.col;

    if (nextRow < 0 || nextCol < 0 || nextRow >= gridSize || nextCol >= gridSize) {
      return null;
    }

    return `piece-${nextRow}-${nextCol}`;
  }

  function shouldGluePieces(pieces, firstPieceId, secondPieceId) {
    const firstPiece = pieces[firstPieceId];
    const secondPiece = pieces[secondPieceId];

    if (
      firstPiece?.placed !== true
      || secondPiece?.placed !== true
      || !firstPiece.currentTargetId
      || !secondPiece.currentTargetId
    ) {
      return false;
    }

    const originalOffset = targetOffset(firstPiece.targetId, secondPiece.targetId);
    const currentOffset = targetOffset(firstPiece.currentTargetId, secondPiece.currentTargetId);

    return isAdjacentOffset(originalOffset)
      && originalOffset.row === currentOffset.row
      && originalOffset.col === currentOffset.col;
  }

  function buildGlueGroups(pieceIds, pieces) {
    const parent = Object.fromEntries(pieceIds.map((pieceId) => [pieceId, pieceId]));
    const find = (pieceId) => {
      if (parent[pieceId] !== pieceId) {
        parent[pieceId] = find(parent[pieceId]);
      }
      return parent[pieceId];
    };
    const union = (firstPieceId, secondPieceId) => {
      const firstRoot = find(firstPieceId);
      const secondRoot = find(secondPieceId);
      if (firstRoot !== secondRoot) {
        parent[secondRoot] = firstRoot;
      }
    };

    for (let firstIndex = 0; firstIndex < pieceIds.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < pieceIds.length; secondIndex += 1) {
        if (shouldGluePieces(pieces, pieceIds[firstIndex], pieceIds[secondIndex])) {
          union(pieceIds[firstIndex], pieceIds[secondIndex]);
        }
      }
    }

    const groups = new Map();
    for (const pieceId of pieceIds) {
      if (pieces[pieceId]?.placed !== true) {
        continue;
      }

      const rootId = find(pieceId);
      groups.set(rootId, [...(groups.get(rootId) || []), pieceId]);
    }

    return Array.from(groups.values()).filter((members) => members.length >= 2);
  }

  window.PuppyJigsawGlue = {
    buildGlueGroups,
    shiftedTargetId,
    targetOffset,
  };
}());
