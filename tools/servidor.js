const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado: ' + reqPath);
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
    res.writeHead(403);
    res.end('Acesso negado');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n=================================================`);
  console.log(`  ☕ Brewer rodando localmente!`);
  console.log(`  Acesse no seu navegador: http://localhost:${PORT}/index.html`);
  console.log(`  Pressione Ctrl+C para encerrar o servidor`);
  console.log(`=================================================\n`);
});
