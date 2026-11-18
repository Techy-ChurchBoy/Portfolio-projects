// The player's ticket for this browser. Progress (ticket, security, boarding) lives in localStorage,
// so it survives a reload but stays on this device. Storage can be blocked, so every access is guarded.
const KEY = 'skywalker.ticket';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function loadTicket() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveTicket(t) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // Storage blocked: the ticket lasts only for this visit.
  }
}

export function issueTicket({ from, to, dep, pax, cabin }) {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  const t = { code, from, to, dep, pax, cabin, gate: 'A1', securityPassed: false, boarded: false };
  saveTicket(t);
  return t;
}
