// 로컬 테스트용 서버: index.html을 보여 주고 /api/contact를 Vercel 함수처럼 실행한다. (npm run dev)
// 저장소 루트의 .env(또는 이 폴더의 .env)를 읽는다. 이미 설정된 환경변수는 덮어쓰지 않는다.
const fs = require('fs');
const path = require('path');
const http = require('http');

for (const f of [path.join(__dirname, '.env'), path.join(__dirname, '..', '..', '.env')]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined && m[2] !== '') process.env[m[1]] = m[2];
  }
}

const contact = require('./api/contact.js');
const port = Number(process.env.PORT) || 3000;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/contact') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if ((req.headers['content-type'] || '').includes('application/json') && raw) {
        try { req.body = JSON.parse(raw); } catch { req.body = undefined; }
      }
      contact(req, res);
    });
    return;
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }
  res.statusCode = 404; res.end('Not found');
}).listen(port, () => console.log(`http://localhost:${port}`));
