"use client";

// 共享游戏组件：星级、印章、打字机、四房间导航。

import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import { sfx } from "@/lib/game/sfx";
import { parseMiniMarkdown, type MdInline } from "@/lib/game/markdown";

/** 迷你 Markdown 渲染：书记官报告的标题/加粗/列表/分隔线，档案纸风格 */
function MiniMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseMiniMarkdown(text).map((block, i) => {
        if (block.type === "hr") return <div key={i} className="my-2 border-t border-ink-700" />;
        const inline = block.inlines.map((seg: MdInline, j) =>
          seg.bold ? (
            <strong key={j} className="font-bold text-paper-100">
              {seg.text}
            </strong>
          ) : (
            <span key={j}>{seg.text}</span>
          ),
        );
        if (block.type === "h1")
          return (
            <p key={i} className="mb-1 mt-2 text-sm font-bold tracking-[0.2em] text-brass-300">
              {inline}
            </p>
          );
        if (block.type === "h2")
          return (
            <p key={i} className="mb-1 mt-2 border-b border-brass-600/30 pb-0.5 text-xs font-bold tracking-widest text-brass-400">
              {inline}
            </p>
          );
        if (block.type === "h3")
          return (
            <p key={i} className="mt-1.5 text-xs font-bold text-paper-200">
              {inline}
            </p>
          );
        if (block.type === "li")
          return (
            <p key={i} className="ml-3 text-xs leading-relaxed text-paper-300">
              <span className="text-brass-400">· </span>
              {inline}
            </p>
          );
        return (
          <p key={i} className="text-xs leading-relaxed text-paper-300">
            {inline}
          </p>
        );
      })}
    </>
  );
}

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
  markdown = false,
}: {
  text: string;
  speed?: number;
  className?: string;
  sound?: boolean;
  /** 迷你 Markdown 渲染（标题/加粗/列表），打字过程中逐帧重解析 */
  markdown?: boolean;
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
  if (markdown) {
    return (
      <div className={className}>
        <MiniMarkdown text={text.slice(0, n)} />
        {n < text.length && <span className="tw-cursor" aria-hidden />}
      </div>
    );
  }
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="tw-cursor" aria-hidden />}
    </span>
  );
}

