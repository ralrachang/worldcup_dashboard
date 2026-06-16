'use strict';

/* 상태 */
const state = {
  standings: {},      // { group: rows }
  activeGroup: null,
  pollMs: 60000,
  timer: null,
};

/* ── 상태 배지 / 메타 갱신 ──────────────────────────────── */
function setSourceBadge(source) {
  const badge = document.getElementById('sourceBadge');
  const footer = document.getElementById('footerMode');
  const live = document.getElementById('liveBadge');
  if (source === 'live') {
    badge.textContent = 'LIVE';
    badge.className = 'badge badge--source-live';
    footer.textContent = '실시간 모드 (네이버 검색 API)';
    live.style.display = '';
  } else {
    badge.textContent = 'SEED';
    badge.className = 'badge badge--seed';
    footer.textContent = '시드 모드 (네이버 API 키 미설정 — .env 설정 시 실시간 전환)';
  }
}

function setUpdated(iso) {
  const el = document.getElementById('updatedAt');
  const d = new Date(iso || Date.now());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  el.textContent = `업데이트 ${hh}:${mm}:${ss}`;
}

/* ── 순위표 탭 ──────────────────────────────────────────── */
function buildGroupTabs() {
  const tabs = document.getElementById('groupTabs');
  const groups = Object.keys(state.standings).sort();
  if (!groups.length) { tabs.innerHTML = ''; return; }
  if (!state.activeGroup || !groups.includes(state.activeGroup)) {
    state.activeGroup = groups[0];
  }
  tabs.innerHTML = groups.map((g) =>
    `<button class="group-tab ${g === state.activeGroup ? 'is-active' : ''}" data-group="${g}" role="tab">${g}조</button>`
  ).join('');
  tabs.querySelectorAll('.group-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeGroup = btn.dataset.group;
      buildGroupTabs();
      Render.renderStandingsGroup(state.standings[state.activeGroup] || []);
    });
  });
}

/* ── 개별 섹션 로드 ─────────────────────────────────────── */
async function loadResults() {
  const data = await API.results();
  Render.renderResults(data.data || []);
  return data.source;
}

async function loadHighlights() {
  const data = await API.highlights();
  Render.renderHighlights(data.data || []);
}

async function loadFixtures() {
  const data = await API.fixtures();
  Render.renderFixtures(data.data || []);
}

async function loadStandings() {
  const data = await API.standings();
  state.standings = data.data || {};
  buildGroupTabs();
  Render.renderStandingsGroup(state.standings[state.activeGroup] || []);
  Render.renderStandingsNews(data.news || []);
}

/* ── 전체 새로고침 ──────────────────────────────────────── */
async function refreshAll() {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('is-loading');
  try {
    const [resultsSource] = await Promise.all([
      loadResults().catch((e) => { console.error(e); return 'seed'; }),
      loadHighlights().catch((e) => console.error(e)),
      loadFixtures().catch((e) => console.error(e)),
      loadStandings().catch((e) => console.error(e)),
    ]);
    setSourceBadge(resultsSource);
    setUpdated();
  } finally {
    btn.classList.remove('is-loading');
  }
}

/* ── 부팅 ───────────────────────────────────────────────── */
function showSkeletons() {
  document.getElementById('resultsGrid').innerHTML =
    Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
  document.getElementById('highlightFeed').innerHTML =
    Array.from({ length: 4 }, () => '<div class="skeleton" style="height:66px"></div>').join('');
}

function startPolling() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(refreshAll, state.pollMs);
}

document.addEventListener('DOMContentLoaded', () => {
  showSkeletons();
  document.getElementById('refreshBtn').addEventListener('click', refreshAll);
  // 탭이 백그라운드일 땐 폴링 중단(쿼터 절약)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(state.timer); state.timer = null; }
    else if (!state.timer) { refreshAll(); startPolling(); }
  });
  refreshAll().then(startPolling);
});
