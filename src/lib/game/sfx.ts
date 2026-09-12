// Web Audio 合成音效：零音频资源，全部程序生成。首次用户交互后解锁 AudioContext。
// 打字嗒嗒 / 翻卡唰 / 印章咚 / 按钮咔 / 结案鼓——游戏感的声音层。

type SfxName = "click" | "type" | "flip" | "stamp" | "drum" | "reveal";

class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.enabled = localStorage.getItem("tm_sfx") !== "off";
    }
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem("tm_sfx", this.enabled ? "on" : "off");
    return this.enabled;
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    ctx: AudioContext,
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(
    ctx: AudioContext,
    dur: number,
    filterFrom: number,
    filterTo: number,
    gain: number,
  ): void {
    const t0 = ctx.currentTime;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(filterTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  play(name: SfxName): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    switch (name) {
      case "click":
        this.tone(ctx, 720, 420, 0.05, "square", 0.05);
        break;
      case "type":
        this.tone(ctx, 950 + Math.random() * 350, 600, 0.02, "triangle", 0.035);
        break;
      case "flip":
        this.noise(ctx, 0.1, 700, 2200, 0.1);
        break;
      case "stamp":
        this.tone(ctx, 150, 55, 0.22, "sine", 0.32);
        this.noise(ctx, 0.07, 300, 120, 0.16);
        break;
      case "drum":
        this.tone(ctx, 95, 48, 0.5, "sine", 0.26);
        break;
      case "reveal":
        this.tone(ctx, 520, 660, 0.09, "triangle", 0.07);
        this.tone(ctx, 660, 880, 0.12, "triangle", 0.07, 0.09);
        break;
    }
  }
}

export const sfx = new Sfx();
