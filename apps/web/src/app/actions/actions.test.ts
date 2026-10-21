import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";
import type { Session } from "@/lib/auth";

// ---- 의존 모듈을 가짜로 바꾼다 ----
const state = { supabase: fakeSupabase(), session: null as Session | null };
const updateTag = vi.fn();
const refresh = vi.fn();

vi.mock("next/cache", () => ({ updateTag: (t: string) => updateTag(t), refresh: () => refresh(), cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3000" }), cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.supabase.client }));
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getSession: async () => state.session }));
vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), isSupabaseConfigured: () => true }));

const editor: Session = { userId: "11111111-1111-1111-1111-111111111111", email: "e@x.com", role: "editor", displayName: "에디터" };
const member: Session = { ...editor, role: "member" };
const admin: Session = { ...editor, role: "admin" };

const form = (o: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
};
const redirectOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    const m = /^NEXT_REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
  return null;
};
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

beforeEach(() => {
  state.supabase = fakeSupabase();
  state.session = null;
  updateTag.mockClear();
  refresh.mockClear();
});

describe("createReview", () => {
  const good = { rating: "4", visitedOn: today, waitMinutes: "20", body: "국물이 진해요", tip: "평일 17시", sponsored: "on" };

  it("로그인하지 않으면 저장하지 않는다", async () => {
    const { createReview } = await import("./reviews");
    const r = await createReview(1, {}, form(good));
    expect(r.error).toMatch(/로그인/);
    expect(state.supabase.calls).toHaveLength(0);
  });
  it("회원(에디터가 아님)은 저장하지 못한다", async () => {
    state.session = member;
    const { createReview } = await import("./reviews");
    const r = await createReview(1, {}, form(good));
    expect(r.error).toMatch(/에디터만/);
    expect(state.supabase.calls).toHaveLength(0);
  });
  it("검증에 실패하면 입력값을 돌려주고 저장하지 않는다", async () => {
    state.session = editor;
    const { createReview } = await import("./reviews");
    const r = await createReview(1, {}, form({ ...good, rating: "0" }));
    expect(r.error).toMatch(/별점/);
    expect(r.values?.body).toBe("국물이 진해요");
    expect(state.supabase.calls).toHaveLength(0);
  });
  it("잘못된 가게 번호는 거절한다", async () => {
    state.session = editor;
    const { createReview } = await import("./reviews");
    expect((await createReview(0, {}, form(good))).error).toMatch(/가게/);
    expect((await createReview(Number.NaN, {}, form(good))).error).toMatch(/가게/);
  });
  it("에디터가 저장하면 작성자는 세션의 사용자이고, 캐시를 갱신하고 상세로 이동한다", async () => {
    state.session = editor;
    const { createReview } = await import("./reviews");
    const to = await redirectOf(createReview(7, {}, form({ ...good, authorId: "해커가-보낸-값" })));
    expect(to).toBe("/places/7");
    expect(updateTag).toHaveBeenCalledWith("catalog");
    expect(state.supabase.calls).toEqual([
      { table: "reviews", op: "insert", filters: [], payload: { place_id: 7, author_id: editor.userId, rating: 4, visited_on: today, wait_minutes: 20, body: "국물이 진해요", tip: "평일 17시", sponsored: true } },
    ]);
  });
  it("협찬을 체크하지 않으면 sponsored 는 false", async () => {
    state.session = admin;
    const { createReview } = await import("./reviews");
    await redirectOf(createReview(7, {}, form({ rating: "5", visitedOn: today, waitMinutes: "", body: "좋아요" })));
    expect(state.supabase.calls[0].payload).toMatchObject({ sponsored: false, wait_minutes: null, tip: null });
  });
  it("DB 가 거절하면 안내 문구를 돌려주고 캐시는 건드리지 않는다", async () => {
    state.session = editor;
    state.supabase = fakeSupabase({ "reviews.insert": { data: null, error: { code: "42501", message: "new row violates row-level security policy" } } });
    const { createReview } = await import("./reviews");
    const r = await createReview(7, {}, form(good));
    expect(r.error).toMatch(/권한/);
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("deleteReview", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("회원은 지울 수 없다", async () => {
    state.session = member;
    const { deleteReview } = await import("./reviews");
    expect((await deleteReview(id, 1)).error).toMatch(/권한/);
    expect(state.supabase.calls).toHaveLength(0);
  });
  it("형식이 다른 id 는 거절한다", async () => {
    state.session = editor;
    const { deleteReview } = await import("./reviews");
    expect((await deleteReview("1 or 1=1", 1)).error).toMatch(/찾을 수 없습니다/);
  });
  it("DB 가 0건을 지웠으면(남의 후기) 오류로 알린다", async () => {
    state.session = editor;
    state.supabase = fakeSupabase({ "reviews.delete": { data: [], error: null } });
    const { deleteReview } = await import("./reviews");
    expect((await deleteReview(id, 1)).error).toMatch(/본인이 쓴 후기/);
    expect(updateTag).not.toHaveBeenCalled();
  });
  it("지우면 캐시를 갱신하고 상세로 이동한다", async () => {
    state.session = editor;
    state.supabase = fakeSupabase({ "reviews.delete": { data: [{ id }], error: null } });
    const { deleteReview } = await import("./reviews");
    expect(await redirectOf(deleteReview(id, 3))).toBe("/places/3");
    expect(state.supabase.calls[0].filters).toEqual([["id", id]]);
    expect(updateTag).toHaveBeenCalledWith("catalog");
  });
});

describe("savePlace", () => {
  const good = { areaSlug: "seongsu", name: " 새 가게 ", category: "파스타", situations: ["데이트", "혼밥"], summary: "소개", waitTip: "", reservationTip: "", address: "성수동" };
  it("에디터가 아니면 저장하지 못한다", async () => {
    state.session = member;
    const { savePlace } = await import("./places");
    expect((await savePlace(null, {}, form(good))).error).toMatch(/에디터만/);
    expect(state.supabase.calls).toHaveLength(0);
  });
  it("검증에 실패하면 저장하지 않는다", async () => {
    state.session = editor;
    const { savePlace } = await import("./places");
    expect((await savePlace(null, {}, form({ ...good, name: "" }))).error).toMatch(/가게 이름/);
    expect((await savePlace(null, {}, form({ ...good, areaSlug: "없는동네" }))).error).toMatch(/동네/);
    expect((await savePlace(null, {}, form({ ...good, situations: [] }))).error).toMatch(/상황/);
    expect(state.supabase.calls).toHaveLength(0);
  });
  it("새 가게는 작성자와 마지막 순서 다음 번호로 저장하고 상세로 이동한다", async () => {
    state.session = editor;
    state.supabase = fakeSupabase({ "places.select": { data: { sort_order: 201 }, error: null }, "places.insert": { data: { id: 202 }, error: null } });
    const { savePlace } = await import("./places");
    expect(await redirectOf(savePlace(null, {}, form(good)))).toBe("/places/202");
    const insert = state.supabase.calls.find((c) => c.op === "insert");
    expect(insert?.payload).toEqual({
      area_slug: "seongsu", name: "새 가게", category: "파스타", situations: ["데이트", "혼밥"], summary: "소개",
      wait_tip: null, reservation_tip: null, address: "성수동", created_by: editor.userId, sort_order: 202,
    });
    expect(updateTag).toHaveBeenCalledWith("catalog");
  });
  it("같은 이름이 있으면 중복 안내를 한다", async () => {
    state.session = editor;
    state.supabase = fakeSupabase({ "places.insert": { data: null, error: { code: "23505", message: "duplicate" } } });
    const { savePlace } = await import("./places");
    expect((await savePlace(null, {}, form(good))).error).toMatch(/이미 있습니다/);
  });
  it("수정은 해당 가게만 고치고, 고칠 행이 없으면 오류", async () => {
    state.session = editor;
    state.supabase = fakeSupabase({ "places.update": { data: [{ id: 5 }], error: null } });
    const { savePlace } = await import("./places");
    expect(await redirectOf(savePlace(5, {}, form(good)))).toBe("/places/5");
    const upd = state.supabase.calls.find((c) => c.op === "update");
    expect(upd?.filters).toEqual([["id", 5]]);
    expect(upd?.payload).not.toHaveProperty("created_by");

    state.supabase = fakeSupabase({ "places.update": { data: [], error: null } });
    expect((await savePlace(5, {}, form(good))).error).toMatch(/수정할 수 없는/);
  });
});

describe("사진 연결", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  it("다른 가게 폴더나 이상한 경로는 거절한다", async () => {
    state.session = editor;
    const { setPlacePhoto } = await import("./places");
    for (const p of [`8/${uuid}.jpg`, `5/../9/${uuid}.jpg`, `5/${uuid}.png`, "5/a.jpg", `https://evil.com/5/${uuid}.jpg`]) {
      expect((await setPlacePhoto(5, p)).error).toMatch(/경로/);
    }
    expect(state.supabase.calls).toHaveLength(0);
  });
  it("회원은 연결할 수 없다", async () => {
    state.session = member;
    const { setPlacePhoto } = await import("./places");
    expect((await setPlacePhoto(5, `5/${uuid}.jpg`)).error).toMatch(/에디터만/);
  });
  it("연결하면 이전 사진을 저장소에서 지우고 캐시를 갱신한다", async () => {
    state.session = editor;
    state.supabase = fakeSupabase({ "places.select": { data: { photo_path: `5/old-photo.jpg` }, error: null }, "places.update": { data: [{ id: 5 }], error: null } });
    const { setPlacePhoto } = await import("./places");
    expect((await setPlacePhoto(5, `5/${uuid}.jpg`)).message).toMatch(/등록/);
    expect(state.supabase.calls.find((c) => c.op === "update")?.payload).toEqual({ photo_path: `5/${uuid}.jpg` });
    expect(state.supabase.storageRemove).toHaveBeenCalledWith(["5/old-photo.jpg"]);
    expect(updateTag).toHaveBeenCalledWith("catalog");
  });
  it("사진을 지우면 경로를 비우고 파일도 지운다", async () => {
    state.session = admin;
    state.supabase = fakeSupabase({ "places.select": { data: { photo_path: "5/x.jpg" }, error: null }, "places.update": { data: [{ id: 5 }], error: null } });
    const { removePlacePhoto } = await import("./places");
    expect((await removePlacePhoto(5)).message).toMatch(/지웠/);
    expect(state.supabase.calls.find((c) => c.op === "update")?.payload).toEqual({ photo_path: null });
    expect(state.supabase.storageRemove).toHaveBeenCalledWith(["5/x.jpg"]);
  });
});

describe("toggleSave", () => {
  it("로그인하지 않으면 거절한다", async () => {
    const { toggleSave } = await import("./saves");
    expect((await toggleSave(1)).error).toMatch(/로그인/);
  });
  it("찜이 없으면 추가한다", async () => {
    state.session = member;
    state.supabase = fakeSupabase({ "saves.select": { data: null, error: null } });
    const { toggleSave } = await import("./saves");
    expect((await toggleSave(3)).message).toBe("찜했습니다.");
    expect(state.supabase.calls.find((c) => c.op === "insert")?.payload).toEqual({ user_id: member.userId, place_id: 3 });
    expect(refresh).toHaveBeenCalled();
  });
  it("찜이 있으면 해제하고, 항상 본인 것만 건드린다", async () => {
    state.session = member;
    state.supabase = fakeSupabase({ "saves.select": { data: { place_id: 3 }, error: null } });
    const { toggleSave } = await import("./saves");
    expect((await toggleSave(3)).message).toBe("찜을 해제했습니다.");
    expect(state.supabase.calls.find((c) => c.op === "delete")?.filters).toEqual([["user_id", member.userId], ["place_id", 3]]);
  });
  it("잘못된 번호는 거절한다", async () => {
    state.session = member;
    const { toggleSave } = await import("./saves");
    expect((await toggleSave(-1)).error).toMatch(/가게/);
    expect(state.supabase.calls).toHaveLength(0);
  });
});

describe("로그인 메일", () => {
  it("이메일 형식을 검사한다", async () => {
    const { sendMagicLink } = await import("./auth");
    expect((await sendMagicLink({}, form({ email: "abc" }))).error).toMatch(/이메일/);
    expect(state.supabase.client.auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it("메일을 보내고, 돌아올 주소는 같은 사이트의 경로로만 만든다", async () => {
    const { sendMagicLink } = await import("./auth");
    const r = await sendMagicLink({}, form({ email: " User@Example.com ", next: "//evil.com" }));
    expect(r.message).toMatch(/user@example.com/);
    expect(state.supabase.client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fme" },
    });
  });
  it("보내기 한도를 넘으면 기다리라고 안내한다", async () => {
    state.supabase.client.auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: { message: "email rate limit exceeded", status: 429 } });
    const { sendMagicLink } = await import("./auth");
    expect((await sendMagicLink({}, form({ email: "a@b.co" }))).error).toMatch(/잠시 뒤/);
  });
  it("로그아웃하면 세션을 지우고 홈으로 간다", async () => {
    const { signOut } = await import("./auth");
    expect(await redirectOf(signOut())).toBe("/");
    expect(state.supabase.client.auth.signOut).toHaveBeenCalled();
  });
});
