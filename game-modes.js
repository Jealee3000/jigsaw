(function () {
  function updateModeControls({
    root,
    board,
    modeButtons,
    modeState,
  }) {
    board.classList.toggle('hide-guide', !modeState.guide);
    root.classList.toggle('free-placement', !modeState.correction);
    root.classList.toggle('glue-mode', modeState.glue);

    for (const button of modeButtons) {
      const isActive = Boolean(modeState[button.dataset.mode]);
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  }

  window.PuppyJigsawModes = {
    updateModeControls,
  };
})();
