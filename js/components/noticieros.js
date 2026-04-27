import { api } from '../api.js';
import {
  spinner, errorBanner, noKeyBanner, escHtml, todayYYYYMMDD,
  searchableSelectHTML, initSearchableSelect, renderPager,
} from '../utils.js';

/* ── cache de noticieros para evitar re-fetch al navegar ── */
let _all = [];

/* ── helper: busca un campo por nombre (case-insensitive) ── */
function f(obj, ...keys) {
  for (const k of keys) {
    const match = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
    if (match !== undefined && obj[match] != null && obj[match] !== '') return obj[match];
  }
  return null;
}

/* ════════════════════════════════════════════════════════
   VISTA PRINCIPAL — Lista de noticieros con filtros
   ════════════════════════════════════════════════════════ */
export async function renderNoticieros(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Noticieros</h1>
      <p>Busca y filtra los noticieros disponibles en BDTR AI</p>
    </div>
    <div class="card">
      <div class="filter-bar">
        <div class="filter-search-wrap">
          <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="nt-search" class="input filter-search-input" placeholder="Buscar noticiero, canal, ciudad…" autocomplete="off" />
        </div>
        <select id="nt-city" class="select filter-select">
          <option value="">Todas las ciudades</option>
        </select>
        ${searchableSelectHTML('nt-station', 'Filtrar por estación…')}
        <span id="nt-count" class="filter-count"></span>
      </div>
      <div id="nt-body">${spinner()}</div>
    </div>`;

  if (!localStorage.getItem('bdtr_api_key')) {
    container.querySelector('#nt-body').innerHTML = noKeyBanner();
    return;
  }

  try {
    if (!_all.length) {
      const raw = await api.getNoticieros();
      _all = Array.isArray(raw) ? raw : (raw.data ?? raw.noticieros ?? []);
    }
    initFilters(container);
    renderTable(container, _all);
  } catch (e) {
    container.querySelector('#nt-body').innerHTML = errorBanner(e.message);
  }
}

function initFilters(container) {
  /* Ciudades */
  const cities = [...new Set(
    _all.map(n => f(n, 'city', 'ciudad', 'city_code') ?? '').filter(Boolean)
  )].sort();
  const cityEl = container.querySelector('#nt-city');
  cities.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    cityEl.appendChild(opt);
  });

  /* Estaciones (Select2) */
  const stationsMap = new Map();
  _all.forEach(n => {
    const code  = String(f(n, 'channel', 'canal', 'channel_code', 'channelCode') ?? '');
    const name  = String(f(n, 'name', 'nombre', 'station_name', 'channel_name') ?? '');
    const city  = String(f(n, 'city', 'ciudad', 'city_code') ?? '');
    if (!code) return;
    if (!stationsMap.has(code)) {
      const label = name && name !== code ? `${name} — ${city}` : `${code} — ${city}`;
      stationsMap.set(code, { value: code, label });
    }
  });
  const stationOptions = [...stationsMap.values()].sort((a, b) => a.label.localeCompare(b.label));
  const ssWrap = container.querySelector('#nt-station');
  const ss = initSearchableSelect(ssWrap, stationOptions);

  /* Aplicar filtros */
  const apply = () => {
    const q       = (container.querySelector('#nt-search').value || '').toLowerCase();
    const city    = cityEl.value;
    const station = ss.getValue();

    let list = _all;
    if (q)       list = list.filter(n => Object.values(n).some(v => String(v ?? '').toLowerCase().includes(q)));
    if (city)    list = list.filter(n => (f(n, 'city', 'ciudad', 'city_code') ?? '') === city);
    if (station) list = list.filter(n => String(f(n, 'channel', 'canal', 'channel_code', 'channelCode') ?? '') === station);

    renderTable(container, list);
  };

  container.querySelector('#nt-search').addEventListener('input', apply);
  cityEl.addEventListener('change', apply);
  ssWrap.addEventListener('ss:change', apply);
}

/* Estado de paginación para la tabla principal */
let _ntPage    = 1;
let _ntPerPage = 20;

function renderTable(container, items) {
  const el    = container.querySelector('#nt-body');
  const count = container.querySelector('#nt-count');
  if (count) count.textContent = `${items.length} noticiero(s)`;

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
      </svg>
      Sin noticieros para los filtros aplicados
    </div>`;
    _ntPage = 1;
    return;
  }

  /* Columnas: prioriza campos conocidos */
  const allKeys = Object.keys(items[0]);
  const priority = ['name','nombre','city','ciudad','channel','canal','code','codigo','date','fecha'];
  const sorted = [
    ...priority.map(p => allKeys.find(k => k.toLowerCase() === p)).filter(Boolean),
    ...allKeys.filter(k => !priority.includes(k.toLowerCase())),
  ];
  const keys = [...new Set(sorted)];

  el.innerHTML = `
    <div id="nt-pager-top"></div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${keys.map(k => `<th>${escHtml(k)}</th>`).join('')}
            <th></th>
          </tr>
        </thead>
        <tbody id="nt-tbody"></tbody>
      </table>
    </div>
    <div id="nt-pager-bottom"></div>`;

  function paintRows() {
    const start  = (_ntPage - 1) * _ntPerPage;
    const slice  = items.slice(start, start + _ntPerPage);
    const tbody  = el.querySelector('#nt-tbody');
    tbody.innerHTML = '';

    slice.forEach(row => {
      const city    = String(f(row, 'city', 'ciudad', 'city_code') ?? '');
      const channel = String(f(row, 'channel', 'canal', 'channel_code', 'channelCode') ?? '');
      const code    = String(f(row, 'code', 'codigo', 'noticiero_code') ?? '');
      const label   = String(f(row, 'name', 'nombre', 'station_name') ?? channel);

      const tr = document.createElement('tr');
      tr.innerHTML =
        keys.map(k => `<td>${escHtml(String(row[k] ?? '-'))}</td>`).join('') +
        `<td>
          <button class="btn btn-sm btn-secondary btn-ver-notas"
            data-city="${escHtml(city)}"
            data-channel="${escHtml(channel)}"
            data-code="${escHtml(code)}"
            data-label="${escHtml(label)}">
            Ver notas →
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-ver-notas').forEach(btn => {
      btn.addEventListener('click', () => {
        const { city, channel, code, label } = btn.dataset;
        renderNotasView(container, { city, channel, code, label });
      });
    });

    const onPage = (p, pp) => { _ntPage = p; _ntPerPage = pp; paintRows(); };
    renderPager(el.querySelector('#nt-pager-top'),    items.length, _ntPage, _ntPerPage, onPage);
    renderPager(el.querySelector('#nt-pager-bottom'), items.length, _ntPage, _ntPerPage, onPage);
  }

  /* Resetea la página solo cuando cambia el conjunto de items (filtros) */
  _ntPage = 1;
  paintRows();
}

/* ════════════════════════════════════════════════════════
   SUB-VISTA — Notas de un noticiero
   cachedItems / listState se usan al volver del detalle sin re-fetch
   ════════════════════════════════════════════════════════ */
function renderNotasView(container, ctx, cachedItems = null, listState = null) {
  container.innerHTML = `
    <div class="sub-page-header">
      <button class="back-btn" id="btn-back-list">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Noticieros
      </button>
      <h1>${escHtml(ctx.label || ctx.channel)}</h1>
      <p>${escHtml(ctx.city)}${ctx.channel ? ' · ' + escHtml(ctx.channel) : ''}${ctx.code ? ' · Código ' + escHtml(ctx.code) : ''}</p>
    </div>
    <div id="notas-result"></div>`;

  container.querySelector('#btn-back-list').addEventListener('click', () => renderNoticieros(container));

  const result = container.querySelector('#notas-result');

  if (cachedItems) {
    /* Regreso del detalle — sin re-fetch */
    renderNotasList(container, result, cachedItems, ctx, listState);
  } else {
    /* Primera carga: busca los últimos 30 días */
    fetchNotasRange(container, result, ctx, 0, 30, []);
  }
}

/* ──────────────────────────────────────────────────────
   Genera string YYYYMMDD para "hace N días"
   ────────────────────────────────────────────────────── */
function offsetDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/* ──────────────────────────────────────────────────────
   Clave de ordenamiento descendente: YYYYMMDD + HHMMSS
   ────────────────────────────────────────────────────── */
function sortKey(row) {
  return String(row.date ?? row.fecha ?? '') + String(row.time ?? row.hora ?? '');
}

/* ──────────────────────────────────────────────────────
   Fetch de un rango de días en lotes paralelos de 5
   startOffset = primer día a buscar (0 = hoy)
   numDays     = cuántos días hacia atrás buscar
   existing    = notas ya obtenidas en llamadas previas
   ────────────────────────────────────────────────────── */
async function fetchNotasRange(container, result, ctx, startOffset, numDays, existing) {
  const BATCH = 5;
  const dates = Array.from({ length: numDays }, (_, i) => offsetDate(startOffset + i));

  let fetched  = 0;
  let allItems = [...existing];

  const showProgress = (done) => {
    const pct = Math.round((done / dates.length) * 100);
    result.innerHTML = `<div class="card">
      <div class="fetch-progress">
        <div class="spinner"></div>
        <span>Buscando notas… ${done} / ${dates.length} días revisados</span>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    </div>`;
  };

  showProgress(0);

  for (let i = 0; i < dates.length; i += BATCH) {
    /* Verifica que el contenedor sigue en el DOM (usuario no navegó) */
    if (!container.querySelector('#notas-result')) return;

    const batch = dates.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(date => api.getNotes(ctx.city, date, ctx.channel, ctx.code || undefined))
    );

    settled.forEach(r => {
      if (r.status === 'fulfilled') {
        const items = Array.isArray(r.value)
          ? r.value
          : (r.value.data ?? r.value.notes ?? r.value.notas ?? []);
        allItems.push(...items);
      }
      fetched++;
    });

    showProgress(fetched);
  }

  /* Ordena de más reciente a más antigua */
  allItems.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  const enrichedCtx = {
    ...ctx,
    _fetchedOffset: startOffset + numDays, /* próximo offset para "cargar más" */
  };

  renderNotasList(container, result, allItems, enrichedCtx);
}

function renderNotasList(container, el, allItems, ctx, savedState = null) {
  const fetchedOffset = ctx._fetchedOffset ?? 30;

  if (!allItems.length) {
    el.innerHTML = `<div class="card">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Sin notas en los últimos ${fetchedOffset} días
      </div>
      <div style="text-align:center;padding-bottom:16px">
        <button id="btn-load-more-empty" class="btn btn-secondary">
          Buscar en días anteriores
        </button>
      </div>
    </div>`;
    el.querySelector('#btn-load-more-empty').addEventListener('click', () => {
      fetchNotasRange(container, el, ctx, fetchedOffset, 30, []);
    });
    return;
  }

  const daysLabel = `últimos ${fetchedOffset} días`;

  el.innerHTML = `<div class="card">
    <div class="results-filter-bar">
      <div class="results-filter-wrap">
        <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="notas-text-filter" class="input results-filter-input" placeholder="Filtrar por título, fecha, tipo…" autocomplete="off" />
      </div>
      <span id="notas-count" class="results-count"></span>
    </div>
    <div id="notas-pager-top"></div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:90px">Fecha</th>
          <th style="width:70px">Hora</th>
          <th style="width:100px">Noticiero</th>
          <th style="width:100px">Tipo</th>
          <th>Título / Encabezado</th>
          <th style="width:100px"></th>
        </tr></thead>
        <tbody id="notas-tbody"></tbody>
      </table>
    </div>
    <div id="notas-pager-bottom"></div>
    <div style="text-align:center;padding-top:14px;border-top:1px solid var(--border);margin-top:8px">
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
        Mostrando notas de los ${daysLabel}
      </p>
      <button id="btn-load-more" class="btn btn-secondary btn-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
        </svg>
        Cargar 30 días anteriores
      </button>
    </div>
  </div>`;

  let filtered = allItems;
  let page     = savedState?.page    ?? 1;
  let perPage  = savedState?.perPage ?? 20;

  const textInput = el.querySelector('#notas-text-filter');

  if (savedState?.query) {
    textInput.value = savedState.query;
    filtered = applyFilter(allItems, savedState.query);
  }

  textInput.addEventListener('input', e => {
    filtered = applyFilter(allItems, e.target.value);
    page = 1;
    paint();
  });

  el.querySelector('#btn-load-more').addEventListener('click', () => {
    fetchNotasRange(container, el, ctx, fetchedOffset, 30, allItems);
  });

  function paint() {
    const countEl = el.querySelector('#notas-count');
    if (countEl) countEl.textContent = `${filtered.length} nota(s)`;

    const slice = filtered.slice((page - 1) * perPage, page * perPage);
    const tbody = el.querySelector('#notas-tbody');
    tbody.innerHTML = '';

    slice.forEach(row => {
      const p     = parseNoteRow(row, ctx);
      const tr    = document.createElement('tr');
      tr.innerHTML = `
        <td style="white-space:nowrap;font-size:12px">${escHtml(p.fecha)}</td>
        <td style="white-space:nowrap;font-size:12px">${escHtml(p.hora)}</td>
        <td style="white-space:nowrap">
          <span style="font-size:11px;color:var(--text-muted)">${escHtml(p.noticiero)}</span>
        </td>
        <td>
          ${p.tipo !== '-'
            ? `<span class="badge badge-blue">${escHtml(p.tipo)}</span>`
            : `<span style="color:var(--text-muted);font-size:12px">—</span>`}
        </td>
        <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${p.titulo !== '-'
            ? escHtml(p.titulo)
            : `<span style="color:var(--text-muted);font-size:12px">${escHtml(p.idShort)}</span>`}
        </td>
        <td>
          <button class="btn btn-sm btn-primary btn-ver-nota" data-id="${escHtml(p.id)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            Ver nota
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-ver-nota').forEach(btn => {
      btn.addEventListener('click', () => {
        const state = { page, perPage, query: textInput.value };
        fetchNoteDetail(container, btn.dataset.id, ctx, allItems, state);
      });
    });

    const onPage = (p, pp) => { page = p; perPage = pp; paint(); };
    renderPager(el.querySelector('#notas-pager-top'),    filtered.length, page, perPage, onPage);
    renderPager(el.querySelector('#notas-pager-bottom'), filtered.length, page, perPage, onPage);
  }

  paint();
}

/* ──────────────────────────────────────────────────────
   Extrae campos útiles de una nota. El ID tiene formato:
   {CITY}-{CHANNEL}-{YYYYMMDD}-{CODE}-{HHMMSS}-{suffix}
   ────────────────────────────────────────────────────── */
function parseNoteRow(row, ctx) {
  const rawId = typeof row === 'string'
    ? row
    : (row.id ?? row.Id ?? row.ID ?? row.noteId ?? row.note_id ?? String(Object.values(row)[0] ?? ''));
  const id = String(rawId);

  /* Detecta fecha (8 dígitos) y hora (6 dígitos) dentro del ID */
  const parts    = id.split('-');
  const datePart = parts.find(p => /^\d{8}$/.test(p)) ?? '';
  const timePart = parts.find(p => /^\d{6}$/.test(p)) ?? '';

  const fecha = datePart
    ? `${datePart.slice(6, 8)}/${datePart.slice(4, 6)}/${datePart.slice(0, 4)}`
    : pick(row, 'date', 'fecha') || '-';

  const hora = timePart
    ? `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`
    : pick(row, 'time', 'hora') || '-';

  const tipo   = pick(row, 'type', 'tipo', 'category', 'note_type', 'noteType') || '-';
  const titulo = pick(row, 'headline', 'title', 'encabezado', 'nota', 'titulo',
                          'header', 'subject', 'summary', 'resumen') || '-';

  /* Noticiero: usa label del ctx + código */
  const noticiero = ctx.code ? `${ctx.label || ctx.channel} (${ctx.code})` : (ctx.label || ctx.channel || '-');

  /* Versión corta del ID para mostrar como fallback */
  const idShort = id.length > 40 ? `…${id.slice(-30)}` : id;

  return { id, fecha, hora, tipo, titulo, noticiero, idShort };
}

/* Busca un campo en el objeto row probando múltiples nombres (case-insensitive) */
function pick(row, ...keys) {
  if (typeof row !== 'object' || !row) return '';
  for (const k of keys) {
    const match = Object.keys(row).find(ok => ok.toLowerCase() === k.toLowerCase());
    if (match && row[match] != null && row[match] !== '') return String(row[match]);
  }
  return '';
}

function applyFilter(items, q) {
  if (!q.trim()) return items;
  const lq = q.toLowerCase();
  return items.filter(row => {
    const p = parseNoteRow(row, {});
    return [p.titulo, p.tipo, p.fecha, p.noticiero, p.id,
            pick(row, 'summary', 'resumen')]
      .join(' ').toLowerCase().includes(lq);
  });
}

/* ════════════════════════════════════════════════════════
   SUB-VISTA — Detalle de una nota
   ════════════════════════════════════════════════════════ */
async function fetchNoteDetail(container, id, ctx, allItems, listState) {
  container.innerHTML = `
    <div class="sub-page-header">
      <button class="back-btn" id="btn-back-notas">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Volver a notas
      </button>
      <h1>Nota</h1>
      <p>${escHtml(ctx.label || ctx.channel)} · ${escHtml(ctx.city)} · ${escHtml(ctx.date ?? '')}</p>
    </div>
    <div class="card" id="detail-card">${spinner()}</div>`;

  /* Restaura la lista sin re-fetch, preservando página y filtro */
  container.querySelector('#btn-back-notas').addEventListener('click', () => {
    renderNotasView(container, ctx, allItems, listState);
  });

  try {
    const note = await api.getNote(id);
    renderNoteDetail(container.querySelector('#detail-card'), note);
  } catch (e) {
    container.querySelector('#detail-card').innerHTML = errorBanner(e.message);
  }
}

function renderNoteDetail(card, note) {
  const d = note.data ?? note.note ?? note;

  const headline   = d.headline   ?? d.encabezado ?? d.title ?? null;
  const summary    = d.summary    ?? d.resumen ?? null;
  const transcript = d.transcript ?? d.transcripcion ?? null;

  const knownKeys = new Set([
    'id','channel','canal','city','ciudad','date','fecha','time','hora',
    'duration','duracion','type','tipo',
    'headline','encabezado','title','summary','resumen','transcript','transcripcion',
  ]);

  const metaFields = [
    ['Canal',    d.channel  ?? d.canal],
    ['Ciudad',   d.city     ?? d.ciudad],
    ['Fecha',    d.date     ?? d.fecha],
    ['Hora',     d.time     ?? d.hora],
    ['Duración', d.duration ?? d.duracion],
    ['Tipo',     d.type     ?? d.tipo],
    ['ID',       d.id       ?? d.ID],
  ].filter(([, v]) => v != null && v !== '');

  const extras = Object.entries(d).filter(
    ([k, v]) => !knownKeys.has(k.toLowerCase()) && v != null && v !== ''
  );

  card.innerHTML = `
    ${headline ? `
    <div class="detail-section">
      <h3>Encabezado</h3>
      <p class="note-headline">${escHtml(headline)}</p>
    </div>` : ''}

    <div class="detail-section">
      <h3>Metadatos</h3>
      <dl class="meta-grid">
        ${metaFields.map(([l, v]) => `
          <div class="detail-field">
            <dt>${escHtml(l)}</dt>
            <dd>${escHtml(String(v))}</dd>
          </div>`).join('')}
      </dl>
    </div>

    ${summary ? `
    <div class="detail-section">
      <h3>Resumen</h3>
      <p style="line-height:1.7;font-size:14px">${escHtml(summary)}</p>
    </div>` : ''}

    ${transcript ? `
    <div class="detail-section">
      <h3>Transcripción</h3>
      <div class="transcript-box">${escHtml(transcript)}</div>
    </div>` : ''}

    ${extras.length ? `
    <details class="extras-details">
      <summary>
        Campos adicionales
        <span class="badge badge-blue">${extras.length}</span>
      </summary>
      <dl class="meta-grid" style="margin-top:10px">
        ${extras.map(([k, v]) => `
          <div class="detail-field">
            <dt>${escHtml(k)}</dt>
            <dd>${escHtml(String(v))}</dd>
          </div>`).join('')}
      </dl>
    </details>` : ''}

    ${!headline && !summary && !transcript && !extras.length ? `
    <details>
      <summary style="cursor:pointer;color:var(--text-muted);font-size:12px">Ver datos completos (JSON)</summary>
      <pre style="margin-top:10px;font-size:11px;overflow:auto;line-height:1.5">${escHtml(JSON.stringify(d, null, 2))}</pre>
    </details>` : ''}`;
}
