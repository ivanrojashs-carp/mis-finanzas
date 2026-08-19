# 💰 Mis Finanzas — PWA con sincronización multi-dispositivo

App de finanzas personales instalable en Android (y usable en la PC), con **sincronización por fusión** a tu propio Google Sheet vía Apps Script — **sin Google Cloud, sin tarjeta de crédito, sin OAuth**.

---

## ✨ Qué hay de nuevo en esta versión (v18)

**Rediseño visual Material Design:**
- Nuevo color de acento azul índigo, superficies con efecto vidrio esmerilado y transparencias.
- **Modo claro / oscuro / automático** (seguí el sistema o forzá uno) desde Config → Apariencia.
- Tarjetas con elevación, botones con capa de estado y animaciones suaves.

**Motor de sincronización por fusión (desde v17):**

- Cada movimiento, tarjeta y préstamo tiene una marca de tiempo propia (`updatedAt`).
- Al sincronizar, los datos se **combinan** en vez de reemplazarse: si cargaste algo en el celu y algo distinto en la PC, **se conservan los dos**.
- Los borrados se propagan correctamente (si borrás algo en un dispositivo, se borra en todos).
- La app **baja los cambios de otros dispositivos cada 30 segundos** automáticamente, mientras está abierta.
- Si el mismo registro se edita en dos dispositivos a la vez, la app **te avisa y elegís** con cuál quedarte (no se pierde nada silenciosamente).

**Ya no hay botones separados de "Subir" y "Bajar".** Hay un único botón "Sincronizar ahora", y en general ni siquiera hace falta tocarlo: todo pasa solo.

---

## 📦 Archivos del proyecto

```
index.html       ← la app completa
manifest.json    ← la hace instalable
sw.js            ← funciona offline
sync-engine.js   ← NUEVO: motor de fusión (timestamps, tombstones, conflictos)
google-auth.js   ← comunicación con tu Apps Script
apps-script.gs   ← código para pegar en tu Google Sheet
icons/           ← íconos
```

> ⚠️ **Importante:** esta versión suma un archivo nuevo, `sync-engine.js`. Cuando actualices en GitHub, asegurate de subirlo junto con los demás.

---

## 🚀 PARTE 1 — Subir/actualizar la app en GitHub Pages

1. Entrá a tu repositorio en GitHub.
2. **Add file → Upload files** → arrastrá estos archivos (reemplazan los viejos):
   - `index.html`
   - `sync-engine.js`  ← **archivo nuevo, no lo olvides**
   - `google-auth.js`
   - `sw.js`
   - `manifest.json`
   > `apps-script.gs` **no va a GitHub** — ese va dentro de tu Google Sheet (Parte 2).
3. **Commit changes.**
4. Esperá 1-2 minutos.

Como cambió el número de versión del Service Worker (a `v17`), la app te va a mostrar el cartel **"Hay una actualización disponible"** la próxima vez que la abras. Tocá recargar. Si no aparece, entrá a la configuración del sitio en Chrome y usá "Actualizar" o, en el peor caso, "Eliminar datos del sitio" y reinstalá (tus datos están a salvo en el Sheet).

---

## 🔧 PARTE 2 — Actualizar el Apps Script (¡obligatorio en esta versión!)

El código del servidor cambió por completo: ahora fusiona en vez de pisar, y usa hojas nuevas en tu Sheet. **Tenés que actualizar el script sí o sí**, o la sincronización no va a funcionar.

1. Abrí tu proyecto en `script.google.com` (o desde tu Sheet: **Extensiones → Apps Script**).
2. **Borrá todo** el código viejo y pegá el contenido completo de `apps-script.gs`.
3. Configurá las dos líneas de arriba:
   ```javascript
   const SECRET   = 'TU_CLAVE_SECRETA';   // ← poné tu clave (la misma que usás en la app)
   const SHEET_ID = '...';                // ← ya viene con tu ID cargado
   ```
   > La **clave secreta** es una palabra que inventás vos. **No es tu contraseña de Google.** Tiene que ser idéntica acá y en la app.
4. **Guardá** (Ctrl+S).
5. **Implementar → Administrar implementaciones → (ícono lápiz) Editar → Versión: Nueva versión → Implementar.**
   > Hacelo así (editando la implementación existente) para que **la URL no cambie**. Si creás una implementación nueva desde cero, te da otra URL y tendrías que volver a pegarla en la app.

### Sobre las hojas del Sheet

El nuevo motor crea hojas nuevas automáticamente: **`Transacciones`, `Tarjetas`, `Prestamos`, `_Settings`** (con columnas internas `id`, `updatedAt`, `deleted`). También mantiene una hoja legible **`Resumen mensual`**.

Las hojas del formato viejo quedan obsoletas y podés ignorarlas o borrarlas. La primera vez que sincronices desde el dispositivo que tiene tus datos buenos, esas hojas nuevas se van a poblar solas.

---

## 📲 PARTE 3 — Conectar cada dispositivo

En cada dispositivo (celular y PC):

1. Abrí la app → botón **Datos** (o Config → sincronización).
2. Pegá la **URL del Apps Script** (`.../exec`) y tu **clave secreta**.
3. Tocá **Conectar**.

La primera vez, la app trae lo que ya está en el Sheet y lo fusiona con lo que tengas en ese dispositivo. A partir de ahí, todo se sincroniza solo.

> **Recomendación:** conectá **primero** el dispositivo que tiene tus datos correctos y dejá que suba todo. Después conectá los demás. Así te asegurás de que la "fuente de verdad" quede bien cargada desde el arranque.

---

## 🔄 Cómo funciona la sincronización (resumen)

- **Automática:** cada cambio se sube tras unos segundos, y la app consulta el Sheet cada 30 s para traer lo de otros dispositivos.
- **Por fusión:** nunca se pisa. Cada registro gana según su marca de tiempo más reciente.
- **Con tombstones:** los borrados se marcan y se propagan (no "reviven" en otro dispositivo).
- **Con detección de conflictos:** si editás lo mismo en dos lados a la vez, la app te muestra ambas versiones y elegís.

---

## 🛠️ Problemas comunes

**"Clave incorrecta"** → La clave de la app no coincide con el `SECRET` del script. Revisá que sean idénticas (mayúsculas incluidas).

**No sincroniza / error de conexión** → Verificá que hayas hecho "Nueva versión" al implementar el script actualizado. Si implementaste una versión nueva desde cero, la URL cambió: pegá la nueva en la app.

**No veo los cambios del otro dispositivo** → Esperá hasta 30 segundos, o tocá "Sincronizar ahora". Asegurate de que ambos estén conectados con la misma URL y clave.

**La app no se actualizó a v17** → Configuración del sitio en Chrome → "Eliminar datos del sitio" → reinstalá. Tus datos están en el Sheet, no se pierden.
