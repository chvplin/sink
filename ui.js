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
        autoToggle: document.getElementById("auto-cashout-toggle"),
        autoInput: document.getElementById("auto-cashout-input"),
        serverHash: document.getElementById("server-hash-display"),
        nonce: document.getElementById("nonce-display"),
        autoBetToggle: document.getElementById("auto-bet-toggle"),
        autoStopWins: document.getElementById("auto-stop-wins"),
        autoStopLosses: document.getElementById("auto-stop-losses"),
        autoStopBalance: document.getElementById("auto-stop-balance"),
        tabs: Array.from(document.querySelectorAll("[data-tab]")),
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
        signOutButton: document.getElementById("signout-button")
      };
      this.currentLeaderboardTab = "highestMultiplier";
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

      adjustButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          controller.adjustBetInput(Number(btn.dataset.betAdjust));
        });
      });

      presetButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          controller.setBetInput(Number(btn.dataset.preset));
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

    setPhase(text) {
      this.el.phaseLabel.textContent = text;
    }

    setMultiplier(multiplier) {
      this.el.multiplier.textContent = `${multiplier.toFixed(2)}x`;
      this.el.multiplier.style.color = multiplier >= 10 ? "#ffd88f" : "#ffffff";
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
      this.el.potentialWin.textContent = this.formatMoney(potentialWin);
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
      this.el.cashoutButton.textContent = hasCashedOut ? "Cashed Out" : "Cash Out";
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

    showToast(title, body) {
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.innerHTML = `<strong>${title}</strong><div>${body}</div>`;
      this.el.toastRoot.prepend(toast);
      setTimeout(() => toast.remove(), 3400);
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
