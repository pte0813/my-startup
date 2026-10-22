// Vercel 빌드 때 실행: 환경변수(SUPABASE_URL, SUPABASE_ANON_KEY)로 config.js를 만든다.
// config.js에는 공개용 anon 키만 들어가며, 저장소에는 올리지 않는다(.gitignore).
const fs = require('fs');
const url = process.env.SUPABASE_URL, anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('SUPABASE_URL, SUPABASE_ANON_KEY 환경변수가 필요해요 (Vercel → Settings → Environment Variables).');
  process.exit(1);
}
fs.writeFileSync(__dirname + '/config.js', 'window.APP_CONFIG = ' + JSON.stringify({ url, anonKey }) + ';\n');
console.log('config.js 생성 완료');
