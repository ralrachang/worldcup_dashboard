'use strict';

const teams = require('./teams');

/** 알려진 언론사 도메인 → 표기명 */
const OUTLETS = {
  'yna.co.kr': '연합뉴스',
  'newsis.com': '뉴시스',
  'jtbc.co.kr': 'JTBC',
  'hankookilbo.com': '한국일보',
  'sportschosun.com': '스포츠조선',
  'osen.co.kr': 'OSEN',
  'mk.co.kr': '매일경제',
  'joongang.co.kr': '중앙일보',
  'nocutnews.co.kr': '노컷뉴스',
  'sportsworldi.com': '스포츠월드',
  'besteleven.com': '베스트일레븐',
  'fourfourtwo.co.kr': '포포투',
  'stnsports.co.kr': 'STN스포츠',
  'wikitree.co.kr': '위키트리',
  'etoday.co.kr': '이투데이',
  'donga.com': '동아일보',
  'sports.naver.com': '네이버스포츠',
  'news.naver.com': '네이버뉴스',
};

function stripHtml(input) {
  if (!input) return '';
  return String(input)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function outletOf(url) {
  if (!url) return '네이버';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    for (const [domain, name] of Object.entries(OUTLETS)) {
      if (host.endsWith(domain)) return name;
    }
    return host;
  } catch {
    return '네이버';
  }
}

/**
 * 텍스트에서 스코어 추출. 0~19 범위의 "a-b / a:b / a대b" 패턴.
 * 연도(2026)·시간(10:00) 오인을 줄이기 위해 두 자리 이하 + 19 이하로 제한.
 */
function extractScore(text) {
  if (!text) return null;
  const re = /(?<!\d)(\d{1,2})\s*(?:-|:|대)\s*(\d{1,2})(?!\d)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a <= 19 && b <= 19) return [a, b];
  }
  return null;
}

function pubToIso(pubDate) {
  if (!pubDate) return new Date().toISOString();
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * 하이라이트 "영상" 링크. 가상 경기엔 실제 영상 URL이 없으므로
 * 팀명 기반 유튜브 검색 결과로 보낸다(항상 영상으로 떨어지고 404 없음).
 */
function highlightUrl(homeName, awayName) {
  const base = homeName && awayName ? `${homeName} ${awayName} 하이라이트` : '북중미 월드컵 하이라이트';
  const q = `${base} 2026 월드컵`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/**
 * 뉴스 검색 결과 → 경기 결과 카드 배열 (best-effort).
 * 같은 팀 조합은 한 번만(최신 우선).
 */
function parseResults(items, limit = 12) {
  const out = [];
  const seen = new Set();
  for (const it of items || []) {
    const title = stripHtml(it.title);
    const desc = stripHtml(it.description);
    const text = `${title} ${desc}`;
    const score = extractScore(title) || extractScore(text);
    const codes = teams.findTeams(text).slice(0, 2);
    if (!score || codes.length < 2) continue;
    const key = codes.slice().sort().join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    const home = teams.get(codes[0]);
    const away = teams.get(codes[1]);
    out.push({
      id: key.toLowerCase(),
      group: '',
      stage: '',
      home,
      away,
      homeScore: score[0],
      awayScore: score[1],
      status: 'FT',
      headline: title,
      source: outletOf(it.originallink || it.link),
      link: it.link || it.originallink || '',
      highlightLink: highlightUrl(home.name, away.name),
      publishedAt: pubToIso(it.pubDate),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * 뉴스 검색 결과 → 하이라이트 피드 배열.
 * "하이라이트" 키워드가 있는 항목만.
 */
function parseHighlights(items, limit = 12) {
  const out = [];
  const seen = new Set();
  for (const it of items || []) {
    const title = stripHtml(it.title);
    const desc = stripHtml(it.description);
    if (!/하이라이트/.test(`${title} ${desc}`)) continue;
    const link = it.link || it.originallink || '';
    if (seen.has(link)) continue;
    seen.add(link);
    const codes = teams.findTeams(`${title} ${desc}`).slice(0, 2);
    const home = codes[0] ? teams.get(codes[0]) : null;
    const away = codes[1] ? teams.get(codes[1]) : null;
    out.push({
      id: link,
      title,
      home,
      away,
      source: outletOf(it.originallink || it.link),
      // 영상으로 떨어지도록: 팀이 식별되면 유튜브 검색, 아니면 원문 기사
      link: home && away ? highlightUrl(home.name, away.name) : link,
      articleLink: link,
      thumbnail: '',
      publishedAt: pubToIso(it.pubDate),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** 뉴스 검색 결과 → 간단 뉴스 목록 (순위/일정 보강용) */
function toNews(items, limit = 6) {
  return (items || []).slice(0, limit).map((it) => ({
    title: stripHtml(it.title),
    source: outletOf(it.originallink || it.link),
    link: it.link || it.originallink || '',
    publishedAt: pubToIso(it.pubDate),
  }));
}

module.exports = { stripHtml, outletOf, extractScore, parseResults, parseHighlights, toNews, highlightUrl };
