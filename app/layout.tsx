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
    // 파비콘은 16px에서도 읽혀야 해서 기하 마크를, 홈 화면 아이콘은 180px라
    // 일러스트 비빈을 씁니다.
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    },
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
  // 비빈 디자인 시스템 v0.1 §01 의 page 값. 다크 기본값은 Warm Dark 입니다.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFE7DB" },
    { media: "(prefers-color-scheme: dark)", color: "#221A13" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 첫 페인트 전에 테마를 확정합니다. 늦으면 밝은 종이가 한 번 번쩍입니다. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* 본문 활자. Paperlogy·MonoplexKR 은 globals.css 의 @font-face 가 맡습니다.
            셋 다 swap 이라 CDN이 늦어도 폴백 스택으로 먼저 읽힙니다. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}