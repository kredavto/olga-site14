#!/usr/bin/env python3
"""
Процедурный генератор медиа-плейсхолдеров для digital showroom.

Создаёт тёмные «архитектурные» кадры и макро-текстуры материалов,
чтобы сайт можно было смотреть и защищать до появления реальной съёмки.
Каждый файл — отдельный слот; замена делается через content/site.json,
структура сайта при этом не меняется.

Запуск:  python3 tools/make_media.py
"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "dist", "media")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20260825)

# --- палитра (согласована с design-system: ink/espresso + ochre/bronze) ---
GRAPHITE = np.array([0.086, 0.080, 0.075])
BRONZE   = np.array([0.722, 0.537, 0.290])
MILK     = np.array([0.965, 0.953, 0.937])


def fbm(h, w, octaves=5, base=4, seed=None):
    """Фрактальный шум — основа для камня, бетона и грязи на стекле."""
    r = np.random.default_rng(seed) if seed is not None else rng
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gh, gw = max(2, int(base * 2 ** o)), max(2, int(base * 2 ** o * w / h))
        g = r.random((gh, gw))
        layer = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)) / 255.0
        out += layer * amp
        total += amp
        amp *= 0.5
    return out / total


def grain(h, w, amount=0.018, seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    return (r.random((h, w, 1)) - 0.5) * 2 * amount


def vignette(h, w, strength=0.55, softness=1.25):
    y, x = np.mgrid[0:h, 0:w]
    cy, cx = h / 2, w / 2
    d = np.sqrt(((y - cy) / cy) ** 2 + ((x - cx) / cx) ** 2) / math.sqrt(2)
    return 1.0 - strength * np.clip(d, 0, 1) ** softness


def light_shaft(h, w, angle=-28, pos=0.34, width=0.30, power=1.0):
    """Мягкий столб света — то, что делает тёмный кадр «интерьерным», а не серым."""
    y, x = np.mgrid[0:h, 0:w]
    a = math.radians(angle)
    proj = (x / w) * math.cos(a) + (y / h) * math.sin(a)
    proj = (proj - proj.min()) / (proj.max() - proj.min())
    return np.exp(-((proj - pos) ** 2) / (2 * width ** 2)) * power


def to_img(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))


def save(arr, name, quality=82, blur=0.0):
    im = to_img(arr)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    im.save(os.path.join(OUT, name), quality=quality, optimize=True)
    return name


# ---------------------------------------------------------------- INTERIOR
def _mask(w, h, draw_fn, blur=0.0):
    """Рисуем форму в 8-битную маску и при необходимости размываем."""
    m = Image.new("L", (w, h), 0)
    draw_fn(ImageDraw.Draw(m))
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m) / 255.0


def _lerp(p0, p1, k):
    return (p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k)


def _finish(img, w, h, seed, t, shaft, exposure=1.0, zoom=1.0):
    img = img * exposure
    img += light_shaft(h, w, angle=-26 + 8 * t, pos=shaft, width=0.30)[:, :, None] * MILK * 0.06
    img *= vignette(h, w, 0.52, 1.1)[:, :, None]
    img += grain(h, w, 0.016, seed=seed)
    if zoom > 1.001:                       # «приближение камеры» — кроп по центру
        im = to_img(img)
        cw, ch = int(w / zoom), int(h / zoom)
        x0, y0 = (w - cw) // 2, int((h - ch) * 0.55)
        img = np.asarray(im.crop((x0, y0, x0 + cw, y0 + ch)).resize((w, h), Image.LANCZOS)) / 255.0
    return img


def _window(img, w, h, x0, x1, y0, y1, warmth, cols=2, rows=2, bright=0.52):
    """Окно как источник света: свечение вокруг + светлое поле + переплёты."""
    halo = _mask(w, h, lambda d: d.rectangle([x0 - w * .05, y0 - h * .05,
                                              x1 + w * .05, y1 + h * .05], fill=255), blur=w * 0.055)
    img += halo[:, :, None] * (MILK * 0.20 + BRONZE * 0.06 * warmth)
    win = _mask(w, h, lambda d: d.rectangle([x0, y0, x1, y1], fill=255), blur=1.0)
    sky = np.linspace(bright * 1.25, bright * 0.85, h)[:, None, None] * (MILK * 0.9 + BRONZE * 0.10 * warmth)
    img = img * (1 - win[:, :, None]) + win[:, :, None] * sky
    for c in range(1, cols):
        b = _mask(w, h, lambda d, c=c: d.rectangle([x0 + (x1 - x0) * c / cols - 2, y0,
                                                    x0 + (x1 - x0) * c / cols + 2, y1], fill=255))
        img *= (1 - b[:, :, None] * 0.72)
    for rw in range(1, rows):
        b = _mask(w, h, lambda d, rw=rw: d.rectangle([x0, y0 + (y1 - y0) * rw / rows - 2,
                                                      x1, y0 + (y1 - y0) * rw / rows + 2], fill=255))
        img *= (1 - b[:, :, None] * 0.72)
    return img


def _pendants(img, w, h, n, y, warmth, span=(0.30, 0.70)):
    """Подвесные светильники — читаемый интерьерный маркер."""
    for i in range(n):
        x = w * (span[0] + (span[1] - span[0]) * (i + 0.5) / n)
        cord = _mask(w, h, lambda d, x=x: d.line([(x, 0), (x, y)], fill=255, width=2), blur=0.6)
        img *= (1 - cord[:, :, None] * 0.55)
        shade = _mask(w, h, lambda d, x=x: d.polygon(
            [(x - w * .022, y), (x + w * .022, y), (x + w * .012, y - h * .075),
             (x - w * .012, y - h * .075)], fill=255), blur=0.8)
        img = img * (1 - shade[:, :, None] * 0.85) + shade[:, :, None] * BRONZE * 0.55
        bulb = _mask(w, h, lambda d, x=x: d.ellipse([x - w * .05, y - h * .03,
                                                     x + w * .05, y + h * .10], fill=255), blur=w * 0.03)
        img += bulb[:, :, None] * (BRONZE * 0.5 + MILK * 0.22) * warmth
    return img


def _base(w, h, warmth, top=0.50, bottom=1.20):
    return np.ones((h, w, 3)) * GRAPHITE * (1.0 + 0.45 * warmth) * np.linspace(top, bottom, h)[:, None, None]


def _v_perspective(w, h, t, warmth, seed, accent, r):
    """Кадр вдоль помещения: окно с одной стороны, перспективный ряд фасадов."""
    flip = (seed // 3) % 2 == 0
    horizon = h * (0.58 + 0.05 * math.sin(t * math.pi + seed))
    vp_x = w * (0.30 + 0.40 * ((seed % 5) / 4.0)) + w * 0.10 * t
    img = _base(w, h, warmth)

    wx0 = w * (0.02 if flip else 0.70)
    img = _window(img, w, h, wx0, wx0 + w * 0.28, h * 0.09, horizon * 0.95, warmth,
                  cols=2, rows=3, bright=0.50)

    side = 1 if flip else -1
    x_near, x_far = w * (1.0 if flip else 0.0), vp_x + side * w * 0.05
    yt_n, yb_n, yt_f, yb_f = h * 0.04, h * 1.0, horizon - h * 0.22, horizon + h * 0.04
    n = 7
    ks = np.linspace(0, 1, n + 1) ** 1.5
    for i in range(n):
        k0, k1 = ks[i], ks[i + 1]
        face = _mask(w, h, lambda d, k0=k0, k1=k1: d.polygon([
            (x_near + (x_far - x_near) * k0, yt_n + (yt_f - yt_n) * k0),
            (x_near + (x_far - x_near) * (k1 - .012), yt_n + (yt_f - yt_n) * (k1 - .012)),
            (x_near + (x_far - x_near) * (k1 - .012), yb_n + (yb_f - yb_n) * (k1 - .012)),
            (x_near + (x_far - x_near) * k0, yb_n + (yb_f - yb_n) * k0)], fill=255), blur=0.6)
        lit = 0.55 + 0.95 * (1 - k0) ** 1.3 * (0.8 + 0.4 * r.random())
        img = img * (1 - face[:, :, None] * .93) + face[:, :, None] * .93 * (GRAPHITE * 2.4 + BRONZE * .07 * warmth) * lit
        edge = _mask(w, h, lambda d, k1=k1: d.line([
            (x_near + (x_far - x_near) * k1, yt_n + (yt_f - yt_n) * k1),
            (x_near + (x_far - x_near) * k1, yb_n + (yb_f - yb_n) * k1)], fill=255, width=2), blur=0.7)
        img += edge[:, :, None] * MILK * 0.13 * (1 - k0)

    ty = 0.50
    led = _mask(w, h, lambda d: d.line([(x_near, yt_n + (yb_n - yt_n) * (ty - .015)),
                                        (x_far, yt_f + (yb_f - yt_f) * (ty - .015))], fill=255, width=3), blur=2.4)
    img += led[:, :, None] * BRONZE * (0.55 + 0.9 * accent)
    top = _mask(w, h, lambda d: d.polygon([
        (x_near, yt_n + (yb_n - yt_n) * ty), (x_far, yt_f + (yb_f - yt_f) * ty),
        (x_far, yt_f + (yb_f - yt_f) * (ty + .05)), (x_near, yt_n + (yb_n - yt_n) * (ty + .07))],
        fill=255), blur=0.8)
    img += top[:, :, None] * MILK * 0.17

    fl = _mask(w, h, lambda d: d.rectangle([0, horizon, w, h], fill=255), blur=1.0)
    img = img * (1 - fl[:, :, None] * 0.50)
    pool = _mask(w, h, lambda d: d.polygon([
        (wx0 + w * .10 * side, horizon), (wx0 + w * .28 + w * .10 * side, horizon),
        (wx0 + w * .28 + w * .32 * side, h), (wx0 - w * .06 + w * .32 * side, h)], fill=255), blur=w * .035)
    img += (pool * fl)[:, :, None] * (MILK * 0.20 + BRONZE * 0.05)
    img += _mask(w, h, lambda d: d.line([(0, horizon), (w, horizon)], fill=255, width=2), blur=.8)[:, :, None] * MILK * .06
    return img


def _v_elevation(w, h, t, warmth, seed, accent, r):
    """Фронтальный кадр стены фасадов: ритм вертикалей, ниша, подсветка."""
    img = _base(w, h, warmth, 0.55, 1.05)
    # неравномерная раскладка: узкие и широкие модули, как в реальном проекте
    n = 4 + seed % 4
    widths = np.array([1.0 + 1.4 * r.random() for _ in range(n)])
    widths /= widths.sum()
    bounds = np.concatenate([[0.0], np.cumsum(widths)])
    y0, y1 = h * (0.03 + 0.06 * r.random()), h * (0.84 + 0.08 * r.random())
    nich = int(r.integers(0, n))
    span_x0, span_w = w * 0.03, w * 0.94
    cols = n
    for c in range(cols):
        x0 = span_x0 + span_w * bounds[c]
        x1 = span_x0 + span_w * bounds[c + 1] - w * 0.006
        panel = _mask(w, h, lambda d, x0=x0, x1=x1: d.rectangle([x0, y0, x1, y1], fill=255), blur=0.5)
        lit = 0.58 + 0.60 * (1 - abs(c - cols * (0.25 + 0.2 * ((seed // 5) % 3))) / cols) * (0.85 + 0.3 * r.random())
        img = img * (1 - panel[:, :, None] * .95) + panel[:, :, None] * .95 * (GRAPHITE * 2.5 + BRONZE * .07 * warmth) * lit
        gr = _mask(w, h, lambda d, x1=x1: d.rectangle([x1 - 3, y0, x1 + 1, y1], fill=255), blur=0.8)
        img *= (1 - gr[:, :, None] * 0.55)
        if c == nich:                      # открытая ниша с подсветкой
            ny0, ny1 = y0 + (y1 - y0) * 0.26, y0 + (y1 - y0) * 0.62
            cav = _mask(w, h, lambda d, x0=x0, x1=x1: d.rectangle([x0 + 4, ny0, x1 - 4, ny1], fill=255), blur=1.0)
            img = img * (1 - cav[:, :, None] * .9) + cav[:, :, None] * .9 * GRAPHITE * 0.7
            for sh in (0.34, 0.62):
                sl = _mask(w, h, lambda d, x0=x0, x1=x1, sh=sh: d.line(
                    [(x0 + 6, ny0 + (ny1 - ny0) * sh), (x1 - 6, ny0 + (ny1 - ny0) * sh)], fill=255, width=3), blur=2.0)
                img += sl[:, :, None] * BRONZE * (0.7 + accent)
    # горизонтальная разрезка: линия столешницы / стыка ярусов
    ly = y0 + (y1 - y0) * (0.34 + 0.28 * r.random())
    img += _mask(w, h, lambda d: d.rectangle([w * .04, ly, w * .96, ly + 4], fill=255), blur=1.0)[:, :, None] * MILK * .10
    img += _mask(w, h, lambda d: d.rectangle([w * .04, ly + 5, w * .96, ly + 9], fill=255), blur=3.0)[:, :, None] * BRONZE * (.5 + accent)
    # цоколь и тень под ним
    img *= (1 - _mask(w, h, lambda d: d.rectangle([0, y1, w, h], fill=255), blur=w * .012)[:, :, None] * .55)
    if seed % 3 == 0:                       # возврат стены сбоку — добавляет объём
        flip = (seed // 3) % 2 == 0
        xa = w * (0.0 if flip else 0.86)
        ret = _mask(w, h, lambda d: d.polygon(
            [(xa, 0), (xa + w * .14, h * .10), (xa + w * .14, h * .92), (xa, h)] if flip else
            [(xa, h * .10), (w, 0), (w, h), (xa, h * .92)], fill=255), blur=1.0)
        img = img * (1 - ret[:, :, None] * .92) + ret[:, :, None] * .92 * GRAPHITE * 1.35
    return img


def _v_detail(w, h, t, warmth, seed, accent, r):
    """Макро-деталь: кромка фасада, профиль-ручка, глубина резкости."""
    img = _base(w, h, warmth, 0.45, 1.0)
    ang = -14 + (seed % 5) * 7
    dx = math.tan(math.radians(ang)) * h
    split = w * (0.34 + 0.22 * r.random())
    far = _mask(w, h, lambda d: d.polygon([(0, 0), (split, 0), (split + dx, h), (0, h)], fill=255), blur=1.0)
    img = img * (1 - far[:, :, None] * .92) + far[:, :, None] * .92 * (GRAPHITE * 2.0 + BRONZE * .05 * warmth) * 0.85
    near = _mask(w, h, lambda d: d.polygon([(split + w * .02, 0), (w, 0), (w, h), (split + dx + w * .02, h)], fill=255), blur=1.0)
    img = img * (1 - near[:, :, None] * .95) + near[:, :, None] * .95 * (GRAPHITE * 2.9 + BRONZE * .09 * warmth) * 1.15
    gap = _mask(w, h, lambda d: d.polygon([(split, 0), (split + w * .02, 0),
                                           (split + dx + w * .02, h), (split + dx, h)], fill=255), blur=1.2)
    img *= (1 - gap[:, :, None] * 0.72)
    lip = _mask(w, h, lambda d: d.line([(split + w * .02, 0), (split + dx + w * .02, h)], fill=255, width=3), blur=1.0)
    img += lip[:, :, None] * (MILK * 0.34 + BRONZE * 0.20)      # световая кромка
    hy = h * (0.30 + 0.35 * r.random())
    handle = _mask(w, h, lambda d: d.rectangle([split + dx * hy / h + w * .04, hy,
                                                w, hy + h * .035], fill=255), blur=1.4)
    img = img * (1 - handle[:, :, None] * .8) + handle[:, :, None] * .8 * GRAPHITE * 0.55
    img += _mask(w, h, lambda d: d.rectangle([split + dx * hy / h + w * .04, hy - 2,
                                              w, hy + 3], fill=255), blur=2.2)[:, :, None] * BRONZE * (.8 + accent)
    img *= (0.72 + 0.5 * fbm(h, w, 5, 6, seed=seed))[:, :, None] * 0.4 + 0.72
    return img


def _v_openspace(w, h, t, warmth, seed, accent, r):
    """Общий план: дальняя стена с окном, силуэты мебели, подвесы."""
    horizon = h * 0.62
    img = _base(w, h, warmth, 0.52, 1.15)
    img = _window(img, w, h, w * 0.30, w * 0.70, h * 0.14, horizon * 0.92, warmth,
                  cols=3, rows=2, bright=0.55)
    # боковые простенки
    for x0, x1 in ((0, w * 0.22), (w * 0.78, w)):
        m = _mask(w, h, lambda d, x0=x0, x1=x1: d.rectangle([x0, 0, x1, horizon], fill=255), blur=1.0)
        img = img * (1 - m[:, :, None] * .9) + m[:, :, None] * .9 * GRAPHITE * 1.5
    img = _pendants(img, w, h, 3, h * 0.30, warmth, span=(0.34, 0.66))
    fl = _mask(w, h, lambda d: d.rectangle([0, horizon, w, h], fill=255), blur=1.0)
    img = img * (1 - fl[:, :, None] * .45)
    pool = _mask(w, h, lambda d: d.polygon([(w * .30, horizon), (w * .70, horizon),
                                            (w * .88, h), (w * .12, h)], fill=255), blur=w * .04)
    img += (pool * fl)[:, :, None] * (MILK * 0.20 + BRONZE * .05)
    # силуэт дивана / стола на переднем плане
    sy = h * (0.74 + 0.05 * r.random())
    sofa = _mask(w, h, lambda d: d.rounded_rectangle([w * .16, sy, w * .84, sy + h * .17],
                                                     radius=int(h * .035), fill=255), blur=w * .006)
    img = img * (1 - sofa[:, :, None] * .85) + sofa[:, :, None] * .85 * GRAPHITE * 1.9
    img += _mask(w, h, lambda d: d.line([(w * .16, sy + 3), (w * .84, sy + 3)], fill=255, width=3),
                 blur=1.6)[:, :, None] * MILK * 0.14
    img += _mask(w, h, lambda d: d.line([(0, horizon), (w, horizon)], fill=255, width=2), blur=.8)[:, :, None] * MILK * .06
    return img


def _v_wardrobe(w, h, t, warmth, seed, accent, r):
    """Гардеробная: вертикальные секции, штанга, подсветка полок."""
    img = _base(w, h, warmth, 0.48, 1.0)
    secs = 4 + seed % 3
    y0, y1 = h * 0.04, h * 0.94
    for c in range(secs):
        x0 = w * 0.03 + (w * 0.94) * c / secs
        x1 = x0 + (w * 0.94) / secs - w * 0.008
        m = _mask(w, h, lambda d, x0=x0, x1=x1: d.rectangle([x0, y0, x1, y1], fill=255), blur=0.6)
        lit = 0.5 + 0.5 * r.random()
        img = img * (1 - m[:, :, None] * .93) + m[:, :, None] * .93 * GRAPHITE * (1.5 + 1.1 * lit)
        # полки с подсветкой
        for k in np.linspace(0.16, 0.9, 4 + c % 2):
            sy = y0 + (y1 - y0) * k
            img += _mask(w, h, lambda d, x0=x0, x1=x1, sy=sy: d.rectangle([x0 + 5, sy, x1 - 5, sy + 3], fill=255),
                         blur=1.0)[:, :, None] * MILK * 0.12
            img += _mask(w, h, lambda d, x0=x0, x1=x1, sy=sy: d.rectangle([x0 + 5, sy + 4, x1 - 5, sy + 8], fill=255),
                         blur=3.0)[:, :, None] * BRONZE * (0.42 + 0.7 * accent)
        # штанга и силуэты вешалок
        if c % 2 == 1:
            ry = y0 + (y1 - y0) * 0.30
            img += _mask(w, h, lambda d, x0=x0, x1=x1, ry=ry: d.rectangle([x0 + 8, ry, x1 - 8, ry + 3], fill=255),
                         blur=0.8)[:, :, None] * MILK * 0.20
            for hgr in range(5):
                hx = x0 + 14 + (x1 - x0 - 28) * hgr / 5
                img *= (1 - _mask(w, h, lambda d, hx=hx, ry=ry: d.rectangle(
                    [hx, ry, hx + (x1 - x0) * .12, ry + (y1 - y0) * .32], fill=255), blur=1.4)[:, :, None] * .30)
        img *= (1 - _mask(w, h, lambda d, x1=x1: d.rectangle([x1 - 3, y0, x1 + 2, y1], fill=255),
                          blur=0.9)[:, :, None] * 0.5)
    img *= (1 - _mask(w, h, lambda d: d.rectangle([0, y1, w, h], fill=255), blur=w * .012)[:, :, None] * .5)
    return img


def _v_dolly(w, h, t, warmth, seed, accent, r):
    """
    Непрерывный пролёт камеры по одному помещению.

    Кадр строится настоящей перспективой: панель на мировой глубине z
    проецируется как k = (z - a) / ((z - a) + f), где a — то, насколько
    камера уехала вперёд. Поэтому соседние кадры отличаются чуть-чуть,
    и последовательность читается как движение, а не как смена сцен.
    """
    F = 5.0                      # фокусное расстояние сцены
    ADVANCE = 9.0                # на сколько «метров» уезжает камера за весь скролл
    a = t * ADVANCE
    vx, vy = w * (0.50 + 0.04 * math.sin(t * 1.6)), h * 0.555

    def k_of(z):
        d = z - a
        return None if d < 0.12 else d / (d + F)

    def P(near, k):
        return (near[0] + (vx - near[0]) * k, near[1] + (vy - near[1]) * k)

    # опорные точки кадра: края стен и пола на нулевой глубине
    L_TOP, L_BOT = (-w * 0.10, -h * 0.12), (-w * 0.10, h * 1.12)
    R_TOP, R_BOT = (w * 1.10, -h * 0.12), (w * 1.10, h * 1.12)
    CEIL_L, CEIL_R = (-w * 0.10, -h * 0.12), (w * 1.10, -h * 0.12)

    img = _base(w, h, warmth, 0.42, 1.05)

    # ---------- пол: уходит к точке схода ----------
    zs = [i * 0.75 for i in range(0, 46)]
    ks = [(z, k_of(z)) for z in zs]
    ks = [(z, k) for z, k in ks if k is not None]
    if len(ks) > 1:
        k0, k1 = ks[0][1], ks[-1][1]
        floor = _mask(w, h, lambda d: d.polygon(
            [P(L_BOT, k0), P(R_BOT, k0), P(R_BOT, k1), P(L_BOT, k1)], fill=255), blur=1.0)
        img = img * (1 - floor[:, :, None] * 0.62) + floor[:, :, None] * GRAPHITE * 0.9
        # потолок
        ceil = _mask(w, h, lambda d: d.polygon(
            [P(CEIL_L, k0), P(CEIL_R, k0), P(CEIL_R, k1), P(CEIL_L, k1)], fill=255), blur=1.0)
        img = img * (1 - ceil[:, :, None] * 0.55)

    # ---------- левая стена: ритм окон, источник света ----------
    for i in range(len(ks) - 1):
        (z0, ka), (z1, kb) = ks[i], ks[i + 1]
        if int(z0 / 0.75) % 3:                     # окно через каждые три шага
            continue
        quad = [P(L_TOP, ka), P(L_TOP, kb), P(L_BOT, kb), P(L_BOT, ka)]
        # проём: вертикально от 12% до 68% высоты стены
        def lerp2(p, q, f): return (p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f)
        win = [lerp2(quad[0], quad[3], 0.12), lerp2(quad[1], quad[2], 0.12),
               lerp2(quad[1], quad[2], 0.70), lerp2(quad[0], quad[3], 0.70)]
        depth_fade = max(0.0, 1.0 - ka * 1.15)
        halo = _mask(w, h, lambda d: d.polygon(win, fill=255), blur=w * 0.045)
        img += halo[:, :, None] * (MILK * 0.30 + BRONZE * 0.08 * warmth) * depth_fade
        m = _mask(w, h, lambda d: d.polygon(win, fill=255), blur=1.0)
        img = img * (1 - m[:, :, None] * 0.92) + m[:, :, None] * 0.92 * \
            (MILK * (0.46 + 0.10 * warmth)) * (0.45 + 0.55 * depth_fade)
        # световое пятно на полу напротив окна
        pool = _mask(w, h, lambda d: d.polygon(
            [P(L_BOT, ka), P(L_BOT, kb),
             lerp2(P(L_BOT, kb), P(R_BOT, kb), 0.55), lerp2(P(L_BOT, ka), P(R_BOT, ka), 0.55)],
            fill=255), blur=w * 0.03)
        img += pool[:, :, None] * (MILK * 0.15 + BRONZE * 0.04) * depth_fade

    # ---------- правая стена: ряд фасадов со световой линией ----------
    def lerp2(p, q, f): return (p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f)
    for i in range(len(ks) - 1):
        (z0, ka), (z1, kb) = ks[i], ks[i + 1]
        quad = [P(R_TOP, ka), P(R_TOP, kb), P(R_BOT, kb), P(R_BOT, ka)]
        lit = 0.42 + 0.75 * max(0.0, 1.0 - ka * 1.25) * (0.85 + 0.3 * ((i * 37) % 100) / 100)
        face = _mask(w, h, lambda d: d.polygon(quad, fill=255), blur=0.6)
        img = img * (1 - face[:, :, None] * 0.90) + face[:, :, None] * 0.90 * \
            (GRAPHITE * 2.5 + BRONZE * 0.07 * warmth) * lit
        seam = _mask(w, h, lambda d: d.line([P(R_TOP, kb), P(R_BOT, kb)], fill=255, width=2), blur=0.8)
        img += seam[:, :, None] * MILK * 0.12 * max(0.0, 1.0 - ka * 1.3)

    # ---------- подсветка под верхним ярусом: одна непрерывная линия ----------
    if len(ks) > 1:
        top_a = lerp2(P(R_TOP, ks[0][1]), P(R_BOT, ks[0][1]), 0.52)
        top_b = lerp2(P(R_TOP, ks[-1][1]), P(R_BOT, ks[-1][1]), 0.52)
        led = _mask(w, h, lambda d: d.line([top_a, top_b], fill=255, width=3), blur=2.6)
        img += led[:, :, None] * BRONZE * (0.75 + 0.9 * accent)
        glow = _mask(w, h, lambda d: d.line([top_a, top_b], fill=255, width=int(h * 0.055)),
                     blur=h * 0.035)
        img += glow[:, :, None] * BRONZE * (0.16 + 0.5 * accent)
        shelf = _mask(w, h, lambda d: d.polygon(
            [lerp2(P(R_TOP, ks[0][1]), P(R_BOT, ks[0][1]), 0.52),
             lerp2(P(R_TOP, ks[-1][1]), P(R_BOT, ks[-1][1]), 0.52),
             lerp2(P(R_TOP, ks[-1][1]), P(R_BOT, ks[-1][1]), 0.575),
             lerp2(P(R_TOP, ks[0][1]), P(R_BOT, ks[0][1]), 0.60)], fill=255), blur=0.9)
        img += shelf[:, :, None] * MILK * 0.16

    # ---------- подвесы над проходом ----------
    for j in range(1, 9):
        k = k_of(j * 2.4)
        if k is None or k > 0.86:
            continue
        cx = lerp2(P(L_TOP, k), P(R_TOP, k), 0.42)
        drop = h * 0.20 * (1 - k)
        bulb = _mask(w, h, lambda d: d.ellipse(
            [cx[0] - w * .045 * (1 - k), cx[1] + drop - h * .03 * (1 - k),
             cx[0] + w * .045 * (1 - k), cx[1] + drop + h * .07 * (1 - k)], fill=255), blur=w * 0.022)
        img += bulb[:, :, None] * (BRONZE * 0.55 + MILK * 0.20) * warmth * max(0.0, 1 - k * 1.1)

    return img


VARIANTS = {"perspective": _v_perspective, "elevation": _v_elevation, "detail": _v_detail,
            "openspace": _v_openspace, "wardrobe": _v_wardrobe, "dolly": _v_dolly}


def interior(w, h, t=0.0, warmth=1.0, seed=1, shaft=0.34, accent=0.0,
             variant="perspective", exposure=1.0, zoom=1.0):
    """
    Тёмный интерьерный кадр как архитектурная сцена, а не градиент.
    variant — тип съёмки: perspective / elevation / detail / openspace / wardrobe.
    t — положение «камеры» 0..1 (для scroll-scrub в hero).
    """
    r = np.random.default_rng(seed)
    img = VARIANTS[variant](w, h, t, warmth, seed, accent, r)
    return _finish(img, w, h, seed, t, shaft, exposure, zoom)


# ---------------------------------------------------------------- MATERIALS
def wood(w, h, seed=3, tone=(0.44, 0.31, 0.20), freq=0.06, vertical=False, contrast=0.20):
    if vertical:                      # текстура вдоль другой оси — считаем и разворачиваем
        img = wood(h, w, seed=seed, tone=tone, freq=freq, contrast=contrast)
        return np.transpose(img, (1, 0, 2))
    y, x = np.mgrid[0:h, 0:w]
    warp = fbm(h, w, 5, 3, seed=seed) * 26
    rings = np.sin((x * freq + warp) + np.sin(y * 0.006) * 5)
    fibre = fbm(h, w, 6, 40, seed=seed + 1)
    v = 0.62 + contrast * rings + 0.22 * (fibre - 0.5)
    img = np.array(tone)[None, None, :] * v[:, :, None] * 1.5
    img += light_shaft(h, w, -18, 0.4, 0.34)[:, :, None] * MILK * 0.10
    img *= vignette(h, w, 0.42)[:, :, None]
    return img + grain(h, w, 0.012, seed)


def stone(w, h, seed=5, tone=(0.30, 0.29, 0.28), scale=2, sharp=7.0, power=2, invert=False):
    base = fbm(h, w, 6, 3, seed=seed)
    veins = np.abs(fbm(h, w, 5, scale, seed=seed + 7) - 0.5)
    veins = np.clip(1.0 - veins * sharp, 0, 1) ** power
    v = 0.55 + 0.35 * base
    img = np.array(tone)[None, None, :] * v[:, :, None] * 1.7
    if invert:                         # мрамор: светлое поле, прожилки тёмные
        img *= 1.55
        img *= (1 - veins[:, :, None] * 0.62)
        return (img + light_shaft(h, w, -34, 0.3, 0.3)[:, :, None] * MILK * 0.06) \
            * vignette(h, w, 0.40)[:, :, None] + grain(h, w, 0.010, seed)
    img += veins[:, :, None] * (MILK * 0.30 + BRONZE * 0.06)
    img += light_shaft(h, w, -34, 0.3, 0.3)[:, :, None] * MILK * 0.08
    img *= vignette(h, w, 0.45)[:, :, None]
    return img + grain(h, w, 0.010, seed)


def metal(w, h, seed=9, tone=BRONZE * 0.55):
    y, x = np.mgrid[0:h, 0:w]
    brushed = fbm(h, w, 5, 2, seed=seed)
    streak = np.asarray(Image.fromarray(((rng.random((h, w))) * 255).astype(np.uint8))
                        .filter(ImageFilter.GaussianBlur(0.4)).resize((w, h))) / 255.0
    streak = np.asarray(Image.fromarray((streak * 255).astype(np.uint8))
                        .filter(ImageFilter.BoxBlur(0)).resize((w, h))) / 255.0
    sweep = 0.5 + 0.5 * np.cos((x / w * 2.2 + y / h * 0.5) * math.pi)
    v = 0.34 + 0.42 * sweep + 0.16 * (brushed - 0.5) + 0.10 * (streak - 0.5)
    img = np.array(tone)[None, None, :] * v[:, :, None] * 2.1
    img += (sweep ** 6)[:, :, None] * MILK * 0.22
    img *= vignette(h, w, 0.5)[:, :, None]
    return img + grain(h, w, 0.008, seed)


def matte(w, h, seed=11, tone=(0.13, 0.13, 0.125)):
    v = 0.8 + 0.2 * fbm(h, w, 6, 60, seed=seed)
    img = np.array(tone)[None, None, :] * v[:, :, None] * 2.2
    img += light_shaft(h, w, -20, 0.62, 0.42)[:, :, None] * MILK * 0.13
    img *= vignette(h, w, 0.4)[:, :, None]
    return img + grain(h, w, 0.014, seed)


def textile(w, h, seed=13, tone=(0.30, 0.28, 0.25)):
    y, x = np.mgrid[0:h, 0:w]
    weave = (np.sin(x * 0.55) * np.sin(y * 0.55)) * 0.5 + 0.5
    soft = fbm(h, w, 5, 6, seed=seed)
    v = 0.50 + 0.38 * weave + 0.20 * (soft - 0.5)
    img = np.array(tone)[None, None, :] * v[:, :, None] * 1.9
    img += light_shaft(h, w, -30, 0.35, 0.36)[:, :, None] * MILK * 0.10
    img *= vignette(h, w, 0.45)[:, :, None]
    return img + grain(h, w, 0.016, seed)


def glow_detail(w, h, seed=17):
    """Макро: скрытая фурнитура / LED-подсветка — тёмный кадр с тёплой линией."""
    img = np.ones((h, w, 3)) * GRAPHITE * 1.05
    r = np.random.default_rng(seed)
    for k in range(3):
        gy = int(h * (0.25 + 0.3 * k + 0.08 * r.random()))
        if gy >= h:
            continue
        band = np.exp(-((np.arange(h) - gy) ** 2) / (2 * (h * 0.012) ** 2))[:, None, None]
        img += band * (BRONZE * (0.85 - 0.2 * k))
        img[max(0, gy - int(h * .09)):gy] *= 1.25
    img += light_shaft(h, w, -12, 0.5, 0.5)[:, :, None] * MILK * 0.05
    img *= vignette(h, w, 0.55)[:, :, None]
    return img + grain(h, w, 0.014, seed)


# ---------------------------------------------------------------- ГЕНЕРАЦИЯ
def main():
    made = []

    # HERO: один непрерывный пролёт камеры по помещению.
    # Кадры отличаются друг от друга минимально — при скрабе это читается
    # как движение камеры, а не как перелистывание разных снимков.
    FRAMES = 40
    for i in range(FRAMES):
        t = i / (FRAMES - 1)
        made.append(save(interior(1152, 648, t=t, warmth=1.05 + 0.35 * t, seed=101,
                                  variant="dolly", shaft=0.30 + 0.14 * t,
                                  accent=0.10 + 0.40 * t, exposure=0.92 + 0.30 * t),
                         f"hero-{i:02d}.jpg", quality=70))

    # КАТАЛОГ: четыре разных пространства — четыре разных типа кадра
    for name, var, sd, wm, ac in [("kitchen", "perspective", 211, 1.20, 0.16),
                                  ("wardrobe-sliding", "elevation", 224, 0.90, 0.10),
                                  ("dressing", "wardrobe", 233, 1.00, 0.20),
                                  ("living", "openspace", 246, 1.30, 0.12)]:
        made.append(save(interior(1400, 1000, t=0.3, warmth=wm, seed=sd, variant=var,
                                  shaft=0.32, accent=ac, exposure=1.05), f"cat-{name}.jpg"))

    # ПРОЕКТЫ: у каждого проекта — wide / vertical / macro, и все кадры разные
    proj = [("p01-wide", 1600, 1000, 301, "openspace", 1.15), ("p01-tall", 900, 1350, 302, "wardrobe", 1.00),
            ("p01-detail", 900, 900, 303, "detail", 1.30),
            ("p02-wide", 1600, 1000, 314, "perspective", 1.25), ("p02-tall", 900, 1350, 317, "elevation", 0.95),
            ("p02-detail", 900, 900, 319, "detail", 1.10),
            ("p03-pano", 1900, 800, 322, "perspective", 1.05), ("p03-tall", 900, 1350, 325, "wardrobe", 1.20),
            ("p03-detail", 900, 900, 328, "detail", 0.95),
            ("p04-wide", 1600, 1000, 331, "elevation", 1.30), ("p04-tall", 900, 1350, 336, "openspace", 1.10),
            ("p04-detail", 900, 900, 339, "detail", 1.25)]
    for name, w, h, sd, var, wm in proj:
        made.append(save(interior(w, h, t=0.45, warmth=wm, seed=sd, variant=var,
                                  shaft=0.26 + (sd % 5) * 0.06, accent=0.08 + (sd % 4) * 0.04,
                                  exposure=1.0), f"proj-{name}.jpg"))

    # CASE STUDY / CTA / HOTSPOT — крупные ключевые кадры
    made.append(save(interior(1920, 1080, t=0.5, warmth=1.20, seed=402, variant="openspace",
                              shaft=0.38, accent=0.16, exposure=1.08), "case-01.jpg"))
    made.append(save(interior(1920, 1080, t=0.65, warmth=1.35, seed=417, variant="perspective",
                              shaft=0.44, accent=0.18, exposure=1.02), "cta-measure.jpg"))
    made.append(save(interior(1800, 1150, t=0.2, warmth=1.15, seed=428, variant="elevation",
                              shaft=0.30, accent=0.14, exposure=1.10), "hotspot-kitchen.jpg"))

    # ПРОИЗВОДСТВО: шесть этапов, чередуем крупность плана
    stages = [("material", "detail", 0.70), ("cutting", "elevation", 0.80), ("finishing", "detail", 0.95),
              ("assembly", "wardrobe", 1.05), ("qc", "detail", 1.15), ("install", "perspective", 1.30)]
    for i, (st, var, wm) in enumerate(stages):
        made.append(save(interior(1500, 1000, t=i / 5, warmth=wm, seed=503 + i * 3, variant=var,
                                  shaft=0.22 + 0.10 * i, accent=0.05 * i, exposure=0.95 + 0.03 * i),
                         f"prod-{i + 1:02d}-{st}.jpg"))

    # ОТЗЫВЫ: интерьеры клиентов
    for i, var in enumerate(["openspace", "perspective", "elevation"]):
        made.append(save(interior(1500, 1100, t=0.4, warmth=1.05 + 0.15 * i, seed=604 + i * 5, variant=var,
                                  shaft=0.30 + 0.08 * i, accent=0.16, exposure=1.35),
                         f"review-{i + 1:02d}.jpg"))

    # МАТЕРИАЛЫ: макро
    # Размеры соответствуют мозаике в секции «Материалы» (см. sections.css .mats)
    mats = [
        ("veneer",   wood,        (1000, 1250), dict(seed=701, freq=0.055)),
        ("enamel",   matte,       (1400, 960),  dict(seed=711)),
        ("stone",    stone,       (1400, 960),  dict(seed=705, scale=2, sharp=7.0)),
        ("metal",    metal,       (1000, 1250), dict(seed=709)),
        ("hardware", glow_detail, (1000, 1000), dict(seed=715)),
        ("oak",      wood,        (1000, 1000), dict(seed=733, tone=(0.47, 0.36, 0.24),
                                                     freq=0.022, vertical=True, contrast=0.12)),
        ("marble",   stone,       (1000, 1000), dict(seed=747, tone=(0.34, 0.335, 0.33),
                                                     scale=3, sharp=9.0, power=1, invert=True)),
        ("textile",  textile,     (1680, 490),  dict(seed=713)),
    ]
    for name, fn, size, kw in mats:
        made.append(save(fn(*size, **kw), f"mat-{name}.jpg"))

    # СЕРТИФИКАТЫ: светлые «документы»
    for i in range(4):
        page = np.ones((1400, 990, 3)) * np.array([0.90, 0.89, 0.87])
        page *= vignette(1400, 990, 0.22)[:, :, None]
        for k in range(16):
            y0 = 300 + k * 58
            wdt = int(560 * (0.45 + 0.55 * rng.random()))
            page[y0:y0 + 12, 150:150 + wdt] *= 0.55
        page[150:200, 150:520] *= 0.28
        page[1150:1240, 150:420] *= 0.62
        page += grain(1400, 990, 0.008, 800 + i)
        made.append(save(page, f"cert-{i + 1:02d}.jpg", quality=80))

    # OG-превью
    made.append(save(interior(1200, 630, t=0.5, warmth=1.30, seed=901, variant="perspective",
                              shaft=0.40, accent=0.18, exposure=1.10), "og.jpg"))

    print(f"generated {len(made)} files -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
