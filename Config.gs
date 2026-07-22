/**
 * ============================================================================
 *  ALERTA VMO — Migración de Make a Google Apps Script
 *  Config.gs  ·  Toda la configuración vive aquí (nada de secretos en código).
 * ============================================================================
 *
 *  Reemplaza el escenario de Make "Alerta VMO":
 *    1) watchRows (Google Sheets)  -> se elimina: notificamos DENTRO de la ingesta.
 *    2) tny:Shorten (TinyURL)      -> acortarUrl_()  en Notificador.gs
 *    3) twilio:SendSMS (JuanJo)    -> enviarWhatsApp_() en Notificador.gs
 *    4) twilio:SendSMS (VMO)       -> enviarWhatsApp_() en Notificador.gs
 *
 *  Twilio Account SID y Auth Token NO van aquí: van en Propiedades del script
 *  (Proyecto > Configuración del proyecto > Propiedades del script) o con
 *  guardarSecretos() de Secretos.gs.
 * ============================================================================
 */

var CONFIG = {
  // --- Hoja de noticias ---------------------------------------------------
  // Vacío ('') a propósito: este proyecto crea su PROPIO sheet nuevo con
  // crearSheetNuevo() y guarda el ID en las Propiedades del script. Así NO se
  // toca el sheet viejo de Make. (Si algún día quieres forzar uno específico,
  // pon el ID aquí y tiene prioridad sobre el guardado.)
  SPREADSHEET_ID: '',
  SHEET_NAME: 'NOTAS ENVIADAS VICENTEMARTINEZ',
  HEADER_ROW: 1,

  // Nombre del archivo Google Sheets que crea crearSheetNuevo().
  NEW_SHEET: {
    SPREADSHEET_NAME: 'Alerta VMO — Base de Datos (Apps Script)',
  },

  // Columnas 1-indexadas (A=1). Layout REAL verificado contra tu base de datos.
  COL: {
    TITLE:      1, // A  title      (titular)
    DESC:       2, // B  description
    LINK:       3, // C  link       (se acorta y se manda)
    PUBDATE:    4, // D  pubDate
    SOURCE:     5, // E  source     ("Mención publicada en:")
    GUID:       6, // F  guid
    STATUS:     7, // G  status     (columna existente: 'procesada' — NO se toca)
    NOTIFICADO: 8, // H  columna de control que crea ESTE proyecto
  },
  NOTIFICADO_HEADER: 'Notificado',

  // --- Destinatarios (viven aquí, ya no hay hoja de suscriptores) ---------
  // El blueprint de Make de VMO manda a 2. Si quieres sumar a Matute, agrégalo.
  RECIPIENTS: [
    { name: 'JuanJo', to: 'whatsapp:+526671894103' },
    { name: 'VMO',    to: 'whatsapp:+523310251097' },
    // { name: 'Matute', to: 'whatsapp:+523333709653' },
  ],

  // --- Twilio -------------------------------------------------------------
  TWILIO: {
    // Igual que en Make (fromType: service). El SID del Messaging Service NO
    // es secreto; Account SID y Auth Token SÍ y van en Script Properties.
    MESSAGING_SERVICE_SID: 'MG405f1b841492e8ee5d2b5ee51855afd4',
  },

  // --- Activación diaria (plantilla aprobada de WhatsApp) -----------------
  // La plantilla LLEGA sola aunque la ventana de 24 h esté cerrada. Sirve para
  // que el destinatario responda una vez al día y así abrir su ventana, para
  // que las noticias (texto libre) le puedan entrar ese día.
  ACTIVACION: {
    ENABLED: true,
    // Content SID de la plantilla aprobada en Twilio.
    // Por defecto reusa "activacionserviciodealertas" (misma cuenta Twilio).
    // CONFÍRMALO / reemplázalo si tienes una plantilla propia de VMO.
    CONTENT_SID: 'HX33eb5d99fbeb564bc3de1bed200318a8',
    // Variables de la plantilla, si tuviera. Ej: {"1": "Nombre"}. Vacío = sin variables.
    CONTENT_VARIABLES: {},
    // Hora local (America/Mexico_City) del disparador diario.
    HORA_ENVIO: 8,
  },

  // --- Acortador de links -------------------------------------------------
  SHORTEN_URL: true, // usa TinyURL; si falla, cae al link original.

  // --- Comportamiento -----------------------------------------------------
  MAX_PER_RUN: 40,        // tope anti-avalancha de envíos por ejecución
  SLEEP_MS_ENTRE_ENVIOS: 400,

  // --- Feeds RSS (Google News) — idénticos a tu Apps Script actual --------
  RSS_FEEDS: [
    { name: 'vicente martínez orozco - 1h (acento)',
      url: 'https://news.google.com/rss/search?q=vicente%20mart%C3%ADnez%20orozco%20when%3A1h&hl=es-419&gl=MX&ceid=MX%3Aes-419',
      maxAgeHours: 1 },
    { name: 'vicente martínez orozco - 24h (acento)',
      url: 'https://news.google.com/rss/search?q=vicente%20mart%C3%ADnez%20orozco%20when%3A1d&hl=es-419&gl=MX&ceid=MX%3Aes-419',
      maxAgeHours: 24 },
    { name: 'vicente martinez orozco - 1h',
      url: 'https://news.google.com/rss/search?q=vicente%20martinez%20orozco%20when%3A1h&hl=es-419&gl=MX&ceid=MX%3Aes-419',
      maxAgeHours: 1 },
    { name: 'vicente martinez orozco - 24h',
      url: 'https://news.google.com/rss/search?q=vicente%20martinez%20orozco%20when%3A1d&hl=es-419&gl=MX&ceid=MX%3Aes-419',
      maxAgeHours: 24 },
    { name: 'martínez y de labra abogados - 1h (acento)',
      url: 'https://news.google.com/rss/search?q=mart%C3%ADnez%20y%20de%20labra%20abogados%20when%3A1h&hl=es-419&gl=MX&ceid=MX%3Aes-419',
      maxAgeHours: 1 },
    { name: 'martínez y de labra abogados - 24h (acento)',
      url: 'https://news.google.com/rss/search?q=mart%C3%ADnez%20y%20de%20labra%20abogados%20when%3A1d&hl=es-419&gl=MX&ceid=MX%3Aes-419',
      maxAgeHours: 24 },
    { name: 'martinez y de labra abogados - 1h',
      url: 'https://news.google.com/rss/search?q=martinez%20y%20de%20labra%20abogados%20when%3A1h&hl=es-419&gl=MX&ceid=MX%3Aes-419',
      maxAgeHours: 1 },
    { name: 'martinez y de labra abogados - 24h',
      url: 'https://news.google.com/rss/search?q=martinez%20y%20de%20labra%20abogados%20when%3A1d&hl=es-419&gl=MX&ceid=MX%3Aes-419',
      maxAgeHours: 24 },
  ],
};

/**
 * Devuelve el Spreadsheet a usar, en este orden de prioridad:
 *   1) CONFIG.SPREADSHEET_ID (si lo defines a mano, manda).
 *   2) El ID guardado por crearSheetNuevo() en las Propiedades del script.
 *   3) El spreadsheet activo (caso container-bound).
 */
function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  var stored = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (stored) {
    return SpreadsheetApp.openById(stored);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No hay sheet configurado. Corre crearSheetNuevo() una vez, ' +
                    'o define CONFIG.SPREADSHEET_ID.');
  }
  return ss;
}

function getSheet_() {
  var sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("No existe la hoja '" + CONFIG.SHEET_NAME + "'.");
  return sheet;
}
