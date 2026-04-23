(function () {
  const SAVE_KEY = "submarine_crash_save_v2";
  const SAVE_VERSION = 2;
  const PLAYER_ID_KEY = "submarine_player_id";
  const LEADERBOARD_LOCAL_KEY = "submarine_crash_leaderboard_submissions";

  function getOrCreateGuestPlayerId() {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (id) return id;
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      id = `guest_${window.crypto.randomUUID()}`;
    } else {
      id = `guest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    }
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  }

  function createSupabaseClient() {
    try {
      const cfg = window.SUPABASE_CONFIG || {};
      const hasConfig = !!(cfg.url && cfg.anonKey);
      const hasLib = !!(window.supabase && typeof window.supabase.createClient === "function");
      if (!hasConfig || !hasLib) return null;
      return window.supabase.createClient(cfg.url, cfg.anonKey);
    } catch (error) {
      console.warn("Supabase client creation failed, using local fallback.", error);
      return null;
    }
  }

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

  function loadLocalProfile(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return buildDefaultProfile();
      return migrateSave(JSON.parse(raw));
    } catch (error) {
      console.warn("Failed to load local save, fallback to defaults.", error);
      return buildDefaultProfile();
    }
  }

  function saveLocalProfile(profile, storageKey) {
    localStorage.setItem(storageKey, JSON.stringify(migrateSave(profile)));
  }

  class DataService {
    constructor() {
      this.playerId = getOrCreateGuestPlayerId();
      this.supabase = createSupabaseClient();
      this.user = null;
      this.storageKey = SAVE_KEY;
    }

    async getCurrentUser() {
      if (!this.supabase) return null;
      try {
        const { data, error } = await this.supabase.auth.getUser();
        if (error) return null;
        this.user = data.user || null;
        if (this.user) {
          this.playerId = this.user.id;
          this.storageKey = `${SAVE_KEY}_${this.user.id}`;
        }
        return this.user;
      } catch (error) {
        console.warn("Failed to get current auth user.", error);
        return null;
      }
    }

    async requireAuthUser() {
      const user = await this.getCurrentUser();
      if (user) return user;
      return null;
    }

    async signOut() {
      if (!this.supabase) return;
      await this.supabase.auth.signOut();
      this.user = null;
      this.playerId = getOrCreateGuestPlayerId();
      this.storageKey = SAVE_KEY;
    }

    loadPlayerProfile() {
      return loadLocalProfile(this.storageKey);
    }

    savePlayerProfile(profile) {
      const normalized = migrateSave(profile);
      saveLocalProfile(normalized, this.storageKey);
      this._saveProfileRemote(normalized);
    }

    saveStats(stats) {
      const profile = this.loadPlayerProfile();
      profile.stats = { ...profile.stats, ...stats };
      this.savePlayerProfile(profile);
    }

    loadChallenges() {
      return this.loadPlayerProfile().challenges;
    }

    submitLeaderboardScore(payload) {
      const existing = JSON.parse(localStorage.getItem(LEADERBOARD_LOCAL_KEY) || "[]");
      existing.push({ ...payload, submittedAt: Date.now() });
      localStorage.setItem(LEADERBOARD_LOCAL_KEY, JSON.stringify(existing.slice(-100)));
      this._submitLeaderboardRemote(payload);
    }

    async syncFromBackend() {
      const user = await this.getCurrentUser();
      if (!this.supabase || !user) return this.loadPlayerProfile();
      try {
        const { data, error } = await this.supabase
          .from("player_profiles")
          .select("profile")
          .eq("user_id", this.user.id)
          .maybeSingle();

        if (error) {
          console.warn("Supabase profile fetch failed, using local.", error);
          return this.loadPlayerProfile();
        }

        if (data && data.profile) {
          const merged = migrateSave(data.profile);
          saveLocalProfile(merged, this.storageKey);
          return merged;
        }

        const local = this.loadPlayerProfile();
        await this._saveProfileRemote(local);
        return local;
      } catch (error) {
        console.warn("Supabase sync failed, using local.", error);
        return this.loadPlayerProfile();
      }
    }

    async _saveProfileRemote(profile) {
      const user = await this.getCurrentUser();
      if (!this.supabase || !user) return;
      try {
        const { error } = await this.supabase
          .from("player_profiles")
          .upsert(
            {
              player_id: this.playerId,
              user_id: this.user.id,
              profile: migrateSave(profile),
              updated_at: new Date().toISOString()
            },
            { onConflict: "user_id" }
          );
        if (error) {
          console.warn("Supabase profile upsert failed.", error);
        }
      } catch (error) {
        console.warn("Supabase profile save error.", error);
      }
    }

    async _submitLeaderboardRemote(payload) {
      const user = await this.getCurrentUser();
      if (!this.supabase || !user) return;
      try {
        const { error } = await this.supabase.from("leaderboard_scores").insert({
          player_id: this.playerId,
          user_id: this.user.id,
          metric: payload.metric || "unknown",
          value: Number(payload.value || 0),
          payload
        });
        if (error) {
          console.warn("Supabase leaderboard insert failed.", error);
        }
      } catch (error) {
        console.warn("Supabase leaderboard submit error.", error);
      }
    }
  }

  window.GameDataService = {
    create: () => new DataService(),
    buildDefaultProfile,
    todayKey,
    startOfWeekKey
  };
})();
