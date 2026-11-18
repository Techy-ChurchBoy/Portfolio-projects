// The player's ticket for this browser. Progress (ticket, security, boarding) lives in localStorage,
// so it survives a reload but stays on this device. Storage can be blocked, so every access is guarded.
const KEY = 'skywalker.ticket';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const WAIT_CALL = 20; // seconds seated in a waiting hall before the boarding call

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

// What the gate boards say about a ticket.
export function ticketStatus(t) {
  if (!t) return { text: 'No ticket', sub: 'Buy one at the departure desk', tone: '#ff7a7a' };
  if (t.boarded) return { text: 'Boarded', sub: 'Enjoy the flight', tone: '#6fe3a5' };
  if (!t.securityPassed) return { text: 'Clear security', sub: 'Security station, west side of the hall', tone: '#ffb547' };
  if (!t.called) {
    const s = Math.min(WAIT_CALL, Math.floor(t.waited || 0));
    return { text: 'Waiting to board', sub: `Sit on a bench: ${s}s of ${WAIT_CALL}s`, tone: '#ffb547' };
  }
  return { text: 'Boarding now', sub: `Gate ${t.gate}: head out to the plane`, tone: '#6fe3a5' };
}
