# Registro de desarrollo — decisiones y cambios

Este es el documento de entrada del proyecto. Resume **lo que está vigente hoy** y registra **cada definición nueva con su porqué**, para que cualquier desarrollador entienda cómo se llegó al estado actual sin releer todo.

- Leelo **antes** que `SPEC.md` y `ACTUALIZACION-2026-11-17.md`. Si este registro y esos documentos se contradicen, **gana este registro**.
- Toda definición nueva (reunión, mensaje del cliente, contrato, decisión técnica) se anota acá: en la tabla de vigentes si cambia el alcance, y siempre como entrada en el §4.
- Lo que no está resuelto va al §3 y no se implementa por suposición: se deja un `TODO(spec):` que apunte al ID (por ejemplo `TODO(spec): I-02`).

## 1. Fuentes y precedencia

Regla general: **prevalece la fuente más reciente**. Si hay una inconsistencia que no está claro cómo resolver, se pregunta a Ezequiel y se registra en el §3.

| Orden | Fuente | Fecha | Estado |
| --- | --- | --- | --- |
| 1 | Este registro (`docs/DESARROLLO.md`) | vivo | Vigente; consolida todo lo de abajo |
| 2 | Contrato de desarrollo firmado con Viaprint S.R.L. (no está en el repo: tiene datos personales) | 18/11/2026 | Vigente para etapas, alcance, exclusiones y costos |
| 3 | `docs/ACTUALIZACION-2026-11-17.md` (llamada con Ricardo y Verónica) | 17/11/2026 | Vigente salvo donde lo pisa el contrato |
| 4 | `docs/SPEC.md` (especificación de cierre) | 16/11/2026 | Base técnica; parcialmente reemplazada |
| — | Propuesta comercial en PDF | 16/11/2026 | **Obsoleta**. Solo contexto histórico; no usar para alcance, etapas ni plazos |

## 2. Alcance vigente (resumen consolidado)

### 2.1 Etapas

Fuente: contrato del 18/11 (cláusula Segunda y Anexo I). Reemplaza la tabla del §2 del SPEC y la de la propuesta.

| Etapa | Módulo | Plazo aprox. | Valor | Por qué está en este orden |
| --- | --- | --- | --- | --- |
| 1 | Proceso productivo + Seguimiento de trabajos + App de clientes | ~2 semanas | USD 1.100 | Es lo más urgente y lo que más mensajes saca: el 70–90% de las consultas es "¿llegó mi archivo?", "¿cuánto cuesta?" y "¿a qué hora está?". Incluye el proceso productivo de cada sector porque **el seguimiento que ve el cliente se genera directamente de los estados de producción** (contrato, cláusula 2.3). Sin proceso productivo no hay nada que mostrar en la app. |
| 2 | Autoservicio y ayuda en la App + canal de reclamos | ~2 semanas | USD 1.200 | Se apoya en la app de la E1. Se rediseñó liviana (sin agente de IA en WhatsApp) para **llegar antes a la Etapa 3** y para no gastar en mensajes de WhatsApp. |
| 3 | Gestión integral: stock, POS, facturación ARCA, compras y finanzas | ~3 semanas | USD 2.000 | El stock es "lo más importante del negocio" y no lo controlan hace 10 años. Reemplaza Tango. |
| 4 | Tiendas online + Fidelización por puntos | ~3 semanas | USD 2.000 | Necesita el stock central y la facturación de la E3: las tiendas venden contra ese stock y los puntos se acreditan desde la facturación. |
| | **Total** | **~10 semanas** | **USD 6.300** | |

- **Inicio de la E1**: lunes 23/11/2026, sujeto a la acreditación del anticipo.
- **Pago**: 50% al iniciar cada etapa y 50% dentro de los 5 días hábiles de la entrega.
- **Continuidad**: cada etapa siguiente arranca cuando el cliente la confirma por escrito (vale mail o WhatsApp) y paga el anticipo.
- **Aceptación**: el cliente tiene 3 días hábiles para observar la entrega; si no observa, o si empieza a usarla, queda aceptada.
- **Garantía**: 30 días corridos de corrección de errores por etapa. Las mejoras no son errores (ver §2.4).

### 2.2 Qué entra en cada etapa (Anexo I del contrato)

El Anexo I es orientativo: el detalle se define con el cliente en las reuniones, y se pueden ajustar o reordenar funcionalidades dentro de cada módulo sin cambiar el alcance (cláusula 2.2).

**Etapa 1**

- Clientes del gremio con alta validada por un asesor, número de cliente único, DNI, notas internas y migración de los datos existentes.
- Ingreso de trabajos por IMAP desde las casillas de Hostinger de cada sector, con control de duplicados. Alta manual desde mostrador.
- Revisión del archivo con IA, que sugiere "Archivo recibido" o "Archivo con error" y el operador confirma.
- Proceso productivo por sector con estados propios, pasos obligatorios, cotización antes de imprimir, "Seña recibida" antes de imprimir para clientes con seña (D-013), tablero, asignación de máquina y agrupación por material.
- Mails de remitentes que no son clientes: la orden queda en "Alta pendiente" hasta que el asesor aprueba el alta (D-014).
- Acceso a la app con código por email (D-016) y login del personal con roles owner, production y attention (D-017).
- Seguimiento automático en la app a partir de los estados de producción.
- PWA con acceso sin contraseña, órdenes con estado, medida, precio y hora estimada, reenvío de archivos y push. Email como respaldo.
- Panel de tiempos.
- Borrado automático de archivos de impresión a los 30 días de entregada la orden (D-015).

**Etapa 2**

- Ayuda en la app (FAQ, precios, instructivos, horarios), con contenido editable por el cliente.
- Asistente en la app que responde solo con lo cargado, nunca promete ni modifica, y deriva. Usa IA local, con OpenAI de respaldo.
- Un único número de WhatsApp **exclusivo para reclamos y casos que requieran un asesor**.

**Etapa 3**

- Stock con variantes, multidepósito y transferencias.
- Productos compuestos (BOM) y unidades anidadas (unidad → caja → caja de cajas).
- POS de hasta 3 cajas con pagos mixtos.
- Facturación ARCA con interfaz validada con el cliente.
- Proveedores con dólar propio y compras.
- Cuentas corrientes, caja diaria y bancos con carga manual o importación.
- Roles y permisos.
- Dashboard.
- Migración desde Tango.

**Etapa 4**

- Tiendas propias en reemplazo de Tienda Nube.
- Conexión de las tiendas externas al stock central, si su tecnología lo permite.
- Pedidos centralizados.
- Puntos acreditados automáticamente desde la facturación, como medio de pago total o parcial.

### 2.3 Exclusiones (contrato 2.5 y 2.6)

- Integración bancaria automática (Interbanking u otras).
- Última milla (GPS y ruteo).
- Otros negocios del cliente: golf y souvenirs.
- Inedit y otros sistemas de terceros que no estén en el Anexo I.
- Equipamiento.
- Carga de datos más allá de la migración inicial.

### 2.4 Cambios de alcance (contrato, cláusula Novena)

- Los ajustes menores dentro de la etapa en curso no tienen costo.
- Lo nuevo o lo que cambia sustancialmente el esfuerzo se informa antes, con tiempo y costo, y se aprueba por escrito.
- Las ideas van a un listado de pendientes que se prioriza en la reunión semanal. Ver también el §7 de la actualización.

### 2.5 Infraestructura y costos recurrentes (contrato, cláusula Sexta)

- **Hosting**: el VPS de Hostinger que ya tiene contratado el cliente. No se usa un VPS de APOC. Si la IA local necesita más hardware, la ampliación la paga el cliente.
- **IA**: la IA local es la opción principal y OpenAI queda de respaldo ante fallas o picos (estimado USD 50–100/mes). Usar OpenAI para la revisión de archivos queda a definir con el cliente, porque sube el costo.
- **WhatsApp**: solo para reclamos. Meta le factura directo al cliente.
- **Mantenimiento**: USD 250/mes, opcional, después de la garantía.

## 3. Inconsistencias y puntos abiertos

Mientras un punto esté **Abierto**, no se implementa por suposición: se deja `TODO(spec): I-xx`.

| ID | Tema | Qué choca | Etapa | Estado |
| --- | --- | --- | --- | --- |
| I-01 | Retención de archivos | SPEC: 60 días después de la entrega. Actualización: 1 mes. Contrato: 30 días. Ninguno dice **desde qué evento** se cuentan (recepción, entrega o último cambio de estado). | E1 | Resuelto → D-015 |
| I-02 | Seña antes de imprimir (R-JOB-3) | R-JOB-3 bloquea `PRINTING`, pero en los estados nuevos ya no hay "Imprimiendo": de "Cotizado" se pasa a "Impreso". Si el bloqueo se pone al marcar "Impreso", ya es tarde porque el trabajo está impreso. Hay que definir dónde se frena (por ejemplo, que no aparezca como imprimible en el tablero hasta tener la seña). | E1 | Resuelto → D-013 |
| I-03 | Mail de un remitente desconocido | SPEC E1.1: crear un cliente provisorio "a verificar" y la orden. Actualización 2.1: solo se imprime a clientes dados de alta, y el alta la valida un asesor. Falta definir qué pasa con la orden mientras el alta está pendiente: si se crea bloqueada, se rechaza o se le responde al remitente con el link de alta. | E1 | Resuelto → D-014 |
| I-04 | OTP por teléfono | SPEC E1.5: OTP al email **o al teléfono**. Mandarlo al teléfono por SMS o WhatsApp tiene costo, y R-NOT-1 prohíbe el WhatsApp iniciado por el negocio. El contrato solo dice "acceso sin contraseña". | E1 | Resuelto → D-016 |
| I-05 | Puntos como medio de pago en el POS | Contrato E3: el POS acepta pagos mixtos **con puntos**. Pero el programa de puntos (acreditación y migración de saldos de Fidely) es de la E4. Falta definir si en la E3 los puntos se cobran contra los saldos de Fidely, o si el medio de pago queda preparado y se habilita en la E4. | E3 | Resuelto → D-018 |
| I-06 | Roles y permisos | Contrato: "usuarios con roles y permisos" figura en la E3. Pero la E1 necesita login de operadores y asesores (tablero y validación de altas), y el SPEC §10 los pone en el paso 2 de la E1. | E1 | Resuelto → D-017 |
| I-07 | Notificaciones opcionales | El SPEC lista `PRINTING` como push opcional, pero ya no existe "Imprimiendo". | E1 | Abierto. Propuesta: opcionales Archivo recibido, Cotizado, Seña recibida e Impreso; obligatorias Archivo con error y Terminado. |
| I-08 | Cantidad de tiendas propias (D6) | El SPEC habla de 4 marcas. El contrato dice "tiendas online propias" sin número, más las externas de Ricardo. | E4 | Abierto. No bloquea hasta la E4. |
| I-09 | Proveedor de IA para revisar archivos | El contrato dice que se define con el cliente. Formato, apertura, resolución y medidas se pueden chequear sin IA; la IA solo hace falta para leer las medidas escritas en texto libre en el mail. | E1 | Abierto. Propuesta técnica: chequeos deterministas y un LLM solo para extraer las medidas del cuerpo del mail. |
| I-10 | Máquinas por sector | El SPEC da 16 máquinas agrupadas: 4 plotters de "Sublimación + Calandrado", 7 de Gran Formato y 5 de "DTF / DTF UV". Pero hay 6 sectores: no dice qué máquinas son de Látex, cuáles de DTF y cuáles de DTF UV, ni si las calandras se cuentan como máquinas. | E1 | Abierto. El seed asume que una máquina puede atender varios sectores (Gran Formato también atiende Látex; DTF también atiende DTF UV) y usa nombres genéricos ("DTF 1"…). Pedir a Ricardo y a Verónica los nombres reales. |
| I-11 | Secuencia de estados por sector | Las secuencias sembradas salen de la actualización §2.4 y de D-013. Faltan las capturas del CRM de Runamatic por sector para confirmarlas, por ejemplo si toda la Sublimación pasa por calandra. | E1 | Abierto. Son configurables en `SectorStage`; se ajustan con las capturas. |
| I-12 | Teléfonos fijos vs. celulares | En Argentina, "387 466-9944" puede ser un fijo o un celular escrito sin el 15. Si se guarda tal cual, el mismo celular cargado con y sin 15 queda como dos números, y no se reconoce al cliente cuando escribe por WhatsApp. | E1 | Abierto. Por defecto todo número argentino se guarda como celular `+549…` (D-025). Confirmar con Verónica que no se cargan fijos; si se cargan, quedan con el 9 de más. |
| I-13 | Agente conversacional con Paperclip (D-026) | (1) El contrato pone el asistente en la **E2** y solo **dentro de la app**; que el agente **responda mails** no está en el Anexo I. (2) Arrancarlo apenas esté el VPS adelanta la E2 antes de cerrar la E1 ("una etapa por vez"). (3) El contrato dice "IA local + OpenAI de respaldo" (D-006): falta definir si Paperclip es esa IA local o una plataforma aparte, y qué costo tiene. (4) Responder mails solo, sin un humano, choca con "el asistente nunca promete ni modifica nada" (actualización 2.7): hay que acotar qué puede contestar. | E2 | **Resuelto en D-028 y D-029** (Trip como referencia: Ollama `qwen3:8b` con OpenAI de respaldo, Paperclip para gobernar a los agentes). Queda ver si el VPS del cliente tiene margen para el modelo local. |
| I-14 | Mail de un cliente bloqueado | No está definido qué pasa si escribe a una casilla un cliente con estado "bloqueado". | E1 | Abierto. Por defecto no se crea la orden: el mail queda registrado en el log de ingesta como rechazado, para que atención lo vea. |
| I-15 | Mails sin archivo y respuestas en el mismo hilo (parte (a) actualizada por D-045: el mail sin archivo va a Conversaciones) | (a) La actualización 2.3 dice que si falta el adjunto la orden pasa a "Archivo con error", pero la 2.5 dice que una orden nunca nace de un "hola". (b) Si el cliente responde en el mismo hilo (por ejemplo para reenviar un archivo con error), no está definido si se suma a la orden existente o crea otra. | E1 | Abierto. Por defecto: (a) un mail sin adjuntos ni links de WeTransfer o Drive no crea orden y queda en el log como "sin archivo"; (b) cada mail con archivo crea su propia orden. |
| I-16 | Volver un paso atrás | Los pasos son obligatorios y no se pueden saltear, pero un operador puede equivocarse de botón (por ejemplo, marcar "Impreso" una orden que no imprimió). Hoy nadie puede deshacerlo; solo cancelar. | E1 | Abierto. Propuesta: que el dueño pueda volver una orden un paso atrás, con motivo obligatorio y registro en la auditoría. Confirmar con Verónica. |
| I-17 | Cómo obligar a mover las tarjetas (D-032) — **Resuelto en D-086**: el archivo se descarga en cualquier paso | Ezequiel pidió que los operadores **tengan que** mover la tarjeta para poder hacer su trabajo. Hoy nada impide imprimir sin tocar el tablero: el archivo llega por mail y el operador lo abre desde la casilla. | E1 | Abierto. Propuesta (ya dibujada en el tablero): el archivo para imprimir **solo se descarga desde la tarjeta**, y se libera cuando la orden está lista para imprimir (cotizada y, si corresponde, con seña). Para que funcione, los operadores no deberían tener acceso a las casillas de mail. Ampliada en D-042 para que el estado que ve el cliente sea el real. Confirmar con Verónica y Ricardo. |
| I-18 | Mensajería de la app de clientes (D-032) | La bandeja de Conversaciones del ERP toma el modelo de Krokanticas (lista, chat, asistente IA o asesor, etiquetas), pero el canal es la **app propia**, no WhatsApp. El contrato pone el asistente en la E2 y la E1 solo tiene seguimiento de pedidos. Falta definir si el chat libre con un asesor entra en la E2 o si en la E1 alcanza con los avisos de estado. | E2 | Abierto. La pantalla es solo visual. Los endpoints (equivalentes a `/api/chats`, `/api/messages`, `/api/send-message` y `/api/toggle-bot` de Krokanticas) se definen al arrancar la E2. **Canales**: la app y también el **mail** (D-041). |
| I-19 | Envío de trabajos desde la app (D-034) | La actualización §2.9 dice que la recepción de trabajos va por la app, y la §2.5 pide límites de acciones por cliente y evitar duplicados (el caso de los 17 pedidos repetidos por Telegram). No está definido cuántos envíos por día se permiten ni cómo se detecta un archivo repetido. | E1 | Abierto. Propuesta: la orden solo se crea con archivo, sector y medida; si el mismo archivo (mismo hash) ya está en un pedido abierto del cliente, se avisa en lugar de crear otro; tope configurable de envíos por hora. Confirmar con Verónica. |
| I-20 | VPS para la IA local (D-035) | El VPS del cliente tiene 4 vCPU y 15 GB de RAM. Trip calcula 8 vCPU para correr `qwen3:8b` en local (D-029). | E2 | **Resuelto en D-057**: con 4 vCPU alcanza para `qwen2.5:3b` (3 a 4 s por respuesta); no para `qwen3:8b`. Alcanza para la E1. Al arrancar la E2, medir la latencia del modelo en este VPS. Si no alcanza, el cliente amplía el plan (contrato) o se usa más OpenAI de respaldo. |
| I-21 | Casillas `cortes@` y `tpu@` (D-043) — **Resuelto en D-046**: `cortes@` es el Corte de Gran Formato y `tpu@` es TPU | En Hostinger existen las casillas `cortes@viavinilo.com` y `tpu@viavinilo.com`, pero el sistema tiene 6 sectores y ninguno es Cortes ni TPU. | E1 | Abierto. Preguntar a Ricardo y a Verónica si son sectores que reciben trabajos (y hay que sumarlos con su secuencia de estados) o casillas de otro uso. |
| I-22 | `dtf@` bloqueada para enviar (D-043) | Hostinger bloqueó el envío de `dtf@viavinilo.com` por "sending_spam". El sistema responde desde la casilla del sector (Reply-To, actualización §2.2), así que las respuestas de DTF no salen. | E1 | Abierto. El cliente tiene que pedirle a Hostinger que la desbloquee y revisar SPF, DKIM y DMARC de `viavinilo.com` (actualización §2.2). Mientras tanto, DTF puede responder desde otra casilla. **No depende de APOC ni frena la entrega (D-078).** |
| I-23 | Migración de clientes sin DNI ni email (D-048) — **Resuelto en D-049** | El alta exige DNI, email y teléfono (actualización §2.1, D-025), y el ingreso a la app necesita email (D-039). En el CSV de Runamatic solo 9 de 1790 tienen DNI y 380 tienen email. | E1 | Abierto. Propuesta: importar como **activos** a los "Cliente Registrado", y también a los que tengan email; marcar "datos a completar" a los que no tienen DNI y pedírselo en el primer ingreso o en el próximo pedido. Los contactos que no tienen email ni son "Cliente Registrado" no se importan como clientes: quedan para Conversaciones cuando escriban. Confirmar con Ezequiel. |
| I-24 | ¿El error de archivo es automático o lo confirma el operador? (D-050) | El contrato (E1.3) dice que la IA sugiere "Archivo con error" y el operador confirma. Ezequiel le dijo a Verónica que se mueve solo. | E1 | Parcial (D-065): automático solo con resolución menor a la mitad del mínimo, apagado por defecto; el resto es sugerencia. Falta confirmar ese límite. Propuesta: automático solo cuando el control es seguro (formato equivocado, resolución efectiva muy por debajo del mínimo); en los casos dudosos (por ejemplo, sospecha de imagen agrandada) se marca para revisar y confirma el operador. Confirmar con Ezequiel. |
| I-25 | Cómo se reconoce la seña (D-050) | "Cuando el cliente pase el comprobante, pasa a Seña recibida": falta definir si alcanza con que mande una imagen o si alguien la verifica. | E1 | Abierto. Propuesta: el asesor ve el comprobante en Conversaciones y toca "Seña recibida" (un clic, queda auditado). La lectura automática del monto queda para después. |
| I-26 | Tableros que faltan (D-050) | Ezequiel listó 6 tableros (Calandra, DTF, DTF UV, Gran Formato, Látex y Sublimación). Verónica nombró además TPU y Embroidery, y el Corte con su casilla `cortes@`. | E1 | **Resuelto en D-082** (definido el 24/11): Gran Formato con Látex, Ecosolvente, UV rollo a rollo, UV rígidos y Cortes; DTF Textil, DTF UV y TPU; sin Embroidery. |
| I-27 | Seña por servicio en la Ayuda de la app (D-053) | Los agentes de Runamatic no coinciden: los de sector piden 50% siempre; el agente "SISTEMA NUEVO" la pide según metros (DTF Textil, Sublimación y Calandra desde 10 m; DTF UV desde 3 m; TPU siempre). La Ayuda muestra la del agente más nuevo. | E1 | Abierto. Confirmar con Verónica y corregir `apps/pwa/app/(app)/ayuda/content.ts`. |
| I-28 | Materiales de cada tablero (D-095) | Ricardo manda un Excel con las opciones de cada producto (por ejemplo las telas de Calandra). Los códigos de DTF Textil (`DTF-GLI`, etc.) los puse yo y son provisorios. | E1 | Abierto. Cargar el Excel en Producción → Materiales por tablero (o por importación) y confirmar los códigos con Ricardo. |

## 4. Bitácora de decisiones

Formato: ID · fecha · fuente · decisión · por qué · impacto en documentos o código.

### D-001 · 17/11/2026 · Ezequiel (chat de desarrollo)
- **Decisión**: la propuesta comercial en PDF del 16/11 queda obsoleta. Para etapas y plazos prevalece lo definido en desarrollo. La "Opción 3" de pago de la propuesta no importa.
- **Por qué**: después de la llamada del 17/11 cambió el alcance (E2 rediseñada, estados por sector, etc.).
- **Impacto**: la propuesta no se usa como fuente.

### D-002 · 17/11/2026 · Ezequiel
- **Decisión**: la socia y contraparte es **Verónica** Rabadan Martín. La propuesta decía "Eliana" por error.
- **Impacto**: en UI, demos y documentos se usa "Verónica".

### D-003 · 18/11/2026 · Contrato
- **Decisión**: las 4 etapas, los valores, los plazos y el orden del §2.1. La E1 arranca el 23/11/2026.
- **Por qué**: ver la columna "Por qué" del §2.1. La razón del contrato es la dependencia: el seguimiento del cliente sale de la producción (cláusula 2.3).
- **Impacto**: reemplaza el §2 del SPEC (2 + 2 + 3 + 3 semanas con otro contenido en la E2) y la propuesta (5 etapas en el texto, 4 en la tabla).

### D-004 · 18/11/2026 · Contrato
- **Decisión**: la Etapa 2 es autoservicio y ayuda en la app más un canal de reclamos. **No hay agente de IA en WhatsApp.** WhatsApp es un solo número, solo para reclamos y casos que requieran un asesor, y no se usa para notificaciones ni para atención general.
- **Por qué**: Verónica no acepta el costo de las plantillas pagas ("USD 200 en menos de 10 días"). El bot actual "se toma atribuciones". La app es el centro del sistema.
- **Impacto**: quedan obsoletos el §5 E2.3 del SPEC (agente con tools), los criterios de aceptación de la E2 (menos del 10% de derivaciones), R-BOT-1 y la fila "OpenAI · E2 · agente" del §8. El modelo `Conversation`/`Message` sigue sirviendo para el canal de reclamos. Ajusta la actualización 2.7: WhatsApp ya no cubre "soporte y postventa" general, solo reclamos y casos que necesitan asesor.

### D-005 · 18/11/2026 · Contrato
- **Decisión**: el asistente dentro de la app **está incluido** en la E2. Antes estaba como "opcional, a confirmar" en la actualización 2.7.
- **Impacto**: hay que planificarlo en la E2 con IA local y OpenAI de respaldo, con un alcance cerrado a la información cargada.

### D-006 · 18/11/2026 · Contrato
- **Decisión**: IA local como principal y OpenAI como respaldo.
- **Impacto**: reemplaza la decisión D2 del SPEC (OpenAI tool-calling como única opción). Hay que diseñar una capa de proveedor de IA intercambiable (local y OpenAI) con fallback y log de uso para controlar el costo.

### D-007 · 18/11/2026 · Contrato
- **Decisión**: el sistema se aloja en el VPS de Hostinger del cliente.
- **Por qué**: ya lo tienen pagado, y el contrato deja los costos de servidor a cargo del cliente.
- **Impacto**: cierra la evaluación de la actualización 2.11. El deploy y la infraestructura apuntan a ese VPS; el D1 del SPEC decía "VPS propio". El costo de hosting de $28.500/mes del SPEC §7 ya no aplica como costo de APOC.

### D-008 · 18/11/2026 · Contrato
- **Decisión**: la integración bancaria automática (Interbanking) queda excluida. Los bancos se manejan con carga manual o importación de movimientos.
- **Impacto**: cierra el "a evaluar" de la actualización 2.8. Si el cliente la quiere, se cotiza aparte.

### D-009 · 18/11/2026 · Contrato
- **Decisión**: el pedido de impresión por la web (SPEC E4.1) **no está en el alcance**. Los trabajos de impresión entran por mail o mostrador y se siguen en la app; la web es solo para comprar insumos.
- **Impacto**: confirma la actualización 2.9. `source=web` en `JobOrder` puede quedar en el enum, pero no hay flujo web en la E4.

### D-010 · 18/11/2026 · Contrato
- **Decisión**: el chat interno entre el cliente y el negocio dentro de la app **no está en el contrato**.
- **Impacto**: pasa al backlog como `cambio-grande` (actualización 2.7 y §7). No se implementa sin la priorización de Ezequiel.

### D-011 · 18/11/2026 · Contrato
- **Decisión**: la razón social es **Viaprint S.R.L.**; el nombre de fantasía es "Via Vinilo".
- **Impacto**: la facturación ARCA (E3) y los textos legales usan la razón social. La marca y la app usan "Via Vinilo".

### D-012 · 18/11/2026 · Actualización 17/11
- **Decisión**: el volumen de referencia es de ~2.100 mensajes por día, no los 1.600 del SPEC.
- **Impacto**: las pruebas de carga y los dimensionamientos usan 2.100.

### D-013 · 18/11/2026 · Ezequiel · resuelve I-02
- **Decisión**: se agrega el estado **"Seña recibida"** entre "Cotizado" e "Impreso". La secuencia queda: Archivo recibido → Cotizado → **Seña recibida** → Impreso → (En proceso de calandra) → Terminado → Entregado.
  - Es obligatorio para las órdenes con `depositRequired` (clientes nuevos). No se puede marcar "Impreso" sin pasar por él; el rol owner puede forzarlo, y queda en auditoría.
  - Para los clientes habituales, que pagan al retirar, no aplica y se pasa de "Cotizado" a "Impreso". *Interpretación de desarrollo: confirmar con Ezequiel si se quiere el paso para todos.*
- **Por qué**: lo que dijo Verónica. Cuando el cliente ve un estado de "en impresión", sale a buscar el trabajo aunque todavía no esté listo. Frenar en "Impreso" llega tarde, porque el trabajo ya está impreso. "Seña recibida" es un estado claro para el cliente, que no sugiere que el trabajo está listo, y deja el control del pago antes de imprimir.
- **Impacto**: R-JOB-3 se reinterpreta así: "una orden con `depositRequired` no puede pasar de Cotizado a Impreso sin pasar por Seña recibida". El test se llama `R-JOB-3: ...` y cubre ese caso. Ajusta el §2.4 de la actualización y el E1.2 del SPEC.

### D-014 · 18/11/2026 · Ezequiel · resuelve I-03
- **Decisión**: cuando entra un mail de un remitente que no es cliente activo, **se crea la orden bloqueada** en un estado "Alta pendiente". Al remitente se le responde por mail con el link para darse de alta en la app. Cuando el asesor aprueba el alta, la orden se libera a "Archivo recibido" y sigue el flujo normal.
- **Por qué**: solo se imprime a clientes del gremio dados de alta (actualización 2.1), pero no queremos perder el trabajo ni obligar a reenviar el mail, porque "los clientes vienen quemados".
- **Impacto**: reemplaza el "Customer provisorio a verificar" del SPEC E1.1. El Customer se crea con `status = pendiente`. La orden bloqueada no aparece en el tablero de producción, sino en una bandeja de altas pendientes para el asesor. Se mantiene la idempotencia por Message-ID.

### D-015 · 18/11/2026 · Ezequiel · resuelve I-01
- **Decisión**: los archivos de impresión se borran **a los 30 días de entregada la orden**. Las órdenes que no se entregaron no se borran.
- **Por qué**: se guardan solo para reclamos, y los reclamos empiezan desde la entrega.
- **Impacto**: job programado diario sobre `JobFile` de órdenes con `DELIVERED` hace más de 30 días. Se borra el archivo del storage y queda el registro con marca de borrado. Reemplaza los 60 días del SPEC §7.

### D-016 · 18/11/2026 · Ezequiel · resuelve I-04
- **Decisión**: el código de acceso a la app se manda **solo por email**.
- **Por qué**: el email es gratis; el SMS y el WhatsApp tienen costo, y R-NOT-1 prohíbe el WhatsApp iniciado por el negocio.
- **Impacto**: reemplaza "OTP al email o al teléfono" del SPEC E1.5 y de `CustomerAppAccount`. El teléfono sigue en la ficha para identificar al cliente, no para el login.

### D-017 · 18/11/2026 · Ezequiel · resuelve I-06
- **Decisión**: en la E1 hay login del personal con **tres roles fijos**: owner, production y attention. La gestión completa de roles y permisos va en la E3, como dice el contrato.
- **Por qué**: en la E1 los operadores tienen que entrar al tablero y los asesores tienen que validar altas, y cada acción tiene que quedar a nombre de una persona (auditoría y `JobEvent.userId`).
- **Impacto**: el paso 2 del plan de la E1 (SPEC §10) usa estos roles. production se limita a su(s) sector(es).

### D-018 · 18/11/2026 · Ezequiel · resuelve I-05
- **Decisión**: en la E3 el medio de pago "puntos" queda **preparado pero apagado** en el POS. Se activa en la E4, junto con la migración de los saldos de Fidely y la acreditación automática.
- **Por qué**: el programa de puntos es de la E4, y habilitar el cobro sin saldos ni reglas abriría la puerta a errores.
- **Impacto**: en la E3, el modelo `Payment` admite el tipo `points`, con un flag de configuración desactivado.

### D-019 · 18/11/2026 · Cliente (grupo de WhatsApp) · branding
- **Decisión**: los colores del sistema salen **del logo de Via Vinilo**, que usa diferentes tonos de azul. Aplican al backoffice interno y a la app de clientes por igual. El cliente manda el logo en PDF vectorial (en curvas).
- **Por qué**: al cliente le gustan esos colores y "transmiten lo que queremos transmitir". El PDF mantiene la calidad y no se deforma.
- **Impacto**: cuando llegue el logo, se extraen los códigos de color y se arma una sola paleta (tokens en `packages/ui`) que comparten `apps/web` y `apps/pwa`. Los íconos y el manifest de la PWA salen del mismo PDF. Hasta entonces se usa una paleta provisoria de azules, marcada como `TODO(spec): branding`.

### D-020 · 18/11/2026 · Cliente (grupo de WhatsApp) · comunicación
- **Decisión**: con el cliente se habla en español, sin anglicismos: "marca" o "identidad visual" en lugar de "branding", "panel" en lugar de "dashboard", etc.
- **Por qué**: el contacto es español y lo pidió explícitamente ("los españoles no hablamos spanglish").
- **Impacto**: aplica a mensajes, demos y textos que vea el cliente. Los textos de la app para los clientes finales siguen en español rioplatense (vos), según CLAUDE.md.

### D-021 · 18/11/2026 · Cliente (logo) + desarrollo · paleta de colores
- **Decisión**: la paleta del sistema sale de los colores vectoriales del logo (`docs/marca/logos-via-vinilo.pdf`):
  - **brand**: cian del logotipo `#00AEEF`.
  - **navy**: azul marino del isotipo `#090F38`.
  - De soporte: **neutral** (gris frío desaturado), **accent** (magenta `#EC008C` de las gotas de tinta de la mascota), **success**, **warning** y **danger**.
  - Cada color tiene una escala 50–950 en OKLCH, generada por `packages/ui/scripts/generate-palette.mjs` en `packages/ui/src/palette.ts`. Los dos colores exactos del logo quedan como `logo.cyan` y `logo.navy`.
  - Usos principales: acciones con `brand-600` y texto blanco; links con `brand-700`; marco del ERP con el marino del logo; textos con `neutral-900` y `neutral-600`.
- **Por qué**:
  - El cian del logo contra blanco tiene un contraste de 2,5:1, así que no sirve para texto ni para botones con texto blanco. Por eso las acciones usan tonos más oscuros del mismo matiz.
  - La herramienta de paletas (ui-color-palette) daba tonos claros muy saturados (`#A4FFFF`) que no sirven de fondo, y su ajuste de saturación no se aplicaba en el extremo claro. Por eso se generó con un script propio, reproducible.
- **Impacto**: `tokens.test.ts` exige contraste WCAG AA (4,5:1) en todos los pares de texto sobre fondo que usa la UI. Para cambiar un color se edita el script y se regenera; no se edita `palette.ts` a mano.

### D-022 · 18/11/2026 · Cliente (grupo de WhatsApp) · qué logo va en cada app
- **Decisión**:
  - **App de clientes (PWA)**: el logo con la **mascota** (`apps/pwa/public/logo-mascota.svg`). El ícono para instalar la app es la mascota sola (`apps/pwa/public/icons/`).
  - **ERP / backoffice**: el logo con el **isotipo** (`apps/web/public/logo-isotipo.svg`).
  - El logo de solo texto (`docs/marca/logo-texto.svg`) queda sin uso asignado; candidato para los mails.
- **Por qué**: según el cliente, el de la mascota es "más humanizado" para los clientes, y el del isotipo es el adecuado para lo administrativo.
- **Impacto**: los SVG se extrajeron del PDF vectorial y se guardan también en `docs/marca/`.
- **Actualización 18/11, 11:40 (grupo de WhatsApp)**: el cliente va a mandar **otra versión de la mascota, con vinilos en los brazos**. Ezequiel respondió que "calcula" que va para la app de clientes. *Todavía no es definitivo.* Cuando llegue, se confirma con el cliente y, si va en la PWA, reemplaza a `logo-mascota.svg` y a los íconos de instalación. Ver pendientes en el §5. **Resuelto en D-031.**

### D-023 · 18/11/2026 · Desarrollo · base técnica del monorepo (paso 1 del SPEC §10)
- **Decisión**:
  - **Versiones**: pnpm 11 y Node ≥ 22.12; NestJS 11, Prisma 6, Next.js 15, React 19, BullMQ 5, zod 4, Vitest 3 y ESLint 9.
  - **Paquetes compartidos**: `contracts` y `ui` se compilan a `dist` (CommonJS) para que los usen NestJS y Next.js sin configuración extra.
  - **Estados**: viven en `@viavinilo/contracts` (`JOB_STATUSES`, textos para el cliente y secuencias por sector). Un test verifica que coincidan con el enum de Prisma.
  - **Máquinas**: una máquina puede atender más de un sector (tabla `MachineSector`), por I-10.
  - **Migración**: la inicial se generó con `prisma migrate diff` y se prueba aplicándola sobre un Postgres en memoria (PGlite) en `migrations.test.ts`, sin necesitar Docker.
- **Por qué**: en la PC de desarrollo no hay Docker. Así los tests de base de datos corren en cualquier lado y la migración se prueba sobre Postgres real.
- **Impacto**: para correr la API y el seed hace falta un Postgres (`docker compose up -d` o el Postgres 16 local) con el `DATABASE_URL` del `.env`. Pendiente de configurar: el `prisma.config.ts` antes de pasar a Prisma 7, y los puertos por entorno, porque en la PC de Ezequiel el 3001 y el 3002 ya los usan otros proyectos.

### D-024 · 18/11/2026 · Desarrollo · login del personal (paso 2 del SPEC §10)
- **Decisión**:
  - **Login**: el personal entra con email y contraseña (`POST /auth/login`) y recibe un token JWT que dura 12 horas, una jornada del taller. Se manda como `Authorization: Bearer`.
  - **Contraseñas**: se guardan con scrypt, que viene con Node y no necesita dependencias nativas, y tienen mínimo 10 caracteres.
  - **Usuario y roles al día**: en cada pedido se relee el usuario. Si lo desactivan o le cambian los roles, aplica al instante, sin esperar a que venza el token.
  - **Roles (D-017)**: todas las rutas exigen login salvo `/health` y el login. `@Roles(...)` limita por rol y OWNER siempre pasa.
  - **Intentos**: el login acepta 5 intentos por minuto por IP. Con email inexistente, contraseña mal o usuario inactivo responde lo mismo, para no revelar qué emails existen.
  - **Usuario inicial**: el dueño lo crea el seed desde `SEED_OWNER_EMAIL` y `SEED_OWNER_PASSWORD`. Si ya existe, no le pisa la contraseña.
- **Por qué**: el SPEC §7 pide contraseñas hasheadas, rate limit y auditoría. La E1 necesita login de operadores y asesores antes de la gestión completa de usuarios de la E3 (D-017).
- **Impacto**: hace falta `JWT_SECRET` en el entorno (ver `.env.example`). La pantalla de login del backoffice y el alta y edición de usuarios desde la UI quedan para un paso siguiente; por ahora los usuarios se crean con el seed o directo en la base.

### D-025 · 18/11/2026 · Desarrollo · reglas de clientes (paso 2 del SPEC §10)
- **Decisión**:
  - **Alta desde el backoffice**: la hace un asesor (ATTENTION u OWNER), así que el cliente queda **activo** y aprobado por ese asesor. Exige nombre, apellido, DNI, al menos un email y al menos un teléfono (actualización §2.1).
  - **Alta pendiente** (de un mail o de la app, D-014): el asesor la aprueba con `POST /customers/:id/approve`, que exige esos mismos datos mínimos y responde qué falta.
  - **Únicos**: DNI, cada email y cada teléfono son únicos entre clientes, y el error dice cuál choca.
  - **Normalización** (`@viavinilo/contracts`): emails en minúsculas; DNI solo con dígitos; teléfonos en E.164, con todo número argentino en la forma de celular `+549…` (I-12).
  - **Búsqueda**: nombre y apellido sin importar tildes, mayúsculas ni orden (columna `searchText`); número de cliente; DNI; email y teléfono.
  - **Permisos**: todo el personal consulta. Atención y el dueño cargan, editan, aprueban, bloquean (con motivo) y desbloquean. Solo el dueño da de baja.
  - **Baja**: es lógica (`deletedAt`). Se borran los emails y teléfonos para que se puedan volver a usar en otra alta, y quedan guardados en la auditoría.
  - **Mínimos de un cliente activo**: no puede quedarse sin email ni sin teléfono.
  - **Auditoría**: todo cambio (alta, edición, aprobación, bloqueo, baja, contactos) queda en `AuditLog` con quién lo hizo.
- **Por qué**: actualización §2.1 (alta obligatoria validada por asesor, DNI como clave, notas internas) y "los clientes vienen quemados de pasar sus datos": la búsqueda tiene que encontrarlos aunque escriban distinto.
- **Impacto**: migración `20261118120000_customer_search_text`. **Todo código que cree o edite clientes** (el worker de mails, la app y la migración desde Tango) tiene que completar `searchText` con `customerSearchText()`.

### D-026 · 18/11/2026 · Ezequiel (chat de desarrollo) · alcance de la fase y agente conversacional
- **Decisión**:
  - **Ritmo**: no se construye toda la Etapa 1 de una. Hay que acompañar el proceso de producción real de cada sector, así que por ahora se avanza con la **ingesta de mails (paso 3)** contra MailHog y después se adapta a Hostinger.
  - **Próximo paso**: cuando esté el VPS, se sube lo hecho y se empieza con el **agente conversacional en Paperclip, con OpenAI de respaldo**. El agente respondería a los clientes por la app (de forma conversacional) **y a los mails**.
- **Por qué**: el proceso evolutivo y de producción de cada sector todavía se está relevando; las capturas de Runamatic y las máquinas reales siguen pendientes (I-10, I-11).
- **Impacto**: lo del agente tiene **puntos abiertos (I-13)** contra el contrato y la actualización. No se programa nada del agente hasta resolverlos.

### D-027 · 18/11/2026 · Desarrollo · ingesta de mails (paso 3 del SPEC §10)
- **Decisión**:
  - **Núcleo único** (`apps/worker/src/mail/ingest.ts`) con dos fuentes intercambiables según `MAIL_SOURCE`:
    - **imap**: Hostinger, una casilla por sector. Lee en modo solo lectura: no marca los mails como leídos, así el personal los sigue viendo igual durante la transición.
    - **mailhog**: desarrollo. MailHog **no tiene IMAP**, así que se lee por su API web, se rutea por destinatario y se borra el mail leído.
  - **Lectura**: cada 60 s con un job programado de BullMQ.
  - **IMAP**: guarda el último UID por casilla (`MailboxState`). **La primera conexión arranca desde ahora** y no importa el historial (si no, entrarían años de mails como órdenes). Si el servidor renumera la casilla (cambia el UIDVALIDITY), se retoma desde ahora y queda anotado.
  - **Deduplicación** por Message-ID **y sector**: un mail con copia a dos casillas crea una orden en cada una. Si el mail no trae Message-ID, se usa un hash del contenido.
  - **Cliente**: se identifica por el email del remitente (cualquiera de sus emails).
    - Activo → orden en "Archivo recibido".
    - Sin alta → cliente pendiente + orden en "Alta pendiente" + mail con el link de alta, como máximo uno por día (D-014). Las respuestas a ese mail vuelven a la casilla del sector (Reply-To, actualización §2.2).
    - Bloqueado → no hay orden (I-14).
  - **Un mail con varios adjuntos = una orden con varios archivos.** Se descartan los logos incrustados de la firma. Los archivos van a disco (`STORAGE_DIR`) antes de crear la orden, con clave estable por mail.
  - **Del cuerpo** se guardan el asunto, el texto (hasta 4.000 caracteres), las medidas declaradas (por ejemplo "1,20 x 0,80 m" → 120 × 80 cm) y los links de WeTransfer, Drive o Dropbox, sin descargarlos.
  - **No crean orden**: los mails sin adjuntos ni links (I-15) y las respuestas automáticas o rebotes.
  - **Log**: cada mail procesado queda en `MailIngestLog` con su resultado, para auditar que no se pierda ninguno (actualización §2.2). `MailboxState.lastMessageAt` queda listo para la alerta de "casilla sin mails en X horas", que todavía no está programada.
- **Por qué**: SPEC E1.1 y su criterio de aceptación (400 órdenes por día sin duplicar ni perder mails), actualización §2.2 y D-014.
- **Impacto**: migración `20261118150000_mail_ingest`. El worker usa el cliente de Prisma generado desde `apps/api/prisma/schema.prisma`. **No probado contra un servidor IMAP real ni con Redis**: la lectura IMAP se probó con una casilla simulada. Hace falta el acceso a Hostinger para probarla de punta a punta.

### D-028 · 18/11/2026 · Ezequiel (chat de desarrollo) · agente conversacional · resuelve I-13
- **Decisión**:
  1. **Canales**: el agente responde a los clientes **en la app y también por mail**. Se toma como **ajuste menor sin costo** (contrato, cláusula 9.1); no se le plantea al cliente como algo adicional.
  2. **Orden de etapas**: **primero se cierra la Etapa 1 y después se arranca la 2.** La única excepción es si el agente hace falta para entregar la E1, para poder cobrarla o para que Ezequiel vea resultados antes.
  3. **Tecnología**:
     - **Paperclip** es la plataforma que coordina al agente. Es la que APOC ya usa en otros desarrollos (Ezequiel mencionó "Gemi" y el de Automatía, a verificar con las carpetas que va a pasar).
     - El modelo es una **IA local gratuita** (Llama u otra similar), con **OpenAI de respaldo**. Es coherente con el contrato (D-006).
  4. **Alcance**: el agente responde solo, **sin revisión humana**, únicamente con información que está en el sistema:
     - dónde está mi pedido y en qué estado;
     - cuánto falta para la entrega;
     - si ya se imprimió;
     - si recibieron el archivo;
     - las preguntas frecuentes cargadas (precios, horarios, cómo enviar archivos).
     Todo lo demás lo deriva a un asesor, y nunca promete ni modifica nada (actualización 2.7).
- **Por qué**: lo que más mensajes genera son justamente esas consultas de estado (el 70–90%, SPEC §1), y todas se responden con datos del sistema. Lo que no está en el sistema es donde el bot actual "se toma atribuciones".
- **Impacto**:
  - "Cuánto falta" necesita que la E1 complete `estimatedReadyAt` en las órdenes. Sin ese dato el agente tiene que decir que no lo sabe y derivar.
  - Los mails que hoy no crean orden porque no traen archivo (I-15, `SKIPPED_NO_FILES`) son justamente las consultas que el agente va a contestar en la E2. Ya quedan registrados en `MailIngestLog`.
  - Las respuestas por mail salen por SMTP con Reply-To a la casilla del sector, igual que el mail de alta (D-027).
  - Hay que definir al arrancar la E2: qué modelo local se usa y si entra en el VPS de Hostinger del cliente (si hace falta más servidor, lo paga el cliente, según el contrato). Ver D-029.

### D-029 · 19/11/2026 · Ezequiel + desarrollo · Trip como referencia del agente (verificación de D-028)
- **Decisión**: el agente de Via Vinilo se arma **como el de Trip** (`Apoc Automation Clientes/Trip`), que es el desarrollo de APOC con IA local. Elevatex y GEMI se revisaron y no aplican (ver más abajo).
- **Cómo está armado en Trip** (verificado en el código):
  - **El agente que atiende clientes es código propio dentro de la API** (`apps/api/src/mensajeria/agente.ts`), no corre dentro de Paperclip:
    - junta los mensajes que el cliente manda seguidos (unos 3,5 s);
    - arma el contexto con la ficha del cliente y el catálogo vigente, que sale del sistema;
    - llama al modelo con **herramientas que leen la base** (paquetes, salidas, guardar datos, pasar a un vendedor);
    - si no sabe algo, deriva y se apaga en esa conversación.
  - **Modelos**: Ollama local (`qwen3:8b` para responder y `qwen3:1.7b` para clasificar) y, si falla o tarda (90 s), **OpenAI por API** (`gpt-4.1-mini` por defecto). Se cambian desde el sistema sin tocar código (`apps/api/src/config/claves.ts`, clave `agente.modelo`).
  - **Paperclip va al lado, como "gobierno de los agentes"** (`docs/plan-implementacion.md` §9): presupuesto de gasto por agente (tope de OpenAI), aprobación humana para acciones sensibles, auditoría y un "Builder" con Claude Code. El plan prevé que, si Paperclip no sostiene la velocidad de un chat, el mensaje vaya directo al agente y Paperclip quede para presupuestos y auditoría.
  - **Infraestructura**: Ollama y Paperclip corren en un proyecto Docker aparte (`infra/agente/docker-compose.yml`), con Paperclip con su propia base Postgres. Ollama tiene tope de 6 vCPU y 12 GB y prioridad baja, para que una ráfaga de mensajes no ponga lento el sistema. El plan estima unos 6 GB para Ollama y 3 GB para Paperclip.
  - **Control desde el sistema**:
    - el agente arranca **apagado** y tiene interruptor general;
    - números de prueba;
    - editor del prompt con versiones y vuelta atrás;
    - conversación de prueba que no manda nada;
    - registro de cada respuesta (proveedor, modelo, tiempo, tokens).
- **Qué se reusa para Via Vinilo**:
  - El enrutador Ollama → OpenAI, el registro de respuestas, el editor de prompt y la conversación de prueba.
  - El patrón de herramientas que leen la base. Para Via Vinilo serían: estado de mis órdenes, cuánto falta, preguntas frecuentes, precios por sistema y pasar a un asesor (D-028).
  - **Lo nuevo**: el canal de mail (Trip solo tiene WhatsApp, Instagram y Facebook) y el canal de la app.
- **Elevatex y GEMI**:
  - En **Elevatex**, Paperclip es un orquestador **interno**: sus agentes corren con Claude Code (`adapterType: 'claude_local'`), trabajan por tareas asincrónicas y tienen la regla "No envías nada"; una persona aprueba todo lo que sale.
  - **GEMI** atiende clientes por WhatsApp con un núcleo conversacional propio (Kapso) y Claude por API, **sin Paperclip**.
  - Ninguno de los dos usa modelos locales.
- **Por qué**: Trip ya resolvió el mismo problema (IA local gratuita, OpenAI de respaldo, solo datos del sistema, Paperclip para gobernar), con el mismo stack que Via Vinilo (NestJS + Prisma). Reusarlo baja el riesgo y el tiempo de la E2.
- **Impacto**:
  - **Pendiente nuevo**: ver el plan del VPS de Hostinger del cliente. Trip calcula 8 vCPU, con unos 6 GB solo para el modelo local. Si no alcanza, la ampliación la paga el cliente, según el contrato.
  - Para atender clientes reales hace falta una **cuenta de API** de OpenAI, no una suscripción (en GEMI hubo que cambiarla por eso).
  - Nada de esto se programa antes de cerrar la E1 (D-028).

### D-030 · 19/11/2026 · Desarrollo · tablero de producción (paso 4 del SPEC §10)
- **Decisión**:
  - **Reglas de cambio de estado** (`packages/contracts/src/transitions.ts`): funciones puras que usan la API para validar y el tablero para mostrar solo los botones posibles.
    - Se avanza **de a un paso** según la secuencia del sector (`SectorStage`). Saltear da error: "los pasos no se pueden saltear" (actualización §2.4).
    - **"Seña recibida"** solo aplica si la orden la requiere; si no, de Cotizado se pasa a Impreso (D-013).
    - **R-JOB-3**: sin seña no se imprime. Solo el dueño puede forzarlo; queda en el historial ("Sin seña (forzado por el dueño)") y en la auditoría.
    - **R-JOB-2**: para pasar a Cotizado hay que cargar el precio. Se puede cargar también la hora estimada de entrega, que el agente va a necesitar para "cuánto falta" (D-028). Todo cambio de precio va a la auditoría.
    - **"Archivo con error"**: exige motivo del catálogo. Se puede marcar mientras el trabajo no esté impreso y vuelve a "Archivo recibido".
    - **Cancelar**: exige motivo.
    - **"Entregado"** registra `deliveredAt`, desde donde corre la retención de 30 días (D-015).
  - **Tablero** (`GET /jobs/board`): una columna por paso de la secuencia del sector, con "Archivo con error" después de "Archivo recibido".
    - Ordena por llegada, o agrupado por material, y marca cuántas órdenes pendientes comparten material (E1.4).
    - No muestra altas pendientes ni canceladas; de las entregadas, solo las del día.
    - Filtros por máquina, material, fecha y búsqueda por número de orden o cliente (sin tildes).
  - **Asignación de máquina**: solo máquinas que trabajan en el sector de la orden.
  - **Permisos (D-017)**: producción solo ve y mueve su(s) sector(es) (`UserSector`); el dueño y atención ven todos.
  - **Dos clics a la vez**: si dos operadores tocan la misma orden, avanza una sola vez; el segundo recibe "la orden cambió, actualizá el tablero".
  - **Tiempo real**: SSE (`GET /jobs/board/stream`). La API revisa cada 2 s si cambió el sector (cantidad de órdenes y última modificación) y avisa; el tablero se recarga solo.
    - Se eligió revisar la base y no un aviso entre procesos porque las órdenes nuevas las crea **otro proceso** (el worker de mails), y así no hace falta Redis ni LISTEN/NOTIFY.
    - El navegador usa `fetch` con el token en el encabezado, no `EventSource`, para no poner el token en la URL.
  - **Al aprobar un alta**, las órdenes en "Alta pendiente" pasan a "Archivo recibido" y entran al tablero (D-014).
  - **Backoffice** (`apps/web`):
    - login del personal;
    - tablero por sector con pestañas;
    - un **botón grande por tarjeta** con el próximo paso ("Cotizar", "Marcar impreso", "Pasar a calandra"…);
    - acciones secundarias de error de archivo, cancelar e "Imprimir sin seña" (solo el dueño);
    - selector de máquina;
    - indicador "En vivo";
    - horas siempre en horario de Salta y en 24 h, sin depender de la PC del taller.
- **Por qué**: SPEC E1.4 y actualización §2.4 ("los pasos son obligatorios", "botones grandes de un clic", "si cuesta trabajo, los empleados no lo van a usar").
- **Impacto**:
  - El token del personal se guarda en `localStorage` del navegador del taller. Antes de producción conviene evaluar pasarlo a una cookie `httpOnly`.
  - Queda **pendiente para el paso 5**: editar medida, precio y descripción desde la ficha de la orden (actualización §2.4), dividir órdenes y editar el catálogo de motivos de error. También volver un paso atrás (I-16).
  - Notificar al cliente en cada cambio es del paso 6 (push y mail).

### D-031 · 19/11/2026 · Ezequiel · logo definitivo de la app de clientes (actualiza D-022)
- **Decisión**: el logo de la app de clientes es **el último logo del PDF** (texto apilado "VIA / VINILO / MAYORISTA GRAFICO") con la **mascota de los vinilos** en lugar de la mascota original. Los íconos para instalar la app usan la mascota de los vinilos sola, sobre blanco.
- **Cómo se armó** (reproducible con `docs/marca/scripts/`):
  - **La mascota** llegó como JPG con fondo gris claro (`docs/marca/mascota-vinilos-original.jpg`). Se le sacó el fondo con un relleno desde los bordes, que frena en el contorno oscuro, así el cuerpo blanco queda intacto (`mascota-vinilos.png`).
  - **El texto** se copió del PDF como **trazos vectoriales**, solo los del último logo, para que se vea nítido en cualquier tamaño.
  - **El logo** es un SVG de unos 21 KB con la mascota incrustada (reducida y con paleta de colores para que pese poco) y el texto vectorial.
- **Por qué**: lo decidió el cliente; la mascota con los vinilos muestra el rubro. La versión anterior queda guardada como `docs/marca/logo-mascota-original.svg`.
- **Impacto**: cambian `apps/pwa/public/logo-mascota.svg` y los íconos de `apps/pwa/public/icons/` (192, 512 y 180 px). El backoffice sigue con el logo del isotipo (D-022).

### D-032 · 19/11/2026 · Ezequiel (chat de desarrollo) · el sistema son dos cosas: ERP y app de clientes
- **Definición**: el sistema son **dos productos**:
  1. **ERP de gestión integral** (`apps/web`) para el personal de Via Vinilo.
  2. **App de clientes** (`apps/pwa`) para lo comercial.
- **El ERP se organiza por apartados**, con un menú lateral:
  - **Ventas**: conversaciones y pedidos que llegan desde la app de clientes, y clientes. La bandeja de conversaciones sigue el modelo de **Krokanticas** (lista de chats, chat, asistente IA o asesor, etiquetas, respuestas rápidas), pero conectada a **nuestra app** en lugar de WhatsApp. Suma un panel con los datos del cliente y sus pedidos activos (I-18).
  - **Producción**: los tableros por sector que ya funcionan, más el panel de tiempos. Los operadores **tienen que** mover la tarjeta para poder trabajar (propuesta en I-17).
  - **Administración**: comprobantes ARCA, cobranzas, facturas de compra, proveedores, bancos y caja, stock, Libro IVA Ventas, Libro IVA Compras, posición de IVA y reportes. Toma como ejemplo el lado administrativo de **GHM**; las columnas y estados de cada listado se copiaron de GHM. El apartado "Proyectos" de GHM Contenidos es, en Via Vinilo, el proceso productivo de Producción.
- **Qué se hizo ahora**: solo lo **visual**, para mandarle capturas al cliente como seguimiento.
  - El **tablero de producción** es real y se rediseñó: columnas con color y número de paso, barra de avance, tiempo en el paso y archivo bloqueado hasta que la orden se puede imprimir.
  - **El resto de las pantallas** son vistas previas con datos de ejemplo inventados (CUIT, CAE, montos, precios y nombres ficticios). Cada una lleva la marca "Vista previa · Etapa N" (`apps/web/app/(erp)/screens.ts`).
  - El login también se rediseñó.
- **Por qué**:
  - El backoffice anterior era una sola pantalla de producción y se veía antiguo.
  - El cliente necesita ver el sistema completo para entender hacia dónde va cada etapa.
  - Hacerlo visual primero permite validar el menú y los listados antes de programarlos, sin adelantar las etapas 2 y 3 ("una etapa por vez").
- **Impacto técnico**:
  - Rutas nuevas en el grupo `(erp)`: `/inicio`, `/ventas/*`, `/produccion/[sector]`, `/produccion-tiempos`, `/administracion/[seccion]` y `/configuracion`.
  - `/tablero/*` redirige a `/produccion/*`.
  - Al entrar, producción va directo a su tablero; el dueño y atención van a Inicio.
  - Íconos con `lucide-react`, tipografía Inter y logo blanco para la barra lateral (`logo-isotipo-blanco.svg`). La API no cambia.
  - **Actualizado por D-033**: el menú pasó de la barra lateral a la barra superior.

### D-033 · 19/11/2026 · Ezequiel (chat de desarrollo) · menú arriba, desplegable y sin texto de más (ajusta D-032)
- **Definición**:
  - **El menú va arriba**, como en el primer tablero: barra blanca con el logo a color y la línea marino abajo, que a Ezequiel le gustaba.
  - **Cada apartado se despliega**: Ventas, Producción y Administración abren su menú con un clic. Producción muestra arriba los tableros de cada sector. Inicio es un link directo y Configuración es el engranaje de la derecha.
  - **Sin emojis**.
  - **Sin textos redundantes**: cada pantalla muestra solo el título. La explicación queda en un botón **"?"** al lado del título. El aviso de pasos obligatorios del tablero también pasó al "?".
- **Por qué**: la barra lateral y los textos explicativos ocupaban lugar y hacían la pantalla más pesada. El "?" deja la explicación a mano para quien la necesite sin repetirla en cada vista.
- **Impacto técnico**:
  - `app/(erp)/layout.tsx` arma la barra superior a partir de `nav.ts` (el menú sigue definido en un solo lugar).
  - Componente `Help` en `app/(erp)/help.tsx`. `PageHead` ya no tiene subtítulo: el texto va en `help`.
  - Con un menú abierto, pasar el mouse por otro apartado lo abre. El clic afuera o Escape lo cierran.
  - `logo-isotipo-blanco.svg` queda para el login.

### D-034 · 19/11/2026 · Ezequiel (chat de desarrollo) · front de la app de clientes
- **Definición**: se arma el front de la app de clientes (`apps/pwa`), pensada para el celular. Abajo tiene una barra con 4 secciones:
  - **Pedidos** (inicio de la app): saludo con nombre y número de cliente, contadores (en curso, para retirar, con error), y pedidos en curso y entregados.
    - Cada pedido muestra su barra de avance, su estado y su precio.
    - Si hay un error en el archivo, se ve el motivo.
    - Si está listo, se ve el aviso "Ya lo podés pasar a buscar".
  - **Detalle del pedido**: estado, precio, seña y saldo, medida y hora en que está listo. Incluye el seguimiento paso a paso con fecha y hora, y los archivos. Si el archivo tiene un error, aparece el botón **"Reenviar archivo"** (SPEC E1.5). También está **"Consultar por este pedido"**, que abre el asistente.
  - **Enviar trabajo**: sector, archivo y medida (ancho, largo, cantidad) son obligatorios; las aclaraciones son opcionales. La orden nunca nace sin archivo (actualización §2.5 y §2.9; límites en I-19).
  - **Ayuda**: acceso al asistente, listas de precios, instructivos, horarios, cómo llegar, preguntas frecuentes y "Hablar con un asesor" (Etapa 2, actualización §2.7).
  - **Asistente**: chat con respuestas sugeridas. Responde con datos del sistema, como la tarjeta del pedido, y deriva a un asesor (D-028, D-029). Es de la Etapa 2.
  - **Cuenta**: datos, número de cliente, switches de avisos (push y mail) y saldo de puntos. Los puntos son de la Etapa 4.
  - **Avisos** (campana): un aviso por cada cambio de estado.
  - **Ingreso sin contraseña**: email, código de 6 números (D-016) y link a **Alta de cliente**. El alta pide nombre, apellido, DNI, email, celular y empresa (opcional), y queda pendiente hasta que la valida un asesor (D-014).
- **Qué se hizo ahora**: es **solo visual**, con datos de ejemplo (`apps/pwa/app/data.ts`), igual que las vistas previas del ERP (D-032). Las pantallas de etapas posteriores llevan una etiqueta "Etapa N". El estilo es el mismo que el del ERP:
  - colores del logo;
  - logo con la mascota de los vinilos (D-031);
  - Inter e íconos `lucide-react`;
  - sin emojis y con poco texto (D-033).
- **Por qué**: la app es "el centro de todo" (actualización, §1). Ver el recorrido completo del cliente sirve para validarlo con Verónica antes de conectar la API (OTP, pedidos y push son del paso 6).
- **Impacto técnico**:
  - Rutas `(app)`: `/`, `/pedidos/[id]`, `/enviar`, `/ayuda`, `/ayuda/asistente`, `/cuenta` y `/avisos`.
  - Rutas `(auth)`: `/ingresar` y `/alta`. `/alta` es la dirección que va en el mail a remitentes nuevos (`SIGNUP_URL`).
  - La API no cambia.

### D-035 · 19/11/2026 · Ezequiel + desarrollo · preparación del VPS de Hostinger
- **Definición**: Ezequiel dio acceso por SSH al VPS del cliente (D-007) y pidió prepararlo. El acceso es con una clave SSH dedicada a este proyecto, que queda solo en la máquina de desarrollo. La IP y los accesos no se guardan en el repo.
- **Cómo quedó el servidor**:
  - **Base**: Ubuntu 26.04 LTS, 4 vCPU, 15 GB de RAM y 193 GB de disco. Se actualizaron todos los paquetes.
  - **Usuario `deploy`**: tiene sudo y está en el grupo `docker`. Desde ahora se trabaja con este usuario y no con root. El sistema va en `/srv/viavinilo`.
  - **Firewall (ufw)**: entra solo el 22 (SSH), el 80 y el 443.
  - **fail2ban**: banea por 1 hora a quien falle 5 veces el SSH en 10 minutos.
  - **Parches de seguridad automáticos**: unattended-upgrades.
  - **Docker 29 y Docker Compose 2.40**: instalados desde los repositorios de Ubuntu.
  - **Caddy 2.6**: instalado como servidor web, sin dominios configurados todavía.
- **Por qué**:
  - Docker Compose permite levantar en el servidor el mismo stack que en local (`docker compose`: Postgres, Redis, API, worker y las dos apps).
  - Caddy saca y renueva solo el certificado HTTPS.
  - Los paquetes son de Ubuntu, sin scripts de terceros, para que las actualizaciones automáticas los cubran.
- **Impacto**:
  - Docker publica puertos salteando ufw, así que los contenedores tienen que escuchar solo en `127.0.0.1`. Al exterior se sale únicamente por Caddy.
  - **Faltan los dominios**: por ejemplo, uno para el ERP y otro para la app de clientes, apuntando a la IP del VPS. Sin eso no hay HTTPS, y la PWA y el push lo necesitan.
  - **Choque con D-029**: Trip calcula 8 vCPU para el modelo local del agente y el VPS tiene 4. Alcanza de sobra para la E1. Para la IA local de la E2 hay que medir; si no alcanza, la ampliación la paga el cliente, según el contrato. Ver I-20.

### D-036 · 19/11/2026 · Ezequiel + desarrollo · DNS de viavinilo.tech apuntando al VPS
- **Definición**: Ezequiel pidió apuntar el dominio `viavinilo.tech` al VPS del cliente (D-035). El cambio se hizo desde la zona DNS de Hostinger, con su conector.
- **Cómo quedó la zona**:
  - **`@`, `www` y `erp`**: registros A al VPS, con TTL 300. Igual que en D-035, la IP no se guarda en el repo: es la del VPS.
  - **Parking borrado**: se borraron el A de `@`, que apuntaba al parking de Hostinger, y el CNAME de `www`, que apuntaba a `@`. Un CNAME no puede convivir con un A en el mismo nombre.
  - **Sin otros registros**: la zona no tiene MX, así que hoy el dominio no recibe mail.
- **Verificación (19/11)**:
  - Los tres nombres resuelven a la IP del VPS en el nameserver de Hostinger, en 8.8.8.8 y en 1.1.1.1.
  - Caddy, ya configurado en el VPS, sacó solo un certificado de Let's Encrypt para cada nombre, que vence el 17/02/2027 y lo renueva Caddy.
  - `https://viavinilo.tech`, `https://www.viavinilo.tech` y `https://erp.viavinilo.tech` responden HTTP 200 con la cadena válida.
  - En el puerto 80, Caddy redirige a HTTPS (308).
- **Por qué**:
  - D-035 dejó pendiente el dominio: sin él no hay HTTPS, y la PWA y el push lo necesitan.
  - El TTL de 300 permite corregir rápido mientras se arma el deploy. Cuando se estabilice se puede subir.
- **Impacto**:
  - Queda resuelto el pendiente "Dominios" del §5.
  - `erp.viavinilo.tech` es el ERP. **La raíz `viavinilo.tech` (y `www`) es la app de clientes**: lo definió Ezequiel el 19/11 en el chat de desarrollo.
  - `SIGNUP_URL` en producción va a ser `https://viavinilo.tech/alta`.
  - Falta definir por dónde se expone la API. La propuesta es la ruta `/api` dentro de cada dominio, por Caddy: así no hace falta un subdominio más y se evitan los problemas de CORS. Se define al subir el sistema. **Resuelto en D-037**: queda en `/api`.

### D-037 · 19/11/2026 · Ezequiel + desarrollo · primer deploy en el VPS
- **Definición**: Ezequiel pidió subir el sistema al VPS. Desde hoy:
  - `https://viavinilo.tech` sirve la app de clientes.
  - `https://erp.viavinilo.tech` sirve el ERP.
  - Las dos usan la API en `/api`.
  - `www` redirige a la raíz.
- **Cómo quedó**:
  - **Imagen única** (`Dockerfile`): compila todo el monorepo una vez (`pnpm -r build`), y cada servicio del compose la arranca con su propio comando. La imagen se construye en el mismo VPS: no hay registro de imágenes ni acceso del servidor a GitHub. El código se sube con `git archive` por SSH a `/srv/viavinilo`.
  - **`deploy/docker-compose.prod.yml`**: postgres 16, redis (con AOF), api, worker, web y pwa.
    - Ningún contenedor expone puertos al exterior; solo escuchan en `127.0.0.1` (D-035).
    - La API aplica `prisma migrate deploy` al arrancar.
    - Los archivos de las órdenes quedan en el volumen `storage`.
  - **`deploy/Caddyfile`**: HTTPS, `/api` hacia la API sin buffer (para el SSE del tablero), HSTS y compresión. Se copia a `/etc/caddy/Caddyfile`.
  - **Secretos**: `deploy/.env` existe solo en el VPS (permisos 600). La contraseña de Postgres y `JWT_SECRET` se generaron ahí mismo y no salieron del servidor. La plantilla es `deploy/.env.prod.example`.
  - **Seed**: se cargaron solo los catálogos (6 sectores, 16 máquinas y 6 motivos de error). No hay usuario dueño ni datos de demo.
  - **Worker**: está con `MAIL_SOURCE=off` y `SMTP_URL` vacío hasta tener las casillas por sector. Se arregló que no arrancaba con `SMTP_URL` vacío: ahora saltea el mail de alta y lo deja en el log (con test).
- **Verificado (19/11)**:
  - Los tres dominios responden con HTTPS.
  - `/api/health` responde `{"status":"ok","db":"ok"}`.
  - El login del ERP llega a la API por `/api` (credenciales malas → 401 con CORS correcto).
  - El puerto 3001 no responde desde afuera.
- **Por qué**: mostrar el avance en las direcciones reales antes del inicio de la E1 (23/11, §5, "Expectativa a cuidar"). Compilar en el VPS evita montar un registro y darle al servidor acceso al repo. Con 4 vCPU el build tarda unos 2 minutos.
- **Impacto y pendientes**:
  - La app de clientes todavía muestra los **datos de ejemplo** de D-034 (cliente y pedidos ficticios), en una dirección pública. Se reemplazan cuando se conecte la API (paso 6).
  - **Falta el usuario dueño**: el ERP muestra el login, pero nadie puede entrar todavía. Se crea con `SEED_OWNER_*` en el `.env` del VPS. La contraseña la define Ezequiel, no se inventa.
  - **Cómo actualizar**: subir el código con `git archive HEAD | ssh deploy@<vps> "cd /srv/viavinilo && tar -xf -"` y correr `docker compose -f deploy/docker-compose.prod.yml build api && docker compose -f deploy/docker-compose.prod.yml up -d`.
  - **Faltan backups de Postgres**. Hay que definir dónde se guardan, fuera del VPS.
  - Los contenedores corren como root dentro de la imagen. Conviene pasarlos a un usuario sin privilegios.
  - Las casillas de mail por sector (D-027) van a necesitar registros MX en esta zona. Hay que agregarlos sin tocar los A.

### D-038 · 19/11/2026 · Ezequiel (chat de desarrollo) · logins y alta de clientes solo desde el ERP (cambia D-014 y la actualización §2.1)
- **Definición**:
  - **Sin autoalta**: el cliente no puede darse de alta solo. Si no es cliente, se contacta con la empresa **por WhatsApp**, y un asesor le crea el usuario desde el ERP. Se saca la pantalla `/alta` de la app.
  - **Ingreso a la app con el email**: el cliente pone uno de los emails de su ficha y recibe un código de 6 números en ese email (D-016). Nadie tiene contraseña. Puede entrar con cualquier email de la ficha, mientras el cliente esté **activo**.
  - **Alta en el ERP con todos los datos que usan las automatizaciones**:
    - **Identidad**: nombre, apellido y DNI. Son obligatorios (actualización §2.1).
    - **Emails** (al menos uno): con cualquiera entra a la app; el principal recibe los avisos; todos sirven para reconocer al remitente de un mail (E1.1).
    - **Teléfonos** (al menos uno): el principal es su WhatsApp e identifica sus chats en la E2.
    - **Empresa o marca**: opcional.
    - **Datos fiscales para facturar con ARCA (E3)**: CUIT, razón social, condición frente al IVA, y domicilio fiscal (domicilio, localidad y provincia). Son opcionales hasta la E3.
    - **Condiciones comerciales**: gremio (sí por defecto) y cuenta corriente (no por defecto).
    - **Avisos**: push y email, los dos prendidos por defecto.
    - **Notas internas**.
  - **Mail de un remitente que no es cliente** (cambia D-014): la orden se sigue guardando bloqueada en "Alta pendiente", pero el mail que se le responde ya no lleva un link de alta. Le dice que **escriba por WhatsApp** para que un asesor le dé de alta. Cuando el asesor completa la ficha y la aprueba, la orden se libera como antes.
- **Por qué**: el alta la valida un asesor (actualización §2.1), y Ezequiel quiere que pase siempre por una persona, así se controlan los requisitos de ingreso (que sea del gremio). Los datos fiscales se piden desde el alta para no tener que volver a pedírselos en la E3, porque "los clientes vienen quemados de pasar sus datos". Que esos datos sean opcionales permite dar de alta rápido a un cliente que todavía no los tiene a mano.
- **Impacto técnico**:
  - Migración `customer_profile_and_login`:
    - en `Customer`: `businessName`, `cuit`, `legalName`, `taxCondition`, `fiscalAddress`, `city`, `province` y `creditEnabled`;
    - tabla nueva `CustomerLoginCode`.
  - **Códigos**:
    - Duran 10 minutos y admiten 5 intentos.
    - Se guarda solo un hash (HMAC con `JWT_SECRET`).
    - Pedir un código nuevo anula el anterior.
    - Como mucho 1 código por minuto y 5 por hora por email, y 5 pedidos por minuto por IP.
    - La respuesta es siempre la misma, para no revelar qué emails son de clientes.
  - **Sesión del cliente**: token de 30 días con `kind: "customer"`. Esos tokens no sirven en las rutas del personal, ni al revés.
  - **Rutas nuevas**: `POST /app/auth/request-code`, `POST /app/auth/verify` y `GET /app/me`.
  - **Envío**: la API manda el código por SMTP (`SMTP_URL`). Sin SMTP, en desarrollo el código se escribe en el log. En producción responde que no se pudo enviar.
  - **Worker**: `SIGNUP_URL` se reemplaza por `SUPPORT_WHATSAPP_URL` (link `wa.me` del WhatsApp de la empresa).
  - **Pendientes**:
    - **Falta el número de WhatsApp de la empresa**. Hasta tenerlo, el mail dice "escribinos por WhatsApp" sin el link.
    - **Producción no puede mandar los códigos hasta tener una casilla SMTP en Hostinger.** Ver el §5. *(Ya no aplica: ver D-039.)*
  - **Actualizado por D-039**: el ingreso a la app pasa a ser con email y contraseña. El código por mail se saca.

### D-039 · 19/11/2026 · Ezequiel (chat de desarrollo) · la app de clientes entra con email y contraseña (cambia D-016 y D-038)
- **Definición**:
  - El cliente entra a la app con **email y contraseña**. No hay código por mail.
  - La contraseña la carga el **asesor** cuando da de alta al cliente en el ERP; puede escribirla o generar una. Se la pasa al cliente a mano, por WhatsApp o en el mostrador.
  - Si el cliente se la olvida, escribe por WhatsApp y el asesor le pone una nueva desde la ficha. El cliente no tiene "olvidé mi contraseña" ni la puede cambiar solo.
  - Puede entrar con **cualquier email de su ficha**, mientras el cliente esté **activo** y tenga contraseña cargada.
  - El **WhatsApp de la empresa** queda pendiente. Ezequiel propuso poner cualquiera por ahora, pero un número inventado puede ser el de otra persona. Se deja el texto sin link hasta tener el número real.
  - El **usuario dueño del ERP** de producción lo crea desarrollo con una contraseña provisoria, que se cambia después.
- **Por qué**: Ezequiel no quiere depender de una casilla de envío en Hostinger para que los clientes entren. Con email y contraseña no hace falta mandar mails para el ingreso. Que la cargue el asesor mantiene la regla de D-038: no hay autoalta y todo pasa por una persona.
- **Impacto técnico**:
  - Migración `customer_app_password`:
    - en `Customer`: `appPasswordHash` y `appPasswordSetAt`;
    - se borra `CustomerLoginCode`, de D-038.
  - **Contraseñas de clientes**: mínimo 8 caracteres. Se guardan con scrypt, igual que las del personal (D-024), y nunca quedan en la auditoría: solo queda que se cambió y quién la cambió.
  - **Rutas**:
    - `POST /app/auth/login` (email y contraseña → token de 30 días): reemplaza a `request-code` y `verify`. Acepta 5 intentos por minuto por IP y da la misma respuesta si el email no existe, si la contraseña está mal, si el cliente no está activo o si no tiene contraseña.
    - `POST /customers/:id/app-password` (atención y dueño): pone o cambia la contraseña de la app.
  - Se saca el envío de mails desde la API (`MailerService`). El SMTP sigue haciendo falta para el worker: mail a remitentes nuevos y, más adelante, avisos.
  - Las sesiones de clientes siguen igual que en D-038: token con `kind: "customer"`, separado del personal, y se cortan al bloquear.
  - **Al cambiar la contraseña de un cliente se cortan las sesiones que tenía abiertas**: un token emitido antes de `appPasswordSetAt` ya no sirve. Así, si alguien conocía la contraseña vieja, queda afuera.

### D-040 · 19/11/2026 · Ezequiel (chat de desarrollo) · producción sin datos de prueba
- **Definición**: producción arranca limpia.
  - Se borró de la base el cliente de prueba de la verificación de D-039, con su auditoría, y la numeración de clientes volvió a empezar en el N.º 1.
  - La app de clientes deja de mostrar los pedidos de ejemplo de D-034. Ahora muestra "No tenés pedidos en curso" hasta conectar el seguimiento real (paso 6).
  - Primer cliente real: Ezequiel, para probar la app.
- **Por qué**: Ezequiel pidió borrar todos los datos de prueba. Mostrarles pedidos inventados a clientes reales confunde.
- **Impacto**:
  - Las pantallas del ERP marcadas "Vista previa" siguen con datos de ejemplo. Son maquetas de etapas posteriores (D-032) y no leen la base.
  - Si la API falla (sin conexión o el sistema caído), la app muestra "Probar de nuevo" en lugar de quedar en blanco.

### D-041 · 19/11/2026 · Ezequiel (chat de desarrollo) · Conversaciones también recibe el mail
- **Definición**: la bandeja **Ventas → Conversaciones** del ERP junta **la app y el mail**. Los clientes siguen mandando archivos y pedidos por mail a las casillas de cada sector, como hoy, y eso tiene que aparecer en la misma bandeja que los mensajes de la app, en el hilo del mismo cliente.
- **Por qué**: "no solo va por la app". Hoy la mayoría de los trabajos entra por mail (actualización §2.2), y el cliente no va a cambiar de canal de un día para el otro. Si el asesor tiene que mirar dos lugares, el sistema no le resuelve nada.
- **Impacto**:
  - **Ya está hecho**: la ingesta por IMAP (D-027) crea la orden desde el mail del sector y reconoce al cliente por cualquiera de sus emails (D-038).
  - **Falta (E2)**: mostrar cada mail como un mensaje en el hilo del cliente, con el adjunto y la orden que creó, y que el asesor pueda **responder desde la bandeja**. La respuesta sale por SMTP desde la casilla del sector y vuelve al mismo hilo (Reply-To del sector, actualización §2.2).
  - **Canal por mensaje**: cada mensaje lleva su canal ("App" o "Mail"), igual que la etiqueta "Canal" que ya muestra la app en cada pedido.
  - **Hacen falta los accesos de las casillas de Hostinger** (§5): sin ellos no se lee el mail real.

### D-042 · 19/11/2026 · Ezequiel + desarrollo · propuesta: que el estado que ve el cliente sea el real (amplía I-17)
- **Problema** (Ezequiel): el cliente ve el estado de su pedido en la app, pero ese estado solo es real si el trabajo pasa por el sistema. Si el operador abre el mail, imprime y no toca el tablero, la app muestra "Archivo recibido" con el trabajo ya impreso. Para cerrar la E1 esto tiene que estar resuelto.
- **Propuesta** (pendiente de confirmar con Verónica y Ricardo; no se implementa hasta su OK):
  1. **Los pasos automáticos los marca el sistema**:
     - "Archivo recibido": al entrar el mail o el envío por la app.
     - "Cotizado": cuando atención carga precio y medida, que igual tiene que hacer para pasárselo al cliente.
     - "Seña recibida": cuando se registra el pago.
  2. **El archivo para imprimir sale solo de la tarjeta** (I-17):
     - El operador no abre el programa de mail ni el webmail: el mail se lee dentro del ERP (Conversaciones, D-041) y el adjunto ya está en la tarjeta. *(Ajustado: no es "dejar de usar el mail", es usarlo desde el ERP.)*
     - El botón "Descargar para imprimir" aparece recién cuando la orden se puede imprimir.
     - Descargarlo la pasa a "En impresión" sola. El cliente no ve ese estado: para él sigue en "Cotizado" o "Seña recibida".
  3. ~~Una a la vez por máquina~~ **Descartado por Ezequiel (19/11): retrasa la producción.** En su lugar:
     - El operador puede bajar varios archivos para imprimir en tanda.
     - Marca "Impreso" de a varios: selecciona las tarjetas y da un solo toque.
     - Si una orden queda "En impresión" más de X horas, se marca en rojo y le aparece al dueño.
  4. **"Entregado" en el mostrador**: se marca al entregar, buscando por número de pedido o de cliente. En la E3 sale solo al cobrar en el POS.
  5. **Control**:
     - El tablero marca en rojo los trabajos que no se movieron en más de X horas (hoy 2 h, D-030).
     - El dueño ve qué trabajos quedaron trabados y en qué paso.
     - Además, si un cliente ve un estado viejo, escribe, y eso deja a la vista quién no movió la tarjeta.
  6. ~~Piloto solo con DTF~~ **Descartado por Ezequiel (19/11)**: Via Vinilo necesita todos los sectores, y la E1 se entrega y se cobra completa. Arrancan todos los sectores juntos.
- **Por qué**: si mover la tarjeta es un paso aparte, se olvida. Si es la única forma de conseguir el archivo y de pasar al trabajo siguiente, se hace solo. Así se cumple "los pasos de producción son obligatorios" (CLAUDE.md) sin agregar clics: el operador hace lo mismo que hoy (bajar el archivo, imprimir, avisar que terminó), pero desde el tablero.
- **Puntos a confirmar** (I-17):
  - ~~¿Los operadores pueden dejar de entrar a las casillas de mail?~~ Resuelto: el mail se usa desde el ERP (D-041).
  - ¿Hay una PC o tablet por sector?
  - ¿Cuántos trabajos por máquina se imprimen a la vez (tandas)? Define el X de las alertas.
  - ¿Quién marca "Entregado"?
  - Necesita el estado interno `PRINTING` ("En impresión"), que el cliente no ve. Cambia D-013 y la actualización §2.4, que sacaron "Imprimiendo" de lo que ve el cliente.

### D-043 · 19/11/2026 · Ezequiel + desarrollo · casillas reales de Hostinger y lectura por la API de mail
- **Qué se encontró** (con el MCP de Hostinger, solo lectura, 19/11):
  - El correo está en **`viavinilo.com`**, no en `viavinilo.tech`. Es un plan Premium Business Email de 15 casillas, vigente hasta el 07/08/2027.
  - **Casillas**: `dtf@`, `dtfuv@`, `granformato@`, `latex@`, `calandra@`, `sublimacion@`, `cortes@`, `tpu@`, `ventas@`, `soporte@`, `tienda@`, `publi@`, `admin@` y `rick@`.
  - **`dtf@viavinilo.com` tiene el envío bloqueado por Hostinger por "sending_spam"**: puede recibir pero no mandar. Es probablemente la causa de los mails que no llegan y de las respuestas que rebotan (actualización §2.2). Ver I-22.
  - Las casillas de sector tienen una respuesta automática configurada.
- **Correcciones**:
  - La casilla de Calandrado es `calandra@`, no `calandrado@` (`SECTOR_INBOX_LOCAL_PART`).
  - En producción, `SEED_MAIL_DOMAIN=viavinilo.com`.
- **Propuesta para leer y responder el mail**: Hostinger tiene una **API de mail con tokens**, que dan acceso a las casillas elegidas (leer, buscar y enviar) **sin las contraseñas de las casillas**.
  - Así no hay que pedirles las contraseñas ni cambiarlas, y los empleados siguen como hoy.
  - Se crea un token solo para las 6 casillas de sector y se guarda en el `.env` del VPS.
  - El worker suma una fuente `hostinger-api` además de `imap`.
  - ~~Crear el token necesita el OK explícito de Ezequiel~~ **Hecho el 19/11 con su OK**:
    - Token "Via Vinilo ERP - casillas de sector (APOC)", limitado a `dtf@`, `dtfuv@`, `granformato@`, `latex@`, `calandra@` y `sublimacion@`.
    - Está guardado solo en el `.env` del VPS (`HOSTINGER_MAIL_API_TOKEN`). Se revoca desde Hostinger.
    - **Probado** desde el VPS: ve las 6 casillas y lista la bandeja sin abrir ni marcar mails (unos 400 mails entre las 6).
  - **Cómo usarla** (documentación de la API de mail, `https://api.mail.hostinger.com/api/v1`, con Bearer token):
    - Se lee con `/source` (MIME completo), que no marca el mail como leído.
    - Para no repetir, se guarda el último `uid` de cada casilla. La deduplicación por Message-ID sigue igual.
    - Para responder se usa `POST /mailboxes/{id}/send` con `inReplyTo` = el `uid` del mail original, así queda en el mismo hilo.
    - Para recibir al instante hay webhooks `message.received`. Al principio alcanza con revisar cada minuto.
  - **Fuente `hostinger-api` implementada (20/11)**:
    - Se presenta como una casilla IMAP y reusa `pollImapSector`: arranca desde "ahora" sin importar el historial, avanza el último UID y deduplica por Message-ID.
    - La API no expone el UIDVALIDITY; se usa un valor fijo.
    - Se activa con `MAIL_SOURCE=hostinger-api`. El token es obligatorio.
  - **Prueba en seco contra las casillas reales (20/11)**, con una imagen aparte y sin tocar la base:
    - leyó los últimos mails de las 6 casillas y los mails siguieron sin leer;
    - aparecieron dos cosas para revisar antes de prenderla:
      - En `dtf@` llegan rebotes "Sin entregar: …": confirma I-22, DTF no puede enviar. La ingesta los descarta como respuesta automática.
      - **Varios pedidos reales vienen sin adjunto** (por ejemplo "IMPRESION Y CALANDRADO - …", "impresion …"). Si tampoco traen un link de WeTransfer o Drive, con la regla de I-15 no crean orden y quedan en el log como "sin archivo". Hay que confirmar con Verónica si esos pedidos mandan el archivo después, en otro mail, o por otra vía. **Resuelto en D-045**: el mail sin adjunto va a Conversaciones y no se pierde.
- **Por qué**: Ezequiel señaló que el MCP de Hostinger ya está conectado. Con la API no hace falta pedir contraseñas, que es lo que trababa la ingesta real desde D-027.

### D-044 · 19/11/2026 · Ezequiel · la E1 se entrega completa para cobrarla
- **Definición**: no hay piloto por sector. La E1 se entrega completa, en todos los sectores, para cobrarla (contrato, Anexo I).
- **Estado de la E1** (19/11), punto por punto del §2.2:
  - **Hecho**:
    - Clientes con alta en el ERP, número, DNI, notas y ficha completa (D-038).
    - Login del personal con roles.
    - Acceso a la app (D-039).
    - Altas pendientes desde el mail (D-014).
    - Tablero por sector con pasos obligatorios y cotización y seña antes de imprimir (D-030).
    - Ingesta de mail con control de duplicados, probada con una casilla simulada (D-027).
  - **Falta, en este orden**:
    1. **Mail real en el ERP**: fuente `hostinger-api` en el worker (el token ya está), casillas `@viavinilo.com`, y bandeja de mails en Conversaciones con respuestas (D-041, D-043). Sin esto no entra ningún trabajo real ni el equipo se puede mudar.
    2. **Ficha de la orden**: editar medida, precio y descripción (paso 5); motivos de error y reenvío de archivo.
    3. **Estado real** (D-042): el archivo solo sale de la tarjeta, "Impreso" de a varios y alertas.
    4. **App con pedidos reales** (paso 6): estado, medida, precio y hora estimada; push, y el email como respaldo.
    5. **Alta manual desde el mostrador.**
    6. **Revisión del archivo con IA** (I-09): chequeos sin IA más un LLM solo para leer las medidas del mail.
    7. **Panel de tiempos** con datos reales; hoy es una vista previa.
    8. **Borrado automático de archivos** a los 30 días de entregada la orden (D-015).
    9. **Migración de clientes** de Runamatic y Tango: depende de que el cliente pase los datos (§5).
  - **La bandeja de mails entra en la E1** (Ezequiel, 19/11): "no podemos hacerlos mudar sin tener algo primero". Si los pedidos entran por mail y el mail no está en el ERP, el equipo seguiría trabajando desde la casilla y el sistema quedaría como una carga manual de más. Por eso el paso 1 incluye:
    - ver en Ventas → Conversaciones los mails de cada casilla, en el hilo de cada cliente, con su adjunto y la orden que creó;
    - responder desde ahí.

    El chat de la app con el asistente y la derivación a un asesor siguen en la E2 (contrato).
    Esto se encuadra en la E1 como parte de "Ingreso de trabajos por IMAP desde las casillas de Hostinger" (Anexo I); el Anexo I permite ajustar funcionalidades dentro de cada módulo sin cambiar el alcance (cláusula 2.2).
- **Por qué**: Ezequiel necesita cobrar la E1 completa. Ordenar lo que falta deja claro qué se entrega y qué depende del cliente.

### D-045 · 20/11/2026 · Ezequiel (chat de desarrollo) · todos los canales llegan igual; ERP sin datos de prueba; app instalable
- **Definición**:
  - **Tres canales de entrada, un solo camino** (amplía D-041). Todo cae en **Ventas → Conversaciones**, en el hilo del cliente, o directo en **Pedidos**:
    - **Chat de la app**: una pestaña **"Chat"** directa en la barra de la app, no adentro de Ayuda (Ezequiel: "que sea Chatear o algo así directamente"). Ahí el cliente pregunta o pide un trabajo.
    - **"+" Enviar de la app**: crea el pedido con archivo, sector y medida, y queda registrado en el hilo.
    - **Mail a la casilla del sector**: si trae archivo o link, crea el pedido; **si no trae, igual queda en Conversaciones**, y el asesor responde o arma el pedido desde ahí.
  - **ERP sin datos de prueba**:
    - **Inicio** muestra los datos reales de los tableros: pedidos de hoy, en producción, listos, demorados y producción por sector.
    - **Conversaciones** y **Panel de tiempos** quedan vacíos hasta tener datos reales.
    - Se sacan las marcas "Vista previa" de las pantallas que ya son reales: Inicio, Clientes, Conversaciones y Panel de tiempos.
  - **Instalar la app**: el cartel aparece solo, y "Ahora no" lo esconde por 7 días. Además hay un botón "Instalar la app" en Mi cuenta. En iPhone se explica cómo hacerlo con Compartir → "Agregar a inicio".
- **Por qué**:
  - Lo que manda el cliente no se tiene que perder por el canal que eligió.
  - Resuelve lo que quedó abierto en D-043: un pedido por mail sin adjunto ya no se descarta, va a Conversaciones. Esto deja sin efecto la parte de I-15 que lo dejaba solo en el log.
  - Un chat directo es lo que el cliente busca primero; escondido en Ayuda no lo encuentra.
- **Impacto técnico**:
  - Un service worker mínimo (`apps/pwa/public/sw.js`) que no guarda nada en caché, así los estados siempre son los reales. Lo pide el navegador para ofrecer la instalación. El push se suma ahí en el paso 6.
  - El manifest suma `id`, `scope` e ícono `maskable`.
  - **No prender la lectura de mails en producción** (`MAIL_SOURCE=hostinger-api`) hasta tener la bandeja de Conversaciones. Hoy la ingesta deja el mail sin adjunto solo en el log (`SKIPPED_NO_FILES`, I-15), así que esos pedidos no se verían en ningún lado del ERP. Al construir Conversaciones, la ingesta tiene que guardar todo mail de un cliente como mensaje de su hilo, cree o no la orden.
  - **Pendiente**:
    - el modelo de conversaciones y mensajes (I-18);
    - la lectura de mails en la bandeja (D-043, PR de la fuente `hostinger-api`);
    - el chat de la app.

    El chat de la app adelanta parte de la E2: según el contrato, el asistente IA sigue siendo de la E2. En la E1 el chat lo contesta un asesor.

### D-046 · 20/11/2026 · Ezequiel (mensaje del cliente) + Runamatic · sectores reales y sus sub-servicios (resuelve I-21, actualiza I-10)
- **Definición** (mensaje del cliente, confirmado por los agentes de Runamatic, `docs/referencias/runamatic-agentes.md`):
  - **Calandra** y **Sublimación**: son sectores distintos aunque parecidos. Calandra calandra las telas; Sublimación imprime solo el papel para los que estampan.
  - **Gran Formato**, con sub-servicios: Ecosolvente, Látex, UV (rígidos y rollo a rollo) y **Corte**. Ricardo va a ir sumando.
  - **DTF**, con varias máquinas: **DTF Textil** y **DTF UV**.
  - **TPU** y **Embroidery** (bordado). Embroidery vale lo mismo que TPU.
- **Casillas**: `cortes@` es el Corte de Gran Formato y `tpu@` es TPU. **Resuelve I-21.**
- **Proceso normal**: el cliente manda un mail con el archivo, y el asesor le explica los requisitos (por ejemplo DTF: PNG con fondo transparente a 300 dpi).
- **Impacto**:
  - Hoy el sistema tiene 6 sectores (DTF, DTF UV, Gran Formato, Látex, Calandrado y Sublimación). Hay que agregar los **sub-servicios** de Gran Formato y los sectores **TPU** y **Embroidery** al modelo, y decidir si Látex sigue siendo un sector o pasa a ser un sub-servicio de Gran Formato (en Runamatic es un sub-servicio pero tiene su propia casilla).
  - Se hace en la parte productiva (D-044, puntos 2 y 3). `TODO(spec): I-10`: nombres reales de las máquinas.
  - **Hay diferencias en la seña entre los agentes de Runamatic**: 50% siempre, o según los metros (desde 10 m en DTF Textil, Sublimación y Calandra; desde 3 m en DTF UV; siempre en TPU). Confirmar con Verónica antes de tocar D-013.
  - **WhatsApp de la empresa**: hay uno por sector (Calandra y Sublimación, Gran Formato y Corte, DTF y TPU) más uno de insumos. Resuelve el pendiente de D-038 y D-039: el link de "Escribinos por WhatsApp" puede ir al sector que corresponda.

### D-047 · 20/11/2026 · Ezequiel + desarrollo · control automático de la resolución del archivo (avanza I-09)
- **Problema** (mensaje del cliente): "a veces lo mandan con 300 dpi pero la imagen está más chica de lo normal y se ve pixelada". El dato de dpi del archivo no alcanza: una imagen chica a la que le cambiaron el dpi sigue teniendo pocos píxeles.
- **Definición** (Ezequiel: "si lo podemos detectar con código, genial"):
  - **Resolución efectiva**, sin IA: es la cantidad de píxeles dividida por la medida pedida en pulgadas. Ejemplo: un PNG de 1500 px de ancho para 58 cm (22,8") da 66 dpi efectivos, aunque el archivo diga 300. Si da menos que el mínimo del servicio (250 en DTF, 100 en Sublimación, Calandra y Gran Formato), se sugiere "Archivo con error" con el motivo y el operador confirma (E1.3). Necesita la medida pedida (paso 2, ficha de la orden).
  - **Imagen agrandada** (heurística): si la imagen se ve borrosa o en bloques (poca nitidez, o bordes repetidos de a 2 o 4 píxeles), se avisa como sospecha. Nunca se rechaza sola.
  - **Otros chequeos de los requisitos**:
    - PNG con fondo transparente para DTF (canal alfa con transparencia real);
    - modo RGB;
    - escala 1:1 (las proporciones coinciden con la medida pedida);
    - Corte no acepta PNG;
    - Sublimación y Calandra no van en espejo. Esto último no se puede saber del archivo: se avisa.
- **Por qué**: es la queja concreta del cliente y se resuelve con cálculo, sin costo de IA. La IA queda solo para leer las medidas del texto del mail (I-09).

### D-048 · 20/11/2026 · Desarrollo · migración de clientes desde Runamatic (CSV) y lo que se pudo ver
- **CSV de clientes** (`clientes-2026-11-20.csv`, exportado de Runamatic, **no se sube al repo**; `.gitignore` ignora `/*.csv` y `/*.xlsx`):
  - 1790 contactos.
  - **Teléfono en 1772** (formato WhatsApp `549…`), **email en solo 380**, **DNI en solo 9**, CUIT, condición frente al IVA y domicilio en unos 127.
  - Solo **176 tienen la etiqueta "Cliente Registrado"**. El resto son chats de WhatsApp (1553), carga manual (211) y Telegram (24); muchos son consultas, no clientes.
  - La condición frente al IVA está escrita a mano ("Consumidor final", "consumidor final", "Monotributista"…) y hay que normalizarla.
- **Choca con las reglas de alta** (D-025: DNI, email y teléfono obligatorios) y con el ingreso a la app, que necesita email (D-039). Ver I-23.
- **Runamatic** (Tienda Runa, sobre Supabase):
  - se leyeron los 6 agentes de IA (`docs/referencias/runamatic-agentes.md`);
  - **no se exportaron las conversaciones**: Tienda Runa no muestra una exportación de chats; abrir cada chat lo marca como leído para el equipo; y leer la base directo con la sesión de Ezequiel quedó bloqueado por seguridad (es usar su credencial).
  - Alternativas: pedirle a Tienda Runa una exportación de los chats, o que Ezequiel autorice explícitamente la lectura directa.

### D-049 · 20/11/2026 · Ezequiel · activación de cuentas por link, invitaciones desde el ERP, ingreso con teléfono e importación de todos los contactos (resuelve I-23, cambia D-039)
- **Definición**:
  - **Activación por link**: Via Vinilo difunde un solo link (`viavinilo.tech/activar`). El cliente pone su email, le llega un mail con un link, y con ese link **crea su propia contraseña**. El asesor ya no tiene que mandar una clave a cada uno.
  - **Botón en el ERP** (Ventas → Clientes) para **invitar a la app** a un cliente o a muchos de una vez, como tarea automatizable. A cada uno le llega el mail con su link para crear la contraseña.
  - **Ingreso con email o teléfono**: el cliente entra con cualquiera de sus emails **o con su celular**, más su contraseña.
  - **Importación de los 1790 contactos** del CSV de Runamatic, todos como clientes activos. A los que no tienen email se los marca **"falta email"**: cuando el asesor se lo carga, entran en la automatización de invitaciones. Los que no tienen DNI quedan con "datos a completar".
- **Por qué**: "agilizarles el trabajo de no tener que mandar la clave a cada uno" (Ezequiel). El teléfono es el dato que tienen casi todos (1772 de 1790); el email solo 380.
- **Cambia**:
  - D-039, que solo tenía la contraseña cargada por el asesor. Se mantiene como alternativa desde la ficha.
  - D-025, que pedía DNI y email obligatorios para estar activo. Para los importados no se exigen: se completan después.
  - **Resuelve I-23.**
- **Impacto técnico**:
  - **Envío de mails en cola** (`OutboundEmail`):
    - la API anota el mail y el worker lo manda **despacio**, para no quedar bloqueados por spam como `dtf@` (I-22);
    - después de enviarlo se borra el link del texto guardado.
    - El envío usa la API de mail de Hostinger desde una casilla que pueda enviar (`MAIL_SENDER_ADDRESS`). **Hecho el 20/11**:
      - sale desde **`soporte@viavinilo.com`** (lo eligió Ezequiel);
      - se creó un token nuevo con las 6 casillas de sector más `soporte@`, y se revocó el anterior;
      - envío real probado: invitación al cliente N.º 1, enviada, con el link borrado de lo guardado.
  - **Importación hecha en producción (20/11)**: 1789 clientes de Runamatic (más el N.º 1 que ya estaba), 374 con email y 1769 con celular. Primero se hizo una prueba en seco. El CSV se borró del servidor al terminar.
  - **Links de activación** (`AppActivation`):
    - duran 48 h y se usan una sola vez;
    - se guarda solo el hash;
    - pedir uno nuevo anula el anterior;
    - el pedido público siempre responde lo mismo, exista o no el email.
  - **Rutas**:
    - `POST /app/auth/activation/request`, `POST /app/auth/activation/complete`;
    - `POST /customers/invite` (uno, varios o todos los que tienen email y no tienen contraseña);
    - `POST /app/auth/login` acepta email o teléfono.
  - **Importación**: script `apps/api/prisma/import-runamatic.ts`, con prueba en seco. El CSV nunca va al repo. Se normalizan:
    - nombre (se separa en nombre y apellido);
    - teléfono;
    - email;
    - CUIT (con dígito verificador);
    - condición frente al IVA (los textos escritos a mano);
    - domicilio.

    El origen y las etiquetas van a las notas internas. Los emails y teléfonos repetidos se informan y no se duplican.

### D-050 · 20/11/2026 · Verónica + Ezequiel (WhatsApp) · proceso de pedidos: el sistema se adapta a Via Vinilo, no al revés
- **Lo que contó Verónica**:
  - En casi todos los sectores el proceso es el mismo: el cliente manda el archivo por mail y recibe un aviso automático de "recibimos tu mail". Ese aviso no dice que el archivo esté bien para imprimir.
  - Como Hostinger falla y a veces no llega el mail o el aviso, tuvieron que pedirles a los clientes que además manden un WhatsApp ("envié mis archivos", nombre, apellido y mail) como acuse de recibo.
  - Verónica quiere un manual de procesos **más simple** y que el sistema se adapte a su forma de trabajar.
- **Lo que definió Ezequiel** (respuesta a Verónica):
  - **Tres formas de pedir**: mail, envío desde la app y pedido o chat en la app (D-045). Todo llega igual.
  - **Verificación automática del archivo** (píxeles y formato, D-047). Si no cumple, la orden pasa sola a **"Archivo con error"** y se le pide al cliente que lo vuelva a cargar con las especificaciones.
  - **Tableros por sector**, como los de Runamatic hoy, pero **automatizados**.
  - **Cotización desde Conversaciones**: cuando el asesor le pasa el precio al cliente en la bandeja, la orden pasa sola a **"Cotizado"** con ese monto.
  - **Seña**: cuando el cliente manda el comprobante, la orden pasa a **"Seña recibida"**.
  - **Los empleados solo hacen 3 movimientos**: "Impreso", "Listo para retirar" y "Entregado". El resto es automático.
  - **Tableros**: Calandra, DTF, DTF UV, Gran Formato, Látex y Sublimación (cada uno ve solo lo suyo). Se pueden cambiar a gusto; se ve en detalle el lunes 23/11.
- **Por qué**: hoy la gente trabaja alrededor de las fallas del sistema (el WhatsApp extra como acuse). El sistema tiene que dar el acuse solo y mover lo que se puede mover solo.
- **Impacto y puntos a confirmar**:
  - **Acuse de recibo automático**: cuando entra un trabajo, sea por mail o por app, el cliente recibe en la app (push) y por mail "Recibimos tu archivo · pedido VV-…". El estado se ve en la app, así que **no hace falta el WhatsApp de aviso**. Necesita la casilla de envío (D-049) y el push (paso 6).
  - **Choca con el contrato y D-047**: el contrato dice que la IA *sugiere* "Archivo con error" y **el operador confirma** (E1.3). Ahora Ezequiel define que pase **sola**. Ver I-24.
  - **Seña "automática"**: hay que definir cómo se reconoce el comprobante. Opciones: el asesor toca "Seña recibida" al ver el comprobante en la conversación (un clic), o lectura automática del comprobante (monto y CBU o alias). Ver I-25.
  - **Tableros**: la lista de Ezequiel no incluye **TPU** ni **Embroidery** (D-046), ni dice dónde va **Corte** (sub-servicio de Gran Formato con casilla propia). Ver I-26.
  - **"Impreso" de a varios y archivo desde la tarjeta** (D-042) siguen igual.

### D-051 · 20/11/2026 · Desarrollo · Conversaciones: mails y chat de la app en un hilo por cliente (implementa D-041 y D-045)
- **Qué se hizo**:
  - **Un hilo por cliente** (`Conversation`, `Message`). Si el remitente de un mail todavía no es cliente, el hilo queda por su email; cuando se lo da de alta (o manda un trabajo y queda con alta pendiente), ese hilo pasa a ser el del cliente.
  - **Todo mail a una casilla de sector queda en el hilo**, con o sin adjunto, cree o no una orden, y aunque el cliente esté bloqueado. Se guardan el asunto, el texto, los adjuntos, el pedido que creó y el UID para responder. Un mail leído dos veces no se repite.
  - **El asesor responde desde Ventas → Conversaciones**:
    - **por la app**: el cliente lo ve en la pestaña Chat;
    - **por mail**: sale **desde la casilla del sector** del último mail del cliente, a la dirección desde la que escribió, como "Re: …" y **en el mismo hilo** de su mail. Si nunca escribió por mail, sale desde `soporte@`.
    - Los mails salen por la cola del worker (D-049).
  - **Pestaña "Chat" en la app** (reemplaza "Ayuda" en la barra; Ayuda queda en el "?" del chat):
    - el cliente escribe y ve sus mails y las respuestas en el mismo hilo;
    - las respuestas aparecen firmadas "Via Vinilo", nunca con el nombre del empleado;
    - un punto rojo avisa si hay respuestas sin leer;
    - "Consultar por este pedido" abre el chat con el número de pedido.
  - **Bandeja del ERP**:
    - filtros Todas / Sin leer / App / Mail, y búsqueda por nombre, N.º o email;
    - etiqueta del canal del último mensaje, y avisos "No es cliente" y "Alta pendiente";
    - panel con la ficha del cliente y sus últimos pedidos;
    - se refresca cada 10 s.
  - **Permisos**: la bandeja la ven atención y el dueño; producción no.
  - **Se borró la pantalla de muestra del asistente** (`/ayuda/asistente`), que tenía datos inventados.
- **Por qué**: D-041 y D-045 (el equipo no se muda si el mail no está en el ERP, y ningún pedido se pierde por el canal que eligió el cliente) y D-050 (el sistema se adapta a cómo trabaja Via Vinilo).
- **Pendientes**:
  - **Prender la lectura de mails en producción** (`MAIL_SOURCE=hostinger-api`). Desde ese momento los mails nuevos de las 6 casillas entran a Conversaciones y crean pedidos. Lo decide Ezequiel.
  - Avisos push y "Recibimos tu archivo" automático (D-050), paso 6.
  - Cotizar desde la conversación y que pase solo a "Cotizado" (D-050).
  - El asistente IA sigue siendo de la E2 (contrato).
  - Hoy las respuestas de DTF salen desde `dtf@`, que tiene el envío bloqueado (I-22): hasta que Hostinger la desbloquee, esas respuestas van a fallar y quedan en la cola con el error.

### D-052 · 20/11/2026 · Ezequiel · lectura de mails prendida y Pedidos con datos reales
- **Definición**:
  - **Lectura de mails prendida en producción** (`MAIL_SOURCE=hostinger-api`) desde el 20/11, "para que entren datos". Lee las 6 casillas de sector cada minuto; arrancó desde ese momento, sin importar el historial.
    - **No sale ningún mail automático**: `SMTP_URL` está vacío, así que el mail a remitentes nuevos (D-038) se saltea.
    - **El bot sigue apagado**: todavía no existe, y cuando se haga arranca apagado en todos los chats.
    - Los mails no se marcan como leídos en Hostinger.
  - **Ventas → Pedidos con datos reales**: `GET /jobs`, con pestañas (En curso / Listos / Entregados / Todos), sector, canal y búsqueda por N.º, cliente o detalle. Producción ve solo sus sectores. Se borró la vista previa con pedidos inventados.
- **Por qué**: Ezequiel: "lo que es pedido limpialo, que no quede nada de esta información falsa en el sistema".
- **Pendiente**: las pantallas de Administración (comprobantes, cobranzas, compras, IVA, etc.) y Configuración siguen siendo vistas previas de la E3 con datos de ejemplo, marcadas "Vista previa · Etapa 3".

### D-053 · 20/11/2026 · Ezequiel · Ayuda de la app con contenido real y alta de cliente centrada
- **Definición**:
  - **App → Ayuda** deja de ser una vista previa ("Etapa 2" y links muertos). Muestra:
    - cómo preparar y mandar archivos, por servicio: casilla, formato, requisitos, avisos (espejo, formatos bajo responsabilidad) y los instructivos en imagen que ya usa Via Vinilo;
    - qué tiene que decir el mail y cómo nombrar el archivo;
    - precios, señas y pagos: no se publican precios (se piden por el chat o se cotizan con el archivo), las señas por servicio y los datos de Macro y Mercado Pago;
    - horarios de las dos sucursales, con el link al mapa;
    - 10 preguntas frecuentes reales, el link a la tienda de insumos y "Hablar con un asesor" (va al Chat).
  - El contenido está en un solo archivo (`apps/pwa/app/(app)/ayuda/content.ts`) para pasarlo a la base cuando el cliente lo edite desde el ERP (E2).
  - **ERP → Nuevo cliente**: la página angosta se centra en pantallas anchas (antes quedaba pegada a la izquierda con un hueco a la derecha) y los emails y teléfonos van lado a lado.
- **Fuente**: los prompts de los agentes de Runamatic (`docs/referencias/runamatic-agentes.md`), que es lo que hoy se les dice a los clientes. De la web solo se tomó la explicación de dpi y píxeles (por qué sale pixelado aunque diga 300 dpi). No se inventaron precios.
- **Por qué**: Ezequiel pidió armar la Ayuda "con la info de Runamatic y lo que sabés del negocio" antes del bot, que va a usar el mismo contenido.
- **Abierto**: la seña por servicio (I-27).

### D-054 · 20/11/2026 · Ezequiel · el alta pendiente no frena el pedido y se completa con los datos del mail
- **Definición**:
  - Cuando escribe alguien que no es cliente, el sistema crea el **alta pendiente de aprobación** con lo que escribió en el mail. Lee la ficha que suelen mandar ("Nombre o Número de Cliente", "Teléfono", "Lugar a retirar"):
    - nombre y apellido; si no hay ficha, usa el nombre del remitente cuando parece de una persona;
    - teléfono (si no lo tiene otro cliente);
    - el N.º de cliente que dice tener y la sucursal de retiro quedan en las notas internas.
    - Un alta pendiente sin nombre lo toma del próximo mail que lo traiga. Nunca se pisa lo que cargó un asesor.
  - **El alta pendiente es solo una formalidad**: el cliente hace todo el proceso. Sus pedidos entran a "Archivo recibido" y van al tablero, igual que los de un cliente aprobado. Cambia D-014, donde quedaban frenados en "Alta pendiente".
    - Al subir esto, una migración pasa al tablero los pedidos que ya estaban frenados.
    - Hay un script de una sola vez (`node dist/backfill-pending.js` en el worker) que completa las altas viejas con los mails ya guardados.
  - **ERP → ficha del cliente pendiente**:
    - un aviso explica qué verificar;
    - muestra los **clientes parecidos** (mismo teléfono, mismo nombre o el N.º que dijo tener), para no duplicar a los importados de Runamatic que escriben desde un email nuevo;
    - botones **Aprobar alta** (exige nombre, apellido, DNI, email y teléfono, como antes) y **Rechazar** (pide motivo, queda bloqueado y en auditoría; los pedidos ya mandados siguen en el tablero).
  - **Por ahora la lectura es por reglas, no con IA.** Cuando esté el bot, él completa lo que esta lectura no entienda.
- **Por qué**: Ezequiel: "un cliente pendiente de alta puede hacer todo el proceso, solo es una formalidad para que tengan que verificar los datos". Entró el primer pedido real de alguien sin alta (un cliente nuevo, DTF) y quedó como "Cliente N.º 1792" sin datos.

### D-055 · 20/11/2026 · Ezequiel · CUIT con guiones y montos con puntos, al escribir y al mostrar
- **Definición**: los campos se formatean mientras se escribe, y se ven igual en pantalla:
  - **CUIT**: `20-12345678-9`.
  - **DNI**: `30.111.222`.
  - **Montos en pesos**: puntos de miles y coma decimal (`18.500,50`). Un punto tipeado al final (teclado numérico) se toma como la coma. En pantalla siempre `$ 18.500,50`.
  - En la base no cambia nada: CUIT y DNI solo dígitos, montos `Decimal` con punto.
  - Las máscaras están en `@viavinilo/contracts` (`maskCuit`, `maskDni`, `maskAmount`, `parseAmount`).
  - La API acepta el precio escrito con puntos de miles. Antes "18.500,50" se rechazaba.
- **Por qué**: Ezequiel: "CUIT siempre va con los guiones, y los valores monetarios siempre con los puntos, tanto cuando se escriben como cuando se ven en pantalla".

### D-056 · 20/11/2026 · Ezequiel · bot del chat de la app, apagado por defecto
- **Definición**:
  - **Dónde responde**: solo en el **chat de la app**. Los mails los responde siempre una persona. Nunca escribe por WhatsApp (R-NOT-1).
  - **Arranca apagado.** Responde solo si se cumplen las tres cosas:
    - el **interruptor general** está prendido (Conversaciones, arriba; lo prende o apaga solo el dueño y queda en auditoría);
    - el bot está **prendido en ese chat** (botón en el encabezado del hilo; todos arrancan apagados);
    - hay **clave de IA** en el servidor (`OPENAI_API_KEY`). Si falta, el ERP lo avisa.
  - **Qué sabe**:
    - las reglas de los 6 agentes de Runamatic (tono, qué no puede prometer, cuándo derivar);
    - el mismo contenido de la Ayuda de la app, que ahora vive en `@viavinilo/contracts` (`help`) para que los dos digan lo mismo;
    - **los pedidos reales del cliente** (estado, precio si está cotizado, seña, fecha estimada). Esto es lo nuevo respecto de Runamatic, que no veía el sistema.
  - **Qué no hace**: dar precios, cancelar o cambiar pedidos, confirmar pagos, tomar reclamos, diseñar.
  - **Derivación**: en esos casos (o si el cliente pide una persona) responde que un asesor sigue por el mismo chat. El chat queda marcado **"Pide asesor"** (filtro nuevo en Conversaciones) y el bot se apaga en ese chat. Cuando responde una persona, la marca se va.
  - **Nunca pisa a una persona**: si alguien del equipo respondió después del mensaje, no responde. Si el cliente mandó varios mensajes seguidos, responde solo el último, leyendo el hilo completo.
  - Si la IA falla, no responde nada y el mensaje queda para el equipo.
  - Los mensajes del cliente siguen apareciendo sin leer para el equipo aunque el bot responda: mientras el bot es nuevo, nadie deja de verlos.
  - En el ERP las respuestas del bot dicen "Bot". En la app, "Asistente virtual de Via Vinilo".
  - **Técnica**:
    - el worker revisa cada 5 s los mensajes que esperan al bot;
    - el modelo es el de `BOT_MODEL` (por defecto `gpt-4.1-mini`);
    - con `BOT_API_URL` se puede usar otro proveedor compatible con OpenAI, por ejemplo un modelo local con Ollama cuando el VPS alcance (contrato: IA local con OpenAI de respaldo; ver I-20).
- **Por qué**: Ezequiel: "el bot obviamente apagado… dejalo apagado en todos los chats y sacá el prompt de Runamatic", y que pueda responder "según la info del sistema".
- **Pendiente**: que el bot complete datos del alta pendiente (D-054) y que responda mails; las dos cosas, solo si Ezequiel lo prioriza.

### D-057 · 20/11/2026 · Ezequiel · mails legibles, reenvíos del equipo y bot individual con IA local
- **Mails legibles en Conversaciones**: el texto se muestra tal cual, pero ordenado.
  - Los links (Drive, WeTransfer) van aparte, como botones con el nombre del archivo que escribió el cliente ("Carpinteria_A.jpg").
  - Lo citado de un mail anterior queda plegado, por ejemplo la respuesta automática de la casilla ("Ver la respuesta automática de Via Vinilo").
  - Se sacan los renglones vacíos de más. En la base el mail queda igual que llegó.
- **Reenvíos desde una casilla nuestra**:
  - Un "RV:" que el equipo reenvía desde `dtfuv@`, `calandra@`, etc. es del cliente del mail original ("De: Lucía Pérez <…>"): el pedido y el hilo van a ese cliente.
  - En el hilo se ve del lado del equipo como "Reenvío del equipo".
  - Si no se encuentra el remitente original, el mail queda en Conversaciones sin crear cliente ni pedido.
  - Antes se creaba un alta con el email de Via Vinilo (N.º 1806 con `dtfuv@`). El script `node dist/fix-forwards.js` lo corrige una vez.
- **El bot es individual**:
  - Se prende chat por chat con el botón del encabezado; no hay interruptor general.
  - Arriba se ve en cuántos chats está prendido, con un botón "Apagar en todos" (queda en auditoría).
  - Cambia D-056.
- **IA local con Ollama** (cambia D-056: OpenAI queda solo de respaldo):
  - corre en el mismo VPS, en un contenedor `ollama` sin puertos públicos, con 3 de los 4 núcleos y 8 GB como máximo;
  - modelo `qwen2.5:3b`, elegido midiendo en el VPS con el prompt real contra `gemma3:4b` y `llama3.2:3b`: respondió en 3 a 4 s y fue el único que derivó bien "quiero cancelar";
  - el worker precarga el modelo al arrancar.
- **Derivación fija, sin IA**: cancelar o cambiar un pedido, reclamos, precios, comprobantes y pedir una persona van siempre a un asesor (reglas de Runamatic). El modelo chico a veces no derivaba.
- **Paperclip**: no se usa en el camino del chat. En el proyecto de Trip se vio que no sostiene la latencia de un chat; ahí quedó para gobierno y auditoría de agentes. Si se quiere sumar para eso, es un paso aparte.
- **Por qué**: Ezequiel: "que los mensajes queden legibles… cargalo tal cual viene pero ordenado", "que sea individual", "el bot va en local… con Ollama".

### D-058 · 20/11/2026 · Ezequiel · ficha del cliente en Conversaciones, acciones masivas del bot e íconos
- **Ficha en Conversaciones**:
  - Se toca el nombre del cliente en el hilo (o "Ver y editar ficha") y se abre la ficha completa en un panel, sin salir del chat.
  - Es la misma ficha de Clientes (componente compartido `customer-record.tsx`). Al guardar, el chat y la lista se actualizan.
- **Alta pendiente editable sin DNI**: en un alta pendiente se puede corregir el nombre o los contactos sin tener todavía DNI ni apellido. Se exigen al aprobar (D-054). Antes el formulario no dejaba guardar.
- **Acciones masivas del bot**:
  - menú ☰ al lado del botón del bot del chat: "Prender el bot en todos los chats" y "Apagar el bot en todos los chats", con confirmación y auditoría;
  - "Prender en todos" se aplica solo a chats de clientes. Los que piden asesor siguen esperando a una persona.
- **Íconos de la pestaña**: la app de clientes usa el dibujito (la mascota con los rollos). El ERP usa la "V" del logo de Via Vinilo sobre un fondo claro, para que se vea en cualquier barra de pestañas.
- **Por qué**: Ezequiel: "que se pueda tocar el cliente y se abra acá la ficha para editar", "3 barritas… acciones masivas", y los logos.

### D-059 · 20/11/2026 · Ezequiel · lista de Conversaciones con la distribución de Runamatic
- **Definición**: la lista de Conversaciones toma la distribución de la bandeja que Via Vinilo usa hoy en Runamatic, con los colores de Via Vinilo.
  - Arriba: título con el total, los íconos de acción (filtro por canal y ayuda) y un buscador a lo ancho.
  - Tres pestañas iguales: Todas, Sin leer y Pide asesor. El canal (solo chat de la app o solo mails) va en el botón de filtros.
  - Filas más aireadas:
    - avatar grande con el canal del último mensaje en la esquina;
    - nombre y hora relativa ("hace 5 min") arriba;
    - vista previa abajo, con íconos de "bot prendido" y "pide asesor" y el contador de sin leer;
    - etiquetas (alta pendiente, no es cliente) solo cuando corresponden.
  - Se sacó el cartel "Bot apagado en todos los chats". Si el bot está prendido en algún chat, arriba aparece un ícono con la cantidad.
  - Al no tener un chat abierto, el aviso queda centrado.
- **Por qué**: Ezequiel: "me gusta mucho más como se ve en el soft que ya tienen, sin los colores; creo que está mejor distribuido el espacio", y "sacá este cartel".

### D-060 · 20/11/2026 · Ezequiel · el bot sigue el proceso del pedido; avisos de estado al cliente
- **Problema**: en la primera prueba real el bot:
  - saludaba en cada mensaje;
  - hablaba de "tú";
  - convirtió "5.10 × 1.10" en "51 × 110 cm";
  - prometió "te avisamos cuando esté listo" sin que hubiera pedido ni archivo.

  En otra prueba inventó "el archivo se ha recibido". El modelo local de 3B no alcanza para los pasos clave. El de 7B tampoco: en el VPS tardó de 8 a 16 s y también se equivocó en datos.
- **Definición**: el bot responde sin IA los pasos que no pueden fallar, y la IA queda para el resto.
  - **Flujos fijos**:
    - el saludo, una vez por conversación;
    - el trabajo nuevo: pide el archivo por mail a la casilla correcta según el material, sin decir que llegó ni cuándo está;
    - "¿está listo?": responde con los pedidos reales; sin pedidos, lo dice;
    - formato por servicio, sucursal y horario por servicio (DTF y DTF UV en San Juan; el resto en Av. Chile) y tiempos de entrega.
  - **El prompt de la IA**:
    - sabe el orden del pedido: archivo por mail → revisión → Cotizado → Seña recibida → Impreso → Terminado, listo para retirar;
    - repite las medidas tal cual;
    - sabe qué casilla corresponde a cada material;
    - no saluda si ya hubo respuesta en el hilo (memoria por conversación: lee los últimos 12 mensajes).
  - **Controles fijos sobre la respuesta de la IA**: pasa a "vos" las formas de "tú", corrige las casillas mal escritas ("látex@" → "latex@") y, con los avisos apagados, saca cualquier "te avisamos".
- **Avisos de estado al cliente** (arrancan apagados):
  - van por el chat de la app y por mail (desde soporte@, por la cola de mails), nunca por WhatsApp (R-NOT-1);
  - se mandan cuando el pedido pasa a **Archivo recibido**, **Archivo con error** (con el motivo), **Cotizado** (precio, la seña si corresponde y cómo pagarla según el sector) y **Terminado, listo para retirar** (sucursal y horario);
  - los prende solo el dueño, desde el menú ☰ de Conversaciones (queda en auditoría), y solo avisan los cambios desde ese momento;
  - si el cliente no quiere mails, solo le llega por el chat.
- **Pestaña "Enviar" de la app**: simulaba un envío ("¡Recibimos tu trabajo!") sin mandar nada. Ahora explica a qué casilla mandar el archivo según el servicio y abre el correo con la casilla y los datos del cliente ya cargados. Subir archivos desde la app sigue pendiente (I-19).
- **Por qué**: Ezequiel: "antes de avisarle si está listo hay que pedirle el archivo, verificarlo, la cotización, la seña si es necesaria y recién ahí se le avisa", "¿podemos automatizar eso por la app o por mail cuando pase a listo para retirar?".

### D-061 · 20/11/2026 · Ezequiel · comando /reset, avisos en el menú ☰ y prueba del bot con mensajes reales
- **Avisos en el menú ☰ de acciones masivas**: sección "Avisos automáticos a clientes", con el estado (prendidos o apagados) y "Prender" y "Apagar", igual que el bot. Todos ven el estado; los cambia solo el dueño, porque salen mails reales.
- **Comando `/reset`**: si un cliente manda `/reset` por el chat de la app o por mail (en la primera línea), se responde "Memoria borrada correctamente." y el bot deja de recordar todo lo anterior con ese cliente.
  - No se borra ningún mensaje: se guarda desde cuándo lee el bot (`Conversation.botResetAt`), y el equipo sigue viendo el hilo completo.
  - También saca la marca "Pide asesor". El bot sigue prendido o apagado en ese chat como estaba.
  - Por mail, la respuesta sale en el mismo hilo y no crea pedido (resultado `COMMAND` en el log de mails).
  - Sirve para probar el bot desde cero.
- **Prueba de punta a punta con mensajes reales**:
  - Se pasaron por el bot 24 mails reales de clientes y la conversación de prueba de Ezequiel, con el modelo del VPS. Se usó una imagen aparte, sin tocar producción ni la base, y los datos se borraron al terminar.
  - Se agregó `node dist/bot-dry-run.js` para repetir la prueba. Usa la misma decisión que el bot (`decideAnswer`).
  - **Primera pasada: 7 de 27 mal**:
    - "vinilo DTF textil" fue a Ecosolvente;
    - "lo retiro en la sucursal San Juan" respondió horarios;
    - "ahí va en png" respondió formatos;
    - "ENVIAR A LA SAN JUAN" y "urgente, para hoy" recibieron promesas de la IA;
    - con mensajes sin material, la IA mandaba todo a `dtf@`.
  - **Arreglos**:
    - primero cuenta el servicio que nombra el cliente y después el material;
    - horarios, formatos y tiempos se responden solo si es una pregunta;
    - "adjunto", "ahí va" o un nombre de archivo cuentan como trabajo nuevo;
    - urgencia o envío a otra sucursal van a un asesor (regla de Runamatic);
    - la IA no puede nombrar una casilla si el cliente no dijo el material.
  - **Segunda pasada: 27 de 27 con respuesta correcta**: 22 por flujos fijos, 2 derivadas a un asesor y el resto preguntando el material.
- **Por qué**: Ezequiel: "que los avisos se puedan prender y apagar del menú de acciones masivas", "/reset para testear más fácil" y "una prueba end to end con los mensajes de ejemplo de los clientes".

### D-062 · 21/11/2026 · Ezequiel · archivos en Conversaciones (cliente y asesor) y descarga para imprimir
- **Cliente (app → Chat)**:
  - con el clip 📎 elige el servicio, escribe medidas, cantidad y sucursal, y sube el archivo (hasta 150 MB, con barra de progreso);
  - se crea el pedido solo en el tablero de ese servicio, en **Archivo recibido**, igual que si lo hubiera mandado por mail (Ezequiel: "crear el pedido solo");
  - en el chat ve su archivo y lo puede descargar;
  - la pestaña "Enviar" ahora lleva a este camino. El mail sigue sirviendo.
- **Asesor (ERP → Conversaciones)**:
  - adjunta hasta 5 archivos al responder;
  - por la app, el cliente los descarga desde el chat;
  - por mail, salen como adjuntos (hasta 20 MB en total), desde la casilla del sector y en el mismo hilo. La API de Hostinger acepta adjuntos en base64;
  - descarga desde el hilo los archivos subidos por la app y los que mandó él.
- **Tablero → "Descargar archivo para imprimir"**:
  - antes era una vista previa que no descargaba nada; ahora baja los archivos del pedido;
  - la API lo libera con la misma regla que el tablero: cuando el pedido puede pasar a Impreso (cotizado y, si corresponde, con la seña: R-JOB-3) o si ya se imprimió.
- **Técnica**:
  - los archivos se guardan en el mismo volumen que los de los mails (`STORAGE_DIR`, `/app/storage`): los de la app en `app/<cliente>/…` y los del asesor en `conversations/<hilo>/…`;
  - solo formatos de impresión (PDF, PNG, JPG, TIF, AI, EPS, PSD, CDR, SVG, ZIP, RAR);
  - en los mensajes los adjuntos se guardan como `{ name, key, size, mime }`. Los mails viejos siguen con solo el nombre: su archivo está en el pedido;
  - la cola de mails (`OutboundEmail.attachments`) lee los archivos recién al enviar.
- **Pendiente**:
  - los adjuntos de los mails entrantes todavía no se descargan desde el hilo; se bajan desde el pedido, en el tablero;
  - I-19: límite de envíos por cliente y detección de archivos repetidos.
- **Por qué**: Ezequiel: "en ambos se tiene que poder cargar un archivo, tanto del lado del cliente en la app como en el ERP para responder".

### D-063 · 21/11/2026 · Ezequiel · borrado de archivos a 30 días (implementa D-015) y backup diario de la base
- **Borrado de archivos (D-015, ahora implementado)**:
  - todos los días a las 03:30 de Salta, el worker borra del disco los archivos de órdenes **entregadas hace más de 30 días**;
  - las órdenes sin entregar no se tocan;
  - el registro del archivo queda con la fecha de borrado (`JobFile.purgedAt`) y en la auditoría queda cuántos archivos se borraron por orden (`files_purged`);
  - si un archivo no se puede borrar, se reintenta al día siguiente;
  - no alcanza a los adjuntos que manda el asesor al responder (`conversations/…`): no pertenecen a una orden. Si hace falta, se define aparte.
- **Backup diario de la base**:
  - servicio `backup` en `docker-compose.prod.yml` con `deploy/backup.sh`: un `pg_dump` por día en el volumen `backups`, verificado antes de darlo por bueno, y se guardan los últimos 14 días;
  - para restaurar: `pg_restore --clean --if-exists -d viavinilo /backups/db-AAAA-MM-DD.dump`;
  - probado el 21/11: un dump de producción restaurado en una base descartable dio los mismos totales (1.899 clientes, 222 pedidos, 240 mensajes, 139 archivos).
- **Pendiente (importante)**: el backup queda **en el mismo disco del VPS**. Si se rompe el disco o se pierde el VPS, se pierde también el backup. Falta la copia fuera del VPS (base y archivos); hay que definir el destino. **Descartado el 24/11 (D-078): se acepta el riesgo.**
- **Por qué**: al revisar dónde se guardan los archivos, se vio que D-015 estaba decidido pero no programado (el disco crecería unos 120 GB por año) y que no había ningún backup.

### D-064 · 21/11/2026 · Ezequiel · tableros en un desplegable y creación de tableros desde el ERP
- **Menú Producción**: "Tableros por sector" es un desplegable (arranca cerrado, salvo que estés en un tablero). Se sacó el ítem "Tableros" que estaba repetido; en su lugar está "Administrar tableros".
- **Crear tableros** (Producción → Administrar tableros, solo el dueño):
  - nombre, casilla de mail opcional y si lleva el paso "En proceso de calandra";
  - nace con los pasos comunes: Archivo recibido → Cotizado → Seña recibida → Impreso → Terminado → Entregado;
  - se puede desactivar: sale del menú, pero sus pedidos quedan. No se borra;
  - queda en auditoría quién lo creó o lo cambió.
- **Lo que pasa solo con un tablero nuevo**:
  - aparece en el menú sin recargar;
  - si tiene casilla, los mails que lleguen ahí crean pedidos en ese tablero (la lectura ya recorría los tableros activos). El token de la API de mail de Hostinger tiene que tener acceso a esa casilla;
  - el bot lo conoce: si el cliente lo nombra ("necesito TPU"), lo manda a esa casilla o al clip del chat;
  - la app lo ofrece al mandar un archivo desde el chat.
- **Técnica**: el código del tablero pasó de enum a texto (`Sector.code`). La migración convierte la columna en el lugar. El diff automático proponía borrarla y crearla de nuevo, lo que perdía los códigos; se reescribió a mano, tiene un test de conservación y se probó sobre una copia de la base de producción (los 6 tableros conservaron código y pedidos).
- **Pendiente**: editar los pasos de un tablero desde la pantalla (hoy se elige entre la secuencia común y la de calandra), asignar usuarios de producción al tablero nuevo, y sumar los tableros nuevos a la página Ayuda de la app. Sigue abierto I-26 (qué tableros faltan: TPU, Embroidery, Corte): ahora se resuelve creándolos.
- **Por qué**: Ezequiel: "el tablero por sector tiene que ser un desplegable y está 2 veces", "que se puedan crear nuevos tableros y eso se agregue a la información del bot y a la automatización".

### D-065 · 21/11/2026 · Ezequiel · el pedido se mueve solo según el archivo: control automático y reenvío
- **Alcance** (Ezequiel: "que se mueva automáticamente según lo que se vaya conversando con el cliente; después sí o sí se toma manual para la cotización y toda la otra parte del proceso"): lo automático llega hasta que el archivo está bien. Cotizar, seña, Impreso, Listo y Entregado siguen manuales.
- **Control automático del archivo** (implementa D-047, sin IA):
  - el worker revisa cada pedido en "Archivo recibido" que todavía no se controló, llegue por mail o por la app;
  - lee los píxeles del PNG o JPG y los compara con la medida que escribió el cliente: resolución efectiva = píxeles ÷ medida en pulgadas;
  - mínimos de D-047: 250 dpi en DTF y DTF UV, 100 en el resto;
  - el resultado queda en el pedido (`JobOrder.fileCheck`) y se ve en la tarjeta del tablero: "Archivo con problema" (rojo), "Revisar el archivo" (amarillo) o "Archivo controlado" (verde), con el cálculo;
  - **no opina** si el archivo no es PNG o JPG, si el cliente no escribió la medida con unidad o si escribió varias.
- **Paso automático a "Archivo con error"** (avanza I-24):
  - solo cuando la resolución es **menos de la mitad** de la mínima; entre la mitad y el mínimo es una sugerencia y confirma el operador;
  - queda el motivo "Resolución baja" con el cálculo, sin usuario (lo hizo el sistema);
  - **arranca apagado**: lo prende el dueño en Producción → Administrar tableros, y vale para los archivos que lleguen desde ese momento. Queda en auditoría;
  - si los avisos al cliente están prendidos (D-060), el cliente recibe el motivo con el cálculo.
- **Reenvío**: si el cliente tiene **un solo** pedido en "Archivo con error" en ese tablero y manda un archivo nuevo (por mail o por el clip del chat), el archivo se suma a ese pedido, que vuelve solo a "Archivo recibido" y se controla de nuevo. No se crea otro pedido. Con dos o más pedidos en error no se adivina: entra como pedido nuevo.
- **Idempotencia**: un mail de reenvío leído dos veces no duplica el archivo (queda como `DUPLICATE`; el reenvío se registra como `RESENT`).
- **A confirmar** (`TODO(spec): I-24`): el límite de "la mitad del mínimo" para el paso automático lo propuso desarrollo.
- **Fix**: "Administrar tableros" leía el rol del usuario durante el primer dibujo y React tenía que redibujar la página (error de hidratación). Ahora lo lee después de montar.

### D-066 · 21/11/2026 · Ezequiel · respuestas del bot ordenadas y tablero compacto
- **Prueba de punta a punta del chat** (28 preguntas típicas contra el bot del servidor). Primera pasada, lo que estaba mal:
  - la dirección y los horarios salían como un bloque de texto con un link larguísimo;
  - a "gracias" y a "ok" respondía preguntando el material;
  - a "¿hacen envíos?" la IA inventó "Sí, hacemos envíos";
  - pedir el alias para transferir derivaba a un asesor en vez de dar los datos;
  - "¿tienen WhatsApp?", "¿hacen diseños?" y "¿dónde retiro lo de DTF?" los contestaba la IA, mal o de forma rara.
- **Definición**: todo lo que se puede contestar con datos del sistema se contesta sin IA. Flujos nuevos:
  - dirección y horarios por sucursal, en bloques cortos; con el servicio, solo su sucursal; "¿abren los sábados?" y "¿hasta qué hora hoy?" responden eso;
  - datos de pago por servicio (Macro o Mercado Pago) y cuándo se pide seña;
  - cierre ("gracias", "ok"), servicios que se hacen (con los tableros nuevos), espejo, diseño, insumos, retiro por cadete, envíos (se retira en sucursal; si necesita envío, asesor) y contacto (se atiende por el chat).
  - Segunda pasada: las 28 bien; ninguna pasa por la IA salvo las derivaciones fijas.
- **Otros arreglos**:
  - pedir el alias ya no cuenta como "mandó un comprobante";
  - al cortar una respuesta en oraciones, el punto de un mail ("dtf@viavinilo.com") ya no corta la oración;
  - en la app, los links de los mensajes se pueden tocar; el mapa de la Sucursal Centro usa un link corto.
- **Tablero compacto**: cada tarjeta ocupa 3 renglones (número y tiempo, cliente con importe y seña, detalle) y el botón del paso siguiente; se abre con un clic para ver todo. Cada columna tiene su propio scroll. El tilde "Vista compacta" se recuerda en el navegador.
- **Por qué**: Ezequiel: "cuando salen muchos pedidos no se agrupa… que no sea tan largo el scroll para abajo" y "hacé una prueba end to end del bot porque mirá estas conversaciones".

### D-067 · 21/11/2026 · Ezequiel · campanita con avisos reales y Configuración (usuarios, roles, tableros)
- **Campanita**: deja de ser un adorno. Muestra lo que hay pendiente, calculado al momento (no hay una bandeja guardada): chats que piden un asesor, chats sin atención hace mucho, chats con mensajes nuevos, pedidos con archivo con problema, pedidos sin cotizar y altas pendientes sin aprobar. Lo urgente va primero; cada aviso lleva a su pantalla. El punto rojo aparece solo si hay algo. Se actualiza cada 30 segundos.
  - Atención y el dueño ven todo; Producción ve solo los avisos de pedidos de sus tableros.
  - **Tiempos configurables** (Configuración → Avisos, solo el dueño): chat sin atención después de 30 minutos, pedido sin cotizar después de 4 horas, alta pendiente después de 24 horas. Son valores iniciales nuestros: TODO(spec) confirmarlos con Verónica.
  - No manda nada al cliente ni al equipo por fuera del ERP (R-NOT-1 no se toca).
- **Configuración** (rueda, solo el dueño) reemplaza la vista previa con datos de ejemplo:
  - **Usuarios y roles**: crear, editar, desactivar y cambiar la contraseña. A cada usuario se le asigna el rol (Dueño, Atención, Producción) y, si es de Producción, los tableros que ve. Lo que puede hacer cada rol se muestra en la misma pantalla.
  - **Permisos**: se asignan por rol y por tablero. La matriz de permisos a medida (tildar permiso por permiso) sigue siendo de la E3 (D-017); no se adelanta.
  - **Tableros y máquinas**: alta y baja de máquinas por tablero; los tableros se siguen administrando en su pantalla (D-064).
  - **Motivos de error**: alta y baja de los motivos de "Archivo con error" que lee el cliente.
  - **Datos fiscales y Certificados ARCA**: quedan vacíos con el cartel "Etapa 3"; sin datos inventados.
- **Seguridad**: contraseña del personal de 10 caracteres como mínimo; la define el dueño y se la pasa en persona (no se manda por mail ni se vuelve a mostrar). Nunca queda en la auditoría ni en las respuestas de la API. Siempre tiene que quedar un dueño activo y nadie se saca a sí mismo el acceso. Un usuario desactivado deja de entrar al toque. Todo cambio queda en auditoría con quién lo hizo.
- **Por qué**: Ezequiel: "la campanita arreglala que muestre las notificaciones de los mensajes cuando pasa mucho tiempo sin atención un lead… que se pueda configurar en la rueda de configuración que está al lado, y hacé todo el apartado de configuración, roles… que se pueda asignar permisos".

### D-068 · 21/11/2026 · Ezequiel · notificaciones push en la app de clientes
- **Qué**: todo mensaje que le queda al cliente en el chat de la app (respuesta del equipo, respuesta del bot o aviso automático de un pedido, D-060) le llega también como notificación al celular. Al tocarla se abre la app en el chat.
  - No es WhatsApp (R-NOT-1 no se toca): es la notificación de la propia app instalada. El mail sigue como respaldo.
  - Los avisos automáticos de estado siguen apagados hasta que se prendan en el ERP; hoy lo que notifica es la respuesta del equipo.
- **Cómo lo prende el cliente**: en la pantalla principal aparece una tarjeta "Enterate al toque" (una sola vez), o desde Cuenta → Notificaciones en el celular. El interruptor es de cada dispositivo; "Avisos por mail" es de la cuenta. Las dos preferencias ahora las guarda el cliente desde la app (antes solo un asesor).
  - **iPhone**: Apple solo permite notificaciones con la app instalada ("Agregar a inicio"). La app lo explica.
  - Si el cliente las bloqueó en el navegador, la app le dice dónde habilitarlas.
- **Envío**: el worker revisa cada 5 segundos los mensajes nuevos para el cliente y manda la notificación una sola vez. Si falla no se repite (queda el chat y el mail). Un mensaje de más de 30 minutos no se notifica. Si el celular ya no acepta avisos, la suscripción se borra sola. Cliente bloqueado o con las notificaciones apagadas: no se manda.
- **Seguridad**: las claves (VAPID) van por entorno (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`); sin claves la app no ofrece notificaciones y el worker no manda nada. Solo se aceptan suscripciones de los servicios de push de los navegadores (Google, Apple, Mozilla, Microsoft), porque el sistema le escribe a esa dirección. Máximo 10 dispositivos por cliente.
- **Pantalla Avisos de la app**: mostraba avisos de ejemplo; ahora muestra los avisos automáticos reales del cliente, o "Todavía no tenés avisos". El punto rojo fijo de la campanita de la app se sacó.
- **Pendiente detectado**: "Mis pedidos" de la app sigue vacío (los pedidos reales del cliente no están conectados, "paso 6"). Es parte de la E1 y va en el PR siguiente.
- **No probado**: la entrega real en un celular. El navegador de desarrollo bloquea notificaciones; hay que probarlo en producción con un Android y un iPhone.
- **Por qué**: el contrato (E1) pide "PWA con… push. Email como respaldo"; era lo que faltaba para cerrar la etapa.

### D-069 · 21/11/2026 · Desarrollo · "Mis pedidos" de la app muestra los pedidos reales
- **Qué**: la app de clientes deja de mostrar la lista vacía. "Mis pedidos" y el detalle salen directo del tablero de producción: estado, descripción, medida, precio, seña, hora estimada, archivos e historial de pasos. Se actualiza solo cada 30 segundos mientras la app está abierta.
- **Qué ve el cliente**:
  - Solo sus pedidos. Pedir el número de otro cliente responde lo mismo que un número que no existe.
  - El recorrido del tablero de su servicio, sin "Archivo con error" como paso y sin "Seña recibida" si el pedido no lleva seña.
  - Con el archivo con error: el motivo que eligió el operador y un botón para reenviarlo por el chat.
  - Con el alta pendiente (D-014): su pedido figura como "Archivo recibido".
  - Hasta 50 pedidos entregados (los más nuevos).
- **Qué no ve**: notas internas, quién movió el pedido, el resultado del control automático ni datos del sistema.
- **Pedidos cancelados**: no se muestran. TODO(spec): confirmar con Verónica si el cliente tiene que verlos como "Cancelado".
- **Por qué**: el contrato (E1) pide "seguimiento automático en la app a partir de los estados de producción" y "órdenes con estado, medida, precio y hora estimada". Estaba pendiente desde D-045 ("paso 6") y la app mostraba "No tenés pedidos en curso" a todos.

### D-070 · 21/11/2026 · Ezequiel · Panel de tiempos con datos reales
- **Qué** (SPEC E1.6): la pantalla deja de estar vacía. Muestra, para los últimos 7, 14, 30 o 90 días y por tablero:
  - **Trabajos por día**, por tablero y por máquina (los que entraron en el período).
  - **Tiempo promedio en cada paso**, por tablero. Se mide de un cambio de estado al siguiente; el paso en el que un pedido está parado ahora no cuenta hasta que salga de ahí.
  - **Pedidos demorados**: los que llevan más de X horas en el mismo paso, del más viejo al más nuevo (hasta 100).
- **Definiciones nuestras** (TODO(spec): confirmarlas con Verónica):
  - Las horas son corridas, no hábiles: un pedido que entra el sábado a la tarde suma el domingo.
  - "Listo para retirar" no cuenta como demorado: espera al cliente, no al taller.
  - El tiempo en el paso se cuenta desde el último cambio de estado, no desde la última edición del pedido.
- **Límite configurable**: "Pedido demorado: más de (horas) en el mismo paso", en Configuración → Avisos. Arranca en 24 horas. **Inicio usa el mismo límite** (antes tenía 2 horas fijas, que con horas corridas marcaba como demorado todo lo que quedaba de un día para el otro).
- **Permisos**: dueño y atención ven todos los tableros; producción, solo los suyos.
- **Por qué**: Ezequiel: "seguí con el panel de tiempos". Era el último punto de la E1 sin datos reales.

### D-071 · 21/11/2026 · Ezequiel · el control de archivos decide en más casos: PDF y medidas sin unidad
- **Problema**: en producción, de 227 pedidos en "Archivo recibido" el control no decidía nada en 195: 92 llegaron por un link y no tienen el archivo guardado, 79 no tenían la medida "con unidad" y 32 no eran PNG ni JPG (30 PDF, 2 CorelDraw).
- **Medidas sin unidad**: muchos clientes escriben "58x30", "0.58x0.40" o "1.50 X 40". Ahora se supone la unidad por el número: con decimales y menor a 10 son metros; un entero de 10 a 2000 son centímetros.
  - Si el número es dudoso no se supone nada: "2481×3508" (son píxeles) o "568 X 1.598" (¿1,598 m o 1598?).
  - **Con la medida supuesta nunca se da el archivo por malo**: como mucho queda "Revisar el archivo", y el pedido no se mueve solo aunque el paso automático esté prendido. El detalle aclara que la unidad se supuso.
  - También se lee la unidad pegada a la x ("153CMX185CM"), que antes no se reconocía.
- **PDF**: se lee el tamaño real de la página. Si coincide con la medida pedida (3% de tolerancia, también girado) queda controlado; si no, "Revisar el archivo" con las dos medidas. La resolución de lo que hay dentro del PDF no se controla.
- **Sin ninguna medida**: el control igual deja un dato útil en la tarjeta para cotizar: "alcanza para imprimir hasta 58 × 100 cm a 250 dpi" o "El PDF mide 58 × 100 cm".
- **CorelDraw (.cdr)**: sigue sin controlarse; son muy pocos.
- **Sin IA**: se evaluó usar el modelo local para leer medidas de texto libre (I-09) y se descartó por ahora: el modelo chico inventa números, y con estas reglas se cubren los casos reales.
- **Pedidos que ya estaban**: después de subirlo se vuelve a controlar todo lo que había quedado sin decidir.
- **Pendiente** (PR siguiente): bajar el archivo de los links de Google Drive (son casi todos los links). TODO(spec): I-24 sigue abierto por el límite del error automático.
- **Por qué**: Ezequiel: "bien, mejorá en todos esos casos".

### D-072 · 23/11/2026 · Ezequiel · los archivos mandados por link de Drive y OneDrive se bajan solos
- **Qué**: cuando un pedido llega con un link de Google Drive o de OneDrive, el servidor baja el archivo y lo guarda en el pedido, como si hubiera venido adjunto. El operador lo descarga desde la tarjeta (con el mismo bloqueo hasta que esté liberado para imprimir) y pasa por el control automático. Cambia lo que decía el SPEC E1.1 ("los links no se descargan en la E1").
- **Por qué ahora**: en producción, 92 de los 195 pedidos que el control no podía decidir no tenían archivo guardado: de los links, 121 son de Drive, 25 de OneDrive y 2 de WeTransfer.
- **Cómo**: el worker revisa cada minuto hasta 3 pedidos abiertos con links sin procesar (los más nuevos primero), así también se van bajando los que ya estaban cargados. Cada pedido se intenta una sola vez. Hasta 5 links por pedido y 150 MB por archivo (el mismo tope que la app).
- **Si no se puede bajar**, la tarjeta lo explica: el link no es público ("pedile al cliente que lo comparta con cualquier persona que tenga el enlace"), ya no existe, pesa más de 150 MB, o es de un servicio que no se baja solo.
- **Qué links**: archivos de Drive (`/file/d/…`, `open?id=`, `uc?id=`) y links compartidos de OneDrive personal (`1drv.ms/<tipo>/c/<cuenta>/<clave>`). No se bajan carpetas ni documentos de Google, WeTransfer (son 2 pedidos y su descarga cambia seguido) ni otros servicios.
- **Seguridad**: el servidor solo se conecta a direcciones de Google Drive y de OneDrive. Cada redirección de la descarga se revisa contra esa lista antes de seguirla; solo https. El nombre del archivo se limpia (sin rutas). El archivo se guarda, nunca se abre ni se ejecuta.
- **OneDrive**: la API pública de OneDrive hoy pide iniciar sesión; se usa la descarga directa del link compartido, probada con links reales el 23/11. Si Microsoft la cambia, esos pedidos van a mostrar "no se pudo bajar" y el operador abre el link del mail como hasta ahora.
- **Retención**: estos archivos se borran igual que los demás, a los 30 días de entregado el pedido (D-015).

### D-073 · 23/11/2026 · Ezequiel · lo que estaba "a confirmar" queda configurable; links sin tope
- **Criterio**: en vez de dejar fijo lo que había que confirmar con Verónica, el dueño lo elige en Configuración → Avisos. Ya eran configurables los tiempos de los avisos y el límite de "demorado" (D-067, D-070). Se suman:
  - **Horas hábiles o corridas**: "Contar los tiempos del taller solo en horario de atención". Apagado (como arranca) se cuentan horas corridas. Prendido, el Panel de tiempos e Inicio cuentan solo lunes a viernes de 8 a 19 y sábados de 8 a 13, hora de Salta. El horario en sí está fijo en el código y es el mismo que usa el bot para decir "fuera de horario"; TODO(spec): confirmar ese horario con Verónica.
  - **Pedidos cancelados en la app**: "Mostrarle al cliente sus pedidos cancelados". Apagado (como arranca) no los ve. Prendido, aparecen en la pestaña de entregados con el estado "Cancelado" y un cartel en el detalle.
- **Inicio** deja de calcular los demorados por su cuenta: usa el mismo cálculo que el Panel de tiempos (mismo límite, misma forma de contar y desde el último cambio de estado, no desde la última edición).
- **Links sin tope por pedido** (cambia D-072): se bajan todos los links de Drive y OneDrive del pedido, no solo los primeros 5. Sigue el tope de 150 MB por archivo. Después de subirlo se vuelven a procesar los pedidos que tenían más de 5 links.
- **Por qué**: Ezequiel: "no pongas tope" y "dejalo configurable".

### D-074 · 23/11/2026 · Ezequiel · el cliente puede cancelar su pedido desde la app hasta "Cotizado"
- **Qué**: en el detalle del pedido de la app aparece "Cancelar este pedido", con una confirmación. Solo mientras el pedido está en "Archivo recibido", "Archivo con error" o "Cotizado" (o con el alta pendiente).
- **Cuándo ya no**: con la seña recibida, impreso, en calandra, listo o entregado. Ahí la app no muestra el botón y, si lo intenta igual, le dice que escriba por el chat. La seña quedó del lado de "ya no" porque hay plata de por medio; TODO(spec): confirmarlo con Verónica.
- **Rastro**: queda en el historial del pedido ("Cancelado por el cliente desde la app") y en la auditoría. El equipo se entera por Conversaciones, con un mensaje del cliente ligado al pedido. Cancelar dos veces no hace nada ni avisa de nuevo.
- **Si justo lo movieron**: la cancelación solo se aplica si el pedido sigue en un estado cancelable en ese instante; si un operador lo pasó a impreso un segundo antes, gana el operador.
- **Relación con D-073**: que el cliente vea después sus pedidos cancelados sigue dependiendo del tilde de Configuración (arranca apagado: al cancelar, el pedido desaparece de su lista).
- **Por qué**: Ezequiel: "lo pueden cancelar si no está en la etapa de impresión o impreso, solo si está en cotización o anteriores".

### D-075 · 23/11/2026 · Ezequiel · el cliente ve sus pedidos cancelados y puede volver a pedirlos, tal cual o con cambios
- **Se ven por defecto** (cambia D-073): el tilde "Mostrarle al cliente sus pedidos cancelados" ahora arranca prendido. Aparecen en la pestaña de entregados con el estado "Cancelado".
- **Volver a pedirlo**: en el detalle de un pedido cancelado hay un botón "Volver a pedirlo". Abre un formulario corto con la medida (ya cargada, se puede cambiar) y "¿Qué cambiás?" (opcional).
  - Es **el mismo pedido**: conserva el número, los archivos y el historial. Vuelve a "Archivo recibido" para que el equipo lo revise y lo cotice de nuevo; no se saltea ningún paso.
  - El precio anterior queda cargado como referencia, pero el pedido no está cotizado hasta que alguien del equipo lo confirme.
  - Si cambia la medida, el control automático del archivo se hace de nuevo con la medida nueva.
  - Para cambiar el archivo, el cliente manda el nuevo por el chat (flujo que ya existe).
- **Rastro**: queda en el historial ("Vuelto a pedir por el cliente desde la app", con los cambios), en la auditoría y como mensaje del cliente en Conversaciones.
- **Límites**: solo se vuelve a pedir un pedido cancelado y propio; un cliente bloqueado no puede. Si después de cancelar el dueño apagó el tilde, el cliente no ve el pedido y tampoco el botón.
- **Fuera de alcance**: "repetir" un pedido ya entregado. Queda en el backlog si lo piden.
- **Por qué**: Ezequiel: "mostralo y que pueda volver a pedirlo o modificarlo y volver a pedirlo".

### D-076 · 23/11/2026 · Ezequiel · links: sin tope de tamaño y más servicios (WeTransfer, carpetas de Drive, Dropbox)
- **Sin tope de tamaño** (cambia D-072): se saca el límite de 150 MB para los archivos que llegan por link. El archivo se escribe directo al disco de a pedazos, sin cargarlo en memoria, y la descarga no tiene límite de tiempo (solo 60 segundos para que el otro servidor empiece a responder).
  - **Único freno, el disco**: siempre quedan 10 GB libres en el servidor. La base de datos y sus copias viven en ese mismo disco; si se llena, se cae todo el sistema. Si un archivo no entra, no se baja (o se corta y se borra lo escrito) y la tarjeta dice "el servidor se está quedando sin lugar en el disco; avisale a soporte".
  - El límite de 150 MB de los archivos que el cliente sube **desde la app** no cambia (D-062).
- **Servicios nuevos**:
  - **WeTransfer** (`we.tl/…`): se le pide la descarga directa a la API de WeTransfer. Si la transferencia tiene varios archivos, llega un .zip. Las transferencias vencen a los pocos días: una vencida figura como "ya no existe o venció".
  - **Carpetas de Drive**: se bajan todos los archivos del primer nivel de la carpeta (no las subcarpetas).
  - **Dropbox**: links compartidos (`/s/…`, `/scl/fi/…`), con descarga directa. No hay casos reales todavía.
- **Links que no son archivos**: los del pie de los mails de Google ("denunciar abuso", "bloquear usuario") se ignoran en silencio; antes dejaban un aviso en la tarjeta.
- **Siguen sin bajarse solos**: Mega, TransferNow, Smash y cualquier otro servicio. La tarjeta avisa que hay que abrir el link desde el mail. No se puede hacer genérico: cada servicio entrega el archivo de una forma distinta, y dejar que el servidor se conecte a cualquier dirección que venga en un mail es un riesgo de seguridad.
- **Seguridad**: igual que en D-072. Cada servicio tiene su lista de direcciones permitidas y cada redirección se revisa; la dirección que devuelve la API de WeTransfer también.
- **Después de subirlo** se vuelven a procesar los pedidos que tenían un link sin bajar (los de más de 150 MB, WeTransfer y la carpeta).
- **Por qué**: Ezequiel: "sacá la limitación de MB y los links de otros servicios que se descarguen también".
- **Ajustes del 24/11/2026** (fuente: lo que se vio en producción al reprocesar):
  - Un link copiado del HTML del mail puede venir con `&amp;` en lugar de `&`: se corrige antes de usarlo.
  - **Drive que contesta "no existe"**: los links que arma Gmail cuando el cliente inserta un archivo de Drive (`docs.google.com/uc?…&revid=…`) solo los abre el destinatario con su sesión; a nosotros Google nos contesta "no encontrado", igual que con un archivo borrado. La tarjeta ahora dice las dos posibilidades y qué pedirle al cliente (compartirlo con "cualquier persona que tenga el enlace" o mandarlo adjunto). Para WeTransfer el texto sigue siendo "ya no existe o venció".
  - **Escritura a disco**: por cada espera al disco quedaba un aviso de error sin soltar (Node avisaba `MaxListenersExceededWarning`). Se corrigió, y un error del disco en medio de la escritura ya no puede tirar el worker.

### D-077 · 24/11/2026 · Ezequiel · el aviso de "link sin bajar" se ve aunque el pedido tenga otro archivo
- **Qué pasaba**: la nota de un link que no se pudo bajar (D-072) se mostraba en la tarjeta solo si el pedido no tenía ningún archivo guardado. Muchos mails traen un adjunto y además un link de Drive (Gmail convierte en link los archivos grandes): el operador veía el control del adjunto y no se enteraba de que faltaba otro archivo. En producción eran 5 de los 10 pedidos con nota.
- **Qué cambia**: el resultado del control lleva un campo aparte, `linkNote`, con la nota del link. La tarjeta lo muestra en "Archivo recibido" como "Link sin bajar: …", sea cual sea el resultado del control (bien, revisar, con problema o sin decidir).
- No cambia el veredicto ni el paso automático a "Archivo con error": es solo un aviso.
- **Después de subirlo** se vuelve a pasar el control por los pedidos que tienen una nota de link.
- **Por qué**: Ezequiel aprobó el cambio el 24/11 al ver el caso en producción ("sí, hacelo").

### D-078 · 24/11/2026 · Ezequiel · cierre de pendientes de la E1: push, backup fuera del VPS, `dtf@` y casillas
- **Push en teléfono real**: Ezequiel lo probó y funciona ("anda"). Con esto queda hecha la prueba de punta a punta mail → tablero → push de la definición de "hecho".
- **Copia de seguridad fuera del VPS: descartada** (cierra el pendiente de D-063). Queda solo el backup diario de la base en el mismo disco del servidor.
  - **Riesgo aceptado**: si se pierde el disco o el VPS, se pierden la base, los archivos y también las copias; no hay forma de restaurar desde otro lado.
  - **Por qué**: Ezequiel: "el VPS no va a fallar; si lo hace nos desquitamos con Hostinger". Si se quiere retomar, las opciones eran los backups de Hostinger, Google Drive o Backblaze/S3.
- **`dtf@` bloqueada para enviar (I-22)**: no depende de APOC. Lo tiene que pedir el cliente a Hostinger; no frena la entrega de la etapa.
- **Lectura de casillas**: el 24/11 se revisó el error 503 que la API de mail de Hostinger había devuelto una vez para DTF y Látex. Las 6 casillas se leen cada minuto sin error y no hubo fallos de lectura en 48 horas; fue una caída puntual de Hostinger. Dato a mirar: la casilla de **Látex** se lee bien pero nunca recibió un mail (I-26: confirmar si los trabajos de Látex entran por otra casilla).
- **Por qué**: respuestas de Ezequiel al repaso de lo que faltaba de la E1.

### D-079 · 24/11/2026 · Reunión con Verónica y Ricardo (grabación de Fathom) + Ezequiel · pulido de la E1: panel del pedido, seña al cotizar y fecha día/mes
- **Fuente**: reunión del 24/11 (Verónica, Ricardo y Ezequiel), los mensajes de WhatsApp de ese día y las indicaciones de Ezequiel al repasarla. La E2 no arranca hasta cerrar este pulido.
- **Implementado en este PR**:
  - **Panel del pedido**: al tocar una tarjeta del tablero se abre un panel dentro del sistema con todo el pedido: cliente, lo que escribió, medida, precio, seña, archivos para descargar, resultado del control del archivo, máquina, historial y las acciones (cotizar, error de archivo, cancelar, imprimir sin seña). Reemplaza a la ventana emergente que solo pedía precio y fecha, y a la tarjeta compacta que se abría dentro de la columna y quedaba cortada.
    - **Por qué**: Ezequiel: "se ve re mal que se abra una pestaña emergente"; quiere "una ventana ahí dentro del sistema con toda la información, el adjunto para descargar y demás". Además se cotizaba sin ver el pedido.
    - La descarga del archivo sigue la regla de D-062 (se libera al cotizar y, si lleva seña, al registrarla). `TODO(spec): I-17` sigue abierto: en la reunión Verónica describió "reciben el archivo, se descarga, se cotiza", que es descargar **antes** de cotizar. Falta que Ezequiel lo defina.
  - **Seña al cotizar**: el formulario de cotizar pide, además del precio, la seña que tiene que dejar el cliente (opcional). Con un monto, el pedido queda "Esperando seña de $X" (tarjeta, panel y app del cliente, que ya mostraba el monto) y no se puede imprimir sin registrarla (R-JOB-3). Vacío: el pedido no lleva seña y pasa directo a impresión. El cambio queda auditado (`deposit`).
    - **Por qué**: Verónica: "que el cliente vea que es tanta la cotización y que tiene que dejar tanto de seña… no quiero tener más deudas de clientes". Se deja abierto, a pedido de ella, que algunos clientes no dejen seña.
    - La seña no puede ser mayor que el precio.
  - **Fecha en día/mes/año y 24 h**: el campo "Listo para retirar" usaba el selector del navegador, que en la PC de la demo mostraba mes/día y AM/PM. Ahora se escribe `24/11/2026` y `18:00`; siempre es hora de Salta.
- **Definiciones de la reunión que quedan para los PR siguientes** (en este orden):
  1. **Columna "Esperando seña"** en el tablero, entre Cotizado y Seña recibida. **Hecho en D-081.**
  2. **Sectores reales (resuelve I-26)** — **hecho en D-082**: Gran Formato con Látex, Ecosolvente, UV rollo a rollo, UV rígidos y Cortes; DTF Textil, DTF UV y TPU; Sublimación y Calandrado aparte. Sin Embroidery ("vamos a tener solo TPU"). Látex deja de ser un tablero propio.
  3. **Sucursal de retiro** — **hecho en D-083** — (Av. Chile o San Juan) elegida al hacer el pedido, visible en la tarjeta. Hay una camioneta que cruza pedidos dos veces por día; el asistente no decide el lugar.
  4. **Trabajos por cliente** — **hecho en D-084**: ver todos los pedidos de un cliente en todos los sectores, para que caja los junte.
  5. **Número de cliente de Tango** visible y buscable; Ezequiel lo exporta cuando Ricardo le dé acceso por TeamViewer.
  6. **Máquinas reales por sector**: Ricardo pasa el listado (I-10). La asignación de máquina ya existe.
- **Error de archivo automático (I-24)**: Ezequiel pidió que el pedido con archivo mal pase solo a "Archivo con error" en vez de quedar marcado con un punto. El mecanismo ya existe (D-065) y está apagado en producción; se prende desde Configuración. Antes de prenderlo hay que revisar un caso visto en la demo (un pedido de DTF UV controlado como "2800 × 5000 cm, 3 dpi"), porque con el paso automático ese cliente habría recibido un aviso de error equivocado.
- **Sin definir todavía**: cómo calculan una cotización (para automatizarla), y cuándo se mandan las invitaciones a los clientes.

### D-080 · 24/11/2026 · Ezequiel + revisión de producción · una medida dudosa no da el archivo por malo
- **Qué pasaba**: de los 11 pedidos que el control marcaba como "Archivo con problema" el 24/11, 4 no tenían el archivo mal sino la medida mal leída: el cliente puso mal la unidad ("28x50 mts", "58 mts x 75.05 cm", "58 x 1,50mts") o escribió varias medidas y se tomó la que no era ("4mx2" junto a "58x 79").
- **Decisión**: en esos casos el control pide revisar en vez de marcar error:
  - **Medida imposible**: más de 3,2 m en el lado corto o más de 50 m en el largo. El aviso dice que la medida no parece real y cuánto se puede imprimir con ese archivo.
  - **Varias medidas**: si además de la medida usada el cliente escribió otro par suelto ("58x300"), la baja resolución queda como "Revisar el archivo".
- **Por qué**: Ezequiel pidió que el archivo con error pase solo a "Archivo con error" (D-079). Con el paso automático prendido, esos 4 clientes habrían recibido un aviso de error equivocado. El paso automático sigue saliendo solo con el caso claro: una sola medida, con unidad, posible, y resolución menor a la mitad del mínimo.
- **Impacto**: `checkFile` en `packages/contracts`. Sin migración. Al desplegar se vuelven a controlar los pedidos en "Archivo recibido" que estaban marcados con error.
- **Abierto**: `TODO(spec): I-24` — los topes (3,2 m y 50 m) son provisorios hasta tener el ancho real de cada máquina (I-10). El paso automático se prende desde Configuración.

### D-081 · 24/11/2026 · Reunión con Verónica y Ricardo · columna "Esperando seña" en el tablero
- **Decisión**: el tablero muestra una columna **Esperando seña** entre "Cotizado" y "Seña recibida", con los pedidos cotizados a los que se les pidió seña y todavía no la dejaron. Los cotizados sin seña quedan en "Cotizado", listos para imprimir.
- **Cómo**: no es un estado nuevo. El pedido sigue "Cotizado" hasta que se registra la seña; la API separa la columna según `depositRequired` y `depositPaidAt` (cada columna trae un `key`). Así no cambian las reglas de pasos (R-JOB-3), los avisos al cliente ni la app, y no hace falta migración.
- **Por qué**: en la reunión del 24/11 se acordó "una columnita más: cotizado, esperando seña y seña recibida", para ver de un vistazo qué pedidos están frenados por la seña (D-079).
- **Impacto**: `GET /jobs/board` devuelve una columna más en los sectores cuya secuencia tiene seña. El resumen de Inicio no cambia: sigue contando esos pedidos como cotizados.

### D-082 · 24/11/2026 · Reunión con Verónica y Ricardo + WhatsApp del 24/11 · sectores reales: sub-servicios de Gran Formato, DTF Textil y TPU (resuelve I-26)
- **Definición del cliente** (WhatsApp de Ricardo y Verónica, 24/11): "GRAN FORMATO: 1- Látex, 2- Ecosolvente, 3- UV rollo a rollo, 4- UV rígidos, 5- Cortes" y "DTF Textil, DTF UV, TPU". Sublimación y Calandrado van aparte. Embroidery no va ("vamos a tener solo TPU").
- **Decisión**:
  - **Tableros**: Calandrado, DTF Textil (antes "DTF"; el código sigue siendo `DTF`), DTF UV, Gran Formato, Sublimación y **TPU** (nuevo).
  - **Sub-servicios**: Látex, Ecosolvente, UV rollo a rollo, UV rígidos y Cortes son tableros hijos de Gran Formato (`Sector.parentId`). No tienen pestaña propia: sus pedidos se ven juntos en el tablero de Gran Formato, cada tarjeta dice de cuál es y se puede filtrar por sub-servicio.
  - **Látex deja de ser un tablero aparte**. Conserva su casilla: lo que llega a `latex@` entra a Gran Formato marcado como Látex.
  - Un pedido se puede pasar de un sub-servicio a otro desde el panel del pedido (por ejemplo, un mail que llegó a `granformato@` y era de Ecosolvente). Solo dentro del mismo tablero; queda auditado (`service`).
  - **Permisos (D-017)**: quien tiene Gran Formato ve todos sus sub-servicios; quien tiene solo un sub-servicio entra al tablero de Gran Formato y ve solo lo suyo.
  - **App de clientes**: al mandar un archivo, UV rígidos, Ecosolvente, UV rollo a rollo, Corte y Látex entran con su sub-servicio. TPU aparece como servicio para elegir.
  - **Avisos**: TPU se retira y se paga en la sucursal Centro, como DTF Textil y DTF UV (así lo dice la Ayuda cargada en D-053).
- **Por qué sub-servicios como tableros hijos y no un campo suelto**: cada uno puede tener su casilla, sus máquinas, sus pasos y sus operadores con lo que ya existe (D-064), sin duplicar reglas.
- **Impacto**: migración `20261124200000_sector_parent` (agrega `parentId`, renombra DTF, cuelga Látex de Gran Formato y crea Ecosolvente, UV rollo a rollo, UV rígidos, Cortes y TPU con los pasos y máquinas del tablero del que salen). `GET /sectors` devuelve solo tableros, con sus `services`; `GET /jobs/board` acepta `service`; nuevo `PATCH /jobs/:id/service`.
- **Abierto**:
  - **Casillas `cortes@` y `tpu@`**: los tableros nuevos nacen **sin casilla**, a propósito. Prenderlas hace que el sistema lea esas casillas y cree pedidos y avisos a clientes reales; se cargan desde Producción → Tableros cuando Ezequiel lo decida.
  - `TODO(spec): I-10` — máquinas reales por sector: los nuevos heredan las de Gran Formato o DTF hasta tener el listado de Ricardo.
  - Resolución mínima de TPU: queda en 100 dpi (el valor general) hasta confirmarla; DTF Textil y DTF UV siguen en 250.
  - Crear sub-servicios desde el ERP: hoy solo por migración.

### D-083 · 24/11/2026 · Reunión con Verónica y Ricardo · sucursal de retiro en cada pedido
- **Definición del cliente**: hay clientes que piden en varios sectores y quieren juntar todo en una sucursal ("retiro en la Chile" o "retiro en la San Juan"). Una camioneta cruza pedidos entre las dos dos veces por día. Verónica: "no quiero que el bot decida"; hay que saberlo "en el momento que hace el pedido para que ya salga con el destino".
- **Decisión**:
  - Cada pedido guarda dónde lo retira el cliente (`JobOrder.pickupBranch`: `chile` o `san-juan`).
  - **App**: al mandar un archivo, el cliente elige la sucursal en un paso propio (antes iba escrito en la nota). Se propone la sucursal donde se produce el servicio y la puede cambiar.
  - **Mail**: si el mail dice dónde retira ("retiro en la San Juan", "lo paso a buscar por la Chile"), se toma de ahí. Solo cuenta junto a retirar, buscar o pasar, para no confundirlo con la dirección de una firma; si nombra las dos o ninguna, queda **sin definir**.
  - **Taller**: la tarjeta muestra "Retira en …" y el panel del pedido tiene un desplegable para definirla o corregirla. El cambio queda auditado (`pickup`).
  - **Aviso de "listo para retirar"**: nombra la sucursal elegida (dirección y horario). Si no hay elección, la del servicio, como hasta ahora.
- **Por qué**: que caja pueda juntar los trabajos de un cliente y que el pedido se traslade a tiempo, sin depender de leer el mail.
- **Impacto**: migración `20261124230000_pickup_branch` (una columna, sin tocar datos). `POST /app/chat/files` acepta `pickupBranch` (opcional, para no romper la app ya instalada); nuevo `PATCH /jobs/:id/pickup`; `GET /app/jobs/:n` devuelve `pickup`.
- **Abierto**: los pedidos anteriores quedan sin definir. Ojo que "después lo vamos a tener que cambiar porque vamos a unificar todo" (Verónica): cuando unifiquen sucursales, esto se revisa. El asistente del chat todavía no pregunta la sucursal.

### D-084 · 24/11/2026 · Reunión con Verónica y Ricardo · pantalla "Trabajos por cliente"
- **Definición del cliente**: muchos clientes piden en Calandra, Gran Formato y DTF a la vez, y para encontrar todos sus trabajos había que ir tablero por tablero. Verónica: "trabajos por cliente me gustó"; lo usa la chica de caja para unificar los pedidos de un cliente.
- **Decisión**: nueva pantalla **Producción → Trabajos por cliente**.
  - Muestra los pedidos **en curso** (ni entregados ni cancelados) agrupados por cliente, de todos los sectores juntos: tablero y sub-servicio, estado ("Esperando seña" incluido), sucursal de retiro, importe y fecha prometida.
  - Arriba van los clientes con algo **listo para retirar**, después los que más trabajos tienen. Cada cliente dice en cuántos sectores tiene trabajos y la suma de lo cotizado.
  - Filtros: buscar por cliente, N.º de cliente o N.º de pedido; por sucursal de retiro (D-083); y "solo con trabajos en varios sectores", que es el caso que hay que juntar.
  - El número de pedido lleva al tablero donde se mueve. Es una pantalla de consulta: no cambia estados.
  - **Permisos (D-017)**: producción ve solo los trabajos de sus sectores.
- **Impacto**: `GET /jobs/by-customer`. Sin migración.
- **Abierto**: hasta 200 clientes por pantalla; si el volumen crece hay que paginar. Para el historial completo de un cliente (también lo entregado) sigue estando su ficha y Ventas → Pedidos.

### D-085 · 24/11/2026 · Ezequiel + revisión de producción · "Trabajos por cliente" por páginas y con los clientes plegados
- **Qué pasaba**: la pantalla de D-084 mostraba hasta 200 clientes con todos sus pedidos desplegados. En producción hay 303 clientes con trabajos en curso (562 pedidos), así que 103 quedaban afuera sin aviso salvo que se usara el buscador.
- **Decisión**:
  - La lista va **por páginas** de 30 clientes, con todos los clientes.
  - Cada cliente arranca **plegado**, con su renglón de resumen (sectores, cantidad de trabajos, listos para retirar y total cotizado); se abre con un clic. Si una búsqueda deja 5 clientes o menos, se muestran abiertos.
  - "Solo con trabajos en varios sectores" pasa a filtrarse en la API, para que el conteo y las páginas sean correctos.
- **Por qué**: una pantalla para juntar los trabajos de un cliente no puede esconder clientes. Ezequiel aprobó el arreglo al ver los números de producción.
- **Impacto**: `GET /jobs/by-customer` acepta `page`, `pageSize` y `several`, y devuelve `page` y `pageSize`. Sin migración. Cierra el punto abierto de D-084.

### D-086 · 24/11/2026 · Ezequiel (después de probar el sistema) · archivo descargable antes de cotizar, medida editable, arrastrar tarjetas y error automático prendido
- **Archivo descargable en cualquier paso (resuelve I-17)**: se quita el bloqueo de D-062 que liberaba el archivo recién al cotizar (y con la seña).
  - **Por qué**: Ezequiel: "el archivo se puede ver antes porque lo tienen que ver para cotizar, así que se lo habilitamos antes". Coincide con lo que describió Verónica el 24/11 ("reciben el archivo, se descarga, se cotiza").
  - **Qué se pierde**: el bloqueo era la forma de obligar a mover la tarjeta (D-032). Ahora el orden lo sostienen los pasos obligatorios y la seña (R-JOB-3), no la descarga. Sigue valiendo el permiso por sector (D-017).
- **Medida editable**: el taller corrige la medida pedida desde el panel del pedido (lápiz al lado de la medida). El control automático del archivo se vuelve a hacer con la medida corregida, que pasa a valer por sobre lo que escribió el cliente. Queda auditado (`measure`).
  - **Por qué**: las medidas mal escritas (D-080) quedaban "para revisar" sin forma de resolverlas en el sistema.
- **Arrastrar tarjetas**: una tarjeta se puede arrastrar a la columna siguiente para avanzarla; hace lo mismo que el botón (al cotizar abre el formulario). A "Archivo con error" pide el motivo. Soltarla más adelante no hace nada y avisa que los pasos no se saltean.
  - **Por qué**: Ezequiel esperaba que el tablero funcione arrastrando ("no funciona lo de arrastrar tarjetas"); hasta ahora solo se avanzaba con el botón.
- **Error de archivo automático prendido en producción (I-24)**: a pedido de Ezequiel, el 24/11 se prendió `auto-file-error`. Vale para los archivos que lleguen desde ese momento: un archivo con resolución menor a la mitad del mínimo, con una sola medida clara y posible (D-080), pasa solo a "Archivo con error" y el cliente recibe el aviso. Se apaga desde Configuración.
- **Pedido de prueba**: a pedido de Ezequiel se cargó un pedido de prueba (VV-000564, DTF Textil) en su cuenta de cliente N.º 1, para ver el seguimiento en la app. Es el único dato no real del sistema; borrarlo cuando termine de probar.
- **Impacto**: `GET /jobs/:id/files/:fileId` ya no devuelve 403 por el estado; nuevo `PATCH /jobs/:id/measure`. Sin migración.

### D-087 · 24/11/2026 · Ezequiel · "Enviar" de la app como formulario tipo mail (resuelve I-19)
- **Decisión**: el apartado **Enviar** de la app de clientes deja de ser una explicación con un link al correo y pasa a ser un formulario que arma el mismo mail que el cliente mandaba a la casilla: De (su nombre), Asunto (se arma solo: nombre, servicio, medida y copias), servicio, **ancho × alto con unidad**, copias, sucursal de retiro (D-083), aclaraciones y el archivo adjunto. Al enviar, el pedido se crea en el tablero del servicio y la app muestra el número.
- **Por qué**: Ezequiel: "que sea como armar el mail, así es mucho más fácil para el sistema pasarlo a pedido con esa info". Con cada dato en su campo el pedido nace con la medida exacta y no hay que interpretar texto libre, que es de donde salen las medidas mal leídas (D-080).
- **Cómo**:
  - Usa la subida que ya existía para el clip del chat (`POST /app/chat/files`), con tres campos nuevos y opcionales: `widthCm`, `heightCm` y `copies`. El pedido guarda la medida en `measure` y en `requestedSpecs.measures`, así el control del archivo no tiene que adivinarla.
  - El pedido queda también en el chat del cliente, como hasta ahora, con "Medida y cantidad".
  - Siguen funcionando el mail a la casilla y el clip del chat. El formulario ofrece abajo el mail como alternativa.
- **Impacto**: sin migración. Resuelve I-19 en lo que hace a subir archivos desde la app.
- **Abierto**: no hay tope de envíos por cliente ni aviso de archivo repetido (la otra mitad de I-19). Un trabajo con varias medidas distintas se manda de a uno o se aclara en el texto.

### D-088 · 24/11/2026 · Ezequiel · botón para eliminar pedidos
- **Decisión**: el panel del pedido tiene un botón **Eliminar pedido**, visible solo para el **dueño**. Pide el motivo y avisa qué pasa antes de confirmar.
  - Es un **borrado lógico** (`deletedAt`): el pedido deja de verse en el tablero, en los listados, en "Trabajos por cliente" y en la app del cliente, pero queda en la base con su historial. Queda en el log de auditoría (`delete`) con quién, cuándo, el estado, el importe y el motivo.
  - No avisa al cliente, y los avisos que el pedido tuviera pendientes no se mandan.
  - No hay "deshacer" en pantalla: recuperarlo es una operación de soporte sobre la base.
- **Por qué**: Ezequiel lo pidió al terminar de probar ("habilitame un botón para eliminar pedidos"): hacen falta para sacar pedidos de prueba, duplicados o cargados por error. Solo el dueño, porque un pedido eliminado desaparece también para el cliente; para una baja real del cliente sigue estando "Cancelar", que queda a la vista.
- **Impacto**: `DELETE /jobs/:id` con `reason`. Sin migración. El mail que originó el pedido no lo vuelve a crear: la idempotencia por Message-ID sigue valiendo porque el registro no se borra.
- **Abierto**: si atención también tiene que poder eliminar, se agrega el rol.

### D-089 · 24/11/2026 · Ezequiel (después de la prueba de punta a punta) · Inicio: estadísticas correctas, totales en pesos, filtros y permiso para verlos
- **Qué estaba mal** (informe `docs/INFORME-PRUEBAS-2026-11-24.md`):
  - "En producción" contaba todo lo no entregado: en producción mostraba 571 y 570 estaban en "Archivo recibido", sin cotizar.
  - El cuadro "Conversaciones" era un texto fijo ("todavía no hay") aunque había 312, con 283 sin leer.
  - No había ningún total en pesos ni forma de elegir el período.
  - Inicio bajaba los tableros completos y contaba en el navegador (con tope de 1.000 pedidos por tablero).
- **Decisión**: Inicio se rehace sobre un resumen que calcula la API (`GET /jobs/summary`).
  - **En el taller ahora** (no depende del período): Para cotizar, Con error de archivo, Esperando seña, En producción (cotizado sin seña pendiente, con seña, impreso o en calandra), Listos para retirar y Demorados.
  - **Período**: Hoy, 7 días, 30 días, Este mes o fechas elegidas (día/mes/año), y filtro por sector. Muestra pedidos que entraron y pedidos entregados.
  - **Totales en pesos del período**: Total entregado (precio de los pedidos entregados), Total cotizado y Señas registradas.
  - **Gráfico por sector** con las cinco franjas; los sub-servicios suman en su tablero. Cada fila lleva al tablero.
  - **Conversaciones sin leer**: cantidad y las últimas cinco. Solo para dueño y atención.
- **"Total facturado"**: Ezequiel lo pidió con ese nombre. Hoy el sistema no factura ni registra cobros (Etapa 3), así que se muestra como **Total entregado** con la aclaración en pantalla de que es lo que corresponde facturar, no lo cobrado. Cuando exista la facturación ARCA, ese número pasa a salir de los comprobantes.
- **Permiso para ver los pesos**: nuevo permiso por usuario `canSeeBilling` ("Puede ver el total entregado, cotizado y las señas en Inicio"), que el dueño marca en Configuración → Usuarios. El dueño los ve siempre. Sin el permiso la API no manda los montos (no es solo ocultarlos en pantalla). El cambio queda auditado.
  - **Por qué por usuario y no por rol**: los roles son tres y fijos; Ezequiel pidió poder asignar quién lo ve. Un permiso suelto lo resuelve sin rehacer el esquema de roles.
- **Impacto**: migración `20261125010000_user_can_see_billing` (una columna, por defecto apagado). Se actualiza también el texto de "Qué puede hacer cada rol".
- **Abierto**: el permiso solo cubre los totales de Inicio; los precios de cada pedido los siguen viendo todos los que ven el pedido, porque los necesitan para cotizar y cobrar la seña.

### D-090 · 24/11/2026 · Revisión de producción · el buscador de Ventas → Pedidos fallaba al buscar por nombre
- **Qué pasaba**: al buscar texto en Ventas → Pedidos ("pedro", "a") la API devolvía error 500 y la lista no cargaba. Se vio en los registros de producción el 24/11, justo después del despliegue de D-089, con alguien usando el buscador.
- **Causa**: una expresión regular mal escrita (`/D/` en vez de `/\D/`) dejaba el nombre como si fuera un número de pedido. Buscar por número sí andaba, por eso el test que había no lo detectó. El error estaba desde que se hizo el listado; no lo introdujo ningún cambio del 24/11.
- **Arreglo**: se corrige la expresión y se agrega un test que busca por nombre, por una letra y por "VV-000123".
- **Impacto**: solo `GET /jobs` con `search`. Sin migración.

### D-091 · 24/11/2026 · Ezequiel (pendientes del informe de pruebas) · medida corregida en pedidos con error, horas en 24 h y textos de avisos
- **Medida corregida en un pedido con error**: si el pedido está en "Archivo con error" porque lo puso el **control automático**, al corregir la medida vuelve a "Archivo recibido" y se controla de nuevo con la medida nueva. Al cliente no se le avisa "recibimos tu archivo" (no mandó nada). Si el error lo puso una persona (colores, fuentes, etc.), corregir la medida no mueve el pedido.
  - **Por qué**: antes quedaba el cartel viejo ("Para 58 × 100 cm da 25 dpi") y la única salida era tocar "Archivo corregido", que le mandaba al cliente un aviso falso.
- **Título del pedido**: en los pedidos de la app la descripción empieza con la medida; al corregirla se actualiza también ahí, para que tablero, Pedidos y app no muestren la vieja.
- **Horas en 24 h en la app del cliente** ("17:30" en vez de "05:30 p. m."), igual que el ERP. También se fija la zona horaria de Salta en el chat.
- **Avisos al cliente**:
  - El aviso de error ofrece mandar el archivo corregido **por el chat de la app** o por mail (antes solo nombraba la casilla). Se quita el doble punto final.
  - La descripción del pedido va recortada a 60 caracteres; entera hacía los avisos muy largos.
- **Descripción de los pedidos de la app**: ya no repite "Servicio: DTF Textil" (el servicio es el tablero del pedido).
- **Impacto**: sin migración. Resuelve los puntos A-2, A-3, A-7, A-8, A-9 y A-10 del informe `docs/INFORME-PRUEBAS-2026-11-24.md`.
- **Abierto**: A-1 (arrastre de tarjetas con mouse real y en pantallas táctiles) y A-12 (un pedido entregado sigue mostrando "Saldo a pagar", porque el cobro del saldo es de la Etapa 3).

### D-092 · 24/11/2026 · Ezequiel (captura de un chat real) · el bot informa el estado real del archivo, y los mails se clasifican en los sub-servicios sin casilla
- **Bot, qué pasó**: en un chat real el cliente preguntó "¿tenés mi archivo?" y "¿está correcto?" y el bot contestó tres veces lo mismo: "Apenas llegue tu archivo, lo veré en el sistema…", incluso con el pedido en "Archivo con error".
  - **Causa**: esas preguntas no estaban en los flujos fijos (D-060), así que las contestaba la IA, y el modelo local inventó. Además el bot no conocía el motivo del error de archivo, solo el nombre del estado.
- **Bot, decisión**:
  - Las preguntas por el archivo ("¿tenés mi archivo?", "¿llegó?", "¿está correcto?", "¿tiene algún error?") se contestan con un **flujo fijo**, sin IA, con los pedidos reales del cliente.
  - Por pedido dice: en "Archivo con error", el motivo y el detalle del control y que lo mande corregido con el clip; en "Archivo recibido", si el control dio bien, si lo está revisando el equipo o que falta cotizar; en el resto, el estado.
  - **No repite**: si la IA va a decir exactamente lo mismo que ya dijo en ese chat, el bot deriva a un asesor y se apaga en ese chat.
  - La IA también recibe el motivo del error en el contexto.
- **Mails a sub-servicios sin casilla**: Cortes, Ecosolvente, UV rollo a rollo, UV rígidos y TPU no tienen casilla. Cada mail que entra a la casilla de Gran Formato (o a la de DTF Textil y DTF UV, para TPU) se revisa: si nombra **un solo** sub-servicio, el pedido entra directo en ese; si nombra varios o ninguno, queda en el tablero de la casilla para que lo clasifique una persona.
  - **Por qué**: Ezequiel: "esas casillas que faltan, que revise todos los mails que llegan y se fije si es alguna de esas". Evita depender de crear casillas nuevas.
  - **Palabras**: látex; ecosolvente; "UV … rollo" o "rollo a rollo"; "UV … rígido", "rígidos" o "cama plana"; "ploteo/plotter/servicio de corte", "solo corte" o un asunto que empieza con "corte"; TPU. "Con corte" suelto no cuenta, porque lo dice casi cualquier pedido de vinilo.
  - El archivo corregido y el control de duplicados (Message-ID) miran toda la familia de la casilla, para no duplicar pedidos que quedaron en un sub-servicio.
- **Impacto**: sin migración. `bot-dry-run` acepta pedidos de ejemplo para probar el bot real con un pedido en error.
- **Abierto**: los pedidos que ya estaban en Gran Formato y DTF no se reclasifican solos; se puede correr una pasada sobre los existentes. `TODO(spec): I-10` — las palabras se ajustan cuando Ricardo pase cómo nombran los clientes cada servicio.

### D-093 · 24/11/2026 · Ezequiel (prueba del bot con el modelo real) · más formas de preguntar por el archivo, y precio y seña en el pedido cotizado
- **Fuente**: prueba del bot en el servidor con el modelo real (`bot-dry-run`, sin tocar la base) después de D-092.
- **Más formas de preguntar por el archivo**: "¿qué le pasa a mi archivo?", "¿por qué no avanza?", "mi archivo sirve así?", "el pedido está trabado" también van al flujo fijo con el estado real. En la prueba, "qué le pasa a mi archivo, por qué no avanza?" la había contestado la IA en 9,6 segundos y había marcado el chat para un asesor sin decírselo al cliente.
- **Pedido cotizado**: a "¿está listo mi pedido?" el bot contestaba solo "Cotizado". Ahora dice el precio y, si falta, la seña con su monto, y ofrece el alias para pagarla.
- **Impacto**: sin migración. Solo flujos fijos del bot.
- **Abierto**: las preguntas generales siguen yendo a la IA. En la prueba, "¿qué diferencia hay entre DTF y sublimación?" recibió una explicación imprecisa: es el límite del modelo local chico (D-057). Se resuelve cargando esas respuestas como fijas cuando la Ayuda sea editable (Etapa 2).

### D-094 · 24/11/2026 · Ezequiel · el cliente suma un archivo a un pedido que ya tiene, y el bot dice por pedido si tiene o no el archivo
- **Pedido de Ezequiel**: "el bot tiene que gestionar el caso de tener que cargar un archivo a su pedido"; si el cliente pregunta si se recibió el archivo, que diga de qué pedido habla y si lo tenemos o no, "que sea inteligente".
- **Sumar un archivo a un pedido existente**:
  - En el clip 📎 del chat, antes de elegir el servicio, el cliente elige **"Trabajo nuevo" o uno de sus pedidos** en curso. Con un pedido elegido solo pide el archivo y una aclaración opcional.
  - Se puede hasta "Seña recibida" (antes de imprimir). Si el pedido está en "Archivo con error", vuelve a "Archivo recibido" (D-065). Si no, el archivo se suma y el control automático se hace otra vez; queda en el historial sin mandar un aviso de estado.
  - La aclaración se suma a lo que ya tenía el pedido: antes, mandar el archivo corregido pisaba las medidas cargadas.
  - Desde el detalle de un pedido con error, "Reenviar el archivo por el chat" abre el clip con ese pedido ya elegido.
  - `POST /app/chat/files` acepta `job` (número de pedido del cliente) en lugar de `sector`. Un pedido de otro cliente da "no encontrado"; uno ya impreso, error claro.
- **El bot, por pedido**:
  - Sabe qué archivos tiene guardados cada pedido. Dice "recibimos el archivo (nombre)" o "tengo el pedido, pero todavía no tengo ningún archivo", o "llegó con un link que todavía no pudimos bajar", y cómo mandarlo eligiendo ese pedido en el clip.
  - Con **varios pedidos en curso** lista cada uno con su situación y pregunta "¿Por cuál me consultás?".
  - Si el cliente **nombra un pedido** ("VV-000051", "pedido 51", "orden #51") responde solo por ese; si no es suyo o no existe, lo dice y muestra los que sí tiene.
- **Límite de subidas**: 10 archivos por minuto por cliente, ahora configurable con `APP_UPLOADS_PER_MINUTE` (los tests suben muchos seguidos).
- **Impacto**: sin migración.

### D-095 · 24/11/2026 · Ricardo (mensaje del 24/11) + Ezequiel · materiales u opciones de impresión por tablero, con código en el pedido
- **Pedido del cliente**: "Hay sectores de impresión que necesitan más info para poder estar organizados. En DTF Textil tenemos distintas opciones: Normal, Reflectivo, Fluorescente, Glitter, Dorado, Plateado, Oro, Plata, Color change. Necesitamos que el cliente pueda elegir en qué material y que luego la orden tenga un código que nos permita identificarlo. Lo mismo pasa en los demás sectores (por ejemplo en Calandra, tela Jersey Set). Así podemos agrupar los trabajos según los materiales." Ricardo va a mandar un Excel con todas las alternativas de cada producto. Ezequiel: "andá haciendo esto".
- **Decisión**:
  - Cada tablero tiene su lista de **materiales u opciones** (`SectorVariant`), cada uno con un **código único** que identifica al pedido (por ejemplo `DTF-GLI`).
  - **App**: al mandar un trabajo (formulario de Enviar o clip del chat), si el servicio tiene materiales cargados el cliente **tiene que elegir uno**. El asunto del pedido lo incluye.
  - **Mail**: si el mail nombra un solo material del tablero ("glitter", "DTF-GLI"), el pedido nace con ese. "Normal" suelto no cuenta ("tamaño normal"). Si nombra varios o ninguno, lo define el taller.
  - **Tablero**: la tarjeta muestra el código; hay filtro "Todos los materiales"; buscar por código o nombre; "Agrupar por material" junta los pedidos del mismo material y "+N con el mismo material" los cuenta.
  - **Panel del pedido**: desplegable "Material" para definirlo o corregirlo. Queda auditado. Si el pedido pasa a otro sub-servicio, se le quita el material del anterior.
  - **Producción → Materiales por tablero** (dueño): agregar, activar y desactivar materiales. Desactivado deja de ofrecerse, pero los pedidos que lo tienen lo conservan.
  - **App, detalle del pedido**: muestra el material.
- **Cargado**: las nueve opciones de DTF Textil, con códigos provisorios `DTF-NOR`, `DTF-REF`, `DTF-FLU`, `DTF-GLI`, `DTF-DOR`, `DTF-PLA` (Plateado), `DTF-ORO`, `DTF-PLT` (Plata), `DTF-CCH`.
- **Por qué un catálogo por tablero y no el `Product` que ya existía**: `Product` es el catálogo de stock de la Etapa 3; las opciones de impresión las define cada tablero y las administra el dueño hoy.
- **Impacto**: migración `20261125030000_sector_variants` (tabla nueva y `JobOrder.variantId`; carga las opciones de DTF Textil). Endpoints: `GET /app/sectors/:code/variants`, `POST /sectors/:id/variants`, `PATCH /variants/:id`, `PATCH /jobs/:id/variant`; `GET /jobs/board` acepta `variant`.
- **Abierto**: `TODO(spec): I-28`.

### D-096 · 24/11/2026 · Ezequiel · la prueba del bot (bot-dry-run) pasa todos los datos del pedido
- **Qué pasaba**: al probar el bot en el servidor después de D-094, la herramienta de prueba no le pasaba los archivos de cada pedido ni el monto de la seña. Copiaba los datos campo por campo y los que se agregaron después se perdían sin aviso, así que la prueba respondía distinto que el worker real (por ejemplo, decía "recibimos el archivo" en un pedido sin archivos).
- **Arreglo**: los pedidos de ejemplo se arman completando solo lo que falta y pasando todo lo demás tal cual, así un dato nuevo del bot llega a la prueba sin tocarla. También acepta `alreadyTalking` y `noticesOn` por caso, y fechas como texto.
- **Impacto**: solo la herramienta de prueba (`apps/worker/src/bot-dry-run.ts` y `bot/dry-run-jobs.ts`). No cambia cómo responde el bot.

### D-097 · 24/11/2026 · Ezequiel · el bot pasa a ser una IA con herramientas, como el agente de Trip
- **Pedido de Ezequiel**: "¿pero cómo sin pasar por la IA? ¿No estás corriendo una IA local, como en Trip?". Elige el esquema de Trip.
- **Antes (D-060 a D-096)**: la IA local (`qwen2.5:3b`) solo contestaba lo que no cubrían las respuestas armadas por código (saludos, estado del pedido, archivos, horarios, pagos). Se hizo así porque el modelo chico inventaba.
- **Ahora, como Trip**:
  - La IA local responde todos los mensajes y **pide los datos con herramientas**: `ver_mis_pedidos` (estado, archivos, problema del archivo, precio y seña; por número si el cliente lo nombra), `info_servicio` (formato, requisitos, casilla, sucursal y seña de un servicio), `sucursales_y_horarios`, `datos_de_pago`, `preguntas_frecuentes` y `derivar_a_asesor`. Los datos salen del sistema y de la Ayuda, no del modelo.
  - El prompt quedó corto: las reglas y quién es el cliente. Lo demás lo pide con las herramientas.
  - **Modelo**: `qwen3:8b` (el mismo de Trip) por la API nativa de Ollama, con contexto de 8.192 tokens y hasta 4 rondas de herramientas por respuesta.
- **Qué se mantiene**:
  - La derivación fija a un asesor (precios sin cotizar, cancelar, reclamos, comprobantes, pedir una persona): no pasa por la IA.
  - Los controles sobre lo que escribe: de "vos", casillas bien escritas, sin promesas de aviso si están apagados, y no repetir la misma respuesta.
  - **Respaldo con los datos reales**: si la IA falla o tarda, o contesta sobre un pedido o un archivo **sin haber consultado `ver_mis_pedidos`**, va la respuesta armada por código (los flujos de D-060 a D-094). Así no se repite el "apenas llegue tu archivo lo veo" de la captura del 24/11.
- **Sin OpenAI de respaldo**: Trip lo tiene; acá Ezequiel pidió antes que el bot corra solo en local (D-057). El código lo soporta si se carga `OPENAI_API_KEY` sin `BOT_API_URL`.
- **Velocidad**: el servidor tiene 4 núcleos sin placa de video. Hay que medir `qwen3:8b` con `bot-dry-run` antes de prender el bot en más chats; con el 3B cada respuesta de la IA tardaba entre 6 y 10 segundos.
- **Impacto**: sin migración. `BOT_MODEL` por defecto pasa a `qwen3:8b` (compose, `.env.example` y código); hay que bajar el modelo en el servidor (`ollama pull qwen3:8b`, unos 5 GB).

## 5. Pendientes del cliente para arrancar la E1

Actualizar cuando llegue cada cosa.

| Pendiente | Para qué | Estado |
| --- | --- | --- |
| Logo en PDF vectorial | Paleta de colores, íconos y manifest de la PWA (D-019) | **Recibido el 18/11** (D-021, D-022) |
| Mascota con vinilos en los brazos | Logo e ícono de la app de clientes (D-022) | **Recibida el 19/11** (D-031) |
| Nombres reales de las 16 máquinas y su sector | Seed de máquinas (I-10) | Pendiente |
| Acceso al VPS de Hostinger | Alojar el sistema (D-007) | **Recibido el 19/11**: servidor preparado (D-035) |
| Dominios para el ERP y la app de clientes | HTTPS, PWA y push (D-035) | **Recibido el 19/11**: `viavinilo.tech`, `www` y `erp` apuntan al VPS, con HTTPS (D-036) |
| Casillas de mail por sector en Hostinger | Ingesta IMAP (D-027) y envío de mails (SMTP, D-037) | Pendiente |
| Datos de clientes de Runamatic y Tango | Migración del alta de clientes | Pendiente (actualización §6) |
| Capturas del CRM de Runamatic con los estados por sector | Definir la secuencia de estados de cada sector | Pendiente (actualización §6) |

**Expectativa a cuidar**: Ezequiel les dijo que "en lo posible el lunes" (23/11, inicio de la E1) vayan viendo algo. Con la regla "prometer de más en tiempo y entregar antes" (actualización §4), lo que se muestre ese día tiene que estar acotado, por ejemplo la app con la marca y el tablero vacío, y depende de tener el acceso a Hostinger y el logo antes.
