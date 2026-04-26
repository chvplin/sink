(function () {
  class GameUI {
    constructor() {
      this.el = {
        phaseLabel: document.getElementById("phase-label"),
        balance: document.getElementById("balance-display"),
        multiplier: document.getElementById("multiplier-display"),
        depth: document.getElementById("depth-display"),
        depthFill: document.getElementById("depth-meter-fill"),
        countdown: document.getElementById("countdown-display"),
        crashDisplay: document.getElementById("crash-display"),
        betInput: document.getElementById("bet-input"),
        betButton: document.getElementById("bet-button"),
        cashoutButton: document.getElementById("cashout-button"),
        currentBet: document.getElementById("current-bet-display"),
        potentialWin: document.getElementById("potential-win-display"),
        history: document.getElementById("history-list"),
        liveBetsList: document.getElementById("live-bets-list"),
        autoToggle: document.getElementById("auto-cashout-toggle"),
        autoInput: document.getElementById("auto-cashout-input"),
        serverHash: document.getElementById("server-hash-display"),
        nonce: document.getElementById("nonce-display"),
        autoBetToggle: document.getElementById("auto-bet-toggle"),
        autoStopWins: document.getElementById("auto-stop-wins"),
        autoStopLosses: document.getElementById("auto-stop-losses"),
        autoStopBalance: document.getElementById("auto-stop-balance"),
        tabs: Array.from(document.querySelectorAll(".dock-nav .dock-btn[data-tab], .hud-icon-btn[data-tab]")),
        tabPanels: {
          play: document.getElementById("panel-play"),
          collection: document.getElementById("panel-collection"),
          challenges: document.getElementById("panel-challenges"),
          achievements: document.getElementById("panel-achievements"),
          leaderboard: document.getElementById("panel-leaderboard"),
          stats: document.getElementById("panel-stats"),
          settings: document.getElementById("panel-settings"),
          shop: document.getElementById("panel-shop"),
          friends: document.getElementById("panel-friends")
        },
        panelFriends: document.getElementById("panel-friends"),
        friendsAuthNote: document.getElementById("friends-auth-note"),
        friendsDebtNote: document.getElementById("friends-debt-note"),
        friendsSearchForm: document.getElementById("friends-search-form"),
        friendsSearchInput: document.getElementById("friends-search-input"),
        friendsSearchResults: document.getElementById("friends-search-results"),
        friendsIncomingList: document.getElementById("friends-incoming-list"),
        friendsList: document.getElementById("friends-list"),
        friendsTransferHistory: document.getElementById("friends-transfer-history"),
        friendsRefreshBtn: document.getElementById("friends-refresh-btn"),
        friendsTransferModal: document.getElementById("friends-transfer-modal"),
        friendsTransferBackdrop: document.getElementById("friends-transfer-modal-backdrop"),
        friendsTransferClose: document.getElementById("friends-transfer-modal-close"),
        friendsTransferRecipient: document.getElementById("friends-transfer-recipient-name"),
        friendsTransferBalance: document.getElementById("friends-transfer-balance"),
        friendsTransferAmount: document.getElementById("friends-transfer-amount"),
        friendsTransferConfirm: document.getElementById("friends-transfer-confirm"),
        friendsTransferWarn: document.getElementById("friends-transfer-warn"),
        postRoundSummary: document.getElementById("post-round-summary"),
        postRoundSummaryDl: document.getElementById("post-round-summary-dl"),
        postRoundSummaryNext: document.getElementById("post-round-summary-next"),
        postRoundSummaryClose: document.getElementById("post-round-summary-close"),
        bankProfileFrame: document.getElementById("bank-profile-frame"),
        shopBalance: document.getElementById("shop-balance-display"),
        shopCategories: document.getElementById("cosmetic-shop-categories"),
        shopGrid: document.getElementById("cosmetic-shop-grid"),
        shopPreviewBody: document.getElementById("cosmetic-shop-preview-body"),
        panelShop: document.getElementById("panel-shop"),
        collectionGrid: document.getElementById("collection-grid"),
        dailyChallenges: document.getElementById("daily-challenges"),
        weeklyChallenges: document.getElementById("weekly-challenges"),
        achievementGrid: document.getElementById("achievement-grid"),
        leaderboardTable: document.getElementById("leaderboard-table"),
        leaderTabs: Array.from(document.querySelectorAll("[data-leader-tab]")),
        statsGrid: document.getElementById("stats-grid"),
        toastRoot: document.getElementById("toast-root"),
        winStreakDisplay: document.getElementById("win-streak-display"),
        dailyStreakDisplay: document.getElementById("daily-streak-display"),
        luckyBanner: document.getElementById("lucky-round-banner"),
        milestoneFeed: document.getElementById("milestone-feed"),
        fleetWagerTotal: document.getElementById("fleet-wager-total"),
        audioToggle: document.getElementById("audio-toggle"),
        signOutButton: document.getElementById("signout-button"),
        crewAidButton: document.getElementById("crew-aid-button"),
        debtIndicator: document.getElementById("debt-indicator"),
        debtAmount: document.getElementById("debt-amount"),
        debtBarFill: document.getElementById("debt-bar-fill"),
        recoveryHub: document.getElementById("recovery-hub"),
        roundModeBanner: document.getElementById("round-mode-banner"),
        recoveryEmergencyMeta: document.getElementById("recovery-emergency-meta"),
        recoveryDailyMeta: document.getElementById("recovery-daily-meta"),
        recoveryDailyLadder: document.getElementById("recovery-daily-ladder"),
        recoverySecondMeta: document.getElementById("recovery-second-meta"),
        recoveryFreeMeta: document.getElementById("recovery-free-meta"),
        recoveryLoanMeta: document.getElementById("recovery-loan-meta"),
        playerJoinBanner: document.getElementById("player-join-banner"),
        hudChatMessages: document.getElementById("hud-chat-messages"),
        hudChatForm: document.getElementById("hud-chat-form"),
        hudChatInput: document.getElementById("hud-chat-input"),
        hudChatDrawer: document.getElementById("hud-chat-drawer"),
        hudChatDrawerTab: document.getElementById("hud-chat-drawer-tab")
      };
      this.currentLeaderboardTab = "highestMultiplier";
      this._hudChatTabBound = false;
      this._cosmeticShopCategory = "submarines";
      this._postRoundSummaryVisible = false;
      this._lastCountdownSec = 0;
      this._friendsPanelBound = false;
      this._friendsTransferLoading = false;
      this.setupResponsiveMode();
      this.bindHudChatDrawerTab();
    }

    bindHudChatDrawerTab() {
      if (!this.el.hudChatDrawerTab || this._hudChatTabBound) return;
      this._hudChatTabBound = true;
      this.el.hudChatDrawerTab.addEventListener("click", () => this.toggleHudChatDrawer());
    }

    toggleHudChatDrawer() {
      if (!this.el.hudChatDrawer || !this.el.hudChatDrawerTab) return;
      const collapsed = this.el.hudChatDrawer.classList.toggle("hud-chat-drawer--collapsed");
      this.el.hudChatDrawerTab.setAttribute("aria-expanded", collapsed ? "false" : "true");
      const panel = this.el.hudChatDrawer.querySelector(".hud-chat-drawer__panel");
      if (panel) panel.setAttribute("aria-hidden", collapsed ? "true" : "false");
      const chev = this.el.hudChatDrawerTab.querySelector(".hud-chat-drawer__chev");
      if (chev) chev.textContent = collapsed ? "⟩" : "⟨";
      if (!collapsed && this.el.hudChatInput) {
        requestAnimationFrame(() => this.el.hudChatInput.focus());
      }
    }

    syncHudChatDrawerLayout() {
      if (!this.el.hudChatDrawer || !this.el.hudChatDrawerTab) return;
      const panel = this.el.hudChatDrawer.querySelector(".hud-chat-drawer__panel");
      const collapsed = this.el.hudChatDrawer.classList.contains("hud-chat-drawer--collapsed");
      this.el.hudChatDrawerTab.setAttribute("aria-expanded", collapsed ? "false" : "true");
      if (panel) panel.setAttribute("aria-hidden", collapsed ? "true" : "false");
      const chev = this.el.hudChatDrawerTab.querySelector(".hud-chat-drawer__chev");
      if (chev) chev.textContent = collapsed ? "⟩" : "⟨";
    }

    setupResponsiveMode() {
      const mq = window.matchMedia("(max-width: 768px)");
      const apply = () => {
        document.body.classList.toggle("mobile-ui", mq.matches);
        const narrow = mq.matches;
        const historyFold = document.getElementById("play-history-details");
        const autoFold = document.getElementById("play-auto-details");
        if (historyFold) historyFold.open = !narrow;
        if (autoFold) autoFold.open = !narrow;
        this.syncHudChatDrawerLayout();
        if (typeof window.MobileShell !== "undefined" && typeof window.MobileShell.refreshLayout === "function") {
          window.MobileShell.refreshLayout();
        }
      };
      apply();
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", apply);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(apply);
      }
      window.addEventListener("orientationchange", apply);
    }

    bindControls(controller) {
      const adjustButtons = document.querySelectorAll("[data-bet-adjust]");
      const presetButtons = document.querySelectorAll("[data-preset]");

      this.el.betButton.addEventListener("click", () => controller.placeBet());
      this.el.cashoutButton.addEventListener("click", () => controller.cashOut("manual"));

      this.el.betInput.addEventListener("change", () => controller.onBetInputChange());
      this.el.autoToggle.addEventListener("change", () => {
        this.el.autoInput.disabled = !this.el.autoToggle.checked;
        controller.onAutoSettingsChanged();
      });
      this.el.autoBetToggle.addEventListener("change", () => controller.onAutoSettingsChanged());
      this.el.autoInput.addEventListener("change", () => controller.onAutoSettingsChanged());
      this.el.autoStopWins.addEventListener("change", () => controller.onAutoSettingsChanged());
      this.el.autoStopLosses.addEventListener("change", () => controller.onAutoSettingsChanged());
      this.el.autoStopBalance.addEventListener("change", () => controller.onAutoSettingsChanged());
      this.el.audioToggle.addEventListener("change", () => controller.onAudioToggle(this.el.audioToggle.checked));
      if (this.el.signOutButton) {
        this.el.signOutButton.addEventListener("click", () => controller.onSignOut());
      }
      if (this.el.crewAidButton && controller.openRecoveryHub) {
        this.el.crewAidButton.addEventListener("click", () => controller.openRecoveryHub());
      }

      adjustButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          controller.adjustBetInput(Number(btn.dataset.betAdjust));
        });
      });

      presetButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.dataset.preset === "max") controller.setMaxBet();
          else controller.setBetInput(Number(btn.dataset.preset));
        });
      });

      if (this.el.hudChatForm && controller.onChatSubmit) {
        this.el.hudChatForm.addEventListener("submit", (e) => {
          e.preventDefault();
          const raw = (this.el.hudChatInput && this.el.hudChatInput.value) || "";
          controller.onChatSubmit(raw.trim());
          if (this.el.hudChatInput) this.el.hudChatInput.value = "";
        });
      }

      this.el.tabs.forEach((tabBtn) => {
        tabBtn.addEventListener("click", () => this.switchTab(tabBtn.dataset.tab));
      });

      const hudRoot = document.querySelector("main.hud");
      if (hudRoot && !this._desktopPanelCloseBound) {
        this._desktopPanelCloseBound = true;
        hudRoot.addEventListener("click", (e) => {
          if (e.target.closest(".desktop-panel-close")) this.switchTab("play");
        });
      }
      this.el.leaderTabs.forEach((tabBtn) => {
        tabBtn.addEventListener("click", () => {
          this.currentLeaderboardTab = tabBtn.dataset.leaderTab;
          this.el.leaderTabs.forEach((t) => t.classList.toggle("active", t === tabBtn));
          controller.onLeaderboardTabChange(this.currentLeaderboardTab);
        });
      });

      if (this.el.postRoundSummaryClose) {
        this.el.postRoundSummaryClose.addEventListener("click", () => {
          if (typeof controller.onPostRoundSummaryClose === "function") controller.onPostRoundSummaryClose();
        });
      }

      if (this.el.panelShop) {
        this.el.panelShop.addEventListener("click", (e) => {
          const buyBtn = e.target.closest("[data-shop-buy]");
          const equipBtn = e.target.closest("[data-shop-equip]");
          if (buyBtn && buyBtn.dataset.shopBuy && controller.buyCosmeticItem) controller.buyCosmeticItem(buyBtn.dataset.shopBuy);
          if (equipBtn && equipBtn.dataset.shopEquip && controller.equipCosmeticItem) controller.equipCosmeticItem(equipBtn.dataset.shopEquip);
        });
      }
      if (this.el.shopCategories) {
        this.el.shopCategories.addEventListener("click", (e) => {
          const catBtn = e.target.closest("[data-shop-cat]");
          if (catBtn && catBtn.dataset.shopCat && controller.onCosmeticShopCategory) controller.onCosmeticShopCategory(catBtn.dataset.shopCat);
        });
      }
    }

    getCosmeticShopCategory() {
      return this._cosmeticShopCategory || "submarines";
    }

    setCosmeticShopCategory(cat) {
      this._cosmeticShopCategory = cat || "submarines";
    }

    showPostRoundSummary(payload) {
      if (!this.el.postRoundSummary || !this.el.postRoundSummaryDl) return;
      this._postRoundSummaryVisible = true;
      const esc = (s) =>
        String(s == null ? "" : s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/"/g, "&quot;");
      const rows = (payload.rows || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
      this.el.postRoundSummaryDl.innerHTML = rows;
      this.updatePostRoundNextLine(payload.nextDiveText || "");
      this.el.postRoundSummary.classList.remove("hidden");
    }

    hidePostRoundSummary() {
      this._postRoundSummaryVisible = false;
      if (this.el.postRoundSummary) this.el.postRoundSummary.classList.add("hidden");
    }

    isPostRoundSummaryVisible() {
      return !!this._postRoundSummaryVisible;
    }

    updatePostRoundNextLine(text) {
      if (this.el.postRoundSummaryNext) this.el.postRoundSummaryNext.textContent = text || "";
    }

    applyProfileFrame(profile) {
      const frame = this.el.bankProfileFrame;
      if (!frame) return;
      frame.classList.remove("bank-profile-frame--captain", "bank-profile-frame--none");
      const ec = profile && profile.equippedCosmetics;
      const id = ec && ec.profileFrame;
      if (id === "captain_profile_frame") {
        frame.classList.add("bank-profile-frame--captain");
      } else {
        frame.classList.add("bank-profile-frame--none");
      }
    }

    renderCosmeticShop(profile, allItems, handlers) {
      const items = Array.isArray(allItems) ? allItems : [];
      const cat = this.getCosmeticShopCategory();
      const cats = [
        { id: "submarines", label: "Submarines" },
        { id: "trails", label: "Trails" },
        { id: "diverSuits", label: "Diver Suits" },
        { id: "crashEffects", label: "Crash Effects" },
        { id: "profileFrames", label: "Profile Frames" }
      ];
      if (this.el.shopBalance) this.el.shopBalance.textContent = this.formatMoney(profile.balance || 0);
      if (this.el.shopCategories) {
        this.el.shopCategories.innerHTML = cats
          .map(
            (c) =>
              `<button type="button" role="tab" class="cosmetic-shop-cat${c.id === cat ? " active" : ""}" data-shop-cat="${c.id}">${c.label}</button>`
          )
          .join("");
      }
      const filtered = items.filter((i) => i.category === cat);
      const oc = profile.ownedCosmetics || {};
      const ec = profile.equippedCosmetics || {};
      const equipKey = {
        submarines: "submarine",
        trails: "trail",
        diverSuits: "diverSuit",
        crashEffects: "crashEffect",
        profileFrames: "profileFrame"
      }[cat];
      const rarityClass = (r) => {
        const key = String(r || "Common").replace(/\s+/g, "");
        return `cosmetic-shop-rarity cosmetic-shop-rarity--${key}`;
      };

      if (this.el.shopGrid) {
        this.el.shopGrid.innerHTML = "";
        const bal = Number(profile.balance) || 0;
        filtered.forEach((item) => {
          const owned = (oc[item.category] || []).includes(item.id);
          const equipped = ec[equipKey] === item.id;
          const card = document.createElement("div");
          card.className = `cosmetic-shop-card${equipped ? " cosmetic-shop-card--equipped" : ""}`;
          const priceLabel = item.price <= 0 ? "Starter" : this.formatMoney(item.price);
          const buyDisabled = owned || (item.price > 0 && bal < item.price);
          const equipDisabled = !owned || equipped;
          const nm = String(item.name || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
          const rar = String(item.rarity || "Common").replace(/&/g, "&amp;").replace(/</g, "&lt;");
          card.innerHTML = `
            <div><span class="${rarityClass(item.rarity)}">${rar}</span></div>
            <div class="cosmetic-shop-card__name">${nm}</div>
            <div class="cosmetic-shop-card__meta">${priceLabel}${owned ? " · Owned" : ""}${equipped ? " · Equipped" : ""}</div>
            <div class="cosmetic-shop-card__actions">
              <button type="button" data-shop-buy="${item.id}" ${buyDisabled ? "disabled" : ""}>Buy</button>
              <button type="button" data-shop-equip="${item.id}" ${equipDisabled ? "disabled" : ""}>Equip</button>
            </div>
          `;
          card.addEventListener("mouseenter", () => {
            if (handlers && handlers.onPreview) handlers.onPreview(item);
          });
          this.el.shopGrid.appendChild(card);
        });
        if (handlers && handlers.onPreview && filtered[0]) handlers.onPreview(filtered[0]);
      }
    }

    formatMoney(value) {
      return `$${value.toFixed(2)}`;
    }

    setBalance(balance) {
      this.el.balance.textContent = this.formatMoney(balance);
    }

    setCrewAidVisible(visible) {
      if (!this.el.crewAidButton) return;
      this.el.crewAidButton.classList.toggle("hidden", !visible);
    }

    setPhase(text) {
      this.el.phaseLabel.textContent = text;
    }

    setMultiplier(multiplier) {
      const m = Math.max(1, Number(multiplier) || 1);
      this.el.multiplier.textContent = `${m.toFixed(2)}x`;
      const isMobileUi = typeof document !== "undefined" && document.body && document.body.classList.contains("mobile-ui");
      this.el.multiplier.style.color = isMobileUi ? "#ffd84d" : (multiplier >= 10 ? "#ffd88f" : "#ffffff");
      const norm = Math.min(1, Math.max(0, Math.log10(m) / Math.log10(10000)));
      const marker = document.getElementById("multiplier-rail-marker");
      if (marker) {
        marker.style.bottom = `calc(${norm * 100}% - 9px)`;
      }
    }

    setDepth(depthNorm) {
      if (!this.el.depth || !this.el.depthFill) return;
      const depthMeters = Math.floor(depthNorm * 8200);
      this.el.depth.textContent = `${depthMeters.toLocaleString()} m`;
      this.el.depthFill.style.width = `${(depthNorm * 100).toFixed(1)}%`;
    }

    showPlayerJoinBanner(displayName) {
      if (!this.el.playerJoinBanner) return;
      const safe = String(displayName || "Someone").replace(/</g, "").slice(0, 48);
      this.el.playerJoinBanner.textContent = `${safe} is playing!`;
      this.el.playerJoinBanner.classList.remove("player-join-banner--dismissed");
      this.el.playerJoinBanner.classList.add("player-join-banner--visible");
      clearTimeout(this._joinBannerTimer);
      this._joinBannerTimer = setTimeout(() => {
        this.el.playerJoinBanner.classList.remove("player-join-banner--visible");
        this.el.playerJoinBanner.classList.add("player-join-banner--dismissed");
      }, 2000);
    }

    renderChatMessages(rows) {
      if (!this.el.hudChatMessages || !Array.isArray(rows)) return;
      this.el.hudChatMessages.innerHTML = rows
        .map((r) => {
          const name = String(r.name || "Player").replace(/</g, "").slice(0, 32);
          const msg = String(r.message || "").replace(/</g, "").slice(0, 200);
          return `<div class="hud-chat__line"><span class="hud-chat__who">${name}</span> ${msg}</div>`;
        })
        .join("");
      this.el.hudChatMessages.scrollTop = this.el.hudChatMessages.scrollHeight;
    }

    setCountdown(seconds) {
      const s = Math.max(0, Number(seconds) || 0);
      this._lastCountdownSec = s;
      this.el.countdown.textContent = `Next round in ${s.toFixed(1)}s`;
    }

    getCountdownSeconds() {
      return this._lastCountdownSec != null ? this._lastCountdownSec : 0;
    }

    setCrashPoint(multiplier) {
      this.el.crashDisplay.textContent = `Last crash: ${multiplier.toFixed(2)}x`;
    }

    setBetInfo(currentBet, potentialWin) {
      this.el.currentBet.textContent = this.formatMoney(currentBet);
      const pot = Number(potentialWin) || 0;
      this.el.potentialWin.textContent = this.formatMoney(pot);
      const cashLine = document.getElementById("cashout-amount-line");
      if (cashLine) cashLine.textContent = this.formatMoney(pot);
    }

    setActionState({ canBet, canCashout }) {
      this.el.betButton.disabled = !canBet;
      this.updateCashOutButtonState({ canCashout, hasCashedOut: !canCashout && this.el.cashoutButton.classList.contains("state-cashed") });
    }

    setFairness(hash, nonce) {
      this.el.serverHash.textContent = hash;
      this.el.nonce.textContent = String(nonce);
    }

    getBetInputValue() {
      const parsed = Number(this.el.betInput.value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    setBetInputValue(amount) {
      this.el.betInput.value = amount.toFixed(2);
    }

    getAutoCashoutConfig() {
      const enabled = this.el.autoToggle.checked;
      const value = Number(this.el.autoInput.value);
      return {
        enabled,
        multiplier: Number.isFinite(value) ? Math.max(1.01, value) : 2
      };
    }

    pushHistory(multiplier) {
      const li = document.createElement("li");
      li.textContent = `${multiplier.toFixed(2)}x`;
      if (multiplier < 2) {
        li.className = "history-green";
      } else if (multiplier < 10) {
        li.className = "history-blue";
      } else if (multiplier < 50) {
        li.className = "history-purple";
      } else {
        li.className = "history-gold";
      }
      this.el.history.prepend(li);
      while (this.el.history.children.length > 20) {
        this.el.history.removeChild(this.el.history.lastChild);
      }
    }

    getAutoBetConfig() {
      return {
        autoBetEnabled: this.el.autoBetToggle.checked,
        autoCashEnabled: this.el.autoToggle.checked,
        autoCashTarget: Math.max(1.01, Number(this.el.autoInput.value) || 2),
        stopAfterWins: Math.max(0, Number(this.el.autoStopWins.value) || 0),
        stopAfterLosses: Math.max(0, Number(this.el.autoStopLosses.value) || 0),
        stopBalanceBelow: Math.max(0, Number(this.el.autoStopBalance.value) || 0)
      };
    }

    applyAutoBetConfig(settings) {
      this.el.autoBetToggle.checked = !!settings.autoBetEnabled;
      this.el.autoToggle.checked = !!settings.autoCashEnabled;
      this.el.autoInput.disabled = !settings.autoCashEnabled;
      this.el.autoInput.value = Number(settings.autoCashTarget || 2).toFixed(2);
      this.el.autoStopWins.value = settings.autoStopAfterWins || 0;
      this.el.autoStopLosses.value = settings.autoStopAfterLosses || 0;
      this.el.autoStopBalance.value = settings.autoStopBalanceBelow || 0;
      this.el.audioToggle.checked = settings.audioEnabled !== false;
    }

    updateCashOutButtonState({ canCashout, hasCashedOut }) {
      this.el.cashoutButton.disabled = !canCashout;
      this.el.cashoutButton.classList.toggle("state-armed", canCashout);
      this.el.cashoutButton.classList.toggle("state-disabled", !canCashout && !hasCashedOut);
      this.el.cashoutButton.classList.toggle("state-cashed", hasCashedOut);
      const title = this.el.cashoutButton.querySelector(".cashout-btn__title");
      const amt = document.getElementById("cashout-amount-line");
      if (title) title.textContent = hasCashedOut ? "Cashed Out" : "Cash Out";
      if (amt) amt.textContent = this.el.potentialWin.textContent;
    }

    switchTab(tab) {
      this.el.tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
      Object.entries(this.el.tabPanels).forEach(([name, panel]) => {
        panel.classList.toggle("active", name === tab);
      });
    }

    setLuckyRound(active) {
      this.el.luckyBanner.classList.toggle("hidden", !active);
    }

    setStreaks(winStreak, dailyStreak) {
      this.el.winStreakDisplay.textContent = String(winStreak);
      this.el.dailyStreakDisplay.textContent = String(dailyStreak);
    }

    showMilestone(text) {
      this.el.milestoneFeed.textContent = text;
      if (!text) return;
      setTimeout(() => {
        if (this.el.milestoneFeed.textContent === text) {
          this.el.milestoneFeed.textContent = "";
        }
      }, 1300);
    }

    formatDuration(ms) {
      if (!ms || ms <= 0) return "soon";
      const s = Math.ceil(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) return `${h}h ${m % 60}m`;
      if (m > 0) return `${m}m ${s % 60}s`;
      return `${s}s`;
    }

    showToast(title, body, extraClass) {
      const toast = document.createElement("div");
      toast.className = `toast${extraClass ? ` ${extraClass}` : ""}`;
      toast.innerHTML = `<strong>${title}</strong><div>${body}</div>`;
      this.el.toastRoot.prepend(toast);
      setTimeout(() => toast.remove(), extraClass === "toast-near-miss" ? 5200 : 3400);
    }

    setRecoveryHubOpen(open) {
      if (!this.el.recoveryHub) return;
      this.el.recoveryHub.classList.toggle("hidden", !open);
      this.el.recoveryHub.setAttribute("aria-hidden", open ? "false" : "true");
    }

    bindRecoveryHub(handler) {
      if (!this.el.recoveryHub) return;
      this.el.recoveryHub.addEventListener("click", (event) => {
        const target = event.target.closest("[data-recovery-action]");
        if (!target) return;
        handler(target.dataset.recoveryAction, event);
      });
    }

    updateDebtIndicator(profile) {
      const PR = window.PlayerRecovery;
      if (!this.el.debtIndicator || !PR) return;
      const debt = PR.getRemainingDebt(profile);
      const prs = PR.ensureRecovery(profile);
      const initial = Math.max(Number(prs.loanInitialDebt || 0), debt);
      if (debt <= 0) {
        this.el.debtIndicator.classList.add("hidden");
        return;
      }
      this.el.debtIndicator.classList.remove("hidden");
      this.el.debtAmount.textContent = this.formatMoney(debt);
      const pct = initial > 0 ? Math.max(0, Math.min(100, (100 * (initial - debt)) / initial)) : 0;
      if (this.el.debtBarFill) this.el.debtBarFill.style.width = `${pct}%`;
    }

    updateRoundModeBanner(roundMode) {
      if (!this.el.roundModeBanner) return;
      if (roundMode === "free_play") {
        this.el.roundModeBanner.textContent = "Practice Dive — no rewards, no balance risk";
        this.el.roundModeBanner.classList.remove("hidden");
        this.el.roundModeBanner.classList.add("round-mode-banner--teal");
        this.el.roundModeBanner.classList.remove("round-mode-banner--orange");
      } else if (roundMode === "second_chance") {
        this.el.roundModeBanner.textContent = "Last Chance Dive — fixed wager, real payout";
        this.el.roundModeBanner.classList.remove("hidden");
        this.el.roundModeBanner.classList.add("round-mode-banner--orange");
        this.el.roundModeBanner.classList.remove("round-mode-banner--teal");
      } else {
        this.el.roundModeBanner.textContent = "";
        this.el.roundModeBanner.classList.add("hidden");
        this.el.roundModeBanner.classList.remove("round-mode-banner--teal", "round-mode-banner--orange");
      }
    }

    updateRecoveryHub(profile, gameState) {
      const PR = window.PlayerRecovery;
      if (!PR || !this.el.recoveryHub) return;
      const snap = PR.buildRecoverySnapshot(profile, gameState.phase);
      const emergencyBtn = this.el.recoveryHub.querySelector('[data-recovery-action="claim-emergency"]');
      const dailyBtn = this.el.recoveryHub.querySelector('[data-recovery-action="claim-daily"]');
      const secondBtn = this.el.recoveryHub.querySelector('[data-recovery-action="start-second"]');
      const freeBtn = this.el.recoveryHub.querySelector('[data-recovery-action="start-free"]');
      const loanBtn = this.el.recoveryHub.querySelector('[data-recovery-action="take-loan"]');
      const maxSecond = PR.CONFIG.SECOND_CHANCE_MAX_PER_DAY;
      const usesSecond = profile.playerRecoveryState.secondChanceUsesToday || 0;

      if (this.el.recoveryEmergencyMeta) {
        this.el.recoveryEmergencyMeta.textContent = snap.emergency.ok
          ? `Bailout ${this.formatMoney(snap.emergencyAmount)} · ${snap.emergency.remaining} use(s) left today`
          : (snap.emergency.message || "Unavailable");
      }
      if (emergencyBtn) emergencyBtn.disabled = !snap.emergency.ok;

      if (this.el.recoveryDailyMeta) {
        if (snap.daily.ok) {
          const reward = PR.getDailyBonusAmountForDay(snap.dailyNextDay);
          this.el.recoveryDailyMeta.textContent = `Next ration: Day ${snap.dailyNextDay} → ${this.formatMoney(reward)}`;
        } else {
          const wait = snap.daily.nextAt ? Math.max(0, snap.daily.nextAt - Date.now()) : 0;
          this.el.recoveryDailyMeta.textContent = `Next claim in ${this.formatDuration(wait)}`;
        }
      }
      if (this.el.recoveryDailyLadder) {
        this.el.recoveryDailyLadder.innerHTML = snap.dailyRewards.map((amt, i) => {
          const day = i + 1;
          let cls = "daily-dot";
          if (day === snap.dailyNextDay) cls += " daily-dot--next";
          else if (day < snap.dailyNextDay) cls += " daily-dot--past";
          return `<span class="${cls}" title="Day ${day}: ${this.formatMoney(amt)}">${day}</span>`;
        }).join("");
      }
      if (dailyBtn) dailyBtn.disabled = !snap.daily.ok;

      if (this.el.recoverySecondMeta) {
        if (snap.second.ok) {
          const left = Math.max(0, maxSecond - usesSecond);
          this.el.recoverySecondMeta.textContent = `Fixed wager ${this.formatMoney(snap.secondWager)} · ${left} last dive(s) left today (30m sonar gap)`;
        } else {
          this.el.recoverySecondMeta.textContent = snap.second.message || "Unavailable";
        }
      }
      if (secondBtn) {
        secondBtn.disabled = !snap.second.ok || gameState.phase !== "preRound" || gameState.queuedBet > 0;
      }

      if (this.el.recoveryFreeMeta) {
        this.el.recoveryFreeMeta.textContent = snap.free.ok
          ? `${snap.free.rounds} practice round(s) stocked`
          : (snap.free.message || "Unavailable");
      }
      if (freeBtn) {
        freeBtn.disabled = !snap.free.ok || gameState.phase !== "preRound" || gameState.queuedBet > 0;
      }

      if (this.el.recoveryLoanMeta) {
        if (snap.loanActive) {
          this.el.recoveryLoanMeta.textContent = `Active debt ${this.formatMoney(snap.debt)}`;
        } else if (snap.loan.ok) {
          this.el.recoveryLoanMeta.textContent = `Borrow ${this.formatMoney(snap.loanPrincipal)} · repay ${snap.loanMult}x → owe ${this.formatMoney(snap.loanDebtIfNew)}`;
        } else {
          const wait = snap.loan.nextAt ? Math.max(0, snap.loan.nextAt - Date.now()) : 0;
          this.el.recoveryLoanMeta.textContent = snap.loan.reason === "cooldown"
            ? `Creditors return in ${this.formatDuration(wait)}`
            : (snap.loan.message || "Unavailable");
        }
      }
      if (loanBtn) loanBtn.disabled = !snap.loan.ok || snap.loanActive || gameState.phase === "active";
    }

    renderCollection(skins, unlockedIds, equippedId) {
      this.el.collectionGrid.innerHTML = "";
      skins.forEach((skin) => {
        const unlocked = unlockedIds.includes(skin.id);
        const card = document.createElement("button");
        card.type = "button";
        card.className = `skin-card ${unlocked ? "" : "locked"} ${equippedId === skin.id ? "equipped" : ""}`;
        const unlockText = unlocked ? "Unlocked" : `Unlock: ${skin.unlock.type} ${skin.unlock.value || ""}`;
        card.innerHTML = `
          <div style="font-weight:700">${skin.name}</div>
          <div class="rarity">${skin.rarity}</div>
          <div style="margin-top:8px;height:18px;border-radius:8px;background:${skin.colors.body}"></div>
          <small>${unlockText}</small>
        `;
        card.disabled = !unlocked;
        card.addEventListener("click", () => window.dispatchEvent(new CustomEvent("equip-skin", { detail: skin.id })));
        this.el.collectionGrid.appendChild(card);
      });
    }

    renderChallenges(container, challenges) {
      container.innerHTML = "";
      challenges.forEach((c) => {
        const pct = Math.min(100, (c.progress / c.goal) * 100);
        const card = document.createElement("div");
        card.className = "challenge-card";
        card.innerHTML = `
          <div><strong>${c.text}</strong></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct.toFixed(1)}%"></div></div>
          <div>${c.progress}/${c.goal}</div>
          <button class="preset-btn claim-btn" ${c.completed && !c.claimed ? "" : "disabled"} data-claim-id="${c.id}">${c.claimed ? "Claimed" : "Claim Reward"}</button>
        `;
        container.appendChild(card);
      });
    }

    renderChallengePanels(daily, weekly) {
      this.renderChallenges(this.el.dailyChallenges, daily);
      this.renderChallenges(this.el.weeklyChallenges, weekly);
    }

    renderAchievements(all, unlockedSet) {
      this.el.achievementGrid.innerHTML = "";
      all.forEach((a) => {
        const unlocked = unlockedSet.has(a.id);
        const card = document.createElement("div");
        card.className = "achievement-card";
        card.innerHTML = `<strong>${a.title}</strong><div>${a.desc}</div><small>${unlocked ? "Unlocked" : "Locked"}</small>`;
        card.style.opacity = unlocked ? "1" : "0.6";
        this.el.achievementGrid.appendChild(card);
      });
    }

    renderLeaderboard(rows) {
      this.el.leaderboardTable.innerHTML = "";
      if (!rows || rows.length === 0) {
        const empty = document.createElement("div");
        empty.className = "leader-row";
        empty.innerHTML = "<div>#</div><div>No real player entries yet</div><div>--</div>";
        this.el.leaderboardTable.appendChild(empty);
        return;
      }
      rows.forEach((row, idx) => {
        const div = document.createElement("div");
        div.className = `leader-row ${row.currentPlayer ? "current-player" : ""}`;
        div.innerHTML = `<div>#${idx + 1}</div><div>${row.name}</div><div>${row.value}</div>`;
        this.el.leaderboardTable.appendChild(div);
      });
    }

    renderLiveBets(entries) {
      const list = Array.isArray(entries) ? entries : [];
      const totalWagered = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      if (this.el.fleetWagerTotal) {
        this.el.fleetWagerTotal.textContent = this.formatMoney(totalWagered);
      }
      if (!this.el.liveBetsList) return;
      this.el.liveBetsList.innerHTML = "";
      if (list.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No active bets";
        this.el.liveBetsList.appendChild(li);
        return;
      }
      list.forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.name}: ${this.formatMoney(entry.amount)}`;
        this.el.liveBetsList.appendChild(li);
      });
    }

    bindFriendsPanel(controller) {
      if (this._friendsPanelBound || !controller) return;
      this._friendsPanelBound = true;
      const c = controller;
      if (this.el.friendsSearchForm) {
        this.el.friendsSearchForm.addEventListener("submit", (e) => {
          e.preventDefault();
          if (typeof c.onFriendsSearch === "function") void c.onFriendsSearch();
        });
      }
      if (this.el.friendsRefreshBtn) {
        this.el.friendsRefreshBtn.addEventListener("click", () => {
          if (typeof c.onFriendsRefresh === "function") void c.onFriendsRefresh();
        });
      }
      if (this.el.panelFriends) {
        this.el.panelFriends.addEventListener("click", (e) => {
          const b = e.target.closest("[data-friends-act]");
          if (!b || !b.dataset.friendsAct) return;
          const act = b.dataset.friendsAct;
          if (act === "send-request" && b.dataset.userId && c.onFriendsSendRequest) void c.onFriendsSendRequest(b.dataset.userId);
          if (act === "accept" && b.dataset.requestId && c.onFriendsAcceptRequest) void c.onFriendsAcceptRequest(b.dataset.requestId);
          if (act === "decline" && b.dataset.requestId && c.onFriendsDeclineRequest) void c.onFriendsDeclineRequest(b.dataset.requestId);
          if (act === "remove" && b.dataset.userId && c.onFriendsRemove) void c.onFriendsRemove(b.dataset.userId);
          if (act === "send-money" && b.dataset.transferBlocked === "1") {
            this.showToast("Transfer", "You cannot send transfers while you have unpaid debt.");
            return;
          }
          if (act === "send-money" && b.dataset.userId && c.onFriendsOpenTransfer) {
            c.onFriendsOpenTransfer(b.dataset.userId, b.dataset.displayName || "");
          }
        });
      }
      if (this.el.friendsTransferBackdrop) {
        this.el.friendsTransferBackdrop.addEventListener("click", () => {
          if (typeof c.onFriendsCloseTransfer === "function") c.onFriendsCloseTransfer();
        });
      }
      if (this.el.friendsTransferClose) {
        this.el.friendsTransferClose.addEventListener("click", () => {
          if (typeof c.onFriendsCloseTransfer === "function") c.onFriendsCloseTransfer();
        });
      }
      if (this.el.friendsTransferConfirm) {
        this.el.friendsTransferConfirm.addEventListener("click", () => {
          if (typeof c.onFriendsConfirmTransfer === "function") void c.onFriendsConfirmTransfer();
        });
      }
    }

    getFriendsSearchQuery() {
      return this.el.friendsSearchInput && this.el.friendsSearchInput.value ? this.el.friendsSearchInput.value.trim() : "";
    }

    setFriendsTransferLoading(loading) {
      this._friendsTransferLoading = !!loading;
      if (this.el.friendsTransferConfirm) {
        this.el.friendsTransferConfirm.disabled = this._friendsTransferLoading;
        this.el.friendsTransferConfirm.textContent = this._friendsTransferLoading ? "Sending…" : "Confirm send";
      }
      if (this.el.friendsTransferAmount) this.el.friendsTransferAmount.disabled = this._friendsTransferLoading;
    }

    openFriendsTransferModal({ recipientName, balanceFormatted, recipientId }) {
      this._friendsTransferRecipientId = recipientId || null;
      if (this.el.friendsTransferRecipient) this.el.friendsTransferRecipient.textContent = recipientName || "Friend";
      if (this.el.friendsTransferBalance) this.el.friendsTransferBalance.textContent = balanceFormatted || this.formatMoney(0);
      if (this.el.friendsTransferAmount) this.el.friendsTransferAmount.value = "10";
      if (this.el.friendsTransferModal) {
        this.el.friendsTransferModal.classList.remove("hidden");
        this.el.friendsTransferModal.setAttribute("aria-hidden", "false");
      }
      this.setFriendsTransferLoading(false);
    }

    closeFriendsTransferModal() {
      this._friendsTransferRecipientId = null;
      if (this.el.friendsTransferModal) {
        this.el.friendsTransferModal.classList.add("hidden");
        this.el.friendsTransferModal.setAttribute("aria-hidden", "true");
      }
      this.setFriendsTransferLoading(false);
    }

    getFriendsTransferRecipientId() {
      return this._friendsTransferRecipientId || null;
    }

    getFriendsTransferAmount() {
      const v = Number(this.el.friendsTransferAmount && this.el.friendsTransferAmount.value);
      return Number.isFinite(v) ? v : 0;
    }

    escHtml(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    }

    renderFriendsPanel(state) {
      const st = state || {};
      if (this.el.friendsAuthNote) {
        this.el.friendsAuthNote.classList.toggle("hidden", !!st.authenticated);
      }
      if (this.el.friendsDebtNote) {
        this.el.friendsDebtNote.classList.toggle("hidden", !st.hasDebt);
      }
      if (!this.el.friendsSearchResults || !this.el.friendsIncomingList || !this.el.friendsList || !this.el.friendsTransferHistory) return;
      if (!st.authenticated) {
        this.el.friendsSearchResults.innerHTML = "";
        this.el.friendsIncomingList.innerHTML = "";
        this.el.friendsList.innerHTML = "";
        this.el.friendsTransferHistory.innerHTML = "";
        return;
      }
      if (st.supabaseMissing) {
        const msg = `<div class="friends-empty friends-empty--warn">Supabase is not connected in this build.</div>`;
        this.el.friendsSearchResults.innerHTML = msg;
        this.el.friendsIncomingList.innerHTML = msg;
        this.el.friendsList.innerHTML = msg;
        this.el.friendsTransferHistory.innerHTML = msg;
        return;
      }
      const esc = (x) => this.escHtml(x);
      const results = Array.isArray(st.searchResults) ? st.searchResults : [];
      if (results.length === 0) {
        this.el.friendsSearchResults.innerHTML = `<div class="friends-empty">${st.searchPerformed ? "No matches." : "Type at least 2 characters and search."}</div>`;
      } else {
        this.el.friendsSearchResults.innerHTML = results
          .map((r) => {
            const uid = String(r.userId || "").replace(/"/g, "");
            const nm = esc(r.displayName || "Player");
            let actions = "";
            if (r.relation === "friends") {
              actions = `<button type="button" class="friends-btn friends-btn--small" disabled>Friends</button>`;
            } else if (r.relation === "sent") {
              actions = `<button type="button" class="friends-btn friends-btn--small" disabled>Request sent</button>`;
            } else if (r.relation === "incoming") {
              actions = `<span class="friends-chip">Incoming — see below</span>`;
            } else {
              actions = `<button type="button" class="friends-btn friends-btn--small" data-friends-act="send-request" data-user-id="${uid}">Send request</button>`;
            }
            return `<div class="friends-card"><div class="friends-card__name">${nm}</div><div class="friends-card__actions">${actions}</div></div>`;
          })
          .join("");
      }
      const incoming = Array.isArray(st.incoming) ? st.incoming : [];
      if (incoming.length === 0) {
        this.el.friendsIncomingList.innerHTML = `<div class="friends-empty">No incoming requests.</div>`;
      } else {
        this.el.friendsIncomingList.innerHTML = incoming
          .map((r) => {
            const nm = esc(r.senderName || "Player");
            const rid = String(r.id || "").replace(/"/g, "");
            return `<div class="friends-card"><div class="friends-card__name">${nm}</div><div class="friends-card__actions">
              <button type="button" class="friends-btn friends-btn--small friends-btn--primary" data-friends-act="accept" data-request-id="${rid}">Accept</button>
              <button type="button" class="friends-btn friends-btn--small" data-friends-act="decline" data-request-id="${rid}">Decline</button>
            </div></div>`;
          })
          .join("");
      }
      const friends = Array.isArray(st.friends) ? st.friends : [];
      if (friends.length === 0) {
        this.el.friendsList.innerHTML = `<div class="friends-empty">No friends yet.</div>`;
      } else {
        this.el.friendsList.innerHTML = friends
          .map((f) => {
            const uid = String(f.userId || "").replace(/"/g, "");
            const nm = esc(f.displayName || "Player");
            const online = f.online
              ? `<span class="friends-online" title="Online">●</span>`
              : `<span class="friends-offline" title="Status unknown">○</span>`;
            const transferBlockedAttr = st.transferBlocked ? `data-transfer-blocked="1"` : "";
            const transferBlockedClass = st.transferBlocked ? " friends-btn--blocked" : "";
            return `<div class="friends-card"><div class="friends-card__name">${online} ${nm}</div><div class="friends-card__actions">
              <button type="button" class="friends-btn friends-btn--small friends-btn--primary${transferBlockedClass}" data-friends-act="send-money" data-user-id="${uid}" data-display-name="${nm}" ${transferBlockedAttr}>Send money</button>
              <button type="button" class="friends-btn friends-btn--small" data-friends-act="remove" data-user-id="${uid}">Remove</button>
            </div></div>`;
          })
          .join("");
      }
      const hist = Array.isArray(st.transferHistory) ? st.transferHistory : [];
      if (hist.length === 0) {
        this.el.friendsTransferHistory.innerHTML = `<li class="friends-empty">No transfers yet.</li>`;
      } else {
        this.el.friendsTransferHistory.innerHTML = hist
          .map((h) => {
            const dir = h.direction === "sent" ? "Sent" : "Received";
            const amt = this.formatMoney(h.amount || 0);
            const who = esc(h.counterpartyName || "Player");
            const dt = esc(h.createdAtLabel || "");
            return `<li class="friends-history__row"><span class="friends-history__dir">${dir}</span><span class="friends-history__who">${who}</span><span class="friends-history__amt">${amt}</span><span class="friends-history__dt">${dt}</span></li>`;
          })
          .join("");
      }
    }

    renderStats(stats, achievementsUnlockedCount, favoriteSub) {
      const entries = [
        ["Total Rounds", stats.totalRounds],
        ["Total Wins", stats.totalWins],
        ["Total Losses", stats.totalLosses],
        ["Win Rate", `${stats.totalRounds ? ((stats.totalWins / stats.totalRounds) * 100).toFixed(1) : "0.0"}%`],
        ["Biggest Cashout", `${stats.highestMultiplier.toFixed(2)}x`],
        ["Biggest Single Payout", this.formatMoney(stats.biggestPayout)],
        ["Highest Balance", this.formatMoney(stats.highestBalance)],
        ["Total Profit/Loss", this.formatMoney(stats.totalProfit)],
        ["Current Streak", stats.currentWinStreak || 0],
        ["Longest Streak", stats.bestWinStreak || 0],
        ["Daily Streak", stats.dailyStreak || 1],
        ["Favorite Submarine", favoriteSub],
        ["Achievements", achievementsUnlockedCount]
      ];
      this.el.statsGrid.innerHTML = "";
      entries.forEach(([k, v]) => {
        const card = document.createElement("div");
        card.className = "stat-card";
        card.innerHTML = `<div class="rarity">${k}</div><strong>${v}</strong>`;
        this.el.statsGrid.appendChild(card);
      });
    }
  }

  window.GameUI = GameUI;
})();
