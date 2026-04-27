import { api } from '../api.js';
import {
  spinner, errorBanner, noKeyBanner, escHtml, todayYYYYMMDD,
  searchableSelectHTML, initSearchableSelect, renderPager,
} from '../utils.js';

/* ── Noticieros cache (para poblar los selects) ── */
let _noticieros = [];

function f(obj, ...keys) {
  for (const k of keys) {
    const match = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
    if (match !== undefined && obj[match] != null && obj[match] !== '') return obj[match];
  }
  return null;
}

/* ════════════════════════════════════════════════════════
   VISTA PRINCIPAL
   ════════════════════════════════════════════════════════ */
export async function renderNotas(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Notas</h1>
      <p>Busca notas por estación o noticiero</p>
    </div>
    <div class="card" id="form-card">
      <div id="form-body">${spinner()}</div>
    </div>
    <div id="notes-result"></div>`;

  if (!localStorage.getItem('bdtr_api_key')) {
    container.querySelector('#form-body').innerHTML = noKeyBanner();
    return;
  }

  try {
    if (!_noticieros.length) {
      const raw = await api.getNoticieros();
      _noticieros = Array.isArray(raw) ? raw : (raw.data ?? raw.noticieros ?? []);
    }
    buildForm(container);
  } catch (e) {
    container.querySelector('#form-body').innerHTML = errorBanner(e.message);
  }
}

/* ════════════════════════════════════════════════════════
   FORMULARIO DE BÚSQUEDA
   ════════════════════════════════════════════════════════ */
function buildForm(container) {
  /* Ciudades únicas */
  const cities = [...new Set(
    _noticieros.map(n => f(n, 'city', 'ciudad', 'city_code') ?? '').filter(Boolean)
  )].sort();

  container.querySelector('#form-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field" style="margin:0">
        <label class="field-label">Ciudad</label>
        <select id="n-city" class="select">
          <option value="">— Selecciona ciudad —</option>
          ${cities.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin:0">
        <label class="field-label">Canal / Estación</label>
        ${searchableSelectHTML('n-channel', 'Escribe para buscar canal…')}
      </div>
      <div class="field" style="margin:0">
        <label class="field-label">Fecha (YYYYMMDD)</label>
        <input id="n-date" class="input" placeholder="Ej: 20231101" value="${todayYYYYMMDD()}" />
      </div>
      <div class="field" style="margin:0">
        <label class="field-label">Código noticiero (opcional)</label>
        <input id="n-code" class="input" placeholder="Ej: 1718" />
      </div>
    </div>
    <div style="margin-top:14px;display:flex;align-items:center;gap:10px">
      <button id="btn-search-notes" class="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Buscar notas
      </button>
      <span id="search-hint" class="hint" style="margin:0"></span>
    </div>`;

  /* Inicializa el Select2 del canal */
  const ssWrap = container.querySelector('#n-channel');
  const ss = initSearchableSelect(ssWrap, buildChannelOptions(''));

  /* Cuando cambia la ciudad, filtra los canales */
  container.querySelector('#n-city').addEventListener('change', e => {
    ss.clear();
    const opts = buildChannelOptions(e.target.value);
    /* Re-inicializar el select con las nuevas opciones */
    rebuildSelect(ssWrap, opts);
  });

  /* Buscar con Enter en los inputs de texto */
  ['#n-date', '#n-code'].forEach(sel => {
    container.querySelector(sel).addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch(container, ss);
    });
  });

  container.querySelector('#btn-search-notes').addEventListener('click', () => doSearch(container, ss));
}

function buildChannelOptions(city) {
  const seen = new Map();
  _noticieros.forEach(n => {
    const c = String(f(n, 'city', 'ciudad', 'city_code') ?? '');
    if (city && c !== city) return;
    const code  = String(f(n, 'channel', 'canal', 'channel_code', 'channelCode') ?? '');
    const name  = String(f(n, 'name', 'nombre', 'station_name', 'channel_name') ?? '');
    if (!code || seen.has(code)) return;
    const label = name && name !== code ? `${name} (${code})` : code;
    seen.set(code, { value: code, label: `${label}${city ? '' : ' — ' + c}` });
  });
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/* Reconstruye un ss-wrap existente con nuevas opciones sin perder el DOM */
function rebuildSelect(wrap, options) {
  const input    = wrap.querySelector('.ss-input');
  const dropdown = wrap.querySelector('.ss-dropdown');
  const control  = wrap.querySelector('.ss-control');
  input.value = '';
  wrap.dataset.value = '';
  wrap.classList.remove('has-value');
  control.classList.remove('open');
  dropdown.style.display = 'none';
  dropdown.innerHTML = '';
  /* Reemplaza los listeners simplemente re-inicializando con el parche de opciones */
  initSearchableSelect(wrap, options);
}

/* ════════════════════════════════════════════════════════
   BÚSQUEDA
   ════════════════════════════════════════════════════════ */
async function doSearch(container, ss) {
  const city    = container.querySelector('#n-city').value.trim();
  const channel = ss.getValue();
  const date    = container.querySelector('#n-date').value.trim();
  const code    = container.querySelector('#n-code').value.trim();
  const hint    = container.querySelector('#search-hint');

  if (!city || !channel || !date) {
    hint.textContent = 'Ciudad, canal y fecha son obligatorios.';
    hint.style.color = 'var(--danger)';
    return;
  }
  hint.textContent = '';

  const result = container.querySelector('#notes-result');
  result.innerHTML = `<div class="card">${spinner()}</div>`;

  try {
    const data  = await api.getNotes(city, date, channel, code || undefined);
    const items = Array.isArray(data) ? data : (data.data ?? data.notes ?? data.notas ?? []);
    renderResultsBlock(container, result, items, { city, channel, date, code });
  } catch (e) {
    result.innerHTML = `<div class="card">${errorBanner(e.message)}</div>`;
  }
}

/* ════════════════════════════════════════════════════════
   BLOQUE DE RESULTADOS (con buscador + paginador)
   ════════════════════════════════════════════════════════ */
function renderResultsBlock(container, el, allItems, ctx) {
  if (!allItems.length) {
    el.innerHTML = `<div class="card"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Sin notas para los parámetros indicados
    </div></div>`;
    return;
  }

  el.innerHTML = `<div class="card">
    <div class="results-filter-bar">
      <div class="results-filter-wrap">
        <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="notes-text-filter" class="input results-filter-input" placeholder="Filtrar por título, encabezado o resumen…" autocomplete="off" />
      </div>
      <span id="notes-count" class="results-count"></span>
    </div>
    <div id="pager-top"></div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:80px">Hora</th>
          <th style="width:80px">Duración</th>
          <th style="width:90px">Tipo</th>
          <th>Encabezado / Título</th>
          <th style="width:100px"></th>
        </tr></thead>
        <tbody id="notes-tbody"></tbody>
      </table>
    </div>
    <div id="pager-bottom"></div>
  </div>`;

  let filtered  = allItems;
  let page      = 1;
  let perPage   = 20;

  const textInput = el.querySelector('#notes-text-filter');
  textInput.addEventListener('input', () => {
    filtered = filterItems(allItems, textInput.value);
    page = 1;
    paint();
  });

  function paint() {
    const countEl = el.querySelector('#notes-count');
    if (countEl) countEl.textContent = `${filtered.length} nota(s)`;

    const slice = filtered.slice((page - 1) * perPage, page * perPage);
    renderRows(el.querySelector('#notes-tbody'), slice, (id) => {
      loadNoteDetail(container, id, ctx, allItems);
    });

    renderPager(el.querySelector('#pager-top'),    filtered.length, page, perPage, (p, pp) => { page = p; perPage = pp; paint(); });
    renderPager(el.querySelector('#pager-bottom'), filtered.length, page, perPage, (p, pp) => { page = p; perPage = pp; paint(); });
  }

  paint();
}

function filterItems(items, q) {
  if (!q.trim()) return items;
  const lq = q.toLowerCase();
  return items.filter(row => {
    const text = [
      row.headline, row.title, row.encabezado, row.nota,
      row.summary, row.resumen,
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(lq);
  });
}

function renderRows(tbody, items, onDetail) {
  tbody.innerHTML = '';
  items.forEach(row => {
    const id   = row.id ?? row.Id ?? row.ID ?? Object.values(row)[0];
    const tipo = String(row.type ?? row.tipo ?? '-');
    const tr   = document.createElement('tr');
    tr.innerHTML = `
      <td style="white-space:nowrap">${escHtml(String(row.time ?? row.hora ?? '-'))}</td>
      <td style="white-space:nowrap">${escHtml(String(row.duration ?? row.duracion ?? '-'))}</td>
      <td><span class="badge badge-blue">${escHtml(tipo)}</span></td>
      <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
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
    btn.addEventListener('click', () => onDetail(btn.dataset.id));
  });
}

/* ════════════════════════════════════════════════════════
   DETALLE DE NOTA
   ════════════════════════════════════════════════════════ */
async function loadNoteDetail(container, id, ctx) {
  container.innerHTML = `
    <div class="sub-page-header">
      <button class="back-btn" id="btn-back-notas">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Volver a notas
      </button>
      <h1>Detalle de nota</h1>
      <p>${escHtml(ctx.channel)} · ${escHtml(ctx.city)} · ${escHtml(ctx.date)}</p>
    </div>
    <div class="card" id="detail-card">${spinner()}</div>`;

  container.querySelector('#btn-back-notas').addEventListener('click', () => renderNotas(container));

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
      <summary>Campos adicionales <span class="badge badge-blue">${extras.length}</span></summary>
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
