'use strict';
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
function syncPageLock() { document.body.style.overflow = mobileNav.open || quoteDialog.open ? 'hidden' : ''; }
function closeMenu() {
  if (mobileNav.open) mobileNav.close();
  menuButton.setAttribute('aria-expanded', 'false');
  syncPageLock();
}
menuButton.addEventListener('click', () => {
  mobileNav.showModal();
  menuButton.setAttribute('aria-expanded', 'true');
  syncPageLock();
});
document.querySelector('.menu-close').addEventListener('click', closeMenu);
mobileNav.addEventListener('close', closeMenu);
mobileNav.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
matchMedia('(max-width: 1180px)').addEventListener('change', (event) => { if (!event.matches) closeMenu(); });
const originInput = document.querySelector('#origin');
const destinationInput = document.querySelector('#destination');
const quoteDialog = document.querySelector('#quote-dialog');
const detailsForm = document.querySelector('#details-form');
const detailsPanel = document.querySelector('#quote-details');
const resultPanel = document.querySelector('#quote-result');
const dialogOrigin = document.querySelector('#dialog-origin');
const dialogDestination = document.querySelector('#dialog-destination');
const serviceSelect = document.querySelector('#service-select');
const submitButton = document.querySelector('.dialog-submit');
let requestId = crypto.randomUUID();
let sending = false;
let quoteText = '';
function normalizedCity(value) { return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU'); }
function sameCities(a, b) { return Boolean(a.trim() && b.trim() && normalizedCity(a) === normalizedCity(b)); }
function resetResult() {
  detailsPanel.hidden = false; resultPanel.hidden = true;
  quoteDialog.setAttribute('aria-labelledby', 'dialog-heading');
  document.querySelector('#copy-status').textContent = '';
}
function openQuote(service) {
  if (sending) return;
  if (!resultPanel.hidden) { detailsForm.reset(); requestId = crypto.randomUUID(); }
  const error = document.querySelector('#route-error'); error.hidden = true;
  dialogOrigin.value = originInput.value.trim(); dialogDestination.value = destinationInput.value.trim();
  if (service) serviceSelect.value = service;
  resetResult(); document.querySelector('#details-error').hidden = true;
  closeMenu(); quoteDialog.showModal(); syncPageLock();
}
document.querySelector('#route-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (sameCities(originInput.value, destinationInput.value)) {
    const error = document.querySelector('#route-error');
    error.textContent = 'Укажите разные города отправления и получения.';
    error.hidden = false; destinationInput.focus(); return;
  }
  openQuote();
});
document.querySelectorAll('[data-service]').forEach((button) => button.addEventListener('click', () => openQuote(button.dataset.service)));
document.querySelectorAll('[data-open-quote]').forEach((button) => button.addEventListener('click', () => openQuote()));
document.querySelectorAll('.direction-choice').forEach((button) => button.addEventListener('click', () => {
  originInput.value = button.dataset.origin; destinationInput.value = button.dataset.destination;
  openQuote();
}));
document.querySelector('.dialog-close').addEventListener('click', () => quoteDialog.close());
quoteDialog.addEventListener('close', syncPageLock);
quoteDialog.addEventListener('click', (event) => {
  if (event.target !== quoteDialog) return;
  const bounds = quoteDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) quoteDialog.close();
});
detailsForm.addEventListener('submit', async (event) => {
  event.preventDefault(); if (sending) return;
  const payload = Object.fromEntries(new FormData(detailsForm));
  const error = document.querySelector('#details-error'); error.hidden = true;
  if (sameCities(payload.origin, payload.destination)) {
    error.textContent = 'Укажите разные города отправления и получения.';
    error.hidden = false; dialogDestination.focus(); return;
  }
  if (!/^[+\d\s().-]+$/.test(payload.phone) || !/^\d{10,15}$/.test(payload.phone.replace(/\D/g, ''))) {
    error.textContent = 'Проверьте телефон: укажите номер с кодом города или оператора.';
    error.hidden = false; detailsForm.elements.phone.focus(); return;
  }
  if (payload.cargo.trim().length < 3) {
    error.textContent = 'Добавьте описание груза, минимум 3 символа.';
    error.hidden = false; detailsForm.elements.cargo.focus(); return;
  }
  sending = true; submitButton.disabled = true; submitButton.textContent = 'Отправляем…';
  detailsForm.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(document.querySelector('meta[name="request-endpoint"]').content, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, requestId }), signal: AbortSignal.timeout(20000)
    });
    const result = await response.json();
    if (!response.ok || !result.id) throw new Error(result.error || 'Не удалось отправить заявку. Попробуйте ещё раз.');
    const route = [payload.origin.trim() || 'Уточним отправление', payload.destination.trim() || 'Уточним назначение'].join(' - ');
    const rows = [
      ['Номер заявки', result.id.slice(0, 8).toUpperCase()], ['Маршрут', route], ['Телефон', payload.phone.trim()],
      ['Email', payload.email.trim() || 'Не указан'], ['Перевозка', payload.service],
      ['Вес', `${Number(payload.weight).toLocaleString('ru-RU')} кг`],
      ['Объём', `${Number(payload.volume).toLocaleString('ru-RU')} м³`], ['Груз', payload.cargo.trim()]
    ];
    const summary = document.querySelector('#quote-summary'); summary.replaceChildren();
    rows.forEach(([label, value]) => {
      const term = document.createElement('dt'); const definition = document.createElement('dd');
      term.textContent = label; definition.textContent = value; summary.append(term, definition);
    });
    quoteText = '\uFEFFАЭРОПЛАТ. ЗАЯВКА НА РАСЧЁТ ПЕРЕВОЗКИ\n\n' + rows.map(([label, value]) => `${label}: ${value}`).join('\n') + '\n\nЗаявка принята. Стоимость и сроки согласуются индивидуально.';
    originInput.value = payload.origin.trim(); destinationInput.value = payload.destination.trim();
    detailsPanel.hidden = true; resultPanel.hidden = false; quoteDialog.setAttribute('aria-labelledby', 'result-heading');
    quoteDialog.scrollTop = 0;
    if (quoteDialog.open) document.querySelector('#result-heading').focus();
  } catch (failure) {
    error.textContent = failure.name === 'TimeoutError' || failure.name === 'TypeError'
      ? 'Соединение прервалось. Проверьте интернет и повторите отправку — данные сохранены в форме.'
      : failure.message;
    error.hidden = false;
  } finally {
    sending = false; submitButton.disabled = false; submitButton.textContent = 'Отправить заявку';
    detailsForm.removeAttribute('aria-busy');
  }
});
document.querySelector('.new-quote').addEventListener('click', () => {
  detailsForm.reset(); requestId = crypto.randomUUID(); resetResult(); dialogOrigin.focus();
});
document.querySelector('#download-quote').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([quoteText], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'aeroplat-zayavka.txt';
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#copy-status').textContent = 'Файл заявки подготовлен для скачивания.';
});
document.querySelector('#copy-quote').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try { await navigator.clipboard.writeText(quoteText.replace(/^\uFEFF/, '')); status.textContent = 'Заявка скопирована.'; }
  catch { status.textContent = 'Не удалось скопировать. Скачайте заявку файлом.'; }
});
document.querySelector('#year').textContent = String(new Date().getFullYear());
