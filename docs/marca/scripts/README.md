# Logo de la app de clientes

El logo de la app es el último del PDF (`../logos-via-vinilo.pdf`, texto apilado "VIA / VINILO / MAYORISTA GRAFICO") con la **mascota de los vinilos** en lugar de la mascota original (D-031 en `docs/DESARROLLO.md`).

Para regenerarlo (Python con Pillow, NumPy y PyMuPDF):

```bash
python 1-recortar-mascota.py ../mascota-vinilos-original.jpg <carpeta>/mascota-vinilos.png
python 2-texto-del-pdf.py ../logos-via-vinilo.pdf <carpeta>/texto.svg
python 3-armar-logo-e-iconos.py <carpeta>
```

1. Saca el fondo gris claro de la imagen de la mascota (relleno desde los bordes; el contorno oscuro lo frena) y la recorta.
2. Copia del PDF solo los trazos vectoriales del texto del último logo, sin la mascota vieja.
3. Arma `logo-mascota.svg` (mascota a la altura de la original, texto vectorial a la derecha) y los íconos de instalación de 192, 512 y 180 px (mascota sola sobre blanco).

Después se copian a `apps/pwa/public/logo-mascota.svg` y `apps/pwa/public/icons/` (el de 180 px como `apple-touch-icon.png`).
