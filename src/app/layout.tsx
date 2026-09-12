import type { Metadata } from "next";
import "./globals.css";
import { GameProvider } from "@/lib/game/store";
import { Nav } from "@/components/game";

export const metadata: Metadata = {
  title: "热搜疑云 · Trending Mystery",
  description:
    "每天，知乎热榜自动生成一个全新案件——搜查真实回答、审问 AI 当事人、对比社区共识结案。一款离开知乎生态就无法成立的叙事侦探游戏。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <GameProvider>
          <Nav />
          <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>
          <footer className="pb-8 text-center font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">
            热搜疑云 · 每日一案 · 由知乎热榜驱动
          </footer>
        </GameProvider>
      </body>
    </html>
  );
}
