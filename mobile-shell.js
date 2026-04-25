/**
 * Mobile-only shell: top chips, phase strip, bottom action strip, single modal host.
 * body.mobile-ui is toggled by ui.js (max-width: 768px). Moves DOM nodes; preserves ids/listeners.
 */
(function () {
  const MODAL_TITLES = {
    bet: "Bet",
    auto: "Auto bet & cashout",
    stats: "Stats & honors",
    shop: "Shop",
    friends: "Friends",
    subs: "Submarine hangar",
    daily: "Daily & weekly",
    chat: "Fleet chat",
    board: "Board & ranks",
    settings: "Settings"
  };

  const PANEL_ALIASES = {
    submarines: "subs",
    collection: "subs",
    hangar: "subs"
  };

  const PANEL_SELECTORS = {
    bet: [".play-controls-panel .bet-input-group"],
    auto: ["#play-auto-details"],
    stats: ["#panel-stats", "#panel-achievements"],
    shop: ["#panel-shop"],
    friends: ["#panel-friends"],
    subs: ["#panel-collection"],
    daily: ["#panel-challenges"],
    chat: ["#hud-chat-drawer"],
    board: ["aside.play-side-panel.history-panel", "#panel-leaderboard"],
    settings: ["#panel-settings", "#game-root > footer.fairness-bar"]
  };

  let modalNodes = [];
  let shellInstalled = false;
  const shellMoved = [];

  function anchor(el) {
    if (!el || el.dataset.mobileAnchored === "1") return;
    el.dataset.mobileAnchored = "1";
    el.__mobileRestore = { parent: el.parentNode, next: el.nextSibling };
  }

  function restoreOne(el) {
    if (!el || !el.__mobileRestore) return;
    const { parent, next } = el.__mobileRestore;
    try {
      if (parent && parent.isConnected) {
        if (next && next.parentNode === parent) parent.insertBefore(el, next);
        else parent.appendChild(el);
      }
    } catch (e) {
      /* ignore */
    }
    delete el.__mobileRestore;
    delete el.dataset.mobileAnchored;
  }

  function shellAppend(parent, el) {
    if (!parent || !el) return;
    anchor(el);
    parent.appendChild(el);
    shellMoved.push(el);
  }

  function getEls(selectors) {
    return selectors.map((sel) => document.querySelector(sel)).filter(Boolean);
  }

  function closeMobileModal() {
    const root = document.getElementById("mobile-modal-root");
    const body = document.getElementById("mobile-modal-body");
    if (body) body.querySelectorAll("[data-mobile-placeholder]").forEach((n) => n.remove());
    modalNodes.slice().forEach((n) => restoreOne(n));
    modalNodes = [];
    if (root) {
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
      root.removeAttribute("data-panel");
    }
    document.body.classList.remove("mobile-modal-open");
    const chat = document.getElementById("hud-chat-drawer");
    if (chat) {
      chat.classList.add("hud-chat-drawer--collapsed");
      const panel = chat.querySelector(".hud-chat-drawer__panel");
      if (panel) panel.setAttribute("aria-hidden", "true");
    }
  }

  function openMobileModal(rawId) {
    if (!document.body.classList.contains("mobile-ui")) return;
    const panelId = PANEL_ALIASES[rawId] || rawId;
    const body = document.getElementById("mobile-modal-body");
    const titleEl = document.getElementById("mobile-modal-title");
    const root = document.getElementById("mobile-modal-root");
    if (!body || !root) return;

    if (panelId === "recovery") {
      closeMobileModal();
      if (typeof window.__gameMobileOpenRecovery === "function") window.__gameMobileOpenRecovery();
      return;
    }

    closeMobileModal();

    const selectors = PANEL_SELECTORS[panelId];
    if (!selectors) return;

    const nodes = getEls(selectors);
    let hadPanelNodes = false;
    if (!nodes.length) {
      const p = document.createElement("p");
      p.dataset.mobilePlaceholder = "1";
      p.textContent = "Coming soon.";
      p.style.margin = "0";
      p.style.fontSize = "14px";
      p.style.color = "rgba(255,255,255,0.75)";
      body.appendChild(p);
    } else {
      hadPanelNodes = true;
      nodes.forEach((n) => {
        anchor(n);
        body.appendChild(n);
        modalNodes.push(n);
      });
    }

    if (titleEl) titleEl.textContent = MODAL_TITLES[panelId] || panelId;
    root.dataset.panel = panelId;
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("mobile-modal-open");

    if (panelId === "chat") {
      const chat = document.getElementById("hud-chat-drawer");
      if (chat) {
        chat.classList.remove("hud-chat-drawer--collapsed");
        const panel = chat.querySelector(".hud-chat-drawer__panel");
        if (panel) panel.setAttribute("aria-hidden", "false");
      }
    }

    if (hadPanelNodes && panelId === "friends" && typeof window.__gameMobileFriendsOpen === "function") {
      window.__gameMobileFriendsOpen();
    }
    if (hadPanelNodes && panelId === "shop" && typeof window.__gameMobileShopOpen === "function") {
      window.__gameMobileShopOpen();
    }
    if (hadPanelNodes && panelId === "board" && typeof window.__gameMobileBoardOpen === "function") {
      window.__gameMobileBoardOpen();
    }
  }

  function installShellLayout() {
    if (!document.body.classList.contains("mobile-ui") || shellInstalled) return;
    const row1 = document.getElementById("mobile-action-row1");
    const row2 = document.getElementById("mobile-action-row2");
    const strip = document.getElementById("mobile-phase-strip");
    const phase = document.getElementById("phase-label");
    const bankRow = document.querySelector("#bank-profile-frame .bank-balance-row");
    const debt = document.getElementById("debt-indicator");
    const stake = document.querySelector(".play-controls-panel .stake-info");
    const actions = document.querySelector(".play-controls-panel .action-buttons");

    if (strip && phase) shellAppend(strip, phase);
    if (row1 && bankRow) shellAppend(row1, bankRow);
    if (row1 && debt) shellAppend(row1, debt);
    /* stake + actions share row2 so anchors restore bet → stake → actions → auto-details */
    if (row2 && stake) shellAppend(row2, stake);
    if (row2 && actions) shellAppend(row2, actions);

    shellInstalled = true;
  }

  function uninstallShellLayout() {
    closeMobileModal();
    while (shellMoved.length) {
      const el = shellMoved.pop();
      restoreOne(el);
    }
    shellInstalled = false;
  }

  function refreshLayout() {
    if (document.body.classList.contains("mobile-ui")) installShellLayout();
    else uninstallShellLayout();
  }

  function bindModalClose() {
    const backdrop = document.getElementById("mobile-modal-backdrop");
    const closeBtn = document.getElementById("mobile-modal-close");
    if (backdrop) backdrop.addEventListener("click", () => closeMobileModal());
    if (closeBtn) closeBtn.addEventListener("click", () => closeMobileModal());
  }

  function bindTopMenu() {
    const top = document.getElementById("mobile-top-menu");
    if (!top || top.dataset.mobileMenuBound === "1") return;
    top.dataset.mobileMenuBound = "1";
    top.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mobile-modal]");
      if (!btn) return;
      const id = btn.getAttribute("data-mobile-modal");
      if (id) openMobileModal(id);
    });
  }

  function init() {
    bindTopMenu();
    bindModalClose();
    const obs = new MutationObserver(() => refreshLayout());
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    refreshLayout();
  }

  window.MobileShell = {
    openMobileModal,
    closeMobileModal,
    refreshLayout
  };
  window.openMobileModal = function (name) {
    openMobileModal(String(name || ""));
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
