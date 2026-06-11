# 💰 Mis Finanzas — PWA para Android

App de finanzas personales instalable en Android. Funciona **100% offline**, sin Google Cloud, sin cuentas externas. Los datos se guardan en el dispositivo y podés exportarlos a Excel cuando quieras.

---

## 🚀 Instalar en Android (2 pasos)

### Paso 1 — Subir a GitHub Pages

1. Creá un repositorio nuevo en GitHub (ej: `mis-finanzas`)
2. Subí **todos estos archivos** manteniendo la estructura:
   ```
   index.html
   manifest.json
   sw.js
   icons/
     icon-192.png
     icon-512.png
   ```
   > No hace falta subir `google-auth.js` ni `README.md`
3. En el repositorio → **Settings** → **Pages** → Source: `main` → Save
4. En 1-2 minutos tu app está en: `https://TU-USUARIO.github.io/mis-finanzas`

### Paso 2 — Instalar en Android

1. Abrí **Chrome** en tu Android
2. Entrá a tu URL de GitHub Pages
3. Chrome muestra el banner **"Agregar a pantalla de inicio"** → tocá **Instalar**
   - Si no aparece el banner: menú (⋮) → "Agregar a pantalla de inicio"
4. ¡La app aparece como ícono nativo, sin barra del navegador, funciona offline!

---

## 💾 Cómo funcionan los datos

- Todo se guarda **automáticamente** en el dispositivo (localStorage)
- Funciona **sin internet** una vez instalada
- Nada se envía a ningún servidor externo

---

## 📤 Exportar e importar datos

Tocá el botón **"Datos"** en la barra superior para:

### Exportar a Excel (.xlsx)
Genera un archivo Excel con 4 hojas:
- **Transacciones** — todos tus movimientos ordenados por fecha
- **Presupuestos** — tus límites mensuales por categoría
- **Resumen mensual** — ingresos, gastos, balance por mes
- **Categorías (mes actual)** — análisis del mes en curso con % por categoría

Podés abrirlo en Excel, Google Sheets, o Libre Office.

### Exportar backup (.json)
Copia de seguridad completa de todos tus datos. Usalo para:
- Hacer backup antes de cambiar de teléfono
- Restaurar datos en otro dispositivo

### Importar desde backup (.json)
Restaura todos tus datos desde un archivo `.json` exportado anteriormente.
⚠️ Reemplaza los datos actuales del dispositivo.

---

## 📱 Íconos

Si querés personalizar el ícono de la app, reemplazá los archivos en `icons/`:
- `icon-192.png` → 192×192 px
- `icon-512.png` → 512×512 px

Podés generarlos en [pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator)

---

## ❓ Preguntas frecuentes

**¿Mis datos están en algún servidor?**
No. Todo queda en tu teléfono. La app no hace ninguna llamada a internet con tus datos.

**¿Qué pasa si desinstalo la app?**
Los datos del localStorage se borran. Hacé un backup (.json) antes de desinstalar.

**¿Puedo usarla en la PC también?**
Sí. Entrá a la URL desde Chrome en la PC y podés instalarla como app de escritorio también.

**¿Funciona en iPhone?**
Sí, con Safari. Ir a la URL → compartir → "Agregar a pantalla de inicio".

**¿Cómo paso los datos a otro teléfono?**
1. En el teléfono viejo: Datos → Exportar backup (.json)
2. Mandarte el archivo por WhatsApp, email, etc.
3. En el teléfono nuevo: instalás la app → Datos → Importar
