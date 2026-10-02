import {
  loadLottery, esc, fmtInt, fmtPrice, fmtRange, sectionShort, areaKey, AREAS, TYPE_ORDER,
  schemeUrl, stubCodeClass, nextMilestone, fmtDateTime, daysUntil, PIN_ICON, FLAG_ICON, renderFooter,
} from './common.js';

const $ = (id) => document.getElementById(id);

// ---- filter state <-> URL (so a filtered view can be shared on WhatsApp) -----
const state = { q: '', area: '', loc: '', types: [], budget: 0, cat: '', sort: '' };

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') ?? '';
  state.area = p.get('area') ?? '';
  state.loc = p.get('loc') ?? '';
  state.types = (p.get('type') ?? '').split(',').filter(Boolean);
  state.budget = Number(p.get('budget')) || 0;
  state.cat = p.get('cat') ?? '';
  state.sort = p.get('sort') ?? '';
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.area) p.set('area', state.area);
  if (state.loc) p.set('loc', state.loc);
  if (state.types.length) p.set('type', state.types.join(','));
  if (state.budget) p.set('budget', state.budget);
  if (state.cat) p.set('cat', state.cat);
  if (state.sort) p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

const activeFilterCount = () =>
  [state.q, state.area, state.loc, state.types.length, state.budget, state.cat].filter(Boolean).length;

// ---- filtering ---------------------------------------------------------------
function haystack(s) {
  return [s.project, s.locality, s.locality_mr, s.name_mr, s.code, s.id, s.rera ?? '', ...s.types]
    .join(' ').toLowerCase();
}

function matches(s) {
  if (state.area && areaKey(s.section) !== state.area) return false;
  if (state.loc && s.locality !== state.loc) return false;
  if (state.types.length && !s.types.some((t) => state.types.includes(t))) return false;
  if (state.budget && s.price[0] > state.budget) return false;
  if (state.cat && !(s.reserved[state.cat] > 0)) return false;
  if (state.q) {
    const hay = s._hay;
    if (!state.q.toLowerCase().split(/\s+/).filter(Boolean).every((tok) => hay.includes(tok))) return false;
  }
  return true;
}

const SORTS = {
  'price-asc': (a, b) => a.price[0] - b.price[0],
  'price-desc': (a, b) => b.price[1] - a.price[1],
  'units-desc': (a, b) => b.units - a.units,
  'carpet-desc': (a, b) => b.carpet_sqm[1] - a.carpet_sqm[1],
};

// ---- rendering ---------------------------------------------------------------
function renderHero(lottery) {
  const S = lottery.schemes;
  const localities = new Set(S.map((s) => s.locality)).size;
  const minPrice = Math.min(...S.map((s) => s.price[0]));
  $('hero-units').textContent = fmtInt(lottery.total_units);
  $('stats').innerHTML = [
    [fmtInt(S.length), 'schemes'],
    [fmtInt(lottery.total_units), 'homes'],
    [localities, 'localities'],
    [fmtPrice([minPrice, minPrice]), 'lowest price'],
  ].map(([n, l]) => `<li><strong>${esc(n)}</strong><span>${esc(l)}</span></li>`).join('');

  const next = nextMilestone(lottery);
  const applyClose = lottery.timeline.find((t) => t.key === 'apply_close');
  const now = new Date();
  let head;
  if (next) {
    const d = daysUntil(next.at);
    const stamp = d <= 0 ? '<span class="stamp-n">Today</span>'
      : `<span class="stamp-n">${d}</span><span class="stamp-u">day${d === 1 ? '' : 's'}</span>`;
    head = `
      <p class="status-label">Next up</p>
      <div class="status-main">
        <div>
          <p class="status-event">${esc(next.label)}</p>
          <p class="status-when">${esc(fmtDateTime(next.at))}</p>
        </div>
        <div class="stamp" aria-label="${d <= 0 ? 'today' : `in ${d} days`}">${stamp}</div>
      </div>`;
  } else {
    head = `
      <p class="status-label">Lottery complete</p>
      <p class="status-event">The draw has taken place.</p>
      <p class="status-when">Winners are listed on the official MHADA site.</p>`;
  }
  const closedNote = applyClose && new Date(applyClose.at) < now
    ? `<p class="status-note">Applications closed on ${esc(fmtDateTime(applyClose.at))}.</p>` : '';
  const items = lottery.timeline.map((t) => {
    const cls = new Date(t.at) < now ? 'done' : t === next ? 'next' : '';
    return `<li class="${cls}"><span class="tl-when">${esc(fmtDateTime(t.at))}</span><span class="tl-what">${esc(t.label)}${t.note ? ` <em>(${esc(t.note)})</em>` : ''}</span></li>`;
  }).join('');
  $('status').innerHTML = `${head}${closedNote}
    <details class="timeline"><summary>All lottery dates</summary><ol>${items}</ol></details>`;
}

function renderEligibility(lottery) {
  const tiles = lottery.income_groups.map((g) => `
    <div class="elig-tile">
      <p class="elig-id">${esc(g.id)}</p>
      <p class="elig-label">${esc(g.label)}</p>
      <p class="elig-income">Family income up to <strong>₹${fmtInt(g.max_income / 1e5)} lakh</strong> a year</p>
      <ul class="elig-list">
        <li>Deposit with application: <strong>₹${fmtInt(g.deposit)}</strong></li>
        <li>Can apply for: <strong>${g.can_apply_for.join(' and ')}</strong> homes</li>
      </ul>
    </div>`).join('');
  const fee = lottery.application_fee;
  $('eligibility').innerHTML = `${tiles}
    <div class="elig-tile elig-note">
      <p class="elig-label">Good to know</p>
      <ul class="elig-list">
        <li>Application fee <strong>₹${fmtInt(fee.total)}</strong> (₹${fee.fee} + ₹${fee.gst} GST), not refundable.</li>
        <li>${esc(lottery.income_note)}</li>
        <li>The ad doesn't say which schemes are EWS and which are LIG. Check the information booklet on the official site.</li>
      </ul>
    </div>`;
}

function renderFilterControls(lottery) {
  $('area').innerHTML = AREAS.map((a) => `
    <button type="button" role="radio" data-area="${a.id}" title="${esc(a.title)}" aria-checked="${state.area === a.id}">${esc(a.label)}</button>`).join('');

  const types = TYPE_ORDER.filter((t) => lottery.schemes.some((s) => s.types.includes(t)));
  $('types').innerHTML = types.map((t) => `
    <button type="button" class="chip" data-type="${esc(t)}" aria-pressed="${state.types.includes(t)}">${esc(t)}</button>`).join('');

  $('cat').innerHTML = '<option value="">Any category</option>' + lottery.categories.map((c) =>
    `<option value="${c.id}">${esc(c.id)} — ${esc(c.label)}</option>`).join('');

  renderLocalityOptions(lottery);
  $('q').value = state.q;
  $('budget').value = state.budget || '';
  $('cat').value = state.cat;
  $('sort').value = state.sort;
}

function renderLocalityOptions(lottery) {
  const counts = new Map();
  for (const s of lottery.schemes) {
    if (state.area && areaKey(s.section) !== state.area) continue;
    counts.set(s.locality, (counts.get(s.locality) ?? 0) + s.units);
  }
  if (state.loc && !counts.has(state.loc)) state.loc = '';
  const opts = [...counts].sort(([a], [b]) => a.localeCompare(b))
    .map(([loc, n]) => `<option value="${esc(loc)}">${esc(loc)} (${fmtInt(n)} homes)</option>`);
  $('loc').innerHTML = '<option value="">All localities</option>' + opts.join('');
  $('loc').value = state.loc;
}

function ticketHtml(lottery, s, i) {
  const cat = state.cat && s.reserved[state.cat]
    ? `<span class="cat-hit">${s.reserved[state.cat]} for ${esc(state.cat)}</span>` : '';
  const round = s.round > 1 ? `<span class="tag">${esc(lottery.rounds[s.round])}</span>` : '';
  const flag = s.flags.length ? `<span class="tag tag-flag" title="${esc(s.flags.join(' '))}">${FLAG_ICON} Check numbers</span>` : '';
  const ews = s.ews_in_name ? '<span class="tag">EWS</span>' : '';
  return `
    <li class="ticket" style="--i:${Math.min(i, 12)}">
      <a class="ticket-link" href="${schemeUrl(s)}" aria-label="${esc(`${s.project}, ${s.locality}, ${s.types.join(' / ')}`)}">
        <div class="stub">
          <span class="stub-label">Scheme</span>
          <span class="${stubCodeClass(s.code)}">${esc(s.code)}</span>
          <span class="stub-sr">No. ${s.sr}</span>
        </div>
        <div class="t-main">
          <div class="t-tags"><span class="tag tag-${areaKey(s.section)}">${esc(sectionShort(lottery, s.section))}</span>${ews}${round}${flag}</div>
          <h3 class="t-title">${esc(s.project)}</h3>
          <p class="t-loc">${PIN_ICON}${esc(s.locality)} <span lang="mr">· ${esc(s.locality_mr)}</span></p>
          <dl class="t-facts">
            <div><dt>Type</dt><dd>${esc(s.types.join(' / '))}</dd></div>
            <div><dt>Price</dt><dd>${esc(fmtPrice(s.price))}</dd></div>
            <div><dt>Carpet sq ft</dt><dd>${esc(fmtRange(s.carpet_sqft))}</dd></div>
          </dl>
          <p class="t-homes"><strong>${fmtInt(s.units)}</strong> home${s.units === 1 ? '' : 's'} in the draw ${cat}</p>
        </div>
      </a>
    </li>`;
}

function renderList(lottery) {
  let rows = lottery.schemes.filter(matches);
  if (SORTS[state.sort]) rows = [...rows].sort(SORTS[state.sort]);

  const homes = rows.reduce((n, s) => n + s.units, 0);
  const catHomes = state.cat ? rows.reduce((n, s) => n + s.reserved[state.cat], 0) : 0;
  $('results-count').innerHTML = `<strong>${fmtInt(rows.length)}</strong> scheme${rows.length === 1 ? '' : 's'} · <strong>${fmtInt(homes)}</strong> homes`
    + (state.cat ? ` · <strong>${fmtInt(catHomes)}</strong> reserved for ${esc(state.cat)}` : '');
  $('list').innerHTML = rows.map((s, i) => ticketHtml(lottery, s, i)).join('');
  $('empty').hidden = rows.length > 0;

  const n = activeFilterCount();
  $('filter-badge').hidden = n === 0;
  $('filter-badge').textContent = n;
  $('reset').hidden = n === 0;
}

// ---- wiring --------------------------------------------------------------------
function bind(lottery) {
  const update = () => { writeUrl(); renderList(lottery); };

  let t;
  $('q').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value.trim(); update(); }, 150);
  });
  $('area').addEventListener('click', (e) => {
    const b = e.target.closest('[data-area]');
    if (!b) return;
    state.area = b.dataset.area;
    $('area').querySelectorAll('[data-area]').forEach((x) => x.setAttribute('aria-checked', x === b));
    renderLocalityOptions(lottery);
    update();
  });
  $('types').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on);
    state.types = on ? [...state.types, b.dataset.type] : state.types.filter((x) => x !== b.dataset.type);
    update();
  });
  $('loc').addEventListener('change', (e) => { state.loc = e.target.value; update(); });
  $('budget').addEventListener('change', (e) => { state.budget = Number(e.target.value) || 0; update(); });
  $('cat').addEventListener('change', (e) => { state.cat = e.target.value; update(); });
  $('sort').addEventListener('change', (e) => { state.sort = e.target.value; update(); });

  const reset = () => {
    Object.assign(state, { q: '', area: '', loc: '', types: [], budget: 0, cat: '' });
    renderFilterControls(lottery);
    update();
  };
  $('reset').addEventListener('click', reset);
  $('empty-reset').addEventListener('click', reset);

  // phone layout: filters live in a bottom sheet
  const setOpen = (open) => document.body.classList.toggle('filters-open', open);
  $('open-filters').addEventListener('click', () => setOpen(true));
  $('close-filters').addEventListener('click', () => setOpen(false));
  $('show-results').addEventListener('click', () => {
    setOpen(false);
    $('browse').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

async function main() {
  readUrl();
  let lottery;
  try {
    lottery = await loadLottery();
  } catch (err) {
    $('list').innerHTML = `<li class="error">Couldn't load the scheme list. ${esc(err.message)}</li>`;
    return;
  }
  for (const s of lottery.schemes) s._hay = haystack(s);
  renderHero(lottery);
  renderEligibility(lottery);
  renderFilterControls(lottery);
  renderList(lottery);
  renderFooter(lottery);
  bind(lottery);
}

main();
