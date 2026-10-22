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
