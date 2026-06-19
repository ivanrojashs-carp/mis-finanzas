# 💰 Mis Finanzas — PWA con sync a Google Sheets

App de finanzas personales instalable en Android (y también usable en la PC), con sincronización a tu propio Google Sheet vía Apps Script — **sin Google Cloud, sin tarjeta de crédito, sin OAuth**.

---

## 📦 Archivos del proyecto

```
index.html       ← la app completa
manifest.json    ← la hace instalable
sw.js            ← funciona offline
google-auth.js   ← módulo de sync (apunta a tu Apps Script)
apps-script.gs   ← código para pegar en tu Google Sheet
icons/           ← íconos
```

---

## 🚀 PARTE 1 — Subir la app a GitHub Pages

1. Entrá a tu repositorio en GitHub
2. **Add file → Upload files** → arrastrá: `index.html`, `manifest.json`, `sw.js`, `google-auth.js`, carpeta `icons/`
   > `apps-script.gs` **no va a GitHub** — ese va dentro de tu Google Sheet (Parte 2)
3. Commit changes
4. Esperá 1-2 minutos y entrá a `https://TU-USUARIO.github.io/TU-REPO`

---

## 🔧 PARTE 2 — Configurar Google Sheets (10 minutos, una sola vez)

### Paso 1 — Crear el Sheet
1. Ve a [sheets.google.com](https://sheets.google.com) → **Hoja de cálculo en blanco**
2. Ponele de nombre: `Mis Finanzas Personales`

### Paso 2 — Pegar el script
1. En el Sheet: menú **Extensiones → Apps Script**
2. Se abre un editor con código de ejemplo (`function myFunction() {}`) — **borralo todo**
3. Abrí el archivo `apps-script.gs` (el que descargaste en el ZIP), copiá todo su contenido y pegalo en el editor
4. Buscá esta línea cerca del principio:
   ```javascript
   const SECRET = 'TU_CLAVE_SECRETA';
   ```
   Cambiala por una contraseña que inventes vos, por ejemplo:
   ```javascript
   const SECRET = 'Finanzas2024Seguro!';
   ```
5. Arriba a la izquierda, ponele un nombre al proyecto (ej: "Mis Finanzas API")
6. Guardar (ícono de disquete o `Ctrl+S`)

### Paso 3 — Publicar como Web App
1. Arriba a la derecha: botón **Implementar → Nueva implementación**
2. Click en el ícono de engranaje ⚙️ junto a "Seleccionar tipo" → elegí **Aplicación web**
3. Completá:
   - Descripción: "Mis Finanzas Sync" (lo que quieras)
   - Ejecutar como: **Yo (tu cuenta)**
   - Quién tiene acceso: **Cualquier persona**
4. Click **Implementar**
5. Te va a pedir **Autorizar acceso** → elegí tu cuenta → puede aparecer un aviso de "Google no verificó esta app" → click en **Configuración avanzada** → **Ir a Mis Finanzas API (no seguro)** → **Permitir**
   > Esto es normal y seguro: es tu propio script, en tu propia cuenta. El aviso aparece porque no lo publicaste en la tienda de Google, no porque sea inseguro.
6. Copiá la **URL de la aplicación web** que te muestra (termina en `/exec`)

### Paso 4 — Conectar la app con el Sheet
1. Abrí tu PWA (instalada o en el navegador)
2. Tocá el botón **"Datos"** arriba a la derecha
3. Tocá **"Configurar Apps Script"** (o el botón equivalente de conexión)
4. Pegá:
   - **URL**: la que copiaste en el paso anterior
   - **Clave secreta**: la misma que pusiste en `SECRET`
5. Guardar → Sincronizar

Si todo salió bien, vas a ver en tu Google Sheet 6 pestañas creadas automáticamente: Transacciones, Presupuestos, Resumen mensual, Tarjetas, Préstamos y Config.

### Paso 5 — Activar las alertas por email automáticas (opcional)
1. En la app: **Configuración → Alertas por email** → completá tu email y tildá qué querés que te avise
2. Sincronizá de nuevo (botón Datos → Sincronizar) para que esa config llegue al Sheet
3. Volvé al editor de Apps Script (Extensiones → Apps Script)
4. Ícono de **reloj ⏰** en el menú izquierdo (Activadores)
5. **+ Agregar activador** (abajo a la derecha)
6. Configurá:
   - Función a ejecutar: **enviarAlertasDiarias**
   - Fuente del evento: **Basado en tiempo**
   - Tipo de activador: **Temporizador diario**
   - Horario: el que prefieras (ej: 8 a 9 AM)
7. Guardar → te pide autorizar de nuevo, aceptá

Listo. A partir de ahora, todos los días a esa hora, el script revisa tus datos y te manda un email si hay vencimientos cerca, presupuestos excedidos o déficit mensual.

---

## 📱💻 ¿Funciona igual en el celular y en la PC con los mismos datos?

**Importante entender esto:** la app guarda los datos **localmente en cada dispositivo** (en el teléfono, en el navegador de la PC, etc.) — no hay una base de datos central que los una automáticamente.

**Lo que el Google Sheet te da es un punto de encuentro manual:**

- Desde el **celular**: cargás movimientos → tocás "Sincronizar" → se escriben en el Sheet
- Desde la **PC**: abrís la misma URL en Chrome → tocás "Configurar Apps Script" con la misma URL y clave → pero acá necesitás **importar** los datos del Sheet a ese dispositivo

**Lo que falta para que sea 100% automático en ambos sentidos (no solo exportar) es agregar una función de "Importar desde Sheets"**, simétrica a la de sincronizar. Así podrías:
1. Cargar en el celu → Sincronizar (sube al Sheet)
2. Abrir en la PC → Importar desde Sheets (baja del Sheet)
3. Cargar algo en la PC → Sincronizar (sube al Sheet)
4. Volver al celu → Importar desde Sheets (baja del Sheet)

Es decir: funciona, pero **no es tiempo real ni automático** — tenés que sincronizar manualmente en cada dispositivo cada vez que querés "pasar" los datos de uno a otro. Si querés, te agrego esa función de importar-desde-Sheets en la próxima vuelta para cerrar el círculo completo.

**Mientras tanto, lo más simple:** Elegí un dispositivo "principal" (por ejemplo el celular) para cargar todo el día a día, y usá la PC solo para mirar el Google Sheet directamente (ahí siempre vas a ver los datos actualizados después de cada sync), sin necesidad de que la PWA de la PC tenga los datos cargados también.

---

## 💾 Cómo funcionan los datos (resumen)

- **Local**: todo se guarda automáticamente en el dispositivo (localStorage), funciona sin internet
- **Sync automático**: una vez conectado el Apps Script, cada cambio que hagas (cargar un gasto, registrar un pago, etc.) se sube solo a los 8 segundos de inactividad. Además, hay un respaldo cada 1 minuto mientras la app esté abierta, por si algo se pasó. También sincroniza al volver a la pestaña o al recuperar la conexión a internet.
  > Esto funciona solo mientras la app/pestaña está abierta. Si la cerrás, el auto-sync se pausa hasta que la abras de nuevo — no hay forma de evitar esto sin un servidor propio corriendo 24/7.
- **Sync manual**: el botón "Subir datos a Google Sheets" sigue disponible por si querés forzarlo en el momento
- **Export Excel/JSON**: para respaldos y traspasos entre dispositivos sin pasar por Google

---

## ❓ Preguntas frecuentes

**¿Por qué me pide "Configuración avanzada" al autorizar el script?**
Porque el script es tuyo y no pasó por la revisión de la tienda de apps de Google (no la necesita, porque no es pública). Es seguro porque solo vos tenés la URL y la clave.

**¿Esto tiene algún costo?**
No. Google Sheets, Apps Script y los disparadores diarios son gratuitos para este volumen de uso.

**¿Qué pasa si pierdo o cambio el teléfono?**
Si ya sincronizaste con Sheets, tus datos están a salvo ahí. Exportá también un backup `.json` por las dudas (botón Datos → Exportar backup).

**¿Alguien más puede ver mis datos?**
No, a menos que compartas la URL del Sheet o la clave secreta del script con alguien.
