/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          MIS FINANZAS — Google Apps Script                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * PASOS PARA ACTIVAR (proyecto independiente, vinculado por ID):
 * 1. Entrá a tu Google Sheet → copiá el ID de la URL:
 *    docs.google.com/spreadsheets/d/ESTE-ES-EL-ID/edit
 * 2. Pegá ese ID abajo en SHEET_ID (reemplazando el que ya está)
 * 3. Cambiá TU_CLAVE_SECRETA por una contraseña tuya
 * 4. Guardar (Ctrl+S)
 * 5. Implementar → Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Acceso: Cualquier persona
 * 6. Te va a pedir autorizar permisos — es normal, es tu propio script
 * 7. Copiá la URL que te da Google (termina en /exec)
 * 8. Pegá esa URL y tu clave en la app (botón "Datos" → Configurar)
 * 9. Para activar las alertas por email automáticas:
 *    En el editor de Apps Script → ícono de reloj (Activadores) →
 *    + Agregar activador → función: enviarAlertasDiarias
 *    → Tipo de evento: Basado en tiempo → Todos los días → elegí un horario
 *    → Guardar (te va a pedir autorización la primera vez)
 *
 * NOTA: Si "Extensiones → Apps Script" dentro del Sheet te da error de Drive,
 * usá este enfoque alternativo: entrá directo a script.google.com →
 * "Proyecto nuevo" → pegá este código → funciona igual, porque el script
 * apunta al Sheet por ID en vez de depender de la vinculación automática.
 */

const SECRET = 'TU_CLAVE_SECRETA';  // ← cambiá esto

// ID de tu Google Sheet — se ve en la URL: docs.google.com/spreadsheets/d/ESTE_ID/edit
const SHEET_ID = '1IgdPCxx69J2J-OOsZa7xXqH47NAnq6IWcB04RXNIDgY';

// Devuelve el Sheet correcto sin depender de que el script esté "vinculado"
function _getSheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

// ── Maneja requests GET (ping de estado, o lectura completa de datos) ──────
function doGet(e) {
  const params = e.parameter || {};

  if (params.action === 'read') {
    try {
      if (params.secret !== SECRET) {
        return _resp({ status: 'error', message: 'Clave incorrecta' });
      }
      const ss = _getSheet();
      const data = {
        transactions: _hojaATransacciones(ss),
        budgets: _hojaAPresupuestos(ss),
        cards: _hojaATarjetas(ss),
        loans: _hojaAPrestamos(ss)
      };
      return _resp({ status: 'ok', data });
    } catch(err) {
      return _resp({ status: 'error', message: err.message });
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Mis Finanzas API activa ✓' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Convierte la hoja Transacciones de vuelta al formato de la app ─────────
function _hojaATransacciones(ss) {
  const rows = _leerHoja(ss, 'Transacciones');
  return rows.map((r, i) => ({
    id: Date.now() + i,
    date: _fechaAISO(r['Fecha']),
    type: r['Tipo'],
    desc: r['Descripción'],
    cat: r['Categoría'],
    amount: parseFloat(r['Monto ($)']) || 0,
    note: r['Nota'] || ''
  })).filter(t => t.date && t.amount > 0);
}

function _hojaAPresupuestos(ss) {
  const rows = _leerHoja(ss, 'Presupuestos');
  const obj = {};
  rows.forEach(r => { if (r['Categoría']) obj[r['Categoría']] = parseFloat(r['Límite mensual ($)']) || 0; });
  return obj;
}

function _hojaATarjetas(ss) {
  const rows = _leerHoja(ss, 'Tarjetas');
  return rows.map((r, i) => ({
    id: 'card_' + i,
    name: r['Nombre'],
    saldo: parseFloat(r['Saldo ($)']) || 0,
    limite: parseFloat(r['Límite ($)']) || 0,
    cierre: parseInt(r['Día cierre']) || null,
    venc: parseInt(r['Día vencimiento']) || null,
    minpct: parseFloat(r['Pago mín %']) || 5,
    payments: []
  })).filter(c => c.name);
}

function _hojaAPrestamos(ss) {
  const rows = _leerHoja(ss, 'Préstamos');
  return rows.map((r, i) => ({
    id: 'loan_' + i,
    name: r['Nombre'],
    total: parseFloat(r['Total ($)']) || 0,
    saldo: parseFloat(r['Saldo ($)']) || 0,
    cuota: parseFloat(r['Cuota ($)']) || 0,
    dia: parseInt(r['Día pago']) || null,
    cuotas: parseInt(r['Cuotas rest.']) || null,
    tasa: parseFloat(r['Tasa %']) || 0
  })).filter(l => l.name);
}

// ── Normaliza fechas que Sheets puede devolver como objeto Date ───────────
function _fechaAISO(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone() || 'GMT-3', 'yyyy-MM-dd');
  }
  const str = String(valor).trim();
  // Ya viene en formato yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
}

// ── Maneja requests POST (sincronización desde la app) ─────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.secret !== SECRET) {
      return _resp({ status: 'error', message: 'Clave incorrecta' });
    }

    const ss = _getSheet();

    const sheetDefs = data.sheets || {};
    Object.entries(sheetDefs).forEach(([name, rows]) => {
      _writeSheet(ss, name, rows);
    });

    _formatSheets(ss);

    return _resp({
      status: 'ok',
      message: `Sincronizado: ${(sheetDefs['Transacciones'] || []).length - 1} transacciones`,
      url: ss.getUrl()
    });

  } catch(err) {
    return _resp({ status: 'error', message: err.message });
  }
}

// ── Escribe (o limpia y reescribe) una hoja ────────────────────────────────
function _writeSheet(ss, name, rows) {
  if (!rows || !rows.length) return;
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  else sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}

// ── Aplica formato visual a las hojas ─────────────────────────────────────
function _formatSheets(ss) {
  const GREEN  = '#1D9E75';
  const WHITE  = '#FFFFFF';
  const SHEETS = ['Transacciones','Presupuestos','Resumen mensual','Tarjetas','Préstamos','Config'];

  SHEETS.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 1) return;
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) return;

    const header = sheet.getRange(1, 1, 1, lastCol);
    header.setBackground(GREEN);
    header.setFontColor(WHITE);
    header.setFontWeight('bold');
    header.setFontSize(11);
    sheet.autoResizeColumns(1, lastCol);

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      for (let r = 2; r <= lastRow; r++) {
        sheet.getRange(r, 1, 1, lastCol)
          .setBackground(r % 2 === 0 ? '#F5F5F5' : WHITE);
      }
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    headers.forEach((h, i) => {
      const hl = String(h).toLowerCase();
      if (hl.includes('$') || hl.includes('monto') || hl.includes('saldo') ||
          hl.includes('cuota') || hl.includes('total') || hl.includes('balance') ||
          hl.includes('ingreso') || hl.includes('gasto')) {
        if (lastRow > 1) sheet.getRange(2, i+1, lastRow-1, 1).setNumberFormat('$ #,##0.00');
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  ALERTAS POR EMAIL — Se ejecuta automáticamente todos los días
//  (configurar el disparador como se explica arriba)
// ═══════════════════════════════════════════════════════════════════════════
function enviarAlertasDiarias() {
  const ss = _getSheet();
  const cfg = _leerConfig(ss);

  if (!cfg.email) return; // sin email configurado, no hace nada

  const hoy = new Date().getDate();
  const dias = cfg.dias_anticipacion || 5;
  const alertas = [];

  // ── Tarjetas ──────────────────────────────────────────────────────────────
  if (cfg.avisar_tarjetas === 'SI') {
    const cards = _leerHoja(ss, 'Tarjetas');
    cards.forEach(c => {
      const saldo = parseFloat(c['Saldo ($)']) || 0;
      const venc = parseInt(c['Día vencimiento']);
      if (!venc || saldo <= 0) return;
      const faltan = venc >= hoy ? venc - hoy : (31 - hoy) + venc;
      if (faltan <= dias) {
        alertas.push(`💳 <b>${c['Nombre']}</b> vence en ${faltan} día(s) (día ${venc}). Saldo: $${saldo.toLocaleString('es-AR')}`);
      }
    });
  }

  // ── Préstamos ─────────────────────────────────────────────────────────────
  if (cfg.avisar_prestamos === 'SI') {
    const loans = _leerHoja(ss, 'Préstamos');
    loans.forEach(l => {
      const saldo = parseFloat(l['Saldo ($)']) || 0;
      const dia = parseInt(l['Día pago']);
      if (!dia || saldo <= 0) return;
      const faltan = dia >= hoy ? dia - hoy : (31 - hoy) + dia;
      if (faltan <= dias) {
        alertas.push(`🏦 <b>${l['Nombre']}</b>: cuota vence en ${faltan} día(s) (día ${dia}). Cuota: $${(parseFloat(l['Cuota ($)'])||0).toLocaleString('es-AR')}`);
      }
    });
  }

  // ── Presupuestos ──────────────────────────────────────────────────────────
  if (cfg.avisar_presupuesto === 'SI') {
    const budgets = _leerHoja(ss, 'Presupuestos');
    const txs = _leerHoja(ss, 'Transacciones');
    const mesActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT-3', 'yyyy-MM');
    budgets.forEach(b => {
      const cat = b['Categoría'];
      const limite = parseFloat(b['Límite mensual ($)']) || 0;
      if (!limite) return;
      const gastado = txs
        .filter(t => t['Tipo'] === 'expense' && t['Categoría'] === cat && String(t['Fecha']).startsWith(mesActual))
        .reduce((s, t) => s + (parseFloat(t['Monto ($)']) || 0), 0);
      const pct = (gastado / limite) * 100;
      if (pct >= 100) alertas.push(`🎯 <b>${cat}</b>: superaste el presupuesto ($${gastado.toLocaleString('es-AR')} / $${limite.toLocaleString('es-AR')})`);
      else if (pct >= 80) alertas.push(`🎯 <b>${cat}</b>: al ${pct.toFixed(0)}% del presupuesto mensual`);
    });
  }

  // ── Déficit mensual ───────────────────────────────────────────────────────
  if (cfg.avisar_deficit === 'SI') {
    const txs = _leerHoja(ss, 'Transacciones');
    const mesActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT-3', 'yyyy-MM');
    const delMes = txs.filter(t => String(t['Fecha']).startsWith(mesActual));
    const ingresos = delMes.filter(t => t['Tipo'] === 'income').reduce((s,t)=>s+(parseFloat(t['Monto ($)'])||0),0);
    const gastos   = delMes.filter(t => t['Tipo'] === 'expense').reduce((s,t)=>s+(parseFloat(t['Monto ($)'])||0),0);
    const deudas   = delMes.filter(t => t['Tipo'] === 'debt').reduce((s,t)=>s+(parseFloat(t['Monto ($)'])||0),0);
    const balance = ingresos - gastos - deudas;
    if (balance < 0 && ingresos > 0) {
      alertas.push(`⚠️ <b>Déficit mensual de $${Math.abs(balance).toLocaleString('es-AR')}</b>. Tus gastos y deudas superan los ingresos este mes.`);
    }
  }

  // ── Enviar email si hay algo para avisar ─────────────────────────────────
  if (alertas.length > 0) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:500px">
        <h2 style="color:#1D9E75">💰 Mis Finanzas — Alertas del día</h2>
        <p>Estos son tus avisos pendientes:</p>
        <ul style="line-height:1.8">
          ${alertas.map(a => `<li>${a}</li>`).join('')}
        </ul>
        <p style="color:#888;font-size:12px;margin-top:20px">
          Hoja de cálculo: <a href="${ss.getUrl()}">${ss.getName()}</a>
        </p>
      </div>`;

    MailApp.sendEmail({
      to: cfg.email,
      subject: `💰 Mis Finanzas — ${alertas.length} alerta(s) pendiente(s)`,
      htmlBody: html
    });
  }
}

// ── Lee la hoja Config como objeto clave:valor ─────────────────────────────
function _leerConfig(ss) {
  const sheet = ss.getSheetByName('Config');
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const cfg = {};
  for (let i = 1; i < rows.length; i++) {
    cfg[rows[i][0]] = rows[i][1];
  }
  return cfg;
}

// ── Lee una hoja y la devuelve como array de objetos {columna: valor} ──────
function _leerHoja(ss, nombre) {
  const sheet = ss.getSheetByName(nombre);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

// ── Helper para respuestas JSON ────────────────────────────────────────────
function _resp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
