"""
生成主题背景纹理：
  public/textures/plaster.jpg  —— 象牙白裂纹灰泥（浅色 Plaster 主题）
  public/textures/patina.jpg   —— 青铜锈绿（深色 Patina 主题）
  public/textures/sky-light.jpg —— 天蓝 · 晴空云海（浅色）
用法：python scripts/generate_theme_textures.py
"""

import os

import numpy as np
from PIL import Image, ImageFilter

W, H = 1920, 1200
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")


def fbm(rng, octaves, base_cell, persistence=0.55):
    """多倍频值噪声：低分辨率随机场双三次放大后叠加。返回 [0,1]。"""
    acc = np.zeros((H, W), np.float32)
    amp, total = 1.0, 0.0
    cell = base_cell
    for _ in range(octaves):
        h, w = max(2, H // cell + 2), max(2, W // cell + 2)
        layer = rng.random((h, w)).astype(np.float32)
        img = Image.fromarray((layer * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        acc += np.asarray(img, np.float32) / 255 * amp
        total += amp
        amp *= persistence
        cell = max(1, cell // 2)
    return acc / total


def voronoi_cracks(rng, n_points, jitter_field, jitter_field_y):
    """F2-F1 距离小的地方是裂缝。用低分辨率计算再放大，保证速度。"""
    scale = 2
    h, w = H // scale, W // scale
    pts = rng.random((n_points, 2)) * [w, h]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # 用噪声扰动坐标，让裂纹不那么笔直
    jf = np.asarray(Image.fromarray((jitter_field * 255).astype(np.uint8)).resize((w, h)), np.float32) / 255
    xx = xx + (jf - 0.5) * 26
    jfy = np.asarray(Image.fromarray((jitter_field_y * 255).astype(np.uint8)).resize((w, h)), np.float32) / 255
    yy = yy + (jfy - 0.5) * 26
    f1 = np.full((h, w), 1e9, np.float32)
    f2 = np.full((h, w), 1e9, np.float32)
    for px, py in pts:
        d = np.hypot(xx - px, yy - py)
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        f1 = np.where(closer, d, f1)
    edge = f2 - f1
    img = Image.fromarray(np.clip(edge * 20, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    return np.asarray(img, np.float32) / 20


def plaster(seed=7):
    rng = np.random.default_rng(seed)
    base = np.array([238, 234, 224], np.float32)  # 象牙灰白
    cool = np.array([222, 222, 212], np.float32)  # 偏冷的阴影
    warm = np.array([244, 236, 220], np.float32)  # 偏暖的高光

    tone = fbm(rng, 6, 320)
    img = base + (tone[..., None] - 0.5) * 2 * (warm - cool) * 0.9

    # 大面积云状明暗
    cloud = fbm(rng, 4, 480)
    img *= (0.95 + cloud[..., None] * 0.08)

    # 裂纹：细线 + 旁边的柔和阴影
    jitter = fbm(rng, 3, 160)
    edge = voronoi_cracks(rng, 140, jitter, fbm(rng, 3, 160))
    line = np.clip(1 - edge / 1.6, 0, 1) ** 2
    shadow = np.clip(1 - edge / 7, 0, 1) ** 2
    # 部分裂纹淡出，不要整齐的网格感
    fade = np.clip(fbm(rng, 3, 260) * 1.8 - 0.35, 0, 1)
    img -= (line * 34 * fade)[..., None]
    img -= (shadow * 7 * fade)[..., None]

    # 细颗粒
    grain = rng.normal(0, 2.2, (H, W, 1)).astype(np.float32)
    img += grain

    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))
    return out


def patina(seed=11):
    rng = np.random.default_rng(seed)
    teal_dark = np.array([34, 58, 62], np.float32)
    teal = np.array([74, 110, 112], np.float32)
    verdigris = np.array([104, 142, 136], np.float32)
    bronze = np.array([96, 78, 50], np.float32)
    umber = np.array([52, 40, 28], np.float32)

    n1 = fbm(rng, 7, 260, 0.6)
    n2 = fbm(rng, 6, 180, 0.6)
    n3 = fbm(rng, 7, 90, 0.62)

    t = np.clip((n1 - 0.3) * 2.2, 0, 1)[..., None]
    img = teal_dark * (1 - t) + teal * t

    # 铜锈亮斑
    v = np.clip((n3 - 0.52) * 4, 0, 1)[..., None]
    img = img * (1 - v * 0.7) + verdigris * v * 0.7

    # 青铜 / 赭石区域
    b = np.clip((n2 - 0.5) * 3.2, 0, 1)[..., None]
    img = img * (1 - b * 0.8) + bronze * b * 0.8

    # 深色氧化斑
    u = np.clip((0.4 - n3) * 4, 0, 1)[..., None]
    img = img * (1 - u * 0.6) + umber * u * 0.6

    grain = rng.normal(0, 5, (H, W, 1)).astype(np.float32)
    img += grain

    # 整体压暗，保证卡片上的浅色文字可读
    img *= 0.78
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))


def cloudscape(sky_top, sky_horizon, lit, shade, glow, seed):
    """梦幻云海：上深下浅的天空 + 地平线暖光 + 一团团堆叠的积云。
    每朵云由若干圆形云团组成：云团顶部受光（lit）、底部背光（shade），
    由远到近绘制，近处的更大、更亮、更清晰。"""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = yy / H

    t = (v ** 0.85)[..., None]
    img = np.array(sky_top, np.float32) * (1 - t) + np.array(sky_horizon, np.float32) * t
    g = np.exp(-(((xx / W - 0.4) / 0.5) ** 2 + ((v - 0.66) / 0.25) ** 2))[..., None] * 0.6
    img = img * (1 - g) + np.array(glow, np.float32) * g

    lit = np.array(lit, np.float32)
    shade = np.array(shade, np.float32)
    # 表面细节：让云团边缘和明暗不那么光滑
    detail = fbm(rng, 5, 60, 0.6)

    # 云：(中心 x, 底边 y, 宽度, 深度 0远-1近)
    clouds = []
    for _ in range(9):  # 远处的小云，偏上
        clouds.append((rng.random(), 0.30 + rng.random() * 0.22, 0.10 + rng.random() * 0.10, rng.random() * 0.3))
    for _ in range(7):  # 中景
        clouds.append((rng.random(), 0.55 + rng.random() * 0.18, 0.18 + rng.random() * 0.14, 0.35 + rng.random() * 0.3))
    for _ in range(5):  # 近景大云，压在画面底部
        clouds.append((rng.random() * 1.1 - 0.05, 0.86 + rng.random() * 0.14, 0.30 + rng.random() * 0.18, 0.7 + rng.random() * 0.3))
    clouds.sort(key=lambda c: c[3])

    for cx, base, width, depth in clouds:
        # 远处的云和天空融合更多
        haze = 1 - depth * 0.75
        c_lit = lit * (1 - haze * 0.35) + img.mean(axis=(0, 1)) * haze * 0.35
        c_shade = shade * (1 - haze * 0.45) + img.mean(axis=(0, 1)) * haze * 0.45
        n = int(10 + width * 40)
        for _ in range(n):
            # 云团沿底边铺开，中间更高
            u = rng.normal(0, 0.33)
            px = (cx + u * width) * W
            r = width * W * (0.10 + rng.random() * 0.16) * (1.25 - abs(u))
            py = base * H - r * (0.3 + rng.random() * 0.9) * (1.2 - abs(u))
            if r < 36:  # 太小的云团会变成孤立的小圆点
                continue
            x0, x1 = int(max(0, px - r * 1.4)), int(min(W, px + r * 1.4))
            y0, y1 = int(max(0, py - r * 1.4)), int(min(H, py + r * 1.4))
            if x0 >= x1 or y0 >= y1:
                continue
            ly, lx = yy[y0:y1, x0:x1], xx[y0:y1, x0:x1]
            d = np.sqrt((lx - px) ** 2 + (ly - py) ** 2) / r
            d = d + (detail[y0:y1, x0:x1] - 0.5) * 0.35
            edge = 0.10 + (1 - depth) * 0.25  # 远处边缘更虚
            alpha = np.clip((1 - d) / edge, 0, 1) * (0.55 + depth * 0.4)
            # 受光：云团上半部分亮、下半部分暗；再叠一点左上方向光
            k = np.clip(0.5 - (ly - py) / r * 0.6 - (lx - px) / r * 0.15 + (detail[y0:y1, x0:x1] - 0.5) * 0.4, 0, 1)
            col = c_shade * (1 - k[..., None]) + c_lit * k[..., None]
            region = img[y0:y1, x0:x1]
            img[y0:y1, x0:x1] = region * (1 - alpha[..., None]) + col * alpha[..., None]

    img += rng.normal(0, 1.2, (H, W, 1)).astype(np.float32)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))


def sky():
    """天蓝：晴空 + 白云，云顶被阳光染一点暖粉，云底淡紫。"""
    return cloudscape(
        sky_top=(150, 198, 242), sky_horizon=(226, 239, 251),
        lit=(255, 250, 248), shade=(196, 204, 230), glow=(252, 236, 236), seed=41,
    )


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    plaster().save(os.path.join(OUT, "plaster.jpg"), quality=82, optimize=True, progressive=True)
    patina().save(os.path.join(OUT, "patina.jpg"), quality=80, optimize=True, progressive=True)
    sky().save(os.path.join(OUT, "sky-light.jpg"), quality=84, optimize=True, progressive=True)
    print("done")
