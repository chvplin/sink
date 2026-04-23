(function () {
  const CONFIG = {
    DEV_TOOLS_ENABLED: true,
    LUCKY_ROUND_CHANCE: 0.05,
    LUCKY_ROUND_PAYOUT_BONUS: 2,
    MILESTONES: [2, 5, 10, 25, 50, 100],
    SHARED_SYNC_MS: 900
  };
  const PHASE_RANK = { preRound: 1, active: 2, crashed: 3 };
  const content = window.ProgressionContent;
  const dataService = window.GameDataService.create();
  const ui = new window.GameUI();
  const animations = new window.GameAnimations("scene-canvas", "depth-tint");
  let profile = dataService.loadPlayerProfile();
  let currentLeaderboardTab = "highestMultiplier";

  const gameState = {
    phase: "preRound",
    queuedBet: 0,
    activeBet: 0,
    currentMultiplier: 1,
    crashPoint: 1,
    countdownStartMs: 0,
    countdownDurationMs: 0,
    roundStartMs: 0,
    roundEndMs: 0,
    roundId: "",
    didCrash: false,
    hasCashedOut: false,
    lastCrash: 0,
    nonce: 0,
    isLuckyRound: false,
    autoWins: 0,
    autoLosses: 0,
    roundParticipation: {
      playerBetPlaced: false,
      betAmount: 0,
      playerJoinedRound: false,
      playerCashedOut: false
    },
    serverSeed: "",
    serverSeedHash: "",
    clientSeed: "submarine-player-seed-v2",
    lastSharedStateAt: 0,
    lastSharedSyncAt: 0,
    lastLiveBetsSyncAt: 0,
    lastChallengeRealtimeCheckAt: 0
  };

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function saveAll() { dataService.savePlayerProfile(profile); }
  function cyrb128(str) {
    let h1 = 1779033703; let h2 = 3144134277; let h3 = 1013904242; let h4 = 2773480762;
    for (let i = 0; i < str.length; i += 1) {
      const k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233); h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233); h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }
  function sfc32(a, b, c, d) {
    return function rand() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function hashString(str) { return cyrb128(str).map((n) => n.toString(16).padStart(8, "0")).join(""); }
  function createRoundRng(nonce) { const [a, b, c, d] = cyrb128(`${gameState.serverSeed}:${gameState.clientSeed}:${nonce}`); return sfc32(a, b, c, d); }
  function initFairnessSeed() {
    const salt = `${Date.now()}-${Math.random()}-${performance.now()}`;
    gameState.serverSeed = hashString(`server-${salt}`);
    gameState.serverSeedHash = hashString(`hash-${gameState.serverSeed}`);
  }

  function generateCrashPoint() {
    const random = Math.random();
    let point;
    if (random < 0.33) point = 1 + Math.random() * 0.99;
    else if (random < 0.6) point = 2 + Math.random() * 2.99;
    else if (random < 0.8) point = 5 + Math.random() * 4.99;
    else if (random < 0.92) point = 10 + Math.random() * 39.99;
    else if (random < 0.97) point = 50 + Math.random() * 49.99;
    else if (random < 0.995) point = 100 + Math.random() * 899.99;
    else point = 1000 + Math.random() * 9000;
    return clamp(Number(point.toFixed(2)), 1, 10000);
  }
  function multiplierFromElapsedMs(ms) { return Math.exp((ms / 1000) * 0.34); }
  function depthNormFromMultiplier(multiplier) { return clamp(Math.log10(multiplier) / Math.log10(10000), 0, 1); }

  function getEquippedSkin() {
    return content.SUBMARINE_SKINS.find((s) => s.id === profile.equippedSkinId) || content.SUBMARINE_SKINS[0];
  }
  function didPlayerParticipateInRound() {
    const p = gameState.roundParticipation;
    return p.playerBetPlaced && p.playerJoinedRound && p.betAmount > 0;
  }
  function updateCashOutButtonState() {
    const canCash = gameState.phase === "active" && gameState.activeBet > 0 && !gameState.hasCashedOut && !gameState.didCrash && gameState.currentMultiplier < gameState.crashPoint;
    ui.updateCashOutButtonState({ canCashout: canCash, hasCashedOut: gameState.hasCashedOut });
    ui.setActionState({ canBet: gameState.phase === "preRound" && gameState.queuedBet === 0, canCashout: canCash });
    return canCash;
  }

  function applyLoginStreak() {
    const today = window.GameDataService.todayKey();
    if (profile.streaks.lastLoginDate === today) return;
    const prev = new Date(`${profile.streaks.lastLoginDate}T00:00:00Z`).getTime();
    const now = new Date(`${today}T00:00:00Z`).getTime();
    const delta = Math.floor((now - prev) / (24 * 60 * 60 * 1000));
    profile.streaks.dailyLogin = delta === 1 ? Math.min(7, profile.streaks.dailyLogin + 1) : 1;
    profile.streaks.lastLoginDate = today;
    profile.balance = Number((profile.balance + (profile.streaks.dailyLogin === 7 ? 1200 : 150 * profile.streaks.dailyLogin)).toFixed(2));
  }

  function maybeResetChallenges() {
    const today = window.GameDataService.todayKey();
    const week = window.GameDataService.startOfWeekKey();
    const randomPick = (pool, count) => [...pool].sort(() => Math.random() - 0.5).slice(0, count).map((c) => ({ ...c, progress: 0, completed: false, claimed: false }));
    if (profile.challenges.dailyKey !== today || profile.challenges.daily.length === 0) {
      profile.challenges.dailyKey = today;
      profile.challenges.daily = randomPick(content.DAILY_CHALLENGE_POOL, 3);
    }
    if (profile.challenges.weeklyKey !== week || profile.challenges.weekly.length === 0) {
      profile.challenges.weeklyKey = week;
      profile.challenges.weekly = randomPick(content.WEEKLY_CHALLENGE_POOL, 3);
    }
  }

  async function refreshLeaderboard(tab) {
    currentLeaderboardTab = tab;
    const metricMap = {
      highestMultiplier: "highestMultiplier",
      biggestWin: "biggestWin",
      highestBalance: "highestBalance",
      longestStreak: "longestStreak",
      daily: "daily",
      weekly: "weekly"
    };
    const metric = metricMap[tab] || "highestMultiplier";
    if (typeof dataService.loadLeaderboard !== "function") {
      ui.renderLeaderboard([]);
      return;
    }
    const rows = await dataService.loadLeaderboard(metric, 20);
    const formatted = rows.map((r) => ({
      name: r.name,
      value: metric.includes("Multiplier") ? `${r.valueRaw.toFixed(2)}x` : ui.formatMoney(r.valueRaw),
      currentPlayer: !!(dataService.user && r.userId === dataService.user.id)
    }));
    ui.renderLeaderboard(formatted);
  }

  function renderAllPanels() {
    ui.setBalance(profile.balance);
    ui.setStreaks(profile.streaks.win, profile.streaks.dailyLogin);
    ui.renderCollection(content.SUBMARINE_SKINS, profile.unlockedSkinIds, profile.equippedSkinId);
    ui.renderChallengePanels(profile.challenges.daily, profile.challenges.weekly);
    ui.renderAchievements(content.ACHIEVEMENTS, new Set(profile.achievementsUnlocked));
    ui.renderLeaderboard([]);
    refreshLeaderboard(currentLeaderboardTab);
    const stats = { ...profile.stats, currentWinStreak: profile.streaks.win, bestWinStreak: profile.streaks.bestWin, dailyStreak: profile.streaks.dailyLogin };
    ui.renderStats(stats, profile.achievementsUnlocked.length, getEquippedSkin().name);
    ui.applyAutoBetConfig(profile.settings);
    ui.renderLiveBets([]);
  }

  function updateChallenges(metricName, value) {
    const bump = (list) => {
      list.forEach((c) => {
        if (c.metric !== metricName || c.claimed) return;
        c.progress = Math.min(c.goal, c.progress + value);
        c.completed = c.progress >= c.goal;
      });
    };
    bump(profile.challenges.daily);
    bump(profile.challenges.weekly);
  }

  function evaluateSkinUnlocks() {
    content.SUBMARINE_SKINS.forEach((skin) => {
      if (profile.unlockedSkinIds.includes(skin.id)) return;
      const u = skin.unlock;
      let unlocked = false;
      if (u.type === "roundsPlayed") unlocked = profile.stats.totalRounds >= u.value;
      if (u.type === "placeBets") unlocked = profile.stats.betsPlacedSession >= u.value;
      if (u.type === "winRounds") unlocked = profile.stats.totalWins >= u.value;
      if (u.type === "cashouts") unlocked = profile.stats.totalCashouts >= u.value;
      if (u.type === "cashoutUnder") unlocked = profile.stats.cashoutUnder2 >= u.value;
      if (u.type === "profitTotal") unlocked = profile.stats.totalProfit >= u.value;
      if (u.type === "dailyStreak") unlocked = profile.streaks.dailyLogin >= u.value;
      if (u.type === "reachMultiplier") unlocked = profile.stats.highestMultiplier >= u.value;
      if (u.type === "biggestWin") unlocked = profile.stats.biggestPayout >= u.value;
      if (u.type === "highestBalance") unlocked = profile.stats.highestBalance >= u.value;
      if (u.type === "achievements") unlocked = profile.achievementsUnlocked.length >= u.value;
      if (unlocked) {
        profile.unlockedSkinIds.push(skin.id);
        ui.showToast("New Submarine Unlocked", `${skin.name} (${skin.rarity})`);
      }
    });
  }

  function evaluateAchievements() {
    const unlocked = new Set(profile.achievementsUnlocked);
    content.ACHIEVEMENTS.forEach((a) => {
      if (unlocked.has(a.id)) return;
      const r = a.rule;
      let pass = false;
      if (r.type === "roundsPlayed") pass = profile.stats.totalRounds >= r.value;
      if (r.type === "cashoutUnder") pass = profile.stats.cashoutUnder2 >= r.value;
      if (r.type === "reachMultiplier") pass = profile.stats.highestMultiplier >= r.value;
      if (r.type === "closeCall") pass = profile.stats.closeCalls >= r.value;
      if (r.type === "cashoutAround") pass = Math.abs(profile.stats.highestMultiplier - r.value) < 0.15;
      if (r.type === "winStreak") pass = profile.streaks.bestWin >= r.value;
      if (r.type === "totalBet") pass = profile.stats.totalBet >= r.value;
      if (r.type === "singleBet") pass = profile.stats.biggestSingleBet >= r.value;
      if (r.type === "highestBalance") pass = profile.stats.highestBalance >= r.value;
      if (r.type === "singleWin") pass = profile.stats.biggestPayout >= r.value;
      if (r.type === "dailyStreak") pass = profile.streaks.dailyLogin >= r.value;
      if (r.type === "luckyRoundWins") pass = profile.stats.luckyRoundWins >= r.value;
      if (r.type === "profitTotal") pass = profile.stats.totalProfit >= r.value;
      if (r.type === "cashouts") pass = profile.stats.totalCashouts >= r.value;
      if (r.type === "skinsUnlocked") pass = profile.unlockedSkinIds.length >= r.value;
      if (pass) {
        profile.achievementsUnlocked.push(a.id);
        ui.showToast("Achievement Unlocked", a.title);
      }
    });
  }

  function beginPreRound() {
    const roundRng = createRoundRng(gameState.nonce + 1);
    gameState.phase = "preRound";
    gameState.didCrash = false;
    gameState.hasCashedOut = false;
    gameState.currentMultiplier = 1;
    gameState.activeBet = 0;
    gameState.roundStartMs = 0;
    gameState.roundEndMs = 0;
    gameState.roundParticipation = {
      playerBetPlaced: false,
      betAmount: 0,
      playerJoinedRound: false,
      playerCashedOut: false
    };
    gameState.roundId = `round-${gameState.nonce + 1}`;
    gameState.crashPoint = generateCrashPoint();
    gameState.isLuckyRound = roundRng() < CONFIG.LUCKY_ROUND_CHANCE;
    gameState.countdownStartMs = Date.now();
    gameState.countdownDurationMs = 10000;
    ui.setPhase("Prepare your submarine...");
    ui.setLuckyRound(false);
    ui.setFairness(gameState.serverSeedHash.slice(0, 24), gameState.nonce);
    ui.setBetInfo(gameState.queuedBet, 0);
    updateCashOutButtonState();
    publishRoundState();
    if (profile.settings.autoBetEnabled && gameState.queuedBet === 0) setTimeout(() => placeBet(), 120);
  }

  function beginRound() {
    if (gameState.phase !== "preRound") return;
    gameState.phase = "active";
    gameState.roundStartMs = Date.now();
    gameState.activeBet = gameState.queuedBet;
    gameState.roundParticipation.playerJoinedRound = gameState.activeBet > 0;
    gameState.roundParticipation.betAmount = gameState.activeBet;
    gameState.queuedBet = 0;
    ui.setPhase(gameState.activeBet > 0 ? "Dive in progress! Cash out before implosion." : "Spectating this dive");
    ui.setLuckyRound(gameState.isLuckyRound);
    updateCashOutButtonState();
    publishRoundState();
  }

  function onWinPayout(payout, multiplier) {
    if (!didPlayerParticipateInRound()) return;
    profile.stats.totalWins += 1;
    profile.stats.totalCashouts += 1;
    profile.streaks.win += 1;
    profile.streaks.bestWin = Math.max(profile.streaks.bestWin, profile.streaks.win);
    if (profile.streaks.win === 3) { profile.balance += 25; profile.stats.streak3Hits += 1; }
    if (profile.streaks.win === 5) { profile.balance += 80; profile.stats.streak5Hits += 1; }
    profile.stats.biggestPayout = Math.max(profile.stats.biggestPayout, payout);
    profile.stats.highestMultiplier = Math.max(profile.stats.highestMultiplier, multiplier);
    if (multiplier < 2) profile.stats.cashoutUnder2 += 1;
    if (multiplier >= 5) profile.stats.cashoutOver5 += 1;
    if (multiplier >= 25) profile.stats.reach25Hits += 1;
    if (multiplier >= 50) profile.stats.reach50Hits += 1;
    if (multiplier >= 100) profile.stats.reach100Hits += 1;
    if (gameState.isLuckyRound) profile.stats.luckyRoundWins += 1;
    updateChallenges("cashoutCountSession", 1);
    if (multiplier >= 5) updateChallenges("cashoutOver5", 1);
    if (multiplier >= 25) updateChallenges("reach25Session", 1);
    if (multiplier >= 50) updateChallenges("reach50Session", 1);
  }

  function onLoss() {
    if (!didPlayerParticipateInRound()) return;
    profile.stats.totalLosses += 1;
    profile.streaks.win = 0;
  }

  function closeRoundAfterCrash() {
    dataService.submitLeaderboardScore({ metric: "highestMultiplier", value: profile.stats.highestMultiplier });
    dataService.submitLeaderboardScore({ metric: "biggestWin", value: profile.stats.biggestPayout });
    dataService.submitLeaderboardScore({ metric: "highestBalance", value: profile.stats.highestBalance });
    dataService.submitLeaderboardScore({ metric: "longestStreak", value: profile.streaks.bestWin });
    dataService.submitLeaderboardScore({ metric: "daily", value: profile.stats.profitSession });
    dataService.submitLeaderboardScore({ metric: "weekly", value: profile.stats.totalProfit });
    gameState.activeBet = 0;
    gameState.roundParticipation.playerJoinedRound = false;
    gameState.roundParticipation.playerBetPlaced = false;
    gameState.roundParticipation.betAmount = 0;
    gameState.roundParticipation.playerCashedOut = false;
    gameState.nonce += 1;
    saveAll();
    renderAllPanels();
    setTimeout(beginPreRound, 2400);
  }

  function crashRound() {
    gameState.phase = "crashed";
    gameState.didCrash = true;
    gameState.roundEndMs = Date.now();
    gameState.currentMultiplier = gameState.crashPoint;
    gameState.lastCrash = gameState.crashPoint;
    ui.setCrashPoint(gameState.crashPoint);
    ui.pushHistory(gameState.crashPoint);
    if (gameState.activeBet > 0 && !gameState.hasCashedOut) {
      ui.setPhase("Submarine imploded. Bet lost.");
      ui.setBetInfo(0, 0);
      gameState.autoLosses += 1;
      onLoss();
      publishLiveBet("lost");
    } else {
      ui.setPhase("Round ended.");
    }
    ui.setLuckyRound(false);
    animations.triggerCrashExplosion();
    updateCashOutButtonState();
    publishRoundState();
    closeRoundAfterCrash();
  }

  function placeBet() {
    if (gameState.phase !== "preRound") return;
    if (gameState.queuedBet > 0) return;
    const requested = clamp(Number(ui.getBetInputValue().toFixed(2)), 0.01, profile.balance);
    if (requested > profile.balance || requested <= 0) return;
    gameState.queuedBet = requested;
    gameState.roundParticipation.playerBetPlaced = true;
    gameState.roundParticipation.betAmount = requested;
    profile.balance = Number((profile.balance - requested).toFixed(2));
    profile.stats.totalBet += requested;
    profile.stats.biggestSingleBet = Math.max(profile.stats.biggestSingleBet || 0, requested);
    profile.stats.betsPlacedSession += 1;
    updateChallenges("betsPlacedSession", 1);
    ui.setBalance(profile.balance);
    ui.setBetInfo(gameState.queuedBet, gameState.queuedBet);
    ui.setPhase(`Bet locked: ${ui.formatMoney(gameState.queuedBet)}`);
    publishLiveBet("active");
    syncLiveBets(true);
    saveAll();
  }

  function cashOut(source) {
    if (!didPlayerParticipateInRound()) return;
    if (!updateCashOutButtonState()) return;
    gameState.hasCashedOut = true;
    gameState.roundParticipation.playerCashedOut = true;
    const bonus = gameState.isLuckyRound ? CONFIG.LUCKY_ROUND_PAYOUT_BONUS : 1;
    const winnings = Number((gameState.activeBet * gameState.currentMultiplier * bonus).toFixed(2));
    profile.balance = Number((profile.balance + winnings).toFixed(2));
    profile.stats.profitSession += winnings - gameState.activeBet;
    profile.stats.totalProfit = profile.balance - 1000;
    profile.stats.highestBalance = Math.max(profile.stats.highestBalance, profile.balance);
    profile.stats.closeCalls += (gameState.crashPoint - gameState.currentMultiplier <= 0.2 ? 1 : 0);
    gameState.autoWins += 1;
    onWinPayout(winnings, gameState.currentMultiplier);
    ui.setBalance(profile.balance);
    ui.setPhase(source === "auto" ? "Auto cash out successful!" : "Cash out successful!");
    ui.setBetInfo(0, winnings);
    animations.spawnCashoutDiver(winnings);
    publishLiveBet("cashed");
    updateCashOutButtonState();
  }

  function publishRoundState() {
    if (typeof dataService.publishLiveRound !== "function") return;
    dataService.publishLiveRound({
      roundId: gameState.roundId,
      phase: gameState.phase,
      nonce: gameState.nonce,
      crashPoint: gameState.crashPoint,
      isLuckyRound: gameState.isLuckyRound,
      countdownStartMs: gameState.countdownStartMs,
      countdownDurationMs: gameState.countdownDurationMs,
      roundStartMs: gameState.roundStartMs,
      roundEndMs: gameState.roundEndMs,
      publishedAt: Date.now()
    });
  }

  function applyLiveRoundState(state) {
    if (!state || !state.phase || !state.roundId) return;
    const publishedAt = Number(state.publishedAt || 0);
    if (publishedAt && publishedAt <= gameState.lastSharedStateAt) return;

    const localRoundNum = Number(String(gameState.roundId || "").split("-")[1] || 0);
    const incomingRoundNum = Number(String(state.roundId || "").split("-")[1] || 0);
    if (incomingRoundNum < localRoundNum) return;
    if (incomingRoundNum === localRoundNum) {
      const localRank = PHASE_RANK[gameState.phase] || 0;
      const incomingRank = PHASE_RANK[state.phase] || 0;
      if (incomingRank < localRank) return;
    }

    gameState.lastSharedStateAt = publishedAt || Date.now();
    gameState.roundId = state.roundId;
    gameState.phase = state.phase;
    gameState.nonce = Number(state.nonce || gameState.nonce);
    gameState.crashPoint = Number(state.crashPoint || gameState.crashPoint);
    gameState.isLuckyRound = !!state.isLuckyRound;
    gameState.countdownStartMs = Number(state.countdownStartMs || gameState.countdownStartMs || Date.now());
    gameState.countdownDurationMs = Number(state.countdownDurationMs || 10000);
    gameState.roundStartMs = Number(state.roundStartMs || 0);
    gameState.roundEndMs = Number(state.roundEndMs || 0);
    gameState.didCrash = gameState.phase === "crashed";
    if (gameState.phase === "preRound") {
      gameState.activeBet = 0;
      gameState.hasCashedOut = false;
    }
    ui.setLuckyRound(gameState.isLuckyRound);
  }

  async function syncSharedRoundState(force = false) {
    if (typeof dataService.fetchLatestLiveRound !== "function") return;
    const now = Date.now();
    if (!force && now - gameState.lastSharedSyncAt < CONFIG.SHARED_SYNC_MS) return;
    gameState.lastSharedSyncAt = now;
    const latest = await dataService.fetchLatestLiveRound();
    if (!latest) {
      if (!gameState.roundId) beginPreRound();
      return;
    }
    applyLiveRoundState(latest);
  }

  function publishLiveBet(status) {
    if (typeof dataService.publishLiveBet !== "function") return;
    const betAmount = gameState.roundParticipation.betAmount || gameState.queuedBet || gameState.activeBet || 0;
    if (betAmount <= 0) return;
    dataService.publishLiveBet({
      roundId: gameState.roundId,
      status,
      amount: betAmount,
      displayName: typeof dataService.getCurrentDisplayName === "function"
        ? dataService.getCurrentDisplayName()
        : "Player"
    });
  }

  async function syncLiveBets(force = false) {
    if (typeof dataService.fetchLiveBets !== "function" || !gameState.roundId) return;
    const now = Date.now();
    if (!force && now - gameState.lastLiveBetsSyncAt < 1200) return;
    gameState.lastLiveBetsSyncAt = now;
    const bets = await dataService.fetchLiveBets(gameState.roundId);
    ui.renderLiveBets(bets);
  }

  function maybeRunRealtimeChallengeReset(nowMs) {
    if (nowMs - gameState.lastChallengeRealtimeCheckAt < 30000) return;
    gameState.lastChallengeRealtimeCheckAt = nowMs;
    const dailyKey = window.GameDataService.todayKey();
    const weeklyKey = window.GameDataService.startOfWeekKey();
    if (profile.challenges.dailyKey !== dailyKey || profile.challenges.weeklyKey !== weeklyKey) {
      maybeResetChallenges();
      saveAll();
      renderAllPanels();
    }
  }

  function adjustBetInput(delta) { ui.setBetInputValue(clamp(ui.getBetInputValue() + delta, 0.01, Math.max(0.01, profile.balance))); }
  function setBetInput(value) { ui.setBetInputValue(clamp(value, 0.01, Math.max(0.01, profile.balance))); }
  function onBetInputChange() { ui.setBetInputValue(clamp(ui.getBetInputValue(), 0.01, Math.max(0.01, profile.balance))); }
  function onAudioToggle(enabled) { profile.settings.audioEnabled = enabled; saveAll(); }

  function onAutoSettingsChanged() {
    const cfg = ui.getAutoBetConfig();
    profile.settings.autoBetEnabled = cfg.autoBetEnabled;
    profile.settings.autoCashEnabled = cfg.autoCashEnabled;
    profile.settings.autoCashTarget = cfg.autoCashTarget;
    profile.settings.autoStopAfterWins = cfg.stopAfterWins;
    profile.settings.autoStopAfterLosses = cfg.stopAfterLosses;
    profile.settings.autoStopBalanceBelow = cfg.stopBalanceBelow;
    saveAll();
  }
  async function onSignOut() {
    if (typeof dataService.signOut === "function") {
      await dataService.signOut();
    }
    window.location.href = "auth.html";
  }

  function onLeaderboardTabChange(tab) { refreshLeaderboard(tab); }
  function resetSave() {
    profile = window.GameDataService.buildDefaultProfile();
    applyLoginStreak();
    maybeResetChallenges();
    renderAllPanels();
    beginPreRound();
    saveAll();
  }

  function claimChallenge(id) {
    const all = [...profile.challenges.daily, ...profile.challenges.weekly];
    const target = all.find((c) => c.id === id);
    if (!target || !target.completed || target.claimed) return;
    target.claimed = true;
    const reward = target.goal > 100 ? 900 : 300;
    profile.balance = Number((profile.balance + reward).toFixed(2));
    ui.showToast("Challenge Reward", `+${ui.formatMoney(reward)}`);
    saveAll();
    renderAllPanels();
  }

  function evaluateProgression() {
    evaluateSkinUnlocks();
    evaluateAchievements();
  }

  function handleRoundMetrics() {
    if (!didPlayerParticipateInRound()) return;
    profile.stats.totalRounds += 1;
    profile.stats.roundsPlayedSession += 1;
    updateChallenges("roundsPlayedSession", 1);
    updateChallenges("profitSession", Math.max(0, profile.stats.profitSession));
    updateChallenges("streak3Hits", profile.stats.streak3Hits > 0 ? 1 : 0);
    updateChallenges("streak5Hits", profile.stats.streak5Hits > 0 ? 1 : 0);
    updateChallenges("bigWin2kHits", profile.stats.biggestPayout >= 2000 ? 1 : 0);
    evaluateProgression();
  }

  function evaluateAutoCashout() {
    if (!profile.settings.autoCashEnabled) return;
    if (gameState.phase === "active" && !gameState.hasCashedOut && gameState.activeBet > 0 && gameState.currentMultiplier >= profile.settings.autoCashTarget) {
      cashOut("auto");
    }
  }

  function evaluateAutoStopConditions() {
    const s = profile.settings;
    if ((s.autoStopAfterWins > 0 && gameState.autoWins >= s.autoStopAfterWins)
      || (s.autoStopAfterLosses > 0 && gameState.autoLosses >= s.autoStopAfterLosses)
      || (s.autoStopBalanceBelow > 0 && profile.balance < s.autoStopBalanceBelow)) {
      profile.settings.autoBetEnabled = false;
      ui.applyAutoBetConfig(profile.settings);
      ui.showToast("Auto Bet Stopped", "A stop condition was reached.");
      gameState.autoWins = 0;
      gameState.autoLosses = 0;
      saveAll();
    }
  }

  function tick() {
    const now = Date.now();
    maybeRunRealtimeChallengeReset(now);
    syncSharedRoundState();
    syncLiveBets();
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
      if (didPlayerParticipateInRound()) {
        CONFIG.MILESTONES.forEach((m) => {
          if (Math.abs(gameState.currentMultiplier - m) < 0.015) ui.showMilestone(`Milestone ${m.toFixed(0)}x reached!`);
        });
      }
      if (gameState.currentMultiplier >= gameState.crashPoint) {
        handleRoundMetrics();
        crashRound();
      } else {
        ui.setBetInfo(gameState.activeBet, gameState.activeBet > 0 ? gameState.activeBet * gameState.currentMultiplier : 0);
        evaluateAutoCashout();
      }
    } else if (gameState.phase === "crashed") {
      ui.setCountdown(Math.max(0, (2400 - (now - gameState.roundEndMs)) / 1000));
      evaluateAutoStopConditions();
    }
    updateCashOutButtonState();
    const depthNorm = depthNormFromMultiplier(gameState.currentMultiplier);
    ui.setMultiplier(gameState.currentMultiplier);
    ui.setDepth(depthNorm);
    animations.setSceneState({
      multiplier: gameState.currentMultiplier,
      depthNorm,
      isActiveRound: gameState.phase === "active",
      didCrash: gameState.didCrash,
      isLuckyRound: gameState.isLuckyRound && gameState.phase === "active",
      equippedSkin: getEquippedSkin().colors
    });
  }

  function runCrashDistributionTest(rounds = 100) {
    const buckets = { "1x-1.99x": 0, "2x-4.99x": 0, "5x-9.99x": 0, "10x-49.99x": 0, "50x-99.99x": 0, "100x-999.99x": 0, "1000x-10000x": 0 };
    const values = [];
    for (let i = 0; i < rounds; i += 1) {
      const p = generateCrashPoint();
      values.push(p);
      if (p < 2) buckets["1x-1.99x"] += 1;
      else if (p < 5) buckets["2x-4.99x"] += 1;
      else if (p < 10) buckets["5x-9.99x"] += 1;
      else if (p < 50) buckets["10x-49.99x"] += 1;
      else if (p < 100) buckets["50x-99.99x"] += 1;
      else if (p < 1000) buckets["100x-999.99x"] += 1;
      else buckets["1000x-10000x"] += 1;
    }
    console.log(`Crash distribution test (${rounds} rounds)`);
    console.table(buckets);
    console.log(values.map((v) => `${v.toFixed(2)}x`).join(", "));
  }

  async function init() {
    if (typeof dataService.requireAuthUser === "function") {
      const user = await dataService.requireAuthUser();
      if (!user) {
        window.location.href = "auth.html";
        return;
      }
    }
    profile = dataService.loadPlayerProfile();
    initFairnessSeed();
    applyLoginStreak();
    maybeResetChallenges();
    ui.bindControls({ placeBet, cashOut, adjustBetInput, setBetInput, onBetInputChange, onAutoSettingsChanged, resetSave, onAudioToggle, onLeaderboardTabChange, onSignOut });
    document.addEventListener("click", (event) => {
      const claimBtn = event.target.closest(".claim-btn");
      if (claimBtn) claimChallenge(claimBtn.dataset.claimId);
    });
    window.addEventListener("equip-skin", (event) => {
      const id = event.detail;
      if (!profile.unlockedSkinIds.includes(id)) return;
      profile.equippedSkinId = id;
      saveAll();
      renderAllPanels();
    });
    renderAllPanels();
    if (typeof dataService.syncFromBackend === "function") {
      dataService.syncFromBackend().then((remoteProfile) => {
        if (!remoteProfile) return;
        profile = remoteProfile;
        renderAllPanels();
      });
    }
    ui.setBetInputValue(1);
    ui.setCrashPoint(0);
    await syncSharedRoundState(true);
    if (!gameState.roundId) {
      beginPreRound();
    } else {
      syncLiveBets(true);
    }
    if (CONFIG.DEV_TOOLS_ENABLED) window.runCrashDistributionTest = runCrashDistributionTest;
    requestAnimationFrame(function frame() { tick(); requestAnimationFrame(frame); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { init(); });
  else init();
})();
