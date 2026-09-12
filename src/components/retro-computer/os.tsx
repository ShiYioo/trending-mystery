"use client";

// TM-01 操作系统：桌面（图标）+ 窗口管理（拖拽/聚焦/最小化/关闭）+ 顶栏（时钟/身份）+ 任务栏。
// 四个房间 + 神探榜全部以"软件"形态住在屏幕里——零路由跳转。

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MuteButton } from "@/components/atmosphere";
import { sfx } from "@/lib/game/sfx";
import { useGame } from "@/lib/game/store";
import BoardApp from "@/apps/board-app";
import CaseApp from "@/apps/case-app";
import InterrogationApp from "@/apps/interrogation-app";
import SearchApp from "@/apps/search-app";
import VerdictApp from "@/apps/verdict-app";
import type { AppId, OpenOptions } from "@/apps/types";

interface AppMeta {
  title: string;
  glyph: string;
  w: number;
  h: number;
  accent: string;
}

const APP_META: Record<AppId, AppMeta> = {
  case: { title: "案卷档案", glyph: "▤", w: 760, h: 580, accent: "text-brass-300" },
  search: { title: "档案检索", glyph: "⌕", w: 860, h: 600, accent: "text-signal-300" },
  interrogation: { title: "审问终端", glyph: "◑", w: 700, h: 590, accent: "text-blood-400" },
  verdict: { title: "结案程序", glyph: "⚖", w: 780, h: 620, accent: "text-brass-300" },
  board: { title: "今日神探榜", glyph: "№", w: 400, h: 420, accent: "text-signal-300" },
};

const ICONS: Array<{ id: AppId; label: string; no: string }> = [
  { id: "case", label: "案卷档案", no: "01" },
  { id: "search", label: "档案检索", no: "02" },
  { id: "interrogation", label: "审问终端", no: "03" },
  { id: "verdict", label: "结案程序", no: "04" },
  { id: "board", label: "神探榜", no: "05" },
];

interface WinState {
  id: AppId;
  uid: number; // 窗口实例号：关闭后重开是新实例，AnimatePresence 用 key 区分，避免与退场动画撞车
  z: number;
  min: boolean;
  x: number;
  y: number;
}

let uidSeq = 0;

/** 窗口必须完整落在桌面内——关闭/最小化键永远可点（宽度按实际渲染值 min(meta.w, 桌面-24)） */
function clampInto(w: WinState, rect: DOMRect): WinState {
  const meta = APP_META[w.id];
  const winW = Math.min(meta.w, rect.width - 24);
  const winH = Math.min(meta.h, rect.height);
  return {
    ...w,
    x: Math.min(Math.max(w.x, 0), Math.max(0, rect.width - winW - 8)),
    y: Math.min(Math.max(w.y, 0), Math.max(0, rect.height - winH - 8)),
  };
}

export function RetroOS() {
  const { caseBrief, profile } = useGame();
  const [windows, setWindows] = useState<WinState[]>([]);
  const zRef = useRef(10);
  const desktopRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: AppId; offX: number; offY: number; rect: DOMRect } | null>(null);
  const [searchSeed, setSearchSeed] = useState<{ keyword: string; nonce: number } | undefined>();
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const open = useCallback((app: AppId, opts?: OpenOptions) => {
    if (opts?.keyword) setSearchSeed({ keyword: opts.keyword, nonce: Date.now() });
    const z = ++zRef.current;
    setWindows((ws) => {
      const existing = ws.find((w) => w.id === app);
      if (existing) {
        return ws.map((w) => (w.id === app ? { ...w, z, min: false } : w));
      }
      const rect = desktopRef.current?.getBoundingClientRect();
      const meta = APP_META[app];
      const idx = ws.length;
      const placed: WinState = {
        id: app,
        uid: ++uidSeq,
        z,
        min: false,
        x: 96 + idx * 34,
        y: 10 + idx * 28,
      };
      return [...ws, rect ? clampInto(placed, rect) : placed];
    });
    sfx.play("flip");
  }, []);

  // 浏览器窗口尺寸变化时把所有窗口拉回桌面内
  useEffect(() => {
    const onResize = () => {
      const rect = desktopRef.current?.getBoundingClientRect();
      if (!rect) return;
      setWindows((ws) => ws.map((w) => clampInto(w, rect)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 开机后自动打开案卷档案
  useEffect(() => {
    const t = setTimeout(() => open("case"), 350);
    return () => clearTimeout(t);
  }, [open]);

  const focus = (id: AppId) => {
    const z = ++zRef.current;
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z } : w)));
  };
  const minimize = (id: AppId) => {
    sfx.play("click");
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, min: !w.min } : w)));
  };
  const close = (id: AppId) => {
    sfx.play("click");
    setWindows((ws) => ws.filter((w) => w.id !== id));
  };

  const onTitlePointerDown = (e: React.PointerEvent, w: WinState) => {
    // 最小化/关闭按钮：放行点击，不拖拽不捕获——否则 setPointerCapture 会吞掉按钮的第一次 click
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = desktopRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: w.id, offX: e.clientX - rect.left - w.x, offY: e.clientY - rect.top - w.y, rect };
    focus(w.id);
  };
  const onTitlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = e.clientX - drag.rect.left - drag.offX;
    const y = e.clientY - drag.rect.top - drag.offY;
    setWindows((ws) =>
      ws.map((w) => (w.id === drag.id ? clampInto({ ...w, x, y }, drag.rect) : w)),
    );
  };
  const onTitlePointerUp = () => {
    dragRef.current = null;
  };

  const renderApp = (id: AppId) => {
    const props = { open };
    switch (id) {
      case "case":
        return <CaseApp {...props} />;
      case "search":
        return <SearchApp {...props} seed={searchSeed} />;
      case "interrogation":
        return <InterrogationApp {...props} />;
      case "verdict":
        return <VerdictApp {...props} />;
      case "board":
        return <BoardApp />;
    }
  };

  return (
    <div className="crt-signal flex h-full w-full flex-col bg-ink-950 font-[family-name:var(--font-dossier)]">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 border-b border-signal-400/20 bg-ink-900/90 px-3 py-1.5">
        <span className="text-[11px] tracking-[0.28em] text-brass-300">TM-01</span>
        <span className="text-[10px] tracking-widest text-paper-600">夜班侦探终端</span>
        {caseBrief && (
          <span className="hidden text-[10px] tracking-widest text-paper-600 sm:inline">
            案件 {caseBrief.caseId}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {profile ? (
            <span className="flex items-center gap-1.5 border border-brass-400/50 px-2 py-0.5 text-[10px] text-brass-300">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brass-600 text-[8px] text-ink-950">
                {profile.name[0]}
              </span>
              <span className="max-w-20 truncate">{profile.name}</span>
            </span>
          ) : (
            <a
              href="/api/oauth/authorize"
              className="border border-brass-400/50 px-2 py-0.5 text-[10px] tracking-wider text-brass-300 hover:bg-brass-600/20"
            >
              绑定知乎身份
            </a>
          )}
          <MuteButton />
          <span className="text-[10px] tracking-widest text-signal-300">{clock}</span>
        </div>
      </div>

      {/* 桌面 */}
      <div ref={desktopRef} className="relative flex-1 overflow-hidden bg-[radial-gradient(ellipse_90%_80%_at_30%_20%,rgba(143,228,210,0.05),transparent),#070b0d]">
        {/* 桌面图标 */}
        <div className="absolute left-2 top-2 z-0 flex flex-col gap-1">
          {ICONS.map((icon) => (
            <button
              key={icon.id}
              onClick={() => open(icon.id)}
              className="os-icon group flex w-[76px] flex-col items-center gap-1 px-1 py-2 text-center"
              title={`打开 ${icon.label}`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center border border-signal-400/25 bg-ink-850 text-lg ${APP_META[icon.id].accent} group-hover:border-brass-400/50`}
              >
                {APP_META[icon.id].glyph}
              </span>
              <span className="text-[10px] leading-tight text-paper-400 group-hover:text-paper-100">
                {icon.no} {icon.label}
              </span>
            </button>
          ))}
        </div>

        {/* 桌面水印 */}
        <div className="pointer-events-none absolute bottom-3 right-4 z-0 text-right text-[10px] leading-relaxed tracking-widest text-paper-600/60">
          热搜疑云 TRENDING MYSTERY
          <br />
          每日一案 · 知乎热榜驱动
        </div>

        {/* 窗口 */}
        <AnimatePresence>
          {windows.map((w) => {
            const meta = APP_META[w.id];
            return (
              <motion.div
                key={`${w.id}-${w.uid}`}
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: w.min ? 0 : 1, scale: w.min ? 0.92 : 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute",
                  left: w.x,
                  top: w.y,
                  zIndex: w.z,
                  width: `min(${meta.w}px, calc(100% - 24px))`,
                  height: `min(${meta.h}px, 100%)`,
                  pointerEvents: w.min ? "none" : "auto",
                }}
                className={w.min ? "pointer-events-none opacity-0" : ""}
              >
                <div className="flex h-full flex-col overflow-hidden border border-signal-400/25 bg-ink-950/95 shadow-[0_22px_60px_rgba(0,0,0,0.65)] backdrop-blur-sm">
                  {/* 标题栏（拖拽区） */}
                  <div
                    className="win-titlebar flex select-none items-center gap-2 border-b border-ink-700 bg-ink-850/95 px-3 py-1.5"
                    onPointerDown={(e) => onTitlePointerDown(e, w)}
                    onPointerMove={onTitlePointerMove}
                    onPointerUp={onTitlePointerUp}
                    onPointerCancel={onTitlePointerUp}
                    onDoubleClick={() => minimize(w.id)}
                  >
                    <span className={`text-xs ${meta.accent}`}>{meta.glyph}</span>
                    <span className="text-[11px] tracking-[0.2em] text-paper-200">{meta.title}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          sfx.play("click");
                          minimize(w.id);
                        }}
                        className="flex h-4 w-4 items-center justify-center border border-ink-600 text-[9px] leading-none text-paper-400 hover:border-brass-400 hover:text-brass-300"
                        title="最小化"
                      >
                        —
                      </button>
                      <button
                        onClick={() => close(w.id)}
                        className="flex h-4 w-4 items-center justify-center border border-ink-600 text-[9px] leading-none text-paper-400 hover:border-blood-400 hover:text-blood-400"
                        title="关闭"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* 内容区 */}
                  <div className="flex-1 overflow-y-auto font-[family-name:var(--font-detective)]">
                    {renderApp(w.id)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 任务栏 */}
      <div className="flex items-center gap-1.5 border-t border-signal-400/20 bg-ink-900/95 px-2 py-1.5">
        <span className="px-1 text-[10px] tracking-widest text-paper-600">运行中</span>
        {windows.length === 0 && (
          <span className="text-[10px] tracking-widest text-paper-600">（点击桌面图标打开软件）</span>
        )}
        {windows.map((w) => (
          <button
            key={w.id}
            onClick={() => (w.min ? (focus(w.id), minimize(w.id)) : focus(w.id))}
            className={`flex items-center gap-1.5 border px-2 py-0.5 text-[10px] tracking-wider transition-colors ${
              w.min
                ? "border-ink-600 text-paper-600"
                : "border-brass-400/60 bg-brass-600/15 text-brass-300"
            }`}
          >
            <span className={APP_META[w.id].accent}>{APP_META[w.id].glyph}</span>
            {APP_META[w.id].title}
          </button>
        ))}
        <span className="ml-auto pr-1 text-[10px] tracking-widest text-paper-600">
          FIELDS OFFICE // NIGHT SHIFT
        </span>
      </div>
    </div>
  );
}
