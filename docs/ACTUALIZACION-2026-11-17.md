# Actualización de alcance — llamada del 17/11/2026

Llamada de 71 minutos con Ricardo y Verónica Rabadan Martín (esposa y socia; lleva la atención y la parte textil). Por APOC estuvieron Ezequiel y Elian. Este documento tiene prioridad sobre SPEC.md donde se contradigan.

> Lo vigente está en `docs/DESARROLLO.md`, que tiene prioridad sobre este documento. El contrato del 18/11 cerró varios puntos que acá figuran "a evaluar": asistente en la app (D-005), servidor (D-007), Interbanking (D-008) y chat interno (D-010).

## 1. Resumen ejecutivo

- El proyecto está confirmado. Verónica era la última palabra y quedó a bordo, aunque con mucha desconfianza por experiencias anteriores. Pide hechos, no promesas, y plazos realistas.
- Cambio principal: la App de clientes (PWA) pasa a ser el centro de todo. La Etapa 2 ya no es "un agente de IA en WhatsApp". Ahora es autoservicio dentro de la app: preguntas frecuentes, precios, instructivos y ayuda. WhatsApp queda solo para soporte, reclamos y postventa, con un único número.
- Volumen real: ~2.100 mensajes por día. Verónica responde la mayoría y trabaja 13 horas diarias.
- Posible inicio la semana que viene, con el último cupo de noviembre, en lugar de diciembre. Elian coordina con Ricardo.
- Se arma un grupo de WhatsApp con Verónica para que vaya mandando ideas sobre la marcha. Ver §7, gestión de cambios.

## 2. Cambios que modifican SPEC.md

### 2.1 Clientes: alta obligatoria y número de cliente (impacta E1)

- Solo se imprime a clientes dados de alta. No se atiende a consumidor final: el cliente tiene que ser del gremio gráfico (remeras, cartelería, etc.). Se imprime por metro, no calcos sueltos.
- Cada cliente tiene un número de cliente único y visible.
- Datos mínimos: nombre, apellido, DNI, email y teléfono. El DNI es la clave para identificarlo.
- Migrar los datos existentes (Tango, Runamatic, planillas) para no volver a pedírselos al cliente. Es un punto sensible: "los clientes vienen quemados de pasar sus datos".
- Alta de cliente nuevo: hay requisitos y condiciones de ingreso. El alta la valida un asesor; puede iniciarse desde la app y queda pendiente de aprobación.
- Agregar a `Customer`: `customerNumber` (único), `dni`, `status` (pendiente / activo / bloqueado) e `internalNotes` (notas internas no visibles para el cliente, por ejemplo "cliente quejoso" o "buen cliente").

### 2.2 Ingesta de mails: Hostinger (impacta E1.1)

- El correo está en Hostinger y ya pagaron 3 años, así que se mantiene Hostinger. Integrar por IMAP/SMTP con Hostinger. No proponer migrar el correo.
- Hoy tienen problemas de mails que no llegan y de respuestas que rebotan a la casilla de DTF. Hay que loguear y monitorear la ingesta (alerta si una casilla no recibe nada en X horas en horario laboral) y configurar bien el Reply-To por sector.
- Los mails a los clientes (acuses y avisos) salen por SMTP. Revisar SPF, DKIM y DMARC del dominio con Ricardo.

### 2.3 Revisión automática del archivo con IA (nuevo, E1)

- Propuesta de Ezequiel que les gustó: cuando entra el mail, un análisis automático comprueba que el adjunto exista, se pueda abrir, tenga el formato, la resolución y las medidas esperadas, y lo compara con las medidas que el cliente escribió en el mail.
- Si está OK, la orden pasa a `RECEIVED` / "Archivo recibido".
- Si falla, pasa a `FILE_ERROR` con el motivo.
- En la primera versión es una sugerencia que el operador confirma con un clic. La automatización total se activa por sector cuando se gane confianza.
- Así desaparece el paso manual "revisar si llegó el mail", que hoy frena a los impresores (95 a 100 clientes por sector).

### 2.4 Estados por sector (reemplaza los defaults de E1.2)

Tomados del CRM que usan hoy en Runamatic:

```
Archivo recibido → Archivo con error (el cliente debe contactarse / reenviar)
→ Cotizado (precio y medida visibles para el cliente)
→ Impreso                      ← NO "imprimiendo": el cliente lee "imprimiendo" y sale a buscarlo
→ En proceso de calandra        ← solo Sublimación/Calandra: primero se imprime y después se calandra
→ Terminado / listo para retirar
→ Entregado
```

- Cada sector define su propia secuencia de estados.
- Los pasos son obligatorios y no se pueden saltear (pedido explícito de Ricardo y Verónica). El empleado no puede avanzar sin completar el paso anterior: por ejemplo, no puede marcar "Impreso" sin haber cotizado. Hoy los procesos se pierden apenas Verónica deja de supervisar una semana.
- El avance tiene que ser lo más automático posible: botones grandes de un clic y transiciones automáticas cuando aplique. Si cuesta trabajo, los empleados no lo van a usar.
- En la ficha de la orden, el empleado puede editar la medida, el precio y la descripción; el cliente los ve.

### 2.5 Cerrar caminos al cliente (nuevo)

Con el link de Telegram, un cliente generó 17 pedidos duplicados. La app tiene que impedir duplicados y acciones inválidas:

- Una orden nace del mail o de una carga autorizada, nunca de un "hola".
- Límites de acciones por cliente.
- Validaciones en cada paso.

### 2.6 Notificaciones (ajusta E1.5)

- Canal principal: push de la app. Respaldo: email, que es gratis.
- No se usan plantillas pagas de WhatsApp. Verónica: "gastar USD 200 en menos de 10 días" no es aceptable.
- El costo o total tiene que verse en el seguimiento, para que el cliente no tenga que preguntarlo por otro lado.

### 2.7 Etapa 2 rediseñada: "Ayuda en la app + WhatsApp de soporte"

Reemplaza a la E2 de SPEC.md. Debe ser más liviana, para llegar antes a la Etapa 3.

En la app (PWA):

- Sección de preguntas frecuentes.
- Listas de precios en imagen o tabla por sistema (por ejemplo "precio de lonas").
- Instructivos de cómo enviar archivos y requisitos.
- Horarios y dirección.
- Consulta del estado y el precio de cada orden.
- Asistente dentro de la app (opcional, a confirmar): responde solo con la información cargada, con un alcance muy limitado. El bot actual de Runamatic "se toma atribuciones": por ejemplo, le prometió a un cliente cambiar su pedido de local. El asistente nunca promete ni modifica nada. Ante dudas, deriva.
- Ezequiel mencionó que con un buen servidor se podría usar una IA local para bajar costos. Evaluar; no es requisito.

WhatsApp: un solo número en la API oficial, con bandeja unificada. Es solo para soporte, reclamos, postventa y clientes nuevos que necesitan un asesor. Los contactos tienen que estar unificados (hoy Runamatic muestra el mismo cliente tres veces, una por sector).

Opcional, a evaluar: un chat interno de la app entre el cliente y el negocio, como alternativa propia a WhatsApp y sin costo por mensaje.

### 2.8 Etapa 3: ajustes

- El stock es "lo más importante del negocio". No lo tienen controlado desde hace 10 años. Prioridad alta dentro de la E3.
- Cajas dentro de cajas: por ejemplo, 1 caja = 12 tazas. Usar una jerarquía de unidades genérica; es el mismo concepto que R-STK-2, pero anidable.
- Pago mixto con puntos: una venta de $1.000 se paga con $900 en puntos y $100 en efectivo, en una sola operación en el POS.
- Cuentas corrientes: pocas, 3 o 4 clientes grandes (por ejemplo el dueño del local, que hace cartelería y compensa con el alquiler). Simple, sin sobreingeniería.
- Conciliación bancaria: queda a evaluar. Interbanking tiene costo mensual externo. Primero estimar cuánto trabajo le ahorra a las 2 personas de administración. Por defecto: carga o importación manual de extractos.
- Usabilidad del POS: Verónica no factura en Tango porque le resulta "lento y rústico". La facturación tiene que ser muy intuitiva. A ella le gusta definir cómo se ven las pantallas, así que conviene validar los mockups con ella antes de programar.

### 2.9 Etapa 4: ajustes

- Tienda Nube desaparece. Se hacen tiendas propias a medida.
- Hay tiendas externas creadas por Ricardo (por ejemplo la de Arjet) que tienen que conectarse al stock central. Pedirle a Ricardo el stack, el hosting y los accesos de cada una.
- Pedidos centralizados: el personal que prepara pedidos recibe en un solo lugar los de todas las tiendas.
- El stock es uno solo entre producción (consumo por metro al imprimir) y venta (vinilo sin imprimir por metro en la tienda).
- La recepción de trabajos de impresión va por la app, no por la web. La web es solo para compras de insumos.

### 2.10 Fidelización

- Los puntos se acreditan automáticamente desde la facturación. Hoy un empleado tiene que entrar a otra web y cargarlos a mano.
- Se usan como medio de pago parcial (ver 2.8). El saldo se ve en la app.

### 2.11 Infraestructura

- Ya tienen un servidor propio y mueven muchas imágenes. Evaluar si se usa ese servidor o un VPS de APOC.
- Retención de archivos: 1 mes. Pasado ese plazo se borran (job programado). Guardan un mes solo para reclamos.
- Dos locales hoy, que se unifican en el local nuevo. El sistema tiene que quedar abierto a sumar sucursales en el futuro ("no nos quedamos quietos").

## 3. Personas y fuentes de información

| Persona | Rol | Consultarle sobre |
| --- | --- | --- |
| Ricardo (Rick) | Socio y dueño | Gran Formato (vinilos, lonas), tiendas externas que armó él, stock y precios por proveedor |
| Verónica Rabadan Martín | Socia y esposa | Textil: DTF, Sublimación, Calandra. Atención al cliente, procesos operativos, UX del POS |

- Cada uno maneja su área por separado, así que hay que preguntarle a quien corresponda. Esto puede demorar algunas respuestas.
- Verónica va a mandar ideas por el grupo de WhatsApp sobre la marcha. Hay que registrarlas en un backlog y no implementarlas sin priorizar.

## 4. Riesgos y expectativas

- **Confianza baja**: ya fracasaron con Runamatic, Tango, Fidely, Lomasoft y Flexus. Cada entrega tiene que funcionar en producción y mostrarse en la reunión semanal.
- **Miedo a sobrecostos**: no quieren escuchar "esto no está en el presupuesto". Criterio acordado en la llamada: los ajustes chicos dentro del alcance se hacen sin costo; los cambios grandes se conversan con transparencia (plazo y costo) antes de hacerlos. Ver §7.
- **Plazos**: prometer de más en tiempo y entregar antes.
- **Adopción por empleados**: si el sistema suma pasos, no lo usan. Hay que reducir clics y forzar el proceso.
- **Educación del cliente final**: al principio va a costar que usen la app. Incluir en la app y en los mails un onboarding simple con el link de instalación.

## 5. Prioridades revisadas

1. **E1**: App de clientes + seguimiento + revisión automática del archivo + alta y número de cliente. Es lo más urgente.
2. **E2 liviana**: FAQ, precios e instructivos en la app, más WhatsApp único de soporte.
3. **E3**: stock (prioridad), POS intuitivo, facturación ARCA y puntos integrados.
4. **E4**: tiendas propias y conexión de las tiendas externas al stock central.

## 6. Pendientes accionables

- [ ] APOC: confirmar la fecha de inicio (posible la semana que viene, cupo de noviembre).
- [ ] APOC: crear el grupo de WhatsApp con Verónica y Ricardo.
- [ ] APOC: compartir contactos de clientes como referencia (lo ofreció Ezequiel).
- [ ] Cliente: exportar datos de clientes desde Runamatic y Tango.
- [ ] Cliente: accesos a las casillas de Hostinger por sector.
- [ ] Ricardo: stack, hosting y accesos de las tiendas externas (Arjet y otras).
- [ ] Ricardo: listado de productos, variantes y fórmulas de consumo (pendiente desde el 16/11).
- [ ] Verónica: capturas del CRM actual de Runamatic por sector, con sus estados.
- [ ] Definir con Verónica el texto de las FAQ e instructivos y las imágenes de precios.
- [ ] Evaluar el costo de Interbanking frente al ahorro en administración.

## 7. Gestión de cambios (para el equipo de desarrollo)

- Toda idea nueva va al backlog con su etiqueta: `dentro-de-alcance`, `ajuste-menor` o `cambio-grande`.
- `ajuste-menor`: se implementa si no compromete la etapa en curso.
- `cambio-grande`: Ezequiel lo conversa con el cliente (plazo y costo) antes de programarlo.
- No implementar pedidos que lleguen por el grupo de WhatsApp sin que Ezequiel los priorice.
