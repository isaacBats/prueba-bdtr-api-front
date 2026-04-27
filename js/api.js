const BASE = 'https://api.bdtr.net/ai';

function getKey() {
  return localStorage.getItem('bdtr_api_key') || '';
}

async function request(method, path, params = {}, body = null) {
  const key = getKey();
  if (!key) throw new Error('API Key no configurada. Abre Configuración para agregarla.');

  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, v); });

  const opts = {
    method,
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
  };
  if (body !== null) opts.body = JSON.stringify(body);

  const res = await fetch(url.toString(), opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export const api = {
  getNoticieros: () => request('GET', '/getAiNoticieros'),

  getNotes: (city, date, channel, code) =>
    request('GET', '/getAiNotes', { city, date, channel, code }),

  getNote: (id) => request('GET', '/getAiNote', { id }),

  getProgramTranscript: (city, date, channel, code) =>
    request('GET', '/getAiProgramTranscript', { city, date, channel, code }),

  processAiNote: (city, date, channel, code, time, dur, type) =>
    request('GET', '/processAiNote', { city, date, channel, code, time, dur, type }),

  // Webhooks - Notas
  setWebhookNotas: (urlWebhook) => request('POST', '/setAiWebhook', {}, { urlWebhook }),
  queryWebhookNotas: () => request('GET', '/queryAiWebhook'),

  // Webhooks - Transcripciones
  setWebhookVtt: (urlWebhook) => request('POST', '/setAiVttHook', {}, { urlWebhook }),
  queryWebhookVtt: () => request('GET', '/queryAiVttHook'),

  // Webhooks - Social
  setWebhookSocial: (urlWebhook) => request('POST', '/setAiXHook', {}, { urlWebhook }),
  queryWebhookSocial: () => request('GET', '/queryAiXHook'),
};
