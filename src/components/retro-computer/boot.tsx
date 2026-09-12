"use client";

// TM-01 开机自检（BIOS）：逐行点亮模块，点击任意处跳过。

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/game/sfx";

const LINES = [
  "TM-01 FIELD TERMINAL // BIOS v2.4.1",
  "COPYRIGHT 1984-2026 · ZHIHU OPEN ARCHIVE",
  "",
  "MEMORY TEST .......... 640K OK",
  "热榜模块 ............. OK",
  "档案检索 ............. OK",
  "审问终端 ............. OK",
  "共识引擎 ............. OK",
  "线人网络 ............. OK",
  "",
  "CONNECTING FIELD OFFICE ...... 已连接",
  "BOOT COMPLETE — 每日一案，正在装载",
];

export function BootSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    sfx.play("boot");
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (shown >= LINES.length) {
      const t = setTimeout(finish, 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => {
        setShown((s) => s + 1);
        if (shown % 2 === 0) sfx.play("type");
      },
      shown === 0 ? 350 : 190 + Math.random() * 160,
    );
    return () => clearTimeout(t);
  }, [shown, finish]);

  return (
    <div
      className="crt-phosphor flex h-full w-full cursor-pointer select-none flex-col justify-center bg-ink-950 p-8 font-[family-name:var(--font-dossier)] text-xs leading-loose tracking-wider text-brass-300 md:p-14 md:text-sm"
      onClick={finish}
      title="点击跳过"
    >
      {LINES.slice(0, shown).map((line, i) => (
        <p key={i}>{line || "\u00A0"}</p>
      ))}
      <span className="tw-cursor mt-1" />
      <p className="mt-8 text-[10px] text-paper-600">点击任意处跳过自检</p>
    </div>
  );
}
