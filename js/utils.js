export function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function noKeyBanner() {
  return `<div class="no-key-banner">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    API Key no configurada. Haz clic en <strong style="margin:0 4px">Configuración</strong> para agregarla.
  </div>`;
}

export function spinner() {
  return `<div class="loading-state"><div class="spinner"></div> Cargando...</div>`;
}

export function errorBanner(msg) {
  return `<div class="error-banner">${escHtml(msg)}</div>`;
}

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(dateStr) {
  if (!dateStr || dateStr.length < 8) return dateStr || '-';
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  return `${d}/${m}/${y}`;
}

export function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Renders a pagination bar into `el`.
 * Calls onChange(newPage, newPerPage) on interaction.
 * @param {HTMLElement} el
 * @param {number} total
 * @param {number} page  1-based
 * @param {number} perPage
 * @param {(page:number, perPage:number)=>void} onChange
 */
export function renderPager(el, total, page, perPage, onChange) {
  const totalPages = Math.ceil(total / perPage);
  el.innerHTML = '';
  if (total === 0) return;

  const start = (page - 1) * perPage + 1;
  const end   = Math.min(page * perPage, total);

  const pages = buildPageList(page, totalPages);

  el.innerHTML = `<div class="pager">
    <span class="pager-info">${start}–${end} de ${total}</span>
    <div class="pager-btns">
      <button class="pager-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>&#8249;</button>
      ${pages.map(p => p === '…'
        ? `<span class="pager-ellipsis">…</span>`
        : `<button class="pager-btn${p === page ? ' active' : ''}" data-page="${p}">${p}</button>`
      ).join('')}
      <button class="pager-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>&#8250;</button>
    </div>
    <select class="pager-per-page">
      ${[20, 30, 50].map(n => `<option value="${n}"${n === perPage ? ' selected' : ''}>${n} por pág.</option>`).join('')}
    </select>
  </div>`;

  el.querySelectorAll('.pager-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => onChange(parseInt(btn.dataset.page, 10), perPage));
  });
  el.querySelector('.pager-per-page').addEventListener('change', e => {
    onChange(1, parseInt(e.target.value, 10));
  });
}

function buildPageList(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (page > 3) pages.push('…');
  for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i);
  if (page < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

/**
 * Returns the HTML string for a searchable select widget.
 * After inserting into the DOM, call initSearchableSelect(el, options).
 */
export function searchableSelectHTML(id, placeholder = 'Buscar...') {
  return `
    <div class="ss-wrap" id="${escHtml(id)}" data-value="">
      <div class="ss-control">
        <input type="text" class="ss-input" placeholder="${escHtml(placeholder)}" autocomplete="off" spellcheck="false" />
        <button type="button" class="ss-clear" title="Limpiar">&#x2715;</button>
        <span class="ss-chevron">
          <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M1 1l4 4 4-4"/>
          </svg>
        </span>
      </div>
      <ul class="ss-dropdown" style="display:none"></ul>
    </div>`;
}

/**
 * Initialises a searchable select widget.
 * @param {HTMLElement} wrap - the .ss-wrap element
 * @param {Array<{value:string, label:string}>} options
 * @returns {{ getValue, setValue, clear }}
 */
export function initSearchableSelect(wrap, options) {
  const input    = wrap.querySelector('.ss-input');
  const control  = wrap.querySelector('.ss-control');
  const dropdown = wrap.querySelector('.ss-dropdown');
  const clearBtn = wrap.querySelector('.ss-clear');

  let currentValue = '';
  let currentLabel = '';

  function renderOptions(q = '') {
    const lq = q.toLowerCase();
    const filtered = q
      ? options.filter(o => o.label.toLowerCase().includes(lq) || o.value.toLowerCase().includes(lq))
      : options;

    const shown = filtered.slice(0, 80);
    dropdown.innerHTML = '';

    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'ss-no-results';
      li.textContent = 'Sin resultados';
      dropdown.appendChild(li);
      return;
    }

    shown.forEach(o => {
      const li = document.createElement('li');
      li.className = 'ss-option' + (o.value === currentValue ? ' ss-selected' : '');
      li.textContent = o.label;
      li.dataset.value = o.value;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        pick(o.value, o.label);
      });
      dropdown.appendChild(li);
    });

    if (filtered.length > 80) {
      const hint = document.createElement('li');
      hint.className = 'ss-hint';
      hint.textContent = `${filtered.length - 80} más — continúa escribiendo`;
      dropdown.appendChild(hint);
    }
  }

  function open() {
    control.classList.add('open');
    dropdown.style.display = '';
    renderOptions(currentValue ? '' : input.value);
  }

  function close() {
    control.classList.remove('open');
    dropdown.style.display = 'none';
    // Restore label if something was selected
    if (currentValue) {
      input.value = currentLabel;
    } else {
      input.value = '';
    }
  }

  function pick(value, label) {
    currentValue = value;
    currentLabel = label;
    input.value = label;
    wrap.dataset.value = value;
    wrap.classList.add('has-value');
    wrap.dispatchEvent(new CustomEvent('ss:change', { detail: { value, label }, bubbles: true }));
    close();
  }

  function clear() {
    currentValue = '';
    currentLabel = '';
    input.value = '';
    wrap.dataset.value = '';
    wrap.classList.remove('has-value');
    wrap.dispatchEvent(new CustomEvent('ss:change', { detail: { value: '', label: '' }, bubbles: true }));
  }

  input.addEventListener('focus', () => {
    if (currentValue) input.value = '';
    open();
  });

  input.addEventListener('input', () => {
    currentValue = '';
    wrap.dataset.value = '';
    wrap.classList.remove('has-value');
    renderOptions(input.value);
    dropdown.style.display = '';
  });

  input.addEventListener('blur', () => setTimeout(close, 160));
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); input.blur(); } });

  clearBtn.addEventListener('click', () => { clear(); input.focus(); });

  return {
    getValue: () => wrap.dataset.value || '',
    setValue: (value, label) => { if (value) pick(value, label || value); },
    clear,
  };
}
