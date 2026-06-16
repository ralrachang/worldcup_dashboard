'use strict';

const teams = require('./teams');

/** 빈 순위 행 */
function emptyRow(code) {
  const t = teams.get(code);
  return {
    code: t.code, name: t.name, flag: t.flag,
    played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0,
  };
}

/**
 * 조 구성(groups) + 치른 결과(results)로 12개 조 순위를 계산한다.
 * 경기를 안 치른 조/팀도 0으로 모두 포함된다(프런트 탭이 전부 노출).
 * 정렬은 프런트(render.js rankSort)가 담당하므로 여기선 순서를 보장하지 않는다.
 */
function compute(groups, results) {
  const table = {};
  for (const [g, codes] of Object.entries(groups)) {
    table[g] = {};
    for (const c of codes) table[g][c] = emptyRow(c);
  }

  for (const m of results || []) {
    if (m.status !== 'FT') continue;
    const g = m.group;
    const row = table[g];
    if (!row) continue;
    const h = row[m.home && m.home.code];
    const a = row[m.away && m.away.code];
    if (!h || !a) continue;

    h.played += 1; a.played += 1;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;

    if (m.homeScore > m.awayScore) { h.win += 1; h.points += 3; a.loss += 1; }
    else if (m.homeScore < m.awayScore) { a.win += 1; a.points += 3; h.loss += 1; }
    else { h.draw += 1; a.draw += 1; h.points += 1; a.points += 1; }
  }

  const out = {};
  for (const g of Object.keys(table)) {
    out[g] = Object.values(table[g]).map((r) => ({ ...r, gd: r.gf - r.ga }));
  }
  return out;
}

module.exports = { compute };
