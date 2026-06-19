/**
 * google-auth.js — Sync via Google Apps Script (sin OAuth, sin Google Cloud)
 *
 * ═══════════════════════════════════════════════════════════════
 * SETUP (una sola vez, ~10 minutos):
 *
 * 1. Abrí tu Google Drive → Nuevo → Google Sheets
 *    Poné el nombre: "Mis Finanzas Personales"
 *
 * 2. En el Sheet: Extensiones → Apps Script
 *
 * 3. Borrá todo el código que aparece y pegá el contenido
 *    del archivo "apps-script.gs" que viene en este ZIP
 *
 * 4. En el script, cambiá esta línea:
 *      const SECRET = 'TU_CLAVE_SECRETA';
 *    Por una contraseña tuya, ej: 'MisFinanzas2024!'
 *
 * 5. Guardar (Ctrl+S) → Implementar → Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquier persona
 *    → Implementar → Autorizar → Copiar la URL
 *
 * 6. Pegá la URL y tu clave abajo:
 * ═══════════════════════════════════════════════════════════════
 */

const GAS_CONFIG_KEY = 'mf_gas_config';

window.gAuth = (() => {
  let _cfg = null;

  function _load() {
    try { _cfg = JSON.parse(localStorage.getItem(GAS_CONFIG_KEY) || 'null'); } catch(e) {}
  }
  _load();

  function isSignedIn()  { return !!(_cfg && _cfg.url && _cfg.secret); }
  function getEmail()    { return _cfg ? (_cfg.label || 'Apps Script configurado') : ''; }
  function signIn()      { window.openGasSetup && window.openGasSetup(); }
  function signOut()     { localStorage.removeItem(GAS_CONFIG_KEY); _cfg = null; window.updateSyncBtn && window.updateSyncBtn(); }

  async function syncToSheets(txs, budgets, cards = [], loans = [], alertConfig = {}) {
    if (!isSignedIn()) throw new Error('Configurá la URL del Apps Script primero');

    const MLABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    // Armar todas las hojas como arrays de arrays
    const txRows = [['Fecha','Tipo','Descripción','Categoría','Monto ($)','Nota'],
      ...[...txs].sort((a,b)=>b.date.localeCompare(a.date))
        .map(t=>[t.date, t.type, t.desc, t.cat, t.amount, t.note||''])];

    const bRows  = [['Categoría','Límite mensual ($)'],
      ...Object.entries(budgets).map(([c,v])=>[c,v])];

    const months = [...new Set(txs.map(t=>t.date.slice(0,7)))].sort();
    const sumRows = [['Período','Ingresos','Gastos','Deudas','Ahorros','Inversiones','Balance neto'],
      ...months.map(m => {
        const ts  = txs.filter(t=>t.date.startsWith(m));
        const inc = ts.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
        const exp = ts.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const dbt = ts.filter(t=>t.type==='debt').reduce((s,t)=>s+t.amount,0);
        const sav = ts.filter(t=>t.type==='savings').reduce((s,t)=>s+t.amount,0);
        const inv = ts.filter(t=>t.type==='investment').reduce((s,t)=>s+t.amount,0);
        const [y,mo] = m.split('-');
        return [MLABELS[+mo-1]+' '+y, inc, exp, dbt, sav, inv, inc-exp-dbt];
      })];

    const cRows  = [['Nombre','Saldo ($)','Límite ($)','Día cierre','Día vencimiento','Pago mín %'],
      ...cards.map(c=>[c.name, c.saldo, c.limite||'', c.cierre||'', c.venc||'', c.minpct||''])];

    const lRows  = [['Nombre','Total ($)','Saldo ($)','Cuota ($)','Día pago','Cuotas rest.','Tasa %'],
      ...loans.map(l=>[l.name, l.total||'', l.saldo, l.cuota, l.dia||'', l.cuotas||'', l.tasa||''])];

    const cfgRows = [['Clave','Valor'],
      ['email', alertConfig.email || ''],
      ['avisar_tarjetas', alertConfig.cards ? 'SI' : 'NO'],
      ['avisar_prestamos', alertConfig.loans ? 'SI' : 'NO'],
      ['avisar_presupuesto', alertConfig.budget ? 'SI' : 'NO'],
      ['avisar_deficit', alertConfig.deficit ? 'SI' : 'NO'],
      ['dias_anticipacion', alertConfig.days || 5]];

    const payload = {
      secret: _cfg.secret,
      sheets: {
        Transacciones:   txRows,
        Presupuestos:    bRows,
        'Resumen mensual': sumRows,
        Tarjetas:        cRows,
        Préstamos:       lRows,
        Config:          cfgRows
      }
    };

    const res = await fetch(_cfg.url, {
      method: 'POST',
      body: JSON.stringify(payload)
      // Sin Content-Type header — GAS requiere que sea omitido para evitar preflight CORS
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { throw new Error('Respuesta inesperada del servidor: ' + text.slice(0,100)); }
    if (json.status !== 'ok') throw new Error(json.message || 'Error en el script');
    return json.url || '';
  }

  async function importFromSheets() {
    if (!isSignedIn()) throw new Error('Configurá la URL del Apps Script primero');
    const url = _cfg.url + '?action=read&secret=' + encodeURIComponent(_cfg.secret);
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { throw new Error('Respuesta inesperada: ' + text.slice(0,100)); }
    if (json.status !== 'ok') throw new Error(json.message || 'Error al leer el Sheet');
    return json.data; // { transactions, budgets, cards, loans }
  }

  return { isSignedIn, getEmail, signIn, signOut, syncToSheets, importFromSheets };
})();
