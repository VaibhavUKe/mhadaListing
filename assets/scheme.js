import {
  loadLottery, esc, fmtInt, fmtPrice, fmtRange, sectionShort, areaKey, schemeUrl, stubCodeClass,
  PIN_ICON, FLAG_ICON, renderFooter,
} from './common.js';

const root = document.getElementById('detail');

function youtubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function reservationsHtml(lottery, s) {
  const max = Math.max(...Object.values(s.reserved), 1);
  const rows = lottery.categories.map((c) => {
    const n = s.reserved[c.id];
    return `
      <li class="${n ? '' : 'zero'}">
        <span class="res-id">${esc(c.id)}</span>
        <span class="res-label">${esc(c.label)}</span>
        <span class="res-bar"><span style="width:${(n / max) * 100}%"></span></span>
        <span class="res-n">${n}</span>
      </li>`;
  }).join('');
  return `<ol class="res-list">${rows}</ol>`;
}

function exploreHtml(lottery, s) {
  const q = `${s.project} ${s.locality} Pune`;
  const videos = s.youtube.map(youtubeId).filter(Boolean).map((id) => `
    <div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="Video about ${esc(s.project)}"
      loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`).join('');

  const links = [
    { label: 'Videos on YouTube', sub: `Search “${q}”`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
    { label: 'Location on Google Maps', sub: `${s.project}, ${s.locality}`, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` },
    ...(s.rera ? [{ label: 'Project on MahaRERA', sub: `RERA no. ${s.rera}`, url: 'https://maharera.maharashtra.gov.in/', copy: s.rera }] : []),
    { label: 'Apply / official details', sub: lottery.official_sites[0].label, url: lottery.official_sites[0].url },
    { label: 'Original ad (PDF)', sub: `Row ${s.sr} on page ${s.pdf_page}`, url: `${lottery.source_pdf}#page=${s.pdf_page}` },
    ...s.links.map((l) => ({ label: l.label, sub: new URL(l.url).hostname, url: l.url })),
  ];
  const cards = links.map((l) => `
    <li class="explore-card">
      <a href="${esc(l.url)}" target="_blank" rel="noopener">
        <span class="explore-label">${esc(l.label)} <span aria-hidden="true">↗</span></span>
        <span class="explore-sub">${esc(l.sub)}</span>
      </a>
      ${l.copy ? `<button type="button" class="link-btn copy" data-copy="${esc(l.copy)}">Copy number</button>` : ''}
    </li>`).join('');
  return `${videos ? `<div class="videos">${videos}</div>` : ''}<ul class="explore-grid">${cards}</ul>`;
}

function siblingsHtml(lottery, s) {
  const sibs = lottery.schemes.filter((x) => x.id !== s.id && x.project === s.project && x.locality === s.locality);
  if (!sibs.length) return '';
  const items = sibs.map((x) => `
    <li><a href="${schemeUrl(x)}">
      <span class="sib-code">${esc(x.code)}</span>
      <span class="sib-type">${esc(x.types.join(' / '))}</span>
      <span class="sib-price">${esc(fmtPrice(x.price))}</span>
      <span class="sib-units">${fmtInt(x.units)} homes</span>
    </a></li>`).join('');
  return `
    <section class="panel">
      <h2 class="section-h">Other home types in this project</h2>
      <ul class="siblings">${items}</ul>
    </section>`;
}

function render(lottery, s) {
  document.title = `${s.project}, ${s.locality} · ${s.types.join(' / ')} · Ghar Sodat Pune`;
  const section = lottery.sections[s.section];
  const pageUrl = location.href;
  const shareText = `${s.project}, ${s.locality} — ${s.types.join(' / ')} from ${fmtPrice(s.price, { long: true })}, ${s.units} homes in the MHADA Pune lottery.\n${pageUrl}`;

  const flags = s.flags.length ? `
    <div class="callout callout-flag" role="note">
      ${FLAG_ICON}
      <div><strong>Numbers in the ad don't add up.</strong> ${s.flags.map(esc).join(' ')}
      We've kept them as printed. Confirm with MHADA before relying on the category counts.</div>
    </div>` : '';

  const facts = [
    ['Price (estimated)', fmtPrice(s.price, { long: true })],
    ['Carpet area', `${fmtRange(s.carpet_sqft)} sq ft`, `${fmtRange(s.carpet_sqm, 2)} m²`],
    ['Built-up area', `${fmtRange(s.builtup_sqm, 2)} m²`, 'as printed in the ad'],
    ['Homes in the draw', fmtInt(s.units)],
    ['Home type', s.types.join(' / ')],
    ['RERA', s.rera ?? s.rera_note ?? '—', s.rera ? '' : 'no RERA number in the ad'],
  ].map(([k, v, sub]) => `
    <div class="fact"><dt>${esc(k)}</dt><dd>${esc(v)}${sub ? `<span class="fact-sub">${esc(sub)}</span>` : ''}</dd></div>`).join('');

  root.innerHTML = `
    <a class="back" href="./" id="back">← All schemes</a>

    <article class="ticket ticket-lg">
      <div class="stub">
        <span class="stub-label">Scheme</span>
        <span class="${stubCodeClass(s.code)}">${esc(s.code)}</span>
        <span class="stub-sr">No. ${s.sr}</span>
      </div>
      <div class="t-main">
        <div class="t-tags">
          <span class="tag tag-${areaKey(s.section)}">${esc(sectionShort(lottery, s.section))}</span>
          ${s.ews_in_name ? '<span class="tag">EWS</span>' : ''}
          <span class="tag">${esc(lottery.rounds[s.round])}</span>
        </div>
        <h1 class="t-title">${esc(s.project)}</h1>
        <p class="t-mr" lang="mr">${esc(s.name_mr)}</p>
        <p class="t-loc">${PIN_ICON}${esc(s.locality)} <span lang="mr">· ${esc(s.locality_mr)}</span></p>
        <p class="t-section">${esc(section.label)}</p>
      </div>
    </article>

    ${flags}

    <dl class="facts">${facts}</dl>

    <div class="detail-grid">
      <section class="panel">
        <h2 class="section-h">Homes by reserved category</h2>
        <p class="panel-note">How the ${fmtInt(s.units)} homes are split between reserved categories, as printed in the ad.</p>
        ${reservationsHtml(lottery, s)}
      </section>

      <section class="panel">
        <h2 class="section-h">Explore this project</h2>
        ${exploreHtml(lottery, s)}
        <div class="share">
          <a class="btn btn-primary" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">Share on WhatsApp</a>
          <button type="button" class="btn btn-ghost copy" data-copy="${esc(pageUrl)}">Copy link</button>
        </div>
      </section>
    </div>

    ${siblingsHtml(lottery, s)}`;

  // Going back keeps the filters the visitor had set on the list page.
  document.getElementById('back').addEventListener('click', (e) => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('.copy');
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.copy);
      const old = b.textContent;
      b.textContent = 'Copied ✓';
      setTimeout(() => { b.textContent = old; }, 1500);
    } catch { /* clipboard blocked: nothing useful to do */ }
  });
}

async function main() {
  const id = new URLSearchParams(location.search).get('id');
  let lottery;
  try {
    lottery = await loadLottery();
  } catch (err) {
    root.innerHTML = `<p class="error">Couldn't load scheme data. ${esc(err.message)}</p>`;
    return;
  }
  renderFooter(lottery);
  const s = lottery.schemes.find((x) => x.id === id);
  if (!s) {
    root.innerHTML = `<a class="back" href="./">← All schemes</a><p class="error">We couldn't find scheme “${esc(id)}”.</p>`;
    return;
  }
  render(lottery, s);
}

main();
