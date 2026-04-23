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
          settings: document.getElementById("panel-settings")
        },
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
        resetSaveButton: document.getElementById("reset-save-button"),
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
        recoveryLoanMeta: document.getElementById("recovery-loan-meta")
      };
      this.currentLeaderboardTab = "highestMultiplier";
      this.setupResponsiveMode();
    }

    setupResponsiveMode() {
      const mq = window.matchMedia("(max-width: 820px)");
      const apply = () => {
        document.body.classList.toggle("mobile-ui", mq.matches);
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
      this.el.resetSaveButton.addEventListener("click", () => controller.resetSave());
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

      this.el.tabs.forEach((tabBtn) => {
        tabBtn.addEventListener("click", () => this.switchTab(tabBtn.dataset.tab));
      });
      this.el.leaderTabs.forEach((tabBtn) => {
        tabBtn.addEventListener("click", () => {
          this.currentLeaderboardTab = tabBtn.dataset.leaderTab;
          this.el.leaderTabs.forEach((t) => t.classList.toggle("active", t === tabBtn));
          controller.onLeaderboardTabChange(this.currentLeaderboardTab);
        });
      });
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
      this.el.multiplier.style.color = multiplier >= 10 ? "#ffd88f" : "#ffffff";
      const norm = Math.min(1, Math.max(0, Math.log10(m) / Math.log10(10000)));
      const marker = document.getElementById("multiplier-rail-marker");
      if (marker) {
        marker.style.bottom = `calc(${norm * 100}% - 9px)`;
      }
    }

    setDepth(depthNorm) {
      const depthMeters = Math.floor(depthNorm * 8200);
      this.el.depth.textContent = `${depthMeters.toLocaleString()} m`;
      this.el.depthFill.style.width = `${(depthNorm * 100).toFixed(1)}%`;
    }

    setCountdown(seconds) {
      this.el.countdown.textContent = `Next round in ${seconds.toFixed(1)}s`;
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
      if (!this.el.liveBetsList) return;
      this.el.liveBetsList.innerHTML = "";
      if (!entries || entries.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No active bets";
        this.el.liveBetsList.appendChild(li);
        return;
      }
      entries.forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.name}: ${this.formatMoney(entry.amount)}`;
        this.el.liveBetsList.appendChild(li);
      });
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
