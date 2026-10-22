"""테스트용으로 brand.css와 config.js를 각 HTML 안에 합쳐 dist/ 에 만든다.
사용법: python3 outputs/homepage/build.py && python3 outputs/homepage/bundle.py
dist/는 공개용 키가 들어 있어 커밋하지 않는다(.gitignore)."""
from pathlib import Path

here = Path(__file__).resolve().parent
dist = here / "dist"
dist.mkdir(exist_ok=True)
css = (here / "brand.css").read_text(encoding="utf-8")
cfg = (here / "config.js").read_text(encoding="utf-8")
for name in ("index.html", "account.html"):
    s = (here / name).read_text(encoding="utf-8")
    s = s.replace('<link rel="stylesheet" href="brand.css">', "<style>\n" + css + "</style>")
    s = s.replace('<script src="config.js"></script>', "<script>\n" + cfg + "</script>")
    (dist / name).write_text(s, encoding="utf-8")
    print("만듦:", dist / name)
