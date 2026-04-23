(function () {
  class GameAnimations {
    constructor(canvasId, tintId) {
      this.VISUAL_SPEED_MULTIPLIER = 3.8;
      this.HORIZONTAL_OFFSET_PX = 150;
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext("2d");
      this.tintEl = document.getElementById(tintId);
      this.width = 0;
      this.height = 0;

      this.scene = {
        multiplier: 1,
        depthNorm: 0,
        isActiveRound: false,
        didCrash: false,
        isLuckyRound: false,
        equippedSkin: null,
        crashShake: 0
      };

      this.submarine = {
        x: 0.5,
        y: 0.18,
        tilt: 0
      };

      this.bubbles = [];
      this.ambientParticles = [];
      this.cashoutDivers = [];
      this.explosionParticles = [];
      this.directionalParticles = [];

      this.lastFrameTs = 0;
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
      const tintOpacity = 0.2 + visualDepthNorm * 0.63;
      this.tintEl.style.opacity = `${Math.min(0.86, tintOpacity)}`;
    }

    triggerCrashExplosion() {
      const px = this.getSubmarineX();
      const py = this.submarine.y * this.height;
      for (let i = 0; i < 65; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 260;
        this.explosionParticles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          size: 2 + Math.random() * 4
        });
      }
      this.scene.crashShake = 0.45;
    }

    spawnCashoutDiver(winAmount) {
      this.cashoutDivers.push({
        x: this.getSubmarineX(),
        y: this.submarine.y * this.height,
        life: 1.7,
        winAmount
      });
    }

    getSubmarineX() {
      return this.submarine.x * this.width + this.HORIZONTAL_OFFSET_PX;
    }

    emitBubble(x, y, scale = 1) {
      this.bubbles.push({
        x,
        y,
        r: (2 + Math.random() * 5) * scale,
        vy: -25 - Math.random() * 70,
        vx: -6 + Math.random() * 12,
        life: 1.8 + Math.random()
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
      const surfaceY = 0.14 + Math.sin(t * 2.1) * 0.012;
      const targetY = this.scene.isActiveRound ? 0.19 + visualDepthNorm * 0.71 : surfaceY;
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
      for (const p of this.ambientParticles) {
        p.y += p.vy * dt;
        if (p.y < -0.02) {
          p.y = 1.02;
          p.x = Math.random();
        }
      }
    }

    updateDirectionalParticles(dt) {
      for (const p of this.directionalParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
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
        p.vy += 60 * dt;
      }
      this.explosionParticles = this.explosionParticles.filter((p) => p.life > 0);
    }

    drawBackground() {
      const d = Math.min(1, this.scene.depthNorm * this.VISUAL_SPEED_MULTIPLIER);
      const topH = 200 - d * 180;
      const sat = 95 - d * 55;
      const lightTop = 66 - d * 48;
      const lightBottom = 33 - d * 25;

      const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
      grad.addColorStop(0, `hsl(${topH}, ${sat}%, ${Math.max(4, lightTop)}%)`);
      grad.addColorStop(1, `hsl(${topH - 12}, ${sat - 12}%, ${Math.max(2, lightBottom)}%)`);
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);

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

      // Visible animated waterline waves near the submarine start area.
      const t = performance.now() / 1000;
      const waveY = this.height * 0.2;
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = "rgba(220, 245, 255, 0.55)";
      this.ctx.beginPath();
      for (let x = 0; x <= this.width; x += 12) {
        const y = waveY + Math.sin(x * 0.018 + t * 2.1) * 6;
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
      const grad = this.ctx.createLinearGradient(0, 0, this.width, this.height * 0.5);
      grad.addColorStop(0, "rgba(255,255,255,0.12)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.03)");
      grad.addColorStop(1, "rgba(255,255,255,0.0)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);
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

    drawDivers() {
      for (const d of this.cashoutDivers) {
        this.ctx.save();
        this.ctx.translate(d.x, d.y);
        this.ctx.rotate(-0.2);

        this.ctx.fillStyle = "#2f3a57";
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = "#8dd6ff";
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
        this.ctx.strokeStyle = "rgba(215, 240, 255, 0.9)";
        this.ctx.lineWidth = 1.4;
        this.ctx.beginPath();
        this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.globalAlpha = 1;
    }

    drawExplosion() {
      for (const p of this.explosionParticles) {
        this.ctx.globalAlpha = Math.max(0, p.life);
        this.ctx.fillStyle = p.life > 0.45 ? "#ffd479" : "#ff7f66";
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
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
      this.updateSubmarine(dt);
      this.updateBubbles(dt);
      this.updateAmbientParticles(dt);
      this.updateDirectionalParticles(dt);
      this.updateDivers(dt);
      this.updateExplosion(dt);

      const shakeStrength = this.scene.crashShake > 0 ? this.scene.crashShake * 10 : 0;
      const shakeX = (Math.random() - 0.5) * shakeStrength;
      const shakeY = (Math.random() - 0.5) * shakeStrength;
      this.ctx.save();
      this.ctx.translate(shakeX, shakeY);
      this.drawBackground();
      this.drawAmbientParticles();
      this.drawDirectionalParticles();
      this.drawFishSchool(this.scene.depthNorm);
      this.drawSharks(this.scene.depthNorm);
      this.drawKraken(this.scene.depthNorm);
      this.drawWaterGloss();
      this.drawBubbles();
      this.drawSubmarine();
      this.drawDivers();
      this.drawExplosion();
      this.ctx.restore();

      requestAnimationFrame((nextTs) => this.render(nextTs));
    }
  }

  window.GameAnimations = GameAnimations;
})();
