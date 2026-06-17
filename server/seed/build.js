'use strict';

/**
 * 시드 생성기 (실제 draw 기반) — 단일 소스 source-games.json 으로부터
 * groups.json / results.json / fixtures.json / highlights.json 를 만든다.
 *
 *   node server/seed/build.js
 *
 * source-games.json = 네이버 스포츠 공식 일정 API(조별리그 72경기) 스냅샷.
 *   각 행: { dt(KST naive), venue, group(A~L), round('1'|'2'|'3'),
 *           status('RESULT'|'BEFORE'...), home/away(FIFA코드), hs/as, winner }
 *   갱신: m.sports.naver.com/fifaworldcup2026 의 schedule/games API 재수집 후 교체.
 *
 * 순위(standings)는 런타임에 server/standings.js 가 groups+results 로부터 계산.
 * 득점자/라인업 실측이 확보된 경기만 GOALS/SUBS/META 에 명시(없으면 스코어만, 엔진 시뮬).
 */
const fs = require('fs');
const path = require('path');
const teams = require('../teams');
const parser = require('../parser');
const source = require('./source-games.json');

const T = (code) => teams.get(code);
const key = (h, a) => `${h}-${a}`;
const isoKST = (dt) => `${dt}+09:00`;
const stageName = (r) => `조별리그 ${r}차전`;

// ── 실측 득점자/도움 (네이버 뉴스 기반, 1차전) ────────────────────────────
// key=`${home}-${away}`(source-games 의 홈/원정 순서와 동일). s=득점자, a=도움(선택).
// 배열 길이가 스코어보다 적으면(자책/미확인) 나머지는 선수 귀속 안 됨 — 의도된 동작.
const GOALS = {
  'GER-CUW': { home: [{ s: '펠릭스 은메차', a: '플로리안 비르츠' }, { s: '니코 슐로터벡', a: '나타니엘 브라운' }, { s: '카이 하베르츠' }, { s: '자말 무시알라', a: '요주아 키미히' }, { s: '나타니엘 브라운', a: '데니즈 운디아우' }, { s: '데니즈 운디아우', a: '요주아 키미히' }, { s: '카이 하베르츠', a: '데니즈 운디아우' }], away: [{ s: '리바노 코메넨시아' }] },
  'KOR-CZE': { home: [{ s: '황인범' }, { s: '오현규' }], away: [{ s: '라디슬라프 크레이치' }] },
  'MEX-RSA': { home: [{ s: '훌리안 퀴노네스' }, { s: '라울 히메네스' }], away: [] },
  'CIV-ECU': { home: [{ s: '아마드 디알로' }], away: [] },
  'NED-JPN': { home: [{ s: '버질 반 다이크' }], away: [{ s: '나카무라 게이토' }, { s: '가마다 다이치' }] },
  'QAT-SUI': { home: [{ s: '부알렘 쿠키', a: '호맘 아흐메드' }], away: [{ s: '브릴 엠볼로' }] },
  'USA-PAR': { home: [{ s: '폴린하 발로건', a: '크리스천 풀리식' }, { s: '폴린하 발로건' }, { s: '지오바니 레이나' }], away: [{ s: '마우리시우' }] },
  'KSA-URU': { home: [{ s: '압둘라예 알 암리' }], away: [{ s: '막시밀리아노 아라우호' }] },
  'SWE-TUN': { home: [{ s: '야신 아야리', a: '알렉산데르 이사크' }, { s: '알렉산데르 이사크', a: '빅토르 요케레스' }, { s: '빅토르 요케레스', a: '알렉산데르 이사크' }, { s: '마티아스 스반베리' }, { s: '야신 아야리' }], away: [{ s: '라니 케디라' }] },
};
const SUBS = {
  // 한국 3-4-3: 손흥민(원톱) → 후반 24분(69') 오현규 교체 IN, 오현규 역전골.
  'KOR-CZE': { home: [{ off: '손흥민', on: '오현규', min: 69 }] },
};

// ── 실측 메타 (헤드라인/하이라이트 제목/출처/썸네일/기사). 없으면 자동 생성. ──
const META = {
  'GER-CUW': { headline: '독일, 월드컵 데뷔국 퀴라소에 7-1 대승…우승후보다운 화력', hlTitle: '독일:퀴라소 하이라이트…2026 북중미 월드컵 조별리그 1차전', source: '한국일보', link: 'https://n.news.naver.com/mnews/article/469/0000936481?sid=104', thumbnail: 'https://search.pstatic.net/sunny/?type=b150&src=https%3A%2F%2Fcdn.mania.kr%2Fdvdprime%2Ffile%2F2606%2Fhumor_1750481_20260615091938_93a9500249a48192_poster.jpg' },
  'KOR-CZE': { headline: '한국, 체코 꺾고 2-1 역전승…16년 만의 월드컵 첫 경기 승리', hlTitle: '황인범·오현규 역전골…한국 2-1 체코 짜릿한 역전승 주요 장면', source: '네이버스포츠', link: 'https://m.sports.naver.com/worldcup2026/article/425/0000194557', thumbnail: 'https://search.pstatic.net/common/?type=b150&src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F5356%2F2026%2F06%2F10%2F0000797362_002_20260610000010512.jpg' },
  'MEX-RSA': { headline: '멕시코, 남아공 2-0 완승…개최국 위용 과시한 산뜻한 출발', hlTitle: '멕시코 2-0 남아공 하이라이트…히메네스 멀티골 폭발', source: '연합뉴스', link: 'https://www.yna.co.kr/sports/worldcup', thumbnail: '' },
  'CIV-ECU': { headline: '디알로 후반 45분 극장골…코트디부아르, 에콰도르 1-0 격파', hlTitle: '디알로 후반 추가시간 결승골…코트디부아르 1-0 에콰도르 하이라이트', source: '노컷뉴스', link: 'https://n.news.naver.com/mnews/article/079/0004157739?sid=104', thumbnail: 'https://search.pstatic.net/common/?type=b150&src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F311%2F2014%2F06%2F15%2F1402725267937_99_20140615010004.jpg' },
  'NED-JPN': { headline: '일본, 후반 44분 가마다 극장 동점골…네덜란드와 2-2 무승부', hlTitle: '네덜란드:일본 하이라이트…2026 북중미 월드컵 조별리그 1차전', source: '한국일보', link: 'https://n.news.naver.com/mnews/article/469/0000936472?sid=104', thumbnail: 'https://search.pstatic.net/common/?type=b150&src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F5838%2F2026%2F03%2F27%2F0000021704_001_20260327224810673.jpeg' },
  'QAT-SUI': { headline: '카타르-스위스 1-1 무승부…스위스, 경기 주도하고도 승점 1점', hlTitle: '카타르 1-1 스위스 하이라이트…스위스의 아쉬운 무승부', source: '베스트일레븐', link: 'https://m.sports.naver.com/worldcup2026/article/343/0000143650', thumbnail: 'https://search.pstatic.net/sunny/?type=b150&src=https%3A%2F%2Fpng.pngtree.com%2Fbackground%2F20221030%2Foriginal%2Fpngtree-qatar-schedule-match-picture-image_1931995.jpg' },
  'USA-PAR': { headline: '개최국 미국, 파라과이 4-1 완파…전반에 승부 갈랐다', hlTitle: '미국, 파라과이 4-1 완파 하이라이트…개최국 화력쇼', source: 'STN스포츠', link: 'https://m.sports.naver.com/worldcup2026/article/450/0000151921', thumbnail: 'https://search.pstatic.net/sunny/?type=b150&src=https%3A%2F%2Fimg1.daumcdn.net%2Fthumb%2FR1280x0.fpng%2F%3Ffname%3Dhttp%3A%2F%2Ft1.kakaocdn.net%2Fbrunch%2Fservice%2Fuser%2FhU86%2Fimage%2F2DyNFMssmNNC6jvrzyyF3R2HdVQ.png' },
  'KSA-URU': { headline: '사우디, 우루과이와 1-1 무승부…알 암리 선제골, 후반 아라우호 동점', hlTitle: '사우디아라비아 1-1 우루과이 하이라이트…알 암리·아라우호 교환골', source: '스포티비뉴스', link: 'https://m.sports.naver.com/worldcup2026/article/477/0000613636', thumbnail: '' },
  'SWE-TUN': { headline: '스웨덴, 튀니지 5-1 완파…아야리 멀티골로 F조 선두', hlTitle: '스웨덴 5-1 튀니지 하이라이트…아야리 멀티골·이사크·요케레스 활약', source: '한국일보', link: 'https://www.hankooki.com/news/articleView.html?idxno=335786', thumbnail: '' },
};

const BROADCASTS = ['KBS', 'SBS', 'MBC', '쿠팡플레이', 'tvN'];

// ── 자동 헤드라인 (실측 메타 없는 경기용) ─────────────────────────────────
function autoHeadline(g) {
  const h = T(g.home).name, a = T(g.away).name;
  if (g.winner === 'HOME') return `${h}, ${a} 꺾고 ${g.hs}-${g.as} 승리`;
  if (g.winner === 'AWAY') return `${a}, ${h} 원정서 ${g.as}-${g.hs} 승리`;
  return `${h} ${g.hs}-${g.as} ${a} 무승부`;
}
const mapG = (arr) => (arr || []).map((x) => ({ scorer: x.s, assist: x.a || null }));

// ── groups.json (조→코드[], 등장 순서) ───────────────────────────────────
const groupsObj = {};
for (const g of source) {
  (groupsObj[g.group] = groupsObj[g.group] || []);
  for (const c of [g.home, g.away]) if (!groupsObj[g.group].includes(c)) groupsObj[g.group].push(c);
}
const groups = {};
for (const k of Object.keys(groupsObj).sort()) groups[k] = groupsObj[k];

// ── 결과/예정 분리 ───────────────────────────────────────────────────────
const played = source.filter((g) => g.status === 'RESULT');
const upcoming = source.filter((g) => g.status !== 'RESULT');

const results = played.map((g) => {
  const home = T(g.home), away = T(g.away);
  const k = key(g.home, g.away);
  const gg = GOALS[k] || { home: [], away: [] };
  const meta = META[k] || {};
  const row = {
    id: k.toLowerCase(),
    group: g.group,
    stage: stageName(g.round),
    home, away,
    homeScore: g.hs, awayScore: g.as,
    status: 'FT',
    headline: meta.headline || autoHeadline(g),
    source: meta.source || '네이버 스포츠',
    link: meta.link || parser.highlightUrl(home.name, away.name),
    highlightLink: parser.highlightUrl(home.name, away.name),
    venue: g.venue || '',
    publishedAt: isoKST(g.dt),
    homeGoals: mapG(gg.home),
    awayGoals: mapG(gg.away),
  };
  const subs = SUBS[k];
  if (subs && subs.home) row.homeSubs = subs.home;
  if (subs && subs.away) row.awaySubs = subs.away;
  return row;
}).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const highlights = played.map((g) => {
  const home = T(g.home), away = T(g.away);
  const meta = META[key(g.home, g.away)] || {};
  return {
    id: `hl-${key(g.home, g.away)}`.toLowerCase(),
    title: meta.hlTitle || `${home.name} ${g.hs}-${g.as} ${away.name} 하이라이트`,
    home: { code: home.code, name: home.name, flag: home.flag },
    away: { code: away.code, name: away.name, flag: away.flag },
    source: meta.source || '네이버 스포츠',
    link: parser.highlightUrl(home.name, away.name),
    thumbnail: meta.thumbnail || '',
    publishedAt: isoKST(g.dt),
  };
}).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

let metaIdx = 0;
const fixtures = upcoming.map((g) => {
  const home = T(g.home), away = T(g.away);
  let broadcast = BROADCASTS[metaIdx % BROADCASTS.length];
  if (g.home === 'KOR' || g.away === 'KOR') broadcast = 'KBS';
  metaIdx += 1;
  return {
    id: `fx-${key(g.home, g.away)}`.toLowerCase(),
    group: g.group,
    stage: stageName(g.round),
    home, away,
    kickoff: isoKST(g.dt),
    timeTBD: false,
    venue: g.venue || '',
    broadcast,
  };
}).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

// ── 기록 ────────────────────────────────────────────────────────────────
const out = (name, data) =>
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
out('groups.json', groups);
out('results.json', results);
out('highlights.json', highlights);
out('fixtures.json', fixtures);

console.log(`✅ 생성 완료 — results ${results.length} · highlights ${highlights.length} · fixtures ${fixtures.length}`);
console.log(`   조 ${Object.keys(groups).length}개 · 팀 ${Object.values(groups).flat().length}개 · 소스 ${source.length}경기`);
