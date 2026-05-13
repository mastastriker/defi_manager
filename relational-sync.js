(function () {
  const STORAGE_KEYS = {
    primary: "defi-dashboard-positions-v2",
    legacy: "defi-dashboard-positions-v1",
    backup: "defi-dashboard-positions-backup-v1",
    wallets: "defi-dashboard-wallets-v1",
    selectedPortfolioId: "defi-dashboard-selected-portfolio-id"
  };

  let client = null;
  let currentUser = null;
  let currentPortfolioId = null;
  let lastPayloadHash = "";
  let syncing = false;

  function readConfig() {
    const cfg = window.__DEFI_MANAGER_CONFIG__ || {};
    return {
      url: cfg.supabaseUrl || window.NEXT_PUBLIC_SUPABASE_URL || window.PAPERCLIP_SUPABASE_URL || "",
      anonKey: cfg.supabaseAnonKey || window.NEXT_PUBLIC_SUPABASE_ANON_KEY || window.PAPERCLIP_SUPABASE_ANON_KEY || ""
    };
  }

  function hashPayload(payload) {
    return JSON.stringify(payload);
  }

  function readLocalSnapshot() {
    let positions = [];
    let wallets = [];
    try {
      const primary = localStorage.getItem(STORAGE_KEYS.primary);
      if (primary) {
        const parsed = JSON.parse(primary);
        if (Array.isArray(parsed.positions)) positions = parsed.positions;
      }
      if (positions.length === 0) {
        const legacy = localStorage.getItem(STORAGE_KEYS.legacy);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) positions = parsed;
        }
      }
      const rawWallets = localStorage.getItem(STORAGE_KEYS.wallets);
      if (rawWallets) {
        const parsedWallets = JSON.parse(rawWallets);
        if (Array.isArray(parsedWallets)) wallets = parsedWallets;
      }
    } catch (_error) {}
    return { positions, wallets };
  }

  async function ensurePortfolioDropdown(portfolios) {
    let select = document.getElementById("portfolio-select");
    if (!select) {
      const nav = document.querySelector(".top-nav");
      if (!nav) return null;
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "display:flex;align-items:center;gap:.4rem;margin-left:auto;";
      const label = document.createElement("label");
      label.textContent = "Depot:";
      label.setAttribute("for", "portfolio-select");
      label.style.fontSize = "0.9rem";
      select = document.createElement("select");
      select.id = "portfolio-select";
      select.style.minWidth = "180px";
      wrapper.appendChild(label);
      wrapper.appendChild(select);
      nav.appendChild(wrapper);
      select.addEventListener("change", async () => {
        const nextId = select.value;
        if (!nextId || nextId === currentPortfolioId) return;
        localStorage.setItem(STORAGE_KEYS.selectedPortfolioId, nextId);
        await loadPortfolioIntoLocal(nextId);
        window.location.reload();
      });
    }

    select.innerHTML = portfolios
      .map((p) => `<option value="${p.id}">${String(p.name || "Unbenannt")}</option>`)
      .join("");
    if (currentPortfolioId) select.value = currentPortfolioId;
    return select;
  }

  function mapDbPositionToLocal(row, walletName) {
    return {
      id: row.id,
      type: row.type || "strategy",
      date: row.position_date ? new Date(row.position_date).toISOString().slice(0, 16) : "",
      wallet: walletName,
      chain: row.chain || "ETH",
      projectName: row.project_name || "",
      strategyName: row.strategy_name || "",
      investedAmount: Number(row.amount || 0),
      interestAmount: 0,
      currentValue: Number(row.value_usd || 0),
      collateral: row.collateral || "",
      debtUsd: Number(row.debt_usd || 0),
      borrowPayout: Number(row.borrow_payout || 0),
      calculationMode: row.calculation_mode || "current",
      ptAmount: row.pt_amount == null ? null : Number(row.pt_amount),
      maturityDate: row.maturity_date ? new Date(row.maturity_date).toISOString().slice(0, 16) : null,
      notes: row.notes || "",
      status: row.status || "active",
      archivedAt: row.archived_at || null
    };
  }

  async function loadPortfolioIntoLocal(portfolioId) {
    const { data: wallets, error: walletsError } = await client
      .from("wallets")
      .select("id,name")
      .eq("portfolio_id", portfolioId)
      .order("created_at", { ascending: true });
    if (walletsError) return;

    const walletById = new Map((wallets || []).map((w) => [w.id, w.name]));
    const walletNames = (wallets || []).map((w) => w.name);

    const walletIds = (wallets || []).map((w) => w.id);
    let positions = [];
    if (walletIds.length > 0) {
      const { data: rows, error: rowsError } = await client
        .from("positions")
        .select("*")
        .in("wallet_id", walletIds)
        .order("position_date", { ascending: false });
      if (!rowsError) {
        positions = (rows || []).map((row) => mapDbPositionToLocal(row, walletById.get(row.wallet_id) || "Cash1"));
      }
    }

    localStorage.setItem(STORAGE_KEYS.wallets, JSON.stringify(walletNames.length ? walletNames : ["Cash1", "Cash2"]));
    localStorage.setItem(
      STORAGE_KEYS.primary,
      JSON.stringify({ version: 2, updatedAt: new Date().toISOString(), positions })
    );
    localStorage.setItem(STORAGE_KEYS.legacy, JSON.stringify(positions));
    localStorage.setItem(STORAGE_KEYS.backup, JSON.stringify(positions));
  }

  async function upsertRelationalFromLocal() {
    if (!currentUser || !currentPortfolioId || syncing) return;
    const snapshot = readLocalSnapshot();
    const payloadHash = hashPayload(snapshot);
    if (payloadHash === lastPayloadHash) return;

    syncing = true;
    try {
      const walletNames = Array.from(new Set((snapshot.wallets || []).map((w) => String(w || "").trim()).filter(Boolean)));
      const { data: existingWallets } = await client
        .from("wallets")
        .select("id,name")
        .eq("portfolio_id", currentPortfolioId);

      const walletMap = new Map((existingWallets || []).map((w) => [w.name, w.id]));
      for (const name of walletNames) {
        if (!walletMap.has(name)) {
          const { data: inserted } = await client
            .from("wallets")
            .insert({ user_id: currentUser.id, portfolio_id: currentPortfolioId, name })
            .select("id,name")
            .single();
          if (inserted) walletMap.set(inserted.name, inserted.id);
        }
      }

      const { data: allWallets } = await client.from("wallets").select("id").eq("portfolio_id", currentPortfolioId);
      const walletIds = (allWallets || []).map((w) => w.id);
      if (walletIds.length > 0) {
        await client.from("positions").delete().in("wallet_id", walletIds);
      }

      const rows = (snapshot.positions || []).map((p) => {
        const walletId = walletMap.get(p.wallet) || (existingWallets && existingWallets[0] ? existingWallets[0].id : null);
        if (!walletId) return null;
        return {
          wallet_id: walletId,
          type: p.type || "strategy",
          position_date: p.date ? new Date(p.date).toISOString() : null,
          chain: p.chain || "ETH",
          project_name: p.projectName || null,
          strategy_name: p.strategyName || null,
          asset_name: p.strategyName || p.projectName || "Position",
          amount: Number(p.investedAmount || 0),
          value_usd: Number(p.currentValue || 0),
          collateral: p.collateral || null,
          debt_usd: Number(p.debtUsd || 0),
          borrow_payout: Number(p.borrowPayout || 0),
          maturity_date: p.maturityDate ? new Date(p.maturityDate).toISOString() : null,
          pt_amount: p.ptAmount == null ? null : Number(p.ptAmount),
          notes: p.notes || null,
          status: p.status || "active",
          archived_at: p.archivedAt || null,
          calculation_mode: p.calculationMode || "current"
        };
      }).filter(Boolean);

      if (rows.length > 0) await client.from("positions").insert(rows);
      lastPayloadHash = payloadHash;
    } finally {
      syncing = false;
    }
  }

  async function migrateLegacyIfNeeded(portfolioId) {
    const { data: wallets } = await client.from("wallets").select("id").eq("portfolio_id", portfolioId).limit(1);
    if ((wallets || []).length > 0) return;

    const { data: legacyRow } = await client
      .from("user_dashboard_state")
      .select("payload")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (!legacyRow || !legacyRow.payload) return;

    const payload = legacyRow.payload;
    const walletNames = Array.isArray(payload.wallets) && payload.wallets.length ? payload.wallets : ["Cash1", "Cash2"];
    const { data: insertedWallets } = await client
      .from("wallets")
      .insert(walletNames.map((name) => ({ user_id: currentUser.id, portfolio_id: portfolioId, name: String(name) })))
      .select("id,name");

    const walletMap = new Map((insertedWallets || []).map((w) => [w.name, w.id]));
    const positions = Array.isArray(payload.positions) ? payload.positions : [];
    const rows = positions
      .map((p) => ({
        wallet_id: walletMap.get(p.wallet) || (insertedWallets && insertedWallets[0] ? insertedWallets[0].id : null),
        type: p.type || "strategy",
        position_date: p.date ? new Date(p.date).toISOString() : null,
        chain: p.chain || "ETH",
        project_name: p.projectName || null,
        strategy_name: p.strategyName || null,
        asset_name: p.strategyName || p.projectName || "Position",
        amount: Number(p.investedAmount || 0),
        value_usd: Number(p.currentValue || 0),
        collateral: p.collateral || null,
        debt_usd: Number(p.debtUsd || 0),
        borrow_payout: Number(p.borrowPayout || 0),
        maturity_date: p.maturityDate ? new Date(p.maturityDate).toISOString() : null,
        pt_amount: p.ptAmount == null ? null : Number(p.ptAmount),
        notes: p.notes || null,
        status: p.status || "active",
        archived_at: p.archivedAt || null,
        calculation_mode: p.calculationMode || "current"
      }))
      .filter((r) => r.wallet_id);

    if (rows.length > 0) await client.from("positions").insert(rows);
    await client.from("user_dashboard_state").delete().eq("user_id", currentUser.id);
  }

  async function bootstrapForSession(session) {
    currentUser = session && session.user ? session.user : null;
    if (!currentUser) return;

    const { data: portfolios } = await client
      .from("portfolios")
      .select("id,name")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: true });

    let list = portfolios || [];
    if (list.length === 0) {
      const { data: created } = await client
        .from("portfolios")
        .insert({ user_id: currentUser.id, name: "Hauptdepot" })
        .select("id,name")
        .single();
      if (created) list = [created];
    }

    const stored = localStorage.getItem(STORAGE_KEYS.selectedPortfolioId);
    currentPortfolioId = list.some((p) => p.id === stored) ? stored : list[0].id;
    localStorage.setItem(STORAGE_KEYS.selectedPortfolioId, currentPortfolioId);

    await ensurePortfolioDropdown(list);
    await migrateLegacyIfNeeded(currentPortfolioId);
    await loadPortfolioIntoLocal(currentPortfolioId);
    await upsertRelationalFromLocal();
  }

  async function init() {
    const config = readConfig();
    if (!config.url || !config.anonKey || !window.supabase || !window.supabase.createClient) return;
    client = window.supabase.createClient(config.url, config.anonKey);

    const { data } = await client.auth.getSession();
    await bootstrapForSession(data && data.session ? data.session : null);

    client.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        currentUser = null;
        currentPortfolioId = null;
        lastPayloadHash = "";
        return;
      }
      await bootstrapForSession(session);
    });

    setInterval(() => {
      upsertRelationalFromLocal();
    }, 3000);
  }

  init();
})();
