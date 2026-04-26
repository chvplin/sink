(function () {
  const SAVE_KEY = "submarine_crash_save_v2";
  const SAVE_VERSION = 3;
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
        biggestSingleBet: 0,
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
      playerRecoveryState: {
        emergencyFundingUsesToday: 0,
        emergencyFundingLastReset: "",
        dailyBonusLastClaim: 0,
        dailyBonusNextRewardDay: 1,
        secondChanceLastUsed: 0,
        secondChanceUsesToday: 0,
        secondChanceLastReset: "",
        freePlayRoundsAvailable: 0,
        freePlayRefillOnNextZero: true,
        loanActive: false,
        loanPrincipal: 0,
        loanRepaymentMultiplier: 1.75,
        totalDebtRemaining: 0,
        loanNextEligibleAt: 0,
        loanInitialDebt: 0
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
      ownedCosmetics: {
        submarines: ["classic_submarine"],
        trails: [],
        diverSuits: [],
        crashEffects: [],
        profileFrames: []
      },
      equippedCosmetics: {
        submarine: "classic_submarine",
        trail: null,
        diverSuit: null,
        crashEffect: null,
        profileFrame: null
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
      settings: { ...defaults.settings, ...(raw.settings || {}) },
      playerRecoveryState: { ...defaults.playerRecoveryState, ...(raw.playerRecoveryState || {}) }
    };
    const defOc = defaults.ownedCosmetics;
    const rawOc = raw.ownedCosmetics;
    merged.ownedCosmetics = {
      submarines: Array.isArray(rawOc && rawOc.submarines) && rawOc.submarines.length ? rawOc.submarines : defOc.submarines,
      trails: Array.isArray(rawOc && rawOc.trails) ? rawOc.trails : defOc.trails,
      diverSuits: Array.isArray(rawOc && rawOc.diverSuits) ? rawOc.diverSuits : defOc.diverSuits,
      crashEffects: Array.isArray(rawOc && rawOc.crashEffects) ? rawOc.crashEffects : defOc.crashEffects,
      profileFrames: Array.isArray(rawOc && rawOc.profileFrames) ? rawOc.profileFrames : defOc.profileFrames
    };
    merged.equippedCosmetics = {
      ...defaults.equippedCosmetics,
      ...(raw.equippedCosmetics || {})
    };
    const own = (cat, id) => (merged.ownedCosmetics[cat] || []).includes(id);
    if (!own("submarines", merged.equippedCosmetics.submarine)) {
      merged.equippedCosmetics.submarine = defaults.equippedCosmetics.submarine;
    }
    if (merged.equippedCosmetics.trail && !own("trails", merged.equippedCosmetics.trail)) merged.equippedCosmetics.trail = null;
    if (merged.equippedCosmetics.diverSuit && !own("diverSuits", merged.equippedCosmetics.diverSuit)) merged.equippedCosmetics.diverSuit = null;
    if (merged.equippedCosmetics.crashEffect && !own("crashEffects", merged.equippedCosmetics.crashEffect)) merged.equippedCosmetics.crashEffect = null;
    if (merged.equippedCosmetics.profileFrame && !own("profileFrames", merged.equippedCosmetics.profileFrame)) merged.equippedCosmetics.profileFrame = null;
    merged.saveVersion = SAVE_VERSION;
    if (typeof window.PlayerRecovery !== "undefined" && window.PlayerRecovery.ensureRecovery) {
      window.PlayerRecovery.ensureRecovery(merged);
    }
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
      this._playerPresenceChannel = null;
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

    getCurrentDisplayName() {
      if (!this.user) return this.playerId || "Player";
      return this.user.user_metadata?.display_name || this.user.email || this.playerId || "Player";
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

    async loadLeaderboard(metric, limit = 20) {
      if (!this.supabase) {
        return [];
      }
      try {
        const { data, error } = await this.supabase
          .from("leaderboard_scores")
          .select("user_id, player_id, metric, value, created_at")
          .eq("metric", metric)
          .order("value", { ascending: false })
          .limit(300);
        if (error || !Array.isArray(data)) {
          if (error) console.warn("Leaderboard load failed.", error);
          return [];
        }

        const seenUsers = new Set();
        const topUnique = [];
        for (const row of data) {
          const userKey = row.user_id || row.player_id;
          if (!userKey || seenUsers.has(userKey)) continue;
          seenUsers.add(userKey);
          topUnique.push(row);
          if (topUnique.length >= limit) break;
        }

        const userIds = topUnique.map((r) => r.user_id).filter(Boolean);
        let namesByUserId = {};
        if (userIds.length > 0) {
          const { data: profiles } = await this.supabase
            .from("public_profiles")
            .select("user_id, display_name")
            .in("user_id", userIds);
          if (Array.isArray(profiles)) {
            namesByUserId = Object.fromEntries(
              profiles.map((p) => [p.user_id, p.display_name || "Player"])
            );
          }
        }

        return topUnique.map((row) => ({
          userId: row.user_id,
          name: namesByUserId[row.user_id] || row.player_id || "Player",
          valueRaw: Number(row.value || 0)
        }));
      } catch (error) {
        console.warn("Leaderboard query error.", error);
        return [];
      }
    }

    async publishLiveRound(state) {
      if (!this.supabase || !this.user) return false;
      try {
        const payload = {
          ...state,
          publisherUserId: this.user.id
        };
        const { error } = await this.supabase.from("leaderboard_scores").insert({
          user_id: this.user.id,
          player_id: this.playerId,
          metric: "live_round_state",
          value: Number(payload.nonce || 0),
          payload
        });
        if (error) {
          console.warn("Failed to publish live round state.", error);
          return false;
        }
        return true;
      } catch (error) {
        console.warn("Live round publish error.", error);
        return false;
      }
    }

    async fetchLatestLiveRound() {
      if (!this.supabase) return null;
      try {
        const { data, error } = await this.supabase
          .from("leaderboard_scores")
          .select("payload, created_at")
          .eq("metric", "live_round_state")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data || !data.payload) return null;
        return {
          ...data.payload,
          createdAt: data.created_at
        };
      } catch (error) {
        console.warn("Live round fetch error.", error);
        return null;
      }
    }

    async publishLiveBet(betPayload) {
      if (!this.supabase || !this.user) return false;
      try {
        const payload = {
          ...betPayload,
          userId: this.user.id,
          playerId: this.playerId
        };
        const { error } = await this.supabase.from("leaderboard_scores").insert({
          user_id: this.user.id,
          player_id: this.playerId,
          metric: "live_bet",
          value: Number(payload.amount || 0),
          payload
        });
        if (error) {
          console.warn("Failed to publish live bet.", error);
          return false;
        }
        return true;
      } catch (error) {
        console.warn("Live bet publish error.", error);
        return false;
      }
    }

    async sendChatMessage(text) {
      if (!this.supabase || !this.user) return false;
      const trimmed = String(text || "").trim();
      if (!trimmed || trimmed.length > 200) return false;
      try {
        const { error } = await this.supabase.from("leaderboard_scores").insert({
          user_id: this.user.id,
          player_id: this.playerId,
          metric: "live_chat_message",
          value: Date.now() % 1e9,
          payload: {
            message: trimmed,
            displayName: this.getCurrentDisplayName(),
            userId: this.user.id,
            ts: Date.now()
          }
        });
        if (error) {
          console.warn("Chat send failed.", error);
          return false;
        }
        return true;
      } catch (error) {
        console.warn("Chat send error.", error);
        return false;
      }
    }

    async fetchRecentChatMessages(limit = 40) {
      if (!this.supabase) return [];
      try {
        const { data, error } = await this.supabase
          .from("leaderboard_scores")
          .select("payload, created_at")
          .eq("metric", "live_chat_message")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error || !Array.isArray(data)) return [];
        return data
          .map((row) => ({
            name: row.payload?.displayName || "Player",
            message: row.payload?.message || "",
            userId: row.payload?.userId || "",
            createdAt: row.created_at
          }))
          .filter((m) => m.message)
          .reverse();
      } catch (error) {
        console.warn("Chat fetch error.", error);
        return [];
      }
    }

    async announcePlayerSession() {
      if (!this.supabase || !this.user) return false;
      try {
        const { error } = await this.supabase.from("leaderboard_scores").insert({
          user_id: this.user.id,
          player_id: this.playerId,
          metric: "live_player_join",
          value: Date.now() % 1e9,
          payload: {
            displayName: this.getCurrentDisplayName(),
            userId: this.user.id,
            ts: Date.now()
          }
        });
        if (error) {
          console.warn("Join announce failed.", error);
          return false;
        }
        return true;
      } catch (error) {
        console.warn("Join announce error.", error);
        return false;
      }
    }

    subscribePlayerPresence(onRoster, onChannelStatus) {
      if (!this.supabase || !this.user || typeof onRoster !== "function") return () => {};
      if (this._playerPresenceChannel) {
        try { this.supabase.removeChannel(this._playerPresenceChannel); } catch (e) { /* ignore */ }
        this._playerPresenceChannel = null;
      }
      const ch = this.supabase.channel("global-player-presence", {
        config: { presence: { key: this.user.id || this.playerId } }
      });
      this._playerPresenceChannel = ch;
      const emitRoster = () => {
        try {
          const state = ch.presenceState();
          const roster = [];
          Object.keys(state || {}).forEach((k) => {
            const metas = Array.isArray(state[k]) ? state[k] : [];
            metas.forEach((m) => {
              roster.push({
                userId: String((m && m.userId) || k || ""),
                displayName: String((m && m.displayName) || "Player"),
                deviceType: String((m && m.deviceType) || "unknown"),
                seenAt: Number((m && m.ts) || Date.now())
              });
            });
          });
          onRoster(roster);
        } catch (e) {
          onRoster([]);
        }
      };
      ch
        .on("presence", { event: "sync" }, () => emitRoster())
        .on("presence", { event: "join" }, () => emitRoster())
        .on("presence", { event: "leave" }, () => emitRoster())
        .subscribe(async (status) => {
          if (typeof onChannelStatus === "function") onChannelStatus(String(status));
          if (status === "SUBSCRIBED") {
            try {
              await ch.track({
                userId: this.user.id || this.playerId,
                displayName: this.getCurrentDisplayName(),
                deviceType: (typeof document !== "undefined" && document.body && document.body.classList.contains("mobile-ui")) ? "mobile" : "desktop",
                ts: Date.now()
              });
              emitRoster();
            } catch (e) {
              console.warn("Presence track failed.", e);
            }
          }
        });
      return () => {
        try {
          this.supabase.removeChannel(ch);
        } catch (e) {
          console.warn("removeChannel player presence", e);
        }
        if (this._playerPresenceChannel === ch) this._playerPresenceChannel = null;
      };
    }

    async fetchRecentPlayerJoins(limit = 25) {
      if (!this.supabase) return [];
      try {
        const { data, error } = await this.supabase
          .from("leaderboard_scores")
          .select("payload, created_at")
          .eq("metric", "live_player_join")
          .order("created_at", { ascending: false })
          .limit(Math.max(60, limit * 4));
        if (error || !Array.isArray(data)) return [];
        const uniqueByUser = new Map();
        for (let i = 0; i < data.length; i += 1) {
          const row = data[i];
          const userId = String(row && row.payload && row.payload.userId ? row.payload.userId : "");
          if (!userId || uniqueByUser.has(userId)) continue;
          uniqueByUser.set(userId, {
            displayName: row.payload?.displayName || "Player",
            userId,
            createdAt: row.created_at
          });
          if (uniqueByUser.size >= limit) break;
        }
        return Array.from(uniqueByUser.values());
      } catch (error) {
        console.warn("Join fetch error.", error);
        return [];
      }
    }

    useGlobalAuthoritativeRounds() {
      const cfg = window.SUPABASE_CONFIG || {};
      return !!(cfg.useGlobalAuthoritativeRounds && this.supabase);
    }

    async rpcServerNowMs() {
      if (!this.supabase) return null;
      try {
        const { data, error } = await this.supabase.rpc("server_now_ms");
        if (error) return null;
        if (typeof data === "number" && Number.isFinite(data)) return data;
        if (data && typeof data.ms === "number") return data.ms;
        return null;
      } catch (error) {
        console.warn("server_now_ms RPC failed.", error);
        return null;
      }
    }

    async fetchLatestGlobalRound() {
      if (!this.supabase) return null;
      try {
        const { data, error } = await this.supabase
          .from("global_rounds")
          .select("*")
          .eq("lobby_id", "global")
          .order("round_seq", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data) return null;
        return data;
      } catch (error) {
        console.warn("global_rounds fetch error.", error);
        return null;
      }
    }

    async invokeGlobalGameTick() {
      if (!this.supabase) return false;
      try {
        const { error } = await this.supabase.functions.invoke("global-game-tick", { body: {} });
        if (error) {
          console.warn("[SYNC] global-game-tick invoke failed", error.message || error);
          return false;
        }
        console.warn("[SYNC] global-game-tick invoked");
        return true;
      } catch (error) {
        console.warn("[SYNC] global-game-tick invoke error", error);
        return false;
      }
    }

    subscribeGlobalRounds(onRow, onChannelStatus) {
      if (!this.supabase || typeof onRow !== "function") return () => {};
      const channel = this.supabase
        .channel("global-rounds-feed")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "global_rounds", filter: "lobby_id=eq.global" },
          (payload) => {
            const row = payload.new && Object.keys(payload.new).length ? payload.new : null;
            if (row && row.lobby_id === "global") onRow(row);
          }
        )
        .subscribe((status) => {
          if (typeof onChannelStatus === "function") onChannelStatus(String(status));
          // #region agent log
          if (typeof fetch !== "undefined") {
            fetch("http://127.0.0.1:7850/ingest/c4c25ade-ca71-4681-8d78-315f00262d21", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "357a69" }, body: JSON.stringify({ sessionId: "357a69", hypothesisId: "H-C", location: "services.js:subscribeGlobalRounds", message: "channel status", data: { status: String(status) }, timestamp: Date.now() }) }).catch(() => {});
          }
          try { console.warn("[SYNC] realtime", "global_rounds channel", String(status)); } catch (e) { /* ignore */ }
          // #endregion
        });
      return () => {
        try {
          this.supabase.removeChannel(channel);
        } catch (e) {
          console.warn("removeChannel global rounds", e);
        }
      };
    }

    async fetchLiveBets(roundId) {
      if (!this.supabase || !roundId) return [];
      try {
        const { data, error } = await this.supabase
          .from("leaderboard_scores")
          .select("payload, created_at")
          .eq("metric", "live_bet")
          .order("created_at", { ascending: false })
          .limit(300);
        if (error || !Array.isArray(data)) return [];

        const latestByUser = new Map();
        for (const row of data) {
          const payload = row.payload || {};
          if (payload.roundId !== roundId) continue;
          const userKey = payload.userId || payload.playerId;
          if (!userKey || latestByUser.has(userKey)) continue;
          latestByUser.set(userKey, payload);
        }
        return Array.from(latestByUser.values())
          .filter((p) => p.status === "active")
          .map((p) => ({
            userId: p.userId || p.playerId || "",
            name: p.displayName || p.playerId || "Player",
            amount: Number(p.amount || 0)
          }));
      } catch (error) {
        console.warn("Live bets fetch error.", error);
        return [];
      }
    }

    async searchProfilesForFriends(rawQuery) {
      if (!this.supabase || !this.user) return [];
      const q = String(rawQuery || "")
        .trim()
        .slice(0, 64);
      if (q.length < 2) return [];
      try {
        const { data, error } = await this.supabase
          .from("public_profiles")
          .select("user_id, display_name")
          .ilike("display_name", `%${q}%`)
          .neq("user_id", this.user.id)
          .limit(20);
        if (error || !Array.isArray(data)) {
          if (error) console.warn("searchProfilesForFriends failed.", error);
          return [];
        }
        return data.map((r) => ({
          userId: r.user_id,
          displayName: r.display_name || "Player"
        }));
      } catch (e) {
        console.warn("searchProfilesForFriends error.", e);
        return [];
      }
    }

    async fetchFriendRequestRows() {
      if (!this.supabase || !this.user) return [];
      try {
        const uid = this.user.id;
        const { data, error } = await this.supabase
          .from("friend_requests")
          .select("*")
          .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
          .order("created_at", { ascending: false });
        if (error || !Array.isArray(data)) {
          if (error) console.warn("fetchFriendRequestRows failed.", error);
          return [];
        }
        return data;
      } catch (e) {
        console.warn("fetchFriendRequestRows error.", e);
        return [];
      }
    }

    async sendFriendRequest(receiverUserId) {
      if (!this.supabase || !this.user) return { ok: false, message: "Not signed in." };
      if (!receiverUserId || receiverUserId === this.user.id) return { ok: false, message: "Invalid player." };
      try {
        const rows = await this.fetchFriendRequestRows();
        const hasAccepted = rows.some(
          (r) =>
            r.status === "accepted" &&
            ((r.sender_id === this.user.id && r.receiver_id === receiverUserId) ||
              (r.sender_id === receiverUserId && r.receiver_id === this.user.id))
        );
        if (hasAccepted) return { ok: false, message: "Already friends." };
        const pendingAB = rows.find(
          (r) => r.status === "pending" && r.sender_id === this.user.id && r.receiver_id === receiverUserId
        );
        if (pendingAB) return { ok: false, message: "Request already sent." };
        const pendingBA = rows.find(
          (r) => r.status === "pending" && r.sender_id === receiverUserId && r.receiver_id === this.user.id
        );
        if (pendingBA) return { ok: false, message: "This player already invited you — check Incoming." };
        const { error } = await this.supabase.from("friend_requests").insert({
          sender_id: this.user.id,
          receiver_id: receiverUserId,
          status: "pending"
        });
        if (error) {
          if (String(error.code) === "23505") return { ok: false, message: "Request already exists." };
          return { ok: false, message: error.message || "Could not send request." };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, message: String(e && e.message ? e.message : e) };
      }
    }

    async respondFriendRequest(requestId, accept) {
      if (!this.supabase || !this.user) return { ok: false, message: "Not signed in." };
      try {
        const { data: row, error: fetchErr } = await this.supabase
          .from("friend_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();
        if (fetchErr || !row) return { ok: false, message: "Request not found." };
        if (row.receiver_id !== this.user.id) return { ok: false, message: "Not allowed." };
        if (row.status !== "pending") return { ok: false, message: "Request is no longer pending." };
        const now = new Date().toISOString();
        if (accept) {
          const { error: upErr } = await this.supabase
            .from("friend_requests")
            .update({ status: "accepted", updated_at: now })
            .eq("id", requestId);
          if (upErr) return { ok: false, message: upErr.message || "Update failed." };
          await this.supabase
            .from("friend_requests")
            .delete()
            .eq("sender_id", row.receiver_id)
            .eq("receiver_id", row.sender_id)
            .eq("status", "pending");
        } else {
          const { error: upErr } = await this.supabase
            .from("friend_requests")
            .update({ status: "declined", updated_at: now })
            .eq("id", requestId);
          if (upErr) return { ok: false, message: upErr.message || "Update failed." };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, message: String(e && e.message ? e.message : e) };
      }
    }

    async removeFriendship(friendUserId) {
      if (!this.supabase || !this.user) return { ok: false, message: "Not signed in." };
      if (!friendUserId || friendUserId === this.user.id) return { ok: false, message: "Invalid player." };
      try {
        const me = this.user.id;
        await this.supabase
          .from("friend_requests")
          .delete()
          .match({ sender_id: me, receiver_id: friendUserId, status: "accepted" });
        const { error } = await this.supabase
          .from("friend_requests")
          .delete()
          .match({ sender_id: friendUserId, receiver_id: me, status: "accepted" });
        if (error) return { ok: false, message: error.message };
        return { ok: true };
      } catch (e) {
        return { ok: false, message: String(e && e.message ? e.message : e) };
      }
    }

    async fetchTransferHistory(limit = 40) {
      if (!this.supabase || !this.user) return [];
      const uid = this.user.id;
      try {
        const { data, error } = await this.supabase
          .from("player_transfers")
          .select("id, sender_id, receiver_id, amount, status, created_at")
          .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error || !Array.isArray(data)) {
          if (error) console.warn("fetchTransferHistory failed.", error);
          return [];
        }
        const ids = new Set();
        data.forEach((r) => {
          ids.add(r.sender_id);
          ids.add(r.receiver_id);
        });
        const idList = Array.from(ids).filter(Boolean);
        let names = {};
        if (idList.length) {
          const { data: profs } = await this.supabase.from("public_profiles").select("user_id, display_name").in("user_id", idList);
          if (Array.isArray(profs)) {
            names = Object.fromEntries(profs.map((p) => [p.user_id, p.display_name || "Player"]));
          }
        }
        return data.map((r) => ({
          id: r.id,
          amount: Number(r.amount || 0),
          status: r.status,
          createdAt: r.created_at,
          direction: r.sender_id === uid ? "sent" : "received",
          counterpartyId: r.sender_id === uid ? r.receiver_id : r.sender_id,
          counterpartyName: names[r.sender_id === uid ? r.receiver_id : r.sender_id] || "Player"
        }));
      } catch (e) {
        console.warn("fetchTransferHistory error.", e);
        return [];
      }
    }

    async transferToFriendRpc(receiverUserId, amount) {
      if (!this.supabase || !this.user) return { ok: false, message: "Not signed in.", newBalance: null };
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) return { ok: false, message: "Enter a valid amount.", newBalance: null };
      try {
        const { data, error } = await this.supabase.rpc("transfer_to_friend", {
          p_receiver_id: receiverUserId,
          p_amount: amt
        });
        if (error) return { ok: false, message: error.message || "Transfer failed.", newBalance: null };
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return { ok: false, message: "No response from server.", newBalance: null };
        const hasSuccessField = Object.prototype.hasOwnProperty.call(row, "success");
        const successRaw = row.success;
        const okFromField = successRaw === true
          || successRaw === 1
          || successRaw === "1"
          || successRaw === "t"
          || successRaw === "true"
          || successRaw === "ok";
        const ok = hasSuccessField ? okFromField : true;
        const msg = row.message || (ok ? "OK" : "Transfer failed.");
        const rawNb = row.new_balance != null ? row.new_balance : row.newBalance;
        const nb = rawNb != null && rawNb !== "" ? Number(rawNb) : null;
        return { ok, message: msg, newBalance: Number.isFinite(nb) ? nb : null };
      } catch (e) {
        return { ok: false, message: String(e && e.message ? e.message : e), newBalance: null };
      }
    }

    async getDisplayNamesForUserIds(userIds) {
      if (!this.supabase || !Array.isArray(userIds) || userIds.length === 0) return {};
      const uniq = [...new Set(userIds.filter(Boolean))].slice(0, 80);
      if (!uniq.length) return {};
      try {
        const { data, error } = await this.supabase.from("public_profiles").select("user_id, display_name").in("user_id", uniq);
        if (error || !Array.isArray(data)) return {};
        return Object.fromEntries(data.map((p) => [p.user_id, p.display_name || "Player"]));
      } catch (e) {
        return {};
      }
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
