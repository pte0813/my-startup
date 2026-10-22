// 로컬 실행: node outputs/homepage/dev.js  → http://localhost:3000
// 저장소 루트의 .env를 읽어 환경변수로 쓰고, 정적 파일과 /api/* 를 함께 제공한다.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
process.env.TEST_RECIPIENT ??= 'pte0813@gmail.com';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
  if (api && fs.existsSync(path.join(__dirname, 'api', api[1] + '.js'))) return require('./api/' + api[1] + '.js')(req, res);
  const file = path.join(__dirname, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(3000, () => console.log('http://localhost:3000'));
