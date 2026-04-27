# BDTR Noticias AI

Aplicación web para consumir la API de [BDTR.NET](https://bdtr.net). Permite consultar noticieros, notas, transcripciones y configurar webhooks desde una interfaz minimalista.

> Funciona completamente en el navegador — sin servidor, sin dependencias, sin build.

## Demo

Una vez publicado en GitHub Pages la URL será:
```
https://<tu-usuario>.github.io/<nombre-del-repo>/
```

---

## Publicar en GitHub Pages

### 1. Sube el repositorio a GitHub

```bash
git remote add origin https://github.com/<tu-usuario>/<nombre-del-repo>.git
git push -u origin master
```

### 2. Activa GitHub Pages

1. Abre tu repositorio en GitHub
2. Ve a **Settings** → **Pages** (barra lateral izquierda)
3. En **Source** selecciona la rama `master` (o `main`) y la carpeta **`/ (root)`**
4. Haz clic en **Save**

GitHub mostrará la URL pública en unos segundos:
```
https://<tu-usuario>.github.io/<nombre-del-repo>/
```

> El archivo `.nojekyll` ya está incluido en el repo para que GitHub Pages sirva los módulos ES correctamente.

---

## Configurar la API Key

La API Key **nunca se incluye en el código fuente** — se guarda en el `localStorage` del navegador.

### Pasos

1. Abre la aplicación en el navegador
2. Haz clic en **Configuración** (esquina inferior izquierda del menú)
3. Pega tu API Key en el campo y pulsa **Guardar**

La clave queda almacenada localmente en tu navegador. Cada usuario que use la app deberá ingresar su propia clave.

### Obtener una API Key

Contacta al equipo de BDTR.NET para solicitar una API Key. La documentación oficial del API se encuentra en `apiAiBdtrDoc.txt`.

---

## Funcionalidades

| Sección | Endpoint | Descripción |
|---|---|---|
| Noticieros | `GET /getAiNoticieros` | Lista todos los noticieros disponibles |
| Notas | `GET /getAiNotes` | Busca notas por ciudad, fecha y canal |
| Detalle de nota | `GET /getAiNote` | Muestra encabezado, resumen y transcripción |
| Transcripción | `GET /getAiProgramTranscript` | Obtiene el VTT de un noticiero |
| Generar nota | `GET /processAiNote` | Genera una nota a partir de un segmento DVR |
| Webhook Notas | `POST/GET /setAiWebhook` `/queryAiWebhook` | Configura recepción automática de notas |
| Webhook VTT | `POST/GET /setAiVttHook` `/queryAiVttHook` | Configura recepción de transcripciones |
| Webhook Social | `POST/GET /setAiXHook` `/queryAiXHook` | Configura recepción de redes sociales |

---

## Ejecutar localmente

No requiere instalación. Basta con servir los archivos estáticos:

```bash
# Con Node.js
npx serve .

# Con Python
python3 -m http.server 8080

# Con VS Code
# Instala la extensión "Live Server" y abre index.html
```

Luego abre `http://localhost:8080` (o el puerto que indique el servidor).

> **Nota:** Abrir `index.html` directamente con `file://` no funciona porque los módulos ES requieren un servidor HTTP.

---

## Nota sobre CORS

La aplicación realiza las peticiones directamente desde el navegador hacia `api.bdtr.net`. Si el servidor de la API no incluye las cabeceras CORS necesarias, el navegador bloqueará las solicitudes.

En ese caso verás un error similar a:
```
Access to fetch at 'https://api.bdtr.net/...' has been blocked by CORS policy
```

Contacta a BDTR.NET para verificar que tu dominio de GitHub Pages esté habilitado, o configura un proxy si es necesario.

---

## Estructura del proyecto

```
├── index.html                  # SPA shell + modal de configuración
├── css/
│   └── style.css               # Sistema de diseño minimalista
├── js/
│   ├── api.js                  # Cliente API (todos los endpoints)
│   ├── app.js                  # Router y lógica principal
│   ├── utils.js                # Helpers (toast, spinner, escape HTML)
│   └── components/
│       ├── noticieros.js       # Vista de noticieros
│       ├── notas.js            # Vista de notas + detalle
│       ├── transcripcion.js    # Vista de transcripción VTT
│       ├── generarNota.js      # Vista de generación de notas
│       └── webhook.js          # Vista de webhooks (notas, VTT, social)
└── .nojekyll                   # Desactiva Jekyll en GitHub Pages
```
