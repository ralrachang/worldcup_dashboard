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
    hlTitle: '이강인·손흥민 폭발…한국 2-1 체코 역전승 주요 장면',
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
];

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
const VENUE_OVERRIDE = { 'KOR-MEX': '에스타디오 과달라하라 (멕시코)' };

// 4팀 라운드로빈: MD1 (0,1)(2,3) · MD2 (0,2)(3,1) · MD3 (0,3)(1,2)
const RR = [
  [[0, 1], [2, 3]],
  [[0, 2], [3, 1]],
  [[0, 3], [1, 2]],
];
// 치르지 않은 경기 날짜(전부 오늘 2026-06-16 이후). [md] -> 시작일
const FX_BASE = { 1: '2026-06-17', 2: '2026-06-21', 3: '2026-06-25' };
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
  return {
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
  };
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
      const venue = VENUE_OVERRIDE[key] || VENUES[metaIdx % VENUES.length];
      let broadcast = BROADCASTS[metaIdx % BROADCASTS.length];
      if (hc === 'KOR' || ac === 'KOR') broadcast = 'KBS';
      metaIdx += 1;
      fixtures.push({
        id: `fx-${key}`.toLowerCase(),
        group: g,
        stage: `조별리그 ${md0 + 1}차전`,
        home, away,
        kickoff: fxDate(md0 + 1, gi, slot),
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
