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

// Envía la plantilla de activación cada día a CONFIG.ACTIVACION.HORA_ENVIO
// (hora local del manifest: America/Mexico_City).
function instalarTriggerActivacionDiaria() {
  eliminarTriggerActivacionDiaria();
  ScriptApp.newTrigger('enviarActivacionDiaria')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.ACTIVACION.HORA_ENVIO)
    .create();
  Logger.log('Trigger de activación diaria instalado a las ' +
             CONFIG.ACTIVACION.HORA_ENVIO + ':00.');
}

function eliminarTriggerActivacionDiaria() {
  eliminarTriggersPorFuncion_('enviarActivacionDiaria');
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
