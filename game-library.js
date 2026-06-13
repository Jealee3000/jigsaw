(function () {
  function renderImageLibrary({
    imageList,
    imageLibrary,
    currentImageUrl,
    saved,
    isImageCompleted,
    onSelectImage,
  }) {
    imageList.replaceChildren();

    if (imageLibrary.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'image-empty';
      empty.textContent = 'images 文件夹还没有图片';
      imageList.appendChild(empty);
      return;
    }

    for (const image of imageLibrary) {
      const button = document.createElement('button');
      const thumbnail = document.createElement('img');
      const name = document.createElement('span');
      const completed = isImageCompleted(image, saved);

      button.className = 'image-card';
      button.type = 'button';
      button.dataset.imageName = image.name;
      button.classList.toggle('selected', image.url === currentImageUrl);
      button.classList.toggle('completed', completed);
      button.setAttribute('aria-pressed', String(image.url === currentImageUrl));

      thumbnail.src = image.url;
      thumbnail.alt = image.name;
      thumbnail.loading = 'lazy';

      name.className = 'image-name';
      name.textContent = image.name;

      button.append(thumbnail, name);
      if (completed) {
        const badge = document.createElement('span');
        badge.className = 'completion-badge';
        badge.textContent = '完成';
        button.appendChild(badge);
      }
      button.addEventListener('click', () => onSelectImage(image));
      imageList.appendChild(button);
    }
  }

  window.PuppyJigsawLibrary = {
    renderImageLibrary,
  };
})();
