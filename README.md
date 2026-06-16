# ⚽ 월드컵 대시보드 (WCD)

네이버 검색을 이용해 **2026 북중미 월드컵**의 **경기 결과**와 **하이라이트**를
딱 파싱해서 보여주는 단일 페이지 대시보드. 디자인은 Football Manager 2026 풍
(다크 네이비 + 시안 액센트, 데이터 밀도 높은 카드 대시보드).

화면 구성: **경기 결과 · 하이라이트 피드 · 경기 일정 · 조별 순위표**

---

## 빠른 시작

```bash
npm install
npm start
# → http://localhost:3000
```

> 네이버 API 키가 없어도 **시드 데이터**로 전체 화면이 즉시 동작합니다(데모 가능).
> 우측 상단 배지가 `SEED`로 표시됩니다.

---

## 실시간 데이터로 전환 (네이버 API 키)

1. https://developers.naver.com/apps → **애플리케이션 등록**
2. 사용 API에서 **검색**을 추가
3. 발급된 **Client ID / Client Secret**을 복사
4. `.env.example`을 복사해 `.env`로 만들고 값 입력:

   ```env
   NAVER_CLIENT_ID=발급받은_아이디
   NAVER_CLIENT_SECRET=발급받은_시크릿
   ```

5. `npm start` 재실행 → 배지가 `LIVE`로 바뀌고 최신 검색 결과가 들어옵니다.

---

## 동작 방식

```
브라우저(public/) ──fetch──▶ Express(server/) ──▶ 네이버 검색 API
                                  │  파싱(parser.js) + 5분 캐시(cache.js)
                                  └─ 키 없음/에러 시 ─▶ server/seed/*.json
```

| 엔드포인트 | 데이터 | 비고 |
|---|---|---|
| `GET /api/results` | 경기 결과 카드 | 뉴스 검색 + 스코어 정규식 파싱 |
| `GET /api/highlights` | 하이라이트 피드 | "하이라이트" 키워드 필터 |
| `GET /api/fixtures` | 경기 일정 | 시드 정본 (편집 가능) |
| `GET /api/standings` | 조별 순위 | 시드 정본 + 순위 뉴스 보강 |

응답에는 `source: "live" | "seed"`와 `updatedAt`이 포함됩니다.

### 데이터 신뢰도 (정직한 전제)
네이버 **검색** 결과는 기사 제목/요약 안에 스코어가 문장으로 들어있어
(`2-1 역전승`, `1-7 완패`), 자동 파싱은 **best-effort 휴리스틱**입니다.

- **결과 / 하이라이트** — 검색 + 파싱으로 잘 동작
- **일정 / 순위** — `server/seed/*.json`을 **정본**으로 두고 직접 편집하세요.
  (순수 검색만으론 일정표/순위표의 정확한 구조 파싱이 불안정)

시드 데이터는 2026-06-15 기준 실제 1차전 결과로 채워져 있습니다.

---

## 프로젝트 구조

```
worldcup dashboard/
├── server/
│   ├── server.js        Express 서버 + /api/* 라우트 + .env 로더
│   ├── naver.js         네이버 검색 API 클라이언트
│   ├── parser.js        스코어/팀/하이라이트 파싱
│   ├── cache.js         인메모리 TTL 캐시
│   ├── teams.js         팀 사전(한글↔코드↔국기)
│   └── seed/*.json      시드 데이터(결과/하이라이트/일정/순위)
├── public/
│   ├── index.html
│   ├── css/             tokens.css(디자인 토큰) + styles.css
│   └── js/              api.js · render.js · app.js
├── .env.example
└── package.json
```

---

## 커스터마이즈 팁

- **일정/순위 수정**: `server/seed/fixtures.json`, `server/seed/standings.json` 편집
- **팀 추가/국기**: `server/teams.js`의 `TEAMS`에 항목 추가
- **검색 쿼리 조정**: `server/server.js`의 각 라우트 `searchNews('...')` 문구 변경
- **색/폰트**: `public/css/tokens.css` 변수 수정
- **폴링 주기**: `public/js/app.js`의 `pollMs`(기본 60초)

## 주의
- 네이버 검색 API 일일 쿼터(약 25,000회/일) — 5분 캐시로 보호.
- 트래픽이 큰 운영 배포 시 캐시 TTL/프록시 정책을 별도 검토하세요.
