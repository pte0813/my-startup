"""페이지별 공유 이미지(og-*.png, 1200x630)를 만든다.
사용법: python3 outputs/homepage/og.py <글꼴 폴더>   (폴더에 Jua-Regular.ttf, Gaegu-Bold.ttf 필요, Google Fonts SIL OFL)
node + playwright(chromium)가 필요하다. 만든 PNG는 색을 줄여 용량을 작게 저장한다.
"""
import json, sys
from pathlib import Path
import subprocess, tempfile
from PIL import Image

out = Path(__file__).resolve().parent
fonts = Path(sys.argv[1]).resolve()
ko = json.loads((out / "src/i18n.json").read_text(encoding="utf-8"))["ko"]
NAVY, CORAL, CREAM = "#1F3A5F", "#FF6B5B", "#FFF1D6"

# 파일명: (큰 제목, 한 줄 설명, 배경, 글자색, 포인트색)
CARDS = {
    "og-image": ("함께닿", "혼자 떠나도, 마음은 닿는다", CREAM, NAVY, CORAL),
    "og-trips": (ko["g_trips"], "낯선 사람들과 떠나는 여행", NAVY, CREAM, CORAL),
    "og-reviews": (ko["g_reviews"], "다녀온 사람들의 진짜 이야기", CORAL, CREAM, NAVY),
    "og-community": (ko["g_community"], "이벤트 · FAQ · 상품 제안", CREAM, NAVY, CORAL),
    "og-contact": (ko["g_contact"], "궁금한 건 언제든 물어보세요", NAVY, CREAM, CORAL),
}

HTML = """<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Jua;src:url('%(f)s/Jua-Regular.ttf')}
@font-face{font-family:Gaegu;font-weight:700;src:url('%(f)s/Gaegu-Bold.ttf')}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:%(bg)s;position:relative;overflow:hidden;font-family:Jua}
.art{position:absolute;right:40px;bottom:60px;width:520px;height:390px}
.brand{position:absolute;left:80px;top:64px;display:flex;align-items:center;font-size:44px;color:%(fg)s}
.dots{display:flex;margin-right:16px}.dots i{display:block;width:44px;height:44px;border-radius:50%%}
.dots i:first-child{background:%(d1)s}.dots i:last-child{background:%(d2)s;margin-left:-13px}
.main{position:absolute;left:80px;bottom:90px;max-width:560px}
h1{font-weight:400;font-size:%(size)spx;line-height:1.1;color:%(fg)s}
p{margin-top:24px;font-family:Gaegu;font-weight:700;font-size:42px;color:%(ac2)s}
</style><img class="art" src="%(art)s">
<div class="brand"><span class="dots"><i></i><i></i></span>함께닿</div>
<div class="main"><h1>%(t)s</h1><p>%(s)s</p></div>"""

SHOT = """const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1200,height:630}});
for(const [h,o] of JSON.parse(process.argv[2])){await p.goto('file://'+h);await p.waitForTimeout(400);await p.screenshot({path:o});}
await b.close();})();"""

with tempfile.TemporaryDirectory() as tmp:
    jobs = []
    for name, (t, s, bg, fg, ac) in CARDS.items():
        dark = bg != CREAM
        html = HTML % dict(
            f=fonts.as_uri(), bg=bg, fg=fg, ac=ac, t=t, s=s,
            size=150 if len(t) <= 4 else 112, art=(out / 'art' / ('hero-%s.svg' % name[3:].replace('image', 'index'))).as_uri(),
            d1=CREAM if dark else NAVY, d2=CORAL if bg != CORAL else NAVY,
            ac2=CREAM if bg == CORAL else CORAL,
        )
        h = Path(tmp) / f"{name}.html"
        h.write_text(html, encoding="utf-8")
        jobs.append([str(h), str(out / f"{name}.png")])
    (Path(tmp) / "shot.js").write_text(SHOT)
    subprocess.run(["node", str(Path(tmp) / "shot.js"), json.dumps(jobs)], check=True, env={**__import__("os").environ, "NODE_PATH": subprocess.check_output(["npm", "root", "-g"], text=True).strip()})
for _, o in jobs:
    Image.open(o).convert("RGB").quantize(colors=16, dither=Image.NONE).save(o, optimize=True)
    print(Path(o).name, Path(o).stat().st_size)
