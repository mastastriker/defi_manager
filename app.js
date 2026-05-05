function readSupabaseRuntimeConfig() {
  const fromDirect = {
    url: window.__PAPERCLIP_SUPABASE_URL__ || window.PAPERCLIP_SUPABASE_URL,
    anonKey: window.__PAPERCLIP_SUPABASE_ANON_KEY__ || window.PAPERCLIP_SUPABASE_ANON_KEY
  };
  if (fromDirect.url && fromDirect.anonKey) {
    return fromDirect;
  }

  const fromLegacyConfig = window.__DEFI_MANAGER_CONFIG__ || {};
  const url = fromLegacyConfig.supabaseUrl || fromLegacyConfig.url || "";
  const anonKey = fromLegacyConfig.supabaseAnonKey || fromLegacyConfig.anonKey || "";
  return { url, anonKey };
}

let supabase = null;
let currentUser = null;
let portfolios = [];
let wallets = [];
let positions = [];
let selectedPortfolioId = "all";

const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const authStatus = document.getElementById("auth-status");
const appStatus = document.getElementById("app-status");
const userEmail = document.getElementById("user-email");
const portfolioSelect = document.getElementById("portfolio-select");
const walletPortfolioSelect = document.getElementById("wallet-portfolio-select");
const portfolioSections = document.getElementById("portfolio-sections");

function setStatus(el, msg, isError = false) {
  el.textContent = msg || "";
  el.classList.toggle("error", Boolean(isError));
}

function formatUsd(v) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v || 0));
}

function requireSupabase() {
  const config = readSupabaseRuntimeConfig();
  if (!config.url || !config.anonKey) {
    setStatus(authStatus, "Supabase ENV fehlt: PAPERCLIP_SUPABASE_URL / PAPERCLIP_SUPABASE_ANON_KEY", true);
    return false;
  }
  supabase = window.supabase.createClient(config.url, config.anonKey);
  return true;
}

async function bootstrapAuth() {
  if (!requireSupabase()) return;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus(authStatus, error.message, true);
    return;
  }
  currentUser = data.session?.user || null;
  await switchViewBySession();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    await switchViewBySession();
  });
}

async function switchViewBySession() {
  if (!currentUser) {
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    return;
  }
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  userEmail.textContent = currentUser.email || "";
  await refreshData();
}

async function refreshData() {
  setStatus(appStatus, "Lade Daten...");
  try {
    const [pRes, wRes, posRes] = await Promise.all([
      supabase.from("portfolios").select("id,name,user_id,created_at").order("created_at", { ascending: true }),
      supabase.from("wallets").select("id,name,portfolio_id,user_id,created_at").order("created_at", { ascending: true }),
      supabase.from("positions").select("id,wallet_id,asset_name,amount,value_usd,created_at,updated_at").order("created_at", { ascending: true })
    ]);
    if (pRes.error) throw pRes.error;
    if (wRes.error) throw wRes.error;
    if (posRes.error) throw posRes.error;

    portfolios = pRes.data || [];
    wallets = wRes.data || [];
    positions = posRes.data || [];

    if (selectedPortfolioId !== "all" && !portfolios.some((p) => p.id === selectedPortfolioId)) {
      selectedPortfolioId = "all";
    }

    renderPortfolioSelectors();
    renderView();
    setStatus(appStatus, "");
  } catch (error) {
    setStatus(appStatus, error.message || "Laden fehlgeschlagen", true);
  }
}

function renderPortfolioSelectors() {
  const options = ['<option value="all">Alle Depots</option>'].concat(
    portfolios.map((p) => `<option value="${p.id}">${p.name}</option>`)
  );
  portfolioSelect.innerHTML = options.join("");
  portfolioSelect.value = selectedPortfolioId;

  walletPortfolioSelect.innerHTML = portfolios
    .map((p) => `<option value="${p.id}">${p.name}</option>`)
    .join("");
  if (selectedPortfolioId !== "all") {
    walletPortfolioSelect.value = selectedPortfolioId;
  }
}

function renderView() {
  const kpiTotal = document.getElementById("kpi-total");
  const kpiPortfolioCount = document.getElementById("kpi-portfolio-count");
  const kpiWalletCount = document.getElementById("kpi-wallet-count");
  const kpiPositionCount = document.getElementById("kpi-position-count");

  let displayPortfolios = portfolios;
  if (selectedPortfolioId !== "all") {
    displayPortfolios = portfolios.filter((p) => p.id === selectedPortfolioId);
  }

  let total = 0;
  let walletCount = 0;
  let positionCount = 0;

  portfolioSections.innerHTML = displayPortfolios
    .map((portfolio) => {
      const pWallets = wallets.filter((w) => w.portfolio_id === portfolio.id);
      walletCount += pWallets.length;
      const walletHtml = pWallets
        .map((wallet) => {
          const wPositions = positions.filter((pos) => pos.wallet_id === wallet.id);
          const walletTotal = wPositions.reduce((acc, cur) => acc + Number(cur.value_usd || 0), 0);
          total += walletTotal;
          positionCount += wPositions.length;
          return `
            <article class="wallet-block">
              <div class="portfolio-head">
                <h4>${wallet.name}</h4>
                <div class="actions">
                  <button type="button" data-action="add-position" data-wallet-id="${wallet.id}">Position hinzufügen</button>
                </div>
              </div>
              <p class="muted">Wert: ${formatUsd(walletTotal)}</p>
              <table class="table">
                <thead><tr><th>Asset</th><th>Amount</th><th>Value USD</th><th>Aktionen</th></tr></thead>
                <tbody>
                  ${wPositions
                    .map(
                      (pos) => `
                    <tr>
                      <td>${pos.asset_name}</td>
                      <td>${Number(pos.amount).toFixed(8)}</td>
                      <td>${formatUsd(pos.value_usd)}</td>
                      <td class="actions">
                        <button type="button" data-action="edit-position" data-position-id="${pos.id}">Bearbeiten</button>
                        <button type="button" data-action="delete-position" data-position-id="${pos.id}">Löschen</button>
                      </td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </article>
          `;
        })
        .join("");

      const portfolioTotal = pWallets
        .flatMap((w) => positions.filter((pos) => pos.wallet_id === w.id))
        .reduce((acc, cur) => acc + Number(cur.value_usd || 0), 0);

      return `
        <section class="portfolio-block">
          <div class="portfolio-head">
            <button type="button" data-action="focus-portfolio" data-portfolio-id="${portfolio.id}"><h3>${portfolio.name}</h3></button>
            <strong>${formatUsd(portfolioTotal)}</strong>
          </div>
          ${walletHtml || '<p class="muted">Noch keine Wallets.</p>'}
        </section>
      `;
    })
    .join("");

  if (!displayPortfolios.length) {
    portfolioSections.innerHTML = '<p class="muted">Keine Depots vorhanden. Lege ein Depot an.</p>';
  }

  kpiTotal.textContent = formatUsd(total);
  kpiPortfolioCount.textContent = String(displayPortfolios.length);
  kpiWalletCount.textContent = String(walletCount);
  kpiPositionCount.textContent = String(positionCount);
}

async function createPortfolio(name) {
  const { error, data } = await supabase.from("portfolios").insert([{ name }]).select("id").single();
  if (error) throw error;
  selectedPortfolioId = data.id;
}

async function createWallet(name, portfolioId) {
  const { error } = await supabase.from("wallets").insert([{ name, portfolio_id: portfolioId }]);
  if (error) throw error;
}

async function savePosition(payload) {
  if (payload.id) {
    const { error } = await supabase
      .from("positions")
      .update({ asset_name: payload.asset_name, amount: payload.amount, value_usd: payload.value_usd })
      .eq("id", payload.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("positions").insert([
    {
      wallet_id: payload.wallet_id,
      asset_name: payload.asset_name,
      amount: payload.amount,
      value_usd: payload.value_usd
    }
  ]);
  if (error) throw error;
}

async function deletePosition(id) {
  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error) throw error;
}

function closeDialog(id) {
  document.getElementById(id).close();
}

function forceCloseAllDialogs() {
  document.querySelectorAll("dialog").forEach((dialog) => {
    try {
      dialog.removeAttribute("open");
      if (typeof dialog.close === "function") {
        dialog.close();
      }
    } catch (_error) {
      // Ignore and continue; this is a defensive startup cleanup.
    }
  });
}

function wireEvents() {
  const showLoginBtn = document.getElementById("show-login-btn");
  const showRegisterBtn = document.getElementById("show-register-btn");
  const loginFormEl = document.getElementById("login-form");
  const registerFormEl = document.getElementById("register-form");
  const forgotPasswordBtn = document.getElementById("forgot-password-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const newPortfolioBtn = document.getElementById("new-portfolio-btn");
  const portfolioCancelBtn = document.getElementById("portfolio-cancel");
  const newWalletBtn = document.getElementById("new-wallet-btn");
  const walletCancelBtn = document.getElementById("wallet-cancel");
  const positionCancelBtn = document.getElementById("position-cancel");
  const portfolioFormEl = document.getElementById("portfolio-form");
  const walletFormEl = document.getElementById("wallet-form");
  const positionFormEl = document.getElementById("position-form");

  if (!showLoginBtn || !showRegisterBtn || !loginFormEl || !registerFormEl) {
    setStatus(authStatus, "UI konnte nicht initialisiert werden. Bitte Seite neu laden.", true);
    return;
  }

  showLoginBtn.addEventListener("click", () => {
    document.getElementById("login-form").classList.remove("hidden");
    document.getElementById("register-form").classList.add("hidden");
  });
  showRegisterBtn.addEventListener("click", () => {
    document.getElementById("register-form").classList.remove("hidden");
    document.getElementById("login-form").classList.add("hidden");
  });

  loginFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    try {
      setStatus(authStatus, "Login läuft...");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setStatus(authStatus, "");
    } catch (error) {
      setStatus(authStatus, error.message || "Login fehlgeschlagen", true);
    }
  });

  registerFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirm = document.getElementById("register-password-confirm").value;
    if (password !== confirm) {
      setStatus(authStatus, "Passwort-Bestätigung stimmt nicht überein", true);
      return;
    }
    try {
      setStatus(authStatus, "Registrierung läuft...");
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setStatus(authStatus, "Registrierung erfolgreich. Bitte Email bestätigen.");
      document.getElementById("show-login-btn").click();
    } catch (error) {
      setStatus(authStatus, error.message || "Registrierung fehlgeschlagen", true);
    }
  });

  forgotPasswordBtn?.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();
    if (!email) {
      setStatus(authStatus, "Bitte zuerst Email im Login-Feld eintragen", true);
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setStatus(authStatus, "Passwort-Reset Email wurde gesendet.");
    } catch (error) {
      setStatus(authStatus, error.message || "Reset fehlgeschlagen", true);
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });

  portfolioSelect.addEventListener("change", () => {
    selectedPortfolioId = portfolioSelect.value;
    renderView();
  });

  newPortfolioBtn?.addEventListener("click", () => {
    document.getElementById("portfolio-dialog").showModal();
  });
  portfolioCancelBtn?.addEventListener("click", () => closeDialog("portfolio-dialog"));

  portfolioFormEl?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("portfolio-name").value.trim();
    if (!name) return;
    try {
      await createPortfolio(name);
      closeDialog("portfolio-dialog");
      event.target.reset();
      await refreshData();
    } catch (error) {
      setStatus(appStatus, error.message || "Depot konnte nicht erstellt werden", true);
    }
  });

  newWalletBtn?.addEventListener("click", () => {
    document.getElementById("wallet-dialog").showModal();
  });
  walletCancelBtn?.addEventListener("click", () => closeDialog("wallet-dialog"));

  walletFormEl?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("wallet-name").value.trim();
    const portfolioId = walletPortfolioSelect.value;
    if (!name || !portfolioId) return;
    try {
      await createWallet(name, portfolioId);
      closeDialog("wallet-dialog");
      event.target.reset();
      await refreshData();
    } catch (error) {
      setStatus(appStatus, error.message || "Wallet konnte nicht erstellt werden", true);
    }
  });

  positionCancelBtn?.addEventListener("click", () => closeDialog("position-dialog"));
  positionFormEl?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.getElementById("position-id").value || null;
    const walletId = document.getElementById("position-wallet-id").value;
    const asset = document.getElementById("position-asset").value.trim();
    const amount = Number(document.getElementById("position-amount").value);
    const value = Number(document.getElementById("position-value").value);

    if (!walletId || !asset || Number.isNaN(amount) || Number.isNaN(value)) {
      setStatus(appStatus, "Bitte gültige Positionsdaten eingeben", true);
      return;
    }

    try {
      await savePosition({ id, wallet_id: walletId, asset_name: asset, amount, value_usd: value });
      closeDialog("position-dialog");
      event.target.reset();
      await refreshData();
    } catch (error) {
      setStatus(appStatus, error.message || "Position konnte nicht gespeichert werden", true);
    }
  });

  portfolioSections.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;

    if (action === "focus-portfolio") {
      selectedPortfolioId = button.dataset.portfolioId;
      renderPortfolioSelectors();
      renderView();
      return;
    }

    if (action === "add-position") {
      const walletId = button.dataset.walletId;
      document.getElementById("position-dialog-title").textContent = "Position hinzufügen";
      document.getElementById("position-id").value = "";
      document.getElementById("position-wallet-id").value = walletId;
      document.getElementById("position-dialog").showModal();
      return;
    }

    if (action === "edit-position") {
      const pos = positions.find((p) => p.id === button.dataset.positionId);
      if (!pos) return;
      document.getElementById("position-dialog-title").textContent = "Position bearbeiten";
      document.getElementById("position-id").value = pos.id;
      document.getElementById("position-wallet-id").value = pos.wallet_id;
      document.getElementById("position-asset").value = pos.asset_name;
      document.getElementById("position-amount").value = pos.amount;
      document.getElementById("position-value").value = pos.value_usd;
      document.getElementById("position-dialog").showModal();
      return;
    }

    if (action === "delete-position") {
      if (!window.confirm("Position wirklich löschen?")) return;
      try {
        await deletePosition(button.dataset.positionId);
        await refreshData();
      } catch (error) {
        setStatus(appStatus, error.message || "Position konnte nicht gelöscht werden", true);
      }
    }
  });
}

forceCloseAllDialogs();
wireEvents();
bootstrapAuth();
