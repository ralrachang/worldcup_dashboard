'use strict';

/* ── DOM/포맷 헬퍼 ─────────────────────────────────────── */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtKickoff(iso, timeTBD) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '미정', time: '--:--' };
  const day = `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { day, time: timeTBD ? 'TBD' : `${hh}:${mm}` };
}

function fmtRelative(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 60000; // 분
  if (diff < 1) return '방금';
  if (diff < 60) return `${Math.floor(diff)}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  return `${Math.floor(diff / 1440)}일 전`;
}

/* ── 경기 결과 카드 ───────────────────────────────────── */
function renderResults(list) {
  const grid = document.getElementById('resultsGrid');
  const count = document.getElementById('resultsCount');
  count.textContent = list.length ? `${list.length} 경기` : '';
  if (!list.length) {
    grid.innerHTML = '<div class="empty">표시할 경기 결과가 없습니다.</div>';
    return;
  }
  grid.innerHTML = list.map((m) => {
    const hWin = m.homeScore > m.awayScore;
    const aWin = m.awayScore > m.homeScore;
    const groupTag = m.group ? `<span class="match-card__group">GROUP ${esc(m.group)}</span>` : '<span></span>';
    const hl = m.highlightLink
      ? `<a class="hl-link" href="${esc(m.highlightLink)}" target="_blank" rel="noopener">▷ 하이라이트</a>`
      : '<span></span>';
    return `
    <article class="match-card">
      <div class="match-card__top">
        ${groupTag}
        <span class="match-card__status">${esc(m.stage || 'FT')}</span>
      </div>
      <div class="score-row">
        <div class="team team--home">
          <span class="team__flag">${esc(m.home.flag)}</span>
          <span class="team__code">${esc(m.home.code)}</span>
        </div>
        <div class="score">
          <span class="score__n ${hWin ? 'score__n--win' : aWin ? 'score__n--lose' : ''}">${esc(m.homeScore)}</span>
          <span class="score__sep">:</span>
          <span class="score__n ${aWin ? 'score__n--win' : hWin ? 'score__n--lose' : ''}">${esc(m.awayScore)}</span>
        </div>
        <div class="team team--away">
          <span class="team__flag">${esc(m.away.flag)}</span>
          <span class="team__code">${esc(m.away.code)}</span>
        </div>
      </div>
      <div class="match-card__foot">
        <span class="match-card__src">${esc(m.source || '')}</span>
        ${hl}
      </div>
    </article>`;
  }).join('');
}

/* ── 하이라이트 피드 ─────────────────────────────────── */
function renderHighlights(list) {
  const feed = document.getElementById('highlightFeed');
  if (!list.length) {
    feed.innerHTML = '<div class="empty">하이라이트가 없습니다.</div>';
    return;
  }
  feed.innerHTML = list.map((h) => {
    const label = h.home && h.away ? `${esc(h.home.code)} vs ${esc(h.away.code)}` : 'WC 2026';
    const img = h.thumbnail
      ? `<img class="hl-thumb__img" src="${esc(h.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
      : '';
    return `
    <a class="hl-item" href="${esc(h.link)}" target="_blank" rel="noopener">
      <span class="hl-thumb">${label}${img}<span class="hl-thumb__play">▶</span></span>
      <span class="hl-meta">
        <span class="hl-title">${esc(h.title)}</span>
        <span class="hl-sub"><span>${esc(h.source || '')}</span><span>${esc(fmtRelative(h.publishedAt))}</span></span>
      </span>
    </a>`;
  }).join('');
}

/* ── 경기 일정 (날짜별 그룹) ─────────────────────────── */
function renderFixtures(list) {
  const box = document.getElementById('fixtureList');
  if (!list.length) {
    box.innerHTML = '<div class="empty">예정된 경기가 없습니다.</div>';
    return;
  }
  const sorted = [...list].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  let html = '';
  let lastDay = '';
  for (const f of sorted) {
    const { day, time } = fmtKickoff(f.kickoff, f.timeTBD);
    if (day !== lastDay) {
      html += `<div class="fixture-day">${esc(day)}</div>`;
      lastDay = day;
    }
    const tags = [f.group ? `GROUP ${esc(f.group)}` : '', f.broadcast ? esc(f.broadcast) : '']
      .filter(Boolean).map((t) => `<span class="fixture__tag">${t}</span>`).join('');
    html += `
    <div class="fixture">
      <div class="fixture__time">${esc(time)}<small>${esc(f.timeTBD ? '시간미정' : 'KST')}</small></div>
      <div class="fixture__match">
        <span class="fixture__team">${esc(f.home.flag)} ${esc(f.home.name)}</span>
        <span class="fixture__vs">vs</span>
        <span class="fixture__team">${esc(f.away.flag)} ${esc(f.away.name)}</span>
      </div>
      <div>${tags}</div>
    </div>`;
  }
  box.innerHTML = html;
}

/* ── 순위표 ──────────────────────────────────────────── */
function rankSort(rows) {
  return [...rows].sort((a, b) =>
    b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
}

function renderStandingsGroup(rows) {
  const box = document.getElementById('standingsTable');
  const ranked = rankSort(rows);
  const body = ranked.map((t, i) => {
    const gdCls = t.gd > 0 ? 'st-gd--pos' : t.gd < 0 ? 'st-gd--neg' : '';
    const gd = t.gd > 0 ? `+${t.gd}` : `${t.gd}`;
    const qualify = i < 2 ? 'qualify' : '';
    return `
    <tr class="${qualify}">
      <td class="col-team">
        <span class="st-team">
          <span class="st-team__rank">${i + 1}</span>
          <span class="team__flag">${esc(t.flag)}</span>
          <span class="st-team__name">${esc(t.name)}</span>
        </span>
      </td>
      <td>${esc(t.played)}</td>
      <td>${esc(t.win)}</td>
      <td>${esc(t.draw)}</td>
      <td>${esc(t.loss)}</td>
      <td class="${gdCls}">${esc(gd)}</td>
      <td class="st-pts">${esc(t.points)}</td>
    </tr>`;
  }).join('');
  box.innerHTML = `
    <table class="standings">
      <thead>
        <tr>
          <th class="col-team">팀</th>
          <th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function renderStandingsNews(news) {
  const box = document.getElementById('standingsNews');
  if (!news || !news.length) { box.innerHTML = ''; return; }
  box.innerHTML = news.slice(0, 4).map((n) =>
    `<a class="standings-news__item" href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>`
  ).join('');
}

window.Render = {
  renderResults, renderHighlights, renderFixtures,
  renderStandingsGroup, renderStandingsNews,
};
