import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/lib/auth";

// 自托管字体（构建时打包，国内无需访问 Google Fonts）
import "@fontsource/noto-serif-sc/400.css";
import "@fontsource/noto-serif-sc/500.css";
import "@fontsource/noto-serif-sc/600.css";
import "@fontsource/noto-serif-sc/700.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/ma-shan-zheng/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/400-italic.css";

import "./globals.css";
import "./skins.css";

export const metadata: Metadata = {
  title: "Mind365",
  description: "Mind365 个人成长追踪系统",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mind365",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ece8df", // 与默认主题（灰泥）一致
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 首屏前同步应用主题，防止暗色模式闪白（与 src/lib/theme.ts 逻辑一致） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;var p=localStorage.getItem("mind365-theme")||"plaster";var d=p==="dark"||p==="patina"||(p!=="light"&&p!=="plaster"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d){r.setAttribute("data-theme","dark");}if(p==="plaster"||p==="patina"){r.setAttribute("data-skin",p);}}catch(e){}})();`,
          }}
        />
        {/* PWA Icons */}
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon-192.svg" />

        {/* iOS Splash Screens — solid color fallback */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

      </head>
      <body className="antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
