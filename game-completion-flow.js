(function () {
  function createCompletionFlow({
    board,
    celebration,
    nextImageButton,
    completionFeedback,
    getCompletionDismissed,
    setCompletionDismissed,
    getImageLibrary,
    isPuzzleSolved,
    renderImageLibrary,
    saveState,
    selectLibraryImage,
    selectedImageName,
    setStatus,
  }) {
    function showCelebrationIfComplete() {
      if (isPuzzleSolved()) {
        board.classList.add('solved');
        renderImageLibrary();
        if (!getCompletionDismissed()) {
          celebration.hidden = false;
          completionFeedback.playSound();
          completionFeedback.scheduleAutoNext();
          window.setTimeout(() => nextImageButton.focus(), 0);
        }
        return true;
      }

      board.classList.remove('solved');
      return false;
    }

    function hideCelebration() {
      completionFeedback.clear();
      celebration.hidden = true;
      setCompletionDismissed(true);
      saveState();
    }

    async function goToNextImage() {
      const imageLibrary = getImageLibrary();
      if (imageLibrary.length === 0) {
        hideCelebration();
        return;
      }

      const currentName = selectedImageName();
      const currentIndex = Math.max(0, imageLibrary.findIndex((image) => image.name === currentName));
      const nextImage = imageLibrary[(currentIndex + 1) % imageLibrary.length];

      completionFeedback.clear();
      celebration.hidden = true;
      setCompletionDismissed(true);
      saveState();
      setCompletionDismissed(false);
      await selectLibraryImage(nextImage, { silent: true, skipSave: true });
      setStatus(`下一张 ${nextImage.name}`);
    }

    return {
      goToNextImage,
      hideCelebration,
      showCelebrationIfComplete,
    };
  }

  window.PuppyJigsawCompletionFlow = {
    createCompletionFlow,
  };
}());
