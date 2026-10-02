// Локальный сервер для просмотра лендинга: node serve.js → http://localhost:8000/
// Отдаёт файлы параллельно и видео по частям (Range), поэтому тяжёлые ролики не блокируют картинки.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = 8000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

const handler = (req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return; }
    const headers = {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };
    let start = 0;
    let end = st.size - 1;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      if (m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], end); }
      else start = Math.max(0, st.size - +m[2]);
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
      res.writeHead(206, { ...headers, 'Content-Length': end - start + 1 });
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
    }
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy()); // браузер оборвал загрузку — файл больше не читаем
    stream.pipe(res);
  });
};

// только для этого компьютера (без доступа из сети), на IPv4 и IPv6 — чтобы «localhost» открывался всегда
for (const host of ['127.0.0.1', '::1']) {
  const server = http.createServer(handler);
  server.on('error', (e) => { if (host === '127.0.0.1') { console.error(e.message); process.exit(1); } });
  server.listen(port, host);
}
console.log(`Сайт: http://localhost:${port}/`);
