import { AIRPORTS, DESTINATIONS, SERVICES } from './data.js';

export const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function initUI() {
  $('#airports').innerHTML = AIRPORTS.map(([code, name]) => `<option value="${code}">${name}</option>`).join('');

  $('#svcGrid').innerHTML = SERVICES.map(
    ([title, text]) => `<a href="#booking"><strong>${title}</strong><span>${text}</span></a>`,
  ).join('');

  $('#routes').innerHTML = DESTINATIONS.map(
    (d, i) => `<button data-i="${i}"><b style="color:${d.tint}">${d.code}</b> ${d.city}<span>${d.country}</span></button>`,
  ).join('');
  $('#routes').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    $('#to').value = DESTINATIONS[+btn.dataset.i].code;
    $('#booking').scrollIntoView({ behavior: 'smooth' });
    $('#from').focus({ preventScroll: true });
  });

  // Dates
  const iso = (d) => d.toISOString().slice(0, 10);
  const now = new Date();
  $('#dep').value = iso(new Date(+now + 14 * 864e5));
  $('#ret').value = iso(new Date(+now + 21 * 864e5));
  $('#dep').min = iso(now);
  $('#tripRow').addEventListener('change', (ev) => {
    $('#lRet').hidden = ev.target.value === 'One way';
  });

  // Search form
  const toCode = (text) => {
    const up = text.trim().toUpperCase();
    const hit =
      AIRPORTS.find((a) => a[0] === up) ||
      AIRPORTS.find((a) => a[1].toLowerCase().startsWith(text.trim().toLowerCase()) && text.trim().length > 2);
    return hit ? hit[0] : up.slice(0, 3) || '---';
  };
  const fmtDate = (v) =>
    v ? new Date(v + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

  $('#searchForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const err = $('#formErr');
    err.textContent = '';
    const from = $('#from').value.trim();
    const to = $('#to').value.trim();
    if (!to) {
      err.textContent = 'Add a destination to file your plan.';
      $('#to').focus();
      return;
    }
    if (!$('#dep').value) {
      err.textContent = 'Pick a departure date.';
      return;
    }
    if (!$('#lRet').hidden && $('#ret').value && $('#ret').value < $('#dep').value) {
      err.textContent = 'Return must be after departure.';
      return;
    }
    const trip = $('input[name=trip]:checked').value;
    $('#planRoute').textContent = `${toCode(from)}  →  ${toCode(to)}`;
    $('#planMeta').textContent = [
      trip,
      fmtDate($('#dep').value) + (!$('#lRet').hidden && $('#ret').value ? ' – ' + fmtDate($('#ret').value) : ''),
      $('#pax').value,
      $('#cabin').value,
    ].join(' · ');
    $('#plan').hidden = false;
  });

  $('#continueBtn').addEventListener('click', () => {
    $('#formErr').textContent = 'Concept preview: checkout is not connected.';
  });

  // Instalment illustration
  let months = 4;
  const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');
  const renderPay = () => {
    const amt = +$('#amt').value;
    $('#amtOut').textContent = naira(amt);
    $('#payOut').textContent = naira(amt / months);
  };
  $('#amt').addEventListener('input', renderPay);
  $('#split').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    months = +btn.dataset.n;
    $$('#split button').forEach((b) => b.setAttribute('aria-pressed', b === btn));
    renderPay();
  });
  renderPay();
}
