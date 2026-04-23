(function () {
  const SAVE_KEY = "submarine_crash_save_v2";
  const SAVE_VERSION = 2;

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function startOfWeekKey() {
    const date = new Date();
    const day = date.getUTCDay();
    const diff = (day + 6) % 7;
    date.setUTCDate(date.getUTCDate() - diff);
    return date.toISOString().slice(0, 10);
  }

  function buildDefaultProfile() {
    return {
      saveVersion: SAVE_VERSION,
      balance: 1000,
      equippedSkinId: "classic",
      unlockedSkinIds: ["classic"],
      achievementsUnlocked: [],
      challenges: {
        dailyKey: todayKey(),
        weeklyKey: startOfWeekKey(),
        daily: [],
        weekly: []
      },
      streaks: {
        win: 0,
        bestWin: 0,
        dailyLogin: 1,
        lastLoginDate: todayKey()
      },
      stats: {
        totalRounds: 0,
        totalWins: 0,
        totalLosses: 0,
        highestMultiplier: 1,
        biggestPayout: 0,
        highestBalance: 1000,
        totalProfit: 0,
        totalBet: 0,
        totalCashouts: 0,
        luckyRoundWins: 0,
        closeCalls: 0,
        cashoutUnder2: 0,
        cashoutOver5: 0,
        reach25Hits: 0,
        reach50Hits: 0,
        reach100Hits: 0,
        streak3Hits: 0,
        streak5Hits: 0,
        bigWin2kHits: 0,
        roundsPlayedSession: 0,
        betsPlacedSession: 0,
        cashoutCountSession: 0,
        profitSession: 0
      },
      settings: {
        audioEnabled: true,
        autoBetEnabled: false,
        autoCashEnabled: false,
        autoCashTarget: 2,
        autoStopAfterWins: 0,
        autoStopAfterLosses: 0,
        autoStopBalanceBelow: 0
      },
      leaderboardMockSeed: Date.now()
    };
  }

  function migrateSave(raw) {
    const defaults = buildDefaultProfile();
    const merged = {
      ...defaults,
      ...raw,
      challenges: { ...defaults.challenges, ...(raw.challenges || {}) },
      streaks: { ...defaults.streaks, ...(raw.streaks || {}) },
      stats: { ...defaults.stats, ...(raw.stats || {}) },
      settings: { ...defaults.settings, ...(raw.settings || {}) }
    };
    merged.saveVersion = SAVE_VERSION;
    return merged;
  }

  class DataService {
    loadPlayerProfile() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return buildDefaultProfile();
        const parsed = JSON.parse(raw);
        return migrateSave(parsed);
      } catch (error) {
        console.warn("Failed to load save data, fallback to defaults.", error);
        return buildDefaultProfile();
      }
    }

    savePlayerProfile(profile) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(migrateSave(profile)));
    }

    saveStats(stats) {
      // TODO: BACKEND replace with API call.
      const profile = this.loadPlayerProfile();
      profile.stats = { ...profile.stats, ...stats };
      this.savePlayerProfile(profile);
    }

    loadChallenges() {
      // TODO: BACKEND replace with API call.
      return this.loadPlayerProfile().challenges;
    }

    submitLeaderboardScore(payload) {
      // TODO: BACKEND replace with API call.
      const key = "submarine_crash_leaderboard_submissions";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push({ ...payload, submittedAt: Date.now() });
      localStorage.setItem(key, JSON.stringify(existing.slice(-100)));
    }
  }

  window.GameDataService = {
    create: () => new DataService(),
    buildDefaultProfile,
    todayKey,
    startOfWeekKey
  };
})();
