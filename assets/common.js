// Shared helpers for the list and detail pages.

export const DATA_URL = 'data/pune-2026-09.json';

export async function loadLottery() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Could not load ${DATA_URL} (${res.status})`);
  return res.json();
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

export const fmtInt = (n) => n.toLocaleString('en-IN');

// 1467900 -> "14.68"; Indian buyers read prices in lakh
const lakh = (n) => (n / 1e5).toFixed(2).replace(/\.?0+$/, '');

export function fmtPrice([min, max], { long = false } = {}) {
  const unit = long ? ' lakh' : ' L';
  return min === max ? `₹${lakh(min)}${unit}` : `₹${lakh(min)}–${lakh(max)}${unit}`;
}

export function fmtRange([min, max], digits = 0) {
  const f = (v) => v.toLocaleString('en-IN', { maximumFractionDigits: digits });
  return min === max ? f(min) : `${f(min)}–${f(max)}`;
}

export const sectionShort = (lottery, id) => lottery.sections[id]?.short ?? id;

export function areaKey(section) {
  return section === 'inclusive-20-pmc' ? 'pmc' : section === 'inclusive-20-pcmc' ? 'pcmc' : 'social';
}

export const AREAS = [
  { id: '', label: 'All areas', title: 'All areas' },
  { id: 'pmc', label: 'Pune (PMC)', title: 'Pune Municipal Corporation, 20% inclusive housing' },
  { id: 'pcmc', label: 'PCMC', title: 'Pimpri Chinchwad Municipal Corporation, 20% inclusive housing' },
  { id: 'social', label: '15% Social', title: '15% social housing scheme' },
];

export const TYPE_ORDER = ['1 RK', '1 BHK', '1.5 BHK', '2 BHK', '2.5 BHK'];

// codes like '1000-डी' are wider than the stub; shrink them a little
export const stubCodeClass = (code) => (code.length > 6 ? 'stub-code long' : 'stub-code');

export function schemeUrl(s) {
  return `scheme.html?id=${encodeURIComponent(s.id)}`;
}

// Timeline: the next milestone that hasn't happened yet (or null when all are past).
export function nextMilestone(lottery, now = new Date()) {
  return lottery.timeline.find((t) => new Date(t.at) > now) ?? null;
}

export function fmtDateTime(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return `${date}, ${time}`;
}

export function daysUntil(iso, now = new Date()) {
  return Math.ceil((new Date(iso) - now) / 86400000);
}

export const PIN_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.6" fill="currentColor"/></svg>';
export const FLAG_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4m0 0h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

export function renderFooter(lottery) {
  const el = document.getElementById('footer');
  const c = lottery.contact;
  const sites = lottery.official_sites.map((s) => `<a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.label)}</a>`).join(' · ');
  el.innerHTML = `
    <div class="wrap footer-grid">
      <div>
        <p class="footer-brand">Ghar Sodat Pune</p>
        <p class="disclaimer"><strong>Unofficial and not affiliated with MHADA.</strong>
          This list was transcribed from the official advertisement and may contain errors.
          The ad itself says scheme and flat counts can change. Always verify on ${sites} before you apply or pay.</p>
        <p class="disclaimer">English project names are transliterated from the Marathi ad and may differ from developers' spellings.</p>
      </div>
      <div>
        <p class="footer-h">Official MHADA help</p>
        <ul class="footer-list">
          <li>Lottery helpline: <a href="tel:${esc(c.helpline)}">${esc(c.helpline)}</a></li>
          <li>Deposit helpline: ${c.deposit_helplines.map((n) => `<a href="tel:${esc(n)}">${esc(n)}</a>`).join(', ')}</li>
          <li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
          <li><a href="${esc(lottery.source_pdf)}" target="_blank" rel="noopener">Original advertisement (PDF, Marathi)</a></li>
        </ul>
      </div>
    </div>`;
}
