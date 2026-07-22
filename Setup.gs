/**
 * ============================================================================
 *  Setup.gs  ·  Prepara la estructura del Google Sheet. NO toca el de Make.
 *
 *  Dos flujos, según cómo montes el proyecto:
 *
 *   A) CONTAINER-BOUND (recomendado): creas el Sheet a mano → Extensiones →
 *      Apps Script → subes los archivos → corres prepararHojaActual().
 *      El script queda pegado a ese sheet y lo usa automáticamente.
 *
 *   B) STANDALONE: corres crearSheetNuevo() y el script crea el archivo por ti
 *      y guarda su ID en las Propiedades del script.
 * ============================================================================
 */

// Encabezados del sheet, en el orden EXACTO que espera CONFIG.COL.
var HEADERS_SHEET_ = [
  'title',       // A
  'description', // B
  'link',        // C
  'pubDate',     // D
  'source',      // E
  'guid',        // F
  'status',      // G  (no la usa el script; se deja por paridad/manual)
  'Notificado',  // H  (columna de control de este proyecto)
];

/**
 * Crea un Spreadsheet nuevo con la pestaña y encabezados correctos, aplica
 * formato y guarda su ID en las Propiedades del script para que TODO el
 * proyecto lo use automáticamente. Correr UNA sola vez.
 */
function crearSheetNuevo() {
  var props = PropertiesService.getScriptProperties();
  var yaExiste = props.getProperty('SPREADSHEET_ID');
  if (yaExiste) {
    Logger.log('Ya hay un sheet configurado (ID: ' + yaExiste + ').');
    Logger.log('Si quieres crear otro, corre primero olvidarSheet() para desligarlo.');
    return yaExiste;
  }

  // 1) Crear el archivo y preparar la pestaña.
  var ss = SpreadsheetApp.create(CONFIG.NEW_SHEET.SPREADSHEET_NAME);
  var sheet = ss.getSheets()[0];
  sheet.setName(CONFIG.SHEET_NAME);

  // 2) Estructura + formato (helper compartido).
  aplicarEstructura_(sheet);

  // 3) Guardar el ID para auto-wiring de todo el proyecto.
  props.setProperty('SPREADSHEET_ID', ss.getId());

  Logger.log('✅ Sheet nuevo creado y configurado:');
  Logger.log('   Nombre: ' + CONFIG.NEW_SHEET.SPREADSHEET_NAME);
  Logger.log('   Pestaña: ' + CONFIG.SHEET_NAME);
  Logger.log('   ID: ' + ss.getId());
  Logger.log('   URL: ' + ss.getUrl());
  Logger.log('El proyecto ya lo usará automáticamente (guardado en Propiedades).');
  return ss.getId();
}

/**
 * FLUJO CONTAINER-BOUND: usa esto cuando TÚ ya creaste el Google Sheet a mano
 * y subiste el script desde Extensiones → Apps Script de ese mismo sheet.
 * Toma la pestaña activa (o crea/renombra la correcta), le pone encabezados y
 * formato, y NO crea ningún archivo nuevo. Correr UNA sola vez.
 */
function prepararHojaActual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No hay spreadsheet activo. Esta función es para el flujo ' +
                    'container-bound (script creado desde el propio Sheet). ' +
                    'Si es standalone, usa crearSheetNuevo().');
  }

  // Busca la pestaña con el nombre esperado; si no existe, renombra la activa.
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.getActiveSheet();
    sheet.setName(CONFIG.SHEET_NAME);
  }

  aplicarEstructura_(sheet);

  Logger.log('✅ Hoja preparada en el sheet activo:');
  Logger.log('   Nombre: ' + ss.getName());
  Logger.log('   Pestaña: ' + CONFIG.SHEET_NAME);
  Logger.log('   URL: ' + ss.getUrl());
  Logger.log('Como el script es container-bound, ya usa este sheet automáticamente.');
  return ss.getId();
}

/**
 * Escribe encabezados y aplica formato a una hoja dada. Idempotente:
 * puedes correrlo sobre una hoja ya preparada sin romper datos existentes.
 */
function aplicarEstructura_(sheet) {
  var n = HEADERS_SHEET_.length;

  // Encabezados.
  sheet.getRange(1, 1, 1, n).setValues([HEADERS_SHEET_]);

  // Formato del encabezado.
  sheet.getRange(1, 1, 1, n)
       .setFontWeight('bold')
       .setBackground('#0b5394')
       .setFontColor('#ffffff')
       .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 28);

  // Anchos de columna razonables.
  sheet.setColumnWidth(CONFIG.COL.TITLE, 300);
  sheet.setColumnWidth(CONFIG.COL.DESC, 380);
  sheet.setColumnWidth(CONFIG.COL.LINK, 260);
  sheet.setColumnWidth(CONFIG.COL.PUBDATE, 110);
  sheet.setColumnWidth(CONFIG.COL.SOURCE, 160);
  sheet.setColumnWidth(CONFIG.COL.GUID, 120);
  sheet.setColumnWidth(CONFIG.COL.STATUS, 90);
  sheet.setColumnWidth(CONFIG.COL.NOTIFICADO, 170);

  // Formato de fecha para la columna pubDate (D).
  sheet.getRange(2, CONFIG.COL.PUBDATE, sheet.getMaxRows() - 1, 1)
       .setNumberFormat('yyyy-mm-dd');
}

/**
 * Desliga el sheet actual de las Propiedades del script (NO borra el archivo).
 * Úsalo si necesitas crear otro con crearSheetNuevo().
 */
function olvidarSheet() {
  PropertiesService.getScriptProperties().deleteProperty('SPREADSHEET_ID');
  Logger.log('Sheet desligado de Propiedades (el archivo sigue en tu Drive).');
}

/**
 * Muestra a qué sheet está apuntando el proyecto ahora mismo.
 */
function verSheetActual() {
  try {
    var ss = getSpreadsheet_();
    Logger.log('Apuntando a: ' + ss.getName() + '\n' + ss.getUrl());
  } catch (e) {
    Logger.log('Aún no hay sheet configurado: ' + e.message);
  }
}

/**
 * SIEMBRA la hoja con lo que devuelvan los RSS AHORA MISMO, pero SIN notificar.
 * Sirve para que el primer arranque no dispare una avalancha de WhatsApp.
 * Después de esto, solo las notas realmente nuevas se notificarán.
 */
function sembrarSinNotificar() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SEED_MODE', '1');
  try {
    actualizarNotasVicente(); // corre la ingesta en modo siembra
  } finally {
    props.deleteProperty('SEED_MODE');
  }
  Logger.log('Siembra terminada. SEED_MODE desactivado: a partir de ahora SÍ se notifica.');
}
