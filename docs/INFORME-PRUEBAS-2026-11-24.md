# Informe de pruebas de punta a punta · 24/11/2026

Prueba hecha en el entorno local (base en memoria, API, ERP y app de clientes), con un dueño y un cliente de prueba. El worker no corrió como servicio: se ejecutó a mano una vuelta del control de archivos y de los avisos. En producción no se probó con sesión iniciada.

## Recorrido probado

| Paso | Resultado |
| --- | --- |
| Cliente inicia sesión en la app | Bien |
| Cliente manda un trabajo desde "Enviar" (servicio, medida, copias, sucursal, aclaración, archivo PNG) | Bien: pedido VV-000001 creado con la medida exacta |
| Cliente manda un segundo trabajo con un archivo de baja resolución | Bien: pedido VV-000002 creado |
| Control automático del archivo | Bien: el primero quedó "Archivo controlado: 254 dpi"; el segundo pasó solo a "Archivo con error" |
| Avisos al cliente (recibido, error, cotizado, listo) | Bien: llegaron al chat y a "Avisos" |
| Tablero: tarjetas, sucursal de retiro en la tarjeta, columna "Esperando seña" | Bien |
| Panel del pedido: cotizar con seña y fecha día/mes | Bien: quedó "Esperando seña" con $ 24.000 y seña $ 12.000 |
| Descargar el archivo antes de cotizar | Bien (respuesta correcta de la API, archivo completo) |
| Avanzar: seña → impreso → terminado → entregado | Bien, con historial completo |
| Cliente ve el pedido en la app (estado, precio, seña, saldo, retiro, seguimiento) | Bien |
| Corregir la medida desde el panel | Guarda bien, pero ver A-2 |
| Arrastrar tarjetas | Con eventos simulados funciona (avanza al paso siguiente y frena los saltos). Con el mouse real no se pudo comprobar: la herramienta de prueba no genera el arrastre nativo del navegador. Ver A-1 |
| Eliminar pedido | Probado antes en local: bien |

## A. Para arreglar (funcionan mal o confunden)

1. **Arrastrar tarjetas, sin confirmar con mouse real.** Hay que probarlo a mano en Chrome. Además, el arrastre nativo del navegador no funciona en pantallas táctiles (tablet en el taller): si van a usar tablet, hay que hacerlo de otra forma.
2. ✅ Resuelto en D-091. **Corregir la medida no rehace el control si el pedido ya está en "Archivo con error".** Queda el cartel viejo ("Para 58 × 100 cm da 25 dpi") aunque la medida ya sea otra. Hoy la única salida es tocar "Archivo corregido", que le avisa al cliente "recibimos el archivo corregido" sin que haya mandado nada.
3. ✅ Resuelto en D-091. **Al corregir la medida, el título del pedido sigue mostrando la medida vieja** (tablero, Pedidos y app del cliente), porque está copiada en la descripción.
4. ✅ Resuelto en D-089. **Inicio: el cuadro "Conversaciones" siempre dice que no hay.** Es un texto fijo; nunca consulta. En producción hay 312 conversaciones, 283 sin leer.
5. ✅ Resuelto en D-089. **Inicio: "En producción" cuenta todo lo que no está entregado.** En producción muestra 571 y en realidad 570 están en "Archivo recibido", sin cotizar ni imprimir. También cuenta los pedidos con error de archivo.
6. ✅ Resuelto en D-089. **Inicio: el gráfico "Producción por sector" no muestra los cotizados que esperan seña como grupo aparte** y no distingue los sub-servicios de Gran Formato.
7. ✅ Resuelto en D-091. **Horas en formato 12 h en la app del cliente** ("04:51 p. m.", "27/11 05:30 p. m."). El ERP ya usa 24 h; la app tiene que usar lo mismo.
8. ✅ Resuelto en D-091. **El aviso de error le dice al cliente "mandalo corregido por mail a la casilla"**, cuando la app le ofrece "Reenviar el archivo por el chat". Además queda con doble punto ("pixelado..").
9. ✅ Resuelto en D-091. **Textos de los avisos muy largos**: repiten entre paréntesis toda la descripción del pedido ("20 x 30 cm · 4 copias · Servicio: DTF Textil · Prueba de punta a punta…").
10. ✅ Resuelto en D-091. **Descripción redundante en los pedidos de la app**: "DTF Textil · 58 × 100 cm · 1 copia · Servicio: DTF Textil".
11. ✅ Resuelto en D-089. **Configuración → "Qué puede hacer cada rol" quedó desactualizado**: dice que producción descarga el archivo "cuando está liberado" (ya no hay bloqueo) y no menciona eliminar pedidos.
12. **Pedido entregado con "Saldo a pagar $ 12.000"** en la app: el sistema no registra el pago del saldo (es de la Etapa 3), así que el cliente lo va a ver siempre pendiente.

## B. Pedido por Ezequiel el 24/11 (nuevo)

✅ Los cuatro puntos se resolvieron en D-089.

1. **Estadísticas de Inicio correctas** (puntos A-4, A-5 y A-6).
2. **Total facturado** en Inicio. A definir qué cuenta: lo cotizado, lo entregado o lo cobrado. Hoy el sistema solo conoce precio cotizado y seña; la facturación ARCA y las cobranzas son de la Etapa 3.
3. **Filtrar las estadísticas por pedidos** (por fecha, sector, estado).
4. **Permiso por rol para ver los montos y el total facturado.** Hoy hay tres roles fijos (Dueño, Producción, Atención) sin permisos configurables; hay que agregar el permiso y aplicarlo también en la API.

## C. Detalles visuales

- Los desplegables del panel del pedido (Retiro, Servicio, Máquina) se ven con el estilo crudo del navegador, distintos del resto del ERP.
- El tablero deja mucho espacio vacío debajo de las columnas cuando hay pocos pedidos.
- "Administrar tableros" lista los sub-servicios mezclados con los tableros, sin indicar de cuál dependen.
- En "Mi cuenta" de la app aparece una tarjeta "Mis puntos · Etapa 4" vacía.
- La Ayuda de la app todavía explica "mandá el archivo por mail a la casilla" como camino principal; conviene que nombre primero el formulario de "Enviar".

## D. No probado

- Arrastre con mouse real y uso en tablet.
- Notificaciones push en un teléfono.
- Entrada de pedidos por mail y descarga de links (ya probadas en producción en días anteriores).
- Envío real de mails de aviso.
- Todo con sesión iniciada en producción.
