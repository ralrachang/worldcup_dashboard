'use strict';

/**
 * 시드 생성기 — 단일 소스(groups.json + 아래 PLAYED 표)로부터
 * results.json / fixtures.json / highlights.json 를 만든다.
 *
 *   node server/seed/build.js
 *
 * 순위(standings)는 런타임에 server/standings.js 가 results 로부터 계산한다.
 * 조 구성을 바꾸려면 groups.json, 치른 경기를 바꾸려면 아래 PLAYED 만 수정.
 */
const fs = require('fs');
const path = require('path');
const teams = require('../teams');
const parser = require('../parser');

const groups = require('./groups.json');
const T = (code) => teams.get(code);
const pairKey = (a, b) => [a, b].sort().join('-');

// ── 이미 치른 경기 (정본) ───────────────────────────────────────────────
// home/away 는 FIFA 코드. group 은 자동 추론(groups.json 에서 찾음).
const PLAYED = [
  { home: 'GER', away: 'CUW', hs: 7, as: 1, stage: '조별리그 1차전',
    headline: '독일, 월드컵 데뷔국 퀴라소에 7-1 대승…우승후보다운 화력',
    hlTitle: '독일:퀴라소 하이라이트…2026 북중미 월드컵 조별리그 1차전',
    source: '한국일보', link: 'https://n.news.naver.com/mnews/article/469/0000936481?sid=104',
    publishedAt: '2026-06-15T06:18:00+09:00',
    thumbnail: 'https://search.pstatic.net/sunny/?type=b150&src=https%3A%2F%2Fcdn.mania.kr%2Fdvdprime%2Ffile%2F2606%2Fhumor_1750481_20260615091938_93a9500249a48192_poster.jpg' },

  { home: 'KOR', away: 'CZE', hs: 2, as: 1, stage: '조별리그 1차전',
    headline: '한국, 체코 꺾고 2-1 역전승…16년 만의 월드컵 첫 경기 승리',
    hlTitle: '황인범·오현규 역전골…한국 2-1 체코 짜릿한 역전승 주요 장면',
    source: '네이버스포츠', link: 'https://m.sports.naver.com/worldcup2026/article/425/0000194557',
    publishedAt: '2026-06-12T13:00:00+09:00',
    thumbnail: 'https://search.pstatic.net/common/?type=b150&src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F5356%2F2026%2F06%2F10%2F0000797362_002_20260610000010512.jpg' },

  { home: 'MEX', away: 'RSA', hs: 2, as: 0, stage: '조별리그 1차전',
    headline: '멕시코, 남아공 2-0 완승…개최국 위용 과시한 산뜻한 출발',
    hlTitle: '멕시코 2-0 남아공 하이라이트…히메네스 멀티골 폭발',
    source: '연합뉴스', link: 'https://www.yna.co.kr/sports/worldcup',
    publishedAt: '2026-06-13T11:00:00+09:00', thumbnail: '' },

  { home: 'CIV', away: 'ECU', hs: 1, as: 0, stage: '조별리그 1차전',
    headline: '디알로 후반 45분 극장골…코트디부아르, 에콰도르 1-0 격파',
    hlTitle: '디알로 후반 추가시간 결승골…코트디부아르 1-0 에콰도르 하이라이트',
    source: '노컷뉴스', link: 'https://n.news.naver.com/mnews/article/079/0004157739?sid=104',
    publishedAt: '2026-06-15T10:15:00+09:00',
    thumbnail: 'https://search.pstatic.net/common/?type=b150&src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F311%2F2014%2F06%2F15%2F1402725267937_99_20140615010004.jpg' },

  { home: 'NED', away: 'JPN', hs: 2, as: 2, stage: '조별리그 1차전',
    headline: '일본, 후반 44분 가마다 극장 동점골…네덜란드와 2-2 무승부',
    hlTitle: '네덜란드:일본 하이라이트…2026 북중미 월드컵 조별리그 1차전',
    source: '한국일보', link: 'https://n.news.naver.com/mnews/article/469/0000936472?sid=104',
    publishedAt: '2026-06-15T07:50:00+09:00',
    thumbnail: 'https://search.pstatic.net/common/?type=b150&src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F5838%2F2026%2F03%2F27%2F0000021704_001_20260327224810673.jpeg' },

  { home: 'QAT', away: 'SUI', hs: 1, as: 1, stage: '조별리그 1차전',
    headline: '카타르-스위스 1-1 무승부…스위스, 경기 주도하고도 승점 1점',
    hlTitle: '카타르 1-1 스위스 하이라이트…스위스의 아쉬운 무승부',
    source: '베스트일레븐', link: 'https://m.sports.naver.com/worldcup2026/article/343/0000143650',
    publishedAt: '2026-06-14T13:28:00+09:00',
    thumbnail: 'https://search.pstatic.net/sunny/?type=b150&src=https%3A%2F%2Fpng.pngtree.com%2Fbackground%2F20221030%2Foriginal%2Fpngtree-qatar-schedule-match-picture-image_1931995.jpg' },

  { home: 'USA', away: 'PAR', hs: 4, as: 1, stage: '조별리그 1차전',
    headline: '개최국 미국, 파라과이 4-1 완파…전반에 승부 갈랐다',
    hlTitle: '미국, 파라과이 4-1 완파 하이라이트…개최국 화력쇼',
    source: 'STN스포츠', link: 'https://m.sports.naver.com/worldcup2026/article/450/0000151921',
    publishedAt: '2026-06-13T17:21:00+09:00',
    thumbnail: 'https://search.pstatic.net/sunny/?type=b150&src=https%3A%2F%2Fimg1.daumcdn.net%2Fthumb%2FR1280x0.fpng%2F%3Ffname%3Dhttp%3A%2F%2Ft1.kakaocdn.net%2Fbrunch%2Fservice%2Fuser%2FhU86%2Fimage%2F2DyNFMssmNNC6jvrzyyF3R2HdVQ.png' },

  { home: 'URU', away: 'KSA', hs: 1, as: 1, stage: '조별리그 1차전',
    headline: '우루과이, 사우디와 1-1 무승부…후반 아라우호 동점골',
    hlTitle: '우루과이 1-1 사우디아라비아 하이라이트…후반 아라우호 동점골',
    source: '스포티비뉴스', link: 'https://m.sports.naver.com/worldcup2026/article/477/0000613636',
    publishedAt: '2026-06-16T05:30:00+09:00', thumbnail: '' },

  { home: 'SWE', away: 'TUN', hs: 5, as: 1, stage: '조별리그 1차전',
    headline: '스웨덴, 튀니지 5-1 완파…아야리 멀티골로 F조 선두',
    hlTitle: '스웨덴 5-1 튀니지 하이라이트…아야리 멀티골·이사크·요케레스 활약',
    source: '한국일보', link: 'https://www.hankooki.com/news/articleView.html?idxno=335786',
    publishedAt: '2026-06-15T14:00:00+09:00', thumbnail: '' },
];

// ── 실제 득점자/도움 (네이버 뉴스 기반, 이 시뮬 세계관의 1차전 기록) ──────
// key: `${home}-${away}`. s=득점자, a=도움(선택). 명단(players.json) 이름과 정확히 일치해야 함.
// 배열 길이가 스코어보다 적으면(자책골/미확인 골) 나머지는 선수에게 귀속 안 됨 — 의도된 동작.
const GOALS = {
  'GER-CUW': { home: [{ s: '펠릭스 은메차', a: '플로리안 비르츠' }, { s: '니코 슐로터벡', a: '나타니엘 브라운' }, { s: '카이 하베르츠' }, { s: '자말 무시알라', a: '요주아 키미히' }, { s: '나타니엘 브라운', a: '데니즈 운디아우' }, { s: '데니즈 운디아우', a: '요주아 키미히' }, { s: '카이 하베르츠', a: '데니즈 운디아우' }], away: [{ s: '리바노 코메넨시아' }] },
  'KOR-CZE': { home: [{ s: '황인범' }, { s: '오현규' }], away: [{ s: '라디슬라프 크레이치' }] },
  'MEX-RSA': { home: [{ s: '훌리안 퀴노네스' }, { s: '라울 히메네스' }], away: [] },
  'CIV-ECU': { home: [{ s: '아마드 디알로' }], away: [] },
  'NED-JPN': { home: [{ s: '버질 반 다이크' }], away: [{ s: '나카무라 게이토' }, { s: '가마다 다이치' }] },
  'QAT-SUI': { home: [{ s: '부알렘 쿠키', a: '호맘 아흐메드' }], away: [{ s: '브릴 엠볼로' }] },
  'USA-PAR': { home: [{ s: '폴린하 발로건', a: '크리스천 풀리식' }, { s: '폴린하 발로건' }, { s: '지오바니 레이나' }], away: [{ s: '마우리시우' }] },
  'URU-KSA': { home: [{ s: '막시밀리아노 아라우호' }], away: [{ s: '압둘라예 알 암리' }] },
  'SWE-TUN': { home: [{ s: '야신 아야리', a: '알렉산데르 이사크' }, { s: '알렉산데르 이사크', a: '빅토르 요케레스' }, { s: '빅토르 요케레스', a: '알렉산데르 이사크' }, { s: '마티아스 스반베리' }, { s: '야신 아야리' }], away: [{ s: '라니 케디라' }] },
};
const goalsFor = (home, away) => GOALS[`${home}-${away}`] || { home: [], away: [] };

// ── 실제 선발/교체 (네이버 기반). 데이터 있는 팀만 명시 — 없으면 엔진이 시뮬. ──
// 선발 라인업은 players.json 의 "앞 11명"으로 표현(작성 순서 = 선발). 여기선 교체만 기록.
// off=빠진 선수, on=투입 선수, min=교체된 분. home/away 중 데이터 있는 쪽만 키 작성.
const SUBS = {
  // 한국 3-4-3: 손흥민(원톱) → 후반 24분(69') 오현규 교체 IN, 오현규 역전골.
  'KOR-CZE': { home: [{ off: '손흥민', on: '오현규', min: 69 }] },
};

// 코드 → 소속 조
const GROUP_OF = {};
for (const [g, codes] of Object.entries(groups)) for (const c of codes) GROUP_OF[c] = g;

// ── 일정/중계 메타 ──────────────────────────────────────────────────────
const VENUES = [
  'MetLife 스타디움 (뉴욕/뉴저지)', 'SoFi 스타디움 (로스앤젤레스)', 'AT&T 스타디움 (댈러스)',
  '메르세데스-벤츠 스타디움 (애틀랜타)', '애로헤드 스타디움 (캔자스시티)', '링컨 파이낸셜 필드 (필라델피아)',
  '에스타디오 아스테카 (멕시코시티)', '기예르모 카뇨 (몬테레이, 멕시코)', 'BC 플레이스 (밴쿠버, 캐나다)',
  'BMO 필드 (토론토, 캐나다)', 'NRG 스타디움 (휴스턴)', '레비스 스타디움 (샌프란시스코)',
];
const BROADCASTS = ['KBS', 'SBS', 'MBC', '쿠팡플레이', 'tvN'];

// ── 실제 일정 오버라이드 ─────────────────────────────────────────────────
// 가상 조편성 중 A·E·F 3개 조는 실제 2026 월드컵 조와 정확히 일치한다(양 1차전이
// 실제 대진과 매핑됨). 따라서 이 세 조의 잔여 경기는 실제 일정으로 교정한다.
// 네이버 뉴스/웹 실측(2026-06-17 KST). key=`${home}-${away}`(RR 생성 순서와 동일).
// kickoff/venue 만 덮어쓰고, broadcast 미지정 시 아래 합성 규칙(KOR=KBS 등) 유지.
// (참고: 2026 월드컵 한국 중계권은 JTBC 독점 — 표시 중계사는 데모용 합성값.)
const FX_OVERRIDE = {
  // A조 (= 실제 A조: KOR·CZE·MEX·RSA)
  'KOR-MEX': { kickoff: '2026-06-19T10:00:00+09:00', venue: '에스타디오 과달라하라 (사포판, 멕시코)' },
  'RSA-CZE': { kickoff: '2026-06-19T01:00:00+09:00', venue: '메르세데스-벤츠 스타디움 (애틀랜타)' },
  'KOR-RSA': { kickoff: '2026-06-25T10:00:00+09:00', venue: '에스타디오 BBVA (몬테레이, 멕시코)' },
  'CZE-MEX': { kickoff: '2026-06-25T10:00:00+09:00', venue: '에스타디오 아스테카 (멕시코시티)' },
  // E조 (= 실제 E조: GER·CUW·CIV·ECU)
  'GER-CIV': { kickoff: '2026-06-21T05:00:00+09:00', venue: 'BMO 필드 (토론토, 캐나다)' },
  'ECU-CUW': { kickoff: '2026-06-21T09:00:00+09:00', venue: '애로헤드 스타디움 (캔자스시티)' },
  'GER-ECU': { kickoff: '2026-06-26T05:00:00+09:00', venue: 'MetLife 스타디움 (뉴욕/뉴저지)' },
  'CUW-CIV': { kickoff: '2026-06-26T05:00:00+09:00', venue: '링컨 파이낸셜 필드 (필라델피아)' },
  // F조 (= 실제 F조: NED·JPN·SWE·TUN)
  'NED-SWE': { kickoff: '2026-06-21T02:00:00+09:00', venue: 'NRG 스타디움 (휴스턴)' },
  'TUN-JPN': { kickoff: '2026-06-21T13:00:00+09:00', venue: '에스타디오 BBVA (몬테레이, 멕시코)' },
  'NED-TUN': { kickoff: '2026-06-26T08:00:00+09:00', venue: '애로헤드 스타디움 (캔자스시티)' },
  'JPN-SWE': { kickoff: '2026-06-26T08:00:00+09:00', venue: 'AT&T 스타디움 (댈러스)' },
};

// 4팀 라운드로빈: MD1 (0,1)(2,3) · MD2 (0,2)(3,1) · MD3 (0,3)(1,2)
const RR = [
  [[0, 1], [2, 3]],
  [[0, 2], [3, 1]],
  [[0, 3], [1, 2]],
];
// 합성 일정 기준일(오버라이드 없는 가상 대진용). 실제 대회 달력에 맞춰 전진:
// MD1 잔여=6/18~, MD2=6/19~(실제 6/19~22), MD3=6/24~(실제 6/23~27). 과거 날짜 방지.
const FX_BASE = { 1: '2026-06-18', 2: '2026-06-19', 3: '2026-06-24' };
function fxDate(md, groupIndex, slot) {
  // 정오 UTC + UTC 날짜연산으로 타임존 롤오버 방지 (Y-M-D 만 사용)
  const d = new Date(`${FX_BASE[md]}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.floor(groupIndex / 3));
  const iso = d.toISOString().slice(0, 10);
  const hh = slot === 0 ? '23' : '08';
  return `${iso}T${hh}:00:00+09:00`;
}

// ── 생성 ────────────────────────────────────────────────────────────────
const playedKeys = new Set(PLAYED.map((m) => pairKey(m.home, m.away)));

const results = PLAYED.map((m) => {
  const home = T(m.home), away = T(m.away);
  const g = goalsFor(m.home, m.away);
  const mapG = (arr) => arr.map((x) => ({ scorer: x.s, assist: x.a || null }));
  const subs = SUBS[`${m.home}-${m.away}`] || {};
  const row = {
    id: `${m.home}-${m.away}`.toLowerCase(),
    group: GROUP_OF[m.home] || '',
    stage: m.stage,
    home, away,
    homeScore: m.hs, awayScore: m.as,
    status: 'FT',
    headline: m.headline,
    source: m.source,
    link: m.link,
    highlightLink: parser.highlightUrl(home.name, away.name),
    publishedAt: m.publishedAt,
    homeGoals: mapG(g.home),
    awayGoals: mapG(g.away),
  };
  if (subs.home) row.homeSubs = subs.home;
  if (subs.away) row.awaySubs = subs.away;
  return row;
});

const highlights = PLAYED.map((m) => {
  const home = T(m.home), away = T(m.away);
  return {
    id: `hl-${m.home}-${m.away}`.toLowerCase(),
    title: m.hlTitle,
    home: { code: home.code, name: home.name, flag: home.flag },
    away: { code: away.code, name: away.name, flag: away.flag },
    source: m.source,
    link: parser.highlightUrl(home.name, away.name),
    thumbnail: m.thumbnail || '',
    publishedAt: m.publishedAt,
  };
}).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const fixtures = [];
let metaIdx = 0;
Object.keys(groups).forEach((g, gi) => {
  const codes = groups[g];
  RR.forEach((round, md0) => {
    round.forEach(([i, j], slot) => {
      const hc = codes[i], ac = codes[j];
      if (playedKeys.has(pairKey(hc, ac))) return; // 이미 치른 경기는 제외
      const home = T(hc), away = T(ac);
      const key = `${hc}-${ac}`;
      const ov = FX_OVERRIDE[key] || {};
      const venue = ov.venue || VENUES[metaIdx % VENUES.length];
      let broadcast = ov.broadcast || BROADCASTS[metaIdx % BROADCASTS.length];
      if (!ov.broadcast && (hc === 'KOR' || ac === 'KOR')) broadcast = 'KBS';
      metaIdx += 1;
      fixtures.push({
        id: `fx-${key}`.toLowerCase(),
        group: g,
        stage: `조별리그 ${md0 + 1}차전`,
        home, away,
        kickoff: ov.kickoff || fxDate(md0 + 1, gi, slot),
        timeTBD: false,
        venue,
        broadcast,
      });
    });
  });
});
fixtures.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

// ── 기록 ────────────────────────────────────────────────────────────────
const out = (name, data) =>
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
out('results.json', results);
out('highlights.json', highlights);
out('fixtures.json', fixtures);

console.log(`✅ 생성 완료 — results ${results.length} · highlights ${highlights.length} · fixtures ${fixtures.length}`);
console.log(`   조 ${Object.keys(groups).length}개 · 팀 ${Object.values(groups).flat().length}개`);
