import { vi } from "vitest";

export interface Call {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: [string, unknown][];
}
type Result = { data: unknown; error: { code?: string; message?: string; status?: number } | null };
type Script = Record<string, Result | ((call: Call) => Result)>;

/** 테스트용 가짜 Supabase 클라이언트. 호출을 기록하고, `표.동작` 키로 정해 둔 결과를 돌려준다. */
export function fakeSupabase(script: Script = {}) {
  const calls: Call[] = [];
  const storageRemove = vi.fn(async () => ({ data: null, error: null }));

  class Query {
    private call: Call;
    constructor(table: string) {
      this.call = { table, op: "select", filters: [] };
    }
    select() { return this; }
    insert(payload: unknown) { this.call.op = "insert"; this.call.payload = payload; return this; }
    update(payload: unknown) { this.call.op = "update"; this.call.payload = payload; return this; }
    delete() { this.call.op = "delete"; return this; }
    eq(col: string, value: unknown) { this.call.filters.push([col, value]); return this; }
    order() { return this; }
    limit() { return this; }
    maybeSingle() { return this.run(); }
    single() { return this.run(); }
    then<T>(onOk: (r: Result) => T, onErr?: (e: unknown) => T) { return this.run().then(onOk, onErr); }
    private run(): Promise<Result> {
      calls.push({ ...this.call, filters: [...this.call.filters] });
      const r = script[`${this.call.table}.${this.call.op}`];
      return Promise.resolve(typeof r === "function" ? r(this.call) : (r ?? { data: null, error: null }));
    }
  }

  const client = {
    from: (table: string) => new Query(table),
    auth: {
      getUser: vi.fn(),
      signInWithOtp: vi.fn(async () => ({ data: {}, error: null as null | { message: string; status?: number } })),
      signOut: vi.fn(async () => ({ error: null })),
      exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null as null | { message: string } })),
    },
    storage: { from: vi.fn(() => ({ remove: storageRemove })) },
  };
  return { client, calls, storageRemove };
}
