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
];

/** 협력업체 전체 목록 (03_기능_명세 §7). 지방 2곳은 지도에 없지만 목록에는 남습니다. */
export const partnerRegions = [
  { label: "서울", count: 52, onMap: true },
  { label: "경기", count: 14, onMap: true },
  { label: "인천", count: 3, onMap: true },
  { label: "그 외", count: 2, onMap: false, note: "충북 충주 · 경남 함안" },
];

export const partnerTotal = partnerRegions.reduce((sum, region) => sum + region.count, 0);
