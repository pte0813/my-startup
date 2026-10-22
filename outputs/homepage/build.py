"""brand.json에서 brand.css를 만든다. 사용법: python3 outputs/homepage/build.py"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = Path(__file__).resolve().parent
c = json.loads((root / "brand/brand.json").read_text(encoding="utf-8"))["colors"]
(out / "brand.css").write_text(
    ":root {\n"
    f"  --primary: {c['primary']['hex']};\n"
    f"  --secondary: {c['secondary']['hex']};\n"
    f"  --accent: {c['accent']['hex']};\n"
    "}\n",
    encoding="utf-8",
)
print("brand.css 생성 완료")

# .env의 공개용 키로 config.js 생성 (anon 키만 사용)
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
(out / "config.js").write_text(
    "window.APP_CONFIG = " + json.dumps({"url": env["SUPABASE_URL"], "anonKey": env["SUPABASE_ANON_KEY"]}, ensure_ascii=False) + ";\n",
    encoding="utf-8",
)
print("config.js 생성 완료")
