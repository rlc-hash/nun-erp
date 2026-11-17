# Cobranza por WhatsApp — plan, plantillas y pasos para conectar

> Este repo puede ser público: aquí NO van números de clientes, CLABEs ni montos reales.
> Las cuentas para depositar y los WhatsApp de los clientes se guardan en el sistema (Supabase), no aquí.
> Cómo platica el agente con los clientes: `whatsapp/AGENTE_COBRANZA.md`.

## Estado (17 nov 2026)

| Parte | Estado |
|---|---|
| ERP: pantalla 📲 WhatsApp cobranza (contactos, estados de cuenta, mensajes, ajustes) | ✅ hecho (v5.05, servidor v0.9.21) |
| Aviso automático al registrar un pago (con complemento si lo lleva) | ✅ se prepara solo; queda "esperando conexión" |
| Estado de cuenta semanal (solo principales que deben) | ✅ se prepara con un botón; queda "esperando conexión" |
| Textos de los mensajes (plantillas) | ✅ listos abajo; falta darlos de alta en Meta y que los aprueben |
| Forma de contestar del agente | ✅ borrador en `AGENTE_COBRANZA.md`, falta el OK de Rafa |
| Línea (SIM) | ✅ Rafa ya la tiene |
| Meta Business verificado + app de WhatsApp + número dado de alta | ⏳ lo hace Rafa (pasos abajo) |
| Servidor: mandar por Meta, recibir respuestas, platicar con Claude | ⏳ se hace en cuanto haya número de prueba en Meta (necesita sus claves para probar de verdad) |
| Clave de Claude (Anthropic) | ⏳ Rafa la saca; se escribe en el formulario seguro, nunca en el chat |

## Cómo va a funcionar

```
Cliente  ↔  WhatsApp (Meta, servicio oficial "Cloud API")  ↔  servidor NUN (Supabase)  ↔  Cobranza / Facturas / Claude
```

Sin intermediarios (sin Zapier ni Twilio): solo se paga lo que cobra Meta por mensaje y lo que cobra Claude.
Los PDF (estado de cuenta, complemento, recibo) se suben con `compartir_subir` (servidor supabase-2.7) y Meta los toma de esa liga.

1. **Estado de cuenta semanal**: a cada cliente principal con saldo, su estado de cuenta en PDF con todo su historial y las cuentas para depositar.
2. **Aviso de pago** (como American Express): al registrar un pago en el ERP.
   - Factura **PPD**: le llega el **complemento de pago** (PDF + botón para bajar el XML) en cuanto se timbra (el timbrado lo sigue confirmando Rafa).
   - **PUE / remisión / pedido**: no llevan complemento (el SAT no lo pide): le llega un **recibo de pago** con lo que pagó y lo que le falta.
3. **Plática**: si el cliente contesta, el agente platica con sus datos reales (ver `AGENTE_COBRANZA.md`).

## Reglas de WhatsApp que afectan el diseño

- El negocio solo puede **iniciar** la plática con **plantillas aprobadas por Meta**. Si el cliente contesta, durante 24 horas se platica libre.
- Una plantilla lleva **un PDF**. El **XML** va como botón "Descargar XML" (liga a nuestro servidor).
- Los datos que cambian ({{1}}, {{2}}…) no pueden llevar saltos de línea. **Las cuentas para depositar van como DATO** (en una línea,
  separadas con ·): así Rafa las cambia en 📲 WhatsApp → Ajustes cuando se renuevan, **sin volver a aprobar la plantilla**.
- Categoría de todas: **Utilidad** (avisos de cuenta y pagos; más baratas que Marketing). Idioma: Español (MEX).

## Plantillas (para dar de alta en Meta → Administrador de WhatsApp → Plantillas de mensajes)

### 1. `nun_estado_cuenta` — estado de cuenta semanal
- Encabezado: **Documento** (PDF)
- Cuerpo:
```
Hola {{1}}, te compartimos tu estado de cuenta de NUN al {{2}}.

Saldo pendiente: {{3}}
Vencido: {{4}}

Puedes depositar o transferir a: {{5}}

Si ya pagaste, mándanos tu comprobante por aquí y lo aplicamos. ¡Gracias!
```
- Pie: `Comercializadora Casraf · NUN`
- Botones (respuesta rápida): `Ya pagué` · `Tengo una duda`
- Ejemplo para Meta: Juan · 17 nov 2026 · $12,500.00 · $4,000.00 · BBVA · Comercializadora Casraf · CLABE 000000000000000000

### 2. `nun_pago_complemento` — pago de factura PPD (con complemento)
- Encabezado: **Documento** (PDF del complemento)
- Cuerpo:
```
Hola {{1}}, recibimos tu pago de {{2}} del {{3}}, aplicado a {{4}}. ¡Gracias!

Te adjuntamos tu complemento de pago (CFDI) {{5}}.
Saldo de esa factura: {{6}}
```
- Pie: `Comercializadora Casraf · NUN`
- Botón (liga dinámica): `Descargar XML` → `https://vlqbzfotjltarelwenvu.supabase.co/functions/v1/nun?pdf={{1}}`
- Ejemplo: Juan · $1,160.00 · 17 nov 2026 · la factura FT0012 · CP0007 · $0.00

### 3. `nun_pago_recibido` — pago sin complemento (PUE, remisión, pedido)
- Encabezado: **Documento** (PDF del recibo)
- Cuerpo:
```
Hola {{1}}, recibimos tu pago de {{2}} del {{3}}, aplicado {{4}}. ¡Gracias!

Saldo pendiente con NUN: {{5}}
```
- Pie: `Comercializadora Casraf · NUN`
- Ejemplo: Juan · $4,000.00 · 17 nov 2026 · al pedido P0201 · $11,000.00

### 4. `nun_recordatorio_vencido` — recordatorio a los que deben
- Encabezado: texto `Recordatorio de pago`
- Cuerpo:
```
Hola {{1}}, te escribimos de NUN. Tienes un saldo vencido de {{2}} ({{3}}).

¿Nos ayudas con una fecha de pago? Puedes contestar aquí mismo.

Puedes depositar o transferir a: {{4}}
```
- Pie: `Si ya pagaste, mándanos tu comprobante y lo aplicamos.`
- Botones (respuesta rápida): `Ya pagué` · `Pago esta semana` · `Hablar con alguien`

### 5. `nun_recordatorio_por_vencer` — aviso amable antes de que venza (opcional)
- Cuerpo:
```
Hola {{1}}, te recordamos que el {{2}} vence tu pago de {{3}} ({{4}}) con NUN.

Puedes depositar o transferir a: {{5}}

¡Gracias!
```

## Pasos de Rafa para conectar el número (en la compu)

1. **No instales WhatsApp con la SIM nueva** (ni normal ni Business). Solo tenla en un teléfono para recibir el SMS.
2. **business.facebook.com** → crear el portafolio comercial con el nombre legal **Comercializadora Casraf SA de CV**, correo de la empresa y página web.
   **Configuración → Centro de seguridad → Iniciar verificación** (Constancia de situación fiscal, comprobante de domicilio, a veces acta constitutiva).
3. **developers.facebook.com** → Mis apps → **Crear app** → tipo **Empresa**, ligada al portafolio de Casraf → **Agregar producto: WhatsApp**.
4. En WhatsApp → **Configuración de la API** → **Agregar número de teléfono**: nombre visible **NUN Cobranza**, categoría, y el código por SMS.
5. **Administrador de WhatsApp → Facturación**: agregar tarjeta.
6. **Plantillas de mensajes**: dar de alta las 5 de arriba (Claude te acompaña pantalla por pantalla).
7. Avisarle a Claude. Con eso Claude pide por **formulario seguro** el token permanente (usuario del sistema) y la clave de Claude,
   y conecta el servidor. Primero se prueba con el número de Rafa.

Mientras se verifica Meta (días), se puede probar con el número de prueba que da Meta y con el de Rafa.
