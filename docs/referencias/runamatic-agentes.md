# Reglas de negocio de los agentes de IA de Runamatic (Tienda Runa)

Fuente: los 6 agentes configurados en la cuenta "Viaprint" de Tienda Runa (`tiendaruna.io/automatizaciones/agentes`), leídos el 20/11/2026 con la sesión de Ezequiel, sin modificar nada. Sirven de base para el asistente de la app (E2) y para las reglas de producción. Lo que está acá es **lo que hoy le dicen los bots a los clientes**: antes de tomarlo como regla del sistema, se confirma con Verónica (D-046).

Agentes que existen hoy:
1. Toma de pedidos por Telegram (`t.me/ViaVinilobot`).
2. Calandra y Sublimación.
3. DTF Textil y DTF UV.
4. Gran Formato.
5. Alta de clientes.
6. Toma de pedidos "SISTEMA NUEVO": deriva a un formulario de pedidos de Tienda Runa (`tiendaruna.io/store/viaprint/budget/hacer-pedido`), sin asesores humanos.

## Servicios y sub-servicios

| Servicio | Sub-servicios | Casilla |
| --- | --- | --- |
| DTF Textil | Efectos: fotoluminiscente, glitter, tornasolado, oro, plata. Sin flúor. | `dtf@` |
| DTF UV | — | `dtfuv@` |
| DTF TPU / Embroidery | Embroidery vale lo mismo que TPU | (por WhatsApp de DTF) |
| Sublimación | Papel / bajadas | `sublimacion@` |
| Calandra | Transferencia en tela | `calandra@` |
| Gran Formato | UV sobre rígidos, Látex, Ecosolvente, Corte, UV rollo a rollo | `granformato@`; Látex en `latex@`; Corte en `cortes@` |

## Requisitos de archivo

- **DTF Textil**: PNG con fondo transparente, escala 1:1, 250 a 300 DPI, RGB. Ancho fijo 58 cm, largo mínimo 0,25 cm, pliegos de hasta 2 a 2,5 m. Líneas de más de 3 pt (1,05 mm).
- **DTF UV**: PNG con fondo transparente, escala 1:1, 250 a 300 DPI. Ancho fijo 58 cm, largo mínimo 0,25 cm.
- **DTF en general**: el formato es PNG. Si mandan PDF, CDR, AI o PSD, se imprime bajo responsabilidad del cliente.
- **Sublimación**: PDF con las fuentes en curvas, JPG o TIF, de 100 a 300 DPI. **No en espejo**. Mínimo 50 cm lineales.
- **Calandra**: igual que Sublimación. Mínimo de 1 a 3 m según la tela. Recomendar que el archivo tenga 3 cm menos de ancho que el material (en tropical, 1,50 m total y 1,45 m útil).
- **Gran Formato (UV rígidos, Ecosolvente, UV rollo)**: PDF con las fuentes en curvas, JPG o TIF, de 100 a 300 DPI. Respetar el área útil del sustrato. Mínimo 50 cm.
- **Látex**: igual que Gran Formato. El vinilo termotransferible es la única excepción que va en espejo.
- **Corte**: archivo vectorial (Corel Draw hasta la versión 24, PDF o EPS), con guías de corte de una sola línea, sin superposiciones ni nodos. **Prohibido PNG**.
- **Datos que el cliente tiene que poner en el mail**: nombre completo, servicio o tipo de trabajo o material, medidas (ancho × alto) y copias, sucursal de retiro y teléfono. Formato sugerido de nombre de archivo: `Nombre Apellido, Servicio Ancho x Alto cm x Cantidad u.`
- **Política mayorista**: se imprime tal cual llega. No se diseña, no se edita, no se quitan fondos ni se mejora la resolución.

## Señas y pagos

Hay diferencias entre agentes; confirmar con Verónica (D-046):

- Agentes por sector: seña del 50% **siempre**.
- Agente "SISTEMA NUEVO":
  - DTF Textil, Sublimación y Calandra: 50% desde 10 m;
  - DTF UV: 50% desde 3 m;
  - TPU: siempre.
- Calandra, Sublimación y Gran Formato se pagan por transferencia a Banco Macro (VIA PRINT SRL).
- DTF Textil, DTF UV y TPU se pagan por Mercado Pago (alias de VIA PRINT SRL). Los datos bancarios completos están en los prompts originales.
- En mostrador se paga solo en efectivo o débito.
- **Reclamos**: hay que traer el material fallado (film, papel o tela). Si no lo traen, se cobra de nuevo.

## Sucursales y horarios

- **Planta Av. Chile 1822**: Sublimación, Calandra, Gran Formato y ventas online. Lunes a viernes de 08:00 a 17:00, sábados de 08:00 a 12:00.
- **Centro San Juan 714**: DTF UV y DTF Textil. Lunes a viernes de 08:30 a 19:30, sábados de 08:30 a 13:00.
- Los retiros se avisan hasta las 16:00.
- El cliente elige la sucursal de retiro en el mail o en el pedido; el bot nunca la decide.
- Después de las 17:00, los operarios responden el próximo día hábil.
- Si retira un Uber o un cadete, entra al local; no se sale a entregar.

## Plazos

- Producción de 24 a 48 hs hábiles, por orden de llegada, desde que se reciben los archivos y se acredita la seña.
- Los pedidos del sábado a la tarde entran el lunes a la mañana.
- No se prometen fechas sin información confirmada.

## WhatsApp de la empresa (por sector)

| Sector | WhatsApp |
| --- | --- |
| Calandra y Sublimación | +54 9 387 543-1268 |
| Gran Formato y Corte | +54 9 387 631-3379 |
| DTF Textil, DTF UV y TPU | +54 9 387 632-7366 |
| Insumos y sucursal San Juan | 387 228-9245 |

Son números del negocio, publicados a los clientes. Se usan para `SUPPORT_WHATSAPP_URL` (D-038), uno por sector o el general que defina Ezequiel.

## Reglas de comportamiento de los bots que conviene conservar

- Mostrar un menú y dar solo la información que pide el cliente, sin volcar todo junto.
- Los links van en texto plano.
- No inventar precios, fechas, estados ni pagos acreditados.
- Si el cliente dice "gracias" u "ok", cerrar sin agregar más.
- No pedirle al cliente que reenvíe un archivo: eso lo hace un operario (Gran Formato).
- Si un cliente dice "UV", preguntar si es DTF UV o UV de Gran Formato.
- Derivar a una persona: reclamos, presupuestos especiales, comprobantes de pago (según el agente) y cancelaciones.
