"""여행지별 일러스트 27장(9곳 x 3장)을 만든다. 사용법: python3 outputs/homepage/art_dest.py
결과: outputs/homepage/art/dest/<키>-1.svg(대표 풍경) · -2(음식·분위기) · -3(활동). 480x300, 브랜드 색(네이비·코랄·크림), 저작권 걱정 없는 직접 그린 그림이다."""
from pathlib import Path

NAVY, CORAL, CREAM, SKY, SUN = '#1F3A5F', '#FF6B5B', '#FFF1D6', '#CFE8F5', '#FFC857'
B1, B2, GREEN, GREEN2, WHITE, SAND, SKIN = '#7FC4E6', '#3E8FC4', '#7BC47F', '#4FA36A', '#FFFFFF', '#F4D9A6', '#F2C9A0'
INK = f'stroke="{NAVY}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"'

def svg(*parts, bg=SKY):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300" preserveAspectRatio="xMidYMid slice"><rect width="480" height="300" fill="{bg}"/>' + ''.join(parts) + '</svg>'
def rect(x, y, w, h, fill, rx=0, ink=False): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" {INK if ink else ""}/>'
def circle(cx, cy, r, fill, ink=False): return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" {INK if ink else ""}/>'
def poly(pts, fill, ink=False): return f'<polygon points="{" ".join(f"{x},{y}" for x, y in pts)}" fill="{fill}" {INK if ink else ""}/>'
def path(d, fill='none', ink=False, stroke=None, sw=4): return f'<path d="{d}" fill="{fill}" ' + (INK if ink else (f'stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round"' if stroke else '')) + '/>'
def ell(cx, cy, rx, ry, fill, ink=False): return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" {INK if ink else ""}/>'
def cloud(x, y, s=1): return f'<g transform="translate({x} {y}) scale({s})" fill="#fff"><circle r="14"/><circle cx="20" cy="-7" r="18"/><circle cx="44" cy="0" r="14"/><rect x="-14" y="0" width="72" height="14" rx="7"/></g>'
def sun(cx, cy, r=34, c=SUN): return circle(cx, cy, r, c)
def waves(y, cols=(B1, B2, NAVY), step=36):
    o = ''
    for i, c in enumerate(cols):
        yy = y + i * step
        o += f'<path d="M0 {yy}Q60 {yy-20} 120 {yy}T240 {yy}T360 {yy}T480 {yy}V300H0Z" fill="{c}"/>'
    return o
def mountain(x, peak, w, h, c, snow=True):
    o = poly([(x - w / 2, peak + h), (x, peak), (x + w / 2, peak + h)], c)
    if snow: o += poly([(x - w * .13, peak + h * .27), (x, peak), (x + w * .13, peak + h * .27), (x + w * .05, peak + h * .21), (x, peak + h * .29), (x - w * .05, peak + h * .22)], WHITE)
    return o
def pine(x, y, s=1, c=GREEN2): return f'<g transform="translate({x} {y}) scale({s})"><rect x="-3" y="0" width="6" height="14" fill="#8B5E3C"/>' + poly([(-16, 4), (0, -26), (16, 4)], c) + poly([(-13, -10), (0, -38), (13, -10)], c) + '</g>'
def palm(x, y, s=1): return f'<g transform="translate({x} {y}) scale({s})"><path d="M0 0Q6 -40 -4 -70" stroke="#8B5E3C" stroke-width="7" fill="none" stroke-linecap="round"/>' + ''.join(f'<path d="M-4 -70Q{dx} {-95+dy} {ex} {-62+ey}Q{dx2} {-80} -4 -70Z" fill="{GREEN2}"/>' for dx, dy, ex, ey, dx2 in [(-34, 0, -52, 10, -30), (28, 0, 48, 12, 26), (-20, -14, -34, -4, -14), (18, -16, 30, -6, 12)]) + '</g>'
def person(x, y, s=1, body=CORAL, hat=None, pack=False):
    o = f'<g transform="translate({x} {y}) scale({s})">'
    if pack: o += rect(-17, -30, 12, 28, NAVY, 5)
    o += rect(-11, -34, 22, 34, body, 8, True) + circle(0, -46, 10, SKIN, True)
    if hat: o += path('M-12 -50Q0 -66 12 -50Z', hat, True)
    return o + '</g>'
def window_rows(x, y, w, h, c=CREAM, cols=3, rows=4):
    gx, gy = w / (cols * 2 + 1), h / (rows * 2 + 1)
    return ''.join(rect(x + gx * (2 * i + 1), y + gy * (2 * j + 1), gx, gy, c) for i in range(cols) for j in range(rows))
def sky_stars(n=12, seed=1):
    o, a = '', seed * 7919
    for i in range(n):
        a = (a * 1103515245 + 12345) & 0x7fffffff
        o += circle(20 + a % 440, 12 + (a >> 8) % 130, 2.2, '#FFF1D6')
    return o
def cup(x, y, s=1, coffee='#8B5E3C'): return f'<g transform="translate({x} {y}) scale({s})">' + path('M-26 -30H26V0Q26 24 0 24Q-26 24 -26 0Z', WHITE, True) + path('M26 -22Q46 -22 46 -6Q46 10 24 8', 'none', True) + ell(0, -30, 26, 7, coffee, True) + path('M-8 -44Q-14 -54 -8 -62M8 -44Q2 -54 8 -62', 'none', stroke='#fff', sw=4) + '</g>'
def plate(x, y, rx=70, ry=16, fill=WHITE): return ell(x, y, rx, ry, fill, True) + ell(x, y, rx * .72, ry * .6, '#EEF1F5')
def table(y=235, c='#C98B5C'): return rect(0, y, 480, 300 - y, c) + rect(0, y, 480, 8, '#B07645')

# ---------------- 도쿄 ----------------
def tokyo1():
    b = ''.join(rect(x, 300 - h, w, h, c) for x, w, h, c in [(0, 60, 110, '#35537D'), (55, 50, 150, NAVY), (110, 60, 95, '#35537D'), (340, 55, 135, NAVY), (390, 50, 170, '#35537D'), (440, 50, 105, NAVY)])
    b += ''.join(window_rows(x, 300 - h, w, h, '#FFD9A0', 2, hh) for x, w, h, hh in [(55, 50, 150, 5), (340, 55, 135, 4), (390, 50, 170, 5)])
    tower = poly([(240, 60), (206, 270), (274, 270)], CORAL, True) + poly([(240, 60), (231, 118), (249, 118)], WHITE) + rect(216, 150, 48, 10, WHITE, 3, True) + rect(207, 205, 66, 10, WHITE, 3, True) + path('M240 60V34', stroke=NAVY, sw=4) + rect(222, 118, 36, 12, CORAL, 3, True) + poly([(215, 270), (230, 215), (250, 215), (265, 270)], '#E55A4B')
    return svg(sun(90, 70, 30, '#FFB36B'), cloud(300, 60), cloud(140, 120, .7), b, tower, rect(0, 270, 480, 30, NAVY), bg='#FFE3C2')
def tokyo2():
    lan = ''.join(f'<g>' + path(f'M{x} 0V{y}', stroke=NAVY, sw=3) + ell(x, y + 24, 20, 26, CORAL, True) + rect(x - 10, y - 2, 20, 8, NAVY) + rect(x - 10, y + 42, 20, 8, NAVY) + '</g>' for x, y in [(70, 30), (190, 50), (300, 26), (410, 54)])
    bowl = path('M120 220H360Q350 290 240 292Q130 290 120 220Z', CORAL, True) + ell(240, 220, 120, 22, '#FFD9A0', True) + ''.join(ell(x, 218, 32, 9, '#FFF1D6') for x in (190, 240, 290)) + circle(240, 214, 11, WHITE, True) + circle(240, 214, 5, SUN) + path('M170 214Q200 196 230 214', stroke=NAVY, sw=3) + path('M330 150L255 210M345 160L270 218', stroke='#C98B5C', sw=6) + path('M180 196Q170 176 182 160M300 196Q290 176 302 160', stroke='#fff', sw=4)
    return svg(sky_stars(14, 3), lan, bowl, bg='#1B2F4E')
def tokyo3():
    street = rect(0, 190, 480, 110, '#3A4660') + ''.join(rect(30 + i * 62, 210 + (i % 2) * 6, 40, 70, WHITE) for i in range(7))
    bld = rect(0, 40, 160, 150, '#35537D') + window_rows(0, 40, 160, 150, '#FFD9A0', 3, 4) + rect(330, 20, 150, 170, NAVY) + window_rows(330, 20, 150, 170, '#FFD9A0', 4, 5) + rect(180, 60, 130, 70, CORAL, 8, True) + path('M200 95H290M200 115H260', stroke=WHITE, sw=6)
    ppl = person(100, 255, 1.2, CORAL) + person(200, 262, 1.2, SUN) + person(300, 252, 1.2, B1) + person(390, 262, 1.2, CREAM)
    umb = path('M170 190Q215 150 260 190Z', CORAL, True) + path('M215 190V232', stroke=NAVY, sw=4)
    return svg(street, bld, ppl, umb, bg='#FFD9B3')

# ---------------- 다낭 ----------------
def danang1():
    hills = path('M0 190Q80 110 170 170T330 160T480 180V300H0Z', GREEN) + path('M0 230Q100 170 220 220T480 220V300H0Z', GREEN2)
    hands = ''.join(path(p, '#C9B79C', True) for p in ['M110 200Q100 160 130 140Q150 130 165 150Q175 165 200 170V215Z', 'M370 200Q380 160 350 140Q330 130 315 150Q305 165 280 170V215Z'])
    bridge = path('M120 150Q240 118 360 150', stroke=SUN, sw=14) + path('M120 150Q240 118 360 150', stroke=NAVY, sw=3) + ''.join(path(f'M{x} {150-((x-240)**2)/2500*0.0-24+((x-240)**2)/1900}V{168-((x-240)**2)/2500*0}', stroke=NAVY, sw=2) for x in range(140, 360, 40))
    return svg(sun(380, 60, 30), cloud(60, 60), cloud(230, 40, .8), hills, hands, bridge, bg='#D5ECF7')
def danang2():
    t = table(225)
    food = plate(220, 232, 100, 20) + ''.join(path(f'M{x} 228Q{x+16} 200 {x+34} 224Q{x+20} 236 {x} 228Z', CORAL, True) for x in (170, 215, 255)) + circle(150, 220, 11, GREEN, True) + circle(300, 220, 11, GREEN, True)
    coco = circle(370, 190, 38, '#8B5E3C', True) + path('M340 168Q370 150 400 168', 'none', stroke=CREAM, sw=6) + path('M372 152L392 118', stroke=CORAL, sw=7) + circle(370, 192, 22, CREAM)
    return svg(rect(0, 0, 480, 140, B1), sun(90, 70, 32), waves(125, (B2, NAVY), 30), cloud(280, 50, .8), t, food, coco, bg=SKY)
def danang3():
    sand = rect(0, 210, 480, 90, SAND)
    umb = lambda x, c: path(f'M{x-48} 160Q{x} 100 {x+48} 160Z', c, True) + path(f'M{x} 160V232', stroke=NAVY, sw=5)
    board = ell(390, 232, 12, 44, CORAL, True) + path('M390 190V274', stroke=WHITE, sw=3)
    return svg(sun(380, 60), cloud(100, 60, .9), waves(140, (B1, B2), 30), sand, umb(120, CORAL), umb(250, SUN), board, person(170, 255, 1.1, B2), person(310, 262, 1.1, CORAL), bg=SKY)

# ---------------- 치앙마이 ----------------
def chiangmai1():
    mt = mountain(110, 90, 260, 140, GREEN2, False) + mountain(390, 80, 300, 150, GREEN, False)
    hill = path('M0 230Q140 170 250 200T480 200V300H0Z', GREEN2)
    chedi = poly([(240, 70), (204, 190), (276, 190)], SUN, True) + rect(196, 190, 88, 18, '#E0A93A', 3, True) + rect(206, 208, 68, 30, CREAM, 3, True) + path('M240 70V44', stroke=NAVY, sw=4) + circle(240, 44, 5, CORAL, True) + ''.join(poly([(240 + dx * .6, y), (240 - dx * .6, y), (240 - dx, y + 24), (240 + dx, y + 24)], '#F5C84A') for dx, y in [(24, 104), (34, 134), (44, 164)])
    return svg(sun(70, 60, 30, '#FFB36B'), cloud(380, 50), mt, hill, chedi, pine(80, 232, 1.2), pine(420, 236, 1.3), pine(370, 246, 1), bg='#FFE8C8')
def chiangmai2():
    win = rect(30, 30, 420, 130, B1, 10, True) + path('M240 30V160M30 95H450', stroke=NAVY, sw=4) + mountain(120, 70, 200, 90, GREEN2, False) + mountain(340, 60, 220, 100, GREEN, False)
    t = table(215, '#C98B5C')
    plant = rect(400, 170, 40, 46, CORAL, 6, True) + path('M420 170Q400 130 392 110M420 170Q430 120 446 106M420 170Q420 120 418 96', stroke=GREEN2, sw=7)
    cake = poly([(260, 215), (330, 215), (310, 170)], '#F7C8D0', True) + path('M262 205H326', stroke=WHITE, sw=4) + circle(312, 170, 6, CORAL, True)
    return svg(win, t, cup(150, 215, 1.4), cake, plant, bg=CREAM)
def chiangmai3():
    mt = mountain(130, 50, 300, 190, GREEN2, False) + mountain(380, 70, 280, 170, GREEN, False)
    fall = rect(215, 90, 30, 110, WHITE) + path('M200 200Q230 220 260 200', 'none', stroke=B1, sw=8) + ell(230, 205, 36, 10, B1)
    trail = path('M0 280Q150 240 260 262T480 240', stroke='#C98B5C', sw=20)
    ppl = person(180, 268, 1.2, CORAL, SUN, True) + person(250, 262, 1.2, B2, CREAM, True)
    return svg(sun(420, 40, 26), cloud(80, 50), mt, fall, rect(0, 205, 480, 95, GREEN2), trail, pine(60, 236, 1.2), pine(430, 232, 1.2), ppl, bg=SKY)

# ---------------- 파리 ----------------
def paris1():
    river = rect(0, 230, 480, 70, B2) + path('M0 250Q60 238 120 250T240 250T360 250T480 250', stroke=B1, sw=5)
    quay = rect(0, 214, 480, 20, '#D8C7A8') + ''.join(rect(x, 150, 40, 64, '#E9DCC4') for x in (0, 70, 340, 410)) + ''.join(rect(x + 10, 165, 12, 22, B2) for x in (0, 70, 340, 410))
    tower = path('M240 40L208 214H272Z', '#6E5B4A', True) + path('M222 150H258M214 190H266', stroke=NAVY, sw=5) + path('M240 40V20', stroke=NAVY, sw=4) + path('M226 214Q240 160 254 214', CREAM) + rect(214, 100, 52, 8, '#6E5B4A', 2, True)
    bridge = path('M120 214Q180 180 240 214T360 214', stroke=NAVY, sw=6)
    return svg(sun(90, 70, 30), cloud(350, 60), cloud(150, 40, .8), quay, tower, river, bg='#F7DDE0')
def paris2():
    awn = ''.join(rect(i * 40, 0, 40, 70, CORAL if i % 2 == 0 else WHITE) for i in range(12)) + ''.join(path(f'M{i*40} 70Q{i*40+20} 92 {i*40+40} 70', CORAL if i % 2 == 0 else WHITE) for i in range(12))
    t = table(220, '#8B5E3C')
    cro = path('M250 200Q270 160 320 170Q360 178 380 210Q340 196 320 205Q290 212 250 200Z', '#E8A94F', True) + path('M290 175L286 202M320 172L318 204M350 182L346 206', stroke='#B97A24', sw=4)
    mac = ''.join(ell(60 + i * 38, 208, 16, 9, c, True) for i, c in enumerate(('#F7C8D0', '#BDE3C3', '#FFE0A3')))
    return svg(awn, rect(0, 90, 480, 130, '#FFF1D6'), circle(60, 130, 6, CORAL), t, cup(150, 222, 1.4), cro, mac, bg=CREAM)
def paris3():
    wall = rect(0, 0, 480, 230, '#E9DCC4') + rect(0, 230, 480, 70, '#B58B5C')
    fr = lambda x, y, w, h, c1, c2: rect(x, y, w, h, '#C98B5C', 4, True) + rect(x + 8, y + 8, w - 16, h - 16, c1) + circle(x + w / 2, y + h / 2, min(w, h) / 4, c2)
    ppl = person(220, 262, 1.4, CORAL, SUN) + person(300, 266, 1.4, NAVY, None)
    return svg(wall, fr(30, 40, 110, 80, B1, SUN), fr(160, 30, 80, 110, CORAL, CREAM), fr(270, 50, 120, 70, GREEN, SUN), fr(410, 40, 50, 80, SUN, CORAL), rect(120, 215, 280, 10, '#8B5E3C'), ppl, bg='#E9DCC4')

# ---------------- 스위스 알프스 ----------------
def alps1():
    mt = mountain(330, 36, 250, 200, '#8FA9C4') + mountain(110, 90, 240, 150, '#A9BFD6') + mountain(240, 120, 260, 120, B2)
    grass = path('M0 230Q120 200 240 226T480 214V300H0Z', GREEN) + path('M0 270Q160 240 300 266T480 256V300H0Z', GREEN2)
    chalet = rect(60, 214, 70, 44, '#C98B5C', 3, True) + poly([(50, 216), (95, 180), (140, 216)], CORAL, True) + rect(84, 232, 22, 26, NAVY)
    return svg(sun(420, 50, 26), cloud(60, 40), cloud(200, 70, .7), mt, grass, chalet, pine(170, 262, 1.3), pine(420, 270, 1.2), bg='#D5ECF7')
def alps2():
    t = table(205, '#8B5E3C')
    pot = path('M170 170H310Q310 232 240 232Q170 232 170 170Z', CORAL, True) + ell(240, 170, 70, 14, '#FFE9A8', True) + path('M180 150L230 100M300 150L250 100', stroke='#C98B5C', sw=5) + circle(230, 100, 7, '#FFD36B', True) + circle(250, 100, 7, '#FFD36B', True)
    cheese = poly([(350, 205), (440, 205), (440, 165)], SUN, True) + circle(405, 192, 7, '#E0A93A') + circle(378, 198, 5, '#E0A93A')
    bread = ''.join(rect(40 + i * 40, 188, 32, 18, '#E8B97A', 5, True) for i in range(3))
    return svg(rect(0, 0, 480, 205, '#F2E4CF'), rect(30, 20, 130, 110, B1, 8, True), mountain(95, 50, 100, 70, '#A9BFD6'), path('M95 20V130M30 75H160', stroke=NAVY, sw=4), t, bread, pot, cheese, bg=CREAM)
def alps3():
    mt = mountain(240, 40, 400, 230, '#A9BFD6') + mountain(60, 100, 200, 130, B2) + mountain(430, 90, 200, 140, B2)
    ridge = path('M0 250Q120 220 240 240T480 230V300H0Z', GREEN2)
    flag = path('M330 214V176', stroke=NAVY, sw=4) + poly([(330, 176), (362, 186), (330, 196)], CORAL, True)
    ppl = person(200, 246, 1.2, CORAL, SUN, True) + person(270, 244, 1.2, B2, CREAM, True)
    return svg(sun(70, 50, 24), cloud(300, 36), mt, ridge, flag, ppl, pine(60, 262, 1.2), pine(430, 262, 1.2), bg='#D5ECF7')

# ---------------- 산토리니 ----------------
def santorini1():
    cliff = path('M0 140Q70 128 150 148T300 160L350 300H0Z', '#EFE4D4') + path('M0 200Q80 186 160 204T330 214L350 300H0Z', '#E3D5BF')
    house = lambda x, y, w, h: rect(x, y, w, h, WHITE, 2, True) + rect(x + w * .35, y + h * .5, w * .3, h * .5, B2)
    dome = lambda x, y: path(f'M{x-22} {y}Q{x} {y-40} {x+22} {y}Z', B2, True) + rect(x - 22, y, 44, 40, WHITE, 2, True) + rect(x - 6, y + 14, 12, 26, B2)
    sea = rect(0, 150, 480, 150, B2) + path('M300 190Q360 178 420 190T480 190', stroke=B1, sw=5) + path('M340 240Q400 228 460 240', stroke=B1, sw=5)
    return svg(sun(400, 70, 40, '#FFC857'), cloud(60, 50), rect(0, 100, 480, 60, '#FFD9B3'), sea, cliff, house(30, 130, 60, 50), house(100, 142, 50, 40), dome(205, 135), house(250, 150, 60, 44), house(60, 210, 70, 52), dome(170, 214), house(240, 226, 58, 44), bg='#FFE3C2')
def santorini2():
    t = table(215, '#D9B88C')
    salad = plate(200, 208, 90, 20) + ''.join(circle(x, y, 11, c, True) for x, y, c in [(160, 200, CORAL), (190, 196, GREEN), (215, 202, CORAL), (240, 198, WHITE), (180, 212, SUN)]) + ''.join(ell(x, 206, 8, 5, '#2D2D2D') for x in (205, 225))
    wine = path('M340 130H392Q392 175 366 180Q340 175 340 130Z', '#E8B04A', True) + path('M366 180V215', stroke=NAVY, sw=5) + ell(366, 217, 20, 5, WHITE, True)
    return svg(rect(0, 0, 480, 140, B2), sun(90, 70, 32, '#FFE08A'), path('M0 130Q60 118 120 130T240 130T360 130T480 130V215H0Z', B1), t, salad, wine, bg=SKY)
def santorini3():
    wall = rect(0, 0, 480, 300, WHITE) + rect(0, 230, 480, 70, '#EFE4D4')
    arch = path('M170 230V110Q240 20 310 110V230Z', B1, True) + path('M190 230V120Q240 50 290 120V230Z', '#FFE3C2')
    bou = ''.join(circle(x, y, 9, '#E86AA6') for x, y in [(60, 70), (80, 85), (50, 100), (420, 60), (440, 80), (410, 95), (100, 60), (380, 80)]) + ''.join(circle(x, y, 7, GREEN) for x, y in [(70, 95), (430, 100), (95, 75)])
    stairs = ''.join(rect(180 + i * 4, 232 + i * 11, 120 - i * 8, 10, '#D9C9B0') for i in range(5))
    return svg(wall, rect(20, 40, 130, 190, '#F4EEE4'), rect(340, 40, 130, 190, '#F4EEE4'), arch, bou, stairs, person(240, 215, 1.1, CORAL, SUN), bg=WHITE)

# ---------------- 뉴욕 ----------------
def newyork1():
    water = rect(0, 240, 480, 60, B2) + path('M0 262Q60 250 120 262T240 262T360 262T480 262', stroke=B1, sw=5)
    sk = ''.join(rect(x, 240 - h, w, h, c) for x, w, h, c in [(0, 50, 110, '#35537D'), (45, 40, 150, NAVY), (90, 50, 100, '#35537D'), (330, 50, 130, '#35537D'), (375, 45, 170, NAVY), (420, 60, 100, '#35537D')])
    sk += ''.join(window_rows(x, 240 - h, w, h, '#FFD9A0', 2, 5) for x, w, h in [(45, 40, 150), (375, 45, 170)])
    empire = rect(205, 100, 70, 140, '#6C7A92', 2, True) + rect(218, 66, 44, 34, '#6C7A92', 2, True) + rect(228, 40, 24, 26, '#6C7A92', 2, True) + path('M240 40V12', stroke=NAVY, sw=4) + window_rows(205, 100, 70, 140, '#FFD9A0', 3, 6)
    lib = ell(300, 190, 0.1, 0.1, 'none') + path('M150 240V200', stroke='#6BBF9B', sw=0)
    return svg(sun(70, 60, 30, '#FFB36B'), cloud(380, 50), sk, empire, water, bg='#FFE3C2')
def newyork2():
    t = table(220, '#C98B5C')
    stack = ''.join(ell(220, 200 - i * 14, 70, 14, '#E8B97A', True) for i in range(4)) + ell(220, 140, 28, 10, '#FFE9A8', True) + circle(220, 128, 7, CORAL, True) + path('M180 150Q172 175 184 190M260 152Q270 176 258 192', stroke=SUN, sw=7)
    papercup = poly([(360, 130), (410, 130), (402, 215), (368, 215)], WHITE, True) + rect(354, 120, 62, 14, CORAL, 4, True) + path('M365 165H405', stroke=CORAL, sw=10)
    bag = ell(110, 205, 46, 22, '#E8B97A', True) + circle(110, 205, 10, '#8B5E3C')
    return svg(rect(0, 0, 480, 140, B1), ''.join(rect(x, 50, w, 90, c) for x, w, c in [(20, 60, '#35537D'), (100, 40, NAVY), (360, 70, '#35537D'), (440, 40, NAVY)]), t, stack, papercup, bag, bg=SKY)
def newyork3():
    st = rect(0, 220, 480, 80, '#3A4660') + path('M0 262H480', stroke=SUN, sw=4)
    mq = rect(110, 40, 260, 100, CORAL, 10, True) + ''.join(circle(122 + i * 20, 52, 4, '#FFF1D6') for i in range(12)) + ''.join(circle(122 + i * 20, 128, 4, '#FFF1D6') for i in range(12)) + path('M150 82H330M170 106H310', stroke=WHITE, sw=7)
    bg = rect(0, 100, 480, 120, NAVY) + window_rows(0, 100, 100, 120, '#FFD9A0', 2, 3) + window_rows(380, 100, 100, 120, '#FFD9A0', 2, 3)
    taxi = rect(300, 226, 130, 40, SUN, 10, True) + path('M322 226L338 200H394L410 226Z', SUN, True) + circle(334, 270, 13, NAVY, True) + circle(398, 270, 13, NAVY, True)
    return svg(bg, mq, st, person(100, 262, 1.3, CORAL, None), person(170, 266, 1.3, B1, CREAM), person(235, 262, 1.3, WHITE), taxi, bg='#1B2F4E')

# ---------------- 하와이 ----------------
def hawaii1():
    crater = mountain(150, 110, 330, 120, GREEN2, False) + path('M60 200Q150 130 250 200Z', GREEN)
    sea = waves(205, (B1, B2), 30)
    sand = path('M0 262Q120 244 260 262T480 254V300H0Z', SAND)
    return svg(sun(400, 64, 36), cloud(70, 56), crater, sea, sand, palm(70, 268, 1.2), palm(400, 272, 1.4), bg='#CFE8F5')
def hawaii2():
    t = table(225, '#C98B5C')
    drink = path('M150 120H250L232 220H168Z', '#FF9F5B', True) + path('M150 120H250', stroke=NAVY, sw=4) + circle(190, 170, 16, SUN, True) + path('M200 100L240 50', stroke=CORAL, sw=7) + ''.join(poly([(x, 102), (x + 12, 70), (x + 24, 102)], GREEN2, True) for x in (118, 140))
    hib = ''.join(circle(330 + 24 * __import__('math').cos(a), 190 + 24 * __import__('math').sin(a), 15, CORAL, True) for a in [i * 1.2566 for i in range(5)]) + circle(330, 190, 9, SUN, True)
    bowl = path('M370 200H450Q448 240 410 242Q372 240 370 200Z', WHITE, True) + ''.join(circle(x, 198, 9, c, True) for x, c in [(385, CORAL), (405, GREEN), (425, SUN), (440, CORAL)])
    return svg(rect(0, 0, 480, 150, B1), sun(380, 70, 34), palm(60, 160, .8), t, drink, hib, bowl, bg=SKY)
def hawaii3():
    wave = path('M0 300V190Q70 100 170 150Q240 190 310 130Q380 80 480 150V300Z', B2) + path('M0 300V230Q90 160 190 200Q270 230 340 180Q410 140 480 190V300Z', B1) + path('M300 135Q330 110 350 140', stroke=WHITE, sw=6)
    surfer = f'<g transform="translate(240 150) rotate(-12)">' + ell(0, 34, 52, 8, CORAL, True) + rect(-9, -4, 18, 34, NAVY, 6, True) + circle(0, -14, 10, SKIN, True) + path('M-9 6L-40 -8M9 6L40 -14', stroke=NAVY, sw=5) + '</g>'
    return svg(sun(90, 60, 32), cloud(330, 50), wave, surfer, path('M200 200Q240 180 280 200', stroke=WHITE, sw=5), bg=SKY)

# ---------------- 로키산맥 ----------------
def rockies1():
    mt = mountain(130, 40, 300, 180, '#A9BFD6') + mountain(360, 60, 320, 170, '#8FA9C4') + mountain(240, 100, 260, 130, B2)
    lake = rect(0, 200, 480, 100, '#3E8FC4') + path('M0 230Q60 218 120 230T240 230T360 230T480 230', stroke=B1, sw=5)
    refl = poly([(110, 205), (130, 262), (150, 205)], '#2F78A8') + poly([(340, 205), (360, 270), (380, 205)], '#2F78A8')
    return svg(sun(420, 40, 24), cloud(60, 50), cloud(250, 36, .8), mt, rect(0, 195, 480, 10, GREEN2), lake, refl, ''.join(pine(x, 206, 1.2) for x in (30, 70, 400, 450)), bg='#D5ECF7')
def rockies2():
    ground = rect(0, 230, 480, 70, '#2C4A3A')
    tent = poly([(70, 232), (150, 150), (230, 232)], CORAL, True) + poly([(150, 150), (128, 232), (172, 232)], NAVY)
    fire = path('M330 232Q300 200 330 166Q336 190 352 180Q356 200 350 232Z', SUN, True) + path('M335 232Q322 214 336 196Q342 212 346 232Z', CORAL) + path('M300 238L360 250M360 238L300 250', stroke='#8B5E3C', sw=7)
    return svg(sky_stars(26, 5), circle(400, 50, 22, '#FFF1D6'), mountain(380, 100, 300, 130, '#24405F', False), mountain(100, 120, 260, 110, '#2B4A6E', False), ground, ''.join(pine(x, 230, 1.2, '#1F5A44') for x in (30, 440, 470)), tent, fire, bg='#16263F')
def rockies3():
    mt = mountain(240, 50, 420, 150, '#A9BFD6') + mountain(60, 90, 180, 110, B2)
    lake = rect(0, 150, 480, 150, '#3E8FC4') + path('M0 190Q60 178 120 190T240 190T360 190T480 190', stroke=B1, sw=5) + path('M0 240Q60 228 120 240T240 240T360 240T480 240', stroke=B1, sw=5)
    canoe = path('M150 212Q240 238 330 212L310 238Q240 256 170 238Z', CORAL, True)
    ppl = person(215, 218, 1, SUN, CREAM) + person(275, 218, 1, B2, None) + path('M180 190L240 236M320 186L250 236', stroke='#C98B5C', sw=5)
    return svg(sun(420, 50, 24), cloud(80, 40), mt, rect(0, 140, 480, 12, GREEN2), lake, ''.join(pine(x, 150, 1) for x in (20, 60, 420, 460)), canoe, ppl, bg='#D5ECF7')

SETS = {'tokyo': (tokyo1, tokyo2, tokyo3), 'danang': (danang1, danang2, danang3), 'chiangmai': (chiangmai1, chiangmai2, chiangmai3), 'paris': (paris1, paris2, paris3),
        'alps': (alps1, alps2, alps3), 'santorini': (santorini1, santorini2, santorini3), 'newyork': (newyork1, newyork2, newyork3), 'hawaii': (hawaii1, hawaii2, hawaii3), 'rockies': (rockies1, rockies2, rockies3)}

if __name__ == '__main__':
    out = Path(__file__).resolve().parent / 'art' / 'dest'
    out.mkdir(parents=True, exist_ok=True)
    for key, fns in SETS.items():
        for i, fn in enumerate(fns, 1):
            (out / f'{key}-{i}.svg').write_text(fn(), encoding='utf-8')
    print('완료:', sum(len(v) for v in SETS.values()), '장')
