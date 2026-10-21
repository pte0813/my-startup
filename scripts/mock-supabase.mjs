// 시험용 가짜 Supabase 서버: 인증(/auth/v1), 데이터(/rest/v1), 저장소(/storage/v1)의 일부만 흉내 낸다.
// 실제 접근 규칙(RLS)은 `scripts/test-db.sh` 가 검증하고, 이 서버는 앱 코드가 API 와 제대로 맞물리는지 보는 용도다.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

export const USERS = {
  editor: { id: "00000000-0000-0000-0000-0000000000e1", email: "editor@example.com", role: "editor", display_name: "에디터A" },
  member: { id: "00000000-0000-0000-0000-0000000000b1", email: "member@example.com", role: "member", display_name: "회원B" },
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
/** 시험용 로그인 쿠키 값. 형식은 @supabase/ssr 이 저장하는 방식과 같다. */
export function sessionCookie(userKey, port) {
  const u = USERS[userKey];
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
  const session = {
    access_token: jwt, refresh_token: "refresh-" + userKey, token_type: "bearer", expires_in: 86400, expires_at: exp,
    user: { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
  return { name: "sb-localhost-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url: `http://localhost:${port}` };
}

export function startMockSupabase(port = 54399) {
  const seed = JSON.parse(readFileSync(new URL("../supabase/seed/places.json", import.meta.url), "utf8"));
  const db = {
    places: seed.map((p) => ({
      id: p.id, area_slug: p.areaSlug, name: p.name, category: p.category, situations: p.situations, summary: p.summary,
      wait_tip: p.waitTip, reservation_tip: p.reservationTip, address: p.address, photo_path: null, status: "published", sort_order: p.sortOrder,
    })),
    reviews: [], saves: [],
    profiles: Object.values(USERS).map((u) => ({ id: u.id, role: u.role, display_name: u.display_name })),
  };
  const log = [];
  let nextPlaceId = Math.max(...db.places.map((p) => p.id)) + 1;

  const send = (res, status, body, headers = {}) => {
    const text = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", ...headers });
    res.end(text);
  };
  const readBody = (req) => new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d)); });
  const userFromAuth = (req) => {
    const t = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    try {
      const payload = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
      return Object.values(USERS).find((u) => u.id === payload.sub) ?? null;
    } catch { return null; }
  };
  const roleOf = (u) => (u ? db.profiles.find((p) => p.id === u.id)?.role : null);
  const isEditor = (u) => ["editor", "admin"].includes(roleOf(u));
  const match = (row, params) => {
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset"].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v);
      if (m && String(row[k]) !== m[1]) return false;
    }
    return true;
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "OPTIONS") return send(res, 204);
    const raw = await readBody(req);
    const user = userFromAuth(req);
    log.push(`${req.method} ${url.pathname}${url.search}${raw && url.pathname.startsWith("/rest") ? " " + raw.slice(0, 300) : ""}`);

    if (url.pathname === "/__log") return send(res, 200, log);
    if (url.pathname === "/auth/v1/user") return user ? send(res, 200, { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" }) : send(res, 401, { code: 401, msg: "invalid JWT" });
    if (url.pathname === "/auth/v1/otp") return send(res, 200, {});
    if (url.pathname === "/auth/v1/logout") return send(res, 204);

    const rest = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
    if (rest) {
      const table = rest[1];
      const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      const wantsRows = (req.headers.prefer ?? "").includes("return=representation");
      const respond = (rows, status = 200) => {
        if (wantsObject) return rows.length === 1 ? send(res, status, rows[0]) : send(res, 406, { code: "PGRST116", details: `The result contains ${rows.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" });
        return send(res, status, rows);
      };
      if (table === "author_names") return send(res, 200, db.profiles.filter((p) => ["editor", "admin"].includes(p.role)).map((p) => ({ id: p.id, display_name: p.display_name })));
      const rows = db[table];
      if (!rows) return send(res, 404, { message: "no table" });

      if (req.method === "GET") {
        let out = rows.filter((r) => match(r, url.searchParams));
        if (table === "profiles") out = out.filter((r) => user && r.id === user.id);
        if (table === "saves") out = out.filter((r) => user && r.user_id === user.id);
        const order = url.searchParams.get("order");
        if (order) { const [c, d] = order.split("."); out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (d === "desc" ? -1 : 1)); }
        const lim = url.searchParams.get("limit");
        if (lim) out = out.slice(0, Number(lim));
        return respond(out);
      }
      const body = raw ? JSON.parse(raw) : {};
      if (req.method === "POST") {
        const needsEditor = table === "places" || table === "reviews";
        if (needsEditor && !isEditor(user)) return send(res, 403, { code: "42501", message: "new row violates row-level security policy" });
        if (table === "saves" && (!user || body.user_id !== user.id)) return send(res, 403, { code: "42501", message: "new row violates row-level security policy" });
        if (table === "reviews" && body.author_id !== user.id) return send(res, 403, { code: "42501", message: "new row violates row-level security policy" });
        const row = { ...body };
        if (table === "places") {
          if (db.places.some((p) => p.area_slug === row.area_slug && p.name === row.name)) return send(res, 409, { code: "23505", message: "duplicate key value violates unique constraint" });
          Object.assign(row, { id: nextPlaceId++, photo_path: null, status: "published" });
        }
        if (table === "reviews") Object.assign(row, { id: randomUUID(), created_at: new Date().toISOString() });
        rows.push(row);
        return wantsRows ? respond([row], 201) : send(res, 201);
      }
      const targets = rows.filter((r) => match(r, url.searchParams));
      if (req.method === "PATCH") {
        if (table === "places" && !isEditor(user)) return respond([]);
        targets.forEach((r) => Object.assign(r, body));
        return wantsRows ? respond(targets) : send(res, 204);
      }
      if (req.method === "DELETE") {
        const allowed = targets.filter((r) => (table === "reviews" ? isEditor(user) && r.author_id === user.id : table === "saves" ? user && r.user_id === user.id : false));
        allowed.forEach((r) => rows.splice(rows.indexOf(r), 1));
        return wantsRows ? respond(allowed) : send(res, 204);
      }
    }

    if (url.pathname.startsWith("/storage/v1/object/place-photos")) {
      if (req.method === "POST") return isEditor(user) ? send(res, 200, { Key: url.pathname.replace("/storage/v1/object/", ""), Id: randomUUID() }) : send(res, 403, { message: "not allowed" });
      if (req.method === "DELETE") return send(res, 200, []);
    }
    if (url.pathname.startsWith("/storage/v1/object/public/place-photos")) {
      res.writeHead(200, { "content-type": "image/gif", "access-control-allow-origin": "*" });
      return res.end(Buffer.from("R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=", "base64"));
    }
    send(res, 404, { message: `mock: ${req.method} ${url.pathname}` });
  });
  return new Promise((ok) => server.listen(port, () => ok({ server, db, log, port, close: () => server.close() })));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const m = await startMockSupabase(Number(process.env.PORT ?? 54399));
  console.log(`가짜 Supabase 가 ${m.port} 에서 실행 중`);
}
