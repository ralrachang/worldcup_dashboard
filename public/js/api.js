'use strict';

/** 간단한 API 래퍼: /api/* 호출 + JSON 반환. 에러는 throw. */
const API = {
  async get(path) {
    const res = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json();
  },
  results() { return this.get('/api/results'); },
  highlights() { return this.get('/api/highlights'); },
  fixtures() { return this.get('/api/fixtures'); },
  standings() { return this.get('/api/standings'); },
};

window.API = API;
