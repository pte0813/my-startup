import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";

let fake = fakeSupabase();
let configured = true;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake.client }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => configured }));

const user = { id: "u1", email: "a@b.co" };
beforeEach(() => {
  fake = fakeSupabase();
  configured = true;
});

describe("getSession", () => {
  it("Supabase 가 연결되지 않았으면 null", async () => {
    configured = false;
    const { getSession } = await import("./auth");
    expect(await getSession()).toBeNull();
  });
  it("인증 서버가 사용자를 확인하지 못하면 null (위조된 쿠키 방지)", async () => {
    fake.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid jwt" } });
    const { getSession } = await import("./auth");
    expect(await getSession()).toBeNull();
  });
  it("프로필의 역할을 쓴다", async () => {
    fake.client.auth.getUser.mockResolvedValue({ data: { user }, error: null });
    fake = Object.assign(fake, {});
    const f = fakeSupabase({ "profiles.select": { data: { role: "editor", display_name: "에디터" }, error: null } });
    f.client.auth.getUser.mockResolvedValue({ data: { user }, error: null });
    fake = f;
    const { getSession } = await import("./auth");
    expect(await getSession()).toEqual({ userId: "u1", email: "a@b.co", role: "editor", displayName: "에디터" });
  });
  it("프로필이 없거나 알 수 없는 역할이면 회원으로 본다", async () => {
    const f = fakeSupabase({ "profiles.select": { data: { role: "superuser", display_name: null }, error: null } });
    f.client.auth.getUser.mockResolvedValue({ data: { user }, error: null });
    fake = f;
    const { getSession } = await import("./auth");
    expect((await getSession())?.role).toBe("member");
    const g = fakeSupabase({ "profiles.select": { data: null, error: null } });
    g.client.auth.getUser.mockResolvedValue({ data: { user }, error: null });
    fake = g;
    expect((await getSession())?.role).toBe("member");
  });
});
