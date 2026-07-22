/**
 * ============================================================================
 *  Activacion.gs  ·  Envía la plantilla aprobada de WhatsApp a los
 *                    destinatarios fijos, todos los días a la hora configurada.
 *
 *  Por qué existe: las noticias van como TEXTO LIBRE y WhatsApp solo las
 *  entrega si la ventana de 24 h del destinatario está abierta. Esa ventana
 *  se abre cuando la persona RESPONDE a un mensaje del negocio. La plantilla
 *  aprobada SÍ se entrega aunque la ventana esté cerrada, así que la mandamos
 *  cada mañana para que la persona responda una vez y quede abierta el día.
 *
 *  (No usa hoja de suscriptores: manda a los mismos CONFIG.RECIPIENTS.)
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  Función que corre el disparador diario.
// ---------------------------------------------------------------------------
function enviarActivacionDiaria() {
  if (!CONFIG.ACTIVACION.ENABLED) {
    Logger.log('Activación deshabilitada en CONFIG.');
    return;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Activación: run en curso.'); return; }

  try {
    var secrets = getTwilioSecrets_();
    var fallidos = [];

    CONFIG.RECIPIENTS.forEach(function (rcpt) {
      var ok = enviarWhatsAppTemplate_(
        rcpt.to,
        CONFIG.ACTIVACION.CONTENT_SID,
        CONFIG.ACTIVACION.CONTENT_VARIABLES,
        secrets
      );
      if (!ok) fallidos.push(rcpt.name);
      Utilities.sleep(CONFIG.SLEEP_MS_ENTRE_ENVIOS);
    });

    Logger.log(fallidos.length === 0
      ? 'Activación enviada a todos.'
      : 'Activación falló para: ' + fallidos.join(', '));

  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
//  Envío por Twilio usando PLANTILLA aprobada (ContentSid).
//  Se entrega aun fuera de la ventana de 24 h de WhatsApp.
// ---------------------------------------------------------------------------
function enviarWhatsAppTemplate_(to, contentSid, contentVariables, secrets) {
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' +
            secrets.accountSid + '/Messages.json';

  var payload = {
    To: to,
    MessagingServiceSid: CONFIG.TWILIO.MESSAGING_SERVICE_SID,
    ContentSid: contentSid,
  };
  if (contentVariables && Object.keys(contentVariables).length > 0) {
    payload.ContentVariables = JSON.stringify(contentVariables);
  }

  var options = {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Basic ' +
        Utilities.base64Encode(secrets.accountSid + ':' + secrets.authToken),
    },
    payload: payload,
  };

  try {
    var resp = UrlFetchApp.fetch(url, options);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) return true;
    Logger.log('Twilio plantilla ' + to + ' HTTP ' + code + ': ' + resp.getContentText());
    return false;
  } catch (e) {
    Logger.log('Excepción Twilio plantilla ' + to + ': ' + e);
    return false;
  }
}

// ---------------------------------------------------------------------------
//  Prueba manual de la plantilla.
// ---------------------------------------------------------------------------
function pruebaActivacion() {
  enviarActivacionDiaria();
}
