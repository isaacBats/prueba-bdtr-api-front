import { api } from '../api.js';
import { spinner, errorBanner, noKeyBanner, escHtml, todayYYYYMMDD } from '../utils.js';

export function renderNotas(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Notas</h1>
      <p>Busca notas por estación o noticiero</p>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="grid grid-2" style="gap:12px">
        <div class="field">
          <label class="field-label">Ciudad (CITY_CODE)</label>
          <input id="n-city" class="input" placeholder="Ej: DF_MEX" value="DF_MEX" />
        </div>
        <div class="field">
          <label class="field-label">Canal (CHANNEL_CODE)</label>
          <input id="n-channel" class="input" placeholder="Ej: F100_1" value="F100_1" />
        </div>
        <div class="field">
          <label class="field-label">Fecha (YYYYMMDD)</label>
          <input id="n-date" class="input" placeholder="Ej: 20231101" value="${todayYYYYMMDD()}" />
        </div>
        <div class="field">
          <label class="field-label">Código Noticiero (opcional)</label>
          <input id="n-code" class="input" placeholder="Ej: 1718" />
        </div>
      </div>
      <button id="btn-search-notes" class="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Buscar
      </button>
    </div>
    <div id="notes-result"></div>`;

  container.querySelector('#btn-search-notes').addEventListener('click', () => {
    searchNotes(container);
  });

  container.querySelectorAll('.input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') searchNotes(container); });
  });
}

async function searchNotes(container) {
  if (!localStorage.getItem('bdtr_api_key')) {
    container.querySelector('#notes-result').innerHTML = noKeyBanner();
    return;
  }

  const city = container.querySelector('#n-city').value.trim();
  const channel = container.querySelector('#n-channel').value.trim();
  const date = container.querySelector('#n-date').value.trim();
  const code = container.querySelector('#n-code').value.trim();

  if (!city || !channel || !date) {
    container.querySelector('#notes-result').innerHTML =
      `<div class="error-banner">Ciudad, Canal y Fecha son obligatorios.</div>`;
    return;
  }

  const result = container.querySelector('#notes-result');
  result.innerHTML = `<div class="card">${spinner()}</div>`;

  try {
    const data = await api.getNotes(city, date, channel, code || undefined);
    const items = Array.isArray(data) ? data : (data.data ?? data.notes ?? data.notas ?? []);
    renderNotesTable(result, items, container);
  } catch (e) {
    result.innerHTML = `<div class="card">${errorBanner(e.message)}</div>`;
  }
}

function renderNotesTable(el, items, container) {
  if (!items.length) {
    el.innerHTML = `<div class="card"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Sin notas para los parámetros indicados
    </div></div>`;
    return;
  }

  const cols = ['id', 'title', 'time', 'duration', 'type'];
  const safeGet = (row, key) => {
    const hit = Object.keys(row).find(k => k.toLowerCase() === key);
    return hit ? row[hit] : row[Object.keys(row)[cols.indexOf(key)]] ?? '-';
  };

  el.innerHTML = `<div class="card">
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>ID</th><th>Título / Encabezado</th><th>Hora</th><th>Duración</th><th>Tipo</th><th></th>
        </tr></thead>
        <tbody id="notes-tbody"></tbody>
      </table>
    </div>
    <p style="margin-top:12px;color:var(--text-muted);font-size:12px">${items.length} nota(s)</p>
  </div>`;

  const tbody = el.querySelector('#notes-tbody');
  items.forEach(row => {
    const id = row.id ?? row.Id ?? Object.values(row)[0];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:11px">${escHtml(String(id))}</td>
      <td>${escHtml(String(row.title ?? row.headline ?? row.encabezado ?? row.nota ?? '-'))}</td>
      <td>${escHtml(String(row.time ?? row.hora ?? '-'))}</td>
      <td>${escHtml(String(row.duration ?? row.duracion ?? '-'))}</td>
      <td>${escHtml(String(row.type ?? row.tipo ?? '-'))}</td>
      <td><button class="btn btn-sm btn-secondary btn-detail" data-id="${escHtml(String(id))}">Ver detalle</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      loadNoteDetail(container, btn.dataset.id);
    });
  });
}

async function loadNoteDetail(container, id) {
  container.innerHTML = `
    <button class="back-btn" id="btn-back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Volver a notas
    </button>
    <div class="card">${spinner()}</div>`;

  container.querySelector('#btn-back').addEventListener('click', () => renderNotas(container));

  try {
    const note = await api.getNote(id);
    renderNoteDetail(container, note);
  } catch (e) {
    container.querySelector('.card').innerHTML = errorBanner(e.message);
  }
}

function renderNoteDetail(container, note) {
  const data = note.data ?? note.note ?? note;
  container.querySelector('.card').innerHTML = `
    <div class="detail-section">
      <h3>Identificación</h3>
      <dl>
        ${detailField('ID', data.id)}
        ${detailField('Canal', data.channel ?? data.canal)}
        ${detailField('Ciudad', data.city ?? data.ciudad)}
        ${detailField('Fecha', data.date ?? data.fecha)}
        ${detailField('Hora', data.time ?? data.hora)}
        ${detailField('Duración', data.duration ?? data.duracion)}
        ${detailField('Tipo', data.type ?? data.tipo)}
      </dl>
    </div>
    ${data.headline || data.encabezado ? `
    <div class="detail-section">
      <h3>Encabezado</h3>
      <p style="line-height:1.6">${escHtml(data.headline ?? data.encabezado)}</p>
    </div>` : ''}
    ${data.summary || data.resumen ? `
    <div class="detail-section">
      <h3>Resumen</h3>
      <p style="line-height:1.6">${escHtml(data.summary ?? data.resumen)}</p>
    </div>` : ''}
    ${data.transcript || data.transcripcion ? `
    <div class="detail-section">
      <h3>Transcripción</h3>
      <div class="transcript-box">${escHtml(data.transcript ?? data.transcripcion)}</div>
    </div>` : ''}
    ${(!data.headline && !data.encabezado && !data.summary && !data.resumen && !data.transcript) ? `
    <details>
      <summary style="cursor:pointer;color:var(--text-muted);font-size:12px">Ver datos completos</summary>
      <pre style="margin-top:8px;font-size:11px;overflow:auto">${escHtml(JSON.stringify(data, null, 2))}</pre>
    </details>` : ''}`;
}

function detailField(label, value) {
  return `<div class="detail-field"><dt>${escHtml(label)}</dt><dd>${escHtml(String(value ?? '-'))}</dd></div>`;
}
