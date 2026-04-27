import { api } from '../api.js';
import { spinner, errorBanner, noKeyBanner, escHtml } from '../utils.js';

export async function renderNoticieros(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Noticieros</h1>
      <p>Listado de todos los noticieros procesados por BDTR AI</p>
    </div>
    <div class="card">
      <div id="noticieros-content">${spinner()}</div>
    </div>`;

  if (!localStorage.getItem('bdtr_api_key')) {
    container.querySelector('#noticieros-content').innerHTML = noKeyBanner();
    return;
  }

  try {
    const data = await api.getNoticieros();
    const items = Array.isArray(data) ? data : (data.data ?? data.noticieros ?? []);
    renderTable(container.querySelector('#noticieros-content'), items);
  } catch (e) {
    container.querySelector('#noticieros-content').innerHTML = errorBanner(e.message);
  }
}

function renderTable(el, items) {
  if (!items.length) {
    el.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
      Sin noticieros disponibles
    </div>`;
    return;
  }

  const keys = Object.keys(items[0]);
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${keys.map(k => `<th>${escHtml(k)}</th>`).join('')}</tr></thead>
        <tbody>
          ${items.map(row => `<tr>${keys.map(k => `<td>${escHtml(String(row[k] ?? '-'))}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p style="margin-top:12px;color:var(--text-muted);font-size:12px">${items.length} noticiero(s)</p>`;
}
