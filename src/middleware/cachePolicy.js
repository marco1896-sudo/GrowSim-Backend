import path from 'path';

const LONG_CACHEABLE_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.mjs',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map'
]);

function hasVersionQuery(req) {
  const version = req.query?.v;

  if (Array.isArray(version)) {
    return version.some((entry) => String(entry).trim().length > 0);
  }

  return String(version ?? '').trim().length > 0;
}

function normalizePathname(pathname) {
  return String(pathname || '/').toLowerCase();
}

export function applyPwaEntryCachePolicy(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  const pathname = normalizePathname(req.path);

  if (pathname === '/sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
    return;
  }

  if (pathname === '/index.html' || pathname === '/manifest.webmanifest') {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    next();
    return;
  }

  if (pathname.endsWith('.html') && !pathname.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    next();
    return;
  }

  next();
}

export function applyStaticCachePolicy(res, servedFilePath) {
  const req = res.req;
  if (!req) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') return;

  const requestPath = normalizePathname(req.path);
  const fileName = path.basename(servedFilePath).toLowerCase();
  const extension = path.extname(servedFilePath).toLowerCase();

  if (requestPath === '/sw.js' || fileName === 'sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return;
  }

  if (requestPath === '/index.html' || fileName === 'index.html') {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return;
  }

  if (requestPath === '/manifest.webmanifest' || fileName === 'manifest.webmanifest') {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return;
  }

  if (fileName === 'favicon.ico') {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    return;
  }

  if (fileName.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return;
  }

  if (hasVersionQuery(req) && LONG_CACHEABLE_EXTENSIONS.has(extension)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }

  if (LONG_CACHEABLE_EXTENSIONS.has(extension)) {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
}
