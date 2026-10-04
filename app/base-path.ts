/**
 * 사이트가 도메인 뿌리에 서 있는지, 어느 경로 아래에 서 있는지.
 *
 * 깃허브 프로젝트 페이지는 `/<저장소이름>/` 아래에 섭니다. 그 자리에서 `/mascot/…`
 * 처럼 앞에 빗금을 단 주소는 저장소를 건너뛰고 도메인 뿌리를 가리켜서, 파일이
 * 멀쩡히 올라가 있어도 404 가 됩니다.
 *
 * 기준은 문서의 <base> 태그 하나뿐입니다. 문서의 기준 주소를 그냥 읽으면 태그가
 * 없을 때 지금 보고 있는 주소 자체가 나오고, 그러면 /c/demo 에서 새로고침한
 * 순간 그게 통째로 기준이 되어 버립니다. 태그가 없으면 빈 문자열 — 뿌리에 선
 * 사이트와 서버 렌더에서는 지금까지와 완전히 같습니다.
 */
export const BASE_PATH = (() => {
  if (typeof document === "undefined") return "";
  const href = document.querySelector("base")?.getAttribute("href");
  if (!href) return "";
  return new URL(href, window.location.origin).pathname.replace(/\/+$/, "");
})();

/**
 * public/ 에 둔 파일을 가리키는 주소.
 *
 * 코드에 박아 둔 경로는 번들러가 손대지 않습니다 — CSS 의 url() 은 빌드가
 * 고쳐 주지만 JS 문자열은 그대로 나가므로, 여기를 거쳐야 어느 자리에 서든
 * 같은 파일을 가리킵니다.
 */
export function asset(path: string) {
  return `${BASE_PATH}${path}`;
}
