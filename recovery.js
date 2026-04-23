(function () {
  const MS_DAY = 86400000;
  const MS_HOUR = 3600000;
  const MS_SECOND_CHANCE_COOLDOWN = 30 * MS_HOUR;

  const RECOVERY_DEFAULTS = {
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
  };

  const CONFIG = {
    EMERGENCY_BAILOUT: 750,
    EMERGENCY_MAX_PER_DAY: 2,
    DAILY_BONUS_REWARDS: [500, 750, 1000, 1250, 1500, 2000, 5000],
    SECOND_CHANCE_WAGER: 500,
    SECOND_CHANCE_MAX_PER_DAY: 2,
    FREE_PLAY_GRANT: 3,
    LOAN_PRINCIPAL: 1000,
    LOAN_REPAY_MULT: 1.75,
    LOAN_COOLDOWN_AFTER_REPAY_MS: 2 * MS_HOUR,
    NEAR_MISS_MILESTONES: [2, 5, 10, 25, 50, 100],
    NEAR_MISS_MAX_GAP: 0.45,
    DAILY_BONUS_SKIN_ID: "crew_rescue"
  };

  function ensureRecovery(profile) {
    if (!profile.playerRecoveryState) profile.playerRecoveryState = { ...RECOVERY_DEFAULTS };
    const prs = profile.playerRecoveryState;
    Object.keys(RECOVERY_DEFAULTS).forEach((k) => {
      if (prs[k] === undefined || prs[k] === null) prs[k] = RECOVERY_DEFAULTS[k];
    });
    return prs;
  }

  function todayKey() {
    return typeof window.GameDataService !== "undefined" && window.GameDataService.todayKey
      ? window.GameDataService.todayKey()
      : new Date().toISOString().slice(0, 10);
  }

  function resetDailyCounters(prs, keyLastReset, keyUses) {
    const today = todayKey();
    if (prs[keyLastReset] !== today) {
      prs[keyLastReset] = today;
      prs[keyUses] = 0;
    }
  }

  function isBroke(profile) {
    return Number(profile.balance) <= 0;
  }

  function getRemainingDebt(profile) {
    const prs = ensureRecovery(profile);
    return Math.max(0, Number(prs.totalDebtRemaining || 0));
  }

  function hasActiveLoan(profile) {
    const prs = ensureRecovery(profile);
    return !!(prs.loanActive && getRemainingDebt(profile) > 0);
  }

  function syncFreePlayWithBalance(profile) {
    const prs = ensureRecovery(profile);
    if (Number(profile.balance) > 0) {
      prs.freePlayRoundsAvailable = 0;
      prs.freePlayRefillOnNextZero = true;
      return;
    }
    if (prs.freePlayRefillOnNextZero) {
      prs.freePlayRoundsAvailable = CONFIG.FREE_PLAY_GRANT;
      prs.freePlayRefillOnNextZero = false;
    }
  }

  function canClaimEmergencyFunding(profile) {
    const prs = ensureRecovery(profile);
    resetDailyCounters(prs, "emergencyFundingLastReset", "emergencyFundingUsesToday");
    if (!isBroke(profile)) return { ok: false, reason: "balance", message: "Available when your balance hits $0." };
    if (prs.emergencyFundingUsesToday >= CONFIG.EMERGENCY_MAX_PER_DAY) {
      return {
        ok: false,
        reason: "limit",
        message: "No crew bailouts left today. Try the daily bonus, a loan, or a practice dive."
      };
    }
    return { ok: true, remaining: CONFIG.EMERGENCY_MAX_PER_DAY - prs.emergencyFundingUsesToday };
  }

  function claimEmergencyFunding(profile) {
    const check = canClaimEmergencyFunding(profile);
    if (!check.ok) return check;
    const prs = ensureRecovery(profile);
    prs.emergencyFundingUsesToday += 1;
    profile.balance = Number((Number(profile.balance) + CONFIG.EMERGENCY_BAILOUT).toFixed(2));
    syncFreePlayWithBalance(profile);
    return { ok: true, amount: CONFIG.EMERGENCY_BAILOUT, remaining: CONFIG.EMERGENCY_MAX_PER_DAY - prs.emergencyFundingUsesToday };
  }

  function getDailyBonusAmountForDay(day) {
    const d = Math.max(1, Math.min(7, day));
    return CONFIG.DAILY_BONUS_REWARDS[d - 1];
  }

  function canClaimDailyBonus(profile, nowMs = Date.now()) {
    const prs = ensureRecovery(profile);
    const last = Number(prs.dailyBonusLastClaim || 0);
    if (!last) return { ok: true, nextAt: 0, streakDay: prs.dailyBonusNextRewardDay };
    const elapsed = nowMs - last;
    if (elapsed < MS_DAY) {
      return { ok: false, nextAt: last + MS_DAY, streakDay: prs.dailyBonusNextRewardDay };
    }
    if (elapsed > 48 * MS_HOUR) {
      prs.dailyBonusNextRewardDay = 1;
    }
    return { ok: true, nextAt: 0, streakDay: prs.dailyBonusNextRewardDay };
  }

  function claimDailyBonus(profile, skinsContent, nowMs = Date.now()) {
    const prs = ensureRecovery(profile);
    const gate = canClaimDailyBonus(profile, nowMs);
    if (!gate.ok) return { ok: false, ...gate };
    const last = Number(prs.dailyBonusLastClaim || 0);
    if (last && nowMs - last > 48 * MS_HOUR) prs.dailyBonusNextRewardDay = 1;
    const day = Math.max(1, Math.min(7, prs.dailyBonusNextRewardDay));
    const amount = getDailyBonusAmountForDay(day);
    profile.balance = Number((Number(profile.balance) + amount).toFixed(2));
    syncFreePlayWithBalance(profile);
    prs.dailyBonusLastClaim = nowMs;
    if (day === 7) {
      if (skinsContent && Array.isArray(skinsContent.SUBMARINE_SKINS)) {
        const sid = CONFIG.DAILY_BONUS_SKIN_ID;
        if (!profile.unlockedSkinIds.includes(sid)) profile.unlockedSkinIds.push(sid);
      }
      prs.dailyBonusNextRewardDay = 1;
    } else {
      prs.dailyBonusNextRewardDay = day + 1;
    }
    return { ok: true, amount, day };
  }

  function canUseSecondChance(profile, nowMs = Date.now()) {
    const prs = ensureRecovery(profile);
    resetDailyCounters(prs, "secondChanceLastReset", "secondChanceUsesToday");
    if (!isBroke(profile)) return { ok: false, reason: "balance", message: "Only when balance is $0." };
    if (prs.secondChanceUsesToday >= CONFIG.SECOND_CHANCE_MAX_PER_DAY) {
      return { ok: false, reason: "daily", message: "No last dives left today." };
    }
    const last = Number(prs.secondChanceLastUsed || 0);
    if (last && nowMs - last < MS_SECOND_CHANCE_COOLDOWN) {
      return {
        ok: false,
        reason: "cooldown",
        message: "Sonar cooling down.",
        nextAt: last + MS_SECOND_CHANCE_COOLDOWN
      };
    }
    return { ok: true, wager: CONFIG.SECOND_CHANCE_WAGER };
  }

  function canStartFreePlay(profile) {
    const prs = ensureRecovery(profile);
    syncFreePlayWithBalance(profile);
    if (!isBroke(profile)) return { ok: false, reason: "balance", message: "Practice dives unlock when funds run dry." };
    if (prs.freePlayRoundsAvailable <= 0) {
      return { ok: false, reason: "none", message: "No practice rounds left this dry dock." };
    }
    return { ok: true, rounds: prs.freePlayRoundsAvailable };
  }

  function canTakeLoan(profile, phase) {
    const prs = ensureRecovery(profile);
    if (phase === "active") return { ok: false, reason: "round", message: "Wait until the dive countdown." };
    if (Number(profile.balance) > 0) return { ok: false, reason: "balance", message: "Loans unlock at $0 balance." };
    if (hasActiveLoan(profile)) return { ok: false, reason: "active", message: "You already have bridge credit out." };
    const next = Number(prs.loanNextEligibleAt || 0);
    if (next && Date.now() < next) {
      return { ok: false, reason: "cooldown", message: "Creditors want a short cooldown.", nextAt: next };
    }
    return { ok: true };
  }

  function takeLoan(profile, phase) {
    const ok = canTakeLoan(profile, phase);
    if (!ok.ok) return ok;
    const prs = ensureRecovery(profile);
    const mult = Number(prs.loanRepaymentMultiplier || CONFIG.LOAN_REPAY_MULT);
    prs.loanPrincipal = CONFIG.LOAN_PRINCIPAL;
    prs.loanRepaymentMultiplier = mult;
    prs.totalDebtRemaining = Number((CONFIG.LOAN_PRINCIPAL * mult).toFixed(2));
    prs.loanInitialDebt = prs.totalDebtRemaining;
    prs.loanActive = true;
    profile.balance = Number((Number(profile.balance) + CONFIG.LOAN_PRINCIPAL).toFixed(2));
    syncFreePlayWithBalance(profile);
    return { ok: true, principal: CONFIG.LOAN_PRINCIPAL, debt: prs.totalDebtRemaining, mult };
  }

  function applyDebtRepayment(profile, grossWinnings) {
    const prs = ensureRecovery(profile);
    const gross = Math.max(0, Number(grossWinnings) || 0);
    const debt = getRemainingDebt(profile);
    if (!prs.loanActive || debt <= 0) {
      return { balanceAdd: gross, debtPaid: 0, remainingDebt: debt };
    }
    const toDebt = Math.min(debt, gross);
    const remaining = Number((debt - toDebt).toFixed(2));
    prs.totalDebtRemaining = remaining;
    if (remaining <= 0) {
      prs.totalDebtRemaining = 0;
      prs.loanActive = false;
      prs.loanPrincipal = 0;
      prs.loanInitialDebt = 0;
      prs.loanNextEligibleAt = Date.now() + CONFIG.LOAN_COOLDOWN_AFTER_REPAY_MS;
    }
    return { balanceAdd: gross - toDebt, debtPaid: toDebt, remainingDebt: prs.totalDebtRemaining };
  }

  function creditBalanceFromGrossWinnings(profile, gross) {
    const split = applyDebtRepayment(profile, gross);
    profile.balance = Number((Number(profile.balance) + split.balanceAdd).toFixed(2));
    syncFreePlayWithBalance(profile);
    return split;
  }

  function getNearestMissMilestone(crashPoint) {
    const m = CONFIG.NEAR_MISS_MILESTONES;
    let best = null;
    let bestGap = Infinity;
    m.forEach((ms) => {
      const g = ms - crashPoint;
      if (g > 0 && g < bestGap) {
        bestGap = g;
        best = ms;
      }
    });
    return best != null && bestGap <= CONFIG.NEAR_MISS_MAX_GAP ? { milestone: best, gap: bestGap } : null;
  }

  function shouldShowNearMiss({ crashPoint, hadRealBet, lost, roundMode }) {
    if (!hadRealBet || !lost || roundMode === "free_play") return null;
    const nm = getNearestMissMilestone(crashPoint);
    if (nm) {
      return {
        title: "Near miss",
        body: `Pressure hull failed ${nm.gap.toFixed(2)}x shy of ${nm.milestone}x.`
      };
    }
    if (crashPoint >= 4 && crashPoint < 10) {
      const gap = 10 - crashPoint;
      if (gap > 0 && gap <= 0.6) {
        return {
          title: "Almost double digits",
          body: "One more heartbeat of depth and you would have crossed 10x."
        };
      }
    }
    return null;
  }

  function shouldShowRecoveryHub(profile) {
    return isBroke(profile);
  }

  function buildRecoverySnapshot(profile, phase, nowMs = Date.now()) {
    const prs = ensureRecovery(profile);
    resetDailyCounters(prs, "emergencyFundingLastReset", "emergencyFundingUsesToday");
    resetDailyCounters(prs, "secondChanceLastReset", "secondChanceUsesToday");
    syncFreePlayWithBalance(profile);
    const emergency = canClaimEmergencyFunding(profile);
    const daily = canClaimDailyBonus(profile, nowMs);
    const second = canUseSecondChance(profile, nowMs);
    const free = canStartFreePlay(profile);
    const loan = canTakeLoan(profile, phase);
    const debt = getRemainingDebt(profile);
    const mult = Number(prs.loanRepaymentMultiplier || CONFIG.LOAN_REPAY_MULT);
    const loanDebtIfNew = Number((CONFIG.LOAN_PRINCIPAL * mult).toFixed(2));
    return {
      broke: isBroke(profile),
      debt,
      debtMax: debt || loanDebtIfNew,
      loanActive: hasActiveLoan(profile),
      emergency,
      daily,
      second,
      free,
      loan,
      loanDebtIfNew,
      loanPrincipal: CONFIG.LOAN_PRINCIPAL,
      loanMult: mult,
      emergencyAmount: CONFIG.EMERGENCY_BAILOUT,
      emergencyMax: CONFIG.EMERGENCY_MAX_PER_DAY,
      emergencyUsed: prs.emergencyFundingUsesToday,
      dailyRewards: [...CONFIG.DAILY_BONUS_REWARDS],
      dailyNextDay: prs.dailyBonusNextRewardDay,
      secondWager: CONFIG.SECOND_CHANCE_WAGER,
      freeRounds: prs.freePlayRoundsAvailable
    };
  }

  window.PlayerRecovery = {
    CONFIG,
    ensureRecovery,
    syncFreePlayWithBalance,
    isBroke,
    getRemainingDebt,
    hasActiveLoan,
    canClaimEmergencyFunding,
    claimEmergencyFunding,
    canClaimDailyBonus,
    claimDailyBonus,
    getDailyBonusAmountForDay,
    canUseSecondChance,
    canStartFreePlay,
    canTakeLoan,
    takeLoan,
    applyDebtRepayment,
    creditBalanceFromGrossWinnings,
    getNearestMissMilestone,
    shouldShowNearMiss,
    shouldShowRecoveryHub,
    buildRecoverySnapshot
  };
})();
