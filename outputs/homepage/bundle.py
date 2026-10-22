"""테스트용으로 홈페이지 파일을 dist/ 폴더와 zip으로 묶는다.
사용법: python3 outputs/homepage/build.py && python3 outputs/homepage/bundle.py
config.js에 공개용 anon 키가 들어 있어 dist/는 커밋하지 않는다(.gitignore)."""
import shutil
import zipfile
from pathlib import Path

here = Path(__file__).resolve().parent
dist = here / "dist"
shutil.rmtree(dist, ignore_errors=True)
dist.mkdir()
files = [
    "index.html", "trips.html", "reviews.html", "community.html", "contact.html", "account.html",
    "brand.css", "common.css", "common.js", "pay.js", "app.js", "i18n.js", "config.js",
    "favicon.svg", "og-image.png", "robots.txt", "sitemap.xml",
]
for f in files:
    shutil.copy(here / f, dist / f)
with zipfile.ZipFile(dist / "hamkkedat-homepage-test.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(dist / f, f)
print("만듦:", dist / "hamkkedat-homepage-test.zip")
