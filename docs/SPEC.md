# Via Vinilo — Especificación funcional y técnica

Documento fuente para el desarrollo con Codex. Cliente: Ricardo "Rick" y Verónica Rabadan Martín (Via Vinilo, Salta). Proyecto cerrado por APOC Automation el 16/11/2026. Líder de proyecto: Ezequiel. Comercial: Elian. Fuentes: discovery (13/11), cuestionario respondido, propuesta comercial y llamada de cierre (16/11).

> Ver también `docs/ACTUALIZACION-2026-11-17.md`, que tiene prioridad sobre este documento donde se contradigan.

## 0. Decisiones pendientes (resolver antes de arrancar)

| # | Tema | Default asumido en este documento |
| --- | --- | --- |
| D1 | Stack | Monorepo TypeScript: apps/web (Next.js), apps/api (NestJS + Prisma + PostgreSQL), apps/worker (BullMQ + Redis), apps/pwa (Next.js PWA). VPS propio, deploy por SSH, repo en GitHub. |
| D2 | Agente de IA | Implementado en código (apps/api/agent) con OpenAI tool-calling. Alternativa: n8n como en Krokanticas. |
| D3 | WhatsApp | Un solo número en la API oficial de WhatsApp Cloud. Rick prefirió unificar los 4 números actuales. |
| D4 | Etapas | 4 etapas / 10 semanas (ver §2). Fidelización se incluyó dentro de la Etapa 4. |
| D5 | Inedit (web-to-print español) | Fuera de alcance inicial. Dejar el modelo de órdenes preparado para recibir trabajos desde un webhook externo. |
| D6 | Cantidad de tiendas online | 4 marcas sobre un único stock. Confirmar si se reemplazan las 4 o solo algunas. |

## 1. Contexto del negocio

Via Vinilo vende insumos de impresión (impresoras, tintas, papeles, vinilos, telas, tazas para sublimar, filamento e impresoras 3D) con un salón tipo supermercado con códigos de barra. También ofrece servicio de impresión por sistema:

- DTF
- DTF UV
- Gran Formato
- Látex
- Calandrado
- Sublimación

Volumen: 300 a 400 trabajos por día, unos 1.600 mensajes diarios de WhatsApp, ~3.000 clientes.

Máquinas:

| Sector | Máquinas |
| --- | --- |
| Sublimación + Calandrado | 4 plotters |
| Gran Formato | 7 |
| DTF / DTF UV | 5 |

Dolor principal: el 70–90% de los mensajes son "¿llegó mi archivo?", "¿cuánto cuesta?" y "¿a qué hora está?". Ningún sistema actual sabe responderlas:

- Tango no tiene etapas de producción.
- El bot actual (Runamatic) no tiene acceso al mail ni a la producción.

Los números de WhatsApp se bloquean por volumen. Escribirle primero a un cliente fuera de la ventana de 24 h cuesta unos USD 0,06 por mensaje. Hoy atienden 2 personas a tiempo completo, una de ellas Verónica.

Sistemas que se reemplazan:

| Sistema | Costo actual |
| --- | --- |
| Tango (facturación y stock) | ~$12M ARS por año |
| Tango Tienda + Tienda Nube | — |
| Fidely (puntos) | ~$90.000/mes, carga manual |
| Runamatic (bot + CRM) | ~$80.000/mes |
| Excel | — |

Hitos del cliente:

- Se mudan a un local unificado de 1.200 m², a fines de 2026 o principios de 2027.
- El local tendrá 3 cajas tipo supermercado y unificará depósito y sucursal.

Cobro de trabajos:

- Clientes habituales pagan al retirar.
- Clientes nuevos dejan seña y pagan el saldo al retirar.
- Medios de pago: casi todo efectivo, algo de débito y transferencia.

Horario: cierran el sábado a las 14:00 y no abren el domingo.

**Principio rector**: Rick está cansado de sistemas enlatados y de implementadores que no cumplen. El sistema se adapta al negocio y no al revés. Cada etapa debe quedar funcionando en producción antes de pasar a la siguiente.

## 2. Alcance y etapas

| Etapa | Módulo | Duración |
| --- | --- | --- |
| 1 | Producción: seguimiento de trabajos + App de clientes (PWA) | 2 semanas |
| 2 | WhatsApp API oficial + CRM + Agente de IA | 2 semanas |
| 3 | Gestión integral: facturación ARCA, POS, stock, compras, finanzas, dashboard | 3 semanas |
| 4 | Tiendas online (multimarca) + Fidelización | 3 semanas |

Comercial: total USD 6.300. Rick indicó que prefiere pagar por etapa, 50% al iniciar y 50% al entregar. Confirmar la modalidad en el contrato.

Fuera de alcance, a cotizar aparte (ver §9):

- Última milla (envíos con GPS y ruteo).
- Integración de sus otros negocios: 2 locales de golf y locales de souvenirs.
- Integración con Inedit.

## 3. Roles y permisos

Hay un usuario por persona y permisos por rol, configurables. Un usuario puede tener más de un rol.

| Rol | Puede ver y hacer |
| --- | --- |
| owner | Todo, incluido el dashboard financiero. |
| admin | Administración, compras, cuentas corrientes y bancos. Dashboard según permiso. |
| cashier | Solo su caja: ventas, cobros y cierre de su propia caja. No ve otras cajas, ni la web, ni la facturación de impresión. |
| production | Tablero de su(s) sector(es), carga de cotización y cambio de estados. No ve facturación ni finanzas. |
| attention | Bandeja CRM y fichas de clientes y órdenes. |
| purchasing | Proveedores, compras y cotizaciones de dólar. |
| warehouse | Stock, transferencias entre depósitos y recepción de mercadería. |

Todas las acciones sensibles quedan en un log de auditoría: cambios de precio, anulaciones, ajustes de stock y cierres de caja.

## 4. Modelo de datos (núcleo)

Los nombres son orientativos. Usar Prisma. Todos los modelos llevan `id`, `createdAt`, `updatedAt` y `deletedAt` (soft delete) cuando aplique.

### Clientes y contacto

- **Customer**: `name`, `cuit/dni`, `taxCondition` (RI, monotributo, CF, exento), `email[]`, `phone[]` (E.164), `isTrade` (gremio), `creditEnabled` (cuenta corriente), `pointsBalance`, `notificationPrefs`.
- Vínculo teléfono ↔ email: un cliente tiene varios emails y varios teléfonos. Es lo que permite que el bot de WhatsApp encuentre las órdenes que llegaron por mail.
- **CustomerAppAccount**: acceso a la PWA. Login por OTP al email o al teléfono. Guarda las `pushSubscriptions[]`.

### Producción

- **Sector**: DTF, DTF_UV, GRAN_FORMATO, LATEX, CALANDRADO, SUBLIMACION. Cada sector tiene `inboxEmail` y `stages[]` configurables.
- **Machine**: `sectorId`, `name`, `active`.
- **Material**: es un `Product` con el flag `isPrintMedia`, más su ancho.
- **JobOrder** (orden de trabajo):
  - `number`: correlativo legible, por ejemplo `VV-000123`.
  - `customerId`, `sectorId`, `machineId?`, `materialProductId?`.
  - `requestedSpecs`: texto o JSON con medidas declaradas por el cliente.
  - `status`, `priority`.
  - `quotedAmount`, `quotedAt`.
  - `depositRequired`, `depositPaid`, `paymentStatus` (pendiente / seña / pagado / cuenta corriente).
  - `estimatedReadyAt`.
  - `source`: email / web / mostrador / whatsapp / api.
  - `sourceMessageId`: Message-ID del mail, para deduplicar.
- **JobFile**: `jobId`, `filename`, `storageKey`, `size`, `mime`, `checksum`.
- **JobEvent**: historial de estados. Campos: `jobId`, `fromStatus`, `toStatus`, `userId`, `reasonCode?`, `note?`, `notifiedCustomer`.
- **FileErrorReason**: catálogo editable. Ejemplos: resolución baja, medida no coincide, colores, fuentes no convertidas, archivo corrupto, falta sangrado.

### Catálogo y stock (Etapa 3; en la Etapa 1 alcanza con Product simple para elegir el material)

- **Product**:
  - `sku`, `barcode[]`, `name`, `brand`, `supplierId`.
  - `costCurrency` (ARS/USD), `costAmount`, `markupRules`.
  - `unitOfMeasure` (unidad, metro, rollo, litro, ml, caja, resma).
  - `isComposite`, `isPrintService`, `trackStock`.
  - Las variantes se modelan como productos hijos de un `ProductGroup` con atributos: marca, base (blanca, gris, transparente, mate, mate gris), ancho (1,06 / 1,27 / 1,37 / 1,52), gramaje y color.
- **UnitConversion**: doble unidad de medida. Ejemplo: 1 caja = 10 resmas. El stock vive en la unidad base y se muestra en las dos. Ver la regla R-STK-2.
- **BillOfMaterials / BomLine**: productos compuestos. Ejemplo: 1 m de vinilo impreso consume 1 m del vinilo base, X ml de tinta C/M/Y/K y X ml de tinta blanca si aplica.
- **Warehouse**: "Depósito general", "Depósito impresión", "Salón"/caja. Ver R-STK-3.
- **StockMovement**: `productId`, `warehouseId`, `qty` (unidad base), `type` (compra, venta, consumo producción, transferencia, ajuste, devolución), `refType`/`refId`, `userId`.

### Comercial y finanzas (Etapa 3)

- **Supplier**: `name`, `cuit`, `currency`, `exchangeRate` (cotización propia del proveedor, editable a mano), `exchangeRateUpdatedAt`.
- **PriceList**: gremio, público y una por sistema de impresión (Sublimación, DTF, Ecosolvente, Calandrado, etc.).
- **PriceListItem**.
- **Sale**, **SaleItem**, **Invoice** (CAE, tipo A/B/C, punto de venta), **CreditNote**.
- **CashRegister**: cajas 1 a 3, impresión y web.
- **CashSession**: apertura y cierre por usuario.
- **Payment**: efectivo, débito, crédito, transferencia, puntos o cuenta corriente.
- **CurrentAccountEntry**: cuentas corrientes de clientes y de proveedores.
- **BankAccount**: ICBC, Macro, Galicia y BNA.
- **BankMovement**, **Purchase**, **PurchaseItem**.

### Atención (Etapa 2)

- **Conversation**: `channel` (whatsapp), `customerId?`, `phone`, `status` (bot / humano / cerrada), `assignedUserId?`, `sectorTag?`, `lastInboundAt` (para calcular la ventana de 24 h).
- **Message**: dirección, tipo, contenido, `waMessageId`, estado de entrega.
- **AgentRun**: tools llamadas, tokens y resultado. Sirve para auditar y controlar costos.

### Fidelización (Etapa 4)

- **PointsRule**: por monto, por sector o por producto.
- **PointsLedger**: acreditación, canje y vencimiento.
- Los puntos se convierten a pesos y se usan como medio de pago (R-FID-1).

## 5. Requisitos por etapa

### Etapa 1 — Seguimiento de trabajos + App de clientes (PRIORIDAD MÁXIMA)

#### E1.1 Ingesta por mail

- El worker lee por IMAP, cada 1 minuto, una casilla por sector (dtf@, dtfuv@, granformato@, latex@, calandrado@, sublimacion@ sobre el dominio del cliente).
- Las credenciales van en variables de entorno o en una tabla cifrada, nunca en el repo.
- Por cada mail nuevo:
  - Deduplicar por Message-ID.
  - Identificar al cliente por el email del remitente. Si no existe, crear un Customer provisorio marcado como "a verificar".
  - Crear la JobOrder en el sector de esa casilla, con estado `RECEIVED`.
  - Guardar los adjuntos en el storage (S3 compatible o disco del VPS) y extraer las medidas declaradas en el cuerpo del mail (texto libre).
  - Si el mail trae links de WeTransfer o Drive, guardarlos en la orden. No descargarlos automáticamente en la Etapa 1.
- Un mail con varios adjuntos crea una orden con varios archivos. Un operador puede dividirla en varias órdenes desde el tablero, porque un mismo cliente manda 3 o 4 trabajos por día.
- También hay alta manual de orden desde mostrador.

#### E1.2 Estados (configurables por sector; estos son los defaults)

```
RECEIVED (Archivo recibido)
  → FILE_ERROR (Archivo con error)        [vuelve a RECEIVED cuando el cliente reenvía]
  → QUOTED (Verificado y cotizado)         ← la cotización va ACÁ, no al final
  → PREPARING (Preparando / RIP)
  → PRINTING (Imprimiendo)
  → READY (Terminado, listo para retirar)
  → DELIVERED (Entregado)
  → CANCELLED (Cancelado por el cliente o el negocio)
```

#### E1.3 Cotización temprana (pedido explícito de Rick)

- Cuando el operador abre el archivo y verifica que la medida coincide con lo pedido, carga el precio en ese momento, con el trabajo todavía sin imprimir. La orden pasa a `QUOTED`.
- El cliente ve el precio en la app antes de la impresión y todavía puede cancelar.
- El precio se calcula desde la lista de precios del sistema y del material: m² o metro lineal × precio, más extras. El operador puede sobreescribirlo, y el cambio queda en el log.
- Para clientes nuevos, marcar si se requiere seña antes de imprimir.

#### E1.4 Tablero de producción

- Vista kanban por sector, con filtros por máquina, material, cliente y fecha.
- Asignación de máquina.
- Agrupación sugerida por material: destacar las órdenes pendientes que usan el mismo material, para imprimirlas juntas. El orden por defecto es por llegada, salvo que se agrupe por material.
- Acciones rápidas pensadas para operadores en PC del taller: cambiar estado, marcar error con motivo, cargar precio, dividir orden y reimprimir.
- Búsqueda por número de orden, cliente, teléfono o email.

#### E1.5 App de clientes (PWA)

- Instalable con un link: manifest e íconos con el logo de Via Vinilo. No es una app de tiendas.
- Login sin contraseña por OTP, al email o al teléfono.
- Muestra la lista de órdenes activas e históricas. Para cada una: número, sector o sistema, material, estado, precio, estado de pago y hora estimada.
- Ante `FILE_ERROR` se muestra el motivo y el botón "Reenviar archivo", que sube el archivo y vuelve la orden a `RECEIVED`.
- El cliente puede aceptar o cancelar la cotización.
- Notificaciones Web Push:
  - Obligatorias, siempre activas: `FILE_ERROR` y `READY`.
  - Opcionales, activables por el cliente: `RECEIVED`, `QUOTED` (con el precio) y `PRINTING`.
- Las push son gratuitas y reemplazan los avisos por WhatsApp y Telegram.
- Fallback: si el cliente no instaló la PWA, enviar email transaccional para `FILE_ERROR` y `READY`. No enviar WhatsApp iniciado por el negocio, que tiene costo.
- Botón "Consultar por WhatsApp" que abre wa.me con el número de la orden ya escrito.

#### E1.6 Panel de tiempos

- Trabajos por día, por sector y por máquina.
- Tiempo promedio en cada estado.
- Órdenes demoradas: más de X horas en un estado, configurable.

#### Criterios de aceptación de la Etapa 1

- Un mail enviado a dtf@ aparece en el tablero de DTF en menos de 2 minutos, con cliente y archivos.
- Al pasar una orden a `READY`, el cliente con la PWA instalada recibe la push en menos de 30 segundos.
- Un cliente con dos emails registrados ve en la PWA las órdenes que llegaron desde los dos.
- Con 400 órdenes por día y 6 casillas, el sistema no duplica órdenes ni pierde mails (probar con reenvíos y con mails con varios adjuntos).

### Etapa 2 — WhatsApp oficial + CRM + Agente

#### E2.1 WhatsApp Cloud API con un solo número

- Webhook de entrada, envío, estados de entrega y descarga de media.
- La verificación de Meta Business queda a nombre del cliente. Depende de Meta y está en el camino crítico.

#### E2.2 Bandeja CRM

- Conversaciones con vista de ficha de cliente al lado: órdenes activas, saldo y puntos.
- Filtro por sector (etiqueta), asignación y estados bot / humano / cerrada.
- Indicador de la ventana de 24 h. Fuera de la ventana, solo se permiten plantillas aprobadas y se avisa del costo antes de enviar.

#### E2.3 Agente de IA

- Rick quiere que prácticamente todo lo atienda el bot. El humano entra solo en casos extremos.
- Tools mínimas:
  - `buscar_cliente(phone)`: resuelve el cliente por teléfono. Si no lo encuentra, pide el email con el que envió el archivo y lo vincula, previa verificación por OTP o confirmación.
  - `listar_ordenes(customerId, activas)`: responde si llegó el archivo, en qué estado está, cuánto cuesta y la hora estimada.
  - `info_negocio(tema)`: horarios, dirección, cómo enviar archivos, requisitos de archivo y casillas por sector.
  - `lista_precios(sistema)`.
  - `derivar_a_humano(motivo)`: solo para reclamos, trabajos especiales o después de 2 intentos fallidos.
- En cada respuesta relevante, el agente invita a instalar la PWA con el link.
- Fuera de horario (sábado desde las 14:00 y domingo; configurable): el agente informa que el negocio está cerrado y pide que vuelvan a escribir el lunes, para no perder el contacto ni tener que abrir una conversación paga. Igual puede responder consultas de estado y precios.
- Estilo de respuesta: mensajes cortos, una pregunta por mensaje y sin saludos repetidos (aprendizajes de Krokanticas).
- Control de costos: loguear los tokens por conversación y poner un tope diario configurable.

#### Criterios de aceptación de la Etapa 2

- Ante "¿llegó mi archivo?" desde un teléfono vinculado, el bot responde con número de orden, estado y precio sin intervención humana.
- Un mensaje recibido el domingo recibe la respuesta de fuera de horario.
- Menos del 10% de las conversaciones terminan derivadas a un humano (medir en la primera semana).

### Etapa 3 — Gestión integral (reemplazo de Tango)

#### E3.1 Facturación electrónica ARCA (WSFEv1)

- Comprobantes A, B y C, notas de crédito y débito, y ticket o factura desde el POS.
- Validación del cliente por CUIT con el padrón de ARCA.
- Puntos de venta configurables.

#### E3.2 POS tipo supermercado

- Lectura de código de barras y 3 cajas simultáneas.
- Apertura y cierre de caja por usuario, con resumen por medio de pago.
- Cada caja ve solo sus propias ventas (R-POS-1).
- Venta de trabajos de impresión: cobrar una JobOrder (seña o saldo) desde la caja o desde el tablero.

#### E3.3 Stock

- Variantes, multi-depósito y alertas de reposición.
- Productos compuestos (BOM): al facturar o consumir un producto compuesto, se descuentan sus componentes del depósito de impresión. Ver R-STK-1.
- Transferencias entre el depósito general y el de impresión. El objetivo es controlar el consumo: si un empleado pide 10 L de tinta y el sistema dice que quedan 20 L, hay una alerta.
- Doble unidad de medida con conversión (R-STK-2).

#### E3.4 Compras y proveedores

- Cada proveedor tiene su propia cotización del dólar, editable a mano. No se automatiza.
- Los productos con costo en USD se valorizan con la cotización de su proveedor. Si se cambia la cotización de un proveedor (por ejemplo ARJET de 1.580 a 1.600), se recalculan todos sus artículos de una sola vez, sin tocar a los demás proveedores.
- Órdenes de compra, recepción y cuenta corriente con el proveedor.
- Preparado para importación: pago en dólar billete.
- Deseable, no comprometido: importar listas de precios de proveedores desde Excel o CSV.

#### E3.5 Finanzas

- Cuentas corrientes de clientes y proveedores.
- Caja diaria.
- Bancos (ICBC, Macro, Galicia, BNA) con movimientos y saldos. La conciliación es por carga o importación de extractos; integración bancaria directa no comprometida.

#### E3.6 Dashboard (para el owner; referencia: el panel de Contabilium que mostró Rick)

- Ventas del día, semana, mes y año con filtros de rango libre e historial. Lo que tiene hoy en Tango se reinicia a la 1 AM y no guarda historial.
- Ticket promedio, cantidad de tickets, ventas por sector y por caja o canal.
- Compras, quién me debe (cuentas corrientes), unidades vendidas y top productos.
- Una vista de "salud financiera" para decidir compras: ventas contra compras y saldo disponible.

#### E3.7 Migración desde Tango

- Clientes (~3.000), productos y variantes, stock y saldos de cuentas corrientes.
- El historial de ventas no se migra: queda consultable en Tango.
- Al migrar hay que corregir las unidades dobles, que hoy están mal configuradas.
- Rick envía el listado de productos, variantes y fórmulas BOM (action item pendiente).

### Etapa 4 — Tiendas online + Fidelización

#### E4.1 Tiendas

- Hay 4 tiendas: Vía Vinilo; Subli Planet (marca propia que compite con Vía Vinilo, alcance nacional); y dos tiendas con dominio .ar de marcas nacionales para el NOA.
- Hoy 3 están en Tienda Nube y 1 fuera. Ver D6.
- Implementación multi-tienda sobre un único catálogo y stock:
  - Cada tienda define qué productos publica, sus precios y su branding.
  - Stock en tiempo real (el problema de Tango Tienda era vender con precios viejos y por debajo del costo).
  - Pasarela de pago, por ejemplo Mercado Pago.
  - Las ventas web entran como Sale del canal correspondiente.
- Pedido de impresión web: el cliente elige sistema, material y medida, sube el archivo y obtiene un precio estimado. El pedido crea una JobOrder con `source=web`.

#### E4.2 Fidelización

- Los puntos se acreditan automáticamente según PointsRule.
- Se convierten a pesos y se usan como medio de pago a cuenta en el POS, la web o los trabajos de impresión. No hay catálogo de premios.
- Saldo visible en la PWA.
- Migrar los saldos actuales de Fidely.

## 6. Reglas de negocio

- **R-JOB-1**: el número de orden es único, correlativo y visible para el cliente.
- **R-JOB-2**: la cotización se carga en `QUOTED`, antes de imprimir. Un cambio de precio posterior notifica al cliente.
- **R-JOB-3**: una orden de un cliente nuevo con `depositRequired` no puede pasar a `PRINTING` sin la seña registrada. El rol owner puede forzarlo.
- **R-NOT-1**: nunca enviar WhatsApp iniciado por el negocio de forma automática. Los avisos van por push o email.
- **R-STK-1**: al vender o consumir un producto compuesto se generan StockMovement de consumo por cada componente, en el depósito de impresión.
- **R-STK-2**: el stock se guarda en la unidad base y la conversión es exacta. Ejemplo: 200 unidades con 20 unidades por caja son 10 cajas. La vista en la otra unidad nunca puede quedar desincronizada.
- **R-STK-3**: el depósito de impresión solo se abastece por transferencia desde el depósito general. Cada transferencia queda registrada con usuario y hora.
- **R-PRC-1**: precio en ARS = costo en USD × la cotización de su proveedor × markup de la lista.
- **R-POS-1**: cada cajero ve únicamente las ventas de su sesión o caja.
- **R-FID-1**: 1 punto = $X ARS, configurable. Los puntos son un medio de pago y no generan vuelto.
- **R-BOT-1**: fuera de horario, el bot responde con el mensaje de cierre y aun así contesta consultas de estado y precio.

## 7. No funcionales

- **Carga**: 400 órdenes por día, 1.600 mensajes por día, 3 cajas concurrentes y 4 tiendas.
- **Rendimiento**: el tablero de producción tiene que andar fluido en las PC del taller. Actualizar en tiempo real con WebSocket o SSE.
- **Archivos**: pueden ser pesados (impresión en gran formato). Guardar con retención configurable, por ejemplo 60 días después de la entrega, y limpiar con un job programado.
- **Backups**: diarios de la base de datos y de los archivos.
- **Seguridad**: secretos en el entorno, contraseñas hasheadas, OTP con expiración y rate limit, y auditoría de las acciones sensibles.
- **Idioma**: español rioplatense en toda la UI y en el bot.
- **Moneda y zona horaria**: ARS por defecto y USD donde aplique. Zona horaria America/Argentina/Salta.
- **Hosting**: ~$28.500 ARS/mes. Costos variables: OpenAI (~USD 50–100/mes) y Meta, que factura directo al cliente.

## 8. Integraciones

| Integración | Etapa | Notas |
| --- | --- | --- |
| IMAP (casillas por sector) | 1 | Polling cada 1 min, idempotente por Message-ID. |
| Web Push (VAPID) | 1 | Para la PWA. |
| Email transaccional (SMTP) | 1 | Fallback de las notificaciones. |
| WhatsApp Cloud API | 2 | Un número, webhooks y plantillas aprobadas. |
| OpenAI | 2 | Agente con tool-calling. |
| ARCA WSFEv1 + padrón | 3 | Requiere certificado del cliente. |
| Mercado Pago (u otra pasarela) | 4 | Tiendas y pagos de órdenes. |
| Inedit | Futuro | Webhook de entrada → JobOrder con `source=api`; hot folders por material y RIP automático al juntar N trabajos (ver §9). |

## 9. Backlog futuro (cotizar aparte)

- **Última milla**: envíos a domicilio desde el local nuevo, con ruteo automático según las direcciones, tracking GPS y avisos al cliente ("salimos", "estamos a 800 m", "llegamos"). Debe salir de las ventas del sistema sin volver a cargar nada.
- **Multi-negocio**: sumar los 2 locales de artículos de golf (hoy en Contabilium) y los locales de souvenirs al mismo sistema.
- **Integración con Inedit / web-to-print**: cotizador web con vista previa, carpetas por material (por ejemplo "Jersey Set") y RIP automático al acumular N trabajos o M metros.
- **Importación automática de listas de precios de proveedores** (PDF, imagen, Excel).

## 10. Plan de trabajo sugerido para Codex

Trabajar una etapa por vez y en PRs chicos. Orden de la Etapa 1:

1. Monorepo, Docker Compose (Postgres + Redis), Prisma schema de Customer, Sector, Machine, Product (mínimo), JobOrder, JobFile, JobEvent y FileErrorReason. Seeds con los 6 sectores y las 16 máquinas.
2. Auth interna con roles, y CRUD de clientes con varios emails y teléfonos.
3. Worker IMAP, con tests de deduplicación, varios adjuntos y remitente desconocido.
4. Tablero kanban con tiempo real, transiciones con validación (R-JOB-*) y log de eventos.
5. Cotización en `QUOTED`, división de órdenes y motivos de error.
6. PWA: OTP, lista de órdenes, reenvío de archivo, aceptar o cancelar la cotización, Web Push y preferencias.
7. Email de fallback y panel de tiempos.
8. Prueba de carga: 400 órdenes en un día simulado.

Al cerrar cada etapa: tests verdes, migraciones aplicadas, README actualizado y una demo para la reunión semanal con Rick y Verónica.
