/**
 * 정적 미리보기 진입점.
 *
 * 서버가 없는 자리(깃허브 페이지)에 같은 화면을 세우기 위한 것입니다. app/ 의
 * 코드를 그대로 가져다 쓰므로 여기에 화면 코드를 새로 쓰지 않습니다 — 여기서
 * 갈라지기 시작하면 미리보기는 곧 다른 물건이 됩니다.
 */
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import Home from "../app/page";

createRoot(document.getElementById("root")!).render(<Home />);
