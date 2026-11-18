import sys, pymupdf
src, out = sys.argv[1], sys.argv[2]
page = pymupdf.open(src)[0]
logo = pymupdf.Rect(156.6, 620.3, 424.9, 740.8)  # con margen: VINILO toca el borde
items = [d for d in page.get_drawings() if logo.contains(d["rect"]) and d["rect"].x0 > 238.8]
box = items[0]["rect"]
for d in items[1:]: box |= d["rect"]
ox, oy = box.x0, box.y0
f = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")
pt = lambda p: f"{f(p.x - ox)} {f(p.y - oy)}"
paths = []
for d in items:
    parts, cur = [], None
    for it in d["items"]:
        op = it[0]
        if op == "l":
            if cur is None or (it[1].x, it[1].y) != cur: parts.append(f"M{pt(it[1])}")
            parts.append(f"L{pt(it[2])}"); cur = (it[2].x, it[2].y)
        elif op == "c":
            if cur is None or (it[1].x, it[1].y) != cur: parts.append(f"M{pt(it[1])}")
            parts.append(f"C{pt(it[2])} {pt(it[3])} {pt(it[4])}"); cur = (it[4].x, it[4].y)
        elif op == "re":
            r = it[1]; parts.append(f"M{f(r.x0-ox)} {f(r.y0-oy)}h{f(r.width)}v{f(r.height)}h{f(-r.width)}Z"); cur = None
        elif op == "qu":
            q = it[1]; parts.append(f"M{pt(q.ul)}L{pt(q.ur)}L{pt(q.lr)}L{pt(q.ll)}Z"); cur = None
    if d.get("closePath"): parts.append("Z")
    fill = d.get("fill")
    color = "#%02X%02X%02X" % tuple(round(c * 255) for c in fill[:3]) if fill else "none"
    rule = ' fill-rule="evenodd"' if d.get("even_odd") else ""
    stroke = ""
    if "s" in d["type"] and d.get("color"):
        sc = "#%02X%02X%02X" % tuple(round(c * 255) for c in d["color"][:3])
        stroke = f' stroke="{sc}" stroke-width="{f(d.get("width") or 1)}" stroke-linejoin="round"'
    paths.append(f'<path fill="{color}"{rule}{stroke} d="{"".join(parts)}"/>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(box.width)} {f(box.height)}">{"".join(paths)}</svg>'
open(out, "w", encoding="utf-8").write(svg)
print(len(items), "trazos ·", round(len(svg) / 1024, 1), "KB ·", f(box.width), "x", f(box.height))
