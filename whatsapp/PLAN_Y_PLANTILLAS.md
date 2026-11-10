# Cobranza por WhatsApp — plan y plantillas (borrador para que Rafa revise)

Estado: **borrador**. Nada de esto manda mensajes todavía. Falta: línea nueva, Meta Business verificado,
app de WhatsApp en developers.facebook.com, método de pago en Meta y clave de Claude.

> Este repo puede ser público: aquí NO van números de clientes, CLABEs ni montos reales.
> Las cuentas para depositar y los WhatsApp de los clientes se guardan en el sistema (Supabase), no aquí.

## Cómo va a funcionar

```
Cliente  ↔  WhatsApp (Meta, servicio oficial "Cloud API")  ↔  servidor NUN (Supabase)  ↔  Cobranza / Facturas / Claude
```

Sin intermediarios (sin Zapier ni Twilio): solo se paga lo que cobra Meta por mensaje y lo que cobra Claude.

### Las 3 partes

1. **Estado de cuenta semanal** (el día y la hora que diga Rafa): a cada cliente con saldo le llega su estado de cuenta
   en PDF (el mismo de Cobranza → 📄 Estado de cuenta) con las cuentas para depositar.
2. **Aviso de pago recibido** (como American Express): cuando se registra un pago en el ERP, al cliente le llega el aviso.
   - Factura **PPD**: le llega el **complemento de pago** (PDF) en cuanto se timbra. Se manda al timbrar, no antes:
     el timbrado lo sigue confirmando Rafa como siempre.
   - Factura **PUE** o **remisión**: no llevan complemento (el SAT no lo pide); le llega un **recibo de pago** con lo que pagó y lo que le falta.
3. **Plática con morosos**: recordatorio a los vencidos; si contestan, Claude platica con sus datos reales
   (saldo, documentos, cuentas). Si dicen "ya pagué" y mandan comprobante → queda en **pagos por verificar**
   (la misma bandeja de los vendedores) y Rafa lo confirma. El agente NUNCA registra pagos, ni da descuentos ni plazos:
   eso lo pasa a Rafa o Yazmín.

### Reglas de WhatsApp que afectan el diseño

- El negocio solo puede **iniciar** la plática con **plantillas aprobadas por Meta** (las de abajo). Si el cliente
  contesta, durante 24 horas se puede platicar libre.
- En una plantilla se puede adjuntar **un PDF**. El **XML** del complemento no cabe en la plantilla: va como botón
  "Descargar XML" (liga a nuestro servidor), o se manda como archivo si el cliente contesta.
- Las partes que cambian ({{1}}, {{2}}…) no pueden llevar saltos de línea. Por eso las cuentas para depositar van
  **fijas en el texto** de la plantilla: si cambian, se vuelve a aprobar la plantilla (1–2 días).
- Categoría de todas: **Utilidad** (avisos de cuenta y pagos; más baratas que las de Marketing).

## Plantillas (para mandar a aprobar a Meta)

Idioma: Español (MEX). `[BANCO]`, `[TITULAR]`, `[CLABE]`, `[CUENTA]` = los datos que dé Rafa (se llenan al darlas de alta en Meta).

### 1. `nun_estado_cuenta` — estado de cuenta semanal
- Encabezado: **Documento** (PDF del estado de cuenta)
- Cuerpo:

```
Hola {{1}}, te compartimos tu estado de cuenta de NUN al {{2}}.

Saldo pendiente: {{3}}
Vencido: {{4}}

Puedes depositar o transferir a:
[BANCO] · [TITULAR]
CLABE: [CLABE]
Cuenta: [CUENTA]

Si ya pagaste, mándanos tu comprobante por aquí y lo aplicamos. ¡Gracias!
```
- Pie: `Comercializadora Casraf · NUN`
- Botones (respuesta rápida): `Ya pagué` · `Tengo una duda`
- Ejemplo: {{1}} = Juan, {{2}} = 16 nov 2026, {{3}} = $12,500.00, {{4}} = $4,000.00

### 2. `nun_pago_complemento` — pago recibido de factura PPD (con complemento)
- Encabezado: **Documento** (PDF del complemento de pago)
- Cuerpo:

```
Hola {{1}}, recibimos tu pago de {{2}} del {{3}}, aplicado a la factura {{4}}. ¡Gracias!

Te adjuntamos tu complemento de pago (CFDI).
Saldo de esa factura: {{5}}
```
- Pie: `Comercializadora Casraf · NUN`
- Botón (liga): `Descargar XML` → `https://vlqbzfotjltarelwenvu.supabase.co/functions/v1/nun/cfdi/{{1}}` (código del archivo, no el UUID completo)

### 3. `nun_pago_recibido` — pago recibido sin complemento (PUE o remisión)
- Encabezado: **Documento** (PDF del recibo de pago)
- Cuerpo:

```
Hola {{1}}, recibimos tu pago de {{2}} del {{3}}, aplicado a {{4}}. ¡Gracias!

Saldo pendiente con NUN: {{5}}
```
- Pie: `Comercializadora Casraf · NUN`

### 4. `nun_recordatorio_vencido` — recordatorio a morosos
- Encabezado: texto `Recordatorio de pago`
- Cuerpo:

```
Hola {{1}}, te escribimos de NUN. Tienes un saldo vencido de {{2}} ({{3}}).

¿Nos ayudas con una fecha de pago? Puedes contestar aquí mismo.

Puedes depositar o transferir a:
[BANCO] · [TITULAR]
CLABE: [CLABE]
```
- Pie: `Si ya pagaste, mándanos tu comprobante y lo aplicamos.`
- Botones (respuesta rápida): `Ya pagué` · `Pago esta semana` · `Hablar con alguien`
- Ejemplo: {{3}} = "facturas FT0012 y FT0015"

### 5. `nun_recordatorio_por_vencer` — aviso amable antes de que venza (opcional)
- Cuerpo:

```
Hola {{1}}, te recordamos que el {{2}} vence tu pago de {{3}} ({{4}}) con NUN.

Puedes depositar o transferir a:
[BANCO] · [TITULAR]
CLABE: [CLABE]

¡Gracias!
```

## Lo que va en el ERP (cuando Meta esté listo)

- Clientes: campo **WhatsApp de cobranza** (puede ser distinto al teléfono del vendedor) y casilla **"No mandar WhatsApp"**.
  Cliente sin WhatsApp = sale en la lista de faltantes (no se inventa).
- Configuración: cuentas para depositar, día y hora del estado de cuenta, días para recordar a vencidos, a quién pasar la plática.
- Pantalla **📲 WhatsApp**: lista de lo que va a salir esta semana con ✅ para aprobar (las primeras semanas Rafa aprueba
  todo antes de que salga), historial de lo enviado y pláticas abiertas.
- Al timbrar un complemento / registrar un pago: sale el aviso al cliente (con opción de no mandarlo en ese pago).
- Cliente de factura (`nun_relaciones_clientes`): el estado de cuenta va al cliente principal, con todo junto.
- Nada se borra: los mensajes quedan como historial (enviado / leído / falló).

## Decisiones que faltan de Rafa

1. Cuentas para depositar (banco, titular, CLABE, cuenta).
2. Día y hora del estado de cuenta (propuesta: lunes 10:00). ¿Solo a los que deben o a todos?
3. Días después de vencido para el primer recordatorio y cada cuánto insistir (propuesta: 3 días y luego cada 7).
4. Tono: amable para todos, o más firme con los que siempre pagan tarde.
5. A quién se pasa la plática cuando el cliente pide descuento, plazo o tiene un reclamo (Rafa o Yazmín).
6. Nombre que verán los clientes en WhatsApp (propuesta: "NUN Cobranza").
