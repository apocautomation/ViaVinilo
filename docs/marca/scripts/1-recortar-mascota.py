import sys
import numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
w, h = im.size
probe = im.copy()
MARK = (255, 0, 255)
# Relleno desde todo el borde: el fondo gris claro (#F7F7F7) queda marcado; el contorno oscuro de la mascota lo frena.
for x in range(0, w, 7):
    for y in (0, h - 1):
        if probe.getpixel((x, y)) != MARK:
            ImageDraw.floodfill(probe, (x, y), MARK, thresh=14)
for y in range(0, h, 7):
    for x in (0, w - 1):
        if probe.getpixel((x, y)) != MARK:
            ImageDraw.floodfill(probe, (x, y), MARK, thresh=14)
bg = np.all(np.array(probe) == MARK, axis=-1)
rgba = np.dstack([np.array(im), np.where(bg, 0, 255).astype(np.uint8)])
img = Image.fromarray(rgba, "RGBA")
bbox = img.getbbox()
img = img.crop(bbox)
img.save(out)
print("fondo:", round(bg.mean() * 100, 1), "% · recorte:", bbox, "->", img.size)
