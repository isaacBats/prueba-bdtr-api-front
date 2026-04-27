import { api } from '../api.js';
import {
  spinner, errorBanner, noKeyBanner, escHtml, todayYYYYMMDD,
  searchableSelectHTML, initSearchableSelect,
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
    </div>`;

  const tbody = el.querySelector('#nt-tbody');
  items.forEach(row => {
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
}

/* ════════════════════════════════════════════════════════
   SUB-VISTA — Notas de un noticiero
   ════════════════════════════════════════════════════════ */
function renderNotasView(container, ctx) {
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

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div class="field" style="margin:0">
          <label class="field-label">Fecha (YYYYMMDD)</label>
          <input id="notas-date" class="input" type="text" value="${todayYYYYMMDD()}" style="width:140px" />
        </div>
        <button id="btn-buscar-notas" class="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Buscar notas
        </button>
      </div>
    </div>

    <div id="notas-result"></div>`;

  container.querySelector('#btn-back-list').addEventListener('click', () => renderNoticieros(container));

  const doSearch = () => fetchNotas(container, ctx);
  container.querySelector('#btn-buscar-notas').addEventListener('click', doSearch);
  container.querySelector('#notas-date').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  /* Carga automática */
  doSearch();
}

async function fetchNotas(container, ctx) {
  const dateEl = container.querySelector('#notas-date');
  const date   = dateEl ? dateEl.value.trim() : '';
  const result = container.querySelector('#notas-result');
  result.innerHTML = `<div class="card">${spinner()}</div>`;

  try {
    const data  = await api.getNotes(ctx.city, date, ctx.channel, ctx.code || undefined);
    const items = Array.isArray(data) ? data : (data.data ?? data.notes ?? data.notas ?? []);
    renderNotasList(container, result, items, { ...ctx, date });
  } catch (e) {
    result.innerHTML = `<div class="card">${errorBanner(e.message)}</div>`;
  }
}

function renderNotasList(container, el, items, ctx) {
  if (!items.length) {
    el.innerHTML = `<div class="card"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      Sin notas para la fecha indicada
    </div></div>`;
    return;
  }

  el.innerHTML = `<div class="card">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Hora</th>
            <th>Duración</th>
            <th>Tipo</th>
            <th>Encabezado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="notas-tbody"></tbody>
      </table>
    </div>
    <p style="margin-top:10px;font-size:12px;color:var(--text-muted)">${items.length} nota(s)</p>
  </div>`;

  const tbody = el.querySelector('#notas-tbody');
  items.forEach(row => {
    const id   = row.id ?? row.Id ?? row.ID ?? Object.values(row)[0];
    const tipo = String(row.type ?? row.tipo ?? '-');
    const tr   = document.createElement('tr');
    tr.innerHTML = `
      <td style="white-space:nowrap">${escHtml(String(row.time ?? row.hora ?? '-'))}</td>
      <td style="white-space:nowrap">${escHtml(String(row.duration ?? row.duracion ?? '-'))}</td>
      <td><span class="badge badge-blue">${escHtml(tipo)}</span></td>
      <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${escHtml(String(row.headline ?? row.title ?? row.encabezado ?? row.nota ?? '-'))}
      </td>
      <td>
        <button class="btn btn-sm btn-secondary" data-id="${escHtml(String(id))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Ver detalle
        </button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => fetchNoteDetail(container, btn.dataset.id, ctx));
  });
}

/* ════════════════════════════════════════════════════════
   SUB-VISTA — Detalle de una nota
   ════════════════════════════════════════════════════════ */
async function fetchNoteDetail(container, id, ctx) {
  container.innerHTML = `
    <div class="sub-page-header">
      <button class="back-btn" id="btn-back-notas">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Volver a notas
      </button>
      <h1>Detalle de nota</h1>
      <p>${escHtml(ctx.label || ctx.channel)} · ${escHtml(ctx.city)} · ${escHtml(ctx.date ?? '')}</p>
    </div>
    <div class="card" id="detail-card">${spinner()}</div>`;

  container.querySelector('#btn-back-notas').addEventListener('click', () => renderNotasView(container, ctx));

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
