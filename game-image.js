(function () {
  function getFallbackImageUrl() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#8edcff"/>
            <stop offset="1" stop-color="#dff7ff"/>
          </linearGradient>
          <linearGradient id="yard" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#8ed866"/>
            <stop offset="1" stop-color="#54b86e"/>
          </linearGradient>
        </defs>
        <rect width="600" height="420" rx="24" fill="url(#sky)"/>
        <circle cx="506" cy="78" r="43" fill="#ffd958"/>
        <path d="M0 285 C82 249 168 276 246 268 C342 258 408 218 600 242 V420 H0 Z" fill="url(#yard)"/>
        <g transform="translate(66 139)">
          <rect x="2" y="69" width="170" height="122" rx="18" fill="#ffd37a" stroke="#5c4333" stroke-width="9"/>
          <path d="M-15 78 L86 0 L190 78 Z" fill="#ef6f63" stroke="#5c4333" stroke-width="9" stroke-linejoin="round"/>
          <rect x="28" y="114" width="44" height="77" rx="14" fill="#66b9e8" stroke="#5c4333" stroke-width="8"/>
          <rect x="102" y="108" width="41" height="35" rx="9" fill="#fff7df" stroke="#5c4333" stroke-width="7"/>
        </g>
        <g transform="translate(354 129)">
          <ellipse cx="73" cy="128" rx="72" ry="56" fill="#f0a25e" stroke="#5c4333" stroke-width="9"/>
          <circle cx="68" cy="66" r="56" fill="#ffbd79" stroke="#5c4333" stroke-width="9"/>
          <path d="M26 29 L12 -9 L56 11 Z" fill="#ffbd79" stroke="#5c4333" stroke-width="8" stroke-linejoin="round"/>
          <path d="M109 29 L126 -9 L84 11 Z" fill="#ffbd79" stroke="#5c4333" stroke-width="8" stroke-linejoin="round"/>
          <circle cx="48" cy="61" r="7" fill="#302820"/>
          <circle cx="88" cy="61" r="7" fill="#302820"/>
          <ellipse cx="69" cy="82" rx="15" ry="10" fill="#5c4333"/>
          <path d="M51 99 Q69 114 90 99" fill="none" stroke="#5c4333" stroke-width="7" stroke-linecap="round"/>
        </g>
        <g transform="translate(113 284)">
          <ellipse cx="58" cy="45" rx="58" ry="36" fill="#63b8e8" stroke="#254f73" stroke-width="8"/>
          <circle cx="45" cy="30" r="33" fill="#85d2fb" stroke="#254f73" stroke-width="8"/>
          <circle cx="33" cy="29" r="5" fill="#1d405c"/>
          <circle cx="56" cy="29" r="5" fill="#1d405c"/>
          <path d="M36 44 Q46 52 59 44" fill="none" stroke="#1d405c" stroke-width="5" stroke-linecap="round"/>
        </g>
        <g transform="translate(416 300)">
          <circle cx="35" cy="34" r="23" fill="#ff7777" stroke="#5c4333" stroke-width="7"/>
          <path d="M19 18 l32 32 M51 18 L19 50" stroke="#fff7df" stroke-width="6" stroke-linecap="round"/>
          <rect x="65" y="16" width="72" height="38" rx="19" fill="#58c87a" stroke="#356c3d" stroke-width="7"/>
        </g>
      </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function loadImageSize(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({
        width: image.naturalWidth || 600,
        height: image.naturalHeight || 420,
      });
      image.onerror = () => resolve({ width: 600, height: 420 });
      image.src = url;
    });
  }

  window.PuppyJigsawImage = {
    getFallbackImageUrl,
    loadImageSize,
  };
}());
