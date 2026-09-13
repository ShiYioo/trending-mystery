"use client";

// TM-01 登录屏：老机器的用户选择界面——BIOS 之后、桌面之前。
// 知乎侦探（OAuth 新标签页授权，身份亮起自动进入）或游客（匿名侦探，稍后可在顶栏绑定）。
// 已登录的回访者显示「欢迎回来」片刻后直接进桌面。

import { useEffect, useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { useGame } from "@/lib/game/store";

export function LoginScreen({ onDone }: { onDone: () => void }) {
  const { profile } = useGame();
  const [waiting, setWaiting] = useState(false);

  // 身份就位 → 自动进入：等待授权的即刻进；回访已登录的稍候一拍（露脸欢迎语）再进
  useEffect(() => {
    if (!profile) return;
    const t = setTimeout(onDone, waiting ? 150 : 900);
    return () => clearTimeout(t);
  }, [profile, waiting, onDone]);

  return (
    <div className="crt-phosphor flex h-full w-full select-none flex-col items-center justify-center bg-ink-950 p-5">
      <p className="font-[family-name:var(--font-dossier)] text-[10px] tracking-[0.32em] text-paper-600">
        TM-01 FIELD TERMINAL // 用户登录
      </p>

      <div className="mt-4 w-full max-w-[380px] border border-signal-400/25 bg-ink-900/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
        {profile ? (
          <div className="py-4 text-center">
            <p className="font-[family-name:var(--font-dossier)] text-xs tracking-[0.25em] text-signal-300">
              身份已识别
            </p>
            <p className="mt-2 text-sm text-paper-100">
              欢迎回来，{profile.name}
              <span className="tw-cursor ml-1" />
            </p>
            <p className="mt-1 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
              正在进入夜班终端……
            </p>
          </div>
        ) : (
          <>
            <p className="font-[family-name:var(--font-dossier)] text-[11px] tracking-[0.25em] text-brass-400">
              选择今晚值班的侦探
            </p>

            {/* 知乎侦探：OAuth 授权登录 */}
            <button
              onClick={() => {
                if (waiting) return;
                sfx.play("click");
                sessionStorage.setItem("tm_oauth_pending", "1");
                window.open("/api/oauth/authorize", "_blank", "noopener");
                setWaiting(true);
              }}
              className={`mt-3 flex w-full items-center gap-3 border p-3 text-left transition-colors ${
                waiting
                  ? "border-signal-300 bg-signal-400/10"
                  : "border-brass-400/50 hover:border-brass-300 hover:bg-brass-600/15"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 12KB 首帧 PNG */}
              <img src="/liukanshan/fox.png" alt="刘看山" className="h-11 w-11 shrink-0" />
              <span className="min-w-0">
                <span className={`block text-sm ${waiting ? "text-signal-300" : "text-brass-300"}`}>
                  {waiting ? "等待授权中……" : "知乎侦探 · 授权登录"}
                </span>
                <span className="mt-0.5 block font-[family-name:var(--font-dossier)] text-[10px] leading-relaxed tracking-wider text-paper-600">
                  {waiting ? "在新标签页完成授权，这里会自动放行" : "榜上留真名 · 战报署你的名字"}
                </span>
              </span>
            </button>

            {/* 游客 */}
            <button
              onClick={() => {
                sfx.play("click");
                onDone();
              }}
              className="mt-2 flex w-full items-center gap-3 border border-ink-600 p-3 text-left transition-colors hover:border-paper-400"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink-600 text-lg text-paper-400">
                ◎
              </span>
              <span>
                <span className="block text-sm text-paper-200">游客进入 · 匿名侦探</span>
                <span className="mt-0.5 block font-[family-name:var(--font-dossier)] text-[10px] tracking-wider text-paper-600">
                  直接开工，稍后可在顶栏绑定身份
                </span>
              </span>
            </button>

            {waiting && (
              <button
                onClick={() => {
                  sfx.play("click");
                  setWaiting(false);
                }}
                className="mt-2 w-full font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600 underline-offset-4 hover:text-brass-400 hover:underline"
              >
                改以游客进入（授权可稍后再说）
              </button>
            )}
          </>
        )}
      </div>

      <p className="mt-3 font-[family-name:var(--font-dossier)] text-[9px] tracking-[0.3em] text-paper-600/70">
        登录仅用于身份展示与战绩署名 · 游戏进度与登录无关
      </p>
    </div>
  );
}
