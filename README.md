# Alerta VMO — Apps Script (sin Make)

Migración completa del escenario de Make **"Alerta VMO"** a Google Apps Script.
Todo corre dentro de Apps Script: ingesta de RSS, alta de notas nuevas,
acortado de link y envío por WhatsApp (Twilio) a los destinatarios fijos.

## Equivalencia con Make

| Módulo de Make | Reemplazo en Apps Script |
|---|---|
| `google-sheets: watchRows` | Se elimina. Notificamos **dentro** de la ingesta, así las filas históricas nunca se re-notifican. |
| `tny: Shorten` (TinyURL) | `acortarUrl_()` en `Notificador.gs` |
| `twilio: SendSMS` (JuanJo) | `enviarWhatsApp_()` sobre `CONFIG.RECIPIENTS` |
| `twilio: SendSMS` (VMO) | `enviarWhatsApp_()` sobre `CONFIG.RECIPIENTS` |

> **Nota de mapeo:** los índices del mapper de Make (`{{1.\`2\`}}`, `{{1.\`4\`}}`)
> apuntaban a un layout viejo del sheet. Aquí se mapea **por significado**
> contra el layout real: `A=title · B=description · C=link · D=pubDate ·
> E=source · F=guid · G=status`. El mensaje usa `source` (E) para
> "Mención publicada en", `title` (A) para el titular y `link` (C) para acortar.

## Archivos

- `Config.gs` — toda la configuración (sheet, columnas, destinatarios, Twilio, activación, feeds).
- `Setup.gs` — prepara la estructura del sheet: `prepararHojaActual()` (container-bound) o `crearSheetNuevo()` (standalone), más `sembrarSinNotificar()`.
- `Ingesta.gs` — **función principal** `actualizarNotasVicente()`: lee RSS, agrega A:F y notifica cada nota nueva.
- `Notificador.gs` — TinyURL + Twilio, idempotencia por columna H, `reintentarPendientes()`, `pruebaEnvio()`.
- `Activacion.gs` — activación **local deshabilitada**; lo diario lo hace el hub `ActivacionAlertasWhatsApp`.
- `Secretos.gs` — lectura de credenciales desde Script Properties.
- `Disparadores.gs` — instalar/eliminar triggers.
- `appsscript.json` — manifest (zona horaria `America/Mexico_City`, runtime V8).

## Puesta en marcha (crear el Sheet → Extensiones → Apps Script)

1. **Crea el Google Sheet nuevo** a mano, desde tu Drive (hoja en blanco).
   No hace falta que le pongas encabezados; el paso 4 lo hace por ti.
2. **Abre el editor:** en ese sheet, menú **Extensiones → Apps Script**.
   Esto crea un proyecto *pegado* a ese sheet (container-bound), así el script
   usará ese sheet automáticamente y **nunca toca el de Make**.
3. **Sube los archivos** del proyecto (clasp `push`, o pega cada `.gs` y el
   `appsscript.json` en el editor). Deja `CONFIG.SPREADSHEET_ID` vacío (`''`).
4. **Prepara la estructura:** ejecuta `prepararHojaActual()` y autoriza los
   permisos. Renombra la pestaña a `NOTAS ENVIADAS VICENTEMARTINEZ` y escribe
   los encabezados con formato (`title · description · link · pubDate · source ·
   guid · status · Notificado`).
5. **Guarda los secretos** (una vez): abre `Secretos.gs`, rellena
   `guardarSecretos()`, ejecútala y **borra los valores** después. O ponlos a
   mano en *Configuración del proyecto → Propiedades del script*:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TINYURL_TOKEN` (opcional)
6. **Siembra sin notificar (recomendado):** ejecuta `sembrarSinNotificar()`.
   Llena el sheet con lo que devuelvan los RSS ahora mismo, marcándolas como
   `sembrada`, **sin mandar WhatsApp**. Así el primer arranque real no dispara
   una avalancha; solo se notifican las notas nuevas que lleguen después.
7. **Prueba envíos:** `pruebaEnvio()` (noticia de prueba) y `pruebaActivacion()`
   (plantilla). Confirma que `CONFIG.ACTIVACION.CONTENT_SID` sea la plantilla
   correcta (por defecto reusa `activacionserviciodealertas`).
8. **Automatiza:**
   - `instalarTriggerIngesta()` — ingesta + noticias, cada 15 min.
   - ~~`instalarTriggerActivacionDiaria()`~~ — **ya no**: usar hub `ActivacionAlertasWhatsApp`.
     Ejecuta `eliminarTriggerActivacionDiaria()` una vez para quitar el trigger viejo.
   - `instalarTriggerReintento()` — opcional, cada hora, recupera PENDIENTES.
9. **Apaga el escenario de Make.**

### Alternativa: proyecto standalone

Si prefieres un proyecto *no* pegado a un sheet (creado desde
script.google.com), salta los pasos 1–2 y 4, y en su lugar ejecuta
`crearSheetNuevo()`: el script crea el archivo con estructura y formato y guarda
su ID en las Propiedades para usarlo solo. El resto de pasos es igual.

> Utilidades: `verSheetActual()` muestra a qué sheet apunta el proyecto;
> `olvidarSheet()` desliga el ID guardado (sin borrar el archivo).


## Idempotencia y columna de control

- La columna **H "Notificado"** la crea este proyecto. Se escribe:
  - un **timestamp** cuando la nota se envió a todos, o
  - `PENDIENTE (nombre)` si algún destinatario falló (recuperable con `reintentarPendientes()`).
- La columna **G "status"** se crea vacía; el script **no la usa** (queda para
  notas manuales tuyas). Las filas sembradas quedan con H = `sembrada`.
- Las notas se envían **solo** al agregarse durante un run normal; las filas
  sembradas y cualquier fila con H ya escrita jamás se re-notifican.

## Ventana de 24 h de WhatsApp

Las **noticias** van como **texto libre** vía Messaging Service (igual que Make).
WhatsApp solo entrega texto libre si la ventana de 24 h del destinatario está
abierta, y esa ventana se abre cuando la persona **responde** a un mensaje del
negocio.

Por eso la activación diaria está en el hub **`ActivacionAlertasWhatsApp`**
(un mensaje por teléfono, compartido entre Mota / Mery / VMO). En este proyecto
`CONFIG.ACTIVACION.ENABLED = false` y el módulo `Activacion.gs` queda solo para
emergencia local.

**Importante:** la plantilla llega sola, pero la ventana la abre la *respuesta*
del destinatario, no el simple envío de la plantilla. Es decir, se elimina el
tener que *recordar* escribir de cero, pero queda un toque de respuesta al día.

### Cómo eliminar por completo el toque de respuesta (opcional)

La única forma de que las noticias lleguen sin ninguna acción del destinatario
es enviarlas también como **plantilla** (no texto libre), con variables para
fuente / titular / link. Requiere crear y aprobar una plantilla de noticias en
Twilio/Meta. Si se aprueba, se cambia `enviarWhatsApp_()` por
`enviarWhatsAppTemplate_()` (ya existe en `Activacion.gs`) pasando las variables.
Con eso ya no haría falta ni la activación diaria ni la respuesta.
