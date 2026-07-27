import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { themeBootScript } from "./theme";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "원두도감 — 수도권 개인 카페 지도",
    description: "영수증 한 장이 카페 한 곳이고, 모으면 도감이 됩니다.",
    openGraph: {
      title: "원두도감",
      description: "영수증 한 장이 카페 한 곳이고, 모으면 도감이 됩니다.",
      type: "website",
      locale: "ko_KR",
      images: [{ url: `${origin}/og.png`, width: 1707, height: 907, alt: "원두도감 — 영수증으로 모으는 수도권 개인 카페 지도" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "원두도감",
      description: "영수증 한 장이 카페 한 곳이고, 모으면 도감이 됩니다.",
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#DCD3C2" },
    { media: "(prefers-color-scheme: dark)", color: "#100E0A" },
  ],
};

/**
 * 카카오 앱키는 서버에서 읽습니다. 번들러마다 다른 `NEXT_PUBLIC_*` 인라이닝에
 * 기대지 않고 <meta> 로 넘겨야 개발·Workers 양쪽에서 같은 방식으로 동작합니다.
 */
function readKakaoMapKey(): string | null {
  const key = process.env.KAKAO_MAP_KEY ?? process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  return key?.trim() ? key.trim() : null;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const kakaoMapKey = readKakaoMapKey();

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 첫 페인트 전에 테마를 확정합니다. 늦으면 밝은 종이가 한 번 번쩍입니다. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* 카카오 자바스크립트 앱키. 도메인으로 제한되는 공개 키라 문서에 실려도
            되지만, 없으면 태그 자체를 내보내지 않아 종이 지도로 돌아갑니다. */}
        {kakaoMapKey ? <meta name="kakao-map-key" content={kakaoMapKey} /> : null}
      </head>
      <body>{children}</body>
    </html>
  );
}