# 💰 Mis Finanzas — PWA para Android

App de finanzas personales que funciona como app instalable en Android, con sincronización a Google Drive.

---

## 🚀 Instalación en 3 pasos

### Paso 1 — Subir a GitHub Pages

1. Creá un repositorio nuevo en GitHub (ej: `mis-finanzas`)
2. Subí **todos estos archivos** al repositorio:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `google-auth.js`
   - `icons/icon-192.png`
   - `icons/icon-512.png`
3. En el repositorio → **Settings** → **Pages** → Source: `main` → `/root`
4. Tu app va a estar en: `https://TU-USUARIO.github.io/mis-finanzas`

### Paso 2 — Instalar en Android

1. Abrí Chrome en tu Android
2. Ingresá a tu URL de GitHub Pages
3. Chrome va a mostrar un banner "Agregar a pantalla de inicio"
   - Si no aparece: tocar el menú (⋮) → "Agregar a pantalla de inicio"
4. ¡La app aparece en tu pantalla de inicio como una app nativa!

### Paso 3 — Conectar Google Drive (opcional pero recomendado)

#### 3a. Crear proyecto en Google Cloud

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. **Nuevo proyecto** → ponerle nombre (ej: "MisFinanzas")
3. Ir a **APIs y servicios** → **Habilitar APIs**
4. Habilitar: **Google Sheets API** y **Google Drive API**

#### 3b. Crear credenciales OAuth

1. Ir a **APIs y servicios** → **Credenciales**
2. **+ Crear credenciales** → **ID de cliente OAuth 2.0**
3. Tipo: **Aplicación web**
4. Nombre: "MisFinanzas PWA"
5. En **Orígenes JavaScript autorizados**, agregar:
   ```
   https://TU-USUARIO.github.io
   ```
6. En **URIs de redireccionamiento autorizados**, agregar:
   ```
   https://TU-USUARIO.github.io/mis-finanzas/
   ```
7. Hacer clic en **Crear**
8. Copiar el **ID de cliente** (termina en `.apps.googleusercontent.com`)

#### 3c. Configurar en la app

1. Abrir el archivo `google-auth.js`
2. Reemplazar esta línea:
   ```javascript
   const GOOGLE_CLIENT_ID = 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com';
   ```
   Por tu ID de cliente real:
   ```javascript
   const GOOGLE_CLIENT_ID = '123456789-abcdef.apps.googleusercontent.com';
   ```
3. Subir el archivo actualizado a GitHub
4. ¡Listo! El botón "Drive" en la app ahora funciona de verdad

---

## 📱 Íconos de la app

Los íconos necesitás crearlos o generarlos. Podés usar:
- [PWA Builder](https://www.pwabuilder.com/imageGenerator) — subís una imagen y genera todos los tamaños
- [Favicon.io](https://favicon.io) — para generar íconos rápido

Guardalos como:
- `icons/icon-192.png` (192×192 px)
- `icons/icon-512.png` (512×512 px)

---

## 🔄 Cómo funciona el sync con Google Drive

Cuando tocás **"Sincronizar ahora"** en la app:

1. Se crea (o actualiza) una hoja de cálculo en tu Google Drive llamada **"Mis Finanzas Personales"**
2. La hoja tiene 3 pestañas:
   - **Transacciones** — todos tus movimientos
   - **Presupuestos** — tus límites por categoría
   - **Resumen** — balance mensual automático

Podés ver y editar la hoja desde cualquier dispositivo en [Google Sheets](https://sheets.google.com).

---

## 💾 Almacenamiento local

Los datos se guardan **automáticamente** en el dispositivo (localStorage) cada vez que cargás un movimiento. La app funciona **sin internet** gracias al Service Worker.

El sync con Drive es **manual** (botón Drive en la barra superior) — así tenés control total sobre cuándo sincronizar.

---

## ❓ Preguntas frecuentes

**¿Mis datos están seguros?**  
Sí. Los datos se guardan localmente en tu teléfono. El sync a Drive solo ocurre cuando vos lo pedís, y solo en tu cuenta de Google.

**¿Funciona sin internet?**  
Sí. Una vez instalada, la app funciona completamente offline. Solo necesitás internet para sincronizar con Drive.

**¿Puedo usar la app en varios dispositivos?**  
Sí. Instalala en cada dispositivo y usá el sync con Drive para mantener los datos actualizados.

**¿Cómo importo mis datos si cambio de teléfono?**  
Exportá los datos desde el botón Drive → "Exportar datos (JSON)", y en el nuevo teléfono podés importarlos (funcionalidad a agregar).
