"use client";

// 全局氛围层：漂浮尘埃粒子（canvas）+ 暗角与扫描线 + 静音开关。
// 游戏感的"空气"——低成本、常驻、不挡交互。

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/game/sfx";

export function DustCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = Math.min(56, Math.floor(window.innerWidth / 24));
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.22,
      vy: -0.08 - Math.random() * 0.18,
      tw: Math.random() * Math.PI * 2,
      ts: 0.004 + Math.random() * 0.012,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += p.ts;
        if (p.y < -4) p.y = h + 4;
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        const alpha = 0.12 + 0.24 * (0.5 + 0.5 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 162, 78, ${alpha.toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden />
      {/* 暗角 + 扫描线：老式卷宗放映机的质感 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% 40%, transparent 55%, rgba(5,4,2,0.55) 100%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05]"
        aria-hidden
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(237,225,198,0.5) 2px, rgba(237,225,198,0.5) 3px)",
        }}
      />
    </>
  );
}

export function MuteButton() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    queueMicrotask(() => setOn(sfx.enabled));
  }, []);
  return (
    <button
      onClick={() => setOn(sfx.toggle())}
      title={on ? "音效开" : "音效关"}
      className="border border-ink-600 px-2 py-1 font-[family-name:var(--font-dossier)] text-xs text-paper-400 transition-colors hover:border-brass-400 hover:text-brass-300"
    >
      {on ? "♪ 开" : "✕ 静"}
    </button>
  );
}
