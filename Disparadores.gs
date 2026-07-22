/**
 * ============================================================================
 *  Disparadores.gs  ·  Instala / elimina los triggers por tiempo.
 * ============================================================================
 */

// Ejecuta la ingesta+notificación cada 15 minutos (Make notificaba casi en
// tiempo real; 15 min es un buen balance vs. la cuota de Apps Script).
function instalarTriggerIngesta() {
  eliminarTriggerIngesta();
  ScriptApp.newTrigger('actualizarNotasVicente')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('Trigger de ingesta instalado: cada 15 min.');
}

function eliminarTriggerIngesta() {
  eliminarTriggersPorFuncion_('actualizarNotasVicente');
}

// (Opcional) Reintenta cada hora las notas que quedaron en PENDIENTE.
function instalarTriggerReintento() {
  eliminarTriggerReintento();
  ScriptApp.newTrigger('reintentarPendientes')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Trigger de reintento instalado: cada hora.');
}

function eliminarTriggerReintento() {
  eliminarTriggersPorFuncion_('reintentarPendientes');
}

// Activación diaria: usar el hub ActivacionAlertasWhatsApp.
// Esta función ya NO instala trigger local (evita mensajes duplicados).
function instalarTriggerActivacionDiaria() {
  eliminarTriggerActivacionDiaria();
  Logger.log('NO se instala activación local. Usa el hub ActivacionAlertasWhatsApp. ' +
             'Si necesitas emergencia local, pon CONFIG.ACTIVACION.ENABLED=true y ' +
             'reinstala a mano con instalarTriggerActivacionDiariaLegacy_().');
}

/** Solo emergencia: reinstala trigger local si ENABLED=true. */
function instalarTriggerActivacionDiariaLegacy_() {
  if (!CONFIG.ACTIVACION.ENABLED) {
    Logger.log('CONFIG.ACTIVACION.ENABLED=false; no se instala.');
    return;
  }
  eliminarTriggerActivacionDiaria();
  ScriptApp.newTrigger('enviarActivacionDiaria')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.ACTIVACION.HORA_ENVIO)
    .create();
  Logger.log('Trigger LOCAL de activación instalado a las ' +
             CONFIG.ACTIVACION.HORA_ENVIO + ':00 (emergencia).');
}

/** Ejecutar UNA vez tras desplegar el hub para quitar el trigger viejo. */
function eliminarTriggerActivacionDiaria() {
  eliminarTriggersPorFuncion_('enviarActivacionDiaria');
  Logger.log('Trigger local enviarActivacionDiaria eliminado (si existía).');
}

function eliminarTriggersPorFuncion_(fnName) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fnName) ScriptApp.deleteTrigger(t);
  });
}

// Vista rápida de lo instalado.
function listarTriggers() {
  var lines = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction() + ' · ' + t.getEventType();
  });
  Logger.log(lines.length ? lines.join('\n') : 'Sin triggers.');
}
