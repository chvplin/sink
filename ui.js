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
        nonce: document.getElementById("nonce-display")
      };
    }

    bindControls(controller) {
      const adjustButtons = document.querySelectorAll("[data-bet-adjust]");
      const presetButtons = document.querySelectorAll("[data-preset]");

      this.el.betButton.addEventListener("click", () => controller.placeBet());
      this.el.cashoutButton.addEventListener("click", () => controller.cashOut("manual"));

      this.el.betInput.addEventListener("change", () => controller.onBetInputChange());
      this.el.autoToggle.addEventListener("change", () => {
        this.el.autoInput.disabled = !this.el.autoToggle.checked;
      });

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
      this.el.cashoutButton.disabled = !canCashout;
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
  }

  window.GameUI = GameUI;
})();
