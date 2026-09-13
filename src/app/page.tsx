"use client";

// 总控：3D 办公室开场（按 ENTER 推近 CRT）→ TM-01 复古电脑（BIOS 开机 → 桌面 OS）。
// 四个房间 + 神探榜全部是 OS 里的软件，零路由跳转。
// 每次进入都从 3D 桌面开始——不按开机键就没有任何声音与画面切换。

import { useEffect, useState } from "react";
import { DetectiveOffice } from "@/components/detective-office";
import { BootSequence } from "@/components/retro-computer/boot";
import { MonitorShell } from "@/components/retro-computer/crt";
import { LoginScreen } from "@/components/retro-computer/login";
import { RetroOS } from "@/components/retro-computer/os";
import { fetchCase } from "@/lib/game/api";
import { useGame } from "@/lib/game/store";

type Phase = "init" | "desk" | "computer";

export default function Experience() {
  const [phase, setPhase] = useState<Phase>("init");
  const { caseBrief, setCase } = useGame();

  useEffect(() => {
    // 首帧后进入桌面（避免 SSR 水合不一致）
    const t = setTimeout(() => setPhase("desk"), 80);
    return () => clearTimeout(t);
  }, []);

  // 开场期间预载今日案件
  useEffect(() => {
    if (!caseBrief) {
      fetchCase(1)
        .then(setCase)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "init") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 font-[family-name:var(--font-dossier)] text-xs tracking-[0.3em] text-paper-600">
        载入现场<span className="tw-cursor" />
      </div>
    );
  }

  if (phase === "desk") {
    return (
      <div className="fixed inset-0 z-40">
        <DetectiveOffice onEnter={() => setPhase("computer")} />
      </div>
    );
  }

  return (
    <MonitorShell>
      <ComputerWithBoot />
    </MonitorShell>
  );
}

function ComputerWithBoot() {
  // BIOS 自检 → 用户登录（知乎授权或游客）→ 桌面 OS
  const [stage, setStage] = useState<"bios" | "login" | "os">("bios");
  if (stage === "bios") return <BootSequence onDone={() => setStage("login")} />;
  if (stage === "login") return <LoginScreen onDone={() => setStage("os")} />;
  return <RetroOS />;
}
