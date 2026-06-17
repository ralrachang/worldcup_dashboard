'use strict';

/**
 * 팀 사전: FIFA 코드 → { code, name(한글), flag, aliases }
 * 파서가 뉴스 텍스트에서 팀명을 인식할 때 aliases 를 사용한다.
 * 2026 북중미 월드컵 출전국 위주 + 자주 등장하는 강팀 포함.
 */
const TEAMS = {
  KOR: { name: '대한민국', flag: '🇰🇷', aliases: ['대한민국', '한국', '코리아', '홍명보호', '태극전사'] },
  JPN: { name: '일본', flag: '🇯🇵', aliases: ['일본'] },
  MEX: { name: '멕시코', flag: '🇲🇽', aliases: ['멕시코'] },
  CZE: { name: '체코', flag: '🇨🇿', aliases: ['체코'] },
  RSA: { name: '남아프리카공화국', flag: '🇿🇦', aliases: ['남아프리카공화국', '남아공'] },
  GER: { name: '독일', flag: '🇩🇪', aliases: ['독일'] },
  CUW: { name: '퀴라소', flag: '🇨🇼', aliases: ['퀴라소'] },
  CIV: { name: '코트디부아르', flag: '🇨🇮', aliases: ['코트디부아르'] },
  ECU: { name: '에콰도르', flag: '🇪🇨', aliases: ['에콰도르'] },
  NED: { name: '네덜란드', flag: '🇳🇱', aliases: ['네덜란드', '오렌지 군단', '오렌지군단'] },
  SWE: { name: '스웨덴', flag: '🇸🇪', aliases: ['스웨덴'] },
  TUN: { name: '튀니지', flag: '🇹🇳', aliases: ['튀니지'] },
  QAT: { name: '카타르', flag: '🇶🇦', aliases: ['카타르'] },
  SUI: { name: '스위스', flag: '🇨🇭', aliases: ['스위스'] },
  USA: { name: '미국', flag: '🇺🇸', aliases: ['미국'] },
  PAR: { name: '파라과이', flag: '🇵🇾', aliases: ['파라과이'] },
  URU: { name: '우루과이', flag: '🇺🇾', aliases: ['우루과이'] },
  KSA: { name: '사우디아라비아', flag: '🇸🇦', aliases: ['사우디아라비아', '사우디'] },
  BRA: { name: '브라질', flag: '🇧🇷', aliases: ['브라질'] },
  ARG: { name: '아르헨티나', flag: '🇦🇷', aliases: ['아르헨티나'] },
  POR: { name: '포르투갈', flag: '🇵🇹', aliases: ['포르투갈'] },
  ENG: { name: '잉글랜드', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', aliases: ['잉글랜드'] },
  FRA: { name: '프랑스', flag: '🇫🇷', aliases: ['프랑스'] },
  ESP: { name: '스페인', flag: '🇪🇸', aliases: ['스페인'] },
  ITA: { name: '이탈리아', flag: '🇮🇹', aliases: ['이탈리아'] },
  NGA: { name: '나이지리아', flag: '🇳🇬', aliases: ['나이지리아'] },
  IRN: { name: '이란', flag: '🇮🇷', aliases: ['이란'] },
  CRO: { name: '크로아티아', flag: '🇭🇷', aliases: ['크로아티아'] },
  BEL: { name: '벨기에', flag: '🇧🇪', aliases: ['벨기에'] },
  COL: { name: '콜롬비아', flag: '🇨🇴', aliases: ['콜롬비아'] },
  CAN: { name: '캐나다', flag: '🇨🇦', aliases: ['캐나다'] },
  AUS: { name: '호주', flag: '🇦🇺', aliases: ['호주'] },
  SEN: { name: '세네갈', flag: '🇸🇳', aliases: ['세네갈'] },
  MAR: { name: '모로코', flag: '🇲🇦', aliases: ['모로코'] },
  JAM: { name: '자메이카', flag: '🇯🇲', aliases: ['자메이카'] },
  PAN: { name: '파나마', flag: '🇵🇦', aliases: ['파나마'] },
  CRC: { name: '코스타리카', flag: '🇨🇷', aliases: ['코스타리카'] },
  EGY: { name: '이집트', flag: '🇪🇬', aliases: ['이집트'] },
  GHA: { name: '가나', flag: '🇬🇭', aliases: ['가나'] },
  ALG: { name: '알제리', flag: '🇩🇿', aliases: ['알제리'] },
  CMR: { name: '카메룬', flag: '🇨🇲', aliases: ['카메룬'] },
  NZL: { name: '뉴질랜드', flag: '🇳🇿', aliases: ['뉴질랜드'] },
  JOR: { name: '요르단', flag: '🇯🇴', aliases: ['요르단'] },
  UZB: { name: '우즈베키스탄', flag: '🇺🇿', aliases: ['우즈베키스탄', '우즈벡'] },
  NOR: { name: '노르웨이', flag: '🇳🇴', aliases: ['노르웨이'] },
  AUT: { name: '오스트리아', flag: '🇦🇹', aliases: ['오스트리아'] },
  SCO: { name: '스코틀랜드', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', aliases: ['스코틀랜드'] },
  POL: { name: '폴란드', flag: '🇵🇱', aliases: ['폴란드'] },
  // 2026 본선 실제 진출국 보강 (실제 draw 반영)
  BIH: { name: '보스니아헤르체고비나', flag: '🇧🇦', aliases: ['보스니아 헤르체고비나', '보스니아헤르체고비나', '보스니아'] },
  HAI: { name: '아이티', flag: '🇭🇹', aliases: ['아이티'] },
  TUR: { name: '튀르키예', flag: '🇹🇷', aliases: ['튀르키예', '터키'] },
  CPV: { name: '카보베르데', flag: '🇨🇻', aliases: ['카보베르데'] },
  IRQ: { name: '이라크', flag: '🇮🇶', aliases: ['이라크'] },
  COD: { name: '콩고민주공화국', flag: '🇨🇩', aliases: ['콩고민주공화국', '콩고DR', 'DR콩고'] },
};

// alias → code 역색인 (긴 별칭부터 매칭하도록 정렬용 목록도 생성)
const ALIAS_TO_CODE = {};
for (const [code, t] of Object.entries(TEAMS)) {
  ALIAS_TO_CODE[t.name] = code;
  for (const a of t.aliases) ALIAS_TO_CODE[a] = code;
}
// 긴 별칭 우선 (예: '남아프리카공화국' 이 '남아공'보다 먼저)
const ALIASES_BY_LENGTH = Object.keys(ALIAS_TO_CODE).sort((a, b) => b.length - a.length);

function get(code) {
  const t = TEAMS[code];
  if (!t) return { code, name: code, flag: '🏳️' };
  return { code, name: t.name, flag: t.flag };
}

/**
 * 텍스트에서 팀을 "처음 등장한 순서"대로, 중복 없이 코드 배열로 반환.
 * 예: "퀴라소, 독일전서 1-7 패배" → ['CUW', 'GER']
 */
function findTeams(text) {
  if (!text) return [];
  const hits = [];
  const used = new Set();
  for (const alias of ALIASES_BY_LENGTH) {
    const idx = text.indexOf(alias);
    if (idx === -1) continue;
    const code = ALIAS_TO_CODE[alias];
    if (used.has(code)) continue;
    used.add(code);
    hits.push({ code, idx });
  }
  hits.sort((a, b) => a.idx - b.idx);
  return hits.map((h) => h.code);
}

module.exports = { TEAMS, get, findTeams };
