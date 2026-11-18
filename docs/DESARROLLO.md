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
- Proceso productivo por sector con estados propios, pasos obligatorios, cotización antes de imprimir, tablero, asignación de máquina y agrupación por material.
- Seguimiento automático en la app a partir de los estados de producción.
- PWA con acceso sin contraseña, órdenes con estado, medida, precio y hora estimada, reenvío de archivos y push. Email como respaldo.
- Panel de tiempos.
- Borrado automático de archivos de impresión a los 30 días.

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
| I-01 | Retención de archivos | SPEC: 60 días después de la entrega. Actualización: 1 mes. Contrato: 30 días. Ninguno dice **desde qué evento** se cuentan (recepción, entrega o último cambio de estado). | E1 | Abierto |
| I-02 | Seña antes de imprimir (R-JOB-3) | R-JOB-3 bloquea `PRINTING`, pero en los estados nuevos ya no hay "Imprimiendo": de "Cotizado" se pasa a "Impreso". Si el bloqueo se pone al marcar "Impreso", ya es tarde porque el trabajo está impreso. Hay que definir dónde se frena (por ejemplo, que no aparezca como imprimible en el tablero hasta tener la seña). | E1 | Abierto |
| I-03 | Mail de un remitente desconocido | SPEC E1.1: crear un cliente provisorio "a verificar" y la orden. Actualización 2.1: solo se imprime a clientes dados de alta, y el alta la valida un asesor. Falta definir qué pasa con la orden mientras el alta está pendiente: si se crea bloqueada, se rechaza o se le responde al remitente con el link de alta. | E1 | Abierto |
| I-04 | OTP por teléfono | SPEC E1.5: OTP al email **o al teléfono**. Mandarlo al teléfono por SMS o WhatsApp tiene costo, y R-NOT-1 prohíbe el WhatsApp iniciado por el negocio. El contrato solo dice "acceso sin contraseña". | E1 | Abierto |
| I-05 | Puntos como medio de pago en el POS | Contrato E3: el POS acepta pagos mixtos **con puntos**. Pero el programa de puntos (acreditación y migración de saldos de Fidely) es de la E4. Falta definir si en la E3 los puntos se cobran contra los saldos de Fidely, o si el medio de pago queda preparado y se habilita en la E4. | E3 | Abierto |
| I-06 | Roles y permisos | Contrato: "usuarios con roles y permisos" figura en la E3. Pero la E1 necesita login de operadores y asesores (tablero y validación de altas), y el SPEC §10 los pone en el paso 2 de la E1. | E1 | Abierto. Propuesta: en la E1, auth interna con roles mínimos (owner, production, attention); en la E3, la gestión completa de roles y permisos. |
| I-07 | Notificaciones opcionales | El SPEC lista `PRINTING` como push opcional, pero ya no existe "Imprimiendo". | E1 | Abierto. Propuesta: opcionales Archivo recibido, Cotizado e Impreso; obligatorias Archivo con error y Terminado. |
| I-08 | Cantidad de tiendas propias (D6) | El SPEC habla de 4 marcas. El contrato dice "tiendas online propias" sin número, más las externas de Ricardo. | E4 | Abierto. No bloquea hasta la E4. |
| I-09 | Proveedor de IA para revisar archivos | El contrato dice que se define con el cliente. Formato, apertura, resolución y medidas se pueden chequear sin IA; la IA solo hace falta para leer las medidas escritas en texto libre en el mail. | E1 | Abierto. Propuesta técnica: chequeos deterministas y un LLM solo para extraer las medidas del cuerpo del mail. |

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
