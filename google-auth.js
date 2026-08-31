/**
 * google-auth.js — Conexión DIRECTA con Google Sheets vía OAuth
 *
 * La app pide autorización a Google (una sola vez por usuario), obtiene un
 * token de acceso, y con ese token habla directamente con Google Sheets API.
 *
 * Ventajas vs versión anterior con Apps Script:
 *  - El usuario NO tiene que copiar código, ni crear contraseñas, ni pegar URLs.
 *  - Con un clic autoriza la app y ya queda todo funcionando.
 *  - La app crea sola su propio Sheet ("Mis Finanzas - Datos") en el Drive
 *    del usuario y lo reutiliza en todos sus dispositivos.
 *
 * Requisito: Ivan (el que despliega la app) debe configurar UNA VEZ un proyecto
 * en Google Cloud y pegar acá abajo el Client ID. Ver README.md.
 */

const OAUTH_CONFIG = {
  // ⚠️ EDITAR: pegá acá tu Client ID de Google Cloud (ver README.md "Configuración inicial")
  CLIENT_ID: '501548039218-09qklfgflk4nall9m91d1itvrvf40di0.apps.googleusercontent.com',

  // Permisos solicitados: leer/escribir sheets + buscar/crear archivos que la app maneja
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',

  // Nombre del Sheet que la app crea automáticamente en el Drive del usuario
  SHEET_NAME: 'Mis Finanzas - Datos'
};

const TOKEN_KEY = 'mf_oauth_token';
const SHEET_ID_KEY = 'mf_sheet_id';

// Columnas internas de cada hoja (misma estructura que el motor anterior)
const TX_COLS   = ['id','updatedAt','deleted','fecha','tipo','desc','categoria','monto','nota'];
const CARD_COLS = ['id','updatedAt','deleted','name','saldo','limite','cierre','venc','minpct','payments'];
const LOAN_COLS = ['id','updatedAt','deleted','name','total','saldo','vencido','tasa','installments'];
const BLOB_COLS = ['key','updatedAt','json'];

window.gAuth = (() => {
  let _token = null;
  let _tokenExpiry = 0;
  let _tokenClient = null;
  let _sheetId = null;
  let _gisReady = false;
  let _pendingTokenPromise = null;

  // ── Inicialización: recupera token y sheetId guardados, carga librería de Google ──
  function _init() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
      if (saved && saved.expires_at > Date.now()) {
        _token = saved.access_token;
        _tokenExpiry = saved.expires_at;
      }
    } catch(e) {}
    _sheetId = localStorage.getItem(SHEET_ID_KEY);
    _loadGIS();
  }

  function _loadGIS() {
    if (window.google && window.google.accounts) { _gisReady = true; return; }
    if (document.getElementById('gis-script')) return;
    const s = document.createElement('script');
    s.id = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => { _gisReady = true; };
    s.onerror = () => { console.error('No se pudo cargar Google Identity Services'); };
    document.head.appendChild(s);
  }

  // Espera a que la librería de Google esté lista (con timeout)
  function _waitGIS(maxMs = 6000) {
    return new Promise((resolve, reject) => {
      if (_gisReady) return resolve();
      const start = Date.now();
      const t = setInterval(() => {
        if (_gisReady) { clearInterval(t); resolve(); }
        else if (Date.now() - start > maxMs) {
          clearInterval(t);
          reject(new Error('No cargó la autenticación de Google. Revisá tu conexión y reintentá.'));
        }
      }, 150);
    });
  }

  function _initTokenClient() {
    if (_tokenClient) return _tokenClient;
    if (OAUTH_CONFIG.CLIENT_ID.startsWith('PEGAR_')) {
      throw new Error('La app no está configurada todavía. El desarrollador debe pegar el Client ID de Google Cloud en google-auth.js. Ver README.');
    }
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: OAUTH_CONFIG.CLIENT_ID,
      scope: OAUTH_CONFIG.SCOPES,
      callback: (resp) => {
        if (resp.error) {
          if (_pendingTokenPromise) _pendingTokenPromise.reject(new Error(resp.error_description || resp.error));
          _pendingTokenPromise = null;
          return;
        }
        _token = resp.access_token;
        _tokenExpiry = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: _token, expires_at: _tokenExpiry }));
        if (_pendingTokenPromise) _pendingTokenPromise.resolve(_token);
        _pendingTokenPromise = null;
      }
    });
    return _tokenClient;
  }

  // Solicita un token. Si interactive=true, muestra popup de consentimiento.
  // Si false, intenta obtenerlo silenciosamente (funciona si el usuario ya consintió antes).
  async function requestToken(interactive = true) {
    await _waitGIS();
    const client = _initTokenClient();
    return new Promise((resolve, reject) => {
      _pendingTokenPromise = { resolve, reject };
      try {
        client.requestAccessToken({ prompt: interactive ? '' : 'none' });
      } catch (e) { reject(e); _pendingTokenPromise = null; }
    });
  }

  // Asegura que hay un token válido (renueva silencioso si venció)
  async function _ensureToken() {
    if (_token && Date.now() < _tokenExpiry) return _token;
    try { return await requestToken(false); }
    catch (e) { throw new Error('Sesión expirada. Volvé a conectarte desde Datos.'); }
  }

  // ── Helper HTTP para llamar a APIs de Google ──────────────────────────────
  async function _api(url, options = {}) {
    const token = await _ensureToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (res.status === 401 || res.status === 403) {
      _token = null; _tokenExpiry = 0;
      sessionStorage.removeItem(TOKEN_KEY);
      throw new Error('Sesión expirada. Volvé a conectarte.');
    }
    if (!res.ok) {
      const errText = await res.text();
      let msg = errText.slice(0, 240);
      try { msg = JSON.parse(errText).error?.message || msg; } catch(e) {}
      throw new Error('Google API ' + res.status + ': ' + msg);
    }
    return res.json();
  }

  // ── Descubrimiento y creación del Sheet ───────────────────────────────────
  async function _findAppSheet() {
    const query = "name='" + OAUTH_CONFIG.SHEET_NAME + "' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
    const data = await _api('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query) + '&fields=files(id,name)&pageSize=10');
    return (data.files && data.files.length > 0) ? data.files[0].id : null;
  }

  async function _createAppSheet() {
    const data = await _api('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: OAUTH_CONFIG.SHEET_NAME, locale: 'es_AR' },
        sheets: [
          { properties: { title: 'Transacciones' } },
          { properties: { title: 'Tarjetas' } },
          { properties: { title: 'Prestamos' } },
          { properties: { title: '_Settings' } }
        ]
      })
    });
    return data.spreadsheetId;
  }

  // Asegura que existe el Sheet y devuelve su ID.
  async function _ensureSheet() {
    if (_sheetId) {
      try {
        await _api('https://sheets.googleapis.com/v4/spreadsheets/' + _sheetId + '?fields=spreadsheetId');
        return _sheetId;
      } catch (e) { _sheetId = null; localStorage.removeItem(SHEET_ID_KEY); }
    }
    let id = await _findAppSheet();
    if (!id) id = await _createAppSheet();
    _sheetId = id;
    localStorage.setItem(SHEET_ID_KEY, id);
    return id;
  }

  // ── Interfaz pública ──────────────────────────────────────────────────────
  function isSignedIn() { return !!(_token && Date.now() < _tokenExpiry); }
  function getEmail() { return _sheetId ? 'Google Sheets conectado' : 'Conectar Google'; }
  function getConfig() { return isSignedIn() ? { sheetId: _sheetId } : null; }
  function getSheetId() { return _sheetId; }

  async function signIn() {
    await requestToken(true);
    await _ensureSheet();
    window.updateSyncBtn && window.updateSyncBtn();
    return true;
  }

  function signOut() {
    if (_token && window.google && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(_token, () => {}); } catch(e) {}
    }
    _token = null; _tokenExpiry = 0; _sheetId = null;
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SHEET_ID_KEY);
    localStorage.removeItem('mf_initial_sync_done');
    localStorage.removeItem('mf_last_synced_at');
    window.updateSyncBtn && window.updateSyncBtn();
  }

  // Compatibilidad con el flujo anterior (para no cambiar index.html)
  function setConfig() { /* no-op en OAuth; conservado por compatibilidad */ }

  // ── Lectura completa del Sheet (misma forma que la versión Apps Script) ──
  async function readAll() {
    const id = await _ensureSheet();
    const ranges = ['Transacciones', 'Tarjetas', 'Prestamos', '_Settings']
      .map(n => 'ranges=' + encodeURIComponent(n + '!A:Z')).join('&');
    const data = await _api('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values:batchGet?' + ranges);
    const [txRows, cardRows, loanRows, blobRows] = data.valueRanges.map(vr => vr.values || []);
    return {
      status: 'ok',
      transactions: _rowsToRecords(txRows, TX_COLS),
      cards: _rowsToRecords(cardRows, CARD_COLS),
      loans: _rowsToRecords(loanRows, LOAN_COLS),
      blobs: _rowsToBlobs(blobRows),
      serverTime: Date.now()
    };
  }

  // ── Merge sync (misma interfaz que la versión Apps Script) ────────────────
  // Fusiona lo local con lo del Sheet y escribe el resultado autoritativo.
  async function mergeSync(payload) {
    const id = await _ensureSheet();
    const remote = await readAll();

    const txMerged   = _mergeById(payload.transactions || [], remote.transactions);
    const cardMerged = _mergeById(payload.cards || [], remote.cards);
    const loanMerged = _mergeById(payload.loans || [], remote.loans);
    const blobMerged = _mergeBlobs(payload.blobs || {}, remote.blobs);

    await _writeAll(id, txMerged, cardMerged, loanMerged, blobMerged);

    return {
      status: 'ok',
      transactions: txMerged, cards: cardMerged, loans: loanMerged, blobs: blobMerged,
      serverTime: Date.now()
    };
  }

  function _mergeById(incoming, existing) {
    const byId = {};
    (existing || []).forEach(r => { if (r.id) byId[r.id] = r; });
    (incoming || []).forEach(r => {
      if (!r.id) return;
      const cur = byId[r.id];
      if (!cur || (r.updatedAt || 0) >= (cur.updatedAt || 0)) byId[r.id] = r;
    });
    return Object.values(byId);
  }

  function _mergeBlobs(incoming, existing) {
    const merged = { ...(existing || {}) };
    Object.keys(incoming).forEach(k => {
      const inc = incoming[k];
      const cur = merged[k];
      if (!cur || (inc.updatedAt || 0) > (cur.updatedAt || 0)) merged[k] = inc;
    });
    return merged;
  }

  function _rowsToRecords(rows, cols) {
    if (!rows || !rows.length) return [];
    const header = rows[0];
    const idx = {};
    cols.forEach(c => { idx[c] = header.indexOf(c); });
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rec = {};
      cols.forEach(c => {
        let v = idx[c] >= 0 ? (row[idx[c]] ?? '') : '';
        if (c === 'updatedAt') v = Number(v) || 0;
        else if (c === 'deleted') v = (v === 'TRUE' || v === true || v === 'true');
        else if (['monto','saldo','limite','total','vencido','tasa','minpct'].includes(c)) {
          v = (v === '' || v == null) ? '' : Number(v);
        }
        else if (c === 'installments') {
          try { v = v ? JSON.parse(v) : []; } catch(e) { v = []; }
        }
        rec[c] = v;
      });
      if (rec.id) out.push(rec);
    }
    return out;
  }

  function _rowsToBlobs(rows) {
    if (!rows || !rows.length) return {};
    const result = {};
    for (let i = 1; i < rows.length; i++) {
      const [key, updatedAt, json] = rows[i] || [];
      if (!key) continue;
      try { result[key] = { updatedAt: Number(updatedAt) || 0, data: JSON.parse(json || 'null') }; } catch(e) {}
    }
    return result;
  }

  async function _writeAll(id, txs, cards, loans, blobs) {
    // Primero limpiar (evita filas "fantasma" cuando el nuevo estado tiene menos filas)
    await _api('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values:batchClear', {
      method: 'POST',
      body: JSON.stringify({
        ranges: ['Transacciones!A1:Z10000', 'Tarjetas!A1:Z10000', 'Prestamos!A1:Z10000', '_Settings!A1:Z10000']
      })
    });
    // Escribir todo en una sola llamada
    await _api('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: 'Transacciones!A1', values: _recordsToRows(txs, TX_COLS) },
          { range: 'Tarjetas!A1',      values: _recordsToRows(cards, CARD_COLS) },
          { range: 'Prestamos!A1',     values: _recordsToRows(loans, LOAN_COLS) },
          { range: '_Settings!A1',     values: _blobsToRows(blobs) }
        ]
      })
    });
  }

  function _recordsToRows(records, cols) {
    const rows = [cols];
    (records || []).forEach(r => {
      rows.push(cols.map(c => {
        let v = r[c];
        if (c === 'installments' && typeof v !== 'string') return JSON.stringify(v || []);
        if (v === undefined || v === null) return '';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        return v;
      }));
    });
    return rows;
  }

  function _blobsToRows(blobs) {
    const rows = [BLOB_COLS];
    Object.keys(blobs || {}).forEach(k => {
      const b = blobs[k];
      rows.push([k, b.updatedAt || 0, JSON.stringify(b.data)]);
    });
    return rows;
  }

  _init();

  return {
    isSignedIn, getEmail, getConfig, getSheetId,
    signIn, signOut, setConfig,
    mergeSync, readAll
  };
})();
