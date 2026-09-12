import type { Metadata } from "next";
import "./globals.css";
import { GameProvider } from "@/lib/game/store";
import { DustCanvas } from "@/components/atmosphere";

export const metadata: Metadata = {
  title: "热搜疑云 · Trending Mystery",
  description:
    "每天，知乎热榜自动生成一个全新案件——搜查真实回答、审问 AI 当事人、对比社区共识结案。一款离开知乎生态就无法成立的叙事侦探游戏。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <DustCanvas />
        <GameProvider>
          <main className="relative z-10">{children}</main>
        </GameProvider>
      </body>
    </html>
  );
}
