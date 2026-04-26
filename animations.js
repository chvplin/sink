(function () {
  class GameAnimations {
    constructor(canvasId, tintId) {
      this.VISUAL_SPEED_MULTIPLIER = 3.8;
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext("2d");
      this.tintEl = document.getElementById(tintId);
      this.gameRoot = document.getElementById("game-root");
      this.width = 0;
      this.height = 0;

      this.scene = {
        multiplier: 1,
        depthNorm: 0,
        isActiveRound: false,
        didCrash: false,
        isLuckyRound: false,
        equippedSkin: null,
        crashShake: 0,
        cosmeticTrail: "default",
        cosmeticCrash: "default",
        cosmeticDiver: "default",
        visibleSubmarines: []
      };

      this.submarine = {
        x: 0.5,
        y: 0.22,
        tilt: 0
      };

      /** Smoothed 0–1 depth used for parallax / tint (matches visual depth cap) */
      this.smoothedVisualDepth = 0;

      this.bubbles = [];
      this.ambientParticles = [];
      this.cashoutDivers = [];
      this.explosionParticles = [];
      this.directionalParticles = [];

      this.lastFrameTs = 0;
      this.worldScrollY = 0;
      this.initAmbientParticles(80);
      this.initDirectionalParticles(50);
      this.resize();
      window.addEventListener("resize", () => this.resize());
      requestAnimationFrame((ts) => this.render(ts));
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    setSceneState(scene) {
      this.scene = {
        ...this.scene,
        ...scene
      };

      const visualDepthNorm = Math.min(1, this.scene.depthNorm * this.VISUAL_SPEED_MULTIPLIER);
      const tintOpacity = 0.12 + visualDepthNorm * 0.88;
      this.tintEl.style.opacity = `${Math.min(0.94, tintOpacity)}`;
    }

    hashKey(key) {
      const str = String(key || "default");
      let h = 0;
      for (let i = 0; i < str.length; i += 1) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      return Math.abs(h);
    }

    getTrailStyle(trailKey) {
      const k = String(trailKey || "default");
      if (k === "pearl") return { mode: "pearl", hue: 204, sat: 86, light: 74, glow: 0.55 };
      if (k === "sonar") return { mode: "ring", hue: 186, sat: 95, light: 62, glow: 0.4 };
      if (k === "default") return { mode: "line", hue: 202, sat: 84, light: 86, glow: 0.3 };
      const seed = this.hashKey(k);
      const modes = ["line", "ring", "glow", "spark"];
      return {
        mode: modes[seed % modes.length],
        hue: 160 + (seed % 180),
        sat: 68 + (seed % 24),
        light: 54 + (seed % 30),
        glow: 0.25 + ((seed % 50) / 100)
      };
    }

    getCrashStyle(crashKey) {
      const k = String(crashKey || "default");
      if (k === "electric") return { count: 88, gravity: 52, hot: "#7df9ff", cool: "#4c6fff", mode: "spark" };
      if (k === "ink") return { count: 72, gravity: 35, hot: "#4a2d6e", cool: "#1a0f28", mode: "ink" };
      if (k === "default") return { count: 65, gravity: 60, hot: "#ffd479", cool: "#ff7f66", mode: "flare" };
      const seed = this.hashKey(k);
      const hueA = seed % 360;
      const hueB = (hueA + 46 + (seed % 70)) % 360;
      const modes = ["flare", "spark", "mist", "ember"];
      return {
        count: 64 + (seed % 34),
        gravity: 34 + (seed % 46),
        hot: `hsl(${hueA}, ${72 + (seed % 20)}%, ${58 + (seed % 24)}%)`,
        cool: `hsl(${hueB}, ${58 + (seed % 20)}%, ${34 + (seed % 16)}%)`,
        mode: modes[seed % modes.length]
      };
    }

    triggerCrashExplosion() {
      const px = this.getSubmarineX();
      const py = this.submarine.y * this.height;
      const fx = this.scene.cosmeticCrash || "default";
      const style = this.getCrashStyle(fx);
      const count = style.count;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 260;
        const hot = style.mode === "spark" && Math.random() < 0.38 ? "#fff6a8" : style.hot;
        const cool = style.cool;
        this.explosionParticles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          size: style.mode === "ink" ? 1.5 + Math.random() * 3.4 : 2 + Math.random() * 4.4,
          hot,
          cool,
          gravity: style.gravity,
          mode: style.mode
        });
      }
      this.scene.crashShake = 0.45;
    }

    spawnCashoutDiver(winAmount, diverKey = "default") {
      const suit =
        diverKey === "gold"
          ? { body: "#b8860b", accent: "#fff8dc", visor: "#fffacd" }
          : diverKey === "red"
            ? { body: "#9b2335", accent: "#ffb6c1", visor: "#8dd6ff" }
            : { body: "#2f3a57", accent: "#8dd6ff", visor: "#8dd6ff" };
      this.cashoutDivers.push({
        x: this.getSubmarineX(),
        y: this.submarine.y * this.height,
        life: 1.7,
        winAmount,
        suit
      });
    }

    getSubmarineX() {
      return this.submarine.x * this.width;
    }

    emitBubble(x, y, scale = 1) {
      const trail = this.scene.cosmeticTrail || "default";
      const style = this.getTrailStyle(trail);
      this.bubbles.push({
        x,
        y,
        r: (2 + Math.random() * 5) * scale * (style.mode === "pearl" ? 1.15 : 1),
        vy: -25 - Math.random() * 70,
        vx: -6 + Math.random() * 12,
        life: 1.8 + Math.random(),
        trailStyle: style
      });
    }

    initAmbientParticles(count) {
      this.ambientParticles = [];
      for (let i = 0; i < count; i += 1) {
        this.ambientParticles.push({
          x: Math.random(),
          y: Math.random(),
          vy: -0.004 - Math.random() * 0.01,
          size: 0.6 + Math.random() * 2.8,
          alpha: 0.05 + Math.random() * 0.22
        });
      }
    }

    initDirectionalParticles(count) {
      this.directionalParticles = [];
      for (let i = 0; i < count; i += 1) {
        this.directionalParticles.push({
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() * 0.05) - 0.025,
          vy: (Math.random() * 0.02) - 0.01,
          size: 0.8 + Math.random() * 2.2,
          alpha: 0.08 + Math.random() * 0.15
        });
      }
    }

    updateSubmarine(dt) {
      const t = performance.now() / 1000;
      const visualDepthNorm = Math.min(1, this.scene.depthNorm * this.VISUAL_SPEED_MULTIPLIER);
      const surfaceY = 0.24 + Math.sin(t * 2.1) * 0.014;
      const diveCenterY = 0.5;
      const targetY = this.scene.isActiveRound ? diveCenterY : surfaceY;
      this.submarine.y += (targetY - this.submarine.y) * Math.min(1, dt * 3.7);
      this.submarine.tilt = Math.sin(t * 2.2) * 0.07 + (this.scene.isActiveRound ? 0.06 : 0);

      if (this.scene.isActiveRound && Math.random() < 0.45) {
        const px = this.getSubmarineX() - 50;
        const py = this.submarine.y * this.height + 10;
        this.emitBubble(px, py, 1);
      }
    }

    updateBubbles(dt) {
      for (const b of this.bubbles) {
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      this.bubbles = this.bubbles.filter((b) => b.life > 0 && b.y > -20);
    }

    updateAmbientParticles(dt) {
      const driftUp = this.smoothedVisualDepth * 0.42;
      for (const p of this.ambientParticles) {
        p.y += (p.vy - driftUp) * dt;
        if (p.y < -0.02) {
          p.y = 1.02;
          p.x = Math.random();
        }
      }
    }

    updateDirectionalParticles(dt) {
      const upDrift = this.smoothedVisualDepth * 0.2 * dt;
      for (const p of this.directionalParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt - upDrift;
        if (p.x < -0.04) p.x = 1.04;
        if (p.x > 1.04) p.x = -0.04;
        if (p.y < -0.04) p.y = 1.04;
        if (p.y > 1.04) p.y = -0.04;
      }
    }

    updateDivers(dt) {
      for (const d of this.cashoutDivers) {
        d.life -= dt;
        d.y -= (130 + (1.7 - d.life) * 40) * dt;
        d.x += Math.sin(d.life * 11) * 28 * dt;
        if (Math.random() < 0.35) {
          this.emitBubble(d.x, d.y, 0.65);
        }
      }
      this.cashoutDivers = this.cashoutDivers.filter((d) => d.life > 0);
    }

    updateExplosion(dt) {
      for (const p of this.explosionParticles) {
        p.life -= dt * 1.2;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.gravity != null ? p.gravity : 60) * dt;
      }
      this.explosionParticles = this.explosionParticles.filter((p) => p.life > 0);
    }

    drawBackground() {
      const d = this.smoothedVisualDepth;
      const topH = 205 - d * 200;
      const sat = 96 - d * 62;
      const lightTop = 68 - d * 58;
      const lightBottom = 36 - d * 32;

      const scroll = Math.abs(this.worldScrollY || 0);
      const pad = scroll + this.height * 0.72 + 160;
      const grad = this.ctx.createLinearGradient(0, -pad, 0, this.height + pad);
      grad.addColorStop(0, `hsl(${topH}, ${sat}%, ${Math.max(3, lightTop)}%)`);
      grad.addColorStop(1, `hsl(${topH - 18}, ${sat - 18}%, ${Math.max(1, lightBottom)}%)`);
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(-pad, -pad, this.width + pad * 2, this.height + pad * 2);

      if (this.scene.isLuckyRound) {
        this.ctx.fillStyle = "rgba(246,205,80,0.10)";
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      if (d < 0.42) {
        this.ctx.fillStyle = `rgba(255,255,255,${0.14 - d * 0.25})`;
        for (let i = 0; i < 4; i += 1) {
          this.ctx.beginPath();
          this.ctx.moveTo(this.width * (i / 4), 0);
          this.ctx.lineTo(this.width * ((i + 0.17) / 4), this.height * 0.68);
          this.ctx.lineTo(this.width * ((i + 0.3) / 4), this.height * 0.68);
          this.ctx.closePath();
          this.ctx.fill();
        }
      }

      // Waterline: moves upward on screen as depth increases (dive illusion while sub stays centered).
      const t = performance.now() / 1000;
      const waveBase = this.height * (0.2 - d * 0.38);
      const waveAmp = 5 + d * 5;
      this.ctx.lineWidth = 2.2 + d * 1.2;
      this.ctx.strokeStyle = `rgba(220, 245, 255, ${0.55 - d * 0.35})`;
      this.ctx.beginPath();
      for (let x = 0; x <= this.width; x += 10) {
        const y = waveBase + Math.sin(x * 0.018 + t * 2.1) * waveAmp;
        if (x === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    }

    drawAmbientParticles() {
      const visualDepthNorm = Math.min(1, this.scene.depthNorm * this.VISUAL_SPEED_MULTIPLIER);
      const darknessBoost = 0.5 + visualDepthNorm;
      for (const p of this.ambientParticles) {
        this.ctx.globalAlpha = p.alpha * darknessBoost;
        this.ctx.fillStyle = visualDepthNorm > 0.92 ? "#53e5d8" : "#cce8ff";
        this.ctx.beginPath();
        this.ctx.arc(p.x * this.width, p.y * this.height, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.globalAlpha = 1;
    }

    drawDirectionalParticles() {
      const visualDepthNorm = Math.min(1, this.scene.depthNorm * this.VISUAL_SPEED_MULTIPLIER);
      for (const p of this.directionalParticles) {
        this.ctx.globalAlpha = p.alpha * (0.6 + visualDepthNorm);
        this.ctx.fillStyle = "#bfefff";
        this.ctx.beginPath();
        this.ctx.ellipse(
          p.x * this.width,
          p.y * this.height,
          p.size * 1.8,
          p.size,
          0.4,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
      this.ctx.globalAlpha = 1;
    }

    drawFishSchool(depthNorm) {
      if (depthNorm < 0.12 || depthNorm > 0.6) return;
      const t = performance.now() / 1000;
      this.ctx.fillStyle = "rgba(197, 229, 255, 0.7)";
      for (let i = 0; i < 8; i += 1) {
        const x = (this.width * 0.2) + ((i * 130 + t * 55) % (this.width * 0.7));
        const y = this.height * (0.34 + 0.04 * Math.sin(t * 0.9 + i));
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, 10, 4.5, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    drawSharks(depthNorm) {
      if (depthNorm < 0.45 || depthNorm > 0.85) return;
      const t = performance.now() / 1000;
      this.ctx.fillStyle = "rgba(40, 63, 96, 0.72)";
      for (let i = 0; i < 2; i += 1) {
        const x = this.width * (0.25 + (i * 0.35)) + Math.sin(t * 0.7 + i) * 40;
        const y = this.height * (0.52 + i * 0.12);
        this.ctx.beginPath();
        this.ctx.moveTo(x - 48, y);
        this.ctx.lineTo(x + 34, y - 13);
        this.ctx.lineTo(x + 58, y);
        this.ctx.lineTo(x + 34, y + 13);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }

    drawKraken(depthNorm) {
      if (depthNorm < 0.82) return;
      const t = performance.now() / 1000;
      this.ctx.fillStyle = "rgba(66, 42, 92, 0.48)";
      const baseX = this.width * 0.72;
      const baseY = this.height * 0.74;
      this.ctx.beginPath();
      this.ctx.ellipse(baseX, baseY, 60, 44, 0, 0, Math.PI * 2);
      this.ctx.fill();
      for (let i = 0; i < 6; i += 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(baseX - 38 + i * 14, baseY + 28);
        this.ctx.quadraticCurveTo(
          baseX - 24 + i * 10 + Math.sin(t + i) * 20,
          baseY + 72 + i * 2,
          baseX - 52 + i * 18,
          baseY + 122
        );
        this.ctx.strokeStyle = "rgba(66, 42, 92, 0.46)";
        this.ctx.lineWidth = 5;
        this.ctx.stroke();
      }
    }

    drawWaterGloss() {
      const scroll = Math.abs(this.worldScrollY || 0);
      const pad = scroll + this.height * 0.5 + 80;
      const grad = this.ctx.createLinearGradient(0, -pad, this.width, this.height * 0.5 + pad);
      grad.addColorStop(0, "rgba(255,255,255,0.12)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.03)");
      grad.addColorStop(1, "rgba(255,255,255,0.0)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(-pad, -pad, this.width + pad * 2, this.height + pad * 2);
    }

    drawSubmarine() {
      if (this.scene.didCrash) {
        return;
      }
      const x = this.getSubmarineX();
      const y = this.submarine.y * this.height;
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(this.submarine.tilt);

      const skin = this.scene.equippedSkin || { body: "#f7d23b", accent: "#d2a814", trim: "#463203" };
      this.ctx.fillStyle = skin.body;
      this.ctx.strokeStyle = skin.trim;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, 76, 32, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = skin.accent;
      this.ctx.fillRect(-24, -44, 46, 18);

      this.ctx.fillStyle = "#aee7ff";
      this.ctx.beginPath();
      this.ctx.arc(18, -4, 13, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = "#35579a";
      this.ctx.fillRect(-86, -6, 16, 12);

      this.ctx.fillStyle = "#203764";
      this.ctx.fillRect(66, -20, 14, 40);

      this.ctx.restore();
    }

    colorFromName(name) {
      const seed = this.hashKey(name || "player");
      const hue = seed % 360;
      return {
        body: `hsl(${hue}, 76%, 58%)`,
        accent: `hsl(${(hue + 24) % 360}, 72%, 50%)`,
        trim: `hsl(${(hue + 190) % 360}, 48%, 22%)`
      };
    }

    drawVisibleSubmarinesLineup() {
      const allSubs = Array.isArray(this.scene.visibleSubmarines) ? this.scene.visibleSubmarines : [];
      if (allSubs.length === 0) return;
      const isDesktop = this.width >= 900;
      if (!isDesktop) return;
      const mySub = allSubs.find((s) => s && s.isSelf);
      const others = allSubs.filter((s) => !s || !s.isSelf);
      const lineup = mySub ? [mySub, ...others] : allSubs.slice();
      const max = Math.min(12, lineup.length);
      if (max <= 0) return;
      const gap = this.width / (max + 1);
      const baseY = this.submarine.y * this.height;
      const bob = Math.sin(performance.now() / 680) * 2.5;
      for (let i = 0; i < max; i += 1) {
        const sub = lineup[i] || {};
        const x = gap * (i + 1);
        const y = baseY - 64 + bob;
        const skin = this.colorFromName(sub.name || `player-${i}`);
        const isSelf = !!sub.isSelf;
        const scale = isSelf ? 1 : 0.58;
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(this.submarine.tilt * (isSelf ? 1 : 0.6));
        this.ctx.scale(scale, scale);
        this.ctx.fillStyle = skin.body;
        this.ctx.strokeStyle = skin.trim;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 76, 32, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.fillStyle = skin.accent;
        this.ctx.fillRect(-24, -44, 46, 18);
        this.ctx.fillStyle = "#aee7ff";
        this.ctx.beginPath();
        this.ctx.arc(18, -4, 13, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = "#35579a";
        this.ctx.fillRect(-86, -6, 16, 12);
        this.ctx.fillStyle = "#203764";
        this.ctx.fillRect(66, -20, 14, 40);
        this.ctx.restore();

        const labelName = String(sub.name || "Player").slice(0, 14);
        const role = String(sub.roleLabel || (isSelf ? "Player" : "Spectator"));
        this.ctx.save();
        this.ctx.textAlign = "center";
        this.ctx.font = isSelf ? "700 14px Segoe UI" : "600 12px Segoe UI";
        this.ctx.fillStyle = "rgba(223, 243, 255, 0.98)";
        this.ctx.strokeStyle = "rgba(10, 22, 40, 0.75)";
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(labelName, x, y - (isSelf ? 42 : 30));
        this.ctx.fillText(labelName, x, y - (isSelf ? 42 : 30));
        this.ctx.font = "600 11px Segoe UI";
        this.ctx.fillStyle = role === "Player" ? "rgba(130, 255, 170, 0.95)" : "rgba(190, 220, 255, 0.9)";
        this.ctx.fillText(role, x, y - (isSelf ? 26 : 16));
        this.ctx.restore();
      }
    }

    drawDivers() {
      for (const d of this.cashoutDivers) {
        const suit = d.suit || { body: "#2f3a57", accent: "#8dd6ff", visor: "#8dd6ff" };
        this.ctx.save();
        this.ctx.translate(d.x, d.y);
        this.ctx.rotate(-0.2);

        this.ctx.fillStyle = suit.body;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = suit.visor;
        this.ctx.beginPath();
        this.ctx.arc(12, -2, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        this.ctx.globalAlpha = Math.max(0, d.life / 1.7);
        this.ctx.fillStyle = "#8dff8d";
        this.ctx.font = "700 18px Segoe UI";
        this.ctx.fillText(`+$${d.winAmount.toFixed(2)}`, d.x + 12, d.y - 20);
        this.ctx.globalAlpha = 1;
      }
    }

    drawBubbles() {
      for (const b of this.bubbles) {
        this.ctx.globalAlpha = Math.max(0, b.life / 2.7);
        const style = b.trailStyle || this.getTrailStyle("default");
        const k = style.mode;
        if (k === "pearl") {
          const g = this.ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 0, b.x, b.y, b.r);
          g.addColorStop(0, "rgba(255,255,255,0.95)");
          g.addColorStop(0.45, "rgba(230,245,255,0.55)");
          g.addColorStop(1, "rgba(180,220,255,0.15)");
          this.ctx.fillStyle = g;
          this.ctx.beginPath();
          this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (k === "ring") {
          this.ctx.strokeStyle = `hsla(${style.hue}, ${style.sat}%, ${style.light}%, 0.6)`;
          this.ctx.lineWidth = 1.2;
          this.ctx.beginPath();
          this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.strokeStyle = `hsla(${style.hue}, ${style.sat}%, ${style.light + 8}%, 0.24)`;
          this.ctx.beginPath();
          this.ctx.arc(b.x, b.y, b.r + 3 + Math.sin(b.life * 6) * 2, 0, Math.PI * 2);
          this.ctx.stroke();
        } else if (k === "glow") {
          const g = this.ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 1.7);
          g.addColorStop(0, `hsla(${style.hue}, ${style.sat}%, ${Math.min(98, style.light + 30)}%, 0.86)`);
          g.addColorStop(1, `hsla(${style.hue}, ${style.sat}%, ${style.light}%, 0.03)`);
          this.ctx.fillStyle = g;
          this.ctx.beginPath();
          this.ctx.arc(b.x, b.y, b.r * 1.5, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (k === "spark") {
          this.ctx.strokeStyle = `hsla(${style.hue}, ${style.sat}%, ${style.light}%, 0.9)`;
          this.ctx.lineWidth = 1.4;
          this.ctx.beginPath();
          this.ctx.moveTo(b.x - b.r, b.y - b.r * 0.6);
          this.ctx.lineTo(b.x + b.r, b.y + b.r * 0.6);
          this.ctx.moveTo(b.x - b.r * 0.6, b.y + b.r);
          this.ctx.lineTo(b.x + b.r * 0.6, b.y - b.r);
          this.ctx.stroke();
        } else {
          this.ctx.strokeStyle = `hsla(${style.hue}, ${style.sat}%, ${Math.min(95, style.light + 24)}%, 0.88)`;
          this.ctx.lineWidth = 1.4;
          this.ctx.beginPath();
          this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }
      this.ctx.globalAlpha = 1;
    }

    drawExplosion() {
      for (const p of this.explosionParticles) {
        this.ctx.globalAlpha = Math.max(0, p.life);
        const hot = p.hot || "#ffd479";
        const cool = p.cool || "#ff7f66";
        this.ctx.fillStyle = p.life > 0.45 ? hot : cool;
        if (p.mode === "spark") {
          this.ctx.lineWidth = Math.max(1.2, p.size * 0.55);
          this.ctx.strokeStyle = this.ctx.fillStyle;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x - p.size * 1.4, p.y);
          this.ctx.lineTo(p.x + p.size * 1.4, p.y);
          this.ctx.moveTo(p.x, p.y - p.size * 1.4);
          this.ctx.lineTo(p.x, p.y + p.size * 1.4);
          this.ctx.stroke();
        } else if (p.mode === "mist") {
          const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.6);
          g.addColorStop(0, this.ctx.fillStyle);
          g.addColorStop(1, "rgba(0,0,0,0)");
          this.ctx.fillStyle = g;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.mode === "ember") {
          this.ctx.beginPath();
          this.ctx.ellipse(p.x, p.y, p.size * 1.1, p.size * 0.75, 0.5, 0, Math.PI * 2);
          this.ctx.fill();
        } else {
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      this.ctx.globalAlpha = 1;
    }

    render(ts) {
      if (!this.lastFrameTs) {
        this.lastFrameTs = ts;
      }
      const dt = Math.min((ts - this.lastFrameTs) / 1000, 0.033);
      this.lastFrameTs = ts;

      this.scene.crashShake = Math.max(0, this.scene.crashShake - dt);
      const targetDepth = Math.min(1, this.scene.depthNorm * this.VISUAL_SPEED_MULTIPLIER);
      this.smoothedVisualDepth += (targetDepth - this.smoothedVisualDepth) * Math.min(1, dt * 3.2);

      this.updateSubmarine(dt);
      this.updateBubbles(dt);
      this.updateAmbientParticles(dt);
      this.updateDirectionalParticles(dt);
      this.updateDivers(dt);
      this.updateExplosion(dt);

      const shakeStrength = this.scene.crashShake > 0 ? this.scene.crashShake * 10 : 0;
      const shakeX = (Math.random() - 0.5) * shakeStrength;
      const shakeY = (Math.random() - 0.5) * shakeStrength;
      this.worldScrollY = -this.smoothedVisualDepth * this.height * 0.52;
      if (this.gameRoot) {
        this.gameRoot.style.setProperty("--scene-depth", this.smoothedVisualDepth.toFixed(4));
      }

      this.ctx.save();
      this.ctx.translate(shakeX, shakeY);
      this.ctx.save();
      this.ctx.translate(0, this.worldScrollY);
      this.drawBackground();
      this.drawAmbientParticles();
      this.drawDirectionalParticles();
      this.drawFishSchool(this.scene.depthNorm);
      this.drawSharks(this.scene.depthNorm);
      this.drawKraken(this.scene.depthNorm);
      this.drawWaterGloss();
      this.ctx.restore();

      this.drawBubbles();
      this.drawVisibleSubmarinesLineup();
      this.drawDivers();
      this.drawExplosion();
      this.ctx.restore();

      requestAnimationFrame((nextTs) => this.render(nextTs));
    }
  }

  window.GameAnimations = GameAnimations;
})();
