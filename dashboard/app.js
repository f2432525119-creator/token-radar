// Token Radar dashboard: renders window.RADAR (written by main.ts as data.js).
// No fetch, no network. Filters, sorting and the model sandbox all run here,
// on the same board the entry scored, so the page, the screenshots and
// board.json always agree.
(function () {
  const R = window.RADAR;
  const $ = (id) => document.getElementById(id);
  const fmtUsd = (n) => {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + n;
  };
  const fmtPct = (n) => (n === null || n === undefined ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Header stats.
  const top = R.rows[0];
  $('stats').innerHTML = [
    [R.board_size, 'protocols ranked'],
    [R.watchlist_size, 'on the watchlist'],
    [R.early_size, 'early finds below the floor'],
    [R.live_size, 'live tokens for scale'],
  ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');

  // Model explainer, in the model's own words.
  const m = R.model;
  $('model').innerHTML = `<h2>How the ranking works — ${esc(R.model_version)}</h2>
    <p>Implied value = TVL × ${m.base_multiple} × growth × maturity × launch window × chains × category.
    Growth is the 7-day TVL change clamped to ${m.growth_floor}%…${m.growth_cap}% and weighted ${m.growth_weight}.
    Maturity rises from ${m.maturity_floor} to ${m.maturity_floor + m.maturity_range} over ${m.maturity_days} days.
    The launch window peaks at 1.08 for protocols 180–730 days old and fades for the very young and the very old.
    Each extra chain adds ${Math.round(m.chain_step * 100)}% (up to ${m.chain_cap} extra chains); a rare category adds ${Math.round(m.rare_category_boost * 100)}%.
    The formula is the same for every row. Snapshot: ${esc(R.as_of)}.</p>
    <p>Top of the board: <b>${esc(top.name)}</b> — ${fmtUsd(top.tvl_usd)} TVL, ${fmtPct(top.change_7d)} in 7 days, implied value ${fmtUsd(top.implied_value_usd)}.</p>`;

  // Filter options.
  const cats = [...new Set(R.rows.map((r) => r.category).filter(Boolean))].sort();
  const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
  $('cat').innerHTML += cats.map((c) => `<option>${esc(c)}</option>`).join('');
  $('chain').innerHTML += chains.map((c) => `<option>${esc(c)}</option>`).join('');

  let selected = null;

  function filtered() {
    const q = $('q').value.trim().toLowerCase();
    const cat = $('cat').value;
    const chain = $('chain').value;
    const watch = $('watchOnly').checked;
    let rows = R.rows.filter((r) => {
      if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q))) return false;
      if (cat && r.category !== cat) return false;
      if (chain && !r.chains.includes(chain)) return false;
      if (watch && !R.watchlist.includes(r.slug)) return false;
      return true;
    });
    const sort = $('sort').value;
    if (sort === 'tvl') rows = [...rows].sort((a, b) => b.tvl_usd - a.tvl_usd);
    else if (sort === 'growth') rows = [...rows].sort((a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9));
    else if (sort === 'value') rows = [...rows].sort((a, b) => b.implied_value_usd - a.implied_value_usd);
    return rows;
  }

  function render() {
    const rows = filtered().slice(0, 60);
    $('rows').innerHTML = rows.map((r) => `<tr data-slug="${esc(r.slug)}" class="${selected === r.slug ? 'sel' : ''}">
      <td>${r.rank}</td><td><b>${esc(r.name)}</b><br><span class="pill">${esc(r.slug)}</span></td>
      <td>${esc(r.category || '—')}</td><td>${r.chains.slice(0, 3).map(esc).join(', ')}${r.chains.length > 3 ? ' +' + (r.chains.length - 3) : ''}</td>
      <td class="num">${fmtUsd(r.tvl_usd)}</td>
      <td class="num ${r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'}">${fmtPct(r.change_7d)}</td>
      <td class="num"><b>${fmtUsd(r.implied_value_usd)}</b></td></tr>`).join('');
    $('count').textContent = `Showing ${rows.length} of ${R.board_size} ranked protocols. Click a row for its farm plan.`;
    document.querySelectorAll('#rows tr').forEach((tr) => tr.addEventListener('click', () => showDetail(tr.dataset.slug)));
    if (selected) showDetail(selected, true);
  }

  function showDetail(slug, keep) {
    const r = R.rows.find((x) => x.slug === slug);
    if (!r) return;
    selected = slug;
    document.querySelectorAll('#rows tr').forEach((tr) => tr.classList.toggle('sel', tr.dataset.slug === slug));
    $('detail').innerHTML = `<h3>${esc(r.name)}</h3>
      <p class="meta">Rank #${r.rank} · ${esc(r.category || 'No category')} · ${r.chains.map(esc).join(', ')} · TVL ${fmtUsd(r.tvl_usd)} · 7d ${fmtPct(r.change_7d)} · listed ${esc(r.listed_at || 'unknown')} · age ${r.age_days === null ? 'unknown' : r.age_days + ' days'}</p>
      <div class="mgrid">
        <div><span>Implied value</span><b>${fmtUsd(r.implied_value_usd)}</b></div>
        <div><span>Growth ×</span><b>${r.growth_multiplier}</b></div>
        <div><span>Maturity ×</span><b>${r.maturity_multiplier}</b></div>
        <div><span>Launch window ×</span><b>${r.launch_multiplier}</b></div>
        <div><span>Chains ×</span><b>${r.chain_multiplier}</b></div>
        <div><span>Category ×</span><b>${r.category_multiplier}</b></div>
      </div>
      <h2>Farm plan</h2>
      <ol>${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="note">Each step states its cost and time. The plan is derived from this protocol's category, chains, TVL and age — never from a hand-written list of names.</p>`;
    if (!keep) $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Live tokens.
  $('liveRows').innerHTML = R.live.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.category || '—')}</td>
    <td class="num">${fmtUsd(p.tvl_usd)}</td><td class="num">${p.mcap_usd === null ? '—' : fmtUsd(p.mcap_usd)}</td>
    <td class="num ${p.change_7d === null ? '' : p.change_7d >= 0 ? 'up' : 'down'}">${fmtPct(p.change_7d)}</td></tr>`).join('');

  // Model sandbox: recompute the ranking with the user's constants.
  const defs = [
    ['base_multiple', 'Base multiple', 0.05, 0.6, 0.05],
    ['growth_weight', 'Growth weight', 0, 1, 0.1],
    ['chain_step', 'Per extra chain', 0, 0.08, 0.01],
    ['rare_category_boost', 'Rare category boost', 0, 0.2, 0.05],
  ];
  const state = {};
  defs.forEach(([k, label, min, max, step]) => { state[k] = m[k]; });
  function recompute() {
    const rows = R.rows.map((r) => {
      const g = Math.min(120, Math.max(-60, r.change_7d ?? 0));
      const gm = 1 + (g / 100) * state.growth_weight;
      const age = r.age_days ?? 365;
      const mm = 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
      const cm = 1 + state.chain_step * Math.min(Math.max(r.chains.length - 1, 0), 4);
      const v = Math.max(1, Math.round(r.tvl_usd * state.base_multiple * gm * mm * r.launch_multiplier * cm * r.category_multiplier));
      return { name: r.name, v };
    }).sort((a, b) => b.v - a.v).slice(0, 5);
    $('sandboxNote').textContent = 'Top 5 with your settings: ' + rows.map((r, i) => `${i + 1}. ${r.name} (${fmtUsd(r.v)})`).join(' · ');
  }
  $('sliders').innerHTML = defs.map(([k, label, min, max, step]) => `<label>${label}: <b id="val-${k}">${state[k]}</b>
    <input type="range" id="sl-${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></label>`).join('');
  defs.forEach(([k]) => {
    $('sl-' + k).addEventListener('input', (e) => { state[k] = Number(e.target.value); $('val-' + k).textContent = e.target.value; recompute(); });
  });
  recompute();

  $('source').textContent = 'Source: ' + R.source + ' · Watchlist floor: ' + fmtUsd(R.floor_usd) + ' · Model ' + R.model_version + '.';
  ['q', 'cat', 'chain', 'sort', 'watchOnly'].forEach((id) => $(id).addEventListener('input', render));
  render();
})();
