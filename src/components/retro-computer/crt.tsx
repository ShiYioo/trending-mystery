"use client";

// TM-01 显示器外壳（与 3D 办公室里的那台同款复刻）：
// 机身 #202b2d 系、屏幕比例 5.22:3.12、下巴铭牌居中、电源灯琥珀（开机态）。
// 屏幕内容（开机/OS）作为 children 注入——WebGL 管氛围，DOM 管交互。

import { useRef, useState, type ReactNode } from "react";

export function MonitorShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hovering, setHovering] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-3 py-8">
      {/* 屏幕辉光照亮桌面 */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: hovering ? 1 : 0.75,
          background:
            "radial-gradient(ellipse 62% 48% at 50% 44%, rgba(219,169,79,0.13), transparent 70%)",
        }}
      />
      <div
        ref={ref}
        onMouseMove={(e) => {
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          setHovering(true);
          setTilt({
            rx: -((e.clientY - rect.top) / rect.height - 0.5) * 3.2,
            ry: ((e.clientX - rect.left) / rect.width - 0.5) * 4.2,
          });
        }}
        onMouseLeave={() => {
          setHovering(false);
          setTilt({ rx: 0, ry: 0 });
        }}
        className="relative w-full max-w-[1150px]"
        style={{
          transform: `perspective(1600px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: hovering ? "transform 80ms linear" : "transform 500ms cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* 机身（对齐 3D 版 CRT：#202b2d 冷灰绿机身 + 大圆角） */}
        <div className="rounded-[28px] border border-[#31413f]/60 bg-gradient-to-b from-[#26333a] via-[#1f2b30] to-[#161f23] p-[16px] shadow-[0_38px_80px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] md:p-[18px]">
          {/* 内框 */}
          <div className="rounded-[20px] border border-black/70 bg-[#04070a] p-[10px] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
            {/* 屏幕（5.22 : 3.12，与 3D 版屏幕平面同比例） */}
            <div
              className="crt-flicker relative w-full overflow-hidden rounded-[14px]"
              style={{ aspectRatio: "5.22 / 3.12", maxHeight: "72vh" }}
            >
              {children}
              {/* 玻璃反光 */}
              <div className="crt-glass pointer-events-none absolute inset-0 z-30" />
              {/* 弧面暗角 */}
              <div className="crt-vignette pointer-events-none absolute inset-0 z-30" />
              {/* 扫描线 */}
              <div
                className="pointer-events-none absolute inset-0 z-30 opacity-[0.06]"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(242,234,216,0.7) 2px, rgba(242,234,216,0.7) 3px)",
                }}
              />
            </div>
          </div>
          {/* 下巴：电源灯在左、铭牌居中——与 3D 版一致 */}
          <div className="relative flex items-center justify-center px-3 pb-1 pt-3">
            <span className="power-led absolute left-4 h-2.5 w-2.5 rounded-full bg-brass-300" />
            <span className="font-[family-name:var(--font-dossier)] text-[10px] tracking-[0.34em] text-signal-400/70">
              TRINITRON // TM-01
            </span>
          </div>
        </div>
        {/* 支架（同机身色系） */}
        <div className="mx-auto h-12 w-44 bg-gradient-to-b from-[#1f2b30] to-[#161f23] [clip-path:polygon(14%_0,86%_0,100%_100%,0_100%)]" />
        <div className="mx-auto h-3.5 w-72 rounded-b-xl border border-[#31413f]/50 border-t-0 bg-[#161f23] shadow-[0_16px_30px_rgba(0,0,0,0.6)]" />
      </div>
    </div>
  );
}
