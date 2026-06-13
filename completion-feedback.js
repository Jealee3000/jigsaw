(function () {
  function createCompletionFeedback(options) {
    const {
      countdownElement,
      getImageCount,
      getSoundEnabled,
      getAutoNextEnabled,
      goToNextImage,
      delayMs = 4000,
    } = options;
    let autoNextTimer = null;
    let autoNextInterval = null;

    function clear() {
      if (autoNextTimer) {
        window.clearTimeout(autoNextTimer);
        autoNextTimer = null;
      }

      if (autoNextInterval) {
        window.clearInterval(autoNextInterval);
        autoNextInterval = null;
      }

      countdownElement.hidden = true;
      countdownElement.textContent = '';
    }

    function playSound() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!getSoundEnabled() || !AudioContextClass) {
        return;
      }

      try {
        const context = new AudioContextClass();
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
        gain.connect(context.destination);

        [523.25, 659.25, 783.99].forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.08);
          oscillator.connect(gain);
          oscillator.start(context.currentTime + index * 0.08);
          oscillator.stop(context.currentTime + 0.52);
        });

        window.setTimeout(() => context.close(), 700);
      } catch (error) {
        // Audio is optional and may be blocked by the browser.
      }
    }

    function scheduleAutoNext() {
      clear();

      if (!getAutoNextEnabled() || getImageCount() < 2) {
        return;
      }

      const startedAt = Date.now();
      const updateCountdown = () => {
        const remainingSeconds = Math.max(1, Math.ceil((delayMs - (Date.now() - startedAt)) / 1000));
        countdownElement.hidden = false;
        countdownElement.textContent = `${remainingSeconds} 秒后下一张`;
      };

      updateCountdown();
      autoNextInterval = window.setInterval(updateCountdown, 250);
      autoNextTimer = window.setTimeout(() => {
        clear();
        goToNextImage();
      }, delayMs);
    }

    return {
      clear,
      playSound,
      scheduleAutoNext,
    };
  }

  window.PuppyJigsawCompletion = {
    createCompletionFeedback,
  };
}());
