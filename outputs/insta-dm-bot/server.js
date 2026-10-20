// 인스타 댓글 → 팔로우 확인 → 자동 DM 서버 (의존성 없음, Node 20+)
// 실행: node --env-file=.env server.js
import http from 'node:http';
import crypto from 'node:crypto';

const {
  PORT = 3000,
  VERIFY_TOKEN,
  APP_SECRET,
  ACCESS_TOKEN,
  IG_USER_ID,
  KEYWORD = '정보',
  TARGET_MEDIA_ID = '', // 비우면 모든 게시물의 댓글에 반응
  API_VERSION = 'v23.0',
  DRY_RUN = '', // 값이 있으면 실제 발송 대신 콘솔에만 출력
} = process.env;

const GRAPH = `https://graph.instagram.com/${API_VERSION}`;

const MSG = {
  ask: '댓글 감사합니다! 🙌 계정을 팔로우하신 뒤 아래 버튼을 눌러주세요.',
  button: '팔로우 했어요',
  notYet: '아직 팔로우가 확인되지 않았어요 😢 팔로우 후 버튼을 다시 눌러주세요.',
  info: process.env.INFO_TEXT || '여기에 보내줄 상세 내용을 적어주세요.',
};

const handledComments = new Set(); // 같은 댓글에 중복 발송 방지 (재시작하면 초기화됨)

async function callApi(path, { method = 'GET', body } = {}) {
  if (DRY_RUN) {
    console.log('[DRY_RUN]', method, path, body ? JSON.stringify(body) : '');
    return { is_user_follow_business: process.env.DRY_FOLLOW === '1' };
  }
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const sendMessage = (recipient, message) =>
  callApi(`/${IG_USER_ID}/messages`, { method: 'POST', body: { recipient, message } });

// 댓글 → 안내 DM + 버튼 (댓글 1개당 Private Reply는 1회만 가능)
async function onComment(c) {
  if (!c.text?.includes(KEYWORD)) return;
  if (TARGET_MEDIA_ID && c.media?.id !== TARGET_MEDIA_ID) return;
  if (c.from?.id === IG_USER_ID) return; // 내 댓글(답글)은 무시
  if (handledComments.has(c.id)) return;
  handledComments.add(c.id);

  await sendMessage({ comment_id: c.id }, {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text: MSG.ask,
        buttons: [{ type: 'postback', title: MSG.button, payload: 'FOLLOWED' }],
      },
    },
  });
}

// 버튼 클릭 → 팔로우 여부 확인 → 상세 DM
async function onPostback(senderId, payload) {
  if (payload !== 'FOLLOWED') return;
  const profile = await callApi(`/${senderId}?fields=is_user_follow_business`);
  const text = profile.is_user_follow_business ? MSG.info : MSG.notYet;
  await sendMessage({ id: senderId }, { text });
}

async function handleWebhook(body) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === 'comments') await onComment(change.value);
    }
    for (const m of entry.messaging ?? []) {
      if (m.postback) await onPostback(m.sender.id, m.postback.payload);
    }
  }
}

function validSignature(raw, header) {
  if (!APP_SECRET) return !!DRY_RUN; // 시크릿이 없으면 DRY_RUN일 때만 통과
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  return header?.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/webhook') { res.writeHead(404).end(); return; }

  // Meta가 웹훅 등록 시 호출하는 인증 요청
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === VERIFY_TOKEN;
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get('hub.challenge') : '');
    return;
  }

  if (req.method === 'POST') {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const raw = Buffer.concat(chunks);
    if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
      res.writeHead(401).end(); return;
    }
    res.writeHead(200).end('ok'); // Meta는 빠른 200 응답을 기대하므로 먼저 응답
    try { await handleWebhook(JSON.parse(raw)); }
    catch (e) { console.error('처리 실패:', e.message); }
    return;
  }
  res.writeHead(405).end();
}).listen(PORT, () => console.log(`웹훅 서버 실행 중: http://localhost:${PORT}/webhook`));
