(function () {
  const STORAGE_KEY = "submarine_crash_balance_v2";
  const DEFAULT_BALANCE = 1000;
  const HOUSE_EDGE = 0.04; // 4% target

  const gameState = {
    phase: "preRound", // preRound | active | crashed
    balance: loadBalance(),
    queuedBet: 0,
    activeBet: 0,
    currentMultiplier: 1,
    crashPoint: 1,
    roundStartMs: 0,
    roundEndMs: 0,
    countdownDurationMs: 0,
    countdownStartMs: 0,
    lastCrash: null,
    didCrash: false,
    hasCashedOut: false,
    nonce: 0,
    serverSeed: "",
    serverSeedHash: "",
    clientSeed: "submarine-player-seed-v1"
  };

  const ui = new window.GameUI();
  const animations = new window.GameAnimations("scene-canvas", "depth-tint");

  function loadBalance() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0.01) {
      return DEFAULT_BALANCE;
    }
    return Number(parsed.toFixed(2));
  }

  function saveBalance() {
    localStorage.setItem(STORAGE_KEY, gameState.balance.toFixed(2));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cyrb128(str) {
    let h1 = 1779033703;
    let h2 = 3144134277;
    let h3 = 1013904242;
    let h4 = 2773480762;
    for (let i = 0; i < str.length; i += 1) {
      const k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }

  function sfc32(a, b, c, d) {
    return function rand() {
      a >>>= 0;
      b >>>= 0;
      c >>>= 0;
      d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    const seed = cyrb128(str);
    return seed.map((n) => n.toString(16).padStart(8, "0")).join("");
  }

  function initFairnessSeed() {
    const salt = `${Date.now()}-${Math.random()}-${performance.now()}`;
    gameState.serverSeed = hashString(`server-${salt}`);
    gameState.serverSeedHash = hashString(`hash-${gameState.serverSeed}`);
  }

  function createRoundRng(nonce) {
    const fullSeed = `${gameState.serverSeed}:${gameState.clientSeed}:${nonce}`;
    const [a, b, c, d] = cyrb128(fullSeed);
    return sfc32(a, b, c, d);
  }

  function generateWeightedCrashWithoutEdge(rng) {
    const random = rng();

    if (random < 0.33) {
      return 1.0 + rng() * 0.99;
    }
    if (random < 0.6) {
      return 2.0 + rng() * 2.99;
    }
    if (random < 0.8) {
      return 5.0 + rng() * 4.99;
    }
    if (random < 0.92) {
      return 10.0 + rng() * 39.99;
    }
    if (random < 0.97) {
      return 50.0 + rng() * 49.99;
    }
    if (random < 0.995) {
      return 100.0 + rng() * 899.99;
    }
    return 1000.0 + rng() * 9000.0;
  }

  function generateCrashPoint(nonce) {
    const rng = createRoundRng(nonce);
    const sampled = generateWeightedCrashWithoutEdge(rng);
    // Keep house edge mild so low-band results do not collapse into frequent 1.00x crashes.
    const edged = sampled * (1 - HOUSE_EDGE * 0.2);
    return clamp(Number(edged.toFixed(2)), 1.0, 10000.0);
  }

  function multiplierFromElapsedMs(elapsedMs) {
    // Exponential growth keeps rounds exciting and smooth.
    const seconds = elapsedMs / 1000;
    return Math.exp(seconds * 0.34);
  }

  function depthNormFromMultiplier(multiplier) {
    const norm = Math.log10(multiplier) / Math.log10(10000);
    return clamp(norm, 0, 1);
  }

  function beginPreRound() {
    gameState.phase = "preRound";
    gameState.didCrash = false;
    gameState.hasCashedOut = false;
    gameState.currentMultiplier = 1;
    gameState.roundStartMs = 0;
    gameState.crashPoint = generateCrashPoint(gameState.nonce);
    gameState.countdownStartMs = performance.now();
    gameState.countdownDurationMs = 3000 + Math.random() * 2000;

    ui.setPhase("Prepare your submarine...");
    ui.setActionState({
      canBet: true,
      canCashout: false
    });
    ui.setFairness(gameState.serverSeedHash.slice(0, 24), gameState.nonce);
    ui.setBetInfo(gameState.queuedBet, 0);
    animations.setSceneState({
      multiplier: 1,
      depthNorm: 0,
      isActiveRound: false,
      didCrash: false
    });
  }

  function beginRound() {
    gameState.phase = "active";
    gameState.roundStartMs = performance.now();
    gameState.activeBet = gameState.queuedBet;
    gameState.queuedBet = 0;
    ui.setPhase(gameState.activeBet > 0 ? "Dive in progress! Cash out before implosion." : "Spectating this dive");
    ui.setActionState({ canBet: false, canCashout: false });
    refreshActionButtons();
  }

  function crashRound() {
    gameState.phase = "crashed";
    gameState.didCrash = true;
    gameState.roundEndMs = performance.now();
    gameState.currentMultiplier = gameState.crashPoint;
    ui.setCrashPoint(gameState.crashPoint);
    ui.pushHistory(gameState.crashPoint);
    ui.setActionState({
      canBet: false,
      canCashout: false
    });

    if (gameState.activeBet > 0 && !gameState.hasCashedOut) {
      ui.setPhase("Submarine imploded. Bet lost.");
      ui.setBetInfo(0, 0);
    } else {
      ui.setPhase("Round ended.");
    }

    animations.setSceneState({
      multiplier: gameState.currentMultiplier,
      depthNorm: depthNormFromMultiplier(gameState.currentMultiplier),
      isActiveRound: false,
      didCrash: true
    });
    animations.triggerCrashExplosion();

    gameState.activeBet = 0;
    gameState.nonce += 1;
    setTimeout(() => {
      beginPreRound();
    }, 2400);
  }

  function placeBet() {
    if (gameState.phase !== "preRound") {
      return;
    }

    const requested = clamp(Number(ui.getBetInputValue().toFixed(2)), 0.01, gameState.balance);
    if (requested > gameState.balance || requested <= 0) {
      return;
    }

    gameState.queuedBet = requested;
    gameState.balance = Number((gameState.balance - requested).toFixed(2));
    saveBalance();

    ui.setBalance(gameState.balance);
    ui.setBetInfo(gameState.queuedBet, gameState.queuedBet);
    ui.setPhase(`Bet locked: ${ui.formatMoney(gameState.queuedBet)}`);
  }

  function cashOut(source) {
    if (gameState.phase !== "active" || gameState.activeBet <= 0 || gameState.hasCashedOut) {
      return;
    }
    if (gameState.currentMultiplier >= gameState.crashPoint) {
      return;
    }

    gameState.hasCashedOut = true;
    const winnings = Number((gameState.activeBet * gameState.currentMultiplier).toFixed(2));
    gameState.balance = Number((gameState.balance + winnings).toFixed(2));
    saveBalance();

    ui.setBalance(gameState.balance);
    ui.setActionState({
      canBet: false,
      canCashout: false
    });
    ui.setPhase(source === "auto" ? "Auto cash out successful!" : "Cash out successful!");
    ui.setBetInfo(0, winnings);

    animations.spawnCashoutDiver(winnings);
  }

  function canCashOutNow() {
    return gameState.phase === "active"
      && gameState.activeBet > 0
      && !gameState.hasCashedOut
      && !gameState.didCrash
      && gameState.currentMultiplier < gameState.crashPoint;
  }

  function refreshActionButtons() {
    ui.setActionState({
      canBet: gameState.phase === "preRound",
      canCashout: canCashOutNow()
    });
  }

  function adjustBetInput(delta) {
    const current = ui.getBetInputValue();
    const next = clamp(current + delta, 0.01, gameState.balance);
    ui.setBetInputValue(next);
  }

  function setBetInput(value) {
    ui.setBetInputValue(clamp(value, 0.01, gameState.balance));
  }

  function onBetInputChange() {
    const corrected = clamp(ui.getBetInputValue(), 0.01, gameState.balance);
    ui.setBetInputValue(corrected);
  }

  function evaluateAutoCashout() {
    const cfg = ui.getAutoCashoutConfig();
    if (!cfg.enabled) {
      return;
    }
    if (gameState.phase === "active" && !gameState.hasCashedOut && gameState.activeBet > 0 && gameState.currentMultiplier >= cfg.multiplier) {
      cashOut("auto");
    }
  }

  function tick() {
    const now = performance.now();

    if (gameState.phase === "preRound") {
      const elapsed = now - gameState.countdownStartMs;
      const remaining = Math.max(0, (gameState.countdownDurationMs - elapsed) / 1000);
      ui.setCountdown(remaining);
      if (elapsed >= gameState.countdownDurationMs) {
        beginRound();
      }
    } else if (gameState.phase === "active") {
      const elapsed = now - gameState.roundStartMs;
      gameState.currentMultiplier = Number(multiplierFromElapsedMs(elapsed).toFixed(2));
      if (gameState.currentMultiplier >= gameState.crashPoint) {
        crashRound();
      } else {
        const potential = gameState.activeBet > 0 ? gameState.activeBet * gameState.currentMultiplier : 0;
        ui.setBetInfo(gameState.activeBet, potential);
        evaluateAutoCashout();
      }
    } else if (gameState.phase === "crashed") {
      ui.setCountdown(Math.max(0, (2400 - (now - gameState.roundEndMs)) / 1000));
    }

    const depthNorm = depthNormFromMultiplier(gameState.currentMultiplier);
    refreshActionButtons();
    ui.setMultiplier(gameState.currentMultiplier);
    ui.setDepth(depthNorm);
    animations.setSceneState({
      multiplier: gameState.currentMultiplier,
      depthNorm,
      isActiveRound: gameState.phase === "active",
      didCrash: gameState.didCrash
    });
  }

  function runCrashDistributionTest(rounds = 100) {
    const bucketCounts = {
      "1.00x-1.99x": 0,
      "2.00x-4.99x": 0,
      "5.00x-9.99x": 0,
      "10.00x-49.99x": 0,
      "50.00x-99.99x": 0,
      "100.00x-999.99x": 0,
      "1000.00x-10000.00x": 0
    };

    const samples = [];
    for (let i = 0; i < rounds; i += 1) {
      const point = generateCrashPoint(gameState.nonce + i + 1);
      samples.push(point);
      if (point < 2) bucketCounts["1.00x-1.99x"] += 1;
      else if (point < 5) bucketCounts["2.00x-4.99x"] += 1;
      else if (point < 10) bucketCounts["5.00x-9.99x"] += 1;
      else if (point < 50) bucketCounts["10.00x-49.99x"] += 1;
      else if (point < 100) bucketCounts["50.00x-99.99x"] += 1;
      else if (point < 1000) bucketCounts["100.00x-999.99x"] += 1;
      else bucketCounts["1000.00x-10000.00x"] += 1;
    }

    console.log(`Crash distribution test (${rounds} rounds):`);
    console.table(bucketCounts);
    console.log("Sample crash points:", samples.map((v) => `${v.toFixed(2)}x`).join(", "));
  }

  function init() {
    initFairnessSeed();
    ui.bindControls({
      placeBet,
      cashOut,
      adjustBetInput,
      setBetInput,
      onBetInputChange
    });

    ui.setBalance(gameState.balance);
    ui.setBetInputValue(1);
    ui.setCrashPoint(0);
    beginPreRound();
    window.runCrashDistributionTest = runCrashDistributionTest;

    function frame() {
      tick();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  init();
})();
