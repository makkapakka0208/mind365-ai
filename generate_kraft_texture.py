"""
Generate a realistic kraft paper texture image (1920x1200) for web background tiling.
"""

import numpy as np
from PIL import Image, ImageFilter
import random

def generate_kraft_texture(width=1920, height=1200, seed=42):
    rng = np.random.default_rng(seed)
    random.seed(seed)

    # --- Base color field: warm brown-yellow gradient (center brighter, edges darker) ---
    base_warm = np.array([240, 228, 204], dtype=np.float32)   # #F0E4CC
    base_dark = np.array([220, 205, 175], dtype=np.float32)   # slightly darker

    # Radial gradient: center lighter, edges darker
    cx, cy = width / 2, height / 2
    xx, yy = np.meshgrid(np.arange(width), np.arange(height))
    dist = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2)
    dist = np.clip(dist, 0, 1)

    # Smooth vignette factor
    vignette = dist ** 1.4 * 0.12  # darkens edges by up to ~12% value

    img_base = np.zeros((height, width, 3), dtype=np.float32)
    for c in range(3):
        img_base[:, :, c] = base_warm[c] - (base_warm[c] - base_dark[c]) * vignette

    # --- Large-scale uneven color variation (natural paper tone differences) ---
    # Low-frequency noise patches
    lf_scale = 12
    lf_h, lf_w = height // lf_scale, width // lf_scale
    lf_noise = rng.normal(0, 6, (lf_h, lf_w, 3)).astype(np.float32)
    lf_img = Image.fromarray(np.clip(lf_noise + 128, 0, 255).astype(np.uint8))
    lf_img = lf_img.resize((width, height), Image.BICUBIC)
    lf_arr = np.array(lf_img).astype(np.float32) - 128
    img_base += lf_arr * 0.55

    # Medium-frequency blotches (aging / humidity marks)
    mf_scale = 4
    mf_h, mf_w = height // mf_scale, width // mf_scale
    mf_noise = rng.normal(0, 4, (mf_h, mf_w, 3)).astype(np.float32)
    mf_img = Image.fromarray(np.clip(mf_noise + 128, 0, 255).astype(np.uint8))
    mf_img = mf_img.resize((width, height), Image.BICUBIC)
    mf_arr = np.array(mf_img).astype(np.float32) - 128
    img_base += mf_arr * 0.4

    # --- Paper fiber texture (fine directional streaks) ---
    # Horizontal fiber: very fine high-freq noise stretched horizontally
    fiber_h = rng.normal(0, 1, (height, width)).astype(np.float32)
    fiber_img_h = Image.fromarray(np.clip(fiber_h + 128, 0, 255).astype(np.uint8), mode='L')
    # Blur strongly in horizontal direction to simulate fibers
    fiber_img_h = fiber_img_h.filter(ImageFilter.GaussianBlur(radius=0))
    # Stretch horizontally by applying a 1D box filter
    fiber_arr_h = np.array(fiber_img_h).astype(np.float32) - 128

    # Use scipy for directional blur if available, else manual approach
    try:
        from scipy.ndimage import uniform_filter1d
        fiber_arr_h = uniform_filter1d(fiber_arr_h, size=18, axis=1)  # horizontal fiber
        fiber_arr_v = uniform_filter1d(rng.normal(0, 1, (height, width)).astype(np.float32), size=6, axis=0)
    except ImportError:
        # Fallback: PIL-based directional blur
        tmp = Image.fromarray(np.clip(fiber_arr_h + 128, 0, 255).astype(np.uint8), mode='L')
        fiber_arr_h = np.array(tmp).astype(np.float32) - 128
        fiber_arr_v = rng.normal(0, 1, (height, width)).astype(np.float32)

    # Combine fibers (mostly horizontal, slight vertical)
    fiber = fiber_arr_h * 0.75 + fiber_arr_v * 0.25

    # Apply fiber to all channels with slight color tint
    fiber_tint = np.stack([
        fiber * 1.0,   # R
        fiber * 0.85,  # G (less green = warmer)
        fiber * 0.55,  # B (much less blue = brown)
    ], axis=2)
    img_base += fiber_tint * 2.2

    # --- Fine speckles (tiny dark and light dots — paper pulp variation) ---
    speckle_dark = (rng.random((height, width)) < 0.0035).astype(np.float32)
    speckle_light = (rng.random((height, width)) < 0.002).astype(np.float32)

    # Slight blur so speckles look organic
    sp_d_img = Image.fromarray((speckle_dark * 255).astype(np.uint8), mode='L')
    sp_d_img = sp_d_img.filter(ImageFilter.GaussianBlur(radius=0.7))
    sp_l_img = Image.fromarray((speckle_light * 255).astype(np.uint8), mode='L')
    sp_l_img = sp_l_img.filter(ImageFilter.GaussianBlur(radius=0.5))

    sp_d = (np.array(sp_d_img).astype(np.float32) / 255.0)
    sp_l = (np.array(sp_l_img).astype(np.float32) / 255.0)

    for c in range(3):
        img_base[:, :, c] -= sp_d * 22
        img_base[:, :, c] += sp_l * 18

    # --- Subtle crease marks (very faint quasi-linear shadows) ---
    for _ in range(6):
        # Horizontal-ish crease
        y0 = rng.integers(height // 4, 3 * height // 4)
        dy = rng.integers(-30, 30)
        crease_strength = rng.uniform(0.3, 1.2)
        crease_width = rng.uniform(2, 5)

        yy_crease = np.arange(height)
        xx_crease = np.arange(width)
        # Slight curve: parabolic deviation
        t = np.linspace(-1, 1, width)
        curve = (y0 + dy * t + rng.uniform(-15, 15) * t ** 2).astype(np.float32)
        crease_mask = np.zeros((height, width), dtype=np.float32)
        for x in range(0, width, 1):
            yc = curve[x]
            ys = np.arange(height)
            gauss = np.exp(-0.5 * ((ys - yc) / crease_width) ** 2)
            crease_mask[:, x] = gauss * crease_strength

        # Darken slightly along crease
        for c in range(3):
            img_base[:, :, c] -= crease_mask * 6

    # --- Slight high-frequency grain (photographic grain feel) ---
    grain = rng.normal(0, 1.8, (height, width)).astype(np.float32)
    for c in range(3):
        img_base[:, :, c] += grain

    # --- Clamp and convert ---
    img_base = np.clip(img_base, 0, 255).astype(np.uint8)
    result = Image.fromarray(img_base, mode='RGB')

    # Final very subtle overall blur to soften harshness (keep texture soft)
    result = result.filter(ImageFilter.GaussianBlur(radius=0.4))

    return result


if __name__ == "__main__":
    print("Generating kraft paper texture...")
    img = generate_kraft_texture(1920, 1200, seed=2024)
    out_path = "public/kraft-bg.jpg"
    import os
    os.makedirs("public", exist_ok=True)
    img.save(out_path, "JPEG", quality=95, optimize=True)
    print(f"Saved: {out_path}  ({img.size[0]}x{img.size[1]})")
