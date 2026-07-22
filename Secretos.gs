/**
 * ============================================================================
 *  Secretos.gs  ·  Credenciales en Script Properties (NUNCA en código).
 * ============================================================================
 *
 *  Propiedades esperadas (Proyecto > Configuración del proyecto > Propiedades):
 *    TWILIO_ACCOUNT_SID   ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    TWILIO_AUTH_TOKEN    (tu token — rótalo si alguna vez se expuso)
 *    TINYURL_TOKEN        (opcional; si no está, se usa el TinyURL libre)
 * ============================================================================
 */

function getTwilioSecrets_() {
  var props = PropertiesService.getScriptProperties();
  var accountSid = props.getProperty('TWILIO_ACCOUNT_SID');
  var authToken  = props.getProperty('TWILIO_AUTH_TOKEN');
  if (!accountSid || !authToken) {
    throw new Error('Faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN en las ' +
                    'Propiedades del script. Córrelas con guardarSecretos() ' +
                    'o desde Configuración del proyecto.');
  }
  return { accountSid: accountSid, authToken: authToken };
}

/**
 * Utilidad de un solo uso para guardar los secretos. Rellena los valores,
 * ejecútala UNA vez, y luego BORRA los valores de aquí (o borra la función).
 */
function guardarSecretos() {
  PropertiesService.getScriptProperties().setProperties({
    TWILIO_ACCOUNT_SID: 'PON_AQUI_TU_ACCOUNT_SID',
    TWILIO_AUTH_TOKEN:  'PON_AQUI_TU_AUTH_TOKEN',
    // TINYURL_TOKEN:   'opcional',
  });
  Logger.log('Secretos guardados. Ahora borra los valores de esta función.');
}

/**
 * Crea el encabezado "Notificado" en la col H si no existe.
 */
function asegurarEncabezadoNotificado_(sheet) {
  var cell = sheet.getRange(CONFIG.HEADER_ROW, CONFIG.COL.NOTIFICADO);
  if (String(cell.getValue() || '').trim() === '') {
    cell.setValue(CONFIG.NOTIFICADO_HEADER);
  }
}
