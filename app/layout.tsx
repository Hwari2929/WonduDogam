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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 첫 페인트 전에 테마를 확정합니다. 늦으면 밝은 종이가 한 번 번쩍입니다. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}