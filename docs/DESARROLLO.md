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
| I-15 | Mails sin archivo y respuestas en el mismo hilo | (a) La actualización 2.3 dice que si falta el adjunto la orden pasa a "Archivo con error", pero la 2.5 dice que una orden nunca nace de un "hola". (b) Si el cliente responde en el mismo hilo (por ejemplo para reenviar un archivo con error), no está definido si se suma a la orden existente o crea otra. | E1 | Abierto. Por defecto: (a) un mail sin adjuntos ni links de WeTransfer o Drive no crea orden y queda en el log como "sin archivo"; (b) cada mail con archivo crea su propia orden. |
| I-16 | Volver un paso atrás | Los pasos son obligatorios y no se pueden saltear, pero un operador puede equivocarse de botón (por ejemplo, marcar "Impreso" una orden que no imprimió). Hoy nadie puede deshacerlo; solo cancelar. | E1 | Abierto. Propuesta: que el dueño pueda volver una orden un paso atrás, con motivo obligatorio y registro en la auditoría. Confirmar con Verónica. |

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
- **Actualización 18/11, 11:40 (grupo de WhatsApp)**: el cliente va a mandar **otra versión de la mascota, con vinilos en los brazos**. Ezequiel respondió que "calcula" que va para la app de clientes. *Todavía no es definitivo.* Cuando llegue, se confirma con el cliente y, si va en la PWA, reemplaza a `logo-mascota.svg` y a los íconos de instalación. Ver pendientes en el §5.

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

## 5. Pendientes del cliente para arrancar la E1

Actualizar cuando llegue cada cosa.

| Pendiente | Para qué | Estado |
| --- | --- | --- |
| Logo en PDF vectorial | Paleta de colores, íconos y manifest de la PWA (D-019) | **Recibido el 18/11** (D-021, D-022) |
| Mascota con vinilos en los brazos | Posible logo e ícono de la app de clientes (D-022) | Prometida el 18/11 a las 11:40 |
| Nombres reales de las 16 máquinas y su sector | Seed de máquinas (I-10) | Pendiente |
| Acceso a la cuenta de Hostinger | VPS para alojar el sistema (D-007) y casillas de mail por sector | Pedido el 18/11 |
| Datos de clientes de Runamatic y Tango | Migración del alta de clientes | Pendiente (actualización §6) |
| Capturas del CRM de Runamatic con los estados por sector | Definir la secuencia de estados de cada sector | Pendiente (actualización §6) |

**Expectativa a cuidar**: Ezequiel les dijo que "en lo posible el lunes" (23/11, inicio de la E1) vayan viendo algo. Con la regla "prometer de más en tiempo y entregar antes" (actualización §4), lo que se muestre ese día tiene que estar acotado, por ejemplo la app con la marca y el tablero vacío, y depende de tener el acceso a Hostinger y el logo antes.
