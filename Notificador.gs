/**
 * ============================================================================
 *  Notificador.gs  ·  Reemplaza los módulos TinyURL + Twilio (JuanJo y VMO).
 *
 *  notificarNota_() se llama desde la ingesta al agregar cada nota nueva.
 *  Idempotencia: escribe timestamp en la col H "Notificado" al éxito, o
 *  "PENDIENTE (...)" al fallo, para poder reintentar con reintentarPendientes().
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  Notifica UNA nota. item = { title, description, link, source }
// ---------------------------------------------------------------------------
function notificarNota_(sheet, item, rowNumber, secrets) {
  secrets = secrets || getTwilioSecrets_();

  // Evita re-notificar si la col H ya tiene algo.
  var yaMarcada = String(sheet.getRange(rowNumber, CONFIG.COL.NOTIFICADO).getValue() || '').trim();
  if (yaMarcada !== '') return;

  var shortUrl = CONFIG.SHORTEN_URL ? acortarUrl_(item.link) : item.link;
  var body = construirMensaje_(item, shortUrl);

  var res = enviarATodos_(body, secrets);

  if (res.ok) {
    sheet.getRange(rowNumber, CONFIG.COL.NOTIFICADO).setValue(new Date());
  } else {
    sheet.getRange(rowNumber, CONFIG.COL.NOTIFICADO)
         .setValue('PENDIENTE (' + res.fallidos.join(', ') + ')');
  }
}

// ---------------------------------------------------------------------------
//  Mensaje — misma plantilla que Make (mapeada por significado).
// ---------------------------------------------------------------------------
function construirMensaje_(item, shortUrl) {
  var source = (item.source || '').toString().trim();
  var title  = (item.title  || '').toString().trim();
  return '*Servicio de Alerta VMO-ML Abogados🚨*\n\n' +
         '*Mención publicada en:* ' + source + '\n\n' +
         title + '\n\n' +
         '*Ver nota completa:* ' + (shortUrl || '');
}

// ---------------------------------------------------------------------------
//  Envío a TODOS los destinatarios de CONFIG.RECIPIENTS.
//  ok=true solo si TODOS salieron bien; si alguno falla, lista los nombres.
// ---------------------------------------------------------------------------
function enviarATodos_(body, secrets) {
  var fallidos = [];
  CONFIG.RECIPIENTS.forEach(function (rcpt) {
    var r = enviarWhatsApp_(rcpt.to, body, secrets);
    if (!r.ok) fallidos.push(rcpt.name);
    Utilities.sleep(200);
  });
  return { ok: fallidos.length === 0, fallidos: fallidos };
}

// ---------------------------------------------------------------------------
//  Llamada REST a Twilio (free-form vía Messaging Service, igual que Make).
// ---------------------------------------------------------------------------
function enviarWhatsApp_(to, body, secrets) {
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' +
            secrets.accountSid + '/Messages.json';
  var options = {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Basic ' +
        Utilities.base64Encode(secrets.accountSid + ':' + secrets.authToken),
    },
    payload: {
      To: to,
      MessagingServiceSid: CONFIG.TWILIO.MESSAGING_SERVICE_SID,
      Body: body,
    },
  };

  try {
    var resp = UrlFetchApp.fetch(url, options);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) return { ok: true };
    Logger.log('Twilio ' + to + ' HTTP ' + code + ': ' + resp.getContentText());
    return { ok: false, code: code };
  } catch (e) {
    Logger.log('Excepción Twilio ' + to + ': ' + e);
    return { ok: false, error: String(e) };
  }
}

// ---------------------------------------------------------------------------
//  Acortador de URL. Usa la API v1 de TinyURL si hay token TINYURL_TOKEN en
//  Script Properties; si no, el endpoint libre. Siempre cae al link original.
// ---------------------------------------------------------------------------
function acortarUrl_(url) {
  if (!url) return url;
  var token = PropertiesService.getScriptProperties().getProperty('TINYURL_TOKEN');

  try {
    if (token) {
      var resp = UrlFetchApp.fetch('https://api.tinyurl.com/create', {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify({ url: url, domain: 'tinyurl.com' }),
      });
      if (resp.getResponseCode() === 200) {
        var data = JSON.parse(resp.getContentText());
        if (data && data.data && data.data.tiny_url) return data.data.tiny_url;
      }
    } else {
      var free = UrlFetchApp.fetch(
        'https://tinyurl.com/api-create.php?url=' + encodeURIComponent(url),
        { muteHttpExceptions: true });
      if (free.getResponseCode() === 200) {
        var short = free.getContentText().trim();
        if (/^https?:\/\//.test(short)) return short;
      }
    }
  } catch (e) {
    Logger.log('TinyURL error: ' + e);
  }
  return url; // fallback: link original
}

// ---------------------------------------------------------------------------
//  Reintenta las filas que quedaron "PENDIENTE" en la col H.
//  Instálalo con un disparador horario si quieres recuperación automática.
// ---------------------------------------------------------------------------
function reintentarPendientes() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Reintento: run en curso.'); return; }

  try {
    var sheet = getSheet_();
    var firstDataRow = CONFIG.HEADER_ROW + 1;
    var lastRow = sheet.getLastRow();
    if (lastRow < firstDataRow) return;

    var secrets = getTwilioSecrets_();
    var numRows = lastRow - firstDataRow + 1;
    var values = sheet.getRange(firstDataRow, 1, numRows, CONFIG.COL.NOTIFICADO).getValues();

    var recuperadas = 0;
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var marca = String(row[CONFIG.COL.NOTIFICADO - 1] || '');
      if (marca.indexOf('PENDIENTE') !== 0) continue;

      var rowNumber = firstDataRow + i;
      // Limpia la marca para que notificarNota_ vuelva a intentar.
      sheet.getRange(rowNumber, CONFIG.COL.NOTIFICADO).setValue('');
      var item = {
        title:  row[CONFIG.COL.TITLE  - 1],
        link:   row[CONFIG.COL.LINK   - 1],
        source: row[CONFIG.COL.SOURCE - 1],
      };
      notificarNota_(sheet, item, rowNumber, secrets);
      recuperadas++;
      Utilities.sleep(CONFIG.SLEEP_MS_ENTRE_ENVIOS);
    }
    Logger.log('Reintentos procesados: ' + recuperadas);

  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
//  Prueba manual: manda un mensaje de test a los destinatarios.
// ---------------------------------------------------------------------------
function pruebaEnvio() {
  var secrets = getTwilioSecrets_();
  var body = construirMensaje_({
    title: '✅ Prueba de Alerta VMO (Apps Script)',
    source: 'Prueba interna',
    link: 'https://example.com',
  }, 'https://example.com');
  var res = enviarATodos_(body, secrets);
  Logger.log(res.ok ? 'Prueba OK a todos.' : 'Fallaron: ' + res.fallidos.join(', '));
}
