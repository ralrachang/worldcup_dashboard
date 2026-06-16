'use strict';

/* ── 국기: 이모지 → 이미지 (대시보드/팀페이지 공용) ────────────────────
   Windows(Segoe UI Emoji)는 잉글랜드/스코틀랜드 같은 subdivision 태그
   국기를 지원하지 않아 검은 깃발로 깨진다. 데이터는 이모지 그대로 두고,
   렌더 시 flagcdn SVG 이미지로 변환해 전 플랫폼에서 동일하게 보이게 한다.
   이미지 실패 시 원래 이모지로 폴백. */

const SUBDIVISION_FLAGS = {
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿': 'gb-eng', // 잉글랜드
  '🏴󠁧󠁢󠁳󠁣󠁴󠁿': 'gb-sct', // 스코틀랜드
  '🏴󠁧󠁢󠁷󠁬󠁳󠁿': 'gb-wls', // 웨일스
  '🏴󠁧󠁢󠁮󠁩󠁲󠁿': 'gb-nir', // 북아일랜드
};

function flagEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function flagISO(emoji) {
  if (!emoji) return '';
  if (SUBDIVISION_FLAGS[emoji]) return SUBDIVISION_FLAGS[emoji];
  const cp = [...emoji].map((ch) => ch.codePointAt(0));
  // 지역 인디케이터 2개(U+1F1E6~U+1F1FF) → ISO 3166-1 alpha-2 소문자
  if (cp.length >= 2 &&
      cp[0] >= 0x1F1E6 && cp[0] <= 0x1F1FF &&
      cp[1] >= 0x1F1E6 && cp[1] <= 0x1F1FF) {
    return String.fromCharCode(cp[0] - 0x1F1E6 + 97) + String.fromCharCode(cp[1] - 0x1F1E6 + 97);
  }
  return '';
}

function flagImg(emoji, cls) {
  const klass = cls || 'team__flag';
  const iso = flagISO(emoji);
  if (!iso) return `<span class="${klass}">${flagEsc(emoji)}</span>`;
  return `<img class="${klass}" src="https://flagcdn.com/${iso}.svg" alt=""` +
    ` loading="lazy" decoding="async" data-emoji="${flagEsc(emoji)}" onerror="flagFallback(this)">`;
}

// 이미지 로드 실패 시 원본 이모지 span 으로 교체 (인라인 onerror 핸들러)
window.flagFallback = function (img) {
  const span = document.createElement('span');
  span.className = img.className;
  span.textContent = img.getAttribute('data-emoji') || '🏳️';
  img.replaceWith(span);
};

window.flagISO = flagISO;
window.flagImg = flagImg;
