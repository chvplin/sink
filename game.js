(function () {
  const CONFIG = {
    DEV_TOOLS_ENABLED: true,
    LUCKY_ROUND_CHANCE: 0.05,
    LUCKY_ROUND_PAYOUT_BONUS: 2,
    MILESTONES: [2, 5, 10, 25, 50, 100],
    SHARED_SYNC_MS: 300,
    // Smooth ramp curve: normal speed at 1.00x, slight acceleration continuously.
    // dM/dt at t=0 is START_RATE_PER_SEC, then scales up exponentially over time.
    MULTIPLIER_START_RATE_PER_SEC: 0.45,
    MULTIPLIER_GROWTH_PER_SEC: 0.05
  };
  const PHASE_RANK = { preRound: 1, active: 2, crashed: 3 };
  const content = window.ProgressionContent;
  const dataService = window.GameDataService.create();
  const ui = new window.GameUI();
  const animations = new window.GameAnimations("scene-canvas", "depth-tint");
  let profile = dataService.loadPlayerProfile();
  let currentLeaderboardTab = "highestMultiplier";
  let recoveryHubUserClosed = false;

  const gameState = {
    phase: "preRound",
    pendingRoundMode: "normal",
    roundMode: "normal",
    playerEligibleForRewards: true,
    queuedBet: 0,
    activeBet: 0,
    currentMultiplier: 1,
    crashPoint: 1,
    countdownStartMs: 0,
    countdownDurationMs: 0,
    roundStartMs: 0,
    roundEndMs: 0,
    roundId: "",
    roundHostUserId: "",
    isRoundHost: false,
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
    lastChallengeRealtimeCheckAt: 0,
    lastChatPollAt: 0,
    lastJoinPollAt: 0,
    seenJoinKeys: new Set(),
    joinPollPrimed: false,
    stallRecoveryAttemptForRound: "",
    lastVisibilityResyncAt: 0,
    serverAuthoritativeRounds: false,
    globalRoundRow: null,
    serverTimeOffsetMs: 0,
    _globalRoundUnsub: null,
    _serverRoundFetchAt: 0,
    _serverHandledCrashSeq: null,
    _serverCountdownSyncedSeq: null,
    _serverJoinedRoundSeq: null,
    _lastServerOffsetRefresh: 0,
    _agentDbgTickLogAt: 0,
    _serverModeRetryAt: 0,
    _lastFailsafeTickAt: 0,
    _lastGlobalRefetchAt: 0,
    _lastLiveBetsSnapshot: [],
    postRoundSummaryVisible: false,
    _postRoundSummaryRoundSeq: null,
    _sessionCashoutMult: null,
    _sessionCashoutPayout: null
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
    if (isGlobalMode()) {
      syncLog("Blocked legacy generateCrashPoint() in global mode");
      return gameState.crashPoint || 1;
    }
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
  function multiplierFromElapsedMs(ms) {
    const t = ms / 1000;
    const growth = Math.max(0.0001, CONFIG.MULTIPLIER_GROWTH_PER_SEC);
    const startRate = Math.max(0.01, CONFIG.MULTIPLIER_START_RATE_PER_SEC);
    const scale = startRate / growth;
    const value = 1 + scale * (Math.exp(growth * t) - 1);
    return clamp(value, 1, 10000);
  }
  function multiplierFromElapsedMsWithCurve(ms, growthPerSec, startRatePerSec) {
    const t = ms / 1000;
    const growth = Math.max(0.0001, growthPerSec);
    const startRate = Math.max(0.01, startRatePerSec);
    const scale = startRate / growth;
    const value = 1 + scale * (Math.exp(growth * t) - 1);
    return clamp(value, 1, 10000);
  }
  function serverNowMs() {
    return Date.now() + (gameState.serverTimeOffsetMs || 0);
  }
  function isGlobalMode() {
    return typeof dataService.useGlobalAuthoritativeRounds === "function" && dataService.useGlobalAuthoritativeRounds() === true;
  }
  function syncLog(...args) {
    console.warn("[SYNC]", ...args);
  }
  /** Avoid stale HTTP poll responses overwriting newer Realtime state (out-of-order completion). */
  function shouldReplaceGlobalRoundRow(incoming, cur) {
    if (!incoming) return false;
    if (!cur) return true;
    const is = Number(incoming.round_seq);
    const cs = Number(cur.round_seq);
    if (is > cs) return true;
    if (is < cs) return false;
    const iu = incoming.updated_at ? new Date(incoming.updated_at).getTime() : 0;
    const cu = cur.updated_at ? new Date(cur.updated_at).getTime() : 0;
    if (iu > cu) return true;
    if (iu < cu) return false;
    const R = { countdown: 1, active: 2, crashed: 3, settling: 4 };
    return (R[incoming.status] || 0) >= (R[cur.status] || 0);
  }
  async function refreshServerTimeOffset() {
    if (!dataService.supabase || typeof dataService.rpcServerNowMs !== "function") return;
    const ms = await dataService.rpcServerNowMs();
    // #region agent log
    fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-B", location: "game.js:refreshServerTimeOffset", message: "rpc server_now_ms result", data: { rpcMs: ms == null ? null : ms, offsetAfter: ms == null ? null : (ms - Date.now()) }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    if (ms == null) return;
    gameState.serverTimeOffsetMs = ms - Date.now();
    gameState._lastServerOffsetRefresh = Date.now();
    syncLog("server offset refreshed", `${gameState.serverTimeOffsetMs}ms`);
  }
  function depthNormFromMultiplier(multiplier) { return clamp(Math.log10(multiplier) / Math.log10(10000), 0, 1); }

  function getEquippedSkin() {
    const catalog = content.COSMETIC_SHOP_ITEMS || [];
    const subId = profile.equippedCosmetics && profile.equippedCosmetics.submarine;
    if (subId) {
      const item = catalog.find((i) => i.id === subId && i.category === "submarines");
      if (item && item.skinMap) {
        const byCosmetic = content.SUBMARINE_SKINS.find((s) => s.id === item.skinMap);
        if (byCosmetic) return byCosmetic;
      }
    }
    return content.SUBMARINE_SKINS.find((s) => s.id === profile.equippedSkinId) || content.SUBMARINE_SKINS[0];
  }

  function getCosmeticVisualState() {
    const catalog = content.COSMETIC_SHOP_ITEMS || [];
    const ec = profile.equippedCosmetics || {};
    const trailItem = ec.trail ? catalog.find((i) => i.id === ec.trail && i.category === "trails") : null;
    const crashItem = ec.crashEffect ? catalog.find((i) => i.id === ec.crashEffect && i.category === "crashEffects") : null;
    const diverItem = ec.diverSuit ? catalog.find((i) => i.id === ec.diverSuit && i.category === "diverSuits") : null;
    return {
      trailKey: trailItem && trailItem.trailKey ? trailItem.trailKey : "default",
      crashKey: crashItem && crashItem.crashKey ? crashItem.crashKey : "default",
      diverKey: diverItem && diverItem.diverKey ? diverItem.diverKey : "default"
    };
  }

  function dismissPostRoundSummary() {
    gameState.postRoundSummaryVisible = false;
    gameState._postRoundSummaryRoundSeq = null;
    gameState._sessionCashoutMult = null;
    gameState._sessionCashoutPayout = null;
    ui.hidePostRoundSummary();
  }

  function maybeShowPostRoundSummary(ctx) {
    const rows = [];
    const isPractice = !!ctx.isPractice;
    let outcome = "Spectated";
    if (isPractice && ctx.hadBet) outcome = "Practice (no balance)";
    else if (!ctx.hadBet) outcome = "Spectated";
    else if (ctx.cashed) outcome = "Won";
    else outcome = "Lost";

    rows.push(["Crash", `${ctx.crashMult.toFixed(2)}×`]);
    rows.push(["Your result", outcome]);
    rows.push(["Bet", ctx.hadBet ? ui.formatMoney(ctx.betAmount) : "—"]);

    let cashMultLabel = "—";
    let payoutLabel = "—";
    if (ctx.cashed && ctx.sessionCashoutMult != null) {
      cashMultLabel = `${Number(ctx.sessionCashoutMult).toFixed(2)}×`;
      payoutLabel = isPractice ? "— (practice)" : ui.formatMoney(Number(ctx.sessionCashoutPayout) || 0);
    }
    rows.push(["Cashout mult", cashMultLabel]);
    rows.push(["Payout", payoutLabel]);

    let profitLabel = "—";
    if (ctx.hadBet && !isPractice) {
      if (ctx.cashed) profitLabel = ui.formatMoney((Number(ctx.sessionCashoutPayout) || 0) - ctx.betAmount);
      else profitLabel = ui.formatMoney(-ctx.betAmount);
    } else if (ctx.hadBet && isPractice) {
      profitLabel = "—";
    }
    rows.push(["Profit / loss", profitLabel]);

    const snap = ctx.liveSnap || [];
    if (snap.length) {
      const top = snap.reduce((best, cur) => (cur.amount > best.amount ? cur : best), snap[0]);
      rows.push(["Largest live stake", `${top.name || "Player"} · ${ui.formatMoney(top.amount)}`]);
      rows.push(["On live board (active)", `${snap.length} player(s)`]);
      rows.push(["Cashed out / imploded (live)", "No aggregate data this round."]);
    } else {
      rows.push(["Fleet live data", "No player data this round."]);
    }

    gameState.postRoundSummaryVisible = true;
    gameState._postRoundSummaryRoundSeq = ctx.roundSeqNum;
    ui.showPostRoundSummary({ rows, nextDiveText: "" });
  }

  function renderCosmeticShopPanel() {
    const catalog = content.COSMETIC_SHOP_ITEMS;
    if (!catalog || !ui.el.panelShop) return;
    ui.renderCosmeticShop(profile, catalog, {
      onPreview(item) {
        if (!ui.el.shopPreviewBody) return;
        ui.el.shopPreviewBody.textContent = "";
        const wrap = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = item.name || "";
        const meta = document.createElement("div");
        meta.className = "cosmetic-shop-card__meta";
        meta.textContent = `${item.rarity || "Common"} · ${item.price <= 0 ? "Starter" : ui.formatMoney(item.price)}`;
        wrap.appendChild(title);
        wrap.appendChild(meta);
        ui.el.shopPreviewBody.appendChild(wrap);
      }
    });
  }

  function onCosmeticShopCategory(cat) {
    ui.setCosmeticShopCategory(cat);
    renderCosmeticShopPanel();
  }

  function buyCosmeticItem(itemId) {
    const catalog = content.COSMETIC_SHOP_ITEMS || [];
    const item = catalog.find((i) => i.id === itemId);
    if (!item) {
      ui.showToast("Shop", "Item not found.");
      return;
    }
    const ownedArr = profile.ownedCosmetics[item.category] || [];
    if (ownedArr.includes(itemId)) {
      ui.showToast("Shop", "You already own this.");
      return;
    }
    if (item.price > 0 && profile.balance < item.price) {
      ui.showToast("Shop", "Insufficient balance.");
      return;
    }
    if (item.price > 0) profile.balance = Number((profile.balance - item.price).toFixed(2));
    profile.ownedCosmetics[item.category] = [...ownedArr, itemId];
    saveAll();
    ui.showToast("Shop", `Purchased ${item.name}.`);
    ui.setBalance(profile.balance);
    renderCosmeticShopPanel();
    renderAllPanels();
  }

  function equipCosmeticItem(itemId) {
    const catalog = content.COSMETIC_SHOP_ITEMS || [];
    const item = catalog.find((i) => i.id === itemId);
    if (!item) {
      ui.showToast("Shop", "Item not found.");
      return;
    }
    const ownedArr = profile.ownedCosmetics[item.category] || [];
    if (!ownedArr.includes(itemId)) {
      ui.showToast("Shop", "Equip after purchase.");
      return;
    }
    const slotMap = {
      submarines: "submarine",
      trails: "trail",
      diverSuits: "diverSuit",
      crashEffects: "crashEffect",
      profileFrames: "profileFrame"
    };
    const slot = slotMap[item.category];
    if (!slot) return;
    profile.equippedCosmetics[slot] = itemId;
    saveAll();
    ui.showToast("Shop", `Equipped ${item.name}.`);
    renderCosmeticShopPanel();
    renderAllPanels();
  }

  function onPostRoundSummaryClose() {
    dismissPostRoundSummary();
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

  function getCurrentUserId() {
    return dataService.user ? dataService.user.id : "";
  }

  function refreshHostRole() {
    const me = getCurrentUserId();
    if (!gameState.roundHostUserId) {
      gameState.isRoundHost = true;
      return;
    }
    gameState.isRoundHost = !!(me && me === gameState.roundHostUserId);
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
    if (window.PlayerRecovery) window.PlayerRecovery.syncFreePlayWithBalance(profile);
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
    if (window.PlayerRecovery) {
      window.PlayerRecovery.syncFreePlayWithBalance(profile);
      window.PlayerRecovery.ensureRecovery(profile);
    }
    if (!window.PlayerRecovery || !window.PlayerRecovery.isBroke(profile)) {
      recoveryHubUserClosed = false;
      ui.setRecoveryHubOpen(false);
    } else if (!recoveryHubUserClosed) {
      ui.setRecoveryHubOpen(true);
    }
    ui.updateDebtIndicator(profile);
    ui.updateRecoveryHub(profile, gameState);
    ui.updateRoundModeBanner(gameState.phase === "active" ? gameState.roundMode : "normal");
    ui.setCrewAidVisible(!!(window.PlayerRecovery && window.PlayerRecovery.isBroke(profile)));
    ui.setBalance(profile.balance);
    ui.setStreaks(profile.streaks.win, profile.streaks.dailyLogin);
    ui.renderCollection(content.SUBMARINE_SKINS, profile.unlockedSkinIds, profile.equippedSkinId);
    ui.applyProfileFrame(profile);
    renderCosmeticShopPanel();
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
      if (u.type === "crewRescueBonus") unlocked = false;
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
    if (isGlobalMode()) {
      syncLog("Blocked legacy beginPreRound() in global mode");
      return;
    }
    dismissPostRoundSummary();
    gameState.stallRecoveryAttemptForRound = "";
    const roundRng = createRoundRng(gameState.nonce + 1);
    gameState.phase = "preRound";
    gameState.roundMode = "normal";
    gameState.playerEligibleForRewards = true;
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
    if (gameState.queuedBet > 0) {
      gameState.roundParticipation.playerBetPlaced = true;
      gameState.roundParticipation.betAmount = gameState.queuedBet;
    }
    gameState.roundId = `round-${gameState.nonce + 1}`;
    gameState.roundHostUserId = getCurrentUserId();
    refreshHostRole();
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
    if (isGlobalMode()) {
      syncLog("Blocked legacy beginRound() in global mode");
      return;
    }
    if (gameState.phase !== "preRound") return;
    gameState.phase = "active";
    const scheduledStart = gameState.countdownStartMs + gameState.countdownDurationMs;
    const nowMs = Date.now();
    gameState.roundStartMs = scheduledStart > nowMs + 2000 ? nowMs : Math.min(Math.max(scheduledStart, nowMs - 80), nowMs + 2000);
    const pending = gameState.pendingRoundMode || "normal";
    gameState.pendingRoundMode = "normal";
    gameState.roundMode = pending === "free_play" ? "free_play" : (pending === "second_chance" ? "second_chance" : "normal");
    gameState.playerEligibleForRewards = gameState.roundMode !== "free_play";
    if (window.PlayerRecovery) {
      const prs = window.PlayerRecovery.ensureRecovery(profile);
      if (gameState.roundMode === "second_chance") {
        prs.secondChanceUsesToday = (prs.secondChanceUsesToday || 0) + 1;
        prs.secondChanceLastUsed = Date.now();
      }
      if (gameState.roundMode === "free_play") {
        prs.freePlayRoundsAvailable = Math.max(0, (prs.freePlayRoundsAvailable || 0) - 1);
      }
    }
    gameState.activeBet = gameState.queuedBet;
    gameState.roundParticipation.playerJoinedRound = gameState.activeBet > 0;
    gameState.roundParticipation.betAmount = gameState.activeBet;
    gameState.queuedBet = 0;
    ui.updateRoundModeBanner(gameState.roundMode);
    ui.setPhase(gameState.activeBet > 0 ? "Dive in progress! Cash out before implosion." : "Spectating this dive");
    ui.setLuckyRound(gameState.isLuckyRound);
    updateCashOutButtonState();
    publishRoundState();
  }

  function onWinPayout(payout, multiplier) {
    if (!didPlayerParticipateInRound()) return;
    if (!gameState.playerEligibleForRewards) return;
    profile.stats.totalWins += 1;
    profile.stats.totalCashouts += 1;
    profile.streaks.win += 1;
    profile.streaks.bestWin = Math.max(profile.streaks.bestWin, profile.streaks.win);
    if (profile.streaks.win === 3) {
      if (window.PlayerRecovery) window.PlayerRecovery.creditBalanceFromGrossWinnings(profile, 25);
      else profile.balance = Number((profile.balance + 25).toFixed(2));
      profile.stats.streak3Hits += 1;
    }
    if (profile.streaks.win === 5) {
      if (window.PlayerRecovery) window.PlayerRecovery.creditBalanceFromGrossWinnings(profile, 80);
      else profile.balance = Number((profile.balance + 80).toFixed(2));
      profile.stats.streak5Hits += 1;
    }
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
    if (!gameState.playerEligibleForRewards) return;
    profile.stats.totalLosses += 1;
    profile.streaks.win = 0;
  }

  function closeRoundAfterCrash(scheduleNextRound = true) {
    if (gameState.playerEligibleForRewards) {
      dataService.submitLeaderboardScore({ metric: "highestMultiplier", value: profile.stats.highestMultiplier });
      dataService.submitLeaderboardScore({ metric: "biggestWin", value: profile.stats.biggestPayout });
      dataService.submitLeaderboardScore({ metric: "highestBalance", value: profile.stats.highestBalance });
      dataService.submitLeaderboardScore({ metric: "longestStreak", value: profile.streaks.bestWin });
      dataService.submitLeaderboardScore({ metric: "daily", value: profile.stats.profitSession });
      dataService.submitLeaderboardScore({ metric: "weekly", value: profile.stats.totalProfit });
    }
    gameState.activeBet = 0;
    gameState.roundParticipation.playerJoinedRound = false;
    gameState.roundParticipation.playerBetPlaced = false;
    gameState.roundParticipation.betAmount = 0;
    gameState.roundParticipation.playerCashedOut = false;
    if (!gameState.serverAuthoritativeRounds) {
      gameState.nonce += 1;
    }
    saveAll();
    renderAllPanels();
    if (!gameState.serverAuthoritativeRounds && scheduleNextRound) {
      setTimeout(() => {
        beginPreRound();
      }, 2400);
    }
  }

  /** Shared UI + payouts when a round ends at crashPoint (host drives publish/schedule). */
  function runLocalCrashPresentation() {
    const liveSnap = Array.isArray(gameState._lastLiveBetsSnapshot) ? gameState._lastLiveBetsSnapshot.slice() : [];
    const roundSeqNum = Number(String(gameState.roundId || "").replace(/^round-/, "")) || null;
    const rp = gameState.roundParticipation;
    const betAmount = Number(rp.betAmount || gameState.activeBet || 0);
    const joined = !!rp.playerJoinedRound;
    const betPlaced = !!rp.playerBetPlaced;
    const hadBet = betPlaced && joined && betAmount > 0;
    const cashed = !!gameState.hasCashedOut;
    const crashMult = gameState.crashPoint;
    const isPractice = gameState.roundMode === "free_play";
    const sessionCashoutMult = gameState._sessionCashoutMult;
    const sessionCashoutPayout = gameState._sessionCashoutPayout;

    gameState.currentMultiplier = gameState.crashPoint;
    gameState.lastCrash = gameState.crashPoint;
    ui.setCrashPoint(gameState.crashPoint);
    ui.pushHistory(gameState.crashPoint);
    if (gameState.activeBet > 0 && !gameState.hasCashedOut) {
      ui.setPhase("Submarine imploded. Bet lost.");
      ui.setBetInfo(0, 0);
      gameState.autoLosses += 1;
      onLoss();
      const nm = window.PlayerRecovery && window.PlayerRecovery.shouldShowNearMiss({
        crashPoint: gameState.crashPoint,
        hadRealBet: true,
        lost: true,
        roundMode: gameState.roundMode
      });
      if (nm) ui.showToast(nm.title, nm.body, "toast-near-miss");
      if (gameState.roundMode !== "free_play") publishLiveBet("lost");
    } else {
      ui.setPhase("Round ended.");
    }
    ui.setLuckyRound(false);
    animations.triggerCrashExplosion();
    updateCashOutButtonState();

    maybeShowPostRoundSummary({
      liveSnap,
      roundSeqNum,
      hadBet,
      cashed,
      betAmount,
      crashMult,
      isPractice,
      sessionCashoutMult,
      sessionCashoutPayout
    });
  }

  function crashRound({ publish = true, scheduleNextRound = true } = {}) {
    if (isGlobalMode()) {
      syncLog("Blocked legacy crashRound() in global mode");
      return;
    }
    gameState.phase = "crashed";
    gameState.didCrash = true;
    gameState.roundEndMs = Date.now();
    runLocalCrashPresentation();
    if (publish) {
      publishRoundState();
    }
    closeRoundAfterCrash(scheduleNextRound);
  }

  /** Non-host clients: apply the same crash outcome when the host’s published state reaches us. */
  function mirrorCrashFromSharedState(prevPhase, sharedRoundId) {
    if (prevPhase !== "active" || sharedRoundId !== gameState.roundId) return;
    handleRoundMetrics();
    runLocalCrashPresentation();
  }

  function syncServerNewCountdownRow(row) {
    dismissPostRoundSummary();
    gameState.stallRecoveryAttemptForRound = "";
    gameState.phase = "preRound";
    gameState.roundMode = "normal";
    gameState.pendingRoundMode = "normal";
    gameState.playerEligibleForRewards = true;
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
    if (gameState.queuedBet > 0) {
      gameState.roundParticipation.playerBetPlaced = true;
      gameState.roundParticipation.betAmount = gameState.queuedBet;
    }
    gameState.roundHostUserId = "";
    gameState.isRoundHost = false;
    const fair = row && row.id ? String(row.id).replace(/-/g, "").slice(0, 24) : gameState.serverSeedHash.slice(0, 24);
    gameState.serverSeedHash = fair;
    ui.setPhase("Prepare your submarine...");
    ui.setLuckyRound(false);
    ui.setFairness(fair, Math.max(0, Number(row.round_seq) - 1));
    ui.setBetInfo(gameState.queuedBet, 0);
    updateCashOutButtonState();
    gameState._serverCountdownSyncedSeq = Number(row.round_seq);
    gameState._serverJoinedRoundSeq = null;
    if (profile.settings.autoBetEnabled && gameState.queuedBet === 0) setTimeout(() => placeBet(), 120);
  }

  function syncLocalBeginRoundFromServer() {
    const row = gameState.globalRoundRow;
    const seq = row ? Number(row.round_seq) : NaN;
    if (!row || !Number.isFinite(seq)) return;
    if (gameState._serverJoinedRoundSeq === seq) return;
    gameState._serverJoinedRoundSeq = seq;
    const pending = gameState.pendingRoundMode || "normal";
    gameState.pendingRoundMode = "normal";
    gameState.roundMode = pending === "free_play" ? "free_play" : (pending === "second_chance" ? "second_chance" : "normal");
    gameState.playerEligibleForRewards = gameState.roundMode !== "free_play";
    if (window.PlayerRecovery) {
      const prs = window.PlayerRecovery.ensureRecovery(profile);
      if (gameState.roundMode === "second_chance") {
        prs.secondChanceUsesToday = (prs.secondChanceUsesToday || 0) + 1;
        prs.secondChanceLastUsed = Date.now();
      }
      if (gameState.roundMode === "free_play") {
        prs.freePlayRoundsAvailable = Math.max(0, (prs.freePlayRoundsAvailable || 0) - 1);
      }
    }
    gameState.activeBet = gameState.queuedBet;
    gameState.roundParticipation.playerJoinedRound = gameState.activeBet > 0;
    gameState.roundParticipation.betAmount = gameState.activeBet;
    gameState.queuedBet = 0;
    ui.updateRoundModeBanner(gameState.roundMode);
    ui.setPhase(gameState.activeBet > 0 ? "Dive in progress! Cash out before implosion." : "Spectating this dive");
    ui.setLuckyRound(gameState.isLuckyRound);
    updateCashOutButtonState();
  }

  function primeServerRoundFromRow(row) {
    const clock = serverNowMs();
    const seq = Number(row.round_seq);
    const dur = Number(row.countdown_ms) || 10000;
    const cdEnd = new Date(row.countdown_ends_at).getTime();
    const crashAtMs = row.crash_at ? new Date(row.crash_at).getTime() : null;
    const crashedAtMs = row.crashed_at ? new Date(row.crashed_at).getTime() : null;
    gameState.isLuckyRound = !!row.is_lucky_round;
    gameState.crashPoint = Number(row.crash_point);

    if (row.status === "countdown" && clock < cdEnd) {
      gameState._serverJoinedRoundSeq = null;
      gameState._serverHandledCrashSeq = null;
      if (gameState._serverCountdownSyncedSeq !== seq) syncServerNewCountdownRow(row);
      return;
    }
    if (row.status === "crashed" || (crashAtMs != null && clock >= crashAtMs)) {
      gameState._serverHandledCrashSeq = seq;
      gameState._serverJoinedRoundSeq = seq;
      gameState._serverCountdownSyncedSeq = seq;
      gameState.phase = "crashed";
      gameState.didCrash = true;
      gameState.currentMultiplier = gameState.crashPoint;
      gameState.roundEndMs = crashedAtMs || crashAtMs || clock;
      gameState.roundId = `round-${seq}`;
      gameState.nonce = Math.max(0, seq - 1);
      ui.setCrashPoint(gameState.crashPoint);
      ui.setPhase("Round ended.");
      ui.setLuckyRound(false);
      updateCashOutButtonState();
      closeRoundAfterCrash(false);
      return;
    }
    gameState._serverHandledCrashSeq = null;
    gameState._serverJoinedRoundSeq = null;
    gameState._serverCountdownSyncedSeq = seq;
    gameState.roundId = `round-${seq}`;
    gameState.nonce = Math.max(0, seq - 1);
    gameState.phase = "preRound";
    gameState.didCrash = false;
    gameState.hasCashedOut = false;
    gameState.currentMultiplier = 1;
    gameState.roundParticipation.playerJoinedRound = false;
    gameState.roundParticipation.playerCashedOut = false;
    gameState.roundParticipation.playerBetPlaced = gameState.queuedBet > 0;
    gameState.roundParticipation.betAmount = gameState.queuedBet;
    gameState.activeBet = 0;
    gameState.roundHostUserId = "";
    gameState.isRoundHost = false;
    const fair = row.id ? String(row.id).replace(/-/g, "").slice(0, 24) : gameState.serverSeedHash.slice(0, 24);
    gameState.serverSeedHash = fair;
    ui.setFairness(fair, Math.max(0, seq - 1));
    ui.setLuckyRound(gameState.isLuckyRound);
    ui.setBetInfo(gameState.queuedBet, 0);
    ui.setPhase("Prepare your submarine...");
    updateCashOutButtonState();
  }

  async function refetchGlobalRound(reason) {
    const now = Date.now();
    if (now - gameState._lastGlobalRefetchAt < 900) return;
    gameState._lastGlobalRefetchAt = now;
    const row = await dataService.fetchLatestGlobalRound();
    if (!row) {
      syncLog("poll failure", reason);
      return;
    }
    if (shouldReplaceGlobalRoundRow(row, gameState.globalRoundRow)) {
      gameState.globalRoundRow = row;
      syncLog("global round fetched", { reason, seq: row.round_seq, status: row.status });
    } else {
      syncLog("stale row rejected", { reason, incomingSeq: row.round_seq, currentSeq: gameState.globalRoundRow ? gameState.globalRoundRow.round_seq : null });
    }
  }

  async function safeServerTick(reason) {
    const now = Date.now();
    if (now - gameState._lastFailsafeTickAt < 3000) return;
    gameState._lastFailsafeTickAt = now;
    syncLog("server tick failsafe", reason);
    if (typeof dataService.invokeGlobalGameTick === "function") {
      await dataService.invokeGlobalGameTick();
    }
    await refetchGlobalRound("post-failsafe-tick");
  }

  function tickServerRounds(clock) {
    const row = gameState.globalRoundRow;
    if (!row) {
      ui.setPhase("Syncing to global round...");
      ui.setCountdown(0);
      return;
    }

    const seq = Number(row.round_seq);
    const dur = Number(row.countdown_ms) || 10000;
    const cdEnd = new Date(row.countdown_ends_at).getTime();
    const cdStart = cdEnd - dur;
    const actStartMs = row.active_started_at ? new Date(row.active_started_at).getTime() : null;
    const crashAtMsRaw = row.crash_at ? new Date(row.crash_at).getTime() : null;
    const crashAtMs = Number.isFinite(crashAtMsRaw) ? crashAtMsRaw : null;
    const crashedAtMs = row.crashed_at ? new Date(row.crashed_at).getTime() : null;
    const growth = Number(row.growth_per_sec) || CONFIG.MULTIPLIER_GROWTH_PER_SEC;
    const startRate = Number(row.start_rate_per_sec) || CONFIG.MULTIPLIER_START_RATE_PER_SEC;

    let gamePhase;
    if (row.status === "countdown" && clock < cdEnd) {
      gamePhase = "preRound";
    } else if (row.status === "crashed" || (crashAtMs != null && clock >= crashAtMs)) {
      gamePhase = "crashed";
    } else {
      gamePhase = "active";
    }

    const prevPhase = gameState.phase;
    const effectiveActiveStart = (actStartMs != null && !Number.isNaN(actStartMs)) ? actStartMs : cdEnd;

    gameState.roundId = `round-${seq}`;
    gameState.nonce = Math.max(0, seq - 1);
    gameState.crashPoint = Number(row.crash_point);
    gameState.isLuckyRound = !!row.is_lucky_round;
    gameState.countdownDurationMs = dur;
    gameState.countdownStartMs = cdStart;

    if (gamePhase === "preRound") {
      if (prevPhase === "crashed" && gameState.postRoundSummaryVisible) {
        dismissPostRoundSummary();
      }
      if (gameState._serverCountdownSyncedSeq !== seq) {
        syncServerNewCountdownRow(row);
      }
      gameState.phase = "preRound";
      gameState.roundStartMs = 0;
      const elapsed = clock - gameState.countdownStartMs;
      const remaining = Math.max(0, (gameState.countdownDurationMs - elapsed) / 1000);
      ui.setCountdown(remaining);
    } else if (gamePhase === "active") {
      if (gameState._serverJoinedRoundSeq !== seq) {
        syncLocalBeginRoundFromServer();
      }
      gameState.phase = "active";
      gameState.roundStartMs = effectiveActiveStart;
      const elapsed = clock - effectiveActiveStart;
      const rawMultiplier = multiplierFromElapsedMsWithCurve(elapsed, growth, startRate);
      const capped = Math.min(rawMultiplier, gameState.crashPoint);
      gameState.currentMultiplier = Number(capped.toFixed(2));
      if (!crashAtMs && rawMultiplier >= gameState.crashPoint) {
        syncLog("active round missing crash_time; rendering crash locally", { seq, multiplier: gameState.currentMultiplier, crashPoint: gameState.crashPoint });
        gameState.phase = "crashed";
        gameState.didCrash = true;
        gameState.roundEndMs = clock;
        if (gameState._serverHandledCrashSeq !== seq) {
          gameState._serverHandledCrashSeq = seq;
          if (prevPhase === "active" || gameState.activeBet > 0) {
            handleRoundMetrics();
            runLocalCrashPresentation();
          }
          closeRoundAfterCrash(false);
        }
        void refetchGlobalRound("missing-crash-time");
        void safeServerTick("missing-crash-time");
        return;
      }
      if (didPlayerParticipateInRound()) {
        CONFIG.MILESTONES.forEach((m) => {
          if (Math.abs(gameState.currentMultiplier - m) < 0.015) ui.showMilestone(`Milestone ${m.toFixed(0)}x reached!`);
        });
      }
      ui.setBetInfo(gameState.activeBet, gameState.activeBet > 0 ? gameState.activeBet * gameState.currentMultiplier : 0);
      evaluateAutoCashout();
      if (crashAtMs && clock > crashAtMs + 1500) {
        syncLog("Active round exceeded crash_time, rendering crash locally", { seq, now: clock, crashAtMs });
        void refetchGlobalRound("active-over-crash-time");
        void safeServerTick("active-over-crash-time");
      }
    } else {
      if (gameState._serverJoinedRoundSeq !== seq && gameState.queuedBet > 0) {
        syncLocalBeginRoundFromServer();
      }
      gameState.phase = "crashed";
      gameState.roundStartMs = effectiveActiveStart;
      gameState.currentMultiplier = gameState.crashPoint;
      gameState.roundEndMs = crashedAtMs || crashAtMs || clock;

      if (gameState._serverHandledCrashSeq !== seq) {
        gameState._serverHandledCrashSeq = seq;
        gameState.didCrash = true;
        if (prevPhase === "active" || gameState.activeBet > 0) {
          handleRoundMetrics();
          runLocalCrashPresentation();
        }
        closeRoundAfterCrash(false);
      }

      const endAnchor = crashedAtMs || crashAtMs || gameState.roundEndMs;
      ui.setCountdown(Math.max(0, (2400 - (clock - endAnchor)) / 1000));
      evaluateAutoStopConditions();
      if (clock > endAnchor + 6500) {
        syncLog("crashed round stale; syncing next dive", { seq, now: clock, endAnchor });
        ui.setPhase("Syncing next dive...");
        void refetchGlobalRound("stale-crashed-round");
        void safeServerTick("stale-crashed-round");
      }
    }
  }

  async function initServerAuthoritativeRounds() {
    gameState.serverAuthoritativeRounds = false;
    if (typeof dataService.useGlobalAuthoritativeRounds !== "function" || !dataService.useGlobalAuthoritativeRounds()) {
      // #region agent log
      fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-A", location: "game.js:initServerAuthoritativeRounds", message: "server rounds disabled", data: { hasMethod: typeof dataService.useGlobalAuthoritativeRounds === "function", flag: typeof dataService.useGlobalAuthoritativeRounds === "function" ? !!dataService.useGlobalAuthoritativeRounds() : null }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      return false;
    }
    try {
      await refreshServerTimeOffset();
      let row = null;
      for (let attempt = 0; attempt < 4 && !row; attempt += 1) {
        row = await dataService.fetchLatestGlobalRound();
      }
      if (!row) {
        syncLog("global_rounds empty on init; attempting server tick");
        await safeServerTick("init-empty-row");
        row = await dataService.fetchLatestGlobalRound();
      }
      if (!row) {
        console.warn("global_rounds: no rows yet after failsafe tick. Verify schedule for global-game-tick (~1s).");
        // #region agent log
        fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-A", location: "game.js:initServerAuthoritativeRounds", message: "fetchLatestGlobalRound empty after retries", data: { attempts: 4 }, timestamp: Date.now() }) }).catch(() => {});
        try { console.warn("[SYNCDBG357a69]", "H-A", "global_rounds fetch empty after 4 attempts"); } catch (e) { /* ignore */ }
        // #endregion
        return false;
      }
      if (gameState._globalRoundUnsub) {
        try { gameState._globalRoundUnsub(); } catch (e) { /* ignore */ }
        gameState._globalRoundUnsub = null;
      }
      gameState.serverAuthoritativeRounds = true;
      gameState.isRoundHost = false;
      gameState.globalRoundRow = row;
      primeServerRoundFromRow(row);
      gameState._globalRoundUnsub = dataService.subscribeGlobalRounds((incoming) => {
        if (!incoming) return;
        if (!shouldReplaceGlobalRoundRow(incoming, gameState.globalRoundRow)) return;
        gameState.globalRoundRow = incoming;
        // #region agent log
        fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-C", location: "game.js:subscribeGlobalRounds", message: "realtime row", data: { round_seq: incoming.round_seq, status: incoming.status }, timestamp: Date.now() }) }).catch(() => {});
        // #endregion
      }, (channelStatus) => {
        if (channelStatus !== "SUBSCRIBED") {
          gameState._serverRoundFetchAt = 0;
        }
      });
      // #region agent log
      fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-A", location: "game.js:initServerAuthoritativeRounds", message: "server rounds enabled", data: { round_seq: row.round_seq, status: row.status }, timestamp: Date.now() }) }).catch(() => {});
      try { console.warn("[SYNCDBG357a69]", "H-A", "server rounds enabled", { round_seq: row.round_seq, status: row.status }); } catch (e) { /* ignore */ }
      // #endregion
      return true;
    } catch (e) {
      console.warn("initServerAuthoritativeRounds failed", e);
      // #region agent log
      fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-A", location: "game.js:initServerAuthoritativeRounds", message: "init exception", data: { err: String(e && e.message ? e.message : e) }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      return false;
    }
  }

  function wantsGlobalServerMode() {
    return isGlobalMode();
  }

  function tickClientRounds(now) {
    if (isGlobalMode()) {
      syncLog("Blocked legacy tickClientRounds() in global mode");
      return;
    }
    if (gameState.phase === "preRound") {
      const elapsed = now - gameState.countdownStartMs;
      const remaining = Math.max(0, (gameState.countdownDurationMs - elapsed) / 1000);
      ui.setCountdown(remaining);
      if (gameState.isRoundHost && elapsed >= gameState.countdownDurationMs) {
        beginRound();
      }
    } else if (gameState.phase === "active") {
      const elapsed = now - gameState.roundStartMs;
      const rawMultiplier = multiplierFromElapsedMs(elapsed);
      const capped = Math.min(rawMultiplier, gameState.crashPoint);
      gameState.currentMultiplier = Number(capped.toFixed(2));
      if (didPlayerParticipateInRound()) {
        CONFIG.MILESTONES.forEach((m) => {
          if (Math.abs(gameState.currentMultiplier - m) < 0.015) ui.showMilestone(`Milestone ${m.toFixed(0)}x reached!`);
        });
      }
      if (gameState.isRoundHost && rawMultiplier >= gameState.crashPoint) {
        handleRoundMetrics();
        crashRound({
          publish: true,
          scheduleNextRound: true
        });
      } else {
        ui.setBetInfo(gameState.activeBet, gameState.activeBet > 0 ? gameState.activeBet * gameState.currentMultiplier : 0);
        evaluateAutoCashout();
      }
    } else if (gameState.phase === "crashed") {
      ui.setCountdown(Math.max(0, (2400 - (now - gameState.roundEndMs)) / 1000));
      evaluateAutoStopConditions();
    }
  }

  function placeBet() {
    if (gameState.phase !== "preRound") return;
    if (gameState.queuedBet > 0) return;
    const requested = clamp(Number(ui.getBetInputValue().toFixed(2)), 0.01, profile.balance);
    if (requested > profile.balance || requested <= 0) return;
    gameState.pendingRoundMode = "normal";
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

  function queueSecondChanceDive() {
    if (gameState.phase !== "preRound" || gameState.queuedBet > 0) return;
    const PR = window.PlayerRecovery;
    if (!PR) return;
    const chk = PR.canUseSecondChance(profile);
    if (!chk.ok) {
      ui.showToast("Last Chance Dive", chk.message || "Unavailable");
      return;
    }
    gameState.pendingRoundMode = "second_chance";
    gameState.queuedBet = PR.CONFIG.SECOND_CHANCE_WAGER;
    gameState.roundParticipation.playerBetPlaced = true;
    gameState.roundParticipation.betAmount = gameState.queuedBet;
    ui.setBetInfo(gameState.queuedBet, gameState.queuedBet);
    ui.setPhase(`Last chance locked: ${ui.formatMoney(gameState.queuedBet)}`);
    publishLiveBet("active");
    syncLiveBets(true);
    saveAll();
    renderAllPanels();
  }

  function queueFreePlayDive() {
    if (gameState.phase !== "preRound" || gameState.queuedBet > 0) return;
    const PR = window.PlayerRecovery;
    if (!PR) return;
    const chk = PR.canStartFreePlay(profile);
    if (!chk.ok) {
      ui.showToast("Practice Dive", chk.message || "Unavailable");
      return;
    }
    gameState.pendingRoundMode = "free_play";
    gameState.queuedBet = 100;
    gameState.roundParticipation.playerBetPlaced = true;
    gameState.roundParticipation.betAmount = gameState.queuedBet;
    ui.setBetInfo(gameState.queuedBet, gameState.queuedBet);
    ui.setPhase("Practice dive locked — no rewards, no balance risk");
    saveAll();
    renderAllPanels();
  }

  function openRecoveryHub() {
    recoveryHubUserClosed = false;
    ui.setRecoveryHubOpen(true);
    renderAllPanels();
  }

  function onRecoveryAction(action) {
    const PR = window.PlayerRecovery;
    if (!PR) return;
    if (action === "close-hub") {
      recoveryHubUserClosed = true;
      ui.setRecoveryHubOpen(false);
      return;
    }
    if (action === "claim-emergency") {
      const r = PR.claimEmergencyFunding(profile);
      if (!r.ok) ui.showToast("Emergency Funding", r.message || "Unavailable");
      else ui.showToast("Emergency Crew Funding", `Your crew secured ${ui.formatMoney(r.amount)}. ${r.remaining} bailout(s) left today.`);
      saveAll();
      renderAllPanels();
      return;
    }
    if (action === "claim-daily") {
      const r = PR.claimDailyBonus(profile, content);
      if (!r.ok) ui.showToast("Daily Bonus", "Not ready to claim yet.");
      else {
        ui.showToast("Daily Crew Ration", `Day ${r.day} ration: ${ui.formatMoney(r.amount)}${r.day === 7 ? " · Rescue Crew Livery unlocked!" : ""}`);
      }
      saveAll();
      renderAllPanels();
      return;
    }
    if (action === "start-second") {
      queueSecondChanceDive();
      return;
    }
    if (action === "start-free") {
      queueFreePlayDive();
      return;
    }
    if (action === "take-loan") {
      const r = PR.takeLoan(profile, gameState.phase);
      if (!r.ok) ui.showToast("Bridge Credit", r.message || "Unavailable");
      else ui.showToast("Bridge Credit", `Crew took ${ui.formatMoney(r.principal)}. Debt ${ui.formatMoney(r.debt)} at ${r.mult}x.`);
      saveAll();
      renderAllPanels();
      return;
    }
  }

  function cashOut(source) {
    if (!didPlayerParticipateInRound()) return;
    if (!updateCashOutButtonState()) return;
    gameState.hasCashedOut = true;
    gameState.roundParticipation.playerCashedOut = true;
    const bonus = gameState.isLuckyRound ? CONFIG.LUCKY_ROUND_PAYOUT_BONUS : 1;
    const winnings = Number((gameState.activeBet * gameState.currentMultiplier * bonus).toFixed(2));
    gameState._sessionCashoutMult = gameState.currentMultiplier;
    gameState._sessionCashoutPayout = winnings;
    if (gameState.roundMode === "free_play") {
      ui.showToast("Practice Dive", "Training cashout — no balance change.");
    } else if (window.PlayerRecovery) {
      window.PlayerRecovery.creditBalanceFromGrossWinnings(profile, winnings);
      profile.stats.profitSession += winnings - gameState.activeBet;
      profile.stats.totalProfit = profile.balance - 1000;
      profile.stats.highestBalance = Math.max(profile.stats.highestBalance, profile.balance);
      profile.stats.closeCalls += (gameState.crashPoint - gameState.currentMultiplier <= 0.2 ? 1 : 0);
      gameState.autoWins += 1;
      onWinPayout(winnings, gameState.currentMultiplier);
    } else {
      profile.balance = Number((profile.balance + winnings).toFixed(2));
      profile.stats.profitSession += winnings - gameState.activeBet;
      profile.stats.totalProfit = profile.balance - 1000;
      profile.stats.highestBalance = Math.max(profile.stats.highestBalance, profile.balance);
      profile.stats.closeCalls += (gameState.crashPoint - gameState.currentMultiplier <= 0.2 ? 1 : 0);
      gameState.autoWins += 1;
      onWinPayout(winnings, gameState.currentMultiplier);
    }
    ui.setBalance(profile.balance);
    ui.setPhase(source === "auto" ? "Auto cash out successful!" : "Cash out successful!");
    ui.setBetInfo(0, winnings);
    animations.spawnCashoutDiver(winnings, getCosmeticVisualState().diverKey);
    if (gameState.roundMode !== "free_play") publishLiveBet("cashed");
    updateCashOutButtonState();
    saveAll();
  }

  function publishRoundState() {
    if (gameState.serverAuthoritativeRounds) return;
    if (typeof dataService.publishLiveRound !== "function") return;
    if (!gameState.isRoundHost) return;
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
    if (gameState.serverAuthoritativeRounds) return;
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

    const prevRoundId = gameState.roundId;
    const prevPhase = gameState.phase;
    const reanchorTimes = state.roundId !== prevRoundId || state.phase !== prevPhase;

    gameState.lastSharedStateAt = publishedAt || Date.now();
    gameState.roundId = state.roundId;
    gameState.roundHostUserId = state.publisherUserId || gameState.roundHostUserId || "";
    refreshHostRole();
    gameState.phase = state.phase;
    gameState.nonce = Number(state.nonce || gameState.nonce);
    gameState.crashPoint = Number(state.crashPoint || gameState.crashPoint);
    gameState.isLuckyRound = !!state.isLuckyRound;

    const pub = publishedAt || Date.now();
    const dur = Number(
      state.countdownDurationMs != null && state.countdownDurationMs !== ""
        ? state.countdownDurationMs
        : 10000
    );
    gameState.countdownDurationMs = dur;

    const rawCountdownStart = Number(
      state.countdownStartMs != null && state.countdownStartMs !== ""
        ? state.countdownStartMs
        : Date.now()
    );
    const rawRoundStart = Number(state.roundStartMs || 0);
    const rawRoundEnd = Number(state.roundEndMs || 0);

    if (reanchorTimes) {
      if (gameState.phase === "preRound" && rawCountdownStart) {
        const hostElapsedPre = clamp(pub - rawCountdownStart, 0, dur);
        gameState.countdownStartMs = Date.now() - hostElapsedPre;
      } else if (gameState.phase === "preRound") {
        gameState.countdownStartMs = Date.now();
      }

      if (gameState.phase === "active" && rawRoundStart > 0) {
        const hostElapsedActive = clamp(pub - rawRoundStart, 0, 900000);
        gameState.roundStartMs = Date.now() - hostElapsedActive;
      } else {
        gameState.roundStartMs = rawRoundStart;
      }

      if (gameState.phase === "crashed" && rawRoundEnd > 0) {
        const hostElapsedCrash = clamp(pub - rawRoundEnd, 0, 900000);
        gameState.roundEndMs = Date.now() - hostElapsedCrash;
      } else {
        gameState.roundEndMs = rawRoundEnd;
      }
    }

    gameState.didCrash = gameState.phase === "crashed";
    if (gameState.phase === "preRound") {
      gameState.activeBet = 0;
      gameState.hasCashedOut = false;
    }
    if (gameState.phase === "active" && prevPhase === "preRound" && gameState.activeBet === 0 && gameState.queuedBet > 0) {
      gameState.activeBet = gameState.queuedBet;
      gameState.queuedBet = 0;
      gameState.roundParticipation.playerJoinedRound = gameState.activeBet > 0;
      gameState.roundParticipation.betAmount = gameState.activeBet;
      if (gameState.roundStartMs <= 0) {
        gameState.roundStartMs = gameState.countdownStartMs + gameState.countdownDurationMs;
      }
      ui.updateRoundModeBanner(gameState.roundMode);
      ui.setPhase(gameState.activeBet > 0 ? "Dive in progress! Cash out before implosion." : "Spectating this dive");
      ui.setBetInfo(gameState.activeBet, gameState.activeBet > 0 ? gameState.activeBet * gameState.currentMultiplier : 0);
    }
    if (gameState.phase === "active" && (!gameState.roundStartMs || gameState.roundStartMs <= 0)) {
      gameState.roundStartMs = gameState.countdownStartMs + gameState.countdownDurationMs;
    }
    ui.setLuckyRound(gameState.isLuckyRound);

    if (gameState.phase === "crashed" && prevPhase === "active" && state.roundId === prevRoundId) {
      mirrorCrashFromSharedState(prevPhase, state.roundId);
    }
  }

  async function syncSharedRoundState(force = false) {
    if (isGlobalMode()) {
      syncLog("Blocked legacy syncSharedRoundState() in global mode");
      return;
    }
    if (typeof dataService.fetchLatestLiveRound !== "function") return;
    const now = Date.now();
    if (!force && now - gameState.lastSharedSyncAt < CONFIG.SHARED_SYNC_MS) return;
    gameState.lastSharedSyncAt = now;
    const latest = await dataService.fetchLatestLiveRound();
    if (!latest) {
      if (!gameState.roundId) {
        gameState.roundHostUserId = getCurrentUserId();
        refreshHostRole();
        beginPreRound();
      }
      return;
    }
    applyLiveRoundState(latest);
  }

  function maybeRecoverStalledRound() {
    if (isGlobalMode()) {
      syncLog("Blocked legacy maybeRecoverStalledRound() in global mode");
      return;
    }
    if (gameState.phase !== "crashed" || !gameState.roundEndMs) return;
    if (Date.now() - gameState.roundEndMs < 5200) return;
    const rid = gameState.roundId;
    if (gameState.stallRecoveryAttemptForRound === rid) return;
    gameState.stallRecoveryAttemptForRound = rid;
    syncSharedRoundState(true).then(() => {
      if (gameState.phase !== "crashed" || gameState.roundId !== rid) return;
      gameState.roundHostUserId = getCurrentUserId();
      refreshHostRole();
      beginPreRound();
    });
  }

  async function pollSocialLayer(now) {
    if (!dataService.supabase || !dataService.user) return;
    if (now - gameState.lastChatPollAt > 1800) {
      gameState.lastChatPollAt = now;
      if (typeof dataService.fetchRecentChatMessages === "function") {
        const msgs = await dataService.fetchRecentChatMessages(40);
        ui.renderChatMessages(msgs);
      }
    }
    if (now - gameState.lastJoinPollAt > 2200) {
      gameState.lastJoinPollAt = now;
      if (typeof dataService.fetchRecentPlayerJoins === "function") {
        const joins = await dataService.fetchRecentPlayerJoins(20);
        const me = dataService.user.id;
        if (!gameState.joinPollPrimed) {
          gameState.joinPollPrimed = true;
          joins.forEach((j) => {
            if (j.userId && j.createdAt) gameState.seenJoinKeys.add(`${j.userId}|${j.createdAt}`);
          });
        } else {
          joins.forEach((j) => {
            const key = j.userId && j.createdAt ? `${j.userId}|${j.createdAt}` : "";
            if (!key || gameState.seenJoinKeys.has(key)) return;
            gameState.seenJoinKeys.add(key);
            if (!j.userId || j.userId === me) return;
            ui.showPlayerJoinBanner(j.displayName || "Someone");
          });
        }
      }
    }
  }

  function onChatSubmit(text) {
    if (!text || typeof dataService.sendChatMessage !== "function") return;
    dataService.sendChatMessage(text).then((ok) => {
      if (!ok) ui.showToast("Chat", "Message could not be sent.");
      else gameState.lastChatPollAt = 0;
    });
  }

  function publishLiveBet(status) {
    if (typeof dataService.publishLiveBet !== "function") return;
    if (gameState.pendingRoundMode === "free_play" || gameState.roundMode === "free_play") return;
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
    gameState._lastLiveBetsSnapshot = Array.isArray(bets) ? bets.map((b) => ({ name: b.name, amount: Number(b.amount) || 0 })) : [];
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
  function setMaxBet() {
    ui.setBetInputValue(Math.max(0.01, Number(profile.balance) || 0));
    onBetInputChange();
  }
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

  function claimChallenge(id) {
    const all = [...profile.challenges.daily, ...profile.challenges.weekly];
    const target = all.find((c) => c.id === id);
    if (!target || !target.completed || target.claimed) return;
    target.claimed = true;
    const reward = target.goal > 100 ? 900 : 300;
    profile.balance = Number((profile.balance + reward).toFixed(2));
    if (window.PlayerRecovery) window.PlayerRecovery.syncFreePlayWithBalance(profile);
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
    if (!gameState.playerEligibleForRewards) return;
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
    if (gameState.serverAuthoritativeRounds) {
      if (now - gameState._lastServerOffsetRefresh > 45000) {
        gameState._lastServerOffsetRefresh = now;
        void refreshServerTimeOffset();
      }
      if (now - gameState._serverRoundFetchAt > 1200) {
        gameState._serverRoundFetchAt = now;
        void refetchGlobalRound("poll");
      }
      if (now - gameState._agentDbgTickLogAt > 2000) {
        gameState._agentDbgTickLogAt = now;
        const gr = gameState.globalRoundRow;
        syncLog("active visual sample", {
          seq: gr ? gr.round_seq : null,
          status: gr ? gr.status : null,
          multiplier: gameState.currentMultiplier,
          phase: gameState.phase
        });
      }
      syncLiveBets();
      pollSocialLayer(now);
      tickServerRounds(serverNowMs());
    } else {
      if (wantsGlobalServerMode()) {
        if (now >= gameState._serverModeRetryAt) {
          gameState._serverModeRetryAt = now + 2000;
          syncLog("retry init server authoritative mode");
          void initServerAuthoritativeRounds().then((ok) => {
            syncLog("retry init result", { ok, serverAuthoritativeRounds: gameState.serverAuthoritativeRounds });
          });
        }
        ui.setPhase("Syncing to global round...");
        ui.setCountdown(0);
      } else {
      if (now - gameState._agentDbgTickLogAt > 3000) {
        gameState._agentDbgTickLogAt = now;
        // #region agent log
        fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-A", location: "game.js:tick.clientPath", message: "legacy client-driven tick", data: { phase: gameState.phase, roundId: gameState.roundId, isRoundHost: gameState.isRoundHost }, timestamp: Date.now() }) }).catch(() => {});
        try { console.warn("[SYNCDBG357a69]", "H-A", "legacy client-driven tick", { phase: gameState.phase, roundId: gameState.roundId, isRoundHost: gameState.isRoundHost }); } catch (e) { /* ignore */ }
        // #endregion
      }
      syncSharedRoundState();
      syncLiveBets();
      pollSocialLayer(now);
      maybeRecoverStalledRound();
      tickClientRounds(now);
      }
    }
    updateCashOutButtonState();
    const depthNorm = depthNormFromMultiplier(gameState.currentMultiplier);
    ui.setMultiplier(gameState.currentMultiplier);
    ui.setDepth(depthNorm);
    const cv = getCosmeticVisualState();
    animations.setSceneState({
      multiplier: gameState.currentMultiplier,
      depthNorm,
      isActiveRound: gameState.phase === "active",
      didCrash: gameState.didCrash,
      isLuckyRound: gameState.isLuckyRound && gameState.phase === "active",
      equippedSkin: getEquippedSkin().colors,
      cosmeticTrail: cv.trailKey,
      cosmeticCrash: cv.crashKey,
      cosmeticDiver: cv.diverKey
    });
    if (ui.isPostRoundSummaryVisible()) {
      const sec = ui.getCountdownSeconds();
      ui.updatePostRoundNextLine(`Next dive starts in ${sec.toFixed(1)}s`);
    }
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
    if (window.PlayerRecovery) window.PlayerRecovery.ensureRecovery(profile);
    initFairnessSeed();
    applyLoginStreak();
    maybeResetChallenges();
    ui.bindControls({
      placeBet,
      cashOut,
      adjustBetInput,
      setBetInput,
      setMaxBet,
      onBetInputChange,
      onAutoSettingsChanged,
      onAudioToggle,
      onLeaderboardTabChange,
      onSignOut,
      openRecoveryHub,
      onChatSubmit,
      buyCosmeticItem,
      equipCosmeticItem,
      onCosmeticShopCategory,
      onPostRoundSummaryClose
    });
    ui.bindRecoveryHub(onRecoveryAction);
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
    document.querySelectorAll('[data-tab="shop"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        renderCosmeticShopPanel();
      });
    });
    if (typeof dataService.syncFromBackend === "function") {
      dataService.syncFromBackend().then((remoteProfile) => {
        if (!remoteProfile) return;
        profile = remoteProfile;
        if (window.PlayerRecovery) window.PlayerRecovery.ensureRecovery(profile);
        renderAllPanels();
      });
    }
    ui.setBetInputValue(Math.min(10, Math.max(0.01, profile.balance)));
    ui.setCrashPoint(0);
    const serverRounds = await initServerAuthoritativeRounds();
    syncLog("global mode init outcome", { serverRounds, serverAuthoritativeRounds: gameState.serverAuthoritativeRounds });
    if (!serverRounds) {
      if (!wantsGlobalServerMode()) {
        await syncSharedRoundState(true);
        if (!gameState.roundId) {
          // #region agent log
          fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-G", location: "game.js:init", message: "fallback beginPreRound while global mode expected", data: { globalFlag: typeof dataService.useGlobalAuthoritativeRounds === "function" ? !!dataService.useGlobalAuthoritativeRounds() : null }, timestamp: Date.now() }) }).catch(() => {});
          try { console.warn("[SYNCDBG357a69]", "H-G", "fallback beginPreRound", { globalFlag: typeof dataService.useGlobalAuthoritativeRounds === "function" ? !!dataService.useGlobalAuthoritativeRounds() : null }); } catch (e) { /* ignore */ }
          // #endregion
          beginPreRound();
        } else {
          syncLiveBets(true);
        }
      } else {
        gameState._serverModeRetryAt = 0;
        void safeServerTick("init-syncing");
        ui.setPhase("Syncing to global round...");
        ui.setCountdown(0);
      }
    } else {
      syncLiveBets(true);
    }
    if (typeof dataService.announcePlayerSession === "function") {
      await dataService.announcePlayerSession();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const t = Date.now();
      if (t - gameState.lastVisibilityResyncAt < 800) return;
      gameState.lastVisibilityResyncAt = t;
      gameState.lastSharedSyncAt = 0;
      if (isGlobalMode()) {
        gameState._serverRoundFetchAt = 0;
        void refreshServerTimeOffset().then(async () => {
          await refetchGlobalRound("visibilitychange");
        });
      } else {
        syncSharedRoundState(true);
      }
    });
    if (CONFIG.DEV_TOOLS_ENABLED) window.runCrashDistributionTest = runCrashDistributionTest;
    requestAnimationFrame(function frame() { tick(); requestAnimationFrame(frame); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { init(); });
  else init();
})();
