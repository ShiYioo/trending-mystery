"use client";

// 共享游戏组件：星级、印章、打字机、四房间导航。

import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import { sfx } from "@/lib/game/sfx";

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

