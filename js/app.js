import { toast } from './utils.js';
import { renderNoticieros } from './components/noticieros.js';
import { renderNotas } from './components/notas.js';
import { renderTranscripcion } from './components/transcripcion.js';
import { renderGenerarNota } from './components/generarNota.js';
import { renderWebhook } from './components/webhook.js';

const views = {
  noticieros: renderNoticieros,
  notas: renderNotas,
  transcripcion: renderTranscripcion,
  generar: renderGenerarNota,
  'webhook-notas': (c) => renderWebhook('notas', c),
  'webhook-vtt': (c) => renderWebhook('vtt', c),
  'webhook-social': (c) => renderWebhook('social', c),
};

let currentView = 'noticieros';

function navigate(view) {
  if (!views[view]) view = 'noticieros';
  currentView = view;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  const container = document.getElementById('view-container');
  container.innerHTML = '';
  views[view](container);
}

function initConfig() {
  const modal = document.getElementById('modal-config');
  const input = document.getElementById('input-api-key');

  document.getElementById('btn-config').addEventListener('click', () => {
    input.value = localStorage.getItem('bdtr_api_key') || '';
    modal.classList.remove('hidden');
    input.focus();
  });

  document.getElementById('btn-save-config').addEventListener('click', () => {
    const val = input.value.trim();
    localStorage.setItem('bdtr_api_key', val);
    modal.classList.add('hidden');
    toast('API Key guardada', 'success');
    navigate(currentView);
  });

  modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.classList.add('hidden'));
  modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn =>
    btn.addEventListener('click', () => modal.classList.add('hidden'))
  );
}

function initNav() {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.view);
    });
  });
}

function init() {
  initConfig();
  initNav();

  const hash = location.hash.replace('#', '') || 'noticieros';
  navigate(hash);
}

document.addEventListener('DOMContentLoaded', init);
