/**
 * /c/{place_id} — 카페 한 곳이 열린 상태 (03_기능_명세 §1).
 *
 * 별도 화면이 아니라 같은 단일 페이지입니다. 이 파일이 있는 이유는 오직
 * **새로고침과 공유 링크가 살아 있어야** 하기 때문입니다. 어떤 카드를 펼칠지는
 * app/page.tsx 가 location.pathname 을 읽어 정합니다.
 */
export { default } from "../../page";
