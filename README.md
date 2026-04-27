# Opemedios — Test API BDTR Noticias

Aplicación web estática para consumir la [API AI de BDTR.NET](https://bdtr.net). Permite explorar noticieros, consultar y filtrar notas, leer transcripciones y administrar webhooks desde una interfaz minimalista.

> Funciona 100% en el navegador — sin servidor, sin dependencias, sin build.

---

## Publicar en GitHub Pages

### 1. Sube el repositorio a GitHub

```bash
git remote add origin https://github.com/<tu-usuario>/<nombre-del-repo>.git
git push -u origin master
```

### 2. Activa GitHub Pages

1. Abre tu repositorio en GitHub
2. Ve a **Settings** → **Pages**
3. En **Source** selecciona la rama `master` y la carpeta **`/ (root)`**
4. Haz clic en **Save**

La URL pública quedará en:
```
https://<tu-usuario>.github.io/<nombre-del-repo>/
```

> El archivo `.nojekyll` ya está incluido para que GitHub Pages sirva los módulos ES correctamente.

---

## Configurar la API Key

La API Key **nunca se incluye en el código fuente** — se guarda en el `localStorage` del navegador.

1. Abre la aplicación
2. Haz clic en **Configuración** (esquina inferior izquierda del menú)
3. Pega tu API Key y pulsa **Guardar**

Cada usuario debe ingresar su propia clave. Para obtener una, contacta al equipo de BDTR.NET.

---

## Funcionalidades

### Noticieros
- Lista todos los noticieros procesados por BDTR AI
- Filtros por texto libre, ciudad y estación (select con búsqueda tipo Select2)
- Paginador configurable (20 / 30 / 50 por página)
- Botón **"Ver notas →"** que abre la sub-vista de notas del noticiero

### Sub-vista de notas (desde Noticieros)
- Busca automáticamente los últimos 30 días sin requerir fecha
- Barra de progreso mientras se consultan los días en lotes paralelos de 5
- Resultados ordenados de más reciente a más antiguo
- Columnas: Fecha, Hora, Noticiero, Tipo, Encabezado (extraídos del ID cuando la API no los devuelve directamente)
- Filtro de texto en tiempo real sobre los resultados
- Paginador (20 / 30 / 50)
- Botón **"Cargar 30 días anteriores"** para extender el rango sin perder resultados
- Botón **"Ver nota"** → detalle completo con encabezado, metadatos, resumen y transcripción
- Panel inline **"Generar nota"** en el detalle: pre-llena ciudad, canal, fecha, código, hora, duración y tipo; permite editar y lanza `processAiNote`
- Volver a la lista restaura página, tamaño de página y filtro de texto (sin re-fetch)

### Notas (búsqueda directa)
- Selector de ciudad (poblado desde la API de noticieros)
- Canal con búsqueda tipo Select2 (opciones filtradas por ciudad seleccionada)
- Campo de fecha y código de noticiero opcional
- Filtro de texto sobre los resultados
- Paginador (20 / 30 / 50)
- Vista de detalle con encabezado, metadatos, resumen, transcripción y campos adicionales

### Transcripción
- Obtiene el VTT completo de un noticiero para una fecha dada
- Muestra el contenido en un área con scroll con botón de copiar al portapapeles

### Webhooks
Gestión unificada para los tres tipos de webhook:
- **Webhook Notas** (`/setAiWebhook` / `/queryAiWebhook`)
- **Webhook Transcripciones** (`/setAiVttHook` / `/queryAiVttHook`)
- **Webhook Redes Sociales** (`/setAiXHook` / `/queryAiXHook`)

Cada sección permite ver la URL configurada actualmente, cambiarla y desactivarla.

---

## Ejecutar localmente

```bash
# Con Node.js
npx serve .

# Con Python
python3 -m http.server 8080
```

> Abrir `index.html` directamente con `file://` no funciona. Los módulos ES requieren un servidor HTTP.

---

## Nota sobre CORS

La app llama directamente a `api.bdtr.net` desde el navegador. Si el servidor no envía cabeceras CORS para el dominio de GitHub Pages, el navegador bloqueará las peticiones:

```
Access to fetch at 'https://api.bdtr.net/...' has been blocked by CORS policy
```

Solicita a BDTR.NET que habilite el origen de tu GitHub Pages, o despliega un proxy CORS propio.

---

## Estructura del proyecto

```
├── index.html                  # SPA shell + modal de configuración
├── css/
│   └── style.css               # Sistema de diseño (tokens, layout, componentes)
├── js/
│   ├── api.js                  # Cliente API — todos los endpoints
│   ├── app.js                  # Router SPA + inicialización
│   ├── utils.js                # Helpers: toast, spinner, escHtml, renderPager,
│   │                           #          searchableSelectHTML, initSearchableSelect
│   └── components/
│       ├── noticieros.js       # Noticieros + sub-vista notas + detalle + generar nota
│       ├── notas.js            # Búsqueda directa de notas + detalle
│       ├── transcripcion.js    # Transcripción VTT
│       └── webhook.js          # Gestión de webhooks (notas, VTT, social)
└── .nojekyll                   # Deshabilita Jekyll en GitHub Pages
```
