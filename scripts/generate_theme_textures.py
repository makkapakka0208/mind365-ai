"""
生成两套主题背景纹理：
  public/textures/plaster.jpg  —— 象牙白裂纹灰泥（浅色 Plaster 主题）
  public/textures/patina.jpg   —— 青铜锈绿（深色 Patina 主题）
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


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    plaster().save(os.path.join(OUT, "plaster.jpg"), quality=82, optimize=True, progressive=True)
    patina().save(os.path.join(OUT, "patina.jpg"), quality=80, optimize=True, progressive=True)
    print("done")
