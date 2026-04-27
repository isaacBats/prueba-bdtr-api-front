import { api } from '../api.js';
import { spinner, errorBanner, noKeyBanner, escHtml, todayYYYYMMDD } from '../utils.js';

const NOTE_TYPES = ['general', 'bursatil', 'clima', 'deportes', 'entrevista', 'infomercial', 'opinion', 'resumen', 'vial'];

export function renderGenerarNota(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Generar Nota</h1>
      <p>Genera una nota nueva a partir de un segmento del DVR. La generación es asíncrona.</p>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="grid grid-2" style="gap:12px">
        <div class="field">
          <label class="field-label">Ciudad (CITY_CODE)</label>
          <input id="g-city" class="input" placeholder="Ej: DF_MEX" value="DF_MEX" />
        </div>
        <div class="field">
          <label class="field-label">Canal (CHANNEL_CODE)</label>
          <input id="g-channel" class="input" placeholder="Ej: F90_5" />
        </div>
        <div class="field">
          <label class="field-label">Fecha (YYYYMMDD)</label>
          <input id="g-date" class="input" placeholder="Ej: 20240724" value="${todayYYYYMMDD()}" />
        </div>
        <div class="field">
          <label class="field-label">Código Noticiero (NOTICIERO_CODE)</label>
          <input id="g-code" class="input" placeholder="Ej: 1719" />
        </div>
        <div class="field">
          <label class="field-label">Hora inicio (HHMMSS)</label>
          <input id="g-time" class="input" placeholder="Ej: 060000" />
        </div>
        <div class="field">
          <label class="field-label">Duración (segundos)</label>
          <input id="g-dur" class="input" type="number" placeholder="Ej: 124" min="1" />
        </div>
        <div class="field">
          <label class="field-label">Tipo (opcional)</label>
          <select id="g-type" class="select">
            <option value="">— Sin especificar —</option>
            ${NOTE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <button id="btn-generate" class="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Generar Nota
      </button>
    </div>
    <div id="generate-result"></div>`;

  container.querySelector('#btn-generate').addEventListener('click', () => generateNote(container));
}

async function generateNote(container) {
  if (!localStorage.getItem('bdtr_api_key')) {
    container.querySelector('#generate-result').innerHTML = noKeyBanner();
    return;
  }

  const city = container.querySelector('#g-city').value.trim();
  const channel = container.querySelector('#g-channel').value.trim();
  const date = container.querySelector('#g-date').value.trim();
  const code = container.querySelector('#g-code').value.trim();
  const time = container.querySelector('#g-time').value.trim();
  const dur = container.querySelector('#g-dur').value.trim();
  const type = container.querySelector('#g-type').value;

  if (!city || !channel || !date || !code || !time || !dur) {
    container.querySelector('#generate-result').innerHTML =
      `<div class="error-banner">Ciudad, Canal, Fecha, Código, Hora y Duración son obligatorios.</div>`;
    return;
  }

  const result = container.querySelector('#generate-result');
  result.innerHTML = `<div class="card">${spinner()}</div>`;

  const btn = container.querySelector('#btn-generate');
  btn.disabled = true;

  try {
    const data = await api.processAiNote(city, date, channel, code, time, dur, type || undefined);
    renderGenerateResult(result, data);
  } catch (e) {
    result.innerHTML = `<div class="card">${errorBanner(e.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

function renderGenerateResult(el, data) {
  const id = data.id ?? data.Id ?? data.noteId ?? JSON.stringify(data);
  el.innerHTML = `<div class="card">
    <div class="success-banner" style="margin-bottom:0">
      <strong>Nota generada exitosamente.</strong>
      La generación es asíncrona — espera unos segundos para que esté disponible.
    </div>
    ${id ? `<div style="margin-top:12px">
      <label class="field-label">ID de la nueva nota</label>
      <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
        <code style="background:var(--bg);padding:6px 10px;border-radius:6px;border:1px solid var(--border);flex:1;font-size:12px;word-break:break-all">${escHtml(String(id))}</code>
        <button id="btn-copy-id" class="btn btn-sm btn-secondary">Copiar ID</button>
      </div>
    </div>` : ''}
    <details style="margin-top:12px">
      <summary style="cursor:pointer;color:var(--text-muted);font-size:12px">Ver respuesta completa</summary>
      <pre style="margin-top:8px;font-size:11px;overflow:auto">${escHtml(JSON.stringify(data, null, 2))}</pre>
    </details>
  </div>`;

  const copyBtn = el.querySelector('#btn-copy-id');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(String(id)).then(() => {
        copyBtn.textContent = '¡Copiado!';
        setTimeout(() => { copyBtn.textContent = 'Copiar ID'; }, 2000);
      });
    });
  }
}
