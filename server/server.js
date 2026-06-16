'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const naver = require('./naver');
const parser = require('./parser');
const cache = require('./cache');
const standings = require('./standings');
const teamsMod = require('./teams');
const playersEngine = require('./players');

// ── 의존성 없이 .env 로드 (dotenv 미사용) ───────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv();

// ── 시드 데이터 (키 없이도 전체 동작) ──────────────────────────────────
const groups = require('./seed/groups.json');
const seed = {
  results: require('./seed/results.json'),
  highlights: require('./seed/highlights.json'),
  fixtures: require('./seed/fixtures.json'),
  // 순위는 결과로부터 런타임 계산 (조 구성 정본 = groups.json)
  standings: standings.compute(groups, require('./seed/results.json')),
};

const app = express();
const PORT = process.env.PORT || 3000;
const TTL = 5 * 60 * 1000; // 5분

function envelope(source, data, extra = {}) {
  return { source, updatedAt: new Date().toISOString(), ...extra, data };
}

// 라이브 하이라이트에 네이버 이미지 검색 썸네일을 붙인다 (best-effort, 실패 무시).
async function enrichHighlightThumbs(highlights) {
  await Promise.allSettled(
    highlights.map(async (h) => {
      if (h.thumbnail) return;
      const label = h.home && h.away ? `${h.home.name} ${h.away.name}` : '';
      const query = `${label} 북중미 월드컵`.trim();
      try {
        const imgs = await naver.searchImage(query, { display: 3, sort: 'sim' });
        if (imgs && imgs[0] && imgs[0].thumbnail) h.thumbnail = imgs[0].thumbnail;
      } catch {
        /* 이미지 보강 실패는 무시 — 프런트가 그라데이션 폴백 */
      }
    })
  );
  return highlights;
}

// ── /api/results : 실시간 뉴스 파싱 → 실패 시 시드 ──────────────────────
app.get('/api/results', async (_req, res) => {
  try {
    const payload = await cache.getOrSet('results', TTL, async () => {
      if (!naver.hasKeys()) return envelope('seed', seed.results);
      const items = await naver.searchNews('북중미 월드컵 경기 결과 스코어', { display: 30, sort: 'date' });
      const parsed = parser.parseResults(items);
      return parsed.length ? envelope('live', parsed) : envelope('seed', seed.results);
    });
    res.json(payload);
  } catch (e) {
    res.json(envelope('seed', seed.results, { error: e.message }));
  }
});

// ── /api/highlights : 하이라이트 키워드 필터 → 실패 시 시드 ─────────────
app.get('/api/highlights', async (_req, res) => {
  try {
    const payload = await cache.getOrSet('highlights', TTL, async () => {
      if (!naver.hasKeys()) return envelope('seed', seed.highlights);
      const items = await naver.searchNews('북중미 월드컵 하이라이트', { display: 30, sort: 'date' });
      const parsed = parser.parseHighlights(items);
      if (!parsed.length) return envelope('seed', seed.highlights);
      await enrichHighlightThumbs(parsed);
      return envelope('live', parsed);
    });
    res.json(payload);
  } catch (e) {
    res.json(envelope('seed', seed.highlights, { error: e.message }));
  }
});

// ── /api/fixtures : 시드 정본 (검색만으론 정확 파싱 불안정) ──────────────
app.get('/api/fixtures', (_req, res) => {
  res.json(envelope('seed', seed.fixtures));
});

// ── /api/standings : 시드 정본 + (키 있으면) 순위 뉴스 보강 ──────────────
app.get('/api/standings', async (_req, res) => {
  try {
    const payload = await cache.getOrSet('standings', TTL, async () => {
      let news = [];
      if (naver.hasKeys()) {
        const items = await naver.searchNews('북중미 월드컵 조별리그 중간순위 승점', { display: 6, sort: 'date' });
        news = parser.toNews(items);
      }
      return envelope('seed', seed.standings, { news });
    });
    res.json(payload);
  } catch (e) {
    res.json(envelope('seed', seed.standings, { error: e.message }));
  }
});

// ── /api/team/:code : 팀 선수단 + 월드컵 기록(치른 결과에서 산출) ───────
const GROUP_OF = {};
for (const [g, codes] of Object.entries(groups)) for (const c of codes) GROUP_OF[c] = g;

app.get('/api/team/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const group = GROUP_OF[code];
  if (!group) return res.status(404).json({ error: 'unknown_team', code });

  const updatedAt = new Date().toISOString();
  const data = playersEngine.getTeam(code, seed.results);
  if (!data) {
    // 조에는 있으나 명단 미작성 — 페이지가 "명단 준비중"으로 안전하게 표시
    const t = teamsMod.get(code);
    return res.json({
      source: 'seed', updatedAt, group, rosterReady: false,
      team: { code: t.code, name: t.name, flag: t.flag }, summary: null, data: [],
    });
  }
  res.json({
    source: 'seed', updatedAt, group: data.group, rosterReady: true,
    team: data.team, summary: data.summary, data: data.players,
  });
});

// ── 상태 (디버그용) ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: naver.hasKeys() ? 'live' : 'seed', time: new Date().toISOString() });
});

// ── 정적 프런트 ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// 로컬(node server/server.js)에서 직접 실행할 때만 listen.
// Vercel 등 서버리스에서는 app 을 핸들러로 export (listen 안 함).
if (require.main === module) {
  app.listen(PORT, () => {
    const mode = naver.hasKeys() ? '실시간(네이버 API)' : '시드(키 없음)';
    console.log(`⚽ 월드컵 대시보드 실행 중 → http://localhost:${PORT}  [${mode}]`);
  });
}

module.exports = app;
