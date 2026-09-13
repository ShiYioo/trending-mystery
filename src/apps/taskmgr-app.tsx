"use client";

// 应用 06 · 系统监视器（彩蛋）：真功能是"结束任务"关窗口。
// 占用指标分两层：头部仪表与各应用行都是浏览器实测（rAF 帧采样 / JS 堆 / DOM 节点数），
// 系统进程是虚构居民（看山守护进程杀不掉、咖啡服务杀了会复活）——戏肉保留。

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/game/sfx";
import type { AppId, AppProps } from "./types";

export interface TaskMgrProps extends AppProps {
  /** 当前开着的窗口（含自己），供进程表展示与结束任务 */
  procs: Array<{ id: AppId; uid: number; title: string }>;
  endTask: (id: AppId) => void;
}

/** 系统进程：protect 拒绝结束，respawn 结束后数秒复活 */
interface SysProc {
  pid: number;
  name: string;
  desc: string;
  mem: string;
  protect?: "fox" | "weather";
  respawn?: boolean;
}

const SYSTEM_PROCS: SysProc[] = [
  { pid: 4, name: "LIUKANSHAN.SYS", desc: "刘看山守护进程", mem: "1 看山", protect: "fox" },
  { pid: 8, name: "STORM.WATCH", desc: "雷暴监控（闪电渲染源）", mem: "64K", protect: "weather" },
  { pid: 12, name: "TYPEWRITER.DRV", desc: "打字机驱动", mem: "12K", respawn: true },
  { pid: 20, name: "COFFEE.SVC", desc: "咖啡保温服务", mem: "96K", respawn: true },
  { pid: 32, name: "CLOCK.SYS", desc: "夜班时钟（停在 02:47）", mem: "8K" },
  { pid: 44, name: "DUSTMOTES.EXE", desc: "灰尘漂浮渲染", mem: "24K" },
];

const REFUSE_LINES: Record<string, string> = {
  fox: "拒绝访问：刘看山与系统深度绑定（咬住了，拔不下来）",
  weather: "拒绝访问：天气不归这台机器管",
};

/** Chrome 系才有 performance.memory；其余浏览器如实显示"不外泄" */
interface PerfMemory {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/** 实测负载走势：最近 24 秒，每秒一根条，条高按负载百分比；空载时是贴地的细线 */
function LoadStrip({ samples }: { samples: number[] }) {
  const shown = samples.slice(-24);
  return (
    <div className="flex h-4 w-full items-end gap-[2px] overflow-hidden border border-ink-700 bg-ink-950 px-1 py-[2px]">
      {shown.length === 0 && <span className="text-[9px] leading-none text-ink-600">采样中…</span>}
      {shown.map((v, i) => (
        <div
          key={i}
          className={`min-w-[2px] flex-1 ${v > 55 ? "bg-blood-400" : v > 30 ? "bg-brass-400" : "bg-signal-400"}`}
          style={{ height: `${Math.max(8, v)}%` }}
        />
      ))}
    </div>
  );
}

export default function TaskMgrApp({ procs, endTask }: TaskMgrProps) {
  const [bootAt] = useState(() => Date.now());
  const [uptime, setUptime] = useState(0);
  const [load, setLoad] = useState<number | null>(null); // 实测渲染负载 0-100
  const [loadHistory, setLoadHistory] = useState<number[]>([]);
  const [heap, setHeap] = useState<{ used: number; limit: number } | null>(null);
  const [domCounts, setDomCounts] = useState<Record<string, number>>({});
  const [killed, setKilled] = useState<Set<number>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  const procsRef = useRef(procs);
  procsRef.current = procs;

  // 实测采样：rAF 帧时长 → 渲染负载；performance.memory → JS 堆；每个窗口的真实 DOM 节点数
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let deltas: number[] = [];
    const loop = (t: number) => {
      deltas.push(t - last);
      last = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const timer = setInterval(() => {
      setUptime(Date.now() - bootAt);
      // 帧采样不足（标签页切走 rAF 停摆）时保留上一个读数，不误报 100%
      if (deltas.length > 5) {
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const next = Math.round(Math.min(100, Math.max(0, ((avg - 16.7) / 33.3) * 100)));
        setLoad(next);
        setLoadHistory((h) => [...h.slice(-23), next]);
      }
      deltas = [];
      const mem = (performance as PerfMemory).memory;
      if (mem) setHeap({ used: mem.usedJSHeapSize / 1048576, limit: mem.jsHeapSizeLimit / 1048576 });
      const counts: Record<string, number> = {};
      for (const p of procsRef.current) {
        counts[p.id] = document.querySelectorAll(`[data-win-app="${p.id}"] *`).length;
      }
      setDomCounts(counts);
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, [bootAt]);

  const night = new Date().getHours() < 6; // 后半夜看山在守护进程里打盹

  // 结束后 4 秒复活的系统进程
  useEffect(() => {
    if (killed.size === 0) return;
    const timer = setTimeout(() => {
      setKilled(new Set());
      setNote("已停进程自动重启——它们离不开这台机器。");
    }, 4000);
    return () => clearTimeout(timer);
  }, [killed]);

  const alive = SYSTEM_PROCS.filter((p) => !killed.has(p.pid));
  // 玩家窗口 + SYSMON 自己 → 每个都是可结束的真任务；DOM 为实测节点数，内存按节点量估算
  const appRows = procs.map((p, i) => {
    const nodes = domCounts[p.id] ?? 0;
    return {
      key: `${p.id}-${p.uid}`,
      pid: 100 + i * 7,
      name: `${p.title}.EXE`,
      desc: "用户任务",
      dom: nodes,
      mem: `${Math.max(8, Math.round(nodes * 0.35))}K`,
      appId: p.id as AppId | undefined,
      sys: undefined as SysProc | undefined,
    };
  });
  const sysRows = alive.map((p, i) => ({
    key: p.name,
    pid: p.pid,
    name: p.name,
    desc: p.desc,
    dom: null,
    mem: p.mem,
    appId: undefined as AppId | undefined,
    sys: p,
  }));

  const rows = [...appRows, ...sysRows];

  function endRow(row: { sys?: SysProc; appId?: AppId; name: string }) {
    sfx.play("click");
    if (row.sys?.protect) {
      setNote(REFUSE_LINES[row.sys.protect]);
      sfx.play("drum");
      return;
    }
    if (row.sys) {
      setKilled((prev) => new Set(prev).add(row.sys!.pid));
      setNote(`${row.sys.name} 已停止。`);
      return;
    }
    if (row.appId) {
      endTask(row.appId);
      setNote(`${row.name} 已结束任务。`);
    }
  }

  return (
    <div className="space-y-3 p-4 font-[family-name:var(--font-dossier)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 pb-2">
        <span className="text-[11px] tracking-[0.25em] text-signal-300">SYSMON · 系统监视器</span>
        <span className="text-[10px] text-paper-600">TM-01 专用</span>
        <span className="ml-auto text-[10px] tracking-widest text-paper-600">
          运行时长 {fmtUptime(uptime)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <p className="text-[9px] tracking-widest text-paper-600">渲染负载（实测帧时长）</p>
          <LoadStrip samples={loadHistory} />
          <p className="mt-1 text-[10px] text-paper-400">
            {load === null ? "采样中…" : load === 0 ? "0%（空载）" : `${load}%`}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] tracking-widest text-paper-600">内存（JS 堆实测）</p>
          <div className="h-4 border border-ink-700 bg-ink-950 p-[2px]">
            <div
              className="h-full bg-brass-600/70 transition-all duration-700"
              style={{
                width: heap ? `${Math.min(100, (heap.used / heap.limit) * 100).toFixed(1)}%` : "0%",
              }}
            />
          </div>
          <p className="mt-1 text-[10px] text-paper-400">
            {heap ? `${heap.used.toFixed(1)}M / ${(heap.limit / 1024).toFixed(1)}G` : "此浏览器不外泄内存"}
          </p>
        </div>
      </div>

      <div className="border border-ink-700">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-ink-700 bg-ink-850/80 px-2 py-1 text-[9px] tracking-widest text-paper-600">
          <span>映像名称</span>
          <span className="w-10 text-right">PID</span>
          <span className="w-14 text-right">DOM 节点</span>
          <span className="w-14 text-right">内存</span>
        </div>
        <div className="max-h-44 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.key}
              className="group grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-ink-800 px-2 py-1 text-[10px] text-paper-300 hover:bg-ink-850/60"
            >
              <span className="truncate">
                <span className="text-paper-100">{row.name}</span>
                <span className="ml-2 text-[9px] text-paper-600">
                  {row.sys?.protect === "fox" ? (night ? "打盹中" : row.desc) : row.desc}
                </span>
              </span>
              <span className="w-10 text-right text-paper-600">{row.pid}</span>
              <span className="w-14 text-right text-signal-300">
                {row.dom === null ? "—" : row.dom.toLocaleString()}
              </span>
              <span className="w-14 text-right text-paper-400">{row.mem}</span>
              <button
                onClick={() => endRow(row)}
                className="col-span-4 justify-self-start border border-ink-600 px-2 py-0.5 text-[9px] tracking-wider text-paper-500 opacity-0 transition-opacity group-hover:opacity-100 hover:border-blood-400 hover:text-blood-400"
              >
                结束任务
              </button>
            </div>
          ))}
        </div>
      </div>

      {note && (
        <p className="border border-blood-600/40 bg-blood-600/5 px-2 py-1 text-[10px] leading-relaxed text-blood-400">
          ⚠ {note}
        </p>
      )}

      <p className="text-[9px] leading-relaxed tracking-wide text-paper-600">
        进程 {rows.length} · 应用行 DOM 为实测（节点数 × 0.35K 估算内存）· 系统进程为这间办公室的常住居民。
        刘看山守护进程为关键进程，结束它的尝试将被尾巴拍回。
      </p>
    </div>
  );
}
