import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

const publicDir = path.resolve(__dirname, "../../public");

/** PNG 파일 머리말에서 가로·세로 크기를 읽는다. */
function pngSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe("manifest", () => {
  const m = manifest();
  it("설치에 필요한 필수 항목이 있다", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBe("몽몽");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.lang).toBe("ko");
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("아이콘 파일이 실제로 있고 선언한 크기와 같다", () => {
    expect(m.icons?.length).toBeGreaterThanOrEqual(3);
    for (const icon of m.icons ?? []) {
      const file = path.join(publicDir, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = (icon.sizes ?? "").split("x").map(Number);
      expect(pngSize(file), icon.src).toEqual({ width: w, height: h });
    }
  });
  it("192 와 512 크기의 일반 아이콘, 512 마스커블 아이콘을 갖춘다", () => {
    const has = (size: string, purpose: string) => m.icons?.some((i) => i.sizes === size && i.purpose === purpose);
    expect(has("192x192", "any")).toBe(true);
    expect(has("512x512", "any")).toBe(true);
    expect(has("512x512", "maskable")).toBe(true);
  });
  it("바로가기의 주소는 앱 안의 경로다", () => {
    for (const s of m.shortcuts ?? []) expect(s.url.startsWith("/")).toBe(true);
  });
  it("애플 아이콘과 기본 아이콘 파일이 있다", () => {
    expect(pngSize(path.resolve(__dirname, "apple-icon.png"))).toEqual({ width: 180, height: 180 });
    expect(pngSize(path.resolve(__dirname, "icon.png"))).toEqual({ width: 512, height: 512 });
  });
});
