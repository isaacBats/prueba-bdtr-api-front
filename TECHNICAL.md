# Documento Técnico — Opemedios / BDTR Noticias AI

**Versión:** 1.0  
**Fecha:** 2026-04-26  
**Audiencia:** Desarrolladores que mantengan o extiendan esta aplicación

---

## 1. Descripción general

Esta aplicación es una SPA (Single Page Application) estática escrita en JavaScript puro (ES Modules) sin frameworks ni dependencias de terceros. Consume la API REST de BDTR.NET para explorar noticieros, notas periodísticas procesadas por IA, transcripciones en formato VTT y webhooks de notificación.

El diseño no requiere servidor de aplicación: puede desplegarse directamente en GitHub Pages, Netlify, S3 o cualquier hosting estático.

---

## 2. Arquitectura

```
Navegador
│
├── index.html          Shell HTML + modal de configuración
├── js/app.js           Router de vistas (hash-based)
├── js/api.js           Capa HTTP — wrapper de fetch contra api.bdtr.net
├── js/utils.js         Utilidades compartidas
└── js/components/
    ├── noticieros.js   Módulo más complejo — lista, sub-vista de notas, detalle, generación
    ├── notas.js        Búsqueda directa de notas
    ├── transcripcion.js
    └── webhook.js
```

### Flujo de navegación

```
app.js::navigate(view)
  → limpia #view-container
  → llama a views[view](container)
  → el componente renderiza su HTML y registra sus propios listeners
```

No hay estado global compartido entre vistas. Cada componente gestiona su propio estado interno con variables de módulo (ej. `let _all = []` en noticieros.js para cachear la lista de noticieros).

### API Key

Se almacena en `localStorage` bajo la clave `bdtr_api_key`. Todos los requests la leen en tiempo de ejecución desde `api.js::getKey()`. Nunca se persiste en código fuente ni en el repositorio.

---

## 3. Módulo API (`js/api.js`)

### Autenticación

```http
x-api-key: <API_KEY>
```

Todas las peticiones incluyen esta cabecera. La función `request()` es la única que hace `fetch`:

```js
async function request(method, path, params = {}, body = null) { ... }
```

### Endpoints implementados

| Función exportada | Método | Endpoint | Parámetros clave |
|---|---|---|---|
| `getNoticieros()` | GET | `/getAiNoticieros` | — |
| `getNotes(city, date, channel, code?)` | GET | `/getAiNotes` | city, date, channel, code |
| `getNote(id)` | GET | `/getAiNote` | id |
| `getProgramTranscript(city, date, channel, code)` | GET | `/getAiProgramTranscript` | city, date, channel, code |
| `processAiNote(city, date, channel, code, time, dur, type?)` | GET | `/processAiNote` | city, date, channel, code, time, dur, type |
| `setWebhookNotas(url)` | POST | `/setAiWebhook` | urlWebhook |
| `queryWebhookNotas()` | GET | `/queryAiWebhook` | — |
| `setWebhookVtt(url)` | POST | `/setAiVttHook` | urlWebhook |
| `queryWebhookVtt()` | GET | `/queryAiVttHook` | — |
| `setWebhookSocial(url)` | POST | `/setAiXHook` | urlWebhook |
| `queryWebhookSocial()` | GET | `/queryAiXHook` | — |

---

## 4. Decisiones de implementación relevantes

### 4.1 Ausencia de campo `date` en el endpoint `/getAiNotes`

**Problema:** El endpoint `/getAiNotes` requiere el parámetro `date` (YYYYMMDD) como obligatorio. Sin embargo, el usuario necesita ver todas las notas recientes de un noticiero sin tener que elegir una fecha concreta.

**Solución implementada:** La sub-vista de notas (desde Noticieros) itera automáticamente los últimos 30 días hacia atrás, lanzando lotes de 5 peticiones en paralelo con `Promise.allSettled`. Los resultados se acumulan y se ordenan por fecha/hora descendente.

```js
// Lote paralelo de 5 fechas
const settled = await Promise.allSettled(
  batch.map(date => api.getNotes(ctx.city, date, ctx.channel, ctx.code))
);
```

El usuario puede ampliar el rango con el botón "Cargar 30 días anteriores", que reutiliza las notas ya cargadas sin descartarlas.

**Coste:** Hasta 30 peticiones HTTP por rango. Con lotes de 5 en paralelo, el tiempo de carga es equivalente a 6 peticiones secuenciales.

### 4.2 Parsing del ID de nota

**Problema:** El endpoint `/getAiNotes` devuelve objetos con campos mínimos. En muchos casos solo está presente el campo `id` con el formato compuesto:

```
{CITY}-{CHANNEL}-{YYYYMMDD}-{CODE}-{HHMMSS}-{suffix}
Ejemplo: DF_MEX-A1000-20260424-1718-073503-586
```

Los campos `date`, `time`, `type`, `headline` pueden estar ausentes en el listado aunque sí aparecen en el detalle (`/getAiNote`).

**Solución implementada:** La función `parseNoteRow(row, ctx)` detecta por regex los segmentos del ID:

```js
const datePart = parts.find(p => /^\d{8}$/.test(p)); // YYYYMMDD
const timePart = parts.find(p => /^\d{6}$/.test(p)); // HHMMSS
```

Esto permite mostrar fecha y hora en la tabla del listado sin necesidad de una petición adicional por fila.

### 4.3 Searchable Select (Select2-like)

Se implementó un widget de búsqueda sobre listas desplegables (`searchableSelectHTML` + `initSearchableSelect` en `utils.js`) sin librerías externas. Características:

- Renderiza hasta 80 opciones, muestra un hint "N más — continúa escribiendo" si hay más
- Emite el evento personalizado `ss:change` en el wrapper, compatible con `addEventListener`
- Limpieza con botón ×
- Cierre con Escape o blur con un debounce de 160 ms para permitir clicks en opciones

### 4.4 Paginación

La función `renderPager(el, total, page, perPage, onChange)` en `utils.js` renderiza controles de paginación con elipsis:

```
‹  1  2  3  …  125  ›   [20 por pág. ▾]
```

El algoritmo de elipsis mantiene siempre visible la primera, la última y las dos páginas adyacentes a la actual. El callback `onChange(page, perPage)` permite que cada componente gestione su propio estado sin acoplamiento.

### 4.5 Preservación de estado al navegar al detalle y volver

Cuando el usuario abre el detalle de una nota desde el listado, se guarda el estado actual:

```js
const state = { page, perPage, query: textInput.value };
fetchNoteDetail(container, id, ctx, allItems, state);
```

Al volver, se restaura la lista desde caché (`allItems`) sin re-fetch, y se aplican de nuevo el filtro y la página guardados. Esto evita recargar hasta 30 peticiones HTTP solo por navegar hacia atrás.

### 4.6 Generación de nota desde el detalle

El panel "Generar nota" en el detalle pre-llena los parámetros de `processAiNote` desde los campos del objeto `d` (respuesta de `/getAiNote`), con fallback a `ctx` (datos del noticiero padre):

```js
const genCity    = d.city    ?? d.ciudad    ?? ctx.city;
const genChannel = d.channel ?? d.canal     ?? ctx.channel;
const genTime    = String(d.time ?? d.hora ?? '').replace(/:/g, ''); // normaliza HH:MM:SS → HHMMSS
```

La duración es editable por si la API no la devuelve directamente en el listado.

---

## 5. Comportamiento observado de la API

A partir de las pruebas realizadas durante el desarrollo:

| Observación | Detalle |
|---|---|
| `/getAiNotes` devuelve datos mínimos | En producción los objetos pueden contener solo el campo `id`. Los demás campos (headline, type, duration) se obtienen solo con `/getAiNote` |
| El ID es la fuente de verdad para fecha/hora | El formato `CITY-CHANNEL-YYYYMMDD-CODE-HHMMSS-suffix` es consistente |
| `date` es obligatorio en `/getAiNotes` | No existe un endpoint de búsqueda sin filtro de fecha |
| La generación de notas es asíncrona | `/processAiNote` devuelve el ID inmediatamente pero el contenido tarda en procesarse |
| Los webhooks no tienen validación de URL | Se puede enviar cualquier string como `urlWebhook` |

---

## 6. Áreas de oportunidad en la API

### 6.1 Endpoint de listado de notas sin fecha obligatoria

El requerimiento más frecuente es "dame las notas recientes de este noticiero". Actualmente requiere iterar día a día, generando N peticiones HTTP. Un endpoint como:

```
GET /getAiNotes?city=DF_MEX&channel=A1000&code=1718&from=20260301&to=20260426&limit=50&offset=0
```

Con soporte de rango de fechas y paginación server-side eliminaría la necesidad de lotes paralelos desde el cliente.

### 6.2 Campos enriquecidos en el listado de notas

El endpoint `/getAiNotes` debería devolver al menos `headline`, `type`, `duration` y `time` para cada nota. Actualmente el cliente debe hacer una petición adicional por nota para mostrar información básica, lo que hace inviable pre-cargar títulos en el listado.

```json
// Respuesta ideal de /getAiNotes
[
  {
    "id": "DF_MEX-A1000-20260424-1718-073503-586",
    "date": "20260424",
    "time": "073503",
    "duration": 124,
    "type": "general",
    "headline": "Texto del encabezado..."
  }
]
```

### 6.3 Búsqueda full-text en notas

No existe un endpoint de búsqueda por contenido. Para buscar una nota por palabra clave el cliente debe descargar todos los listados y filtrar en memoria. Un endpoint como:

```
GET /searchAiNotes?q=presupuesto&city=DF_MEX&channel=A1000&from=20260101
```

permitiría búsquedas eficientes sobre el corpus completo.

### 6.4 Endpoint de estado de nota generada

`/processAiNote` es asíncrono: devuelve el ID pero el contenido puede tardar varios segundos en estar disponible. No existe un endpoint para consultar el estado del proceso (`pending`, `done`, `error`). Una implementación de polling o webhook de notificación de completitud mejoraría la UX considerablemente.

### 6.5 Cabeceras CORS explícitas

Para uso desde aplicaciones web estáticas (GitHub Pages, Netlify, etc.) la API debe incluir:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: x-api-key, Content-Type
Access-Control-Allow-Methods: GET, POST
```

Sin estas cabeceras, el navegador bloquea todas las peticiones al detectar un origen cruzado.

### 6.6 Paginación server-side en noticieros

`/getAiNoticieros` devuelve la lista completa en una sola respuesta. Si el catálogo crece, la descarga inicial puede volverse lenta. Se recomienda agregar soporte de paginación:

```
GET /getAiNoticieros?limit=100&offset=0
```

### 6.7 Autenticación más robusta

La API Key se envía como cabecera HTTP plana. Para mayor seguridad se podría:
- Añadir soporte de tokens con expiración (JWT o similar)
- Permitir scopes por endpoint (solo lectura vs. escritura/generación)
- Implementar rate limiting con cabeceras de respuesta estándar (`X-RateLimit-Remaining`, `Retry-After`)

### 6.8 Webhook de confirmación de generación

Actualmente solo existen webhooks para recibir notas, transcripciones y publicaciones sociales ya procesadas. Sería útil un webhook específico que notifique cuando una nota generada con `/processAiNote` está lista, incluyendo el ID original de la solicitud para correlacionar la respuesta.

---

## 7. Guía de extensión

### Agregar un nuevo endpoint

1. Añadir la función al objeto exportado en `js/api.js`
2. Crear o modificar el componente correspondiente en `js/components/`
3. Si necesita vista propia, agregar la entrada en el objeto `views` de `js/app.js` y el `<a>` en el `<nav>` de `index.html`

### Agregar un componente nuevo

```js
// js/components/miVista.js
import { api } from '../api.js';
import { spinner, errorBanner, escHtml } from '../utils.js';

export async function renderMiVista(container) {
  container.innerHTML = `<div class="page-header"><h1>Mi Vista</h1></div>
                         <div class="card" id="body">${spinner()}</div>`;
  try {
    const data = await api.miEndpoint();
    container.querySelector('#body').innerHTML = /* render */;
  } catch (e) {
    container.querySelector('#body').innerHTML = errorBanner(e.message);
  }
}
```

### Agregar persistencia local (sql.js)

Si se requiere cachear datos entre sesiones más allá de `localStorage`, se puede integrar [sql.js](https://sql.js.org) (SQLite compilado a WebAssembly) sin necesidad de backend:

```js
import initSqlJs from 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
const SQL  = await initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}` });
const db   = new SQL.Database();
db.run('CREATE TABLE IF NOT EXISTS notas (id TEXT PRIMARY KEY, json TEXT)');
```

---

## 8. Historial de commits relevantes

| Commit | Cambio |
|---|---|
| `13e3cc1` | Base: HTML shell, CSS, cliente API, router |
| `bc25d37` | Vista Noticieros |
| `6ab712e` | Vista Notas + Detalle |
| `92b634f` | Vista Transcripción |
| `d58c807` | Gestión de Webhooks |
| `00501bc` | Paginación CSS + `renderPager` |
| `9378734` | Paginador en Noticieros |
| `89b4f40` | Select2 canal, filtro y paginador en Notas |
| `a8d9e07` | Botón "Ver nota" y restauración de estado |
| `610db11` | Auto-fetch últimos 30 días, barra de progreso |
| `2468eef` | Parsing de ID para fecha/hora, columnas enriquecidas |
| `78417b5` | Panel "Generar nota" inline en el detalle |
