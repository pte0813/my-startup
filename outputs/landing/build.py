"""brand.json과 .env를 읽어 landing 폴더에 brand.css, config.js, logo.svg를 만든다.
사용법: python3 outputs/landing/build.py"""
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = Path(__file__).resolve().parent

brand = json.loads((root / "brand/brand.json").read_text(encoding="utf-8"))
c = brand["colors"]
(out / "brand.css").write_text(
    ":root {\n"
    f"  --primary: {c['primary']['hex']};\n"
    f"  --secondary: {c['secondary']['hex']};\n"
    f"  --accent: {c['accent']['hex']};\n"
    "}\n",
    encoding="utf-8",
)
shutil.copy(root / "brand/logo.svg", out / "logo.svg")

env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
cfg = {"url": env["SUPABASE_URL"], "anonKey": env["SUPABASE_ANON_KEY"]}
(out / "config.js").write_text(
    "window.APP_CONFIG = " + json.dumps(cfg, ensure_ascii=False) + ";\n", encoding="utf-8"
)
print("brand.css, logo.svg, config.js 생성 완료")
