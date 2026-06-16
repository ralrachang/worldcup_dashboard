'use strict';

/**
 * 네이버 검색 API 클라이언트.
 * https://developers.naver.com/docs/serviceapi/search/news/news.md
 * 키(NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)가 없으면 search() 가 null 을 반환하고
 * 호출부는 시드 데이터로 폴백한다.
 */
const API_BASE = 'https://openapi.naver.com/v1/search';

function getCreds() {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

function hasKeys() {
  return !!getCreds();
}

async function search(type, query, { display = 10, sort = 'date', start = 1 } = {}) {
  const creds = getCreds();
  if (!creds) return null; // 키 없음 → 폴백 신호

  const url =
    `${API_BASE}/${type}.json?query=${encodeURIComponent(query)}` +
    `&display=${display}&sort=${sort}&start=${start}`;

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': creds.id,
      'X-Naver-Client-Secret': creds.secret,
    },
  });

  if (!res.ok) {
    throw new Error(`Naver ${type} API ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.items || [];
}

module.exports = {
  hasKeys,
  search,
  searchNews: (q, opts) => search('news', q, opts),
  searchBlog: (q, opts) => search('blog', q, opts),
  searchImage: (q, opts) => search('image', q, opts),
};
