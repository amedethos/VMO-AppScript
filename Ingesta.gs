/**
 * ============================================================================
 *  Ingesta.gs  ·  Lee los RSS de Google News, agrega SOLO notas nuevas
 *                 (columnas A:F) y notifica cada nota recién agregada.
 *
 *  Esta es la FUNCIÓN PRINCIPAL. Instálala con un disparador por tiempo
 *  (ver Disparadores.gs). Reemplaza por completo el watchRows de Make:
 *  como notificamos aquí mismo, las ~17 filas históricas NUNCA se re-notifican.
 * ============================================================================
 */

function actualizarNotasVicente() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Otra ejecución en curso. Saliendo.');
    return;
  }

  try {
    var sheet = getSheet_();
    asegurarEncabezadoNotificado_(sheet); // crea la col H "Notificado" si falta
    var now = new Date();

    // Sets para evitar duplicados (guid=F, link=C, y título+fuente=A+E).
    var existingGuids       = getExistingValuesAsSet_(sheet, CONFIG.COL.GUID);
    var existingLinks       = getExistingValuesAsSet_(sheet, CONFIG.COL.LINK);
    var existingTitleSource = getExistingTitleSourceKeys_(sheet);

    var newRows = [];

    CONFIG.RSS_FEEDS.forEach(function (feed) {
      try {
        var xmlText = UrlFetchApp.fetch(feed.url, { muteHttpExceptions: true }).getContentText();
        var doc = XmlService.parse(xmlText);
        var channel = doc.getRootElement().getChild('channel');
        if (!channel) return;

        var items = channel.getChildren('item');
        var limitDate = new Date(now.getTime() - feed.maxAgeHours * 60 * 60 * 1000);

        items.forEach(function (item) {
          var title       = getChildText_(item, 'title');
          var description = stripHtml_(getChildText_(item, 'description'));
          var link        = getChildText_(item, 'link');
          var pubDateStr  = getChildText_(item, 'pubDate');
          var pubDate     = pubDateStr ? new Date(pubDateStr) : null;
          var guid        = getChildText_(item, 'guid') || link || (title + pubDateStr);

          var sourceEl = item.getChild('source');
          var source   = sourceEl ? sourceEl.getText() : '';

          // 1) Filtro por ventana de tiempo
          if (pubDate && pubDate < limitDate) return;

          // 2) Anti-duplicados
          var keyTS = buildKey_(title, source);
          if ((guid && existingGuids.has(guid)) ||
              (link && existingLinks.has(link)) ||
              existingTitleSource.has(keyTS)) {
            return;
          }

          // 3) Fila nueva (A:F). La col G "status" NO se toca; la H la maneja
          //    el notificador.
          newRows.push([title, description, link, pubDate, source, guid]);

          if (guid) existingGuids.add(guid);
          if (link) existingLinks.add(link);
          existingTitleSource.add(keyTS);
        });

      } catch (e) {
        Logger.log('Error leyendo feed ' + feed.name + ': ' + e);
      }
    });

    if (newRows.length === 0) {
      Logger.log('Sin notas nuevas.');
      return;
    }

    // Escribimos A:F de golpe.
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, 6).setValues(newRows);

    // MODO SIEMBRA: llena la hoja pero NO notifica (evita avalancha en el
    // primer arranque). Marca la col H como 'sembrada' para dejar claro que
    // esas filas nunca deben notificarse.
    var seedMode = PropertiesService.getScriptProperties().getProperty('SEED_MODE') === '1';
    if (seedMode) {
      var marks = newRows.map(function () { return ['sembrada']; });
      sheet.getRange(startRow, CONFIG.COL.NOTIFICADO, marks.length, 1).setValues(marks);
      Logger.log('SEED_MODE: ' + newRows.length + ' filas sembradas SIN notificar.');
      return;
    }

    // Notificamos una por una (ya conocemos su número de fila).
    var secrets = getTwilioSecrets_();
    var enviadas = 0;
    for (var i = 0; i < newRows.length; i++) {
      if (enviadas >= CONFIG.MAX_PER_RUN) {
        Logger.log('Tope MAX_PER_RUN alcanzado; el resto se queda sin notificar este run.');
        break;
      }
      var r = newRows[i];
      var item = { title: r[0], description: r[1], link: r[2], source: r[4] };
      try {
        notificarNota_(sheet, item, startRow + i, secrets);
        enviadas++;
      } catch (e2) {
        Logger.log('Error notificando fila ' + (startRow + i) + ': ' + e2);
      }
      Utilities.sleep(CONFIG.SLEEP_MS_ENTRE_ENVIOS);
    }

    Logger.log('Notas nuevas: ' + newRows.length + ' · notificadas: ' + enviadas);

  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------- HELPERS ---------------------------------- */

function getChildText_(parent, tagName) {
  var el = parent.getChild(tagName);
  return el ? el.getText() : '';
}

function getExistingValuesAsSet_(sheet, colIndex) {
  var lastRow = sheet.getLastRow();
  var set = new Set();
  if (lastRow < 2) return set;
  var values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  values.forEach(function (row) {
    var v = row[0];
    if (v !== '' && v !== null) set.add(String(v));
  });
  return set;
}

function buildKey_(title, source) {
  return (title || '') + '||' + (source || '');
}

function getExistingTitleSourceKeys_(sheet) {
  var lastRow = sheet.getLastRow();
  var set = new Set();
  if (lastRow < 2) return set;
  var values = sheet.getRange(2, 1, lastRow - 1, CONFIG.COL.SOURCE).getValues();
  values.forEach(function (row) {
    var title  = row[CONFIG.COL.TITLE - 1];
    var source = row[CONFIG.COL.SOURCE - 1];
    if ((title && title !== '') || (source && source !== '')) {
      set.add(buildKey_(String(title), String(source)));
    }
  });
  return set;
}

function stripHtml_(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
