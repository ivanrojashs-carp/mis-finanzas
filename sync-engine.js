/**
 * sync-engine.js — Motor de sincronización multi-dispositivo por fusión (merge)
 *
 * Reemplaza el modelo viejo "last-write-wins global" (subir todo y pisar) por
 * una fusión registro-por-registro basada en marcas de tiempo (updatedAt) y
 * tombstones (deleted). Esto permite que dos dispositivos trabajen en paralelo
 * sin pisarse, y detecta conflictos cuando el mismo registro cambió en ambos.
 *
 * Modelo de datos:
 *  - Cada transacción, tarjeta y préstamo lleva: id (único), updatedAt (ms epoch),
 *    deleted (bool). Los borrados no se eliminan: se marcan deleted=true (tombstone)
 *    para que el borrado se propague a los otros dispositivos.
 *  - Presupuestos, config de alertas, colores y categorías personalizadas se tratan
 *    como "blobs de settings" con su propio updatedAt: el más nuevo gana en bloque
 *    (cambian poco, no justifican merge por campo).
 *
 * Protocolo con Apps Script (POST action=merge):
 *  Cliente envía { secret, since, transactions:[...], cards:[...], loans:[...], blobs:{...} }
 *  Servidor fusiona en el Sheet (por id, gana updatedAt mayor) y devuelve el
 *  estado autoritativo completo. El cliente vuelve a fusionar localmente y
 *  detecta conflictos comparando contra lastSyncedAt.
 */

window.syncEngine = (function () {
  const LAST_SYNCED_KEY = 'mf_last_synced_at';
  const DEVICE_ID_KEY = 'mf_device_id';

  // Identificador único de este dispositivo (para saber quién hizo cada cambio)
  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function getLastSyncedAt() {
    return parseInt(localStorage.getItem(LAST_SYNCED_KEY) || '0');
  }
  function setLastSyncedAt(ts) {
    localStorage.setItem(LAST_SYNCED_KEY, String(ts));
  }

  const now = () => Date.now();

  // ── Normalización: asegura que cada registro tenga id/updatedAt/deleted ──────
  function stampRecord(rec) {
    if (!rec.id) rec.id = 'rec_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    if (!rec.updatedAt) rec.updatedAt = now();
    if (rec.deleted === undefined) rec.deleted = false;
    return rec;
  }

  // Marca un registro como modificado ahora (se llama en cada cambio local)
  function touch(rec) {
    rec.updatedAt = now();
    rec.updatedBy = getDeviceId();
    return rec;
  }

  // ── Fusión de una colección (transacciones, tarjetas, préstamos) ─────────────
  // Devuelve { merged, conflicts }. merged es el array resultante (incluye tombstones).
  // conflicts es una lista de { local, remote } cuando ambos cambiaron desde el último sync.
  function mergeCollection(localArr, remoteArr, lastSynced, keyFields) {
    const byId = {};
    const conflicts = [];

    // Indexar locales
    (localArr || []).forEach(r => { byId[r.id] = { local: r }; });
    // Indexar remotos
    (remoteArr || []).forEach(r => {
      if (byId[r.id]) byId[r.id].remote = r;
      else byId[r.id] = { remote: r };
    });

    const merged = [];
    Object.values(byId).forEach(pair => {
      const { local, remote } = pair;

      if (local && !remote) { merged.push(local); return; }
      if (remote && !local) { merged.push(remote); return; }

      // Ambos existen: comparar
      const localChanged = local.updatedAt > lastSynced;
      const remoteChanged = remote.updatedAt > lastSynced;
      const differ = !recordsEqual(local, remote, keyFields);
      // Si el cambio remoto lo hizo ESTE mismo dispositivo (eco de una subida previa),
      // no es un conflicto real: es mi propio cambio que volvió del servidor.
      const remoteIsMine = remote.updatedBy && remote.updatedBy === getDeviceId();

      if (localChanged && remoteChanged && differ && !remoteIsMine) {
        // Conflicto real: ambos tocados desde el último sync y con contenido distinto
        conflicts.push({ local, remote });
        // Provisionalmente conservamos el más nuevo; el usuario decidirá luego
        merged.push(local.updatedAt >= remote.updatedAt ? local : remote);
      } else {
        // Sin conflicto: gana el updatedAt mayor
        merged.push(local.updatedAt >= remote.updatedAt ? local : remote);
      }
    });

    return { merged, conflicts };
  }

  function recordsEqual(a, b, keyFields) {
    for (const f of keyFields) {
      if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) return false;
    }
    return !!a.deleted === !!b.deleted;
  }

  // ── Fusión de blobs de settings (presupuestos, config, colores, categorías) ──
  function mergeBlob(localBlob, localTs, remoteBlob, remoteTs) {
    if (remoteTs > localTs) return { data: remoteBlob, ts: remoteTs, tookRemote: true };
    return { data: localBlob, ts: localTs, tookRemote: false };
  }

  return {
    getDeviceId, getLastSyncedAt, setLastSyncedAt, now,
    stampRecord, touch, mergeCollection, mergeBlob
  };
})();
