(function () {
  async function fetchImageLibrary() {
    const response = await fetch('/api/images');
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '读取图片列表失败');
    }

    return Array.isArray(result.images) ? result.images : [];
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file, file.name);

    const response = await fetch('/api/images', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || '上传失败，请换一张图片');
    }

    return {
      image: result.image,
      images: Array.isArray(result.images) ? result.images : [],
    };
  }

  window.PuppyJigsawImageService = {
    fetchImageLibrary,
    uploadImage,
  };
}());
