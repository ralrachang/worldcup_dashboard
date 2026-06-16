'use strict';

/* 국가별 선수단 + 월드컵 기록 페이지 (FM2026 스쿼드 뷰) */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const LINE_LABEL = { GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' };
const LINE_ORDER = ['GK', 'DF', 'MF', 'FW'];

// 평점 → 색상 등급
function ratingClass(r) {
  if (r == null) return '';
  if (r >= 7.5) return 'r-hot';
  if (r >= 7.0) return 'r-good';
  if (r >= 6.5) return 'r-ok';
  return 'r-low';
}
function num(v) { return v == null ? '–' : v; }

function getCode() {
  const p = new URLSearchParams(location.search);
  return String(p.get('code') || '').toUpperCase();
}

function renderHero(d) {
  const hero = document.getElementById('teamHero');
  const s = d.summary;
  const played = s && s.played > 0;
  let line2;
  if (!d.rosterReady) {
    line2 = '<span class="team-hero__pending">선수 명단 준비 중</span>';
  } else if (played) {
    const gd = s.gd > 0 ? `+${s.gd}` : `${s.gd}`;
    const rec = `${s.played}경기 · ${s.win}승 ${s.draw}무 ${s.loss}패`;
    const goals = `득점 ${s.gf} · 실점 ${s.ga} (${gd})`;
    const top = s.topScorer ? ` · 최다 득점 <b>${esc(s.topScorer.name)}</b> ${s.topScorer.goals}골` : '';
    line2 = `<span class="team-hero__rec">${rec}</span><span class="team-hero__sep">·</span><span>${goals}</span>${top}`;
  } else {
    line2 = '<span class="team-hero__pending">아직 경기 전 — 명단 정보만 제공</span>';
  }
  hero.innerHTML = `
    <div class="team-hero__crest">${flagImg(d.team.flag, 'team-hero__flag')}</div>
    <div class="team-hero__main">
      <div class="team-hero__row1">
        <h2 class="team-hero__name">${esc(d.team.name)}</h2>
        <span class="team-hero__group">GROUP ${esc(d.group)}</span>
        <span class="team-hero__code">${esc(d.team.code)}</span>
      </div>
      <div class="team-hero__row2">${line2}</div>
    </div>`;
}

function renderSquad(d) {
  const box = document.getElementById('squad');
  const note = document.getElementById('squadNote');

  if (!d.rosterReady || !d.data.length) {
    note.textContent = '';
    box.innerHTML = `<div class="empty">
      ${esc(d.team.name)} 선수 명단은 아직 준비 중입니다.<br>
      <span style="color:var(--text-mute)">server/seed/players.json 에 추가하면 자동 반영됩니다.</span>
    </div>`;
    return;
  }

  note.textContent = `${d.data.length}명`;
  const played = d.summary && d.summary.played > 0;

  // 라인별 그룹화 (API가 이미 라인→득점 순 정렬)
  const byLine = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of d.data) (byLine[p.line] || byLine.MF).push(p);

  let rows = '';
  for (const line of LINE_ORDER) {
    const group = byLine[line];
    if (!group.length) continue;
    rows += `<tr class="squad-sub"><td colspan="10">${LINE_LABEL[line]} <span>${group.length}</span></td></tr>`;
    for (const p of group) {
      const rc = ratingClass(p.rating);
      const dimRow = played && p.apps === 0 ? ' squad-row--bench' : '';
      rows += `
      <tr class="squad-row${dimRow}">
        <td class="c-pos"><span class="pos-pill pos-${p.line}">${esc(p.pos)}</span></td>
        <td class="c-name">${esc(p.name)}</td>
        <td class="c-age">${esc(p.age)}</td>
        <td class="c-club">${esc(p.club)}</td>
        <td class="c-num">${num(p.apps)}</td>
        <td class="c-num c-min">${p.minutes ? p.minutes + "'" : '–'}</td>
        <td class="c-num c-g">${p.goals ? p.goals : (played ? 0 : '–')}</td>
        <td class="c-num c-a">${p.assists ? p.assists : (played ? 0 : '–')}</td>
        <td class="c-rating"><span class="rating ${rc}">${p.rating == null ? '–' : p.rating.toFixed(1)}</span></td>
      </tr>`;
    }
  }

  box.innerHTML = `
    <table class="squad-table">
      <thead>
        <tr>
          <th class="c-pos">POS</th>
          <th class="c-name">선수</th>
          <th class="c-age">나이</th>
          <th class="c-club">소속팀</th>
          <th class="c-num" title="출전">MP</th>
          <th class="c-num" title="출전 시간">MIN</th>
          <th class="c-num" title="득점">G</th>
          <th class="c-num" title="도움">A</th>
          <th class="c-rating" title="평균 평점">평점</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function load() {
  const code = getCode();
  const hero = document.getElementById('teamHero');
  const box = document.getElementById('squad');
  if (!code) {
    hero.innerHTML = '<div class="empty">팀 코드가 없습니다.</div>';
    box.innerHTML = '';
    return;
  }
  try {
    const res = await fetch(`./api/team/${encodeURIComponent(code)}`);
    if (res.status === 404) {
      hero.innerHTML = `<div class="empty">알 수 없는 팀 코드: ${esc(code)}</div>`;
      box.innerHTML = '';
      return;
    }
    const d = await res.json();
    document.title = `${d.team.name} · SQUAD 2026`;
    renderHero(d);
    renderSquad(d);
  } catch (e) {
    hero.innerHTML = `<div class="empty">불러오기 실패: ${esc(e.message)}</div>`;
    box.innerHTML = '';
  }
}

load();
