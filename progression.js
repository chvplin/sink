(function () {
  const SUBMARINE_SKINS = [
    { id: "classic", name: "Classic Yellow", rarity: "Common", colors: { body: "#f7d23b", accent: "#d2a814", trim: "#463203" }, unlock: { type: "default" } },
    { id: "crew_rescue", name: "Rescue Crew Livery", rarity: "Rare", colors: { body: "#4ad6c8", accent: "#1e8a7e", trim: "#0a2f2a" }, unlock: { type: "crewRescueBonus", value: 1 } },
    { id: "explorer", name: "Explorer", rarity: "Common", colors: { body: "#ff9f43", accent: "#c56a17", trim: "#4f2d00" }, unlock: { type: "roundsPlayed", value: 20 } },
    { id: "salvage", name: "Salvage", rarity: "Common", colors: { body: "#7ac4b8", accent: "#3f837a", trim: "#103f39" }, unlock: { type: "placeBets", value: 30 } },
    { id: "military", name: "Military", rarity: "Rare", colors: { body: "#7b8c66", accent: "#4d5d3d", trim: "#1f2816" }, unlock: { type: "winRounds", value: 15 } },
    { id: "steampunk", name: "Steampunk", rarity: "Rare", colors: { body: "#c48a52", accent: "#8a5a2f", trim: "#3f2209" }, unlock: { type: "profitTotal", value: 1500 } },
    { id: "neon", name: "Neon Cyber", rarity: "Rare", colors: { body: "#2de2e6", accent: "#6a4cff", trim: "#0e113a" }, unlock: { type: "cashouts", value: 40 } },
    { id: "whale", name: "Whale Hull", rarity: "Rare", colors: { body: "#6e98c9", accent: "#3f5f8f", trim: "#1b2f53" }, unlock: { type: "cashoutUnder", value: 10, multiplier: 2 } },
    { id: "bio", name: "Bioluminescent", rarity: "Epic", colors: { body: "#52f8d6", accent: "#1ba58a", trim: "#053b36" }, unlock: { type: "reachMultiplier", value: 25 } },
    { id: "abyss", name: "Deep Abyss", rarity: "Epic", colors: { body: "#5f7db8", accent: "#223e72", trim: "#090f2b" }, unlock: { type: "reachMultiplier", value: 50 } },
    { id: "treasure", name: "Treasure Hunter", rarity: "Epic", colors: { body: "#f5be51", accent: "#cb7d20", trim: "#4d2200" }, unlock: { type: "biggestWin", value: 2000 } },
    { id: "glacier", name: "Glacier", rarity: "Epic", colors: { body: "#c4e9ff", accent: "#82b5de", trim: "#234367" }, unlock: { type: "dailyStreak", value: 4 } },
    { id: "arc", name: "Arc Reactor", rarity: "Epic", colors: { body: "#8fd2ff", accent: "#3766ff", trim: "#121b57" }, unlock: { type: "cashoutOver", value: 8, count: 3 } },
    { id: "gold", name: "Golden Sub", rarity: "Legendary", colors: { body: "#f5d676", accent: "#d1a231", trim: "#5a3a05" }, unlock: { type: "profitTotal", value: 5000 } },
    { id: "kraken", name: "Krakenbreaker", rarity: "Legendary", colors: { body: "#9e74d9", accent: "#6233b3", trim: "#240b52" }, unlock: { type: "reachMultiplier", value: 100 } },
    { id: "void", name: "Void Runner", rarity: "Legendary", colors: { body: "#2f2d4f", accent: "#1ecad3", trim: "#04040e" }, unlock: { type: "highestBalance", value: 15000 } },
    { id: "celestial", name: "Celestial", rarity: "Legendary", colors: { body: "#f0b0ff", accent: "#a344ff", trim: "#2b0a5f" }, unlock: { type: "achievements", value: 18 } }
  ];

  const ACHIEVEMENTS = [
    { id: "first_dive", title: "First Dive", desc: "Play your first round.", rule: { type: "roundsPlayed", value: 1 } },
    { id: "safe_hands", title: "Safe Hands", desc: "Cash out below 2x ten times.", rule: { type: "cashoutUnder", value: 10, multiplier: 2 } },
    { id: "deep_diver", title: "Deep Diver", desc: "Reach 10x once.", rule: { type: "reachMultiplier", value: 10 } },
    { id: "abyss_explorer", title: "Abyss Explorer", desc: "Reach 100x once.", rule: { type: "reachMultiplier", value: 100 } },
    { id: "close_call", title: "Close Call", desc: "Cash out within 0.2x of crash.", rule: { type: "closeCall", value: 1 } },
    { id: "lucky_7s", title: "Lucky 7s", desc: "Cash out exactly around 7x.", rule: { type: "cashoutAround", value: 7 } },
    { id: "club_25", title: "25x Club", desc: "Reach 25x once.", rule: { type: "reachMultiplier", value: 25 } },
    { id: "club_50", title: "50x Club", desc: "Reach 50x once.", rule: { type: "reachMultiplier", value: 50 } },
    { id: "club_100", title: "100x Club", desc: "Reach 100x once.", rule: { type: "reachMultiplier", value: 100 } },
    { id: "streak_3", title: "Warm Streak", desc: "Hit a 3 win streak.", rule: { type: "winStreak", value: 3 } },
    { id: "streak_7", title: "Streak Master", desc: "Hit a 7 win streak.", rule: { type: "winStreak", value: 7 } },
    { id: "big_spender", title: "Big Spender", desc: "Place $10,000 in total bets.", rule: { type: "totalBet", value: 10000 } },
    { id: "mini_whale", title: "Mini Whale", desc: "Place a $500 bet.", rule: { type: "singleBet", value: 500 } },
    { id: "millionaire", title: "Millionaire", desc: "Reach $100,000 balance.", rule: { type: "highestBalance", value: 100000 } },
    { id: "win_1k", title: "Big Splash", desc: "Win $1,000 in one round.", rule: { type: "singleWin", value: 1000 } },
    { id: "win_5k", title: "Treasure Vault", desc: "Win $5,000 in one round.", rule: { type: "singleWin", value: 5000 } },
    { id: "login_3", title: "Return Visitor", desc: "Reach a 3-day login streak.", rule: { type: "dailyStreak", value: 3 } },
    { id: "login_7", title: "Perfect Week", desc: "Reach a 7-day login streak.", rule: { type: "dailyStreak", value: 7 } },
    { id: "lucky_round", title: "Golden Water", desc: "Win a lucky round.", rule: { type: "luckyRoundWins", value: 1 } },
    { id: "play_50", title: "Committed", desc: "Play 50 rounds.", rule: { type: "roundsPlayed", value: 50 } },
    { id: "play_250", title: "Veteran", desc: "Play 250 rounds.", rule: { type: "roundsPlayed", value: 250 } },
    { id: "profit_2k", title: "In the Green", desc: "Reach $2,000 profit.", rule: { type: "profitTotal", value: 2000 } },
    { id: "profit_10k", title: "Tycoon", desc: "Reach $10,000 profit.", rule: { type: "profitTotal", value: 10000 } },
    { id: "cashout_100", title: "Consistent", desc: "Cash out 100 times.", rule: { type: "cashouts", value: 100 } },
    { id: "collector", title: "Collector", desc: "Unlock 10 submarine skins.", rule: { type: "skinsUnlocked", value: 10 } }
  ];

  const DAILY_CHALLENGE_POOL = [
    { id: "daily_cash5x3", text: "Cash out above 5x three times", goal: 3, metric: "cashoutOver5" },
    { id: "daily_play20", text: "Play 20 rounds", goal: 20, metric: "roundsPlayedSession" },
    { id: "daily_win_streak3", text: "Reach a 3-win streak once", goal: 1, metric: "streak3Hits" },
    { id: "daily_low_cash10", text: "Cash out below 2x ten times", goal: 10, metric: "cashoutUnder2" },
    { id: "daily_place15", text: "Place 15 bets", goal: 15, metric: "betsPlacedSession" },
    { id: "daily_reach25", text: "Reach 25x once", goal: 1, metric: "reach25Session" }
  ];

  /** Cosmetic shop (no gameplay effects). Submarine entries map to existing hangar skin ids. */
  const COSMETIC_SHOP_ITEMS = [
    { id: "classic_submarine", name: "Classic Yellow (starter)", category: "submarines", rarity: "Common", price: 0, skinMap: "classic", asset: "assets/cosmetics/classic_sub.png" },
    { id: "golden_submarine", name: "Golden Submarine", category: "submarines", rarity: "Legendary", price: 2500, skinMap: "gold", asset: "assets/cosmetics/golden_sub.png" },
    { id: "neon_submarine", name: "Neon Submarine", category: "submarines", rarity: "Rare", price: 1800, skinMap: "neon", asset: "assets/cosmetics/neon_sub.png" },
    { id: "abyss_submarine", name: "Abyss Submarine", category: "submarines", rarity: "Epic", price: 2200, skinMap: "abyss", asset: "assets/cosmetics/abyss_sub.png" },
    { id: "pearl_bubble_trail", name: "Pearl Bubble Trail", category: "trails", rarity: "Rare", price: 400, trailKey: "pearl", asset: "assets/cosmetics/pearl_trail.png" },
    { id: "sonar_wave_trail", name: "Sonar Wave Trail", category: "trails", rarity: "Epic", price: 600, trailKey: "sonar", asset: "assets/cosmetics/sonar_trail.png" },
    { id: "red_diver_suit", name: "Crimson Diver Suit", category: "diverSuits", rarity: "Common", price: 350, diverKey: "red", asset: "assets/cosmetics/red_suit.png" },
    { id: "gold_diver_suit", name: "Gold Diver Suit", category: "diverSuits", rarity: "Rare", price: 500, diverKey: "gold", asset: "assets/cosmetics/gold_suit.png" },
    { id: "electric_crash_effect", name: "Electric Crash", category: "crashEffects", rarity: "Epic", price: 800, crashKey: "electric", asset: "assets/cosmetics/electric_crash.png" },
    { id: "ink_cloud_crash_effect", name: "Ink Cloud Crash", category: "crashEffects", rarity: "Epic", price: 750, crashKey: "ink", asset: "assets/cosmetics/ink_crash.png" },
    { id: "captain_profile_frame", name: "Captain Profile Frame", category: "profileFrames", rarity: "Rare", price: 300, frameKey: "captain", asset: "assets/cosmetics/captain_frame.png" }
  ];

  const WEEKLY_CHALLENGE_POOL = [
    { id: "weekly_profit5k", text: "Earn $5,000 profit", goal: 5000, metric: "profitSession" },
    { id: "weekly_play120", text: "Play 120 rounds", goal: 120, metric: "roundsPlayedSession" },
    { id: "weekly_reach50", text: "Reach 50x once", goal: 1, metric: "reach50Session" },
    { id: "weekly_cashout40", text: "Cash out 40 times", goal: 40, metric: "cashoutCountSession" },
    { id: "weekly_streak5", text: "Reach 5-win streak", goal: 1, metric: "streak5Hits" },
    { id: "weekly_bigwin2k", text: "Win $2,000 in one round", goal: 1, metric: "bigWin2kHits" }
  ];

  window.ProgressionContent = {
    SUBMARINE_SKINS,
    COSMETIC_SHOP_ITEMS,
    ACHIEVEMENTS,
    DAILY_CHALLENGE_POOL,
    WEEKLY_CHALLENGE_POOL
  };
})();
