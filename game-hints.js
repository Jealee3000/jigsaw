(function () {
  function createHintController({
    getPieces,
    getPieceIds,
    getSlots,
    getCurrentImageUrl,
    getGridSize,
    getImageSignature,
    findDetailedHintPieceId,
    saveState,
    setStatus,
  }) {
    const hintPieces = new Map();
    let hintGeneration = 0;

    function getBlankHintCandidates() {
      const occupiedTargets = new Set(
        getPieces()
          .filter((piece) => piece.classList.contains('placed'))
          .map((piece) => piece.dataset.currentTargetId)
          .filter(Boolean),
      );

      return getPieceIds().filter((pieceId) => (
        !occupiedTargets.has(pieceId)
        && !hintPieces.has(pieceId)
      ));
    }

    function updateGuideHint() {
      for (const slot of getSlots()) {
        const score = hintPieces.get(slot.dataset.targetId) || 0;
        const isHint = hintPieces.has(slot.dataset.targetId);
        slot.classList.toggle('guide-hint', isHint);
        if (isHint) {
          slot.dataset.hintReady = String(score > 0);
          slot.dataset.hintScore = String(Math.round(score));
        } else {
          delete slot.dataset.hintReady;
          delete slot.dataset.hintScore;
        }
      }
    }

    function addHintPiece() {
      const candidates = getBlankHintCandidates();
      if (candidates.length === 0) {
        setStatus('已经没有空白格可以提示了');
        return;
      }

      const fallback = candidates[Math.floor(Math.random() * candidates.length)];
      const generation = hintGeneration;
      const url = getCurrentImageUrl();
      const size = getGridSize();
      const signature = getImageSignature();

      hintPieces.set(fallback, 0);
      updateGuideHint();
      setStatus(`已添加 ${hintPieces.size} 个提示`);
      saveState();

      findDetailedHintPieceId(url, getPieceIds(), size, candidates, signature)
        .then((entry) => {
          if (generation !== hintGeneration || url !== getCurrentImageUrl() || size !== getGridSize() || !entry) {
            return;
          }

          if (!hintPieces.has(fallback) || (entry.pieceId !== fallback && hintPieces.has(entry.pieceId))) {
            return;
          }

          hintPieces.delete(fallback);
          hintPieces.set(entry.pieceId, entry.score);
          updateGuideHint();
          saveState();
        })
        .catch(() => {
          updateGuideHint();
        });
    }

    function clearHints() {
      hintPieces.clear();
      hintGeneration += 1;
      updateGuideHint();
    }

    function restoreHints(pieceIds, usedTargets) {
      hintPieces.clear();
      hintGeneration += 1;

      for (const pieceId of pieceIds) {
        if (getPieceIds().includes(pieceId) && !usedTargets.has(pieceId)) {
          hintPieces.set(pieceId, 1);
        }
      }

      updateGuideHint();
    }

    return {
      addHintPiece,
      clearHints,
      getHintPieces: () => hintPieces,
      restoreHints,
      updateGuideHint,
    };
  }

  window.PuppyJigsawHints = {
    createHintController,
  };
}());
