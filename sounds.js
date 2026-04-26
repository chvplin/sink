(function () {
  class GameSound {
    constructor() {
      this.enabled = true;
      this.ctx = null;
      this.master = null;
      this.unlocked = false;
      this._unlockBound = false;
    }

    setEnabled(enabled) {
      this.enabled = !!enabled;
      if (this.enabled) this.ensureUnlocked();
    }

    ensureUnlocked() {
      if (this.unlocked || this._unlockBound) return;
      this._unlockBound = true;
      const unlock = () => {
        this.init();
        if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        this.unlocked = true;
        window.removeEventListener("pointerdown", unlock, true);
        window.removeEventListener("keydown", unlock, true);
      };
      window.addEventListener("pointerdown", unlock, true);
      window.addEventListener("keydown", unlock, true);
    }

    init() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }

    play(eventName, data = {}) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx || !this.master) return;
      const now = this.ctx.currentTime;
      switch (eventName) {
        case "ui-click":
          this.tone(now, 560, 0.03, "triangle", 0.11);
          break;
        case "toggle-on":
          this.tone(now, 420, 0.04, "sine", 0.1);
          this.tone(now + 0.05, 620, 0.06, "sine", 0.12);
          break;
        case "toggle-off":
          this.tone(now, 540, 0.05, "sine", 0.1);
          this.tone(now + 0.05, 320, 0.07, "sine", 0.08);
          break;
        case "bet-place":
          this.tone(now, 260, 0.05, "square", 0.1);
          this.tone(now + 0.05, 320, 0.06, "square", 0.08);
          break;
        case "round-start":
          this.tone(now, 330, 0.08, "sawtooth", 0.08);
          this.tone(now + 0.08, 440, 0.09, "sawtooth", 0.08);
          this.tone(now + 0.16, 550, 0.1, "sawtooth", 0.08);
          break;
        case "countdown":
          this.tone(now, 880, 0.03, "square", 0.07);
          break;
        case "cashout":
          this.tone(now, 520, 0.06, "triangle", 0.09);
          this.tone(now + 0.06, 760, 0.08, "triangle", 0.12);
          this.tone(now + 0.15, 980, 0.1, "triangle", 0.12);
          break;
        case "crash":
          this.noise(now, 0.22, 0.16);
          this.tone(now, 110, 0.25, "sawtooth", 0.09, 70);
          break;
        case "milestone":
          this.tone(now, 690, 0.04, "sine", 0.09);
          this.tone(now + 0.05, 920, 0.07, "sine", 0.1);
          break;
        case "join":
          this.tone(now, 610, 0.05, "triangle", 0.09);
          this.tone(now + 0.06, 740, 0.05, "triangle", 0.09);
          break;
        case "chat-send":
          this.tone(now, 470, 0.03, "sine", 0.07);
          this.tone(now + 0.04, 570, 0.03, "sine", 0.07);
          break;
        case "toast":
          this.tone(now, 500, 0.025, "triangle", 0.06);
          break;
        case "warning":
          this.tone(now, 300, 0.05, "square", 0.08);
          this.tone(now + 0.06, 260, 0.07, "square", 0.08);
          break;
        case "panel-open":
          this.tone(now, 350, 0.025, "triangle", 0.05);
          this.tone(now + 0.03, 470, 0.03, "triangle", 0.05);
          break;
        default:
          this.tone(now, 440, 0.02, "sine", 0.04);
      }
    }

    tone(start, freq, dur, type, gain, endFreq) {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, start);
      if (endFreq && endFreq > 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
      }
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain || 0.08), start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }

    noise(start, dur, gain) {
      if (!this.ctx || !this.master) return;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2) - 1;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 1400;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, gain || 0.12), start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      source.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      source.start(start);
      source.stop(start + dur + 0.01);
    }
  }

  window.GameSound = GameSound;
})();
