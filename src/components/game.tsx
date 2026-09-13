"use client";

// 共享游戏组件：星级、印章、打字机、四房间导航。

import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import { sfx } from "@/lib/game/sfx";
import { parseMiniMarkdown, type MdInline } from "@/lib/game/markdown";

/** 分步进度卡：elapsed 驱动的阶段推进（真实等待只有一个长请求，阶段按耗时推进） */
export function StepProgress({
  eyebrow,
  steps,
  elapsed,
  slowAt = 12,
  slowHint = "深度思考中，稍安勿躁",
}: {
  eyebrow: React.ReactNode;
  steps: Array<{ label: string; doneAt: number }>;
  elapsed: number;
  slowAt?: number;
  slowHint?: string;
}) {
  return (
    <section className="paper-card scanline p-5">
      <p className="eyebrow">
        <span className="status-dot" />
        {eyebrow}
      </p>
      <ul className="mt-4 space-y-2.5">
        {steps.map((step, i) => {
          const done = elapsed >= step.doneAt;
          const active = !done && (i === 0 || elapsed >= steps[i - 1].doneAt);
          return (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center border font-[family-name:var(--font-dossier)] text-[10px] ${
                  done
                    ? "border-signal-400 bg-signal-600/25 text-signal-300"
                    : active
                      ? "border-brass-400 text-brass-300"
                      : "border-ink-600 text-paper-600"
                }`}
              >
                {done ? "✓" : active ? "▶" : "·"}
              </span>
              <span className={done ? "text-paper-300" : active ? "text-paper-100" : "text-paper-600"}>
                {step.label}
                {active && <span className="ml-1 inline-block animate-pulse">……</span>}
              </span>
              {active && elapsed >= slowAt && (
                <span className="ml-auto font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-brass-300">
                  {slowHint}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-right font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
        已进行 {elapsed}s
      </p>
    </section>
  );
}

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

