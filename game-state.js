(function () {
  function selectedImage(imageLibrary, currentImageUrl) {
    return imageLibrary.find((image) => image.url === currentImageUrl) || null;
  }

  function selectedImageName(imageLibrary, currentImageUrl) {
    return selectedImage(imageLibrary, currentImageUrl)?.name || null;
  }

  function orderedPieceIds(pieceIds, ids) {
    const valid = new Set(pieceIds);
    const ordered = ids.filter((pieceId) => valid.has(pieceId));
    const missing = pieceIds.filter((pieceId) => !ordered.includes(pieceId));
    return [...ordered, ...missing];
  }

  function serializePieces(pieceIds, gameState) {
    return Object.fromEntries(pieceIds.map((pieceId) => {
      const piece = gameState.pieces[pieceId];
      return [pieceId, {
        placed: piece?.placed === true,
        currentTargetId: piece?.currentTargetId || null,
      }];
    }));
  }

  function serializeCurrentImageState({
    gridSize,
    imageSignature,
    trayPieceIds,
    modeState,
    pieceIds,
    gameState,
    hintPieces,
    completionDismissed,
    solved,
  }) {
    return {
      gridSize,
      imageSignature,
      trayPieceIds,
      modeState: {
        guide: modeState.guide,
        correction: modeState.correction,
        glue: modeState.glue,
        sound: modeState.sound,
        autoNext: modeState.autoNext,
      },
      pieces: serializePieces(pieceIds, gameState),
      hints: Array.from(hintPieces.keys()),
      completionDismissed,
      solved,
    };
  }

  function pruneSavedDataForLibrary(saved, imageLibrary) {
    const imagesByName = new Map(imageLibrary.map((image) => [image.name, image]));
    let changed = false;

    for (const [imageName, imageState] of Object.entries(saved.imageStates || {})) {
      const image = imagesByName.get(imageName);
      if (!image || imageState?.imageSignature !== image.signature) {
        delete saved.imageStates[imageName];
        changed = true;
      }
    }

    if (saved.currentImageName && !imagesByName.has(saved.currentImageName)) {
      saved.currentImageName = null;
      changed = true;
    }

    return changed;
  }

  function hasSameOrder(first, second) {
    return first.length === second.length
      && first.every((item, index) => item === second[index]);
  }

  function shufflePieceIds(pieceIds) {
    const shuffled = [...pieceIds];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    if (shuffled.length > 1 && hasSameOrder(shuffled, pieceIds)) {
      shuffled.push(shuffled.shift());
    }

    return shuffled;
  }

  window.PuppyJigsawState = {
    selectedImage,
    selectedImageName,
    orderedPieceIds,
    serializeCurrentImageState,
    pruneSavedDataForLibrary,
    hasSameOrder,
    shufflePieceIds,
  };
}());
