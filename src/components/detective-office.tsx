"use client";

// 3D 侦探办公室 · 开场过场：夜班桌前的 TM-01。
// 按 ENTER（实体键/3D 键盘/点击屏幕/开机按钮）→ 镜头推近 CRT → onEnter 切入屏幕内的复古 OS。
// 氛围：雨夜闪电、台灯体积光与尘埃、软木板情报墙红线、桌面文件与鼠标、椅子与地毯。
// WebGL 管氛围与开场，DOM（retro-computer）管真实交互——两个世界各司其职。

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, RoundedBox, Text } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sfx } from "@/lib/game/sfx";

export function DetectiveOffice({ onEnter }: { onEnter: () => void }) {
  const [pressed, setPressed] = useState<string | null>(null);
  const [typing, setTyping] = useState("");
  const [entering, setEntering] = useState(false);
  const enteredRef = useRef(false);
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  // 闪电调制目标：环境光与窗玻璃材质（跨组件共享的引用）
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const windowMatRef = useRef<THREE.MeshStandardMaterial>(null);

  function enter() {
    if (enteredRef.current) return;
    enteredRef.current = true;
    setEntering(true);
    sfx.play("boot");
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Enter") {
        event.preventDefault();
        enter();
        return;
      }
      if (entering) return;
      const key = event.key === " " ? "SPACE" : event.key === "Backspace" ? "BACK" : event.key.toUpperCase();
      if (key === "SPACE" || key === "BACK" || /^[A-Z]$/.test(key)) {
        event.preventDefault();
        keyPress(key, true); // 物理键盘：只做视觉反馈不发声——开机前不应有打字声
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function keyPress(key: string, silent = false) {
    setPressed(key);
    window.setTimeout(() => setPressed(null), 110);
    if (!silent) sfx.play(key === "ENTER" ? "boot" : key === "BACK" ? "click" : "type");
    if (key === "BACK") setTyping((value) => value.slice(0, -1));
    else if (key === "SPACE") setTyping((value) => `${value} `.slice(-24));
    else if (key.length === 1) setTyping((value) => `${value}${key}`.slice(-24));
  }

  return (
    <div className="office-stage relative h-screen w-full overflow-hidden bg-[#080b0c]">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 2.85, 11.8], fov: 32 }} gl={{ toneMappingExposure: 1.3 }}>
        <color attach="background" args={["#080b0c"]} />
        <fog attach="fog" args={["#080b0c", 13, 30]} />
        <OfficeRoom />
        <OfficeLight ambientRef={ambientRef} />
        <Lightning ambientRef={ambientRef} windowMatRef={windowMatRef} />
        <Desk />
        <Rug />
        <Chair />
        <CRT entering={entering} typing={typing} onEnter={enter} />
        <Keyboard pressed={pressed} onPress={(key) => (key === "ENTER" ? enter() : keyPress(key))} />
        <DeskObjects />
        <DeskPapers />
        <DeskClutter />
        <FloorPapers />
        <RotaryPhone position={[-2.15, -0.76, 1.95]} />
        <ComputerMouse />
        {/* 沿墙家具：把房间填成办案室 */}
        <FilingCabinet position={[-5.6, -1.35, -5.2]} />
        <FilingCabinet position={[-4.5, -1.35, -5.2]} />
        <Bookshelf position={[-7.6, -2.3, -2.3]} rotationY={Math.PI / 2} />
        <HatStand position={[5.9, 0, 2.9]} />
        <Radiator position={[3.6, 0, -5.35]} />
        <TrashCorner position={[4.6, 0, 1.7]} />
        <FloorBoxes position={[-4.9, 0, 2.9]} />
        <WallClock position={[1.6, 4.3, -5.94]} />
        <FramedLicense position={[7.93, 2.6, -1.8]} rotationY={-Math.PI / 2} />
        <WindowPane matRef={windowMatRef} />
        <Corkboard />
        <DustMotes />
        <CameraRig entering={entering} onArrived={() => onEnterRef.current()} />
      </Canvas>

      <div className="pointer-events-none absolute left-5 top-5 font-[family-name:var(--font-dossier)] text-[10px] tracking-[0.2em] text-signal-300">
        <span className="status-dot" />
        FIELD OFFICE / NIGHT SHIFT
      </div>
      <div className="pointer-events-none absolute right-5 top-5 font-[family-name:var(--font-dossier)] text-[10px] tracking-[0.16em] text-paper-600">
        NO CAMERA CONTROL // DESK VIEW
      </div>

      {!entering && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
          <button
            onClick={enter}
            className="btn-brass animate-pulse px-10 py-3 font-[family-name:var(--font-dossier)] text-sm tracking-[0.4em]"
          >
            ⏻ 开 机
          </button>
          <p className="mt-3 font-[family-name:var(--font-dossier)] text-[10px] tracking-[0.3em] text-paper-600">
            按 ENTER 或点击屏幕 · 整个案子都住在这台机器里
          </p>
        </div>
      )}
      {entering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#f4ca72] opacity-0 [animation:screen-flash_1.4s_ease-in_forwards]" />
      )}
      <style jsx global>{`
        @keyframes screen-flash {
          0%, 62% { opacity: 0; }
          82% { opacity: 0.85; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/** 程序化木地板纹理：Canvas 画木板条 + 色差 + 接缝，零外部资源（亮度直接出到成品档，材质不再乘色） */
function makeWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const planks = 8;
  const plankH = canvas.height / planks;
  for (let i = 0; i < planks; i++) {
    const tone = 0.86 + Math.random() * 0.3;
    const r = Math.floor(128 * tone);
    const g = Math.floor(96 * tone);
    const b = Math.floor(62 * tone);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, i * plankH, canvas.width, plankH);
    // 木纹丝
    for (let s = 0; s < 24; s++) {
      ctx.strokeStyle = `rgba(70,48,26,${0.1 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.6 + Math.random();
      const y = i * plankH + Math.random() * plankH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(canvas.width * 0.3, y + (Math.random() - 0.5) * 6, canvas.width * 0.7, y + (Math.random() - 0.5) * 6, canvas.width, y);
      ctx.stroke();
    }
    // 板间接缝
    ctx.fillStyle = "rgba(38,26,16,0.9)";
    ctx.fillRect(0, i * plankH, canvas.width, 2);
    // 端头接缝（错缝）
    const seamX = ((i * 197) % 512) + 40;
    ctx.fillRect(seamX, i * plankH, 2, plankH);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function OfficeRoom() {
  const wood = useMemo(() => makeWoodTexture(), []);
  return (
    <group>
      {/* 木地板（材质不乘色，贴图即成品亮度） */}
      <mesh receiveShadow position={[0, -2.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, 22]} />
        <meshStandardMaterial map={wood} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* 后墙（吃补光后可见） */}
      <mesh position={[0, 3.2, -6]} receiveShadow>
        <planeGeometry args={[20, 11]} />
        <meshStandardMaterial color="#33434a" roughness={0.95} />
      </mesh>
      {/* 侧墙 */}
      <mesh position={[-8, 2.5, -1]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#2a373d" roughness={0.95} />
      </mesh>
      <mesh position={[8, 2.5, -1]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#2a373d" roughness={0.95} />
      </mesh>
      {/* 天花板：围合出"房间" */}
      <mesh position={[0, 5.4, -1]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 14]} />
        <meshStandardMaterial color="#1a2429" roughness={1} />
      </mesh>
      {/* 踢脚线 */}
      <mesh position={[0, -2.11, -5.94]}>
        <boxGeometry args={[20, 0.38, 0.12]} />
        <meshStandardMaterial color="#0c1113" roughness={0.9} />
      </mesh>
      <mesh position={[-7.94, -2.11, -1]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[12, 0.38, 0.12]} />
        <meshStandardMaterial color="#0c1113" roughness={0.9} />
      </mesh>
      <mesh position={[7.94, -2.11, -1]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[12, 0.38, 0.12]} />
        <meshStandardMaterial color="#0c1113" roughness={0.9} />
      </mesh>
      {/* 墙裙线（chair rail） */}
      <mesh position={[0, 0.4, -5.96]}>
        <boxGeometry args={[20, 0.07, 0.05]} />
        <meshStandardMaterial color="#182228" roughness={0.9} />
      </mesh>
    </group>
  );
}

function OfficeLight({ ambientRef }: { ambientRef: React.RefObject<THREE.AmbientLight | null> }) {
  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.12} color="#748784" />
      <spotLight castShadow position={[1.9, 5.8, 1.2]} intensity={58} angle={0.3} penumbra={0.8} color="#f0b84d" shadow-mapSize={[1024, 1024]} />
      {/* 暖色补光：模拟台灯在墙与地板上的反弹，让大面材质可见 */}
      <pointLight position={[0, 4.2, 2.6]} intensity={16} distance={22} decay={2} color="#d9b98a" />
      <pointLight position={[-4.5, 2.8, -4.5]} intensity={10} color="#315f62" />
    </>
  );
}

/** 窗形光斑贴图：透明底 + 窗框十字棂（叠加混合，只闪现窗的形状） */
function makeWindowPatchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "rgba(215,232,255,0.95)";
  g.fillRect(38, 46, 180, 164);
  // 十字窗棂投影
  g.fillStyle = "rgba(0,0,0,0.92)";
  g.fillRect(122, 46, 12, 164);
  g.fillRect(38, 122, 180, 12);
  // 窗框
  g.lineWidth = 14;
  g.strokeStyle = "rgba(0,0,0,0.95)";
  g.strokeRect(38, 46, 180, 164);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 雨夜闪电：穿窗而入——定向光沿"窗→桌面"直线入射 + 体积光柱 + 地板窗形光斑，四者随闪同步 */
function Lightning({
  ambientRef,
  windowMatRef,
}: {
  ambientRef: React.RefObject<THREE.AmbientLight | null>;
  windowMatRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const power = useRef(0);
  const next = useRef(2 + Math.random() * 6);
  const elapsed = useRef(0);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const pointRef = useRef<THREE.PointLight>(null);
  const shaftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const patchMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const patchTex = useMemo(() => makeWindowPatchTexture(), []);

  // 光柱：窗中心 → 地板光斑
  const shaft = useMemo(() => {
    const from = new THREE.Vector3(3.6, 3.0, -5.88);
    const to = new THREE.Vector3(0.8, -2.28, 0.2);
    const dir = to.clone().sub(from);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return { mid, quat, len: dir.length() };
  }, []);

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current > next.current) {
      power.current = 0.9 + Math.random() * 0.4;
      next.current = elapsed.current + (Math.random() < 0.35 ? 0.28 : 5 + Math.random() * 9);
    }
    power.current = Math.max(0, power.current - delta * 3.2);
    const p = power.current;
    if (ambientRef.current) ambientRef.current.intensity = 0.12 + p * 1.2;
    if (windowMatRef.current) windowMatRef.current.emissiveIntensity = 0.5 + p * 4;
    if (dirRef.current) dirRef.current.intensity = p * 110;
    if (pointRef.current) pointRef.current.intensity = p * 55;
    if (shaftMatRef.current) shaftMatRef.current.opacity = p * 0.16;
    if (patchMatRef.current) patchMatRef.current.opacity = p * 0.85;
  });

  // 光向恒定、场景静态：阴影贴图只渲染一次，之后零每帧开销——闪光时影子随亮度显形
  useEffect(() => {
    const light = dirRef.current;
    if (!light) return;
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
  }, []);

  return (
    <>
      {/* 方向光位置在"窗→房间中心"连线的反向延长线上，确保光线穿过窗户射向桌面 */}
      <directionalLight
        ref={dirRef}
        position={[8.4, 8.2, -15.6]}
        color="#b8d4f0"
        intensity={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={2}
        shadow-camera-far={45}
        shadow-bias={-0.0006}
      />
      <pointLight ref={pointRef} position={[3.4, 2.9, -5.2]} color="#b8d4f0" intensity={0} distance={16} decay={2} />
      {/* 体积光柱：从窗口斜贯到地板 */}
      <mesh position={shaft.mid} quaternion={shaft.quat}>
        <cylinderGeometry args={[1.05, 1.7, shaft.len, 20, 1, true]} />
        <meshBasicMaterial
          ref={shaftMatRef}
          color="#cfe2f4"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 地板上的窗形光斑（带十字窗棂投影） */}
      <mesh position={[0.8, -2.27, 0.2]} rotation={[-Math.PI / 2, 0, 0.42]}>
        <planeGeometry args={[3.4, 2.8]} />
        <meshBasicMaterial
          ref={patchMatRef}
          map={patchTex}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function Desk() {
  return (
    <group position={[0, -1.05, 0.55]}>
      <RoundedBox args={[7.8, 0.42, 4.1]} radius={0.12} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial color="#3d2e20" metalness={0.56} roughness={0.38} />
      </RoundedBox>
      <mesh position={[-2.8, -1.15, 0]} castShadow>
        <boxGeometry args={[0.22, 2.2, 3.1]} />
        <meshStandardMaterial color="#201914" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[2.8, -1.15, 0]} castShadow>
        <boxGeometry args={[0.22, 2.2, 3.1]} />
        <meshStandardMaterial color="#201914" metalness={0.5} roughness={0.5} />
      </mesh>
      <Text position={[0, 0.25, 1.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.13} color="#78928c" anchorX="center">
        TM-01 / ACTIVE INVESTIGATION DESK
      </Text>
    </group>
  );
}

/** 桌下地毯：暗红做旧，锚定桌区 */
function Rug() {
  return (
    <mesh position={[0, -2.28, 0.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[3.4, 40]} />
      <meshStandardMaterial color="#3c1c17" roughness={1} transparent opacity={0.92} />
    </mesh>
  );
}

/** 椅子：四腿落地，坐面与靠背成比例 */
function Chair() {
  const legs: Array<[number, number]> = [
    [-0.62, 0.5],
    [0.62, 0.5],
    [-0.62, -0.55],
    [0.62, -0.55],
  ];
  return (
    <group position={[0.4, 0, -1.5]}>
      {legs.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, -2.03, lz]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.55, 10]} />
          <meshStandardMaterial color="#100c09" roughness={0.85} />
        </mesh>
      ))}
      <RoundedBox args={[1.5, 0.16, 1.3]} radius={0.05} smoothness={4} position={[0, -1.72, 0]} castShadow>
        <meshStandardMaterial color="#14100c" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[1.5, 1.5, 0.16]} radius={0.05} smoothness={4} position={[0, -0.98, -0.58]} castShadow>
        <meshStandardMaterial color="#14100c" roughness={0.9} />
      </RoundedBox>
      {/* 搭在椅背上的外套 */}
      <RoundedBox args={[1.34, 0.95, 0.14]} radius={0.06} smoothness={4} position={[0, -1.12, -0.44]} rotation={[0.08, 0, 0.04]} castShadow>
        <meshStandardMaterial color="#2a2320" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.26, 0.1]} radius={0.05} smoothness={3} position={[0, -0.66, -0.44]} rotation={[0.12, 0, 0]}>
        <meshStandardMaterial color="#332a24" roughness={0.95} />
      </RoundedBox>
    </group>
  );
}

function CRT({ entering, typing, onEnter }: { entering: boolean; typing: string; onEnter: () => void }) {
  const shadeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = shadeMatRef.current;
    if (!m) return;
    const target = entering ? 1.6 : 0.16 + Math.sin(clock.elapsedTime * 2.1) * 0.05; // 待机呼吸辉光
    m.emissiveIntensity += (target - m.emissiveIntensity) * 0.12;
  });
  return (
    <group position={[0, 1.51, -0.45]}>
      <RoundedBox args={[6.6, 4.7, 2.0]} radius={0.32} smoothness={6} castShadow>
        <meshStandardMaterial color="#202b2d" metalness={0.62} roughness={0.42} />
      </RoundedBox>
      <RoundedBox args={[5.65, 3.55, 0.15]} radius={0.18} smoothness={5} position={[0, 0.15, 1.03]}>
        <meshStandardMaterial ref={shadeMatRef} color="#071214" metalness={0.35} roughness={0.24} emissive="#f0b84d" emissiveIntensity={0.16} />
      </RoundedBox>
      <mesh position={[0, 0.15, 1.12]}>
        <planeGeometry args={[5.22, 3.12]} />
        <meshBasicMaterial color="#092022" />
      </mesh>
      <ScreenContent entering={entering} typing={typing} />
      {/* 点击屏幕 = 按下电源 */}
      <mesh position={[0, 0.15, 1.16]} onClick={onEnter} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "default")}>
        <planeGeometry args={[5.3, 3.3]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh position={[-2.65, -1.72, 0.95]}>
        <boxGeometry args={[0.12, 0.12, 0.06]} />
        <meshBasicMaterial color={entering ? "#f4ca72" : "#cf5e4b"} />
      </mesh>
      <Text position={[0, -1.72, 1.1]} fontSize={0.13} color="#65817d" anchorX="center">
        TRINITRON // TM-01
      </Text>
      {/* 前下巴：旋钮区 */}
      <mesh position={[0, -2.0, 0.95]}>
        <boxGeometry args={[5.5, 0.42, 0.22]} />
        <meshStandardMaterial color="#1a2426" metalness={0.5} roughness={0.5} />
      </mesh>
      {[-2.3, -1.95].map((kx) => (
        <mesh key={kx} position={[kx, -2.0, 1.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.1, 14]} />
          <meshStandardMaterial color="#0e1416" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[-2.3, -2.0, 1.14]}>
        <boxGeometry args={[0.02, 0.09, 0.02]} />
        <meshBasicMaterial color="#c69442" />
      </mesh>
      {/* 右侧散热栅 */}
      {[-0.4, -0.1, 0.2, 0.5, 0.8, 1.1].map((vy) => (
        <mesh key={vy} position={[3.31, vy, 0]}>
          <boxGeometry args={[0.03, 0.09, 1.6]} />
          <meshStandardMaterial color="#10181a" roughness={0.8} />
        </mesh>
      ))}
      {/* 机壳角落的便利贴（办案便签） */}
      <group position={[2.45, 1.45, 1.06]} rotation={[0, 0, -0.22]}>
        <mesh>
          <planeGeometry args={[0.5, 0.5]} />
          <meshStandardMaterial color="#d9c26a" roughness={0.95} />
        </mesh>
        <Text position={[0, 0.02, 0.006]} fontSize={0.085} color="#4a3d1f" anchorX="center">
          别信他
        </Text>
      </group>
    </group>
  );
}

function ScreenContent({ entering, typing }: { entering: boolean; typing: string }) {
  // 琥珀色系与开机后的 BIOS 同款——推镜切屏时内容风格连续
  const lines = entering
    ? ["", "BOOTING ...", ""]
    : [
        "TM-01 FIELD TERMINAL",
        "----------------------------",
        typing ? `> ${typing}_` : "> PRESS ENTER",
        "",
        "知乎热榜 · 已接入",
        "档案检索 · 已接入",
        "审问终端 · 已接入",
      ];
  return (
    <group position={[0, 0.15, 1.2]}>
      {lines.map((line, index) => (
        <Text
          key={line + index}
          position={[-2.35, 1.22 - index * 0.31, 0]}
          fontSize={0.16}
          color={index === 0 ? "#f0b84d" : "#caa15c"}
          anchorX="left"
        >
          {line}
        </Text>
      ))}
    </group>
  );
}

function Keyboard({ pressed, onPress }: { pressed: string | null; onPress: (key: string) => void }) {
  const rows = [["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"], ["A", "S", "D", "F", "G", "H", "J", "K", "L"], ["Z", "X", "C", "V", "B", "N", "M", "BACK"], ["SHIFT", "SPACE", "ENTER"]];
  const worn = new Set(["E", "R", "N", "SPACE"]); // 常用键磨得发亮
  return (
    <group position={[0, -0.75, 1.35]} rotation={[-0.06, 0, 0]}>
      {/* 键盘底托 */}
      <RoundedBox args={[5.5, 0.14, 2.35]} radius={0.05} smoothness={4} position={[0, -0.12, 0.08]} castShadow>
        <meshStandardMaterial color="#1b262a" metalness={0.4} roughness={0.55} />
      </RoundedBox>
      {rows.map((row, ri) => (
        <group key={ri} position={[(ri === 1 ? 0.22 : ri === 2 ? 0.42 : 0), 0, ri * 0.4 - 0.58]}>
          {row.map((key, ki) => {
            const width = key === "SPACE" ? 3 : key === "ENTER" || key === "BACK" || key === "SHIFT" ? 1.15 : 0.62;
            const x = row.slice(0, ki).reduce((sum, item) => sum + (item === "SPACE" ? 3.12 : item === "ENTER" || item === "BACK" || item === "SHIFT" ? 1.27 : 0.72), 0) - (row.reduce((sum, item) => sum + (item === "SPACE" ? 3.12 : item === "ENTER" || item === "BACK" || item === "SHIFT" ? 1.27 : 0.72), 0) / 2);
            return (
              <group key={key} position={[x, pressed === key ? -0.08 : 0, 0]} onClick={() => onPress(key)} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "default")}>
                <RoundedBox args={[width, 0.18, 0.55]} radius={0.045} smoothness={3} castShadow>
                  <meshStandardMaterial
                    color={key === "ENTER" ? "#c69442" : pressed === key ? "#c69442" : worn.has(key) ? "#33454b" : "#263438"}
                    metalness={0.5}
                    roughness={worn.has(key) ? 0.28 : 0.45}
                  />
                </RoundedBox>
                <Text position={[0, 0.1, 0.28]} rotation={[-Math.PI / 2, 0, 0]} fontSize={key.length > 1 ? 0.075 : 0.13} color={worn.has(key) ? "#d8e4e0" : "#a8c1b9"} anchorX="center" anchorY="middle">
                  {key}
                </Text>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function DeskObjects() {
  const coneMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const m = coneMatRef.current;
    if (!m) return;
    // 灯光锥微闪：像是老灯泡接触不良
    m.opacity = 0.045 + Math.sin(clock.elapsedTime * 13) * 0.008 + Math.sin(clock.elapsedTime * 2.7) * 0.01;
  });
  return (
    <group>
      {/* 杯垫与琥珀圆盘：落在桌面上 */}
      <RoundedBox args={[0.75, 0.12, 0.75]} radius={0.1} smoothness={4} position={[-3.1, -0.78, 1.65]} castShadow>
        <meshStandardMaterial color="#b68a3c" metalness={0.62} roughness={0.3} />
      </RoundedBox>
      <mesh position={[-3.1, -0.67, 1.65]}>
        <cylinderGeometry args={[0.23, 0.23, 0.08, 16]} />
        <meshBasicMaterial color="#e8c675" />
      </mesh>
      {/* 咖啡杯与杯口：坐在杯垫旁 */}
      <mesh position={[3.15, -0.47, 1.55]} castShadow>
        <cylinderGeometry args={[0.4, 0.33, 0.75, 24]} />
        <meshStandardMaterial color="#5c3028" roughness={0.62} />
      </mesh>
      <mesh position={[3.15, -0.08, 1.55]}>
        <cylinderGeometry args={[0.25, 0.25, 0.02, 24]} />
        <meshBasicMaterial color="#c39a52" />
      </mesh>
      {/* 台灯：关节臂老台灯（底座-斜立柱-肘关节-横臂-灯罩-灯泡） */}
      <group position={[-2.8, -0.84, 0.4]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.035, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.3, 0.07, 20]} />
          <meshStandardMaterial color="#3a2c1c" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0.16, 0.1, 0]}>
          <boxGeometry args={[0.1, 0.05, 0.08]} />
          <meshStandardMaterial color="#c69442" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-0.075, 0.5, 0]} rotation={[0, 0, -0.16]} castShadow>
          <cylinderGeometry args={[0.032, 0.032, 0.95, 10]} />
          <meshStandardMaterial color="#aa7930" metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[-0.23, 0.97, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#8a6428" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[-0.025, 1.115, 0]} rotation={[0, 0, -0.955]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.55, 10]} />
          <meshStandardMaterial color="#aa7930" metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0.2, 1.24, 0]} rotation={[0, 0, 0.35]} castShadow>
          <coneGeometry args={[0.3, 0.4, 24, 1, true]} />
          <meshStandardMaterial color="#9a6324" metalness={0.35} roughness={0.5} emissive="#7c4312" emissiveIntensity={0.7} side={THREE.DoubleSide} />
        </mesh>
        {/* 灯泡 */}
        <mesh position={[0.26, 1.08, 0]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial color="#ffd98c" emissive="#ffc973" emissiveIntensity={2.2} />
        </mesh>
        {/* 体积光锥：老灯泡的光柱 */}
        <mesh position={[0.26, 0.5, 0.05]} rotation={[0, 0, 0.35]}>
          <coneGeometry args={[0.55, 1.25, 24, 1, true]} />
          <meshBasicMaterial ref={coneMatRef} color="#f2b94f" transparent opacity={0.05} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <pointLight position={[0.26, 0.95, 0.1]} intensity={10} distance={3.2} color="#f2b94f" />
      </group>
    </group>
  );
}

/** 桌面杂物：红头机密文件堆 + 咖啡渍圈 */
function DeskClutter() {
  return (
    <group>
      {[
        { pos: [-1.5, -0.79, 1.3] as const, rot: 0.12 },
        { pos: [-1.32, -0.7, 1.16] as const, rot: -0.18, tilt: 0.05 },
      ].map((f, i) => (
        <group key={i} position={[f.pos[0], f.pos[1], f.pos[2]]} rotation={[-Math.PI / 2 + (f.tilt ?? 0), 0, f.rot]}>
          <mesh castShadow>
            <boxGeometry args={[0.68, 0.5, 0.09]} />
            <meshStandardMaterial color="#7c2f22" roughness={0.85} />
          </mesh>
          {i === 0 && (
            <Text position={[0, 0, 0.05]} fontSize={0.07} color="#e8dcc0" anchorX="center">
              机密卷宗
            </Text>
          )}
        </group>
      ))}
      <mesh position={[3.0, -0.834, 1.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.14, 24]} />
        <meshStandardMaterial color="#2e1d12" transparent opacity={0.75} roughness={1} />
      </mesh>
    </group>
  );
}

/** 地面散落的调查纸页 */
function FloorPapers() {
  const papers = useMemo(
    () => [
      { pos: [-1.3, -2.27, 2.7] as const, rot: 0.7 },
      { pos: [1.7, -2.27, 3.2] as const, rot: -0.4 },
      { pos: [4.2, -2.27, 2.2] as const, rot: 1.2 },
      { pos: [-3.4, -2.27, 3.6] as const, rot: -0.9 },
      { pos: [0.4, -2.27, -0.4] as const, rot: 0.25 },
    ],
    [],
  );
  return (
    <group>
      {papers.map((p, i) => (
        <mesh key={i} position={[p.pos[0], p.pos[1], p.pos[2]]} rotation={[-Math.PI / 2, 0, p.rot]} receiveShadow>
          <planeGeometry args={[0.55, 0.75]} />
          <meshStandardMaterial color="#c9bda0" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** 确定性伪随机（保证每次刷新布局一致） */
const seeded = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/** 档案柜：金属柜身 + 四层抽屉（带把手与标签槽） */
function FilingCabinet({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.92, 1.9, 0.72]} />
        <meshStandardMaterial color="#2c3538" metalness={0.55} roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((d) => {
        const y = -0.66 + d * 0.45;
        return (
          <group key={d} position={[0, y, 0.37]}>
            <mesh castShadow>
              <boxGeometry args={[0.82, 0.4, 0.05]} />
              <meshStandardMaterial color="#242c2f" metalness={0.5} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.08, 0.03]}>
              <boxGeometry args={[0.3, 0.1, 0.012]} />
              <meshStandardMaterial color="#c9bda0" roughness={1} />
            </mesh>
            <mesh position={[0, -0.06, 0.045]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
              <meshStandardMaterial color="#9a938a" metalness={0.8} roughness={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** 书架：塞满案卷与书（确定性伪随机高度/颜色/倾斜），顶上摞文件盒 */
function Bookshelf({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const BOOK_COLORS = ["#5a3a2a", "#6e4a30", "#4a3520", "#613530", "#3f4a3a", "#54423a", "#705535"];
  const shelves = [0, 1, 2];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 框架 */}
      <mesh position={[0, 1.5, -0.22]} castShadow>
        <boxGeometry args={[2.2, 3.0, 0.06]} />
        <meshStandardMaterial color="#3a2c1c" roughness={0.85} />
      </mesh>
      {[-1.08, 1.08].map((sx) => (
        <mesh key={sx} position={[sx, 1.5, 0]} castShadow>
          <boxGeometry args={[0.08, 3.0, 0.48]} />
          <meshStandardMaterial color="#3a2c1c" roughness={0.85} />
        </mesh>
      ))}
      {shelves.map((s) => (
        <mesh key={s} position={[0, 0.12 + s * 0.92, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.1, 0.06, 0.44]} />
          <meshStandardMaterial color="#33261a" roughness={0.85} />
        </mesh>
      ))}
      {/* 每层塞书 */}
      {shelves.map((s) => {
        const shelfY = 0.15 + s * 0.92;
        let x = -0.98;
        const books: Array<{ x: number; h: number; w: number; color: string; lean: number }> = [];
        let seed = s * 31 + 7;
        while (x < 0.92) {
          const w = 0.1 + seeded(seed++) * 0.07;
          if (seeded(seed++) > 0.82) {
            x += 0.12 + seeded(seed++) * 0.2; // 空缺
            continue;
          }
          books.push({
            x,
            h: 0.5 + seeded(seed++) * 0.26,
            w,
            color: BOOK_COLORS[Math.floor(seeded(seed++) * BOOK_COLORS.length)],
            lean: 0,
          });
          x += w + 0.015;
        }
        if (books.length > 3) books[books.length - 1].lean = 0.32; // 末尾一本斜靠
        return (
          <group key={`b${s}`}>
            {books.map((b, i) => (
              <mesh
                key={i}
                position={[b.x + b.w / 2 + (b.lean ? 0.12 : 0), shelfY + b.h / 2 - (b.lean ? 0.1 : 0), 0]}
                rotation={[0, 0, b.lean]}
                castShadow
              >
                <boxGeometry args={[b.w, b.h, 0.32]} />
                <meshStandardMaterial color={b.color} roughness={0.9} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* 架顶文件盒 */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[-0.6 + i * 0.75, 3.1, 0]} rotation={[0, i ? 0.12 : -0.08, 0]} castShadow>
          <boxGeometry args={[0.62, 0.18, 0.4]} />
          <meshStandardMaterial color="#7c2f22" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** 衣帽架 + 费多拉帽（本屋主人的签名道具） */
function HatStand({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, -2.26, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.08, 20]} />
        <meshStandardMaterial color="#2a2018" roughness={0.7} />
      </mesh>
      <mesh position={[0, -1.25, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 2.0, 10]} />
        <meshStandardMaterial color="#3a2c1c" roughness={0.6} />
      </mesh>
      {[0, 1, 2].map((h) => (
        <mesh key={h} position={[Math.cos(h * 2.1) * 0.16, -0.45, Math.sin(h * 2.1) * 0.16]} rotation={[Math.sin(h * 2.1) * 0.9, 0, -Math.cos(h * 2.1) * 0.9]}>
          <cylinderGeometry args={[0.02, 0.025, 0.3, 8]} />
          <meshStandardMaterial color="#3a2c1c" roughness={0.6} />
        </mesh>
      ))}
      {/* 费多拉帽 */}
      <group position={[0, -0.28, 0]} rotation={[0.06, 0.5, 0.04]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.36, 0.38, 0.035, 24]} />
          <meshStandardMaterial color="#4a3826" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.24, 0.22, 20]} />
          <meshStandardMaterial color="#4a3826" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.045, 0]}>
          <cylinderGeometry args={[0.235, 0.235, 0.04, 20]} />
          <meshStandardMaterial color="#2e1f2b" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/** 窗下老式暖气片：竖鳍 + 上下横管 */
function Radiator({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {Array.from({ length: 9 }, (_, i) => (
        <RoundedBox key={i} args={[0.13, 1.05, 0.3]} radius={0.03} smoothness={3} position={[-1.0 + i * 0.25, -1.72, 0]} castShadow>
          <meshStandardMaterial color="#3a3f42" metalness={0.5} roughness={0.6} />
        </RoundedBox>
      ))}
      {[1.17, -2.24].map((py) => (
        <mesh key={py} position={[0, py, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 2.3, 10]} />
          <meshStandardMaterial color="#33383b" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** 废纸篓 + 揉皱的草稿纸团 */
function TrashCorner({ position }: { position: [number, number, number] }) {
  const crumples = useMemo(
    () => [
      { pos: [0.5, -2.22, 0.3] as const, r: 0.11 },
      { pos: [0.72, -2.24, -0.1] as const, r: 0.08 },
      { pos: [0.2, -2.23, 0.62] as const, r: 0.09 },
      { pos: [0.05, -1.72, 0] as const, r: 0.1 }, // 挂在篓口
    ],
    [],
  );
  return (
    <group position={position}>
      <mesh position={[0, -1.95, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.24, 0.7, 18, 1, true]} />
        <meshStandardMaterial color="#1d2427" metalness={0.4} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -1.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.02, 8, 20]} />
        <meshStandardMaterial color="#2a3336" metalness={0.6} roughness={0.4} />
      </mesh>
      {crumples.map((c, i) => (
        <mesh key={i} position={[c.pos[0], c.pos[1], c.pos[2]]} castShadow>
          <icosahedronGeometry args={[c.r, 0]} />
          <meshStandardMaterial color="#cfc4a8" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** 桌上老式转盘电话 */
function RotaryPhone({ position }: { position: [number, number, number] }) {
  const cord = useMemo(() => {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      pts.push([
        -0.32 - t * 0.12,
        0.05 + Math.sin(i * 1.1) * 0.035 + t * 0.1,
        -0.1 + t * 0.05,
      ]);
    }
    return pts;
  }, []);
  return (
    <group position={position} rotation={[0, 0.4, 0]}>
      <RoundedBox args={[0.5, 0.16, 0.42]} radius={0.05} smoothness={4} castShadow>
        <meshStandardMaterial color="#1a1a1c" roughness={0.35} metalness={0.15} />
      </RoundedBox>
      {/* 转盘 */}
      <mesh position={[0, 0.1, 0.06]} rotation={[-Math.PI / 2.6, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.03, 24]} />
        <meshStandardMaterial color="#26262a" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.13, 0.1]} rotation={[-Math.PI / 2.6, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.035, 14]} />
        <meshStandardMaterial color="#c69442" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 听筒架在叉簧上 */}
      <mesh position={[0, 0.2, -0.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.055, 0.42, 6, 12]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.3} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.24, 0.13, -0.1]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#151517" roughness={0.3} />
        </mesh>
      ))}
      <Line points={cord} color="#101012" lineWidth={1.4} />
    </group>
  );
}

/** 墙上挂钟：停在凌晨 2:47——案发时刻 */
function WallClock({ position }: { position: [number, number, number] }) {
  const ticks = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
  const hourAngle = ((2 + 47 / 60) / 12) * Math.PI * 2;
  const minuteAngle = (47 / 60) * Math.PI * 2;
  return (
    <group position={position}>
      <mesh>
        <torusGeometry args={[0.34, 0.045, 10, 28]} />
        <meshStandardMaterial color="#8a6428" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[0.32, 28]} />
        <meshStandardMaterial color="#d8cfb8" roughness={0.9} />
      </mesh>
      {ticks.map((a, i) => (
        <mesh key={i} position={[Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.02]} rotation={[0, 0, -a]}>
          <boxGeometry args={[0.016, 0.05, 0.008]} />
          <meshStandardMaterial color="#3a2f22" />
        </mesh>
      ))}
      <mesh position={[Math.sin(hourAngle) * 0.09, Math.cos(hourAngle) * 0.09, 0.025]} rotation={[0, 0, -hourAngle]}>
        <boxGeometry args={[0.028, 0.19, 0.008]} />
        <meshStandardMaterial color="#2c241a" />
      </mesh>
      <mesh position={[Math.sin(minuteAngle) * 0.13, Math.cos(minuteAngle) * 0.13, 0.025]} rotation={[0, 0, -minuteAngle]}>
        <boxGeometry args={[0.02, 0.27, 0.008]} />
        <meshStandardMaterial color="#2c241a" />
      </mesh>
    </group>
  );
}

/** 墙上裱框的侦探执照 */
function FramedLicense({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0.03]}>
      <mesh castShadow>
        <boxGeometry args={[0.68, 0.52, 0.05]} />
        <meshStandardMaterial color="#6b4a20" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.56, 0.4]} />
        <meshStandardMaterial color="#d8cdb4" roughness={0.95} />
      </mesh>
      <Text position={[0, 0.1, 0.036]} fontSize={0.052} color="#4a3520" anchorX="center">
        LICENSED INVESTIGATOR
      </Text>
      <Text position={[0, -0.02, 0.036]} fontSize={0.042} color="#6b5335" anchorX="center">
        注册侦探 · 编号 0213
      </Text>
      <Line
        points={[[-0.2, -0.1, 0.037], [0.2, -0.13, 0.037]]}
        color="#8a7a5c"
        lineWidth={1}
      />
    </group>
  );
}

/** 地上的旧案纸箱堆 */
function FloorBoxes({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, 0.3, 0]}>
      <mesh position={[0, -2.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.6, 0.75]} />
        <meshStandardMaterial color="#8a6d4a" roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.24, -1.68, 0]} rotation={[0, s * 0.7, 0]} castShadow>
          <boxGeometry args={[0.46, 0.02, 0.75]} />
          <meshStandardMaterial color="#94764f" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0.06, -1.52, 0.05]} rotation={[0, -0.35, 0]} castShadow>
        <boxGeometry args={[0.66, 0.36, 0.5]} />
        <meshStandardMaterial color="#7d6242" roughness={0.95} />
      </mesh>
      <Text position={[0, -2.0, 0.38]} fontSize={0.07} color="#3d2c18" anchorX="center">
        旧案 1998
      </Text>
    </group>
  );
}

/** 桌面散落的调查文件 */
function DeskPapers() {
  const papers = useMemo(
    () => [
      { pos: [-1.6, -0.82, 1.9] as const, rot: 0.18, note: "REPORT #47" },
      { pos: [-1.15, -0.82, 1.75] as const, rot: -0.32, note: "WITNESS" },
      { pos: [1.9, -0.82, 0.9] as const, rot: 0.55, note: "HOT LIST" },
    ],
    [],
  );
  return (
    <group>
      {papers.map((p) => (
        <group key={p.note} position={[p.pos[0], p.pos[1], p.pos[2]]} rotation={[-Math.PI / 2, 0, p.rot]}>
          <mesh castShadow>
            <planeGeometry args={[0.52, 0.72]} />
            <meshStandardMaterial color="#cfc4a8" roughness={0.95} />
          </mesh>
          <Text position={[0, 0.22, 0.005]} fontSize={0.055} color="#6b5b3e" anchorX="center">
            {p.note}
          </Text>
          <Line points={[[-0.18, 0.05, 0.006], [0.18, 0.02, 0.006], [0.14, -0.12, 0.006]]} color="#8a7a5c" lineWidth={1} />
        </group>
      ))}
    </group>
  );
}

/** 机械鼠标 + 线缆 */
function ComputerMouse() {
  return (
    <group>
      <RoundedBox args={[0.34, 0.1, 0.5]} radius={0.045} smoothness={4} position={[2.0, -0.79, 1.85]} rotation={[0, -0.3, 0]} castShadow>
        <meshStandardMaterial color="#1d272b" roughness={0.5} metalness={0.3} />
      </RoundedBox>
      <Line
        points={[[2.05, -0.75, 1.7], [2.5, -0.76, 1.3], [2.9, -0.5, 0.6], [2.4, 0.9, -0.2]]}
        color="#10161a"
        lineWidth={1.5}
      />
    </group>
  );
}

/** 雨夜窗户：月光冷蓝 + 闪电时爆亮（材质由 Lightning 调制） */
function WindowPane({ matRef }: { matRef: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  return (
    <group position={[3.6, 3.0, -5.93]}>
      {/* 窗框 */}
      <mesh>
        <boxGeometry args={[2.6, 2.2, 0.1]} />
        <meshStandardMaterial color="#0d1417" roughness={0.8} />
      </mesh>
      {/* 玻璃：冷蓝月光 */}
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[2.3, 1.9]} />
        <meshStandardMaterial ref={matRef} color="#0a1a26" emissive="#3d6d8f" emissiveIntensity={0.5} roughness={0.15} metalness={0.4} />
      </mesh>
      {/* 十字窗棂 */}
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[0.05, 1.9, 0.03]} />
        <meshStandardMaterial color="#0d1417" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[2.3, 0.05, 0.03]} />
        <meshStandardMaterial color="#0d1417" roughness={0.8} />
      </mesh>
      {/* 月光渗入 */}
      <pointLight position={[0, 0, 1.2]} intensity={5} distance={7} color="#4a7fa0" />
    </group>
  );
}

/** 软木板情报墙：照片 + 图钉 + 红线——侦探片的招牌布景 */
function Corkboard() {
  const photos = useMemo(
    () => [
      { pos: [-0.85, 0.45] as const, rot: 0.08 },
      { pos: [0.0, 0.52] as const, rot: -0.12 },
      { pos: [0.82, 0.4] as const, rot: 0.16 },
      { pos: [-0.6, -0.42] as const, rot: -0.06 },
      { pos: [0.62, -0.48] as const, rot: 0.1 },
    ],
    [],
  );
  const pin = (x: number, y: number) => [x, y + 0.26, 0.065] as [number, number, number];
  return (
    <group position={[-3.7, 2.7, -5.9]}>
      <RoundedBox args={[2.7, 1.8, 0.07]} radius={0.02} smoothness={3} castShadow>
        <meshStandardMaterial color="#7a5433" roughness={0.95} />
      </RoundedBox>
      {/* 边框 */}
      <Line points={[[-1.35, 0.9, 0.04], [1.35, 0.9, 0.04], [1.35, -0.9, 0.04], [-1.35, -0.9, 0.04], [-1.35, 0.9, 0.04]]} color="#4a3320" lineWidth={3} />
      <Text position={[0, 0.78, 0.05]} fontSize={0.11} color="#3d2a18" anchorX="center">
        CASE WALL / 未结案件
      </Text>
      {photos.map((p, i) => (
        <group key={i} position={[p.pos[0], p.pos[1], 0.05]} rotation={[0, 0, p.rot]}>
          <mesh castShadow>
            <planeGeometry args={[0.4, 0.5]} />
            <meshStandardMaterial color="#d3c8ad" roughness={0.95} />
          </mesh>
          {/* 照片里的深色区块：像监控截帧 */}
          <mesh position={[0, 0.05, 0.004]}>
            <planeGeometry args={[0.3, 0.22]} />
            <meshStandardMaterial color="#5a5142" roughness={1} />
          </mesh>
          {/* 图钉 */}
          <mesh position={[0, 0.26, 0.015]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.03, 10]} />
            <meshBasicMaterial color={i % 2 ? "#c1553f" : "#d4a24e"} />
          </mesh>
        </group>
      ))}
      {/* 红线：把图钉串成调查网络 */}
      <Line points={[pin(-0.85, 0.45), pin(0, 0.52), pin(0.82, 0.4), pin(0.62, -0.48)]} color="#c1553f" lineWidth={1.2} />
      <Line points={[pin(-0.85, 0.45), pin(-0.6, -0.42), pin(0.62, -0.48)]} color="#c1553f" lineWidth={1.2} />
    </group>
  );
}

/** 台灯光柱里的漂浮尘埃 */
function DustMotes() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      arr[i * 3] = -2.8 + (Math.random() - 0.5) * 1.3;
      arr[i * 3 + 1] = -1.8 + Math.random() * 1.9;
      arr[i * 3 + 2] = 0.4 + (Math.random() - 0.5) * 1.2;
    }
    return arr;
  }, []);
  useFrame(({ clock }) => {
    const pts = ref.current;
    if (!pts) return;
    pts.rotation.y = Math.sin(clock.elapsedTime * 0.12) * 0.35;
    pts.position.y = Math.sin(clock.elapsedTime * 0.3) * 0.05;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#f0d9a0" transparent opacity={0.4} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

/** 开场运镜：待机微晃（呼吸感）→ 按 ENTER 后推近屏幕，抵达后切入 OS */
function CameraRig({ entering, onArrived }: { entering: boolean; onArrived: () => void }) {
  const { camera } = useThree();
  const progress = useRef(0);
  const arrived = useRef(false);
  const from = useRef(new THREE.Vector3(0, 2.85, 11.8));
  const to = useRef(new THREE.Vector3(0, 1.9, 3.0));
  const look = useRef(new THREE.Vector3(0, 0.9, -0.8));
  const lookTo = useRef(new THREE.Vector3(0, 1.66, -0.35));

  useFrame(({ clock }, delta) => {
    if (!entering) {
      const t = clock.elapsedTime;
      camera.position.set(
        from.current.x + Math.sin(t * 0.32) * 0.06,
        from.current.y + Math.sin(t * 0.24) * 0.04,
        from.current.z,
      );
      camera.lookAt(look.current);
      return;
    }
    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta / 1.35);
      const t = 1 - Math.pow(1 - progress.current, 3); // easeOutCubic
      camera.position.lerpVectors(from.current, to.current, t);
      const lookAt = look.current.clone().lerp(lookTo.current, t);
      camera.lookAt(lookAt);
    } else if (!arrived.current) {
      arrived.current = true;
      window.setTimeout(onArrived, 450); // 停顿一拍再切屏
    }
  });
  return null;
}
