"""홈페이지를 만든다. 사용법: python3 outputs/homepage/build.py
- brand.json → brand.css, .env → config.js(공개용 anon 키만)
- src/i18n.json → i18n.js
- src/template.html + header/footer + src/pages/*.html → 각 페이지 HTML
- sitemap.xml, robots.txt
"""
import json
from pathlib import Path

SITE_URL = "https://hamkkedat-homepage.vercel.app"  # 공유 미리보기·사이트맵에 쓰는 주소 (도메인이 바뀌면 여기만 고친다)
PAGES = {  # 파일명: 메뉴에서 강조할 그룹
    "index": "about",
    "trips": "trips",
    "reviews": "reviews",
    "community": "community",
    "contact": "contact",
    "privacy": "",
}

root = Path(__file__).resolve().parents[2]
out = Path(__file__).resolve().parent
src = out / "src"

# 1) 브랜드 색
c = json.loads((root / "brand/brand.json").read_text(encoding="utf-8"))["colors"]
(out / "brand.css").write_text(
    ":root {\n"
    f"  --primary: {c['primary']['hex']};\n"
    f"  --secondary: {c['secondary']['hex']};\n"
    f"  --accent: {c['accent']['hex']};\n"
    "}\n",
    encoding="utf-8",
)

# 2) .env의 공개용 키 → config.js
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
(out / "config.js").write_text(
    "window.APP_CONFIG = " + json.dumps({"url": env["SUPABASE_URL"], "anonKey": env["SUPABASE_ANON_KEY"]}, ensure_ascii=False) + ";\n",
    encoding="utf-8",
)

# 3) 번역
i18n = json.loads((src / "i18n.json").read_text(encoding="utf-8"))
(out / "i18n.js").write_text("window.I18N = " + json.dumps(i18n, ensure_ascii=False) + ";\n", encoding="utf-8")

# 3-2) AI 추천용 선택지 (api/도 같은 ai-options.json을 읽는다)
opts = json.loads((out / "ai-options.json").read_text(encoding="utf-8"))
(out / "ai-options.js").write_text("window.AI_OPTIONS = " + json.dumps(opts, ensure_ascii=False) + ";\n", encoding="utf-8")

# 4) 페이지
template = (src / "template.html").read_text(encoding="utf-8")
header = (src / "header.html").read_text(encoding="utf-8")
footer = (src / "footer.html").read_text(encoding="utf-8")
ko = i18n["ko"]
for page, group in PAGES.items():
    h = header
    for g in ("about", "trips", "reviews", "community", "contact"):
        h = h.replace("{{cur_%s}}" % g, " current" if g == group else "")
    body = (src / "pages" / f"{page}.html").read_text(encoding="utf-8").rstrip("\n")
    html = (
        template.replace("{{HEADER}}", h.rstrip("\n"))
        .replace("{{BODY}}", body)
        .replace("{{FOOTER}}", footer.rstrip("\n"))
        .replace("{{TITLE}}", ko[f"t_{page}"])
        .replace("{{DESC}}", ko[f"d_{page}"])
        .replace("{{PAGE}}", page)
        .replace("{{URL}}", SITE_URL + ("/" if page == "index" else f"/{page}.html"))
        .replace("{{OG}}", f"og-{page}.png" if (out / f"og-{page}.png").exists() else "og-image.png")
        .replace("{{SITE_URL}}", SITE_URL)
    )
    (out / f"{page}.html").write_text(html, encoding="utf-8")

# 5) 검색 노출용 파일
urls = "".join(
    f"  <url><loc>{SITE_URL}{'/' if p == 'index' else '/' + p + '.html'}</loc></url>\n" for p in PAGES
)
(out / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "</urlset>\n",
    encoding="utf-8",
)
(out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /account.html\n\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
print("완료:", ", ".join(f"{p}.html" for p in PAGES))
