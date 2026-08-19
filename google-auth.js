/**
 * google-auth.js — Conexión con Google Apps Script (sin OAuth, sin Google Cloud)
 *
 * Este módulo maneja SOLO la comunicación de red con el Apps Script.
 * La lógica de fusión vive en sync-engine.js; acá enviamos/recibimos.
 *
 * SETUP (una sola vez): ver README.md.
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
  function getConfig()   { return _cfg; }
  function signIn()      { window.openGasSetup && window.openGasSetup(); }
  function signOut()     {
    localStorage.removeItem(GAS_CONFIG_KEY);
    localStorage.removeItem('mf_initial_sync_done');
    localStorage.removeItem('mf_last_synced_at');
    _cfg = null;
    window.updateSyncBtn && window.updateSyncBtn();
  }

  function setConfig(url, secret, label) {
    _cfg = { url, secret, label: label || 'Apps Script conectado' };
    localStorage.setItem(GAS_CONFIG_KEY, JSON.stringify(_cfg));
  }

  // ── Merge sync: envía cambios locales, recibe estado autoritativo fusionado ──
  async function mergeSync(payload) {
    if (!isSignedIn()) throw new Error('Configurá la conexión primero');
    const body = JSON.stringify({
      action: 'merge',
      secret: _cfg.secret,
      device: (window.syncEngine ? window.syncEngine.getDeviceId() : 'unknown'),
      ...payload
    });
    const res = await fetch(_cfg.url, { method: 'POST', body });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch(e) { throw new Error('Respuesta inesperada del servidor: ' + text.slice(0,120)); }
    if (json.status !== 'ok') throw new Error(json.message || 'Error en el script');
    return json;
  }

  // ── Lectura completa (primera conexión / importación manual) ─────────────────
  async function readAll() {
    if (!isSignedIn()) throw new Error('Configurá la conexión primero');
    const url = _cfg.url + '?action=readmerge&secret=' + encodeURIComponent(_cfg.secret);
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch(e) { throw new Error('Respuesta inesperada: ' + text.slice(0,120)); }
    if (json.status !== 'ok') throw new Error(json.message || 'Error al leer el Sheet');
    return json;
  }

  return { isSignedIn, getEmail, getConfig, setConfig, signIn, signOut, mergeSync, readAll };
})();
