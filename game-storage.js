(function () {
  const storageKey = 'puppy-jigsaw-state-v2';

  function createEmptyStorageState() {
    return {
      version: 2,
      currentImageName: null,
      libraryFilter: {
        query: '',
        status: 'all',
      },
      imageStates: {},
    };
  }

  function readSavedData() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return createEmptyStorageState();
      }

      const saved = JSON.parse(raw);
      return saved?.version === 2 && saved.imageStates
        ? saved
        : createEmptyStorageState();
    } catch (error) {
      return createEmptyStorageState();
    }
  }

  function writeSavedData(saved) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch (error) {
      // Local storage can be unavailable in restricted browser contexts.
    }
  }

  window.PuppyJigsawStorage = {
    readSavedData,
    writeSavedData,
  };
}());
