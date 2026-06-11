/**
 * google-auth.js — Autenticación Google OAuth2 + Sync con Google Sheets
 *
 * CONFIGURACIÓN REQUERIDA:
 * 1. Ir a https://console.cloud.google.com
 * 2. Crear proyecto → Habilitar Google Sheets API + Google Drive API
 * 3. Crear credencial OAuth 2.0 (tipo: Aplicación web)
 * 4. Agregar tu dominio de GitHub Pages en "Orígenes permitidos"
 * 5. Pegar tu CLIENT_ID abajo
 */

const GOOGLE_CLIENT_ID = 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY = 'mf_google_token';
const SHEET_ID_KEY = 'mf_sheet_id';

window.gAuth = (function () {
  let _token = null;
  let _email = '';

  // Cargar token guardado
  function _loadToken() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && saved.expires_at > Date.now()) {
        _token = saved.access_token;
        _email = saved.email || '';
        return true;
      }
    } catch (e) {}
    return false;
  }
  _loadToken();

  function isSignedIn() { return !!_token; }
  function getEmail() { return _email; }

  // OAuth2 implicit flow (popup)
  function signIn() {
    if (GOOGLE_CLIENT_ID === 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com') {
      alert('⚠️ Configurá tu CLIENT_ID en google-auth.js para activar la sincronización con Google Drive.\n\nSeguí las instrucciones en el archivo README.md');
      return;
    }
    const redirect = location.origin + location.pathname;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirect,
      response_type: 'token',
      scope: SHEETS_SCOPE,
      include_granted_scopes: 'true',
      state: 'google_oauth'
    });
    const popup = window.open(
      'https://accounts.google.com/o/oauth2/v2/auth?' + params,
      'google-login',
      'width=500,height=600,left=100,top=100'
    );

    // Escuchar el callback del popup
    window.addEventListener('message', function onMsg(e) {
      if (e.data && e.data.type === 'GOOGLE_TOKEN') {
        window.removeEventListener('message', onMsg);
        _token = e.data.token;
        _email = e.data.email || '';
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          access_token: _token,
          email: _email,
          expires_at: Date.now() + (e.data.expires_in || 3600) * 1000
        }));
        popup && popup.close();
        // Refrescar la UI del modal
        window.handleSync && window.handleSync();
      }
    });

    // Manejar hash en la misma ventana (algunos browsers)
    if (location.hash.includes('access_token')) {
      _handleHash();
    }
  }

  function _handleHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get('access_token')) {
      _token = params.get('access_token');
      const expires_in = parseInt(params.get('expires_in') || '3600');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        access_token: _token,
        expires_at: Date.now() + expires_in * 1000
      }));
      history.replaceState(null, '', location.pathname);
      fetchEmail();
    }
  }

  async function fetchEmail() {
    if (!_token) return;
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer ' + _token }
      });
      const d = await r.json();
      _email = d.email || '';
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      saved.email = _email;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (e) {}
  }

  function signOut() {
    _token = null;
    _email = '';
    localStorage.removeItem(STORAGE_KEY);
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.classList.remove('synced');
  }

  // ─── GOOGLE SHEETS API ──────────────────────────────────────────────────────
  async function _api(url, method = 'GET', body = null) {
    const opts = {
      method,
      headers: {
        'Authorization': 'Bearer ' + _token,
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Error API Google');
    }
    return r.json();
  }

  async function _getOrCreateSheet() {
    let sheetId = localStorage.getItem(SHEET_ID_KEY);
    if (sheetId) {
      // Verificar que existe
      try {
        await _api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=spreadsheetId`);
        return sheetId;
      } catch (e) {
        sheetId = null;
        localStorage.removeItem(SHEET_ID_KEY);
      }
    }

    // Crear hoja nueva
    const res = await _api('https://sheets.googleapis.com/v4/spreadsheets', 'POST', {
      properties: { title: 'Mis Finanzas Personales', locale: 'es_AR' },
      sheets: [
        { properties: { title: 'Transacciones', sheetId: 0 } },
        { properties: { title: 'Presupuestos', sheetId: 1 } },
        { properties: { title: 'Resumen', sheetId: 2 } }
      ]
    });
    sheetId = res.spreadsheetId;
    localStorage.setItem(SHEET_ID_KEY, sheetId);
    return sheetId;
  }

  async function syncToSheets(txs, budgets) {
    if (!_token) throw new Error('No autenticado');

    const sheetId = await _getOrCreateSheet();

    // Preparar filas de transacciones
    const txRows = [
      ['ID', 'Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto', 'Nota'],
      ...txs.map(t => [t.id, t.date, t.type, t.desc, t.cat, t.amount, t.note || ''])
    ];

    // Preparar filas de presupuestos
    const budgetRows = [
      ['Categoría', 'Límite Mensual'],
      ...Object.entries(budgets).map(([cat, lim]) => [cat, lim])
    ];

    // Calcular resumen por mes
    const months = [...new Set(txs.map(t => t.date.slice(0, 7)))].sort();
    const summaryRows = [
      ['Mes', 'Ingresos', 'Gastos', 'Deudas', 'Ahorros', 'Balance'],
      ...months.map(m => {
        const ts = txs.filter(t => t.date.startsWith(m));
        const inc = ts.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const exp = ts.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const dbt = ts.filter(t => t.type === 'debt').reduce((s, t) => s + t.amount, 0);
        const sav = ts.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
        return [m, inc, exp, dbt, sav, inc - exp - dbt];
      })
    ];

    // Escribir todo en batch
    await _api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, 'POST', {
      valueInputOption: 'RAW',
      data: [
        { range: 'Transacciones!A1', values: txRows },
        { range: 'Presupuestos!A1', values: budgetRows },
        { range: 'Resumen!A1', values: summaryRows }
      ]
    });

    // Marcar botón como sincronizado
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) { syncBtn.classList.add('synced'); document.getElementById('sync-label').textContent = '✓ Sync'; }

    return `https://docs.google.com/spreadsheets/d/${sheetId}`;
  }

  // Manejar redirect OAuth si venimos de login
  if (location.hash.includes('access_token')) {
    setTimeout(_handleHash, 100);
  }

  return { isSignedIn, getEmail, signIn, signOut, syncToSheets };
})();
