"use client";

// 3D 倾斜卡片：鼠标跟踪视角 + 移动光泽，Hearthstone 式的卡牌手感。

import { useRef, useState, type ReactNode } from "react";

export function TiltCard({
  children,
  className = "",
  max = 9,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ rx: number; ry: number; gx: number; gy: number }>({
    rx: 0,
    ry: 0,
    gx: 50,
    gy: 50,
  });
  const [active, setActive] = useState(false);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{
        transform: `perspective(900px) rotateX(${style.rx}deg) rotateY(${style.ry}deg) ${active ? "translateZ(6px)" : ""}`,
        transition: active ? "transform 60ms linear" : "transform 350ms cubic-bezier(.22,1,.36,1)",
        transformStyle: "preserve-3d",
      }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        setActive(true);
        setStyle({
          rx: -(py - 0.5) * max * 2,
          ry: (px - 0.5) * max * 2,
          gx: px * 100,
          gy: py * 100,
        });
      }}
      onMouseLeave={() => {
        setActive(false);
        setStyle({ rx: 0, ry: 0, gx: 50, gy: 50 });
      }}
    >
      {children}
      {/* 移动光泽 */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: active ? 1 : 0,
          background: `radial-gradient(circle at ${style.gx}% ${style.gy}%, rgba(237,225,198,0.08), transparent 55%)`,
        }}
      />
    </div>
  );
}
