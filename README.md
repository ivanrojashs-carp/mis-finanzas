# 💰 Mis Finanzas — PWA con Google directo

App de finanzas personales instalable (Android/PC) con sincronización multi-dispositivo directamente contra Google Sheets, sin backend propio, sin Apps Script, sin contraseñas.

---

## ✨ Qué hay de nuevo en esta versión (v19)

**Conexión directa con Google (OAuth).** Antes cada usuario tenía que abrir el Apps Script, pegar código y crear una clave secreta. Ahora simplemente aprieta **"Conectar con Google"** y la app hace todo:
- Autoriza el permiso una sola vez.
- La app **crea sola un Google Sheet** en su Drive personal (llamado "Mis Finanzas - Datos").
- Empieza a sincronizar automáticamente.

Los permisos que pide son mínimos: solo puede tocar el Sheet que ella misma crea (scope `drive.file`). No accede a otros archivos del Drive del usuario.

Se mantienen: el motor de fusión multi-dispositivo (desde v17), el diseño Material claro/oscuro (desde v18) y todo lo demás.

---

## 🔧 PASO ÚNICO PARA EL DESARROLLADOR (Ivan)

Esto se hace **una sola vez**. Después, las futuras actualizaciones de la app funcionan sin repetirlo.

### 1. Crear el proyecto en Google Cloud

1. Entrá a **[console.cloud.google.com](https://console.cloud.google.com)** con tu cuenta de Google.
2. Arriba a la izquierda, en el selector de proyecto: **Nuevo proyecto**.
3. Nombre: `Mis Finanzas` → **Crear**.
4. Esperá unos segundos y seleccioná el proyecto recién creado.

### 2. Habilitar las APIs que la app necesita

1. Menú lateral → **APIs y servicios → Biblioteca**.
2. Buscá **"Google Sheets API"** → **Habilitar**.
3. Volvé a la Biblioteca. Buscá **"Google Drive API"** → **Habilitar**.

### 3. Configurar la pantalla de consentimiento OAuth

1. Menú → **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo** → **Crear**.
3. Completá:
   - **Nombre de la aplicación:** `Mis Finanzas`
   - **Correo de asistencia al usuario:** tu email
   - **Datos de contacto del desarrollador:** tu email
   - El resto podés dejarlo vacío → **Guardar y continuar**.
4. **Alcances (scopes):** clic en "Agregar o quitar alcances", marcá:
   - `.../auth/drive.file`
   - `.../auth/spreadsheets`
   → Actualizar → **Guardar y continuar**.
5. **Usuarios de prueba:** clic en "+ Add Users". Agregá **tu email y los emails de todos los que van a usar la app** (hasta 100). Sin esto, nadie más que vos podrá conectarse.
   → **Guardar y continuar**.
6. **No hace falta publicar** la app ni pedir verificación (eso es solo si querés levantar el límite de 100 usuarios). Dejala en modo "Testing".

### 4. Crear el Client ID

1. Menú → **APIs y servicios → Credenciales**.
2. **+ Crear credenciales → ID de cliente de OAuth**.
3. Tipo de aplicación: **Aplicación web**.
4. Nombre: `Mis Finanzas Web`.
5. **Orígenes de JavaScript autorizados:** clic en "+ Agregar URI" y pegá **exactamente**:
   ```
   https://ivanrojashs-carp.github.io
   ```
   (sin barra al final, sin la ruta `/mis-finanzas/`, solo el dominio raíz de GitHub Pages)

   Si querés probar la app localmente antes de subirla, agregá también `http://localhost:8080` o el puerto que uses.
6. **URIs de redireccionamiento autorizados:** dejar vacío.
7. **Crear** → aparece una ventanita con tu **Client ID** (algo como `123456789-abcdef.apps.googleusercontent.com`).
8. **Copiá el Client ID.**

### 5. Pegar el Client ID en el código

1. Abrí `google-auth.js`.
2. Buscá la línea:
   ```javascript
   CLIENT_ID: 'PEGAR_AQUI_TU_CLIENT_ID.apps.googleusercontent.com',
   ```
3. Reemplazala por tu Client ID:
   ```javascript
   CLIENT_ID: '123456789-abcdef.apps.googleusercontent.com',
   ```
4. Guardá.

### 6. Subir a GitHub

Subí los archivos actualizados a tu repo:
- `index.html`
- `google-auth.js` (con tu Client ID adentro)
- `sync-engine.js`
- `sw.js`
- `manifest.json`

Y listo. La primera vez que vos u otro usuario abra la app, va a ver el botón "Conectar con Google" en Datos y todo funciona solo.

---

## 📲 PARA LOS USUARIOS

Nada de esto tenés que hacer, es solo lo que ellos ven:

1. Abrí la app.
2. Botón **Datos** → **Conectar con Google**.
3. Aparece un popup: **elegí tu cuenta y aceptá los permisos** ("Mis Finanzas quiere acceder a Sheets/Drive").
4. La app crea su propio Sheet en tu Drive y empieza a sincronizar.

Después no hay que hacer nada más: cada cambio se sube solo y los cambios de otros dispositivos bajan cada 30 segundos.

> **Nota sobre la pantalla de "app no verificada":** los usuarios pueden ver una pantalla que dice "Google no ha verificado esta aplicación". Es normal (para sacarla habría que pasar por un proceso de verificación que lleva semanas). Basta con hacer clic en "Configuración avanzada → Continuar a Mis Finanzas".

---

## 🔄 Cómo funciona la sincronización

- **Automática:** cada cambio se sube tras unos segundos, y la app consulta el Sheet cada 30 s para traer los cambios de otros dispositivos del mismo usuario.
- **Por fusión (merge):** los datos nunca se pisan. Cada registro tiene su marca de tiempo y gana el más reciente.
- **Con tombstones:** los borrados se marcan y se propagan (no "reviven" en otro dispositivo).
- **Con detección de conflictos:** si editás el mismo registro en dos dispositivos a la vez, la app te muestra ambas versiones y elegís.

---

## 📦 Archivos

```
index.html       ← la app completa
manifest.json    ← la hace instalable como PWA
sw.js            ← funciona offline (v19)
sync-engine.js   ← motor de fusión (timestamps, tombstones, conflictos)
google-auth.js   ← OAuth + Sheets API (acá va tu Client ID)
apps-script.gs   ← LEGACY: solo si algún usuario prefiere el modo viejo
icons/           ← íconos de la PWA
```

`apps-script.gs` ya no es necesario en el flujo normal. Queda en el paquete solo por si algún usuario todavía usa la versión anterior.

---

## 🛠️ Problemas comunes

**"Access blocked: This app's request is invalid"** al hacer clic en Conectar → El Client ID no coincide con el dominio autorizado. Verificá que en Google Cloud tengas `https://ivanrojashs-carp.github.io` como origen autorizado (sin barra ni ruta).

**"La app no está configurada todavía"** → Faltó pegar el Client ID real en `google-auth.js`. Ver Paso 5.

**Otro usuario no puede conectarse** → Su email no está en la lista de usuarios de prueba (Paso 3.5). Agregalo desde la Pantalla de consentimiento OAuth → Usuarios de prueba → + Add Users.

**"Sesión expirada"** → Normal cada ~1 hora. La app pide reconectar. Un clic y sigue.

**No aparece el botón "Actualización disponible" al subir cambios** → "Eliminar datos del sitio" en Chrome y reinstalar. Los datos están a salvo en el Sheet.
