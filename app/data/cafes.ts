/**
 * 목업용 예시 데이터.
 *
 * 04_착수_검증에 따라 카카오 로컬 API 결과를 저장·재배포하지 않기로 했으므로,
 * 화면의 카페는 전부 지어낸 것입니다. 실제 상호·좌표가 아닙니다.
 *
 * tier는 01_데이터와_파이프라인 §1을 따릅니다.
 *   1 = 확정(협력업체·수동 승격) · 3 = 기본(이름·주소·좌표·전화만)
 * T3에 hours/beans/intro가 없는 것은 누락이 아니라 결정서 §4.2의 결과입니다.
 */

export type Cafe = {
  id: string;
  name: string;
  romanized: string;
  area: string;
  address: string;
  tel: string;
  /**
   * [경도, 위도] — GeoJSON 순서 고정 (01_데이터와_파이프라인 §2.1).
   * 지어낸 카페이므로 해당 동네의 대략적인 좌표입니다.
   */
  pos: [number, number];
} & (
  | {
      tier: 1;
      partner: true;
      /** 협력업체가 직접 준 소개. 확정 정보. */
      intro: string;
      hours: string;
      beans: string;
    }
  | {
      tier: 3;
      partner: false;
      /**
       * 상호명·카테고리·주소에서 조립한 추정 서술 (결정서 §3 Q34).
       * 주관적 품질 판단은 절대 들어가지 않습니다.
       */
      guess: string;
    }
);

export const cafes: Cafe[] = [
  {
    id: "demo-yeonnam",
    name: "책방그늘",
    romanized: "BOOKSHOP GEUNEUL",
    area: "연남동",
    address: "서울 마포구 성미산로29길 12",
    tel: "02-336-0129",
    tier: 1,
    partner: true,
    intro: "연남동 골목 끝, 서가와 커피가 반씩 있는 곳.",
    hours: "10:00 – 21:00",
    beans: "에티오피아 예가체프",
    pos: [126.925, 37.563],
  },
  {
    id: "demo-seongsu",
    name: "느린파도",
    romanized: "SLOW WAVE",
    area: "성수동",
    address: "서울 성동구 연무장길 41",
    tel: "02-462-7741",
    tier: 1,
    partner: true,
    intro: "큰 창과 긴 테이블이 있는 성수동 로스터리.",
    hours: "11:00 – 22:00",
    beans: "비빈 하우스 블렌드",
    pos: [127.056, 37.5445],
  },
  {
    id: "demo-incheon",
    name: "항구의 오후",
    romanized: "HARBOR AFTERNOON",
    area: "인천 중구",
    address: "인천 중구 개항로 78",
    tel: "032-761-0078",
    tier: 1,
    partner: true,
    intro: "오래된 창고 골목에서 만나는 작은 커피 바.",
    hours: "12:00 – 20:00",
    beans: "콜롬비아 우일라",
    pos: [126.622, 37.474],
  },
  {
    id: "demo-suwon",
    name: "모서리 커피",
    romanized: "CORNER COFFEE",
    area: "수원 행궁동",
    address: "경기 수원시 팔달구 화서문로 29",
    tel: "031-247-2903",
    tier: 1,
    partner: true,
    intro: "행궁동 담장 곁에 놓인 한 잔짜리 쉼표.",
    hours: "09:30 – 19:30",
    beans: "과테말라 안티구아",
    pos: [127.011, 37.283],
  },
  {
    id: "demo-ilsan",
    name: "종이컵 연구소",
    romanized: "PAPER CUP LAB",
    area: "고양 일산",
    address: "경기 고양시 일산동구 산두로 16",
    tel: "031-905-1602",
    tier: 3,
    partner: false,
    guess: "일산동구의 로스터리 카페",
    pos: [126.77, 37.658],
  },
  {
    id: "demo-bundang",
    name: "커피와 문장",
    romanized: "COFFEE AND SENTENCES",
    area: "성남 분당",
    address: "경기 성남시 분당구 불정로 8",
    tel: "031-707-0808",
    tier: 3,
    partner: false,
    guess: "분당 골목의 북카페",
    pos: [127.108, 37.38],
  },
  {
    id: "demo-mangwon",
    name: "망원 미들",
    romanized: "MANGWON MIDDLE",
    area: "망원동",
    address: "서울 마포구 월드컵로13길 22",
    tel: "02-334-2210",
    tier: 3,
    partner: false,
    guess: "망원동 시장 곁의 카페",
    pos: [126.902, 37.556],
  },
  {
    id: "demo-anyang",
    name: "평화당",
    romanized: "PYEONGHWADANG",
    area: "안양 만안구",
    address: "경기 안양시 만안구 장내로 90",
    tel: "031-441-9002",
    tier: 3,
    partner: false,
    guess: "만안구 대로변의 카페",
    pos: [126.956, 37.39],
  },
  {
    id: "demo-euljiro",
    name: "활자와 원두",
    romanized: "TYPE AND BEANS",
    area: "서울 을지로",
    address: "서울 중구 을지로16길 14",
    tel: "02-2274-1614",
    tier: 1,
    partner: true,
    intro: "오래된 인쇄 골목의 결을 한 잔에 담는 작은 로스터리.",
    hours: "10:30 — 20:30",
    beans: "에티오피아 구지 내추럴",
    pos: [126.991, 37.566],
  },
  {
    id: "demo-paju",
    name: "느티나무 로스터스",
    romanized: "ZELKOVA ROASTERS",
    area: "파주 출판도시",
    address: "경기 파주시 회동길 82",
    tel: "031-955-8282",
    tier: 1,
    partner: true,
    intro: "책 냄새와 볶은 원두 향이 천천히 겹치는 출판도시의 작업실.",
    hours: "09:30 — 19:00",
    beans: "케냐 키암부 워시드",
    pos: [126.687, 37.708],
  },
  {
    id: "demo-bukchon",
    name: "기와 아래 커피",
    romanized: "COFFEE UNDER TILES",
    area: "서울 북촌",
    address: "서울 종로구 계동길 31",
    tel: "02-742-3131",
    tier: 3,
    partner: false,
    guess: "북촌 골목의 소형 커피 바",
    pos: [126.985, 37.582],
  },
  {
    id: "demo-yeongdeungpo",
    name: "철길 옆 한 잔",
    romanized: "A CUP BY THE RAIL",
    area: "서울 영등포",
    address: "서울 영등포구 도림로125길 9",
    tel: "02-2632-1259",
    tier: 3,
    partner: false,
    guess: "문래 철공소 골목의 카페",
    pos: [126.907, 37.516],
  },
  {
    id: "demo-songdo",
    name: "바람층",
    romanized: "WIND FLOOR",
    area: "인천 송도",
    address: "인천 연수구 컨벤시아대로 42",
    tel: "032-833-4242",
    tier: 3,
    partner: false,
    guess: "송도 수변 공원 근처의 카페",
    pos: [126.643, 37.389],
  },
  {
    id: "demo-guri",
    name: "천변 기록실",
    romanized: "RIVERSIDE ARCHIVE",
    area: "경기 구리",
    address: "경기 구리시 검배로6번길 18",
    tel: "031-554-0618",
    tier: 3,
    partner: false,
    guess: "구리 전통시장 근처의 기록형 카페",
    pos: [127.136, 37.594],
  },
  {
    id: "demo-gwangmyeong",
    name: "광명 다방연구소",
    romanized: "GWANGMYEONG COFFEE LAB",
    area: "경기 광명",
    address: "경기 광명시 오리로995번길 7",
    tel: "02-2688-9957",
    tier: 3,
    partner: false,
    guess: "광명사거리의 로스터리 카페",
    pos: [126.867, 37.478],
  },
  {
    id: "demo-yongin",
    name: "느린 필터",
    romanized: "SLOW FILTER",
    area: "경기 용인",
    address: "경기 용인시 수지구 풍덕천로 117",
    tel: "031-263-0117",
    tier: 3,
    partner: false,
    guess: "수지 골목의 핸드드립 카페",
    pos: [127.109, 37.321],
  },
  {
    id: "demo-gimpo",
    name: "강서쪽 커피",
    romanized: "WEST OF GANGSEO",
    area: "경기 김포",
    address: "경기 김포시 김포한강1로 63",
    tel: "031-988-1063",
    tier: 3,
    partner: false,
    guess: "한강신도시의 동네 카페",
    pos: [126.713, 37.624],
  },
  {
    id: "demo-hanam",
    name: "미사 문장점",
    romanized: "MISA SENTENCE",
    area: "경기 하남",
    address: "경기 하남시 미사강변중앙로 173",
    tel: "031-794-0173",
    tier: 3,
    partner: false,
    guess: "미사 호수공원 근처의 북카페",
    pos: [127.194, 37.566],
  },];

/** 협력업체 전체 목록 (03_기능_명세 §7). 지방 2곳은 지도에 없지만 목록에는 남습니다. */
export const partnerRegions = [
  { label: "서울", count: 52, onMap: true },
  { label: "경기", count: 14, onMap: true },
  { label: "인천", count: 3, onMap: true },
  { label: "그 외", count: 2, onMap: false, note: "충북 충주 · 경남 함안" },
];

export const partnerTotal = partnerRegions.reduce((sum, region) => sum + region.count, 0);
