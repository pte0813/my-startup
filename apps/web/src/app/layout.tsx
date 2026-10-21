import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { Suspense } from "react";
import { TabBarView } from "@/components/BottomTabs";
import { BottomTabs } from "@/components/BottomTabsClient";
import { Header } from "@/components/Header";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({ weight: ["400", "500", "700", "900"], subsets: ["latin"], display: "swap", variable: "--font-noto" });

export const metadata: Metadata = {
  title: { default: "몽몽", template: "%s · 몽몽" },
  description: "웨이팅 팁과 예약 요령까지, 직접 다녀온 사람이 검증하는 동네 맛집 큐레이션",
  applicationName: "몽몽",
  appleWebApp: { capable: true, title: "몽몽", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#101216" },
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
  ],
};

// 저장된 화면 밝기를 첫 화면이 그려지기 전에 적용해 깜빡임을 막는다.
const THEME_SCRIPT = `try{var t=localStorage.getItem("mongmong-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={notoSansKr.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="mx-auto max-w-[640px]">
          <Header />
          <main className="pt-5">{children}</main>
        </div>
        <ServiceWorkerRegister />
        <Suspense fallback={<TabBarView pathname={null} />}>
          <BottomTabs />
        </Suspense>
      </body>
    </html>
  );
}
