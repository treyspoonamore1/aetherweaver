// Procedural Web Audio API Sound Engine for AETHERWEAVER

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  public volume: number = 0.45;
  public healTicksEnabled: boolean = true;
  public ampTicksEnabled: boolean = true;
  public lootChimesEnabled: boolean = true;
  private lastHealTick = 0;
  private lastAmpTick = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Overwatch-style rising-pitch healing tick as ally HP approaches 100%
  public playHealTick(hpRatio: number, isFullJustNow = false) {
    if (!this.healTicksEnabled && !isFullJustNow) return;
    const nowMs = performance.now();
    if (!isFullJustNow && nowMs - this.lastHealTick < 115) return;
    this.lastHealTick = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const clamped = Math.max(0, Math.min(1, hpRatio));
    // Pitch rises smoothly from 340Hz (critical) up to 780Hz (full HP)
    const baseFreq = 340 + clamped * 440;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    if (isFullJustNow) {
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.11);
    } else {
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.06, now + 0.07);
    }

    const vol = (isFullJustNow ? 0.14 : 0.055) * this.volume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isFullJustNow ? 0.16 : 0.085));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isFullJustNow ? 0.17 : 0.09));
  }

  // Overwatch Mercy/Baptiste damage-boost hit-marker tick!
  public playAmpHitTick(isCrit: boolean) {
    if (!this.ampTicksEnabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastAmpTick < 65) return;
    this.lastAmpTick = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isCrit ? 'triangle' : 'sine';
    const startFreq = isCrit ? 1320 : 920;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(isCrit ? 1960 : 1240, now + 0.055);

    const vol = (isCrit ? 0.13 : 0.065) * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Kiriko Suzu / Cleanse sacred bell chime
  public playCleanseChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [880, 1318.5, 1760, 2637];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.02);

      const peak = (0.14 / (idx + 1)) * this.volume;
      gain.gain.setValueAtTime(0.0001, now + idx * 0.02);
      gain.gain.linearRampToValueAtTime(peak, now + idx * 0.02 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48 + idx * 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.02);
      osc.stop(now + 0.56);
    });
  }

  // Aether Charge banked — Resonance hit its ceiling. Bright crystalline double-ding.
  public playChargeBank() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [1046.5, 1567.98].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.05);
      gain.gain.setValueAtTime(0.0001, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.13 * this.volume, now + i * 0.05 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4 + i * 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + 0.45 + i * 0.05);
    });
  }

  // Resonant Cascade unleashed — sweeping rising whoosh into a bright chime.
  public playCascade() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Whoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.35);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08 * this.volume, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.52);
    // Bright chime
    [659.25, 830.61, 987.77].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, now + 0.3);
      g.gain.setValueAtTime(0.0001, now + 0.3);
      g.gain.linearRampToValueAtTime(0.1 * this.volume, now + 0.3 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9 + i * 0.04);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + 0.3);
      o.stop(now + 0.95 + i * 0.04);
    });
  }

  // Clutch Lifesaver! (Saving an ally below 22% HP)
  public playLifesaverChord() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.035);
      gain.gain.setValueAtTime(0.0001, now + i * 0.035);
      gain.gain.linearRampToValueAtTime(0.11 * this.volume, now + i * 0.035 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.035);
      osc.stop(now + 0.48);
    });
  }

  // Guardian Angelic Dash slipstream
  public playDash() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13 * this.volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Consecrated Sigil placement
  public playSigilCast() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [293.66, 440, 587.33].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.03, now + 0.35);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09 * this.volume, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  // PoE Aura Reservation toggle resonance
  public playAuraToggle(activating: boolean, activeCount: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const root = activating ? 196 + activeCount * 28 : 260;
    const ratios = activating ? [1, 1.25, 1.5, 2] : [1.5, 1];
    ratios.forEach((r, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(root * r, now);
      if (!activating) {
        osc.frequency.exponentialRampToValueAtTime(root * r * 0.72, now + 0.22);
      }
      const peak = (idx === 0 ? 0.06 : 0.08) * this.volume;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  // Ultimate: Sanctuary Apotheosis!
  public playUltimate() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 1046.5];
    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f * 0.96, now);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.18);
      const peak = (idx < 2 ? 0.07 : 0.1) * this.volume;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  // PoE Iconic Loot Filter Drop Chime (Rare / Unique / High Currency)
  public playLootFilter(tier: 'magic' | 'rare' | 'unique' | 'currency') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (tier === 'unique' || tier === 'currency') {
      // Iconic PoE high-value SCHWING metallic resonance!
      const freqs = tier === 'unique' ? [587.33, 880, 1174.66, 1760] : [659.25, 987.77, 1318.5, 1975.5];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.018);
        gain.gain.setValueAtTime(0.001, now + idx * 0.018);
        gain.gain.linearRampToValueAtTime((0.16 / (idx * 0.6 + 1)) * this.volume, now + idx * 0.018 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.018);
        osc.stop(now + 0.68);
      });
    } else if (tier === 'rare') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(1108.7, now + 0.09);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11 * this.volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
    }
  }

  public playCraftSlam() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);
    gain.gain.setValueAtTime(0.16 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
    this.playLootFilter('rare');
  }
}

export const sound = new SoundEngine();
