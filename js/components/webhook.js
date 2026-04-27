import { api } from '../api.js';
import { spinner, errorBanner, noKeyBanner, escHtml } from '../utils.js';
import { toast } from '../utils.js';

const CONFIG = {
  notas: {
    label: 'Notas',
    description: 'Recepción automática de notas procesadas por AI',
    query: () => api.queryWebhookNotas(),
    set: (url) => api.setWebhookNotas(url),
  },
  vtt: {
    label: 'Transcripciones (VTT)',
    description: 'Recepción automática de transcripciones de programas',
    query: () => api.queryWebhookVtt(),
    set: (url) => api.setWebhookVtt(url),
  },
  social: {
    label: 'Redes Sociales',
    description: 'Recepción automática de posteos a redes sociales',
    query: () => api.queryWebhookSocial(),
    set: (url) => api.setWebhookSocial(url),
  },
};

export async function renderWebhook(type, container) {
  // container can be passed directly or as second arg from app.js partial application
  if (!container && this instanceof HTMLElement) container = this;

  const cfg = CONFIG[type];

  container.innerHTML = `
    <div class="page-header">
      <h1>Webhook — ${cfg.label}</h1>
      <p>${cfg.description}</p>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="detail-section" style="margin-bottom:0">
        <h3>URL configurada actualmente</h3>
        <div id="current-url-box">${spinner()}</div>
      </div>
    </div>
    <div class="card">
      <h3 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin-bottom:12px">Actualizar Webhook</h3>
      <div class="field">
        <label class="field-label">URL del Webhook</label>
        <div class="input-group">
          <input id="wh-url" class="input" type="url" placeholder="https://mi-servidor.com/webhook" />
          <button id="btn-set-wh" class="btn btn-primary">Guardar</button>
        </div>
        <p class="hint">Deja vacío y guarda para desactivar el webhook.</p>
      </div>
      <button id="btn-disable-wh" class="btn btn-danger btn-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        Desactivar Webhook
      </button>
      <div id="wh-feedback" style="margin-top:12px"></div>
    </div>`;

  if (!localStorage.getItem('bdtr_api_key')) {
    container.querySelector('#current-url-box').innerHTML = noKeyBanner();
  } else {
    loadCurrentUrl(container, cfg);
  }

  container.querySelector('#btn-set-wh').addEventListener('click', () => {
    const url = container.querySelector('#wh-url').value.trim();
    saveWebhook(container, cfg, url);
  });

  container.querySelector('#btn-disable-wh').addEventListener('click', () => {
    if (confirm('¿Desactivar el webhook? Se borrará la URL configurada.')) {
      saveWebhook(container, cfg, '');
    }
  });
}

async function loadCurrentUrl(container, cfg) {
  const box = container.querySelector('#current-url-box');
  try {
    const data = await cfg.query();
    const url = data.urlWebhook ?? data.url ?? data.webhook ?? JSON.stringify(data);
    if (url) {
      box.innerHTML = `<code style="word-break:break-all;font-size:12px;background:var(--bg);padding:6px 10px;border-radius:6px;border:1px solid var(--border);display:block">${escHtml(url)}</code>`;
    } else {
      box.innerHTML = `<span style="color:var(--text-muted);font-size:13px">Sin webhook configurado</span>`;
    }
  } catch (e) {
    box.innerHTML = errorBanner(e.message);
  }
}

async function saveWebhook(container, cfg, url) {
  const feedback = container.querySelector('#wh-feedback');
  const btn = container.querySelector('#btn-set-wh');
  btn.disabled = true;
  feedback.innerHTML = spinner();

  try {
    await cfg.set(url);
    feedback.innerHTML = `<div class="success-banner">${url ? 'Webhook actualizado correctamente.' : 'Webhook desactivado.'}</div>`;
    toast(url ? 'Webhook guardado' : 'Webhook desactivado', 'success');
    loadCurrentUrl(container, cfg);
  } catch (e) {
    feedback.innerHTML = errorBanner(e.message);
  } finally {
    btn.disabled = false;
  }
}
