"use client";

// 共享游戏组件：星级、印章、打字机、四房间导航。

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import { sfx } from "@/lib/game/sfx";
import { MuteButton } from "@/components/atmosphere";

export function Stars({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`font-[family-name:var(--font-dossier)] tracking-tight text-brass-300 ${className}`} title={`可信度 ${n}/5`}>
      {"★".repeat(n)}
      <span className="text-ink-600">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function Stamp({
  children,
  tone = "brass",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "brass" | "blood" | "dim";
  className?: string;
}) {
  const color =
    tone === "blood" ? "text-blood-400" : tone === "dim" ? "text-paper-600" : "text-brass-400";
  return <span className={`stamp ${color} ${className}`}>{children}</span>;
}

export function TypeWriter({
  text,
  speed = 26,
  className = "",
  sound = true,
}: {
  text: string;
  speed?: number;
  className?: string;
  sound?: boolean;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const timer = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(timer);
          return v;
        }
        if (sound && v % 2 === 0) sfx.play("type");
        return v + 1;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, sound]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="tw-cursor" aria-hidden />}
    </span>
  );
}

const ROOMS = [
  { href: "/", label: "Ⅰ 案件面板" },
  { href: "/search", label: "Ⅱ 搜查取证" },
  { href: "/interrogation", label: "Ⅲ 审问室" },
  { href: "/verdict", label: "Ⅳ 结案室" },
];

export function Nav() {
  const { caseBrief, profile } = useGame();
  return (
    <header className="sticky top-0 z-40 border-b border-signal-400/20 bg-ink-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 md:px-6">
        <Link href="/" className="group flex items-center gap-3 font-[family-name:var(--font-dossier)] text-sm tracking-[0.25em] text-paper-100">
          <span className="flex h-7 w-7 items-center justify-center border border-signal-400/60 text-signal-300 transition-transform group-hover:rotate-12">⌕</span>
          <span>热搜疑云 <small className="ml-1 text-[9px] tracking-[0.1em] text-signal-300">/ TM-01</small></span>
        </Link>
        {caseBrief && (
          <span className="border-l border-ink-600 pl-4 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
            <span className="status-dot" />LIVE / {caseBrief.caseId}
          </span>
        )}
        <nav className="ml-auto flex flex-wrap items-center gap-2">
          {ROOMS.map((room) => (
            <Link
              key={room.href}
              href={room.href}
              onClick={() => sfx.play("click")}
              className="border border-ink-600 px-2.5 py-1.5 font-[family-name:var(--font-dossier)] text-[10px] text-paper-400 transition-colors hover:border-signal-400 hover:text-signal-300"
            >
              {room.label}
            </Link>
          ))}
          <MuteButton />
          {profile ? (
            <span
              className="flex items-center gap-2 border border-brass-400/50 px-2 py-1"
              title={profile.headline}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brass-600 font-[family-name:var(--font-dossier)] text-[10px] text-ink-950">
                {profile.name[0]}
              </span>
              <span className="max-w-24 truncate font-[family-name:var(--font-dossier)] text-xs text-brass-300">
                {profile.name}
              </span>
            </span>
          ) : (
            <a
              href="/api/oauth/authorize"
              className="btn-brass px-2.5 py-1 font-[family-name:var(--font-dossier)] text-xs tracking-wider"
            >
              绑定知乎身份
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
