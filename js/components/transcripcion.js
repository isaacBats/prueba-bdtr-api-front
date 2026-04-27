import { api } from '../api.js';
import { spinner, errorBanner, noKeyBanner, escHtml, todayYYYYMMDD } from '../utils.js';

export function renderTranscripcion(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Transcripción de Noticiero</h1>
      <p>Obtén la transcripción en formato VTT. Los programas en vivo se actualizan cada 10 min.</p>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="grid grid-2" style="gap:12px">
        <div class="field">
          <label class="field-label">Ciudad (CITY_CODE)</label>
          <input id="t-city" class="input" placeholder="Ej: DF_MEX" value="DF_MEX" />
        </div>
        <div class="field">
          <label class="field-label">Canal (CHANNEL_CODE)</label>
          <input id="t-channel" class="input" placeholder="Ej: T4HI" />
        </div>
        <div class="field">
          <label class="field-label">Fecha (YYYYMMDD)</label>
          <input id="t-date" class="input" placeholder="Ej: 20231127" value="${todayYYYYMMDD()}" />
        </div>
        <div class="field">
          <label class="field-label">Código Noticiero (NOTICIERO_CODE)</label>
          <input id="t-code" class="input" placeholder="Ej: 36007" />
        </div>
      </div>
      <button id="btn-get-transcript" class="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Obtener Transcripción
      </button>
    </div>
    <div id="transcript-result"></div>`;

  container.querySelector('#btn-get-transcript').addEventListener('click', () => fetchTranscript(container));
  container.querySelectorAll('.input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') fetchTranscript(container); });
  });
}

async function fetchTranscript(container) {
  if (!localStorage.getItem('bdtr_api_key')) {
    container.querySelector('#transcript-result').innerHTML = noKeyBanner();
    return;
  }

  const city = container.querySelector('#t-city').value.trim();
  const channel = container.querySelector('#t-channel').value.trim();
  const date = container.querySelector('#t-date').value.trim();
  const code = container.querySelector('#t-code').value.trim();

  if (!city || !channel || !date || !code) {
    container.querySelector('#transcript-result').innerHTML =
      `<div class="error-banner">Todos los campos son obligatorios para obtener la transcripción.</div>`;
    return;
  }

  const result = container.querySelector('#transcript-result');
  result.innerHTML = `<div class="card">${spinner()}</div>`;

  try {
    const data = await api.getProgramTranscript(city, date, channel, code);
    renderTranscriptResult(result, data);
  } catch (e) {
    result.innerHTML = `<div class="card">${errorBanner(e.message)}</div>`;
  }
}

function renderTranscriptResult(el, data) {
  const content = typeof data === 'string'
    ? data
    : (data.transcript ?? data.vtt ?? data.content ?? JSON.stringify(data, null, 2));

  const lines = content.split('\n').length;

  el.innerHTML = `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-size:12px;color:var(--text-muted)">${lines} líneas</span>
      <button id="btn-copy-vtt" class="btn btn-sm btn-secondary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar
      </button>
    </div>
    <div class="transcript-box" id="vtt-content">${escHtml(content)}</div>
  </div>`;

  el.querySelector('#btn-copy-vtt').addEventListener('click', () => {
    navigator.clipboard.writeText(content).then(() => {
      el.querySelector('#btn-copy-vtt').textContent = '¡Copiado!';
      setTimeout(() => {
        el.querySelector('#btn-copy-vtt').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar`;
      }, 2000);
    });
  });
}
