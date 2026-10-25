export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.22;
      master.connect(ctx.destination);
      const music = ctx.createGain();
      music.gain.value = 0.035;
      music.connect(master);
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = "sine";
      b.type = "triangle";
      a.frequency.value = 98;
      b.frequency.value = 146.8;
      a.connect(music);
      b.connect(music);
      a.start();
      b.start();
      this.ctx = ctx;
      this.master = master;
      this.music = music;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.22, this.ctx.currentTime, 0.02);
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide?: number) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(48, slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private noise(dur: number, vol: number, cutoff: number) {
    if (!this.ctx || !this.master || this.muted) return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  shoot() {
    this.tone(720 + Math.random() * 80, 0.07, "square", 0.05, 280);
  }

  hit() {
    this.tone(240, 0.05, "square", 0.04, 120);
  }

  boom() {
    this.noise(0.28, 0.2, 900);
    this.tone(140, 0.18, "sawtooth", 0.05, 50);
  }

  hurt() {
    this.noise(0.22, 0.16, 500);
    this.tone(90, 0.22, "sawtooth", 0.06, 42);
  }

  pickup(kind: "multi" | "shield" | "speed" | "life") {
    const freq = kind === "shield" ? 520 : kind === "speed" ? 740 : kind === "life" ? 880 : 640;
    this.tone(freq, 0.12, "triangle", 0.07, freq * 1.5);
  }

  wave() {
    this.tone(330, 0.16, "triangle", 0.05, 520);
  }
}

export const audio = new AudioBus();
