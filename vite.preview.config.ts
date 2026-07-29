import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * 정적 미리보기 빌드 전용. 앱의 실제 빌드는 vite.config.ts(vinext)가 맡습니다.
 *
 * 깃허브 프로젝트 페이지는 `/<저장소이름>/` 아래에 서므로 base 를 밖에서 받습니다.
 * index.html 의 <base href="%BASE_URL%"> 와 app/page.tsx 의 BASE_PATH 가 이 값
 * 하나를 같이 보기 때문에, 저장소 이름이 바뀌어도 고칠 곳은 워크플로 한 줄입니다.
 */
export default defineConfig({
  root: "preview",
  base: process.env.PREVIEW_BASE || "/",
  publicDir: "../public",
  build: { outDir: "../dist-preview", emptyOutDir: true },
  plugins: [react()],
});
