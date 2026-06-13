(function () {
  const featureCache = new Map();
  const hintScoreCache = new Map();
  const cacheStats = {
    featureReads: 0,
    featureHits: 0,
    hintReads: 0,
    hintHits: 0,
  };

  function cacheKey(url, pieceIds, size, cacheSalt = '') {
    return `${url}|${cacheSalt}|${size}|${pieceIds.join(',')}`;
  }

  function cloneFeature(feature) {
    return {
      ...feature,
      pixels: [...feature.pixels],
    };
  }

  function parsePieceId(pieceId) {
    const [, row, col] = pieceId.match(/^piece-(\d+)-(\d+)$/) || [];
    return {
      row: Number(row || 0),
      col: Number(col || 0),
    };
  }

  function createDefaultEquivalentTargets(pieceIds) {
    return Object.fromEntries(pieceIds.map((pieceId) => [pieceId, [pieceId]]));
  }

  function getImageElement(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function featureDistance(first, second) {
    const colorDistance = Math.hypot(
      first.red - second.red,
      first.green - second.green,
      first.blue - second.blue,
    );
    const detailDistance = Math.abs(first.detail - second.detail);
    const saturationDistance = Math.abs(first.saturation - second.saturation);

    return colorDistance + detailDistance * 2 + saturationDistance * 0.5;
  }

  function localDifference(first, second) {
    if (!first.pixels || !second.pixels || first.pixels.length !== second.pixels.length) {
      return 0;
    }

    const differences = [];
    for (let index = 0; index < first.pixels.length; index += 3) {
      differences.push(Math.hypot(
        first.pixels[index] - second.pixels[index],
        first.pixels[index + 1] - second.pixels[index + 1],
        first.pixels[index + 2] - second.pixels[index + 2],
      ));
    }

    differences.sort((a, b) => b - a);
    const count = Math.max(1, Math.ceil(differences.length * 0.02));
    const strongest = differences.slice(0, count);
    return strongest.reduce((sum, value) => sum + value, 0) / strongest.length;
  }

  function buildEquivalentTargets(pieceIds, features) {
    const targets = createDefaultEquivalentTargets(pieceIds);

    for (let firstIndex = 0; firstIndex < features.length; firstIndex += 1) {
      const first = features[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < features.length; secondIndex += 1) {
        const second = features[secondIndex];
        const lowDetail = first.detail < 18 && second.detail < 18;
        const similar = featureDistance(first, second) < 18
          && localDifference(first, second) < 32;

        if (!lowDetail || !similar) {
          continue;
        }

        targets[first.pieceId] = Array.from(new Set([...targets[first.pieceId], second.pieceId]));
        targets[second.pieceId] = Array.from(new Set([...targets[second.pieceId], first.pieceId]));
      }
    }

    return targets;
  }

  async function analyzePieceFeatures(url, pieceIds, size, cacheSalt = '') {
    const key = cacheKey(url, pieceIds, size, cacheSalt);
    cacheStats.featureReads += 1;
    if (featureCache.has(key)) {
      cacheStats.featureHits += 1;
      return featureCache.get(key).map(cloneFeature);
    }

    const image = await getImageElement(url);
    const sampleSize = 48;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const width = sampleSize * size;
    const height = sampleSize * size;

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const features = pieceIds.map((pieceId) => {
      const { row, col } = parsePieceId(pieceId);
      const data = context.getImageData(
        col * sampleSize,
        row * sampleSize,
        sampleSize,
        sampleSize,
      ).data;
      let red = 0;
      let green = 0;
      let blue = 0;
      let light = 0;
      let lightSquared = 0;
      let saturation = 0;
      const pixelsSignature = [];
      const pixels = data.length / 4;

      for (let index = 0; index < data.length; index += 4) {
        const pixelRed = data[index];
        const pixelGreen = data[index + 1];
        const pixelBlue = data[index + 2];
        const pixelLight = (pixelRed + pixelGreen + pixelBlue) / 3;

        red += pixelRed;
        green += pixelGreen;
        blue += pixelBlue;
        pixelsSignature.push(pixelRed, pixelGreen, pixelBlue);
        light += pixelLight;
        lightSquared += pixelLight * pixelLight;
        saturation += Math.max(pixelRed, pixelGreen, pixelBlue)
          - Math.min(pixelRed, pixelGreen, pixelBlue);
      }

      red /= pixels;
      green /= pixels;
      blue /= pixels;
      light /= pixels;
      lightSquared /= pixels;

      return {
        pieceId,
        red,
        green,
        blue,
        detail: Math.sqrt(Math.max(0, lightSquared - light * light)),
        saturation: saturation / pixels,
        pixels: pixelsSignature,
      };
    });

    featureCache.set(key, features.map(cloneFeature));
    return features;
  }

  async function findDetailedHintPieceId(url, pieceIds, size, allowedPieceIds = pieceIds, cacheSalt = '') {
    const key = cacheKey(url, pieceIds, size, cacheSalt);
    cacheStats.hintReads += 1;
    let scores = hintScoreCache.get(key);
    if (scores) {
      cacheStats.hintHits += 1;
    }

    if (!scores) {
      const image = await getImageElement(url);
      const sampleSize = 32;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const width = sampleSize * size;
      const height = sampleSize * size;

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      scores = pieceIds.map((pieceId) => {
        const { row, col } = parsePieceId(pieceId);
        const data = context.getImageData(
          col * sampleSize,
          row * sampleSize,
          sampleSize,
          sampleSize,
        ).data;
        let mean = 0;
        let meanSquared = 0;
        let saturation = 0;
        const pixels = data.length / 4;

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          const light = (red + green + blue) / 3;
          mean += light;
          meanSquared += light * light;
          saturation += Math.max(red, green, blue) - Math.min(red, green, blue);
        }

        mean /= pixels;
        meanSquared /= pixels;

        return {
          pieceId,
          score: Math.sqrt(Math.max(0, meanSquared - mean * mean)) + saturation / pixels / 3,
        };
      }).sort((first, second) => second.score - first.score);
      hintScoreCache.set(key, scores);
    }

    const allowed = new Set(allowedPieceIds);
    const allowedScores = scores.filter((entry) => allowed.has(entry.pieceId));
    const usefulScores = allowedScores.filter((entry) => entry.score > 8);
    const candidates = usefulScores.length > 0
      ? usefulScores.slice(0, Math.max(1, Math.ceil(usefulScores.length / 2)))
      : allowedScores;
    return candidates[Math.floor(Math.random() * candidates.length)] || allowedScores[0] || null;
  }

  function getCacheStats() {
    return {
      ...cacheStats,
      featureEntries: featureCache.size,
      hintEntries: hintScoreCache.size,
    };
  }

  window.PuppyJigsawImageAnalysis = {
    analyzePieceFeatures,
    buildEquivalentTargets,
    cacheStats: getCacheStats,
    createDefaultEquivalentTargets,
    findDetailedHintPieceId,
  };
}());
