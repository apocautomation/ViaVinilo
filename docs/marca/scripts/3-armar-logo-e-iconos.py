import base64, io, sys
from PIL import Image
d = sys.argv[1]
mascot = Image.open(f"{d}/mascota-vinilos.png")
# Versión liviana para incrustar en el logo (se muestra a menos de 200 px de alto).
small = mascot.resize((round(mascot.width * 420 / mascot.height), 420), Image.LANCZOS)
buf = io.BytesIO(); small = small.quantize(colors=64, method=Image.Quantize.FASTOCTREE); small.save(buf, "PNG", optimize=True)
png64 = base64.b64encode(buf.getvalue()).decode()
text_svg = open(f"{d}/texto.svg", encoding="utf-8").read()
import re
inner = re.search(r"<svg[^>]*>(.*)</svg>", text_svg, re.S).group(1)

# Medidas en puntos del PDF: la mascota vieja medía 116,9 de alto y el texto 179,1 × 111,66,
# 4,96 por debajo del borde superior de la mascota.
H = 116.9
mw = round(H * mascot.width / mascot.height, 2)
gap = 8
tw, th, ty = 179.36, 111.66, 4.96
W = round(mw + gap + tw, 2)
out = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Via Vinilo · Mayorista gráfico">
  <image href="data:image/png;base64,{png64}" x="0" y="0" width="{mw}" height="{H}"/>
  <g transform="translate({round(mw + gap, 2)} {ty})">{inner}</g>
</svg>
'''
open(f"{d}/logo-mascota.svg", "w", encoding="utf-8").write(out)
print("logo:", W, "x", H, "pt ·", round(len(out) / 1024), "KB · mascota incrustada", small.size)

# Íconos para instalar la app: la mascota sola, centrada sobre blanco, con margen.
for px in (192, 512, 180):
    canvas = Image.new("RGB", (px, px), (255, 255, 255))
    target = round(px * 0.82)
    m = mascot.copy(); m.thumbnail((target, target), Image.LANCZOS)
    canvas.paste(m, ((px - m.width) // 2, (px - m.height) // 2), m)
    canvas.save(f"{d}/icon-{px}.png", optimize=True)
print("íconos listos")
