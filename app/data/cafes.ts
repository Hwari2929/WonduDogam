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
  { id: "demo-01", name: "깊은계단", romanized: "DEEP STAIRS", area: "연남동", address: "서울 마포구 한들로 85", tel: "02-908-8592", tier: 1, partner: true, intro: "골목 끝에 있는 연남동 로스터리.", hours: "12:00 – 19:00", beans: "비빈 하우스 블렌드", pos: [126.919, 37.5649] },
  { id: "demo-02", name: "깊은모퉁이", romanized: "DEEP CORNER", area: "망원동", address: "서울 마포구 서로 28", tel: "02-742-1769", tier: 3, partner: false, guess: "언덕 위 다방으로 추정됩니다.", pos: [126.8955, 37.5585] },
  { id: "demo-03", name: "여름 창고", romanized: "SUMMER DEPOT", area: "자양동", address: "서울 광진구 동편길 88", tel: "02-482-5762", tier: 3, partner: false, guess: "역에서 조금 걷는 다방으로 추정됩니다.", pos: [127.0662, 37.5383] },
  { id: "demo-04", name: "작은정원", romanized: "SMALL GARDEN", area: "서울 종로", address: "서울 종로구 중앙로 15", tel: "02-741-3418", tier: 3, partner: false, guess: "상가 이층의 다방으로 추정됩니다.", pos: [126.9939, 37.5696] },
  { id: "demo-05", name: "맑은언덕", romanized: "CLEAR HILL", area: "서울 북촌", address: "서울 종로구 너른들길 87", tel: "02-844-2354", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 다방으로 추정됩니다.", pos: [126.9786, 37.5814] },
  { id: "demo-06", name: "잔과 접시", romanized: "CUP AND SAUCER", area: "서울 연희동", address: "서울 서대문구 너른들길 48", tel: "02-634-8419", tier: 1, partner: true, intro: "오래된 건물 이층의 서울 연희동 북카페.", hours: "08:00 – 22:00", beans: "코스타리카 따라주", pos: [126.9299, 37.5662] },
  { id: "demo-07", name: "둥근그늘", romanized: "ROUND SHADE", area: "서울 후암동", address: "서울 용산구 서로 39", tel: "02-995-3088", tier: 3, partner: false, guess: "상가 이층의 카페로 추정됩니다.", pos: [126.9788, 37.5429] },
  { id: "demo-08", name: "고요한書房", romanized: "STILL STUDY", area: "서울 상수동", address: "서울 마포구 동편길 55", tel: "02-852-8946", tier: 3, partner: false, guess: "역에서 조금 걷는 로스터리로 추정됩니다.", pos: [126.9125, 37.5483] },
  { id: "demo-09", name: "낡은처마", romanized: "WORN EAVES", area: "서울 영등포", address: "서울 영등포구 윗마을길 79", tel: "02-697-8811", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 로스터리로 추정됩니다.", pos: [126.9009, 37.5172] },
  { id: "demo-10", name: "맑은바람", romanized: "CLEAR WIND", area: "서울 신사동", address: "서울 강남구 벚꽃로 32", tel: "02-538-5649", tier: 3, partner: false, guess: "언덕 위 카페로 추정됩니다.", pos: [127.0245, 37.5152] },
  { id: "demo-11", name: "기와 아래 커피", romanized: "UNDER THE TILES", area: "서울 삼각지", address: "서울 용산구 벚꽃로 11", tel: "02-773-6857", tier: 1, partner: true, intro: "혼자 앉기 좋은 서울 삼각지 다방.", hours: "11:30 – 22:00", beans: "콜롬비아 우일라", pos: [126.9646, 37.5287] },
  { id: "demo-12", name: "너른여백", romanized: "WIDE MARGIN", area: "서울 종로3가", address: "서울 종로구 동편길 39", tel: "02-448-8069", tier: 3, partner: false, guess: "상가 이층의 로스터리로 추정됩니다.", pos: [126.9845, 37.5698] },
  { id: "demo-13", name: "종이와 잉크", romanized: "PAPER AND INK", area: "서울 회기동", address: "서울 동대문구 윗마을길 46", tel: "02-648-8254", tier: 3, partner: false, guess: "골목 안쪽의 카페로 추정됩니다.", pos: [127.0587, 37.5944] },
  { id: "demo-14", name: "작은우물", romanized: "SMALL WELL", area: "서울 공덕동", address: "서울 마포구 백석로 66", tel: "02-789-4875", tier: 3, partner: false, guess: "언덕 위 북카페로 추정됩니다.", pos: [126.9418, 37.5389] },
  { id: "demo-15", name: "책방그늘", romanized: "BOOKSHOP GEUNEUL", area: "서울 서촌", address: "서울 종로구 백석로 67", tel: "02-740-7747", tier: 3, partner: false, guess: "상가 이층의 다방으로 추정됩니다.", pos: [126.9705, 37.5816] },
  { id: "demo-16", name: "모서리 커피", romanized: "CORNER COFFEE", area: "서울 방배동", address: "서울 서초구 가로수길 17", tel: "02-421-9491", tier: 1, partner: true, intro: "혼자 앉기 좋은 서울 방배동 북카페.", hours: "11:00 – 21:30", beans: "코스타리카 따라주", pos: [127.0053, 37.4739] },
  { id: "demo-17", name: "너른빈터", romanized: "WIDE CLEARING", area: "서울 잠원동", address: "서울 서초구 너른들길 9", tel: "02-399-3912", tier: 3, partner: false, guess: "상가 이층의 로스터리로 추정됩니다.", pos: [127.0011, 37.5174] },
  { id: "demo-18", name: "항구의 오후", romanized: "HARBOR AFTERNOON", area: "서울 목동", address: "서울 양천구 동편길 11", tel: "02-923-3337", tier: 3, partner: false, guess: "역에서 조금 걷는 로스터리로 추정됩니다.", pos: [126.8651, 37.5247] },
  { id: "demo-19", name: "깊은우물", romanized: "DEEP WELL", area: "서울 상도동", address: "서울 동작구 벚꽃로 84", tel: "02-648-4159", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 북카페로 추정됩니다.", pos: [126.9501, 37.4931] },
  { id: "demo-20", name: "조용한골목", romanized: "QUIET ALLEY", area: "서울 성북동", address: "서울 성북구 동편길 30", tel: "02-429-2496", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 다방으로 추정됩니다.", pos: [127.0033, 37.591] },
  { id: "demo-21", name: "흐린처마", romanized: "CLOUDY EAVES", area: "인천 중구", address: "인천 중구 가로수길 64", tel: "032-984-9550", tier: 1, partner: true, intro: "서가와 커피가 반씩 있는 인천 중구 커피집.", hours: "10:00 – 19:00", beans: "코스타리카 따라주", pos: [126.6155, 37.4711] },
  { id: "demo-22", name: "작은빈터", romanized: "SMALL CLEARING", area: "인천 송도", address: "인천 연수구 너른들길 13", tel: "032-769-9930", tier: 3, partner: false, guess: "상가 이층의 다방으로 추정됩니다.", pos: [126.6604, 37.3777] },
  { id: "demo-23", name: "묵은그늘", romanized: "AGED SHADE", area: "인천 부평", address: "인천 부평구 가로수길 56", tel: "032-461-4037", tier: 3, partner: false, guess: "언덕 위 다방으로 추정됩니다.", pos: [126.7193, 37.4983] },
  { id: "demo-24", name: "낡은그늘", romanized: "WORN SHADE", area: "수원 행궁동", address: "경기 수원시 팔달구 윗마을길 31", tel: "031-588-3949", tier: 3, partner: false, guess: "역에서 조금 걷는 카페로 추정됩니다.", pos: [127.0083, 37.2755] },
  { id: "demo-25", name: "흐린계단", romanized: "CLOUDY STAIRS", area: "성남 분당", address: "경기 성남시 분당구 벚꽃로 15", tel: "031-701-6246", tier: 3, partner: false, guess: "골목 안쪽의 다방으로 추정됩니다.", pos: [127.1233, 37.3789] },
  { id: "demo-26", name: "느린빈터", romanized: "SLOW CLEARING", area: "고양 일산", address: "경기 고양시 일산동구 윗마을길 80", tel: "031-910-9806", tier: 1, partner: true, intro: "골목 끝에 있는 고양 일산 로스터리.", hours: "11:00 – 21:00", beans: "에티오피아 예가체프 · 인도네시아 만델링", pos: [126.7729, 37.655] },
  { id: "demo-27", name: "고요한모퉁이", romanized: "STILL CORNER", area: "안양 만안구", address: "경기 안양시 만안구 가로수길 84", tel: "031-622-1446", tier: 3, partner: false, guess: "시장 옆 로스터리로 추정됩니다.", pos: [126.9269, 37.3841] },
  { id: "demo-28", name: "작은물결", romanized: "SMALL RIPPLE", area: "파주 출판도시", address: "경기 파주시 동편길 12", tel: "031-467-7199", tier: 3, partner: false, guess: "역에서 조금 걷는 로스터리로 추정됩니다.", pos: [126.6978, 37.7154] },
  { id: "demo-29", name: "조용한바람", romanized: "QUIET WIND", area: "경기 구리", address: "경기 구리시 너른들길 12", tel: "031-961-2389", tier: 3, partner: false, guess: "시장 옆 다방으로 추정됩니다.", pos: [127.1409, 37.599] },
  { id: "demo-30", name: "조용한정원", romanized: "QUIET GARDEN", area: "경기 광명", address: "경기 광명시 백석로 59", tel: "031-465-1991", tier: 3, partner: false, guess: "시장 옆 커피집으로 추정됩니다.", pos: [126.8721, 37.4742] },
  { id: "demo-31", name: "네 시의 방", romanized: "FOUR PM ROOM", area: "경기 용인", address: "경기 용인시 기흥구 동편길 43", tel: "031-446-3646", tier: 1, partner: true, intro: "긴 테이블 하나뿐인 경기 용인 북카페.", hours: "11:00 – 21:30", beans: "브라질 세하도", pos: [127.0996, 37.3217] },
  { id: "demo-32", name: "밝은안뜰", romanized: "BRIGHT COURT", area: "인천 불로동", address: "인천 서구 동편길 57", tel: "032-792-1464", tier: 3, partner: false, guess: "주택가에 있는 북카페로 추정됩니다.", pos: [126.7061, 37.6099] },
  { id: "demo-33", name: "손과 잔", romanized: "HAND AND CUP", area: "경기 하남", address: "경기 하남시 너른들길 4", tel: "031-864-2921", tier: 3, partner: false, guess: "시장 옆 다방으로 추정됩니다.", pos: [127.2096, 37.532] },
  { id: "demo-34", name: "가는빈터", romanized: "THIN CLEARING", area: "경기 시흥", address: "경기 시흥시 동편길 6", tel: "031-913-4494", tier: 3, partner: false, guess: "골목 안쪽의 북카페로 추정됩니다.", pos: [126.8013, 37.3765] },
  { id: "demo-35", name: "밑줄 커피", romanized: "UNDERLINE COFFEE", area: "경기 의정부", address: "경기 의정부시 중앙로 2", tel: "031-487-1444", tier: 3, partner: false, guess: "공원 건너편 다방으로 추정됩니다.", pos: [127.0433, 37.7459] },
  { id: "demo-36", name: "조용한계단", romanized: "QUIET STAIRS", area: "경기 남양주", address: "경기 남양주시 한들로 47", tel: "031-986-5539", tier: 1, partner: true, intro: "낮에만 여는 경기 남양주 북카페.", hours: "10:00 – 22:00", beans: "비빈 하우스 블렌드", pos: [127.2193, 37.6386] },
  { id: "demo-37", name: "월요일 오후", romanized: "MONDAY PM", area: "경기 부천", address: "경기 부천시 너른들길 69", tel: "031-744-2047", tier: 3, partner: false, guess: "역에서 조금 걷는 커피집으로 추정됩니다.", pos: [126.7634, 37.5082] },
  { id: "demo-38", name: "고요한바람", romanized: "STILL WIND", area: "경기 안산", address: "경기 안산시 단원구 중앙로 9", tel: "031-480-7737", tier: 3, partner: false, guess: "시장 옆 커피집으로 추정됩니다.", pos: [126.8169, 37.3147] },
  { id: "demo-39", name: "너른언덕", romanized: "WIDE HILL", area: "경기 평택", address: "경기 평택시 백석로 4", tel: "031-695-7532", tier: 3, partner: false, guess: "시장 옆 로스터리로 추정됩니다.", pos: [127.1095, 37.0807] },
  { id: "demo-40", name: "흐린여백", romanized: "CLOUDY MARGIN", area: "경기 광주", address: "경기 광주시 가로수길 76", tel: "031-440-3671", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 로스터리로 추정됩니다.", pos: [127.2611, 37.432] },
  { id: "demo-41", name: "고요한창고", romanized: "STILL DEPOT", area: "연남동", address: "서울 마포구 너른들길 38", tel: "02-406-8320", tier: 1, partner: true, intro: "오래된 건물 이층의 연남동 북카페.", hours: "10:00 – 19:00", beans: "르완다 부르봉", pos: [126.924, 37.5657] },
  { id: "demo-42", name: "느린바람", romanized: "SLOW WIND", area: "망원동", address: "서울 마포구 한들로 59", tel: "02-901-4990", tier: 3, partner: false, guess: "공원 건너편 다방으로 추정됩니다.", pos: [126.9021, 37.558] },
  { id: "demo-43", name: "작은여백", romanized: "SMALL MARGIN", area: "성수동", address: "서울 성동구 벚꽃로 23", tel: "02-901-6656", tier: 3, partner: false, guess: "주택가에 있는 다방으로 추정됩니다.", pos: [127.0453, 37.5447] },
  { id: "demo-44", name: "흐린바람", romanized: "CLOUDY WIND", area: "서울 종로5가", address: "서울 종로구 벚꽃로 47", tel: "02-996-7185", tier: 3, partner: false, guess: "시장 옆 커피집으로 추정됩니다.", pos: [127.001, 37.5729] },
  { id: "demo-45", name: "낡은다락", romanized: "WORN ATTIC", area: "서울 북촌", address: "서울 종로구 가로수길 56", tel: "02-633-6043", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 로스터리로 추정됩니다.", pos: [126.975, 37.5747] },
  { id: "demo-46", name: "북쪽 창", romanized: "NORTH WINDOW", area: "서울 연희동", address: "서울 서대문구 솔밭길 20", tel: "02-325-3155", tier: 1, partner: true, intro: "오래된 건물 이층의 서울 연희동 커피집.", hours: "08:00 – 22:00", beans: "콜롬비아 우일라 · 엘살바도르 파카마라", pos: [126.938, 37.5655] },
  { id: "demo-47", name: "활자와 원두", romanized: "TYPE AND BEAN", area: "서울 후암동", address: "서울 용산구 백석로 7", tel: "02-706-7272", tier: 3, partner: false, guess: "역에서 조금 걷는 로스터리로 추정됩니다.", pos: [126.987, 37.5424] },
  { id: "demo-48", name: "남쪽 골목", romanized: "SOUTH ALLEY", area: "서울 상수동", address: "서울 마포구 솔밭길 77", tel: "02-808-9363", tier: 3, partner: false, guess: "시장 옆 커피집으로 추정됩니다.", pos: [126.9219, 37.5428] },
  { id: "demo-49", name: "밝은창고", romanized: "BRIGHT DEPOT", area: "서울 영등포", address: "서울 영등포구 백석로 65", tel: "02-711-2195", tier: 3, partner: false, guess: "공원 건너편 커피집으로 추정됩니다.", pos: [126.8973, 37.5207] },
  { id: "demo-50", name: "가는여백", romanized: "THIN MARGIN", area: "서울 신사동", address: "서울 강남구 윗마을길 54", tel: "02-586-2634", tier: 3, partner: false, guess: "언덕 위 카페로 추정됩니다.", pos: [127.0224, 37.5189] },
  { id: "demo-51", name: "오래된창고", romanized: "OLD DEPOT", area: "서울 삼각지", address: "서울 용산구 너른들길 57", tel: "02-973-6624", tier: 1, partner: true, intro: "낮에만 여는 서울 삼각지 로스터리.", hours: "11:30 – 18:00", beans: "과테말라 안티구아", pos: [126.9764, 37.5398] },
  { id: "demo-52", name: "오래된바람", romanized: "OLD WIND", area: "서울 을지로3가", address: "서울 중구 중앙로 4", tel: "02-916-2333", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 북카페로 추정됩니다.", pos: [126.9856, 37.5609] },
  { id: "demo-53", name: "조용한마당", romanized: "QUIET YARD", area: "서울 회기동", address: "서울 동대문구 서로 34", tel: "02-880-2000", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 카페로 추정됩니다.", pos: [127.052, 37.5971] },
  { id: "demo-54", name: "밝은계단", romanized: "BRIGHT STAIRS", area: "서울 공덕동", address: "서울 마포구 너른들길 72", tel: "02-859-4447", tier: 3, partner: false, guess: "상가 이층의 로스터리로 추정됩니다.", pos: [126.9573, 37.5461] },
  { id: "demo-55", name: "겨울 서재", romanized: "WINTER STUDY", area: "서울 서촌", address: "서울 종로구 벚꽃로 34", tel: "02-908-6723", tier: 3, partner: false, guess: "상가 이층의 다방으로 추정됩니다.", pos: [126.9623, 37.5712] },
  { id: "demo-56", name: "오래된골목", romanized: "OLD ALLEY", area: "서울 방배동", address: "서울 서초구 가로수길 88", tel: "02-787-2390", tier: 1, partner: true, intro: "골목 끝에 있는 서울 방배동 북카페.", hours: "11:30 – 21:00", beans: "르완다 부르봉 · 콜롬비아 우일라", pos: [126.9871, 37.4887] },
  { id: "demo-57", name: "오래된파도", romanized: "OLD WAVE", area: "서울 잠원동", address: "서울 서초구 서로 55", tel: "02-861-4537", tier: 3, partner: false, guess: "언덕 위 다방으로 추정됩니다.", pos: [127.011, 37.5134] },
  { id: "demo-58", name: "낡은여백", romanized: "WORN MARGIN", area: "서울 목동", address: "서울 양천구 서로 23", tel: "02-594-3589", tier: 3, partner: false, guess: "언덕 위 북카페로 추정됩니다.", pos: [126.8757, 37.5334] },
  { id: "demo-59", name: "낡은언덕", romanized: "WORN HILL", area: "서울 상도동", address: "서울 동작구 가로수길 47", tel: "02-462-5224", tier: 3, partner: false, guess: "언덕 위 커피집으로 추정됩니다.", pos: [126.9398, 37.4963] },
  { id: "demo-60", name: "둥근마당", romanized: "ROUND YARD", area: "서울 성북동", address: "서울 성북구 솔밭길 30", tel: "02-715-4029", tier: 3, partner: false, guess: "시장 옆 커피집으로 추정됩니다.", pos: [126.9941, 37.5953] },
  { id: "demo-61", name: "흐린우물", romanized: "CLOUDY WELL", area: "인천 중구", address: "인천 중구 가로수길 72", tel: "032-633-4704", tier: 1, partner: true, intro: "안뜰이 있는 인천 중구 로스터리.", hours: "09:30 – 19:00", beans: "브라질 세하도 · 코스타리카 따라주", pos: [126.6092, 37.4688] },
  { id: "demo-62", name: "가는書房", romanized: "THIN STUDY", area: "인천 송도", address: "인천 연수구 서로 45", tel: "032-660-4082", tier: 3, partner: false, guess: "골목 안쪽의 커피집으로 추정됩니다.", pos: [126.651, 37.3903] },
  { id: "demo-63", name: "얕은안뜰", romanized: "SHALLOW COURT", area: "인천 부평", address: "인천 부평구 서로 15", tel: "032-622-4686", tier: 3, partner: false, guess: "공원 건너편 커피집으로 추정됩니다.", pos: [126.729, 37.4973] },
  { id: "demo-64", name: "고요한처마", romanized: "STILL EAVES", area: "수원 행궁동", address: "경기 수원시 팔달구 한들로 52", tel: "031-753-6621", tier: 3, partner: false, guess: "언덕 위 카페로 추정됩니다.", pos: [127.0197, 37.2789] },
  { id: "demo-65", name: "흐린물결", romanized: "CLOUDY RIPPLE", area: "성남 분당", address: "경기 성남시 분당구 가로수길 51", tel: "031-497-4707", tier: 3, partner: false, guess: "주택가에 있는 카페로 추정됩니다.", pos: [127.1223, 37.376] },
  { id: "demo-66", name: "느린물결", romanized: "SLOW RIPPLE", area: "고양 일산", address: "경기 고양시 일산동구 솔밭길 37", tel: "031-929-1791", tier: 1, partner: true, intro: "혼자 앉기 좋은 고양 일산 북카페.", hours: "11:00 – 21:30", beans: "비빈 하우스 블렌드", pos: [126.7735, 37.6622] },
  { id: "demo-67", name: "묵은정원", romanized: "AGED GARDEN", area: "안양 만안구", address: "경기 안양시 만안구 윗마을길 50", tel: "031-900-6700", tier: 3, partner: false, guess: "골목 안쪽의 로스터리로 추정됩니다.", pos: [126.9308, 37.384] },
  { id: "demo-68", name: "흐린마당", romanized: "CLOUDY YARD", area: "김포 하성", address: "경기 김포시 한들로 33", tel: "031-450-2027", tier: 3, partner: false, guess: "주택가에 있는 카페로 추정됩니다.", pos: [126.6844, 37.7183] },
  { id: "demo-69", name: "고요한정원", romanized: "STILL GARDEN", area: "경기 구리", address: "경기 구리시 동편길 5", tel: "031-845-4801", tier: 3, partner: false, guess: "주택가에 있는 다방으로 추정됩니다.", pos: [127.1456, 37.5944] },
  { id: "demo-70", name: "작은처마", romanized: "SMALL EAVES", area: "서울 개봉동", address: "서울 구로구 너른들길 18", tel: "02-692-1862", tier: 3, partner: false, guess: "상가 이층의 다방으로 추정됩니다.", pos: [126.8546, 37.4842] },
  { id: "demo-71", name: "밝은물결", romanized: "BRIGHT RIPPLE", area: "경기 용인", address: "경기 용인시 수지구 중앙로 43", tel: "031-527-2557", tier: 1, partner: true, intro: "오래된 건물 이층의 경기 용인 커피집.", hours: "12:00 – 18:00", beans: "에티오피아 예가체프", pos: [127.1065, 37.3287] },
  { id: "demo-72", name: "종이컵 연구소", romanized: "PAPER CUP LAB", area: "경기 김포", address: "경기 김포시 서로 41", tel: "031-564-8581", tier: 3, partner: false, guess: "언덕 위 로스터리로 추정됩니다.", pos: [126.7155, 37.6186] },
  { id: "demo-73", name: "가는계단", romanized: "THIN STAIRS", area: "경기 하남", address: "경기 하남시 한들로 29", tel: "031-759-8054", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 다방으로 추정됩니다.", pos: [127.1992, 37.5355] },
  { id: "demo-74", name: "너른바람", romanized: "WIDE WIND", area: "경기 시흥", address: "경기 시흥시 솔밭길 3", tel: "031-687-5037", tier: 3, partner: false, guess: "역에서 조금 걷는 로스터리로 추정됩니다.", pos: [126.7932, 37.3874] },
  { id: "demo-75", name: "얕은계단", romanized: "SHALLOW STAIRS", area: "경기 의정부", address: "경기 의정부시 중앙로 70", tel: "031-378-4532", tier: 3, partner: false, guess: "주택가에 있는 북카페로 추정됩니다.", pos: [127.0472, 37.7314] },
  { id: "demo-76", name: "밝은언덕", romanized: "BRIGHT HILL", area: "경기 남양주", address: "경기 남양주시 백석로 3", tel: "031-683-5376", tier: 1, partner: true, intro: "오래된 건물 이층의 경기 남양주 카페.", hours: "09:30 – 23:00", beans: "비빈 하우스 블렌드 · 케냐 AA", pos: [127.2201, 37.6385] },
  { id: "demo-77", name: "맑은물결", romanized: "CLEAR RIPPLE", area: "경기 부천", address: "경기 부천시 윗마을길 62", tel: "031-666-7951", tier: 3, partner: false, guess: "상가 이층의 북카페로 추정됩니다.", pos: [126.7684, 37.4982] },
  { id: "demo-78", name: "조용한안뜰", romanized: "QUIET COURT", area: "경기 안산", address: "경기 안산시 단원구 서로 65", tel: "031-785-2937", tier: 3, partner: false, guess: "공원 건너편 커피집으로 추정됩니다.", pos: [126.8183, 37.3278] },
  { id: "demo-79", name: "작은파도", romanized: "SMALL WAVE", area: "경기 평택", address: "경기 평택시 윗마을길 16", tel: "031-636-4167", tier: 3, partner: false, guess: "언덕 위 북카페로 추정됩니다.", pos: [127.1233, 37.0801] },
  { id: "demo-80", name: "맑은書房", romanized: "CLEAR STUDY", area: "경기 광주", address: "경기 광주시 한들로 9", tel: "031-422-5227", tier: 3, partner: false, guess: "골목 안쪽의 북카페로 추정됩니다.", pos: [127.2614, 37.4247] },
  { id: "demo-81", name: "무른창고", romanized: "SOFT DEPOT", area: "서울 중랑", address: "서울 중랑구 동편길 57", tel: "02-690-6143", tier: 3, partner: false, guess: "학교 앞 카페로 추정됩니다.", pos: [127.0923, 37.6007] },
  { id: "demo-82", name: "너른창고", romanized: "WIDE DEPOT", area: "서울 강북", address: "서울 강북구 한들로 38", tel: "02-826-4239", tier: 3, partner: false, guess: "공원 건너편 북카페로 추정됩니다.", pos: [127.0139, 37.6453] },
  { id: "demo-83", name: "늦은낮달", romanized: "LATE DAY MOON", area: "서울 도봉", address: "서울 도봉구 벚꽃로 13", tel: "02-864-5406", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 다방으로 추정됩니다.", pos: [127.0287, 37.6695] },
  { id: "demo-84", name: "조용한여백", romanized: "QUIET MARGIN", area: "서울 노원", address: "서울 노원구 솔밭길 63", tel: "02-525-3979", tier: 3, partner: false, guess: "골목 안쪽의 커피집으로 추정됩니다.", pos: [127.0687, 37.6548] },
  { id: "demo-85", name: "고요한돌담", romanized: "STILL STONE WALL", area: "서울 은평", address: "서울 은평구 가로수길 63", tel: "02-333-1454", tier: 1, partner: true, intro: "시장 옆 서울 은평 커피집.", hours: "11:30 – 22:00", beans: "코스타리카 따라주", pos: [126.9337, 37.6222] },
  { id: "demo-86", name: "낡은돌담", romanized: "WORN STONE WALL", area: "서울 강서", address: "서울 강서구 돌담길 57", tel: "02-978-7383", tier: 3, partner: false, guess: "역에서 조금 걷는 커피집으로 추정됩니다.", pos: [126.8255, 37.5618] },
  { id: "demo-87", name: "둥근여백", romanized: "ROUND MARGIN", area: "서울 금천", address: "서울 금천구 물레방아길 62", tel: "02-412-7908", tier: 3, partner: false, guess: "상가 이층의 카페로 추정됩니다.", pos: [126.8979, 37.4603] },
  { id: "demo-88", name: "조용한초저녁", romanized: "QUIET DUSK", area: "서울 관악", address: "서울 관악구 백석로 10", tel: "02-892-8679", tier: 3, partner: false, guess: "상가 이층의 커피집으로 추정됩니다.", pos: [126.9466, 37.4649] },
  { id: "demo-89", name: "잔잔한계단", romanized: "CALM STAIRS", area: "서울 송파", address: "서울 송파구 윗마을길 90", tel: "02-871-7842", tier: 3, partner: false, guess: "골목 안쪽의 카페로 추정됩니다.", pos: [127.1142, 37.5021] },
  { id: "demo-90", name: "옅은안뜰", romanized: "FAINT COURT", area: "서울 강동", address: "서울 강동구 벚꽃로 3", tel: "02-915-7997", tier: 1, partner: true, intro: "큰길에서 한 블록 들어간 서울 강동 커피집.", hours: "09:30 – 23:00", beans: "케냐 AA", pos: [127.1498, 37.5518] },
  { id: "demo-91", name: "깊은빗물", romanized: "DEEP RAINDROP", area: "경기 수원", address: "경기 수원시 장안구 동편길 9", tel: "031-458-7143", tier: 3, partner: false, guess: "골목 안쪽의 다방으로 추정됩니다.", pos: [127.0027, 37.3172] },
  { id: "demo-92", name: "무른낮달", romanized: "SOFT DAY MOON", area: "경기 수원", address: "경기 수원시 권선구 너른들길 48", tel: "031-430-5515", tier: 3, partner: false, guess: "학교 앞 커피집으로 추정됩니다.", pos: [126.9705, 37.2621] },
  { id: "demo-93", name: "옅은처마", romanized: "FAINT EAVES", area: "경기 수원", address: "경기 수원시 영통구 물레방아길 38", tel: "031-773-6691", tier: 3, partner: false, guess: "천변에 있는 다방으로 추정됩니다.", pos: [127.0562, 37.2746] },
  { id: "demo-94", name: "서늘한창고", romanized: "COOL DEPOT", area: "경기 성남", address: "경기 성남시 수정구 벚꽃로 58", tel: "031-650-6079", tier: 3, partner: false, guess: "주택가에 있는 북카페로 추정됩니다.", pos: [127.0959, 37.4350] },
  { id: "demo-95", name: "따뜻한돌담", romanized: "WARM STONE WALL", area: "경기 성남", address: "경기 성남시 중원구 중앙로 61", tel: "031-716-5156", tier: 1, partner: true, intro: "상가 이층의 경기 성남 커피집.", hours: "11:00 – 21:30", beans: "비빈 하우스 블렌드", pos: [127.1615, 37.4367] },
  { id: "demo-96", name: "밝은모퉁이", romanized: "BRIGHT CORNER", area: "경기 안양", address: "경기 안양시 동안구 벚꽃로 86", tel: "031-678-9516", tier: 3, partner: false, guess: "언덕 위 로스터리로 추정됩니다.", pos: [126.9643, 37.4017] },
  { id: "demo-97", name: "늦은창고", romanized: "LATE DEPOT", area: "경기 동두천", address: "경기 동두천시 중앙로 86", tel: "031-714-1567", tier: 3, partner: false, guess: "학교 앞 카페로 추정됩니다.", pos: [127.0738, 37.9181] },
  { id: "demo-98", name: "이른골목", romanized: "EARLY ALLEY", area: "경기 안산", address: "경기 안산시 상록구 윗마을길 4", tel: "031-987-1836", tier: 3, partner: false, guess: "주택가에 있는 커피집으로 추정됩니다.", pos: [126.8638, 37.3138] },
  { id: "demo-99", name: "얕은노을", romanized: "SHALLOW AFTERGLOW", area: "경기 고양", address: "경기 고양시 덕양구 서로 13", tel: "031-573-5987", tier: 3, partner: false, guess: "역에서 조금 걷는 커피집으로 추정됩니다.", pos: [126.8755, 37.6553] },
  { id: "demo-100", name: "서늘한물결", romanized: "COOL RIPPLE", area: "경기 고양", address: "경기 고양시 일산서구 벚꽃로 81", tel: "031-499-9729", tier: 1, partner: true, intro: "학교 앞 경기 고양 로스터리.", hours: "11:30 – 22:00", beans: "브라질 세하도 · 콜롬비아 우일라", pos: [126.7203, 37.6783] },
  { id: "demo-101", name: "무른담장", romanized: "SOFT WALL", area: "경기 과천", address: "경기 과천시 벚꽃로 75", tel: "031-528-9526", tier: 3, partner: false, guess: "역에서 조금 걷는 북카페로 추정됩니다.", pos: [126.9995, 37.4339] },
  { id: "demo-102", name: "흐린창고", romanized: "HAZY DEPOT", area: "경기 오산", address: "경기 오산시 너른들길 78", tel: "031-545-4453", tier: 3, partner: false, guess: "언덕 위 커피집으로 추정됩니다.", pos: [127.0570, 37.1606] },
  { id: "demo-103", name: "따뜻한마당", romanized: "WARM YARD", area: "경기 군포", address: "경기 군포시 백석로 55", tel: "031-747-3185", tier: 3, partner: false, guess: "시장 옆 커피집으로 추정됩니다.", pos: [126.9217, 37.3439] },
  { id: "demo-104", name: "따뜻한골목", romanized: "WARM ALLEY", area: "경기 의왕", address: "경기 의왕시 백석로 6", tel: "031-953-3460", tier: 3, partner: false, guess: "공원 건너편 로스터리로 추정됩니다.", pos: [126.9823, 37.3624] },
  { id: "demo-105", name: "따뜻한여백", romanized: "WARM MARGIN", area: "경기 용인", address: "경기 용인시 처인구 동편길 15", tel: "031-371-7728", tier: 1, partner: true, intro: "공원 건너편 경기 용인 카페.", hours: "10:00 – 20:00", beans: "케냐 AA", pos: [127.2539, 37.2034] },
  { id: "demo-106", name: "흐린돌담", romanized: "HAZY STONE WALL", area: "경기 이천", address: "경기 이천시 너른들길 48", tel: "031-300-8369", tier: 3, partner: false, guess: "주택가에 있는 카페로 추정됩니다.", pos: [127.4840, 37.2080] },
  { id: "demo-107", name: "서늘한우물", romanized: "COOL WELL", area: "경기 안성", address: "경기 안성시 백석로 78", tel: "031-733-1331", tier: 3, partner: false, guess: "공원 건너편 로스터리로 추정됩니다.", pos: [127.3051, 37.0347] },
  { id: "demo-108", name: "잔잔한골목", romanized: "CALM ALLEY", area: "경기 화성", address: "경기 화성시 가로수길 7", tel: "031-981-4233", tier: 3, partner: false, guess: "공원 건너편 커피집으로 추정됩니다.", pos: [126.8746, 37.1678] },
  { id: "demo-109", name: "무른빗물", romanized: "SOFT RAINDROP", area: "경기 양주", address: "경기 양주시 중앙로 48", tel: "031-983-8436", tier: 3, partner: false, guess: "역에서 조금 걷는 다방으로 추정됩니다.", pos: [127.0027, 37.8093] },
  { id: "demo-110", name: "흐린담장", romanized: "HAZY WALL", area: "경기 포천", address: "경기 포천시 벚꽃로 26", tel: "031-971-3209", tier: 1, partner: true, intro: "역에서 조금 걷는 경기 포천 로스터리.", hours: "11:30 – 22:00", beans: "엘살바도르 파카마라", pos: [127.2372, 37.9179] },
  { id: "demo-111", name: "너른돌담", romanized: "WIDE STONE WALL", area: "경기 여주", address: "경기 여주시 동편길 15", tel: "031-937-9768", tier: 3, partner: false, guess: "골목 안쪽의 다방으로 추정됩니다.", pos: [127.6150, 37.3027] },
  { id: "demo-112", name: "이른처마", romanized: "EARLY EAVES", area: "경기 연천", address: "경기 연천군 백석로 33", tel: "031-893-5521", tier: 3, partner: false, guess: "역에서 조금 걷는 커피집으로 추정됩니다.", pos: [126.9781, 38.0142] },
  { id: "demo-113", name: "흐린새벽", romanized: "HAZY DAYBREAK", area: "경기 가평", address: "경기 가평군 백석로 68", tel: "031-668-2791", tier: 3, partner: false, guess: "천변에 있는 커피집으로 추정됩니다.", pos: [127.4483, 37.8191] },
  { id: "demo-114", name: "따뜻한언덕", romanized: "WARM HILL", area: "경기 양평", address: "경기 양평군 백석로 85", tel: "031-915-3513", tier: 3, partner: false, guess: "상가 이층의 로스터리로 추정됩니다.", pos: [127.5763, 37.5191] },
  { id: "demo-115", name: "늦은모퉁이", romanized: "LATE CORNER", area: "인천 동", address: "인천 동구 돌담길 8", tel: "032-578-7130", tier: 1, partner: true, intro: "언덕 위 인천 동 북카페.", hours: "11:00 – 21:30", beans: "과테말라 안티구아", pos: [126.6461, 37.4811] },
  { id: "demo-116", name: "얕은처마", romanized: "SHALLOW EAVES", area: "인천 미추홀", address: "인천 미추홀구 서로 20", tel: "032-574-3834", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 커피집으로 추정됩니다.", pos: [126.6622, 37.4504] },
  { id: "demo-117", name: "맑은우물", romanized: "CLEAR WELL", area: "인천 남동", address: "인천 남동구 중앙로 84", tel: "032-862-6349", tier: 3, partner: false, guess: "학교 앞 카페로 추정됩니다.", pos: [126.7216, 37.4332] },
  { id: "demo-118", name: "곧은바람", romanized: "STRAIGHT WIND", area: "인천 계양", address: "인천 계양구 한들로 72", tel: "032-426-4686", tier: 3, partner: false, guess: "언덕 위 로스터리로 추정됩니다.", pos: [126.7335, 37.5571] },
  { id: "demo-119", name: "이른새벽", romanized: "EARLY DAYBREAK", area: "인천 강화", address: "인천 강화군 백석로 62", tel: "032-798-4904", tier: 3, partner: false, guess: "역에서 조금 걷는 커피집으로 추정됩니다.", pos: [126.4524, 37.7035] },
  { id: "demo-120", name: "밝은지붕", romanized: "BRIGHT ROOF", area: "인천 옹진", address: "인천 옹진군 백석로 81", tel: "032-716-9320", tier: 1, partner: true, intro: "골목 안쪽의 인천 옹진 카페.", hours: "12:00 – 19:00", beans: "엘살바도르 파카마라", pos: [126.4668, 37.2576] },
  { id: "demo-121", name: "옅은새벽", romanized: "FAINT DAYBREAK", area: "서울 중", address: "서울 중구 한들로 94", tel: "02-435-8046", tier: 3, partner: false, guess: "시장 옆 카페로 추정됩니다.", pos: [126.9923, 37.5572] },
  { id: "demo-122", name: "조용한언덕", romanized: "QUIET HILL", area: "서울 성동", address: "서울 성동구 중앙로 89", tel: "02-537-6588", tier: 3, partner: false, guess: "학교 앞 북카페로 추정됩니다.", pos: [127.0451, 37.5526] },
  { id: "demo-123", name: "작은계단", romanized: "SMALL STAIRS", area: "서울 광진", address: "서울 광진구 물레방아길 33", tel: "02-322-1503", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 다방으로 추정됩니다.", pos: [127.0807, 37.5465] },
  { id: "demo-124", name: "따뜻한물결", romanized: "WARM RIPPLE", area: "서울 구로", address: "서울 구로구 돌담길 1", tel: "02-791-1999", tier: 3, partner: false, guess: "공원 건너편 카페로 추정됩니다.", pos: [126.8614, 37.4925] },
  { id: "demo-125", name: "낡은새벽", romanized: "WORN DAYBREAK", area: "경기 광명", address: "경기 광명시 돌담길 32", tel: "031-358-5978", tier: 1, partner: true, intro: "학교 앞 경기 광명 커피집.", hours: "09:30 – 23:00", beans: "브라질 세하도 · 콜롬비아 우일라", pos: [126.8630, 37.4477] },
  { id: "demo-126", name: "이른마당", romanized: "EARLY YARD", area: "경기 용인", address: "경기 용인시 기흥구 윗마을길 13", tel: "031-959-9016", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 카페로 추정됩니다.", pos: [127.1211, 37.2706] },
  { id: "demo-127", name: "늦은여백", romanized: "LATE MARGIN", area: "경기 용인", address: "경기 용인시 수지구 가로수길 75", tel: "031-341-3253", tier: 3, partner: false, guess: "언덕 위 다방으로 추정됩니다.", pos: [127.0715, 37.3348] },
  { id: "demo-128", name: "성긴물결", romanized: "SPARSE RIPPLE", area: "경기 파주", address: "경기 파주시 물레방아길 29", tel: "031-426-2465", tier: 3, partner: false, guess: "천변에 있는 북카페로 추정됩니다.", pos: [126.8094, 37.8526] },
  { id: "demo-129", name: "낡은초저녁", romanized: "WORN DUSK", area: "인천 서", address: "인천 서구 윗마을길 92", tel: "032-469-6221", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 카페로 추정됩니다.", pos: [126.6481, 37.5573] },
  { id: "demo-130", name: "서늘한바람", romanized: "COOL WIND", area: "서울 강동", address: "서울 강동구 벚꽃로 48", tel: "02-313-7872", tier: 1, partner: true, intro: "시장 옆 서울 강동 카페.", hours: "09:30 – 23:00", beans: "콜롬비아 우일라", pos: [127.1453, 37.5507] },
  { id: "demo-131", name: "깊은바람", romanized: "DEEP WIND", area: "경기 수원", address: "경기 수원시 장안구 돌담길 33", tel: "031-935-5258", tier: 3, partner: false, guess: "공원 건너편 카페로 추정됩니다.", pos: [127.0014, 37.3119] },
  { id: "demo-132", name: "무른모퉁이", romanized: "SOFT CORNER", area: "경기 수원", address: "경기 수원시 권선구 동편길 63", tel: "031-884-3939", tier: 3, partner: false, guess: "골목 안쪽의 북카페로 추정됩니다.", pos: [126.9788, 37.2613] },
  { id: "demo-133", name: "서늘한골목", romanized: "COOL ALLEY", area: "경기 수원", address: "경기 수원시 영통구 동편길 63", tel: "031-420-5142", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 카페로 추정됩니다.", pos: [127.0582, 37.2754] },
  { id: "demo-134", name: "이른우물", romanized: "EARLY WELL", area: "경기 성남", address: "경기 성남시 수정구 가로수길 14", tel: "031-912-7546", tier: 3, partner: false, guess: "주택가에 있는 북카페로 추정됩니다.", pos: [127.1057, 37.4356] },
  { id: "demo-135", name: "잔잔한물결", romanized: "CALM RIPPLE", area: "경기 성남", address: "경기 성남시 중원구 한들로 13", tel: "031-640-5166", tier: 1, partner: true, intro: "역에서 조금 걷는 경기 성남 북카페.", hours: "11:30 – 22:00", beans: "과테말라 안티구아", pos: [127.1641, 37.4340] },
  { id: "demo-136", name: "얕은담장", romanized: "SHALLOW WALL", area: "경기 안양", address: "경기 안양시 동안구 돌담길 60", tel: "031-577-8967", tier: 3, partner: false, guess: "언덕 위 카페로 추정됩니다.", pos: [126.9588, 37.4011] },
  { id: "demo-137", name: "무른새벽", romanized: "SOFT DAYBREAK", area: "경기 동두천", address: "경기 동두천시 너른들길 17", tel: "031-919-3653", tier: 3, partner: false, guess: "학교 앞 북카페로 추정됩니다.", pos: [127.0769, 37.9164] },
  { id: "demo-138", name: "곧은낮달", romanized: "STRAIGHT DAY MOON", area: "경기 안산", address: "경기 안산시 상록구 물레방아길 30", tel: "031-840-6385", tier: 3, partner: false, guess: "공원 건너편 로스터리로 추정됩니다.", pos: [126.8681, 37.3168] },
  { id: "demo-139", name: "맑은노을", romanized: "CLEAR AFTERGLOW", area: "경기 고양", address: "경기 고양시 덕양구 백석로 28", tel: "031-867-7564", tier: 3, partner: false, guess: "학교 앞 로스터리로 추정됩니다.", pos: [126.8866, 37.6557] },
  { id: "demo-140", name: "서늘한언덕", romanized: "COOL HILL", area: "경기 고양", address: "경기 고양시 일산서구 물레방아길 77", tel: "031-485-3908", tier: 1, partner: true, intro: "천변에 있는 경기 고양 북카페.", hours: "11:30 – 22:00", beans: "비빈 하우스 블렌드 · 케냐 AA", pos: [126.7277, 37.6785] },
  { id: "demo-141", name: "따뜻한안뜰", romanized: "WARM COURT", area: "경기 과천", address: "경기 과천시 서로 24", tel: "031-537-5303", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 카페로 추정됩니다.", pos: [127.0049, 37.4327] },
  { id: "demo-142", name: "둥근지붕", romanized: "ROUND ROOF", area: "경기 오산", address: "경기 오산시 한들로 25", tel: "031-838-5486", tier: 3, partner: false, guess: "공원 건너편 로스터리로 추정됩니다.", pos: [127.0548, 37.1604] },
  { id: "demo-143", name: "너른낮달", romanized: "WIDE DAY MOON", area: "경기 군포", address: "경기 군포시 백석로 31", tel: "031-380-6284", tier: 3, partner: false, guess: "주택가에 있는 북카페로 추정됩니다.", pos: [126.9181, 37.3445] },
  { id: "demo-144", name: "옅은물결", romanized: "FAINT RIPPLE", area: "경기 의왕", address: "경기 의왕시 돌담길 40", tel: "031-626-9740", tier: 3, partner: false, guess: "공원 건너편 로스터리로 추정됩니다.", pos: [126.9884, 37.3633] },
  { id: "demo-145", name: "조용한툇마루", romanized: "QUIET PORCH", area: "경기 용인", address: "경기 용인시 처인구 중앙로 5", tel: "031-411-8679", tier: 1, partner: true, intro: "큰길에서 한 블록 들어간 경기 용인 다방.", hours: "08:00 – 22:00", beans: "비빈 하우스 블렌드", pos: [127.2512, 37.2009] },
  { id: "demo-146", name: "옅은툇마루", romanized: "FAINT PORCH", area: "경기 이천", address: "경기 이천시 백석로 65", tel: "031-392-8146", tier: 3, partner: false, guess: "역에서 조금 걷는 북카페로 추정됩니다.", pos: [127.4899, 37.2103] },
  { id: "demo-147", name: "가는빗물", romanized: "THIN RAINDROP", area: "경기 안성", address: "경기 안성시 가로수길 12", tel: "031-405-9935", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 로스터리로 추정됩니다.", pos: [127.3081, 37.0346] },
  { id: "demo-148", name: "얕은지붕", romanized: "SHALLOW ROOF", area: "경기 화성", address: "경기 화성시 솔밭길 37", tel: "031-452-7522", tier: 3, partner: false, guess: "골목 안쪽의 카페로 추정됩니다.", pos: [126.8765, 37.1693] },
  { id: "demo-149", name: "맑은담장", romanized: "CLEAR WALL", area: "경기 양주", address: "경기 양주시 한들로 27", tel: "031-480-1826", tier: 3, partner: false, guess: "상가 이층의 카페로 추정됩니다.", pos: [126.9979, 37.8106] },
  { id: "demo-150", name: "밝은초저녁", romanized: "BRIGHT DUSK", area: "경기 포천", address: "경기 포천시 물레방아길 6", tel: "031-786-7111", tier: 1, partner: true, intro: "큰길에서 한 블록 들어간 경기 포천 카페.", hours: "09:00 – 21:00", beans: "코스타리카 따라주", pos: [127.2331, 37.9185] },
  { id: "demo-151", name: "잔잔한초저녁", romanized: "CALM DUSK", area: "경기 여주", address: "경기 여주시 벚꽃로 23", tel: "031-834-1150", tier: 3, partner: false, guess: "언덕 위 다방으로 추정됩니다.", pos: [127.6172, 37.3001] },
  { id: "demo-152", name: "얕은모퉁이", romanized: "SHALLOW CORNER", area: "경기 연천", address: "경기 연천군 한들로 51", tel: "031-946-8242", tier: 3, partner: false, guess: "상가 이층의 카페로 추정됩니다.", pos: [126.9860, 38.0153] },
  { id: "demo-153", name: "낡은노을", romanized: "WORN AFTERGLOW", area: "경기 가평", address: "경기 가평군 돌담길 29", tel: "031-363-4228", tier: 3, partner: false, guess: "공원 건너편 로스터리로 추정됩니다.", pos: [127.4452, 37.8160] },
  { id: "demo-154", name: "얕은창고", romanized: "SHALLOW DEPOT", area: "경기 양평", address: "경기 양평군 한들로 55", tel: "031-906-7811", tier: 3, partner: false, guess: "천변에 있는 다방으로 추정됩니다.", pos: [127.5719, 37.5187] },
  { id: "demo-155", name: "가는그늘", romanized: "THIN SHADE", area: "인천 동", address: "인천 동구 벚꽃로 78", tel: "032-634-4631", tier: 1, partner: true, intro: "천변에 있는 인천 동 커피집.", hours: "10:00 – 20:00", beans: "케냐 AA", pos: [126.6362, 37.4814] },
  { id: "demo-156", name: "얕은초저녁", romanized: "SHALLOW DUSK", area: "인천 미추홀", address: "인천 미추홀구 돌담길 93", tel: "032-385-6357", tier: 3, partner: false, guess: "시장 옆 다방으로 추정됩니다.", pos: [126.6703, 37.4539] },
  { id: "demo-157", name: "가는처마", romanized: "THIN EAVES", area: "인천 남동", address: "인천 남동구 한들로 14", tel: "032-872-2510", tier: 3, partner: false, guess: "골목 안쪽의 북카페로 추정됩니다.", pos: [126.7255, 37.4279] },
  { id: "demo-158", name: "밝은빗물", romanized: "BRIGHT RAINDROP", area: "인천 계양", address: "인천 계양구 너른들길 22", tel: "032-596-2854", tier: 3, partner: false, guess: "역에서 조금 걷는 북카페로 추정됩니다.", pos: [126.7375, 37.5575] },
  { id: "demo-159", name: "가는안뜰", romanized: "THIN COURT", area: "인천 강화", address: "인천 강화군 돌담길 74", tel: "032-518-7663", tier: 3, partner: false, guess: "골목 안쪽의 로스터리로 추정됩니다.", pos: [126.4424, 37.7059] },
  { id: "demo-160", name: "묵은여백", romanized: "AGED MARGIN", area: "인천 옹진", address: "인천 옹진군 윗마을길 77", tel: "032-863-5113", tier: 1, partner: true, intro: "시장 옆 인천 옹진 로스터리.", hours: "08:00 – 22:00", beans: "브라질 세하도 · 콜롬비아 우일라", pos: [126.4633, 37.2575] },
  { id: "demo-161", name: "고요한계단", romanized: "STILL STAIRS", area: "서울 중랑", address: "서울 중랑구 서로 36", tel: "02-623-6146", tier: 3, partner: false, guess: "시장 옆 로스터리로 추정됩니다.", pos: [127.0896, 37.5970] },
  { id: "demo-162", name: "깊은초저녁", romanized: "DEEP DUSK", area: "서울 강북", address: "서울 강북구 한들로 35", tel: "02-533-1633", tier: 3, partner: false, guess: "상가 이층의 다방으로 추정됩니다.", pos: [127.0103, 37.6438] },
  { id: "demo-163", name: "곧은담장", romanized: "STRAIGHT WALL", area: "서울 도봉", address: "서울 도봉구 물레방아길 8", tel: "02-837-5025", tier: 3, partner: false, guess: "큰길에서 한 블록 들어간 다방으로 추정됩니다.", pos: [127.0243, 37.6676] },
  { id: "demo-164", name: "옅은노을", romanized: "FAINT AFTERGLOW", area: "서울 노원", address: "서울 노원구 동편길 61", tel: "02-640-5980", tier: 3, partner: false, guess: "골목 안쪽의 다방으로 추정됩니다.", pos: [127.0720, 37.6529] },
  { id: "demo-165", name: "흐린낮달", romanized: "HAZY DAY MOON", area: "서울 은평", address: "서울 은평구 물레방아길 15", tel: "02-860-1945", tier: 1, partner: true, intro: "공원 건너편 서울 은평 북카페.", hours: "09:00 – 21:00", beans: "과테말라 안티구아", pos: [126.9230, 37.6222] },
  { id: "demo-166", name: "얕은빗물", romanized: "SHALLOW RAINDROP", area: "서울 강서", address: "서울 강서구 물레방아길 28", tel: "02-922-6985", tier: 3, partner: false, guess: "천변에 있는 북카페로 추정됩니다.", pos: [126.8258, 37.5588] },
  { id: "demo-167", name: "곧은안뜰", romanized: "STRAIGHT COURT", area: "서울 금천", address: "서울 금천구 서로 19", tel: "02-540-9071", tier: 3, partner: false, guess: "역에서 조금 걷는 북카페로 추정됩니다.", pos: [126.9031, 37.4593] },
  { id: "demo-168", name: "낡은바람", romanized: "WORN WIND", area: "서울 관악", address: "서울 관악구 벚꽃로 43", tel: "02-584-3442", tier: 3, partner: false, guess: "언덕 위 커피집으로 추정됩니다.", pos: [126.9404, 37.4685] },
  { id: "demo-169", name: "잔잔한마당", romanized: "CALM YARD", area: "서울 송파", address: "서울 송파구 솔밭길 48", tel: "02-792-1084", tier: 3, partner: false, guess: "역에서 조금 걷는 로스터리로 추정됩니다.", pos: [127.1144, 37.5057] },
  { id: "demo-170", name: "곧은빗물", romanized: "STRAIGHT RAINDROP", area: "서울 강동", address: "서울 강동구 가로수길 45", tel: "02-631-9900", tier: 1, partner: true, intro: "학교 앞 서울 강동 커피집.", hours: "08:00 – 22:00", beans: "브라질 세하도 · 콜롬비아 우일라", pos: [127.1510, 37.5486] },
  { id: "demo-171", name: "옅은빗물", romanized: "FAINT RAINDROP", area: "경기 수원", address: "경기 수원시 장안구 중앙로 93", tel: "031-738-7360", tier: 3, partner: false, guess: "시장 옆 다방으로 추정됩니다.", pos: [126.9992, 37.3121] },
  { id: "demo-172", name: "둥근툇마루", romanized: "ROUND PORCH", area: "경기 수원", address: "경기 수원시 권선구 너른들길 42", tel: "031-916-9086", tier: 3, partner: false, guess: "시장 옆 로스터리로 추정됩니다.", pos: [126.9725, 37.2632] },
  { id: "demo-173", name: "고요한새벽", romanized: "STILL DAYBREAK", area: "경기 수원", address: "경기 수원시 영통구 벚꽃로 14", tel: "031-765-9195", tier: 3, partner: false, guess: "학교 앞 다방으로 추정됩니다.", pos: [127.0501, 37.2744] },
  { id: "demo-174", name: "흐린지붕", romanized: "HAZY ROOF", area: "경기 성남", address: "경기 성남시 수정구 윗마을길 43", tel: "031-551-2889", tier: 3, partner: false, guess: "주택가에 있는 커피집으로 추정됩니다.", pos: [127.1083, 37.4346] },
  { id: "demo-175", name: "맑은툇마루", romanized: "CLEAR PORCH", area: "경기 성남", address: "경기 성남시 중원구 백석로 90", tel: "031-828-8027", tier: 1, partner: true, intro: "역에서 조금 걷는 경기 성남 다방.", hours: "10:00 – 20:00", beans: "케냐 AA", pos: [127.1709, 37.4313] },
  { id: "demo-176", name: "너른노을", romanized: "WIDE AFTERGLOW", area: "경기 안양", address: "경기 안양시 동안구 가로수길 53", tel: "031-832-5850", tier: 3, partner: false, guess: "학교 앞 커피집으로 추정됩니다.", pos: [126.9576, 37.4012] },
  { id: "demo-177", name: "맑은모퉁이", romanized: "CLEAR CORNER", area: "경기 동두천", address: "경기 동두천시 중앙로 70", tel: "031-553-6938", tier: 3, partner: false, guess: "언덕 위 북카페로 추정됩니다.", pos: [127.0785, 37.9173] },
  { id: "demo-178", name: "이른노을", romanized: "EARLY AFTERGLOW", area: "경기 안산", address: "경기 안산시 상록구 벚꽃로 22", tel: "031-318-9725", tier: 3, partner: false, guess: "시장 옆 북카페로 추정됩니다.", pos: [126.8687, 37.3159] },
  { id: "demo-179", name: "따뜻한빗물", romanized: "WARM RAINDROP", area: "경기 고양", address: "경기 고양시 덕양구 물레방아길 66", tel: "031-825-9022", tier: 3, partner: false, guess: "골목 안쪽의 카페로 추정됩니다.", pos: [126.8711, 37.6566] },
  { id: "demo-180", name: "가는창고", romanized: "THIN DEPOT", area: "경기 고양", address: "경기 고양시 일산서구 동편길 11", tel: "031-850-3481", tier: 1, partner: true, intro: "천변에 있는 경기 고양 카페.", hours: "11:00 – 21:30", beans: "케냐 AA", pos: [126.7262, 37.6793] },
];

/**
 * 서랍의 지역별 집계. 손으로 적어 두면 목록이 늘어날 때마다 어긋나므로 세어 씁니다.
 */
export const partnerRegions = (() => {
  const order = ["서울", "경기", "인천"];
  const counts = new Map(order.map((label) => [label, 0]));
  for (const cafe of cafes) {
    if (!cafe.partner) continue;
    const label = order.find((entry) => cafe.address.startsWith(entry)) ?? "서울";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return order.map((label) => ({ label, count: counts.get(label) ?? 0, onMap: true }));
})();

export const partnerTotal = partnerRegions.reduce((sum, region) => sum + region.count, 0);
