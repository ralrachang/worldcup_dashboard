'use strict';

/**
 * 아주 단순한 인메모리 TTL 캐시.
 * 네이버 검색 API 일일 쿼터(약 25,000회/일) 보호 + 응답 가속용.
 */
const store = new Map();

async function getOrSet(key, ttlMs, producer) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = await producer();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

function clear() {
  store.clear();
}

module.exports = { getOrSet, clear };
