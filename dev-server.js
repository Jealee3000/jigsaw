const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const imagesDir = path.join(root, 'images');
const port = Number(process.env.PORT || 4173);
const maxUploadBytes = 10 * 1024 * 1024;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

fs.mkdirSync(imagesDir, { recursive: true });

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), types['.json']);
}

function sanitizeFileName(name) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext)
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'image';
  return `${base}${ext}`;
}

function uniqueImagePath(fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let candidate = fileName;
  let index = 1;

  while (fs.existsSync(path.join(imagesDir, candidate))) {
    candidate = `${base}-${index}${ext}`;
    index += 1;
  }

  return {
    fileName: candidate,
    filePath: path.join(imagesDir, candidate),
  };
}

function isSupportedImage(fileName, contentType) {
  const ext = path.extname(fileName).toLowerCase();
  return Boolean(types[ext]?.startsWith('image/') && contentType.startsWith('image/'));
}

function listImages() {
  return fs.readdirSync(imagesDir)
    .filter((fileName) => fileName !== '.gitkeep')
    .filter((fileName) => types[path.extname(fileName).toLowerCase()]?.startsWith('image/'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((fileName) => ({
      name: fileName,
      url: `/images/${encodeURIComponent(fileName)}`,
    }));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxUploadBytes) {
        reject(new Error('UPLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipartImage(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error('MISSING_BOUNDARY');
  }

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  let cursor = 0;

  while (cursor < body.length) {
    const boundaryStart = body.indexOf(boundary, cursor);
    if (boundaryStart === -1) break;
    const headerStart = boundaryStart + boundary.length + 2;
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;

    const headers = body.slice(headerStart, headerEnd).toString('utf8');
    const nextBoundary = body.indexOf(boundary, headerEnd + 4);
    if (nextBoundary === -1) break;

    const dataEnd = nextBoundary - 2;
    const data = body.slice(headerEnd + 4, Math.max(headerEnd + 4, dataEnd));
    const disposition = headers.match(/content-disposition:[^\r\n]+/i)?.[0] || '';
    const fileName = disposition.match(/filename="([^"]+)"/i)?.[1];
    const partType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || '';

    if (fileName) {
      return {
        fileName,
        contentType: partType,
        data,
      };
    }

    cursor = nextBoundary;
  }

  throw new Error('NO_FILE');
}

async function handleImageUpload(req, res) {
  try {
    const contentType = req.headers['content-type'] || '';
    const body = await collectBody(req);
    const upload = parseMultipartImage(body, contentType);
    const cleanName = sanitizeFileName(upload.fileName);

    if (!isSupportedImage(cleanName, upload.contentType)) {
      sendJson(res, 400, { error: '请选择图片文件' });
      return;
    }

    const { fileName, filePath } = uniqueImagePath(cleanName);
    fs.writeFileSync(filePath, upload.data);
    sendJson(res, 201, {
      image: {
        name: fileName,
        url: `/images/${encodeURIComponent(fileName)}`,
      },
      images: listImages(),
    });
  } catch (error) {
    if (error.message === 'UPLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: '图片不能超过 10MB' });
      return;
    }
    sendJson(res, 400, { error: '上传失败，请换一张图片' });
  }
}

function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, requested));
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, 'Not found');
      return;
    }

    send(res, 200, data, types[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/favicon.ico') {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/images') {
    sendJson(res, 200, { images: listImages() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/images') {
    handleImageUpload(req, res);
    return;
  }

  serveStatic(req, res, url);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`http://localhost:${port}`);
});
