'use strict';

/**
 * 선수 기록 엔진 — 로스터(seed/players.json) + 치른 결과(results)로부터
 * 각 선수의 월드컵 기록(출전·분·득점·도움·평점)을 결정적으로 산출한다.
 *
 * 핵심 원칙
 *  - 결과 정합: 한 팀이 어떤 경기에서 넣은 골의 합 = 실제 스코어.
 *  - 결정적(deterministic): 같은 입력이면 항상 같은 출력(경기 id+팀+선수로 시드).
 *  - 경기를 안 치른 팀의 선수는 기록 공란(apps=0, rating=null) — 이름/나이/소속만.
 *
 * 골/도움은 포지션 가중치로 분배하므로 "그럴듯한" 분포가 나온다(공격수가 더 많이).
 */

const rosters = require('./seed/players.json');
const groups = require('./seed/groups.json');
const teams = require('./teams');

// 코드 → 소속 조
const GROUP_OF = {};
for (const [g, codes] of Object.entries(groups)) for (const c of codes) GROUP_OF[c] = g;

// 포지션 → 라인(정렬/그룹용)
const POS_LINE = {
  GK: 'GK',
  RB: 'DF', LB: 'DF', CB: 'DF', RWB: 'DF', LWB: 'DF',
  DM: 'MF', CM: 'MF', AM: 'MF', RM: 'MF', LM: 'MF',
  RW: 'FW', LW: 'FW', SS: 'FW', CF: 'FW', ST: 'FW', FW: 'FW',
};
const LINE_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };
function lineOf(pos) { return POS_LINE[pos] || 'MF'; }

// 골 기여 가중치(공격수↑)
const SCORE_W = {
  GK: 0.05, CB: 0.8, RB: 1, LB: 1, RWB: 1.2, LWB: 1.2,
  DM: 1.2, CM: 2.5, AM: 5, RM: 4, LM: 4,
  RW: 6, LW: 6, SS: 7, CF: 8, ST: 8, FW: 7,
};

// ── 결정적 RNG (mulberry32 + 문자열 해시 시드) ───────────────────────────
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function makeRng(seedStr) {
  let a = hashSeed(seedStr);
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 가중 추출: 후보 인덱스 중 weight에 비례해 하나 선택
function weightedPick(rand, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  let r = rand() * sum;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

// ── 한 경기에서 한 팀의 라인업/기록 시뮬레이션 ───────────────────────────
function simulateMatch(code, roster, match, isHome, acc) {
  const gf = isHome ? match.homeScore : match.awayScore; // 우리 팀 득점
  const ga = isHome ? match.awayScore : match.homeScore; // 실점
  const result = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  const cleanSheet = ga === 0;
  const rand = makeRng(`${match.id}|${code}`);

  // 선발 11 = 로스터 앞 11명(작성 시 라인업 순). 벤치 후보 = 그 다음(필드 교체이므로 GK 제외).
  const starters = roster.slice(0, 11).map((_, i) => i);
  const benchIdx = roster.map((_, i) => i).slice(11).filter((i) => roster[i].pos !== 'GK');

  const byName = {};
  roster.forEach((p, i) => { byName[p.name] = i; });

  // 출전 시간(분): 선발 90 + 교체 반영.
  const minutes = new Array(roster.length).fill(0);
  for (const i of starters) minutes[i] = 90;

  const subsData = isHome ? match.homeSubs : match.awaySubs;
  if (Array.isArray(subsData)) {
    // 명시적 교체(네이버 기반): off 선수는 해당 분까지, on 선수는 잔여 시간.
    for (const sub of subsData) {
      const offi = byName[sub.off];
      const oni = byName[sub.on];
      if (offi != null) minutes[offi] = sub.min;
      if (oni != null) minutes[oni] = Math.max(1, 90 - sub.min);
    }
  } else {
    // 교체 데이터 없는 경기 → 비-GK 선발 중 최대 3명 아웃, 벤치 중 같은 수 인(시뮬).
    const outable = starters.filter((i) => roster[i].pos !== 'GK');
    const nSubs = Math.min(3, benchIdx.length, outable.length);
    const subbedOut = [];
    const pool = [...outable];
    for (let s = 0; s < nSubs; s++) {
      if (!pool.length) break;
      const w = pool.map((i) => (SCORE_W[roster[i].pos] || 1) + 0.5);
      const pi = weightedPick(rand, w);
      const out = pool.splice(pi, 1)[0];
      const offMin = 60 + Math.floor(rand() * 25); // 60~84분 교체
      minutes[out] = offMin;
      subbedOut.push(offMin);
    }
    for (let s = 0; s < subbedOut.length; s++) {
      const inIdx = benchIdx[s];
      if (inIdx == null) break;
      minutes[inIdx] = 90 - subbedOut[s];
    }
  }

  // 득점/도움 = 네이버 뉴스 기반 명시 데이터(실제 득점자). 랜덤 분배 안 함.
  // 명단(이름)과 정확히 일치하는 득점자만 귀속. 자책골/미확인 골은 선수에게 안 붙음(스코어와 차이 OK).
  const goalEntries = isHome ? (match.homeGoals || []) : (match.awayGoals || []);
  const goals = new Array(roster.length).fill(0);
  const assists = new Array(roster.length).fill(0);
  for (const ge of goalEntries) {
    const si = byName[ge.scorer];
    if (si == null) continue;
    goals[si] += 1;
    if (minutes[si] === 0) minutes[si] = 20; // 교체 출전 득점자 출전시간 보장
    if (ge.assist) {
      const ai = byName[ge.assist];
      if (ai != null) { assists[ai] += 1; if (minutes[ai] === 0) minutes[ai] = 20; }
    }
  }
  const onPitch = roster.map((_, i) => i).filter((i) => minutes[i] > 0);

  // 평점 + 누적
  for (const i of onPitch) {
    const line = lineOf(roster[i].pos);
    let r = 6.6;
    r += result === 'W' ? 0.25 : result === 'L' ? -0.2 : 0;
    r += 0.45 * goals[i] + 0.22 * assists[i];
    if (line === 'GK') r += cleanSheet ? 0.5 : -0.12 * ga;
    else if (line === 'DF') r += cleanSheet ? 0.25 : -0.06 * ga;
    r += (rand() - 0.5) * 0.5; // ±0.25 노이즈
    r = Math.max(5.3, Math.min(9.7, r));

    const a = acc[i];
    a.apps += 1;
    a.minutes += minutes[i];
    a.goals += goals[i];
    a.assists += assists[i];
    a.ratingSum += r;
    a.ratingN += 1;
  }
}

// ── 공개 API: 팀 상세(로스터 + 누적 기록) ────────────────────────────────
function getTeam(code, results) {
  const roster = rosters[code];
  const t = teams.get(code);
  const group = GROUP_OF[code] || '';
  if (!roster) return null;

  const acc = roster.map(() => ({
    apps: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, ratingN: 0,
  }));

  const myMatches = (results || []).filter(
    (m) => m.status === 'FT' && (m.home.code === code || m.away.code === code)
  );
  for (const m of myMatches) simulateMatch(code, roster, m, m.home.code === code, acc);

  const players = roster.map((p, i) => {
    const a = acc[i];
    return {
      name: p.name,
      pos: p.pos,
      line: lineOf(p.pos),
      age: p.age,
      club: p.club,
      apps: a.apps,
      minutes: a.minutes,
      goals: a.goals,
      assists: a.assists,
      rating: a.ratingN ? Math.round((a.ratingSum / a.ratingN) * 10) / 10 : null,
    };
  });

  // 정렬: 라인(GK→DF→MF→FW) → 득점↓ → 출전↓ → 로스터 순
  players.sort((x, y) =>
    LINE_ORDER[x.line] - LINE_ORDER[y.line] ||
    y.goals - x.goals || y.apps - x.apps ||
    roster.findIndex((p) => p.name === x.name) - roster.findIndex((p) => p.name === y.name)
  );

  // 팀 요약
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (const m of myMatches) {
    const home = m.home.code === code;
    const us = home ? m.homeScore : m.awayScore;
    const them = home ? m.awayScore : m.homeScore;
    gf += us; ga += them;
    if (us > them) w++; else if (us < them) l++; else d++;
  }
  const topScorer = players.filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0] || null;

  return {
    team: { code: t.code, name: t.name, flag: t.flag },
    group,
    summary: {
      played: myMatches.length, win: w, draw: d, loss: l, gf, ga, gd: gf - ga,
      topScorer: topScorer ? { name: topScorer.name, goals: topScorer.goals } : null,
    },
    players,
  };
}

function hasRoster(code) { return Boolean(rosters[code]); }

module.exports = { getTeam, hasRoster };
