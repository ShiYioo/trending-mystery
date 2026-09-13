// 结案战绩海报（Canvas 2D 程序绘制，零图片资源——刘看山用官方动图首帧）：
// 既是玩家成绩单又是游戏宣传图：TM-01 档案纸美学 + 已结案红章 + 分项读数 + 圈子链接。

export interface PosterInput {
  questionTitle: string;
  caseId: string;
  playerName: string;
  grade: string;
  gradeTitle: string;
  total: number;
  breakdown: { consensus: number; evidence: number; statement: number };
  /** 争议点风向：每条取最主流立场与权重百分比 */
  winds: Array<{ issue: string; label: string; pct: number }>;
  siteUrl: string;
}

const W = 1080;
const H = 1350;
const INK = "#070b0d";
const PANEL = "#0e1518";
const BRASS = "#d4a24e";
const BRASS_DIM = "#8a6d3a";
const SIGNAL = "#8fe4d2";
const BLOOD = "#c05555";
const PAPER = "#e8e2d0";
const PAPER_DIM = "#9a9484";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** CJK 按像素宽度折行，超行截断加省略号 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    } else {
      line += ch;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width >= maxW - 8) lines[maxLines - 1] = last.slice(0, -1) + "…";
  }
  return lines;
}

/** 加载刘看山立绘：用 GIF 首帧抽出的 12KB PNG（原 GIF 973KB，慢网必超时）；
 *  2.5 秒上限——慢网下宁可不画也不许海报卡死 */
function loadFox(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (value: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 2500);
    img.onload = () => done(img.naturalWidth > 0 ? img : null);
    img.onerror = () => done(null);
    img.src = "/liukanshan/fox.png";
  });
}

export async function renderPoster(input: PosterInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 底色 + 扫描线 + 暗角
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(143,228,210,0.025)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  const vign = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);

  // 双层档案框
  ctx.strokeStyle = BRASS_DIM;
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 1;
  ctx.strokeRect(56, 56, W - 112, H - 112);
  ctx.setLineDash([]);

  ctx.textAlign = "center";

  // 头部：标题字
  ctx.fillStyle = BRASS;
  ctx.font = 'bold 92px Georgia, "Times New Roman", "STSong", "SimSun", serif';
  ctx.fillText("热搜疑云", W / 2, 178);
  ctx.fillStyle = PAPER_DIM;
  ctx.font = "26px Consolas, monospace";
  ctx.fillText("T R E N D I N G   M Y S T E R Y", W / 2, 226);
  ctx.strokeStyle = BRASS_DIM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, 258);
  ctx.lineTo(W - 200, 258);
  ctx.stroke();

  // 案件标题
  ctx.textAlign = "left";
  ctx.fillStyle = PAPER;
  ctx.font = 'bold 42px Georgia, "STSong", "SimSun", serif';
  const titleLines = wrapText(ctx, input.questionTitle, W - 260, 3);
  titleLines.forEach((line, i) => ctx.fillText(line, 130, 330 + i * 58));

  // 侦探行
  const detectiveY = 330 + titleLines.length * 58 + 44;
  ctx.fillStyle = SIGNAL;
  ctx.font = 'bold 34px Georgia, "STSong", "SimSun", serif';
  ctx.fillText(`侦探 · ${input.playerName}`, 130, detectiveY);
  ctx.textAlign = "right";
  ctx.fillStyle = PAPER_DIM;
  ctx.font = "24px Consolas, monospace";
  ctx.fillText(
    `${new Date().toLocaleDateString("zh-CN")} · 案卷 ${input.caseId}`,
    W - 130,
    detectiveY,
  );
  ctx.textAlign = "left";

  // 成绩面板
  const panelY = detectiveY + 44;
  const panelH = 300;
  ctx.fillStyle = PANEL;
  roundRect(ctx, 120, panelY, W - 240, panelH, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(212,162,78,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 总分
  ctx.fillStyle = BRASS;
  ctx.font = 'bold 150px Georgia, serif';
  ctx.fillText(String(input.total), 190, panelY + 195);
  ctx.font = 'bold 30px Georgia, "STSong", serif';
  ctx.fillStyle = PAPER_DIM;
  ctx.fillText(`总分 / 100 · ${input.grade} 级 ${input.gradeTitle}`, 190, panelY + 248);

  // 三项分读数条
  const bars = [
    { label: "共识吻合", value: input.breakdown.consensus },
    { label: "证据指认", value: input.breakdown.evidence },
    { label: "结案陈词", value: input.breakdown.statement },
  ];
  const barX = 560;
  bars.forEach((b, i) => {
    const y = panelY + 78 + i * 74;
    ctx.fillStyle = PAPER_DIM;
    ctx.font = '26px Georgia, "STSong", serif';
    ctx.fillText(b.label, barX, y - 12);
    ctx.fillStyle = "rgba(232,226,208,0.12)";
    ctx.fillRect(barX, y, 300, 14);
    ctx.fillStyle = i === 0 ? BRASS : i === 1 ? SIGNAL : PAPER_DIM;
    ctx.fillRect(barX, y, Math.max(4, (Math.min(100, b.value) / 100) * 300), 14);
    ctx.textAlign = "right";
    ctx.fillStyle = PAPER;
    ctx.font = "24px Consolas, monospace";
    ctx.fillText(String(Math.round(b.value)), barX + 380, y + 14);
    ctx.textAlign = "left";
  });

  // 已结案红章（压在面板右上角）
  ctx.save();
  ctx.translate(W - 260, panelY + 96);
  ctx.rotate(-0.22);
  ctx.strokeStyle = BLOOD;
  ctx.lineWidth = 7;
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = BLOOD;
  ctx.textAlign = "center";
  ctx.font = 'bold 88px Georgia, serif';
  ctx.fillText(input.grade, 0, 14);
  ctx.font = 'bold 30px Georgia, "STSong", serif';
  ctx.fillText("已 结 案", 0, 62);
  ctx.restore();

  // 社区风向
  const windY = panelY + panelH + 66;
  ctx.fillStyle = BRASS;
  ctx.font = 'bold 30px Georgia, "STSong", serif';
  ctx.fillText("社 区 风 向", 130, windY);
  ctx.strokeStyle = BRASS_DIM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(320, windY - 10);
  ctx.lineTo(W - 130, windY - 10);
  ctx.stroke();
  input.winds.slice(0, 3).forEach((w, i) => {
    const y = windY + 52 + i * 66;
    ctx.fillStyle = PAPER_DIM;
    ctx.font = '26px Georgia, "STSong", serif';
    ctx.fillText(wrapText(ctx, w.issue, 520, 1)[0], 130, y);
    ctx.textAlign = "right";
    ctx.fillStyle = SIGNAL;
    ctx.font = 'bold 28px Georgia, "STSong", serif';
    ctx.fillText(`${w.label} ${w.pct}%`, W - 130, y);
    ctx.textAlign = "left";
  });

  // 刘看山（右下签名位）
  const fox = await loadFox();
  const footY = H - 150;
  if (fox) {
    ctx.drawImage(fox, W - 330, footY - 170, 190, 190);
    ctx.textAlign = "center";
    ctx.fillStyle = PAPER_DIM;
    ctx.font = '20px Georgia, "STSong", serif';
    ctx.fillText("值班搭档 · 刘看山", W - 235, footY + 48);
  }

  // 底部：链接 + 口号
  ctx.textAlign = "center";
  ctx.fillStyle = SIGNAL;
  ctx.font = "bold 38px Consolas, monospace";
  ctx.fillText(input.siteUrl, fox ? 340 : W / 2, footY + 6);
  ctx.fillStyle = PAPER_DIM;
  ctx.font = '24px Georgia, "STSong", serif';
  ctx.fillText("今日热榜即案卷 · 来和刘看山一起破案", fox ? 340 : W / 2, footY + 52);

  // toBlob 带超时兜底：个别环境下回调不触发时退 dataURL 手搓 Blob，绘制永不悬停
  const blob = await new Promise<Blob | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    canvas.toBlob((b) => {
      clearTimeout(timer);
      resolve(b);
    }, "image/png");
  });
  if (blob) return blob;
  const dataUrl = canvas.toDataURL("image/png");
  const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}
