const STORAGE_KEYS = {
  primary: "defi-dashboard-positions-v2",
  legacy: "defi-dashboard-positions-v1",
  backup: "defi-dashboard-positions-backup-v1"
};
const SUPABASE_STORAGE_KEY = "defi-dashboard-supabase-config-v1";
const STORAGE_VERSION = 2;
const DEFAULT_WALLETS = ["Cash1", "Cash2"];

const TYPE_LABELS = {
  lending: "Lending/Borrow Positionen",
  pendle: "PT Strategien",
  strategy: "Klassische Yield Strategien"
};
const TABLE_TITLES = {
  lending: "Lending/Borrow Positionen Tabelle",
  pendle: "PT Strategien Tabelle",
  strategy: "Klassische Yield Strategien Tabelle"
};

const VALID_TYPES = new Set(["lending", "pendle", "strategy"]);
const VALID_STATUSES = new Set(["active", "archived"]);
const CHAIN_ORDER = ["ETH", "ARB", "BASE", "AVAX"];
const SUPPORTED_CHAINS = new Set(CHAIN_ORDER);
const DEFAULT_CHAIN = "ETH";
const DEFAULT_STRATEGY_CURRENCY = "USDC";
const MS_PER_HOUR = 1000 * 60 * 60;
const HOURS_PER_YEAR = 365.25 * 24;
const HOURS_PER_MONTH = HOURS_PER_YEAR / 12;

const initialPositions = [
  {
    id: crypto.randomUUID(),
    type: "lending",
    date: "2026-01-10T09:00",
    wallet: "Cash1",
    chain: "ETH",
    projectName: "Aave",
    strategyName: "USDC Lending Core",
    collateral: "stETH",
    investedAmount: 910000,
    interestAmount: 18000,
    currentValue: 928000,
    debtUsd: 250000,
    borrowPayout: 246500,
    calculationMode: "interest",
    ptAmount: null,
    maturityDate: null,
    notes: "Blue-chip lending baseline",
    status: "active",
    archivedAt: null
  },
  {
    id: crypto.randomUUID(),
    type: "pendle",
    date: "2026-02-14T13:00",
    wallet: "Cash2",
    chain: "ARB",
    projectName: "Pendle",
    strategyName: "PT-ETH Dec 2026",
    investedAmount: 310000,
    interestAmount: 24500,
    currentValue: 334500,
    calculationMode: "interest",
    ptAmount: 12.5,
    maturityDate: "2026-12-31T16:00",
    notes: "Seasonal convexity thesis",
    status: "active",
    archivedAt: null
  },
  {
    id: crypto.randomUUID(),
    type: "strategy",
    date: "2026-03-02T11:00",
    wallet: "Cash1",
    chain: "BASE",
    projectName: "Morpho",
    currency: "USDC",
    strategyName: "Stablecoin Basis Loop",
    investedAmount: 220000,
    interestAmount: 9500,
    currentValue: 229500,
    calculationMode: "interest",
    ptAmount: null,
    maturityDate: null,
    notes: "Low-vol carry",
    status: "active",
    archivedAt: null
  }
];

let positions = [];
let wallets = [];
let activeTab = "strategy";
let editingPositionId = null;
let activePage = "dashboard";
let supabaseClient = null;
let supabaseConfigSource = "none";
const SUPABASE_STATE_TABLE = "defi_manager_state";
const SUPABASE_STATE_ID = "global";
let suppressRemoteSync = false;
let manualSupabaseConfig = null;
let supabaseSyncQueue = Promise.resolve();
const sortState = {
  active: { key: null, direction: "asc" },
  archive: { key: null, direction: "asc" }
};

const form = document.getElementById("position-form");
const dateInput = document.getElementById("position-date");
const walletInput = document.getElementById("position-wallet");
const chainInput = document.getElementById("position-chain");
const projectInput = document.getElementById("position-project");
const strategyNameField = document.getElementById("position-strategy-name-field");
const strategyNameLabel = document.getElementById("position-strategy-name-label");
const strategyNameInput = document.getElementById("position-strategy-name");
const currencyField = document.getElementById("position-currency-field");
const currencyInput = document.getElementById("position-currency");
const maturityField = document.getElementById("position-maturity-field");
const maturityInput = document.getElementById("position-maturity");
const ptAmountField = document.getElementById("position-pt-amount-field");
const ptAmountInput = document.getElementById("position-pt-amount");
const collateralField = document.getElementById("position-collateral-field");
const collateralInput = document.getElementById("position-collateral");
const debtField = document.getElementById("position-debt-field");
const debtInput = document.getElementById("position-debt");
const borrowPayoutField = document.getElementById("position-borrow-payout-field");
const borrowPayoutInput = document.getElementById("position-borrow-payout");
const investedField = document.getElementById("position-invested-field");
const investedLabel = document.getElementById("position-invested-label");
const investedInput = document.getElementById("position-invested");
const interestField = document.getElementById("position-interest-field");
const interestLabel = document.getElementById("position-interest-label");
const interestInput = document.getElementById("position-interest");
const currentField = document.getElementById("position-current-field");
const currentLabel = document.getElementById("position-current-label");
const currentInput = document.getElementById("position-current");
const debtLabel = document.getElementById("position-debt-label");
const borrowPayoutLabel = document.getElementById("position-borrow-payout-label");
const notesField = document.getElementById("position-notes-field");
const notesInput = document.getElementById("position-notes");
const formStatus = document.getElementById("form-status");
const tableBody = document.getElementById("positions-body");
const archivedBody = document.getElementById("archived-body");
const tabs = Array.from(document.querySelectorAll(".tab"));
const pageTabs = Array.from(document.querySelectorAll(".page-tab"));
const sortableHeaders = Array.from(document.querySelectorAll("th[data-sort-table][data-sort-key]"));
const pageSections = {
  dashboard: document.getElementById("dashboard-page"),
  archive: document.getElementById("archive-page"),
  wallets: document.getElementById("wallets-page")
};
const walletForm = document.getElementById("wallet-form");
const walletNameInput = document.getElementById("wallet-name");
const walletList = document.getElementById("wallet-list");
const walletStatus = document.getElementById("wallet-status");
const walletCount = document.getElementById("wallet-count");
const supabaseForm = document.getElementById("supabase-form");
const supabaseUrlInput = document.getElementById("supabase-url");
const supabaseAnonKeyInput = document.getElementById("supabase-anon-key");
const supabaseTestButton = document.getElementById("supabase-test-btn");
const supabaseSchemaButton = document.getElementById("supabase-schema-btn");
const supabaseStatus = document.getElementById("supabase-status");
const supabaseMeta = document.getElementById("supabase-meta");

const kpiCurrent = document.getElementById("kpi-current");
const kpiApy = document.getElementById("kpi-apy");
const kpiCashflow = document.getElementById("kpi-cashflow");
const kpiLendingCost = document.getElementById("kpi-lending-cost");
const activeTableTitle = document.getElementById("active-table-title");
const activePositionsTotal = document.getElementById("active-positions-total");
const activeStrategyColumnLabel = document.getElementById("active-strategy-column-label");
const activeStrategyNameHeader = document.getElementById("active-strategy-name-header");
const activeCollateralHeader = document.getElementById("active-collateral-header");
const activeInterestHeader = document.getElementById("active-interest-header");
const activeRoiHeader = document.getElementById("active-roi-header");
const activeMonthlyCashflowHeader = document.getElementById("active-monthly-cashflow-header");
const activeApyHeader = document.getElementById("active-apy-header");
const activeCollateralApyHeader = document.getElementById("active-collateral-apy-header");
const activeNetApyHeader = document.getElementById("active-net-apy-header");
const activeBorrowCostHeader = document.getElementById("active-borrow-cost-header");
const activeBorrowApyHeader = document.getElementById("active-borrow-apy-header");
const activeDebtHeader = document.getElementById("active-debt-header");
const activeBorrowPayoutHeader = document.getElementById("active-borrow-payout-header");
const activeLtvHeader = document.getElementById("active-ltv-header");
const activePtAmountHeader = document.getElementById("active-pt-amount-header");
const activeFixedCashflowHeader = document.getElementById("active-fixed-cashflow-header");
const activeMaturityHeader = document.getElementById("active-maturity-header");
const activeRoiMaturityHeader = document.getElementById("active-roi-maturity-header");
const activeNotesHeader = document.getElementById("active-notes-header");

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatQuantity(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 6
  }).format(Number(value));
}

function formatAssetAmount(value, asset) {
  const unit = typeof asset === "string" && asset.trim() ? asset.trim() : "USD";
  return `${formatQuantity(value)} ${unit}`;
}

function formatDate(value) {
  const parsed = parsePositionDate(value);
  if (!parsed) {
    return "-";
  }
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function formatArchiveTimestamp(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parsePositionDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeDateTimeValue(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);

  if (minutes !== 0) {
    return null;
  }

  const parsed = new Date(year, monthIndex, day, hours, minutes, 0, 0);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) {
    return null;
  }

  return parsed;
}

function currentCollateralUnit() {
  const raw = collateralInput?.value || "";
  const cleaned = raw.trim();
  return cleaned || "USD";
}

function currentStrategyCurrencyUnit() {
  const raw = currencyInput?.value || "";
  const cleaned = raw.trim();
  return cleaned || "USD";
}

function currentAmountUnitForType(positionType) {
  if (positionType === "lending") {
    return currentCollateralUnit();
  }
  if (positionType === "strategy") {
    return currentStrategyCurrencyUnit();
  }
  return "USD";
}

function updateAmountLabels(positionType = activeTab) {
  const unit = currentAmountUnitForType(positionType);
  if (investedLabel) {
    investedLabel.textContent = `Eingezahlter Betrag (${unit})`;
  }
  if (currentLabel) {
    currentLabel.textContent = `Aktueller Wert (${unit})`;
  }
  if (interestLabel) {
    interestLabel.textContent = `Zinsen (${positionType === "strategy" ? unit : "USD"})`;
  }
  if (debtLabel) {
    debtLabel.textContent = "Borrow Schulden (USD, nur Lending/Borrow)";
  }
  if (borrowPayoutLabel) {
    borrowPayoutLabel.textContent = "Borrow Ausgezahlt (USD, nur Lending/Borrow)";
  }
}

function normalizeDateTimeValue(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function localDateTimeNowHour() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(
    now.getHours()
  ).padStart(2, "0")}:00`;
}

function normalizePosition(entry) {
  const safeType = VALID_TYPES.has(entry?.type) ? entry.type : "lending";
  const safeStatus = VALID_STATUSES.has(entry?.status) ? entry.status : "active";
  const rawDate = typeof entry?.date === "string" ? normalizeDateTimeValue(entry.date) : null;
  const normalizedDate = rawDate && parsePositionDate(rawDate) ? rawDate : localDateTimeNowHour();
  const normalizedInvested = Number.isFinite(Number(entry?.investedAmount))
    ? Number(entry.investedAmount)
    : Number.isFinite(Number(entry?.notional))
      ? Number(entry.notional)
      : 0;
  const normalizedCurrent = Number.isFinite(Number(entry?.currentValue))
    ? Number(entry.currentValue)
    : Number.isFinite(Number(entry?.notional))
      ? Number(entry.notional)
      : normalizedInvested;
  const normalizedCalculationMode = entry?.calculationMode === "current" ? "current" : "interest";
  const normalizedInterest = Number.isFinite(Number(entry?.interestAmount))
    ? Number(entry.interestAmount)
    : Number.isFinite(Number(entry?.interest))
      ? Number(entry.interest)
      : Math.max(0, normalizedCurrent - normalizedInvested);
  const computedInterest = normalizedCalculationMode === "current"
    ? Math.max(0, normalizedCurrent - normalizedInvested)
    : normalizedInterest;
  const computedCurrent = normalizedCalculationMode === "current"
    ? normalizedCurrent
    : normalizedInvested + normalizedInterest;

  const rawMaturityDate = typeof entry?.maturityDate === "string" ? normalizeDateTimeValue(entry.maturityDate) : normalizeDateTimeValue(entry?.maturity);
  const normalizedMaturityDate = typeof rawMaturityDate === "string" && parsePositionDate(rawMaturityDate) ? rawMaturityDate : null;
  const normalizedPtAmount = Number.isFinite(Number(entry?.ptAmount))
    ? Math.max(0, Number(entry.ptAmount))
    : Number.isFinite(Number(entry?.ptCount))
      ? Math.max(0, Number(entry.ptCount))
      : null;
  const normalizedDebt = Number.isFinite(Number(entry?.debtUsd))
    ? Math.max(0, Number(entry.debtUsd))
    : Number.isFinite(Number(entry?.debt))
      ? Math.max(0, Number(entry.debt))
      : 0;
  const normalizedBorrowPayout = Number.isFinite(Number(entry?.borrowPayout))
    ? Math.max(0, Number(entry.borrowPayout))
    : Number.isFinite(Number(entry?.borrowPaidOut))
      ? Math.max(0, Number(entry.borrowPaidOut))
      : 0;
  const normalizedCurrency = typeof entry?.currency === "string" && entry.currency.trim()
    ? entry.currency.trim()
    : safeType === "strategy" && typeof entry?.strategyName === "string" && entry.strategyName.trim()
      ? entry.strategyName.trim()
      : safeType === "strategy"
        ? DEFAULT_STRATEGY_CURRENCY
        : "USD";
  const normalizedStrategyName = typeof entry?.strategyName === "string" && entry.strategyName.trim()
    ? entry.strategyName.trim()
    : typeof entry?.name === "string" && entry.name.trim()
      ? entry.name.trim()
      : "Unbenannte Position";

  return {
    id: typeof entry?.id === "string" && entry.id.length > 0 ? entry.id : crypto.randomUUID(),
    type: safeType,
    date: normalizedDate,
    wallet:
      typeof entry?.wallet === "string" && entry.wallet.trim() && wallets.includes(entry.wallet.trim())
        ? entry.wallet.trim()
        : fallbackWallet(),
    chain:
      typeof entry?.chain === "string" && SUPPORTED_CHAINS.has(entry.chain.trim().toUpperCase())
        ? entry.chain.trim().toUpperCase()
        : DEFAULT_CHAIN,
    projectName: typeof entry?.projectName === "string" && entry.projectName.trim() ? entry.projectName.trim() : TYPE_LABELS[safeType],
    currency: normalizedCurrency,
    strategyName: safeType === "strategy" ? normalizedCurrency : normalizedStrategyName,
    investedAmount: normalizedInvested,
    interestAmount: computedInterest,
    currentValue: computedCurrent,
    collateral: typeof entry?.collateral === "string" ? entry.collateral.trim() : "",
    debtUsd: normalizedDebt,
    borrowPayout: normalizedBorrowPayout,
    calculationMode: normalizedCalculationMode,
    ptAmount: normalizedPtAmount,
    maturityDate: normalizedMaturityDate,
    notes: typeof entry?.notes === "string" ? entry.notes.trim() : "",
    status: safeStatus,
    archivedAt: safeStatus === "archived" && typeof entry?.archivedAt === "string" ? entry.archivedAt : null
  };
}

function getLocalStateSnapshot() {
  return {
    positions: [...positions],
    wallets: [...wallets],
    updatedAt: new Date().toISOString()
  };
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_error) {
    return false;
  }
}

function setSupabaseStatus(message, isError = false) {
  if (!supabaseStatus) {
    return;
  }
  supabaseStatus.textContent = message;
  supabaseStatus.style.color = isError ? "#ffb4b4" : "#bdd8ff";
}

function readSupabaseConfig() {
  const raw = readStorage(SUPABASE_STORAGE_KEY);
  if (!raw) {
    return manualSupabaseConfig;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return manualSupabaseConfig;
    }
    const url = typeof parsed.url === "string" ? parsed.url.trim() : "";
    const anonKey = typeof parsed.anonKey === "string" ? parsed.anonKey.trim() : "";
    if (!url || !anonKey) {
      return manualSupabaseConfig;
    }
    return {
      url,
      anonKey,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
      lastCheckedAt: typeof parsed.lastCheckedAt === "string" ? parsed.lastCheckedAt : null
    };
  } catch (_error) {
    return manualSupabaseConfig;
  }
}

function readSupabaseConfigFromRuntime() {
  const config = window.__DEFI_MANAGER_CONFIG__;
  if (!config || typeof config !== "object") {
    return null;
  }
  const url = typeof config.supabaseUrl === "string" ? config.supabaseUrl.trim() : "";
  const anonKey = typeof config.supabaseAnonKey === "string" ? config.supabaseAnonKey.trim() : "";
  if (!url || !anonKey) {
    return null;
  }
  return {
    url,
    anonKey,
    savedAt: new Date().toISOString(),
    lastCheckedAt: null
  };
}

function writeSupabaseConfig(config) {
  manualSupabaseConfig = {
    url: config.url,
    anonKey: config.anonKey,
    savedAt: config.savedAt || new Date().toISOString(),
    lastCheckedAt: config.lastCheckedAt || null
  };
  return writeStorage(SUPABASE_STORAGE_KEY, JSON.stringify(manualSupabaseConfig));
}

function updateSupabaseMeta(config) {
  if (!supabaseMeta) {
    return;
  }
  if (!config) {
    supabaseMeta.textContent = "Keine Supabase-Konfiguration gespeichert.";
    return;
  }

  const savedAt = config.savedAt ? formatArchiveTimestamp(config.savedAt) : "-";
  const lastCheckedAt = config.lastCheckedAt ? formatArchiveTimestamp(config.lastCheckedAt) : "-";
  const sourceLabel =
    supabaseConfigSource === "runtime"
      ? "Quelle: ENV"
      : supabaseConfigSource === "manual"
        ? "Quelle: Manuell"
        : "Quelle: -";
  supabaseMeta.textContent = `${sourceLabel} | Gespeichert: ${savedAt} | Letzter Test: ${lastCheckedAt}`;
}

function createSupabaseClient(config) {
  const factory = window.supabase?.createClient;
  if (!factory) {
    return null;
  }
  return factory(config.url, config.anonKey);
}

async function testSupabaseConnection() {
  const config = readSupabaseConfig();
  if (!config) {
    setSupabaseStatus("Bitte zuerst Supabase URL und Anon Key speichern.", true);
    updateSupabaseMeta(null);
    return;
  }

  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(config);
  }

  if (!supabaseClient) {
    setSupabaseStatus("Supabase SDK nicht geladen. Seite neu laden und erneut testen.", true);
    return;
  }

  setSupabaseStatus("Teste Verbindung zu Supabase...");
  try {
    const { error } = await supabaseClient.auth.getSession();
    if (error) {
      throw error;
    }

    const updatedConfig = {
      ...config,
      lastCheckedAt: new Date().toISOString()
    };
    writeSupabaseConfig(updatedConfig);
    updateSupabaseMeta(updatedConfig);
    setSupabaseStatus("Supabase Verbindung erfolgreich.");
  } catch (error) {
    const message = typeof error?.message === "string" ? error.message : "Unbekannter Fehler";
    setSupabaseStatus(`Supabase Verbindung fehlgeschlagen: ${message}`, true);
  }
}

async function validateSupabaseSchema() {
  const config = readSupabaseConfig();
  if (!config) {
    setSupabaseStatus("Bitte zuerst Supabase URL und Anon Key speichern.", true);
    updateSupabaseMeta(null);
    return;
  }

  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(config);
  }

  if (!supabaseClient) {
    setSupabaseStatus("Supabase SDK nicht geladen. Seite neu laden und erneut testen.", true);
    return;
  }

  setSupabaseStatus("Prüfe DEF-108 Datenbankstruktur...");
  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_STATE_TABLE)
      .select("id,payload,schema_version,created_at,updated_at")
      .eq("id", SUPABASE_STATE_ID)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const hasPayload = Boolean(data?.payload && typeof data.payload === "object");
    const hasSchemaVersion = Number.isFinite(Number(data?.schema_version));
    const hasTimestamps = Boolean(data?.created_at) && Boolean(data?.updated_at);
    const isValid = hasPayload && hasSchemaVersion && hasTimestamps;

    if (!data) {
      setSupabaseStatus(
        "Schema gefunden, aber Seed-Row 'global' fehlt. Bitte DEF-108 SQL-Skript ausführen.",
        true
      );
      return;
    }

    if (!isValid) {
      setSupabaseStatus("Schema unvollständig. Bitte DEF-108 SQL-Skript erneut ausführen.", true);
      return;
    }

    setSupabaseStatus("DEF-108 Schema aktiv: Tabelle, Spalten und Seed-Row sind vorhanden.");
  } catch (error) {
    const message = typeof error?.message === "string" ? error.message : "Unbekannter Fehler";
    setSupabaseStatus(`Schema-Prüfung fehlgeschlagen: ${message}`, true);
  }
}

function normalizeRemoteState(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const positionsList = Array.isArray(payload.positions) ? payload.positions.map(normalizePosition).filter(Boolean) : null;
  const walletList = Array.isArray(payload.wallets)
    ? payload.wallets.map((entry) => String(entry || "").trim()).filter((entry) => entry.length > 0)
    : null;
  if (!positionsList || !walletList || walletList.length === 0) {
    return null;
  }
  return {
    positions: positionsList,
    wallets: walletList,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null
  };
}

async function saveStateToSupabase(reason = "update") {
  supabaseSyncQueue = supabaseSyncQueue.finally(async () => {
    if (suppressRemoteSync || !supabaseClient) {
      return;
    }
    const snapshot = getLocalStateSnapshot();
    try {
      const { error } = await supabaseClient.from(SUPABASE_STATE_TABLE).upsert(
        {
          id: SUPABASE_STATE_ID,
          payload: snapshot,
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      );
      if (error) {
        throw error;
      }
      setSupabaseStatus(`Supabase Sync erfolgreich (${reason}).`);
    } catch (error) {
      const message = typeof error?.message === "string" ? error.message : "Unbekannter Fehler";
      setSupabaseStatus(`Supabase Sync fehlgeschlagen: ${message}`, true);
    }
  });
  return supabaseSyncQueue;
}

async function loadStateFromSupabase() {
  if (!supabaseClient) {
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_STATE_TABLE)
      .select("payload,updated_at")
      .eq("id", SUPABASE_STATE_ID)
      .maybeSingle();
    if (error) {
      throw error;
    }

    const remote = normalizeRemoteState(data?.payload);
    if (!remote) {
      await saveStateToSupabase("initial");
      return;
    }

    suppressRemoteSync = true;
    wallets = remote.wallets;
    positions = remote.positions;
    render();
    suppressRemoteSync = false;
    setSupabaseStatus("Supabase Daten geladen.");
  } catch (error) {
    suppressRemoteSync = false;
    const message = typeof error?.message === "string" ? error.message : "Unbekannter Fehler";
    setSupabaseStatus(`Supabase Laden fehlgeschlagen: ${message}`, true);
  }
}

function initializeSupabaseSettings() {
  const runtimeConfig = readSupabaseConfigFromRuntime();
  const config = runtimeConfig || readSupabaseConfig();
  supabaseConfigSource = runtimeConfig ? "runtime" : config ? "manual" : "none";
  if (config) {
    if (supabaseUrlInput) {
      supabaseUrlInput.value = config.url;
    }
    if (supabaseAnonKeyInput) {
      supabaseAnonKeyInput.value = config.anonKey;
    }
    supabaseClient = createSupabaseClient(config);
  }
  if (supabaseConfigSource === "runtime") {
    if (supabaseUrlInput) {
      supabaseUrlInput.readOnly = true;
    }
    if (supabaseAnonKeyInput) {
      supabaseAnonKeyInput.readOnly = true;
    }
    if (supabaseForm) {
      const submit = supabaseForm.querySelector('button[type="submit"]');
      if (submit instanceof HTMLButtonElement) {
        submit.disabled = true;
        submit.textContent = "Per ENV konfiguriert";
      }
    }
    setSupabaseStatus("Supabase per ENV-Konfiguration geladen.");
  }
  updateSupabaseMeta(config);
  if (supabaseClient) {
    loadStateFromSupabase();
  }
}

function setWalletStatus(message) {
  if (walletStatus) {
    walletStatus.textContent = message;
  }
}

function loadWallets() {
  wallets = [...DEFAULT_WALLETS];
}

function saveWallets() {
  saveStateToSupabase("wallets");
}

function fallbackWallet() {
  return wallets[0] || DEFAULT_WALLETS[0];
}

function loadPositions() {
  positions = [...initialPositions];
}

function savePositions() {
  saveStateToSupabase("positionen");
}

function setStatus(message) {
  formStatus.textContent = message;
}

function activePositions() {
  return positions.filter((entry) => entry.status === "active");
}

function archivedPositions() {
  return positions.filter((entry) => entry.status === "archived");
}

function computeRoiUsd(entry) {
  return Number(entry.currentValue || 0) - Number(entry.investedAmount || 0);
}

function computeRoiPercent(entry) {
  const invested = Number(entry.investedAmount || 0);
  if (invested <= 0) {
    return 0;
  }
  return (computeRoiUsd(entry) / invested) * 100;
}

function computeObservedMonthlyCashflow(entry) {
  const invested = Number(entry.investedAmount || 0);
  const current = Number(entry.currentValue || 0);
  const startDate = parsePositionDate(entry.date);

  if (invested <= 0 || current <= 0 || !startDate) {
    return 0;
  }

  const now = new Date();
  const elapsedMs = now.getTime() - startDate.getTime();
  const elapsedHours = elapsedMs / MS_PER_HOUR;
  const elapsedMonths = elapsedHours / HOURS_PER_MONTH;

  if (!Number.isFinite(elapsedMonths) || elapsedMonths <= 0) {
    return 0;
  }

  const roiUsd = current - invested;
  return roiUsd / elapsedMonths;
}

function computeCompoundedAnnualApy(monthlyCashflow, baseValue) {
  const numericBase = Number(baseValue || 0);
  if (numericBase <= 0) {
    return 0;
  }

  const monthlyRate = Number(monthlyCashflow || 0) / numericBase;
  if (!Number.isFinite(monthlyRate) || monthlyRate <= -1) {
    return 0;
  }

  const annualized = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
  if (!Number.isFinite(annualized)) {
    return 0;
  }

  return Math.max(-100, Math.min(annualized, 10000));
}

function computeApyAnnual(entry) {
  const monthlyCashflow = computeObservedMonthlyCashflow(entry);
  return computeCompoundedAnnualApy(monthlyCashflow, Number(entry.currentValue || 0));
}

function computeMonthlyCashflow(entry) {
  return computeObservedMonthlyCashflow(entry);
}

function computeBorrowCost(entry) {
  const debt = Number(entry.debtUsd || 0);
  const payout = Number(entry.borrowPayout || 0);
  return Math.max(0, debt - payout);
}

function computeElapsedMonths(entry) {
  const normalizedDate = normalizeDateTimeValue(entry?.date);
  if (!normalizedDate) {
    return 0;
  }
  const startDate = new Date(normalizedDate);
  if (!startDate) {
    return 0;
  }
  const startMs = startDate.getTime();
  if (!Number.isFinite(startMs)) {
    return 0;
  }
  const now = new Date();
  const elapsedMs = Math.abs(now.getTime() - startMs);
  if (elapsedMs < MS_PER_HOUR) {
    return 0;
  }
  const elapsedHours = elapsedMs / MS_PER_HOUR;
  const elapsedMonths = elapsedHours / HOURS_PER_MONTH;
  if (!Number.isFinite(elapsedMonths) || elapsedMonths <= 0) {
    return 0;
  }
  return elapsedMonths;
}

function computeMonthlyBorrowCost(entry) {
  const elapsedMonths = computeElapsedMonths(entry);
  if (elapsedMonths <= 0) {
    return 0;
  }
  return computeBorrowCost(entry) / elapsedMonths;
}

function computeBorrowApy(entry) {
  const debt = Number(entry.debtUsd || 0);
  if (debt <= 0) {
    return 0;
  }
  const borrowCost = computeBorrowCost(entry);
  if (borrowCost <= 0) {
    return 0;
  }
  const elapsedMonths = computeElapsedMonths(entry);
  if (!Number.isFinite(elapsedMonths) || elapsedMonths <= 0) {
    return 0;
  }
  const annualized = (borrowCost / debt) * (12 / elapsedMonths) * 100;
  if (!Number.isFinite(annualized)) {
    return 0;
  }
  return Math.max(0, Math.min(annualized, 100000));
}

function computeNetApy(entry) {
  return computeApyAnnual(entry) - computeBorrowApy(entry);
}

function computeLtv(entry) {
  const current = Number(entry.currentValue || 0);
  if (current <= 0) {
    return 0;
  }
  return (Number(entry.debtUsd || 0) / current) * 100;
}

function computeRoiAtMaturity(entry) {
  return Number(entry.ptAmount ?? 0) - Number(entry.investedAmount || 0);
}

function computeFixedMonthlyCashflow(entry) {
  const startDate = parsePositionDate(entry.date);
  const maturityDate = parsePositionDate(entry.maturityDate);
  if (!startDate || !maturityDate) {
    return 0;
  }

  const durationMs = maturityDate.getTime() - startDate.getTime();
  const hoursUntilMaturity = durationMs / MS_PER_HOUR;
  const monthsUntilMaturity = hoursUntilMaturity / HOURS_PER_MONTH;

  if (!Number.isFinite(monthsUntilMaturity) || monthsUntilMaturity <= 0) {
    return 0;
  }

  return computeRoiAtMaturity(entry) / monthsUntilMaturity;
}

function roiDisplay(entry) {
  const roiPercent = computeRoiPercent(entry);
  const roiUsd = computeRoiUsd(entry);
  return `${formatPercent(roiPercent)} (${formatCurrency(roiUsd)})`;
}

function updateKpis() {
  const active = activePositions();
  const totalCurrentValue = active.reduce((acc, item) => acc + Number(item.currentValue || 0), 0);
  const totalMonthlyCashflow = active.reduce((acc, item) => {
    const monthlyCashflow = item.type === "pendle" ? computeFixedMonthlyCashflow(item) : computeMonthlyCashflow(item);
    return acc + monthlyCashflow;
  }, 0);
  const totalLendingCostMonthly = active.reduce((acc, item) => {
    if (item.type !== "lending") {
      return acc;
    }
    return acc + computeMonthlyBorrowCost(item);
  }, 0);
  const avgApy = computeCompoundedAnnualApy(totalMonthlyCashflow, totalCurrentValue);

  kpiCurrent.textContent = formatCurrency(totalCurrentValue);
  kpiApy.textContent = formatPercent(avgApy);
  kpiCashflow.textContent = formatCurrency(totalMonthlyCashflow);
  if (kpiLendingCost) {
    kpiLendingCost.textContent = formatCurrency(totalLendingCostMonthly);
  }
}

function updatePositionCountLabel() {
  if (activeTableTitle) {
    activeTableTitle.textContent = TABLE_TITLES[activeTab] || "Aktive Positionen Tabelle";
  }
  if (!activePositionsTotal) {
    return;
  }
  activePositionsTotal.textContent = `(${filteredActivePositions().length})`;
}

function updateStrategyColumnLabel() {
  if (!activeStrategyColumnLabel) {
    return;
  }
  activeStrategyColumnLabel.textContent = activeTab === "strategy" ? "Währung" : "Name der Strategie";
}

function isMaturityColumnVisible() {
  return activeTab === "pendle";
}

function isLendingColumnVisible() {
  return activeTab === "lending";
}

function toggleHeaderVisibility(header, visible) {
  if (!header) {
    return;
  }
  header.hidden = !visible;
  const button = header.querySelector(".sort-btn");
  if (button instanceof HTMLButtonElement) {
    button.disabled = !visible;
    button.setAttribute("aria-hidden", visible ? "false" : "true");
  }
}

function updateActiveTableColumns() {
  const showMaturity = isMaturityColumnVisible();
  const showLending = isLendingColumnVisible();
  const showClassic = !showMaturity && !showLending;

  toggleHeaderVisibility(activeStrategyNameHeader, showClassic || showMaturity);
  toggleHeaderVisibility(activeCollateralHeader, showLending);
  toggleHeaderVisibility(activeInterestHeader, showClassic || showMaturity);
  toggleHeaderVisibility(activeRoiHeader, showClassic || showMaturity);
  toggleHeaderVisibility(activeMonthlyCashflowHeader, showClassic || showMaturity);
  toggleHeaderVisibility(activeFixedCashflowHeader, showMaturity);
  toggleHeaderVisibility(activeApyHeader, showClassic || showMaturity);
  toggleHeaderVisibility(activeCollateralApyHeader, showLending);
  toggleHeaderVisibility(activeNetApyHeader, showLending);
  toggleHeaderVisibility(activeBorrowCostHeader, showLending);
  toggleHeaderVisibility(activeBorrowApyHeader, showLending);
  toggleHeaderVisibility(activeDebtHeader, showLending);
  toggleHeaderVisibility(activeBorrowPayoutHeader, showLending);
  toggleHeaderVisibility(activeLtvHeader, showLending);
  toggleHeaderVisibility(activePtAmountHeader, showMaturity);
  toggleHeaderVisibility(activeRoiMaturityHeader, showMaturity);
  toggleHeaderVisibility(activeMaturityHeader, showMaturity);
  toggleHeaderVisibility(activeNotesHeader, showClassic);
}

function syncTypeSpecificFields(positionType) {
  const isPendle = positionType === "pendle";
  const isLending = positionType === "lending";
  const isStrategy = positionType === "strategy";
  if (strategyNameField) {
    strategyNameField.hidden = !isPendle;
  }
  if (strategyNameLabel) {
    strategyNameLabel.textContent = "Name der Strategie";
  }
  if (strategyNameInput) {
    strategyNameInput.required = isPendle;
  }
  if (currencyField) {
    currencyField.hidden = !isStrategy;
  }
  if (currencyInput) {
    currencyInput.required = isStrategy;
  }
  if (maturityField) {
    maturityField.hidden = !isPendle;
  }
  if (ptAmountField) {
    ptAmountField.hidden = !isPendle;
  }
  if (!isPendle && maturityInput) {
    maturityInput.value = "";
  }
  if (!isPendle && ptAmountInput) {
    ptAmountInput.value = "";
  }
  if (collateralField) {
    collateralField.hidden = !isLending;
  }
  if (debtField) {
    debtField.hidden = !isLending;
  }
  if (borrowPayoutField) {
    borrowPayoutField.hidden = !isLending;
  }
  if (interestField) {
    interestField.hidden = isLending;
  }
  if (currentField) {
    currentField.hidden = false;
  }
  if (notesField) {
    notesField.hidden = !isStrategy;
  }
  if (investedField) {
    investedField.hidden = false;
  }
  if (!isLending) {
    if (collateralInput) {
      collateralInput.value = "ETH";
    }
    if (debtInput) {
      debtInput.value = "";
    }
    if (borrowPayoutInput) {
      borrowPayoutInput.value = "";
    }
  } else {
    if (collateralInput && !collateralInput.value) {
      collateralInput.value = "ETH";
    }
    if (interestInput) {
      interestInput.value = "";
    }
    if (notesInput) {
      notesInput.value = "";
    }
    if (strategyNameInput) {
      strategyNameInput.value = "";
    }
  }
  if (!isStrategy && currencyInput) {
    currencyInput.value = DEFAULT_STRATEGY_CURRENCY;
  }
  if (isStrategy && currencyInput && !currencyInput.value) {
    currencyInput.value = DEFAULT_STRATEGY_CURRENCY;
  }
  if (!isStrategy && notesInput) {
    notesInput.value = "";
  }
  updateAmountLabels(positionType);
}

function renderWalletSelect() {
  if (!walletInput) {
    return;
  }
  const selected = walletInput.value;
  walletInput.innerHTML = wallets.map((wallet) => `<option value="${escapeHtml(wallet)}">${escapeHtml(wallet)}</option>`).join("");
  walletInput.value = wallets.includes(selected) ? selected : fallbackWallet();
}

function renderWalletList() {
  if (!walletList) {
    return;
  }
  if (walletCount) {
    walletCount.textContent = String(wallets.length);
  }
  walletList.innerHTML = wallets
    .map((wallet) => {
      const usageCount = positions.filter((entry) => entry.wallet === wallet).length;
      const usageLabel = usageCount > 0 ? `${usageCount} Position${usageCount === 1 ? "" : "en"}` : "Nicht verwendet";
      const usageClass = usageCount > 0 ? "is-used" : "is-free";
      return `
      <li class="wallet-item">
        <div class="wallet-main">
          <span class="wallet-name">${escapeHtml(wallet)}</span>
          <span class="wallet-usage-tag ${usageClass}">${usageLabel}</span>
        </div>
        <div class="wallet-actions">
          <button type="button" class="wallet-action-btn edit-wallet-btn" data-wallet="${escapeHtml(wallet)}">Bearbeiten</button>
          <button type="button" class="wallet-action-btn delete-wallet-btn" data-wallet="${escapeHtml(wallet)}">Löschen</button>
        </div>
      </li>
    `;
    })
    .join("");
}

function filteredActivePositions() {
  return activePositions().filter((entry) => entry.type === activeTab);
}

function getSortValue(entry, key) {
  switch (key) {
    case "date": {
      const parsedDate = parsePositionDate(entry.date);
      return parsedDate ? parsedDate.getTime() : 0;
    }
    case "wallet":
    case "chain": {
      const normalizedChain = String(entry.chain || "").toUpperCase();
      const chainOrderIndex = CHAIN_ORDER.indexOf(normalizedChain);
      return chainOrderIndex >= 0 ? chainOrderIndex : Number.MAX_SAFE_INTEGER;
    }
    case "projectName":
    case "collateral":
    case "notes":
      return String(entry[key] || "");
    case "strategyName":
      return entry.type === "strategy" ? String(entry.currency || entry.strategyName || "") : String(entry.strategyName || "");
    case "maturityDate": {
      const maturityDate = parsePositionDate(entry.maturityDate);
      return maturityDate ? maturityDate.getTime() : 0;
    }
    case "roiAtMaturity":
      return computeRoiAtMaturity(entry);
    case "ptAmount":
      return Number(entry.ptAmount ?? 0);
    case "investedAmount":
    case "currentValue":
    case "interestAmount":
      return Number(entry[key] || 0);
    case "roiPercent":
      return computeRoiPercent(entry);
    case "monthlyCashflow":
      return computeMonthlyCashflow(entry);
    case "fixedMonthlyCashflow":
      return computeFixedMonthlyCashflow(entry);
    case "apyAnnual":
      return computeApyAnnual(entry);
    case "collateralApy":
      return computeApyAnnual(entry);
    case "netApy":
      return computeNetApy(entry);
    case "borrowCost":
      return computeBorrowCost(entry);
    case "borrowApy":
      return computeBorrowApy(entry);
    case "debtUsd":
      return Number(entry.debtUsd || 0);
    case "borrowPayout":
      return Number(entry.borrowPayout || 0);
    case "ltv":
      return computeLtv(entry);
    case "archivedAt": {
      const archivedDate = entry.archivedAt ? new Date(entry.archivedAt) : null;
      return archivedDate && !Number.isNaN(archivedDate.getTime()) ? archivedDate.getTime() : 0;
    }
    default:
      return String(entry[key] || "");
  }
}

function sortRows(rows, tableName) {
  const state = sortState[tableName];
  if (!state?.key) {
    return rows;
  }

  const factor = state.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aValue = getSortValue(a, state.key);
    const bValue = getSortValue(b, state.key);
    let result = 0;

    if (typeof aValue === "number" && typeof bValue === "number") {
      result = aValue - bValue;
    } else {
      result = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: "base", numeric: true });
    }

    if (result !== 0) {
      return result * factor;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

function updateSortUi() {
  sortableHeaders.forEach((header) => {
    const tableName = header.dataset.sortTable;
    const key = header.dataset.sortKey;
    const indicator = header.querySelector(".sort-indicator");
    const state = tableName ? sortState[tableName] : null;
    const isActive = Boolean(state && key && state.key === key);

    if (!isActive) {
      header.setAttribute("aria-sort", "none");
      if (indicator) {
        indicator.textContent = "";
      }
      return;
    }

    const isAscending = state.direction === "asc";
    header.setAttribute("aria-sort", isAscending ? "ascending" : "descending");
    if (indicator) {
      indicator.textContent = isAscending ? "▲" : "▼";
    }
  });
}

function renderActiveTable() {
  const rows = sortRows(filteredActivePositions(), "active");
  const activeTabLabel = TYPE_LABELS[activeTab] || "diesen Bereich";
  const showMaturity = isMaturityColumnVisible();
  const showLending = isLendingColumnVisible();
  const tableColspan = showMaturity ? 16 : showLending ? 15 : 13;

  if (rows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${tableColspan}" class="empty">In ${activeTabLabel} sind noch keine aktiven Positionen vorhanden.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = rows
    .map((row) => {
      return `
      <tr>
        <td>${formatDate(row.date)}</td>
        <td>${escapeHtml(row.wallet)}</td>
        <td>${escapeHtml(row.chain)}</td>
        <td>${escapeHtml(row.projectName)}</td>
        ${showLending ? `<td>${escapeHtml(row.collateral || "-")}</td>` : `<td>${escapeHtml(row.type === "strategy" ? row.currency || row.strategyName : row.strategyName)}</td>`}
        <td>${showLending ? formatAssetAmount(Number(row.investedAmount || 0), row.collateral) : formatCurrency(Number(row.investedAmount || 0))}</td>
        <td>${showLending ? formatAssetAmount(Number(row.currentValue || 0), row.collateral) : formatCurrency(Number(row.currentValue || 0))}</td>
        ${showLending ? "" : `<td>${formatCurrency(Number(row.interestAmount || 0))}</td>`}
        ${showLending ? "" : `<td>${roiDisplay(row)}</td>`}
        ${showLending ? "" : `<td>${formatCurrency(computeMonthlyCashflow(row))}</td>`}
        ${showMaturity ? `<td>${formatCurrency(computeFixedMonthlyCashflow(row))}</td>` : ""}
        ${showLending ? "" : `<td>${formatPercent(computeApyAnnual(row))}</td>`}
        ${showLending ? `<td>${formatPercent(computeApyAnnual(row))}</td>` : ""}
        ${showLending ? `<td>${formatPercent(computeNetApy(row))}</td>` : ""}
        ${showLending ? `<td>${formatPercent(computeBorrowApy(row))}</td>` : ""}
        ${showLending ? `<td>${formatCurrency(computeBorrowCost(row))}</td>` : ""}
        ${showLending ? `<td>${formatCurrency(Number(row.debtUsd || 0))}</td>` : ""}
        ${showLending ? `<td>${formatCurrency(Number(row.borrowPayout || 0))}</td>` : ""}
        ${showLending ? `<td>${formatPercent(computeLtv(row))}</td>` : ""}
        ${showMaturity ? `<td>${formatQuantity(row.ptAmount)}</td>` : ""}
        ${showMaturity ? `<td>${formatCurrency(computeRoiAtMaturity(row))}</td>` : ""}
        ${showMaturity ? `<td>${formatDate(row.maturityDate)}</td>` : ""}
        ${showMaturity || showLending ? "" : `<td>${escapeHtml(row.notes || "-")}</td>`}
        <td>
          <div class="row-actions">
            <button type="button" class="edit-btn" data-id="${row.id}">Bearbeiten</button>
            <button type="button" class="archive-btn" data-id="${row.id}">Archivieren</button>
            <button type="button" class="delete-btn" data-id="${row.id}">Löschen</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderArchivedTable() {
  const rows = sortRows(archivedPositions(), "archive");

  if (rows.length === 0) {
    archivedBody.innerHTML = `
      <tr>
        <td colspan="14" class="empty">Noch keine archivierten Positionen.</td>
      </tr>
    `;
    return;
  }

  archivedBody.innerHTML = rows
    .map((row) => {
      return `
      <tr>
        <td>${formatDate(row.date)}</td>
        <td>${escapeHtml(row.wallet)}</td>
        <td>${escapeHtml(row.chain)}</td>
        <td>${escapeHtml(row.projectName)}</td>
        <td>${escapeHtml(row.type === "strategy" ? row.currency || row.strategyName : row.strategyName)}</td>
        <td>${formatCurrency(Number(row.investedAmount || 0))}</td>
        <td>${formatCurrency(Number(row.currentValue || 0))}</td>
        <td>${formatCurrency(Number(row.interestAmount || 0))}</td>
        <td>${roiDisplay(row)}</td>
        <td>${formatCurrency(computeMonthlyCashflow(row))}</td>
        <td>${formatPercent(computeApyAnnual(row))}</td>
        <td>${escapeHtml(row.notes || "-")}</td>
        <td>${formatArchiveTimestamp(row.archivedAt)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="restore-btn" data-id="${row.id}">Wiederherstellen</button>
            <button type="button" class="delete-btn" data-id="${row.id}">Löschen</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function render() {
  updateKpis();
  updatePositionCountLabel();
  renderActiveTable();
  renderArchivedTable();
  renderWalletSelect();
  renderWalletList();
}

function setActiveTab(nextTab) {
  activeTab = nextTab;
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === nextTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  if (editingPositionId) {
    resetFormMode();
    setStatus("Bearbeitungsmodus wegen Reiterwechsel beendet.");
  } else {
    syncTypeSpecificFields(nextTab);
  }
  if (nextTab === "pendle" && sortState.active.key === "notes") {
    sortState.active.key = null;
  }
  if (
    nextTab !== "pendle" &&
    (sortState.active.key === "maturityDate" ||
      sortState.active.key === "ptAmount" ||
      sortState.active.key === "roiAtMaturity" ||
      sortState.active.key === "fixedMonthlyCashflow")
  ) {
    sortState.active.key = null;
  }
  if (
    nextTab !== "lending" &&
    (sortState.active.key === "collateral" ||
      sortState.active.key === "collateralApy" ||
      sortState.active.key === "netApy" ||
      sortState.active.key === "borrowCost" ||
      sortState.active.key === "borrowApy" ||
      sortState.active.key === "debtUsd" ||
      sortState.active.key === "borrowPayout" ||
      sortState.active.key === "ltv")
  ) {
    sortState.active.key = null;
  }
  updateActiveTableColumns();
  updateStrategyColumnLabel();
  updatePositionCountLabel();
  updateSortUi();
  renderActiveTable();
}

function setPage(nextPage) {
  activePage = nextPage;

  pageTabs.forEach((tab) => {
    const isActive = tab.dataset.pageTarget === nextPage;
    tab.classList.toggle("active", isActive);
    if (isActive) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  Object.entries(pageSections).forEach(([pageName, section]) => {
    if (!section) {
      return;
    }
    const isVisible = pageName === nextPage;
    section.hidden = !isVisible;
    section.classList.toggle("is-active", isVisible);
  });
}

function setFormMode(isEditMode) {
  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) {
    return;
  }

  submitButton.textContent = isEditMode ? "Position speichern" : "Position hinzufügen";
}

function resetFormMode() {
  editingPositionId = null;
  form.reset();
  walletInput.value = fallbackWallet();
  chainInput.value = DEFAULT_CHAIN;
  dateInput.value = localDateTimeNowHour();
  syncTypeSpecificFields(activeTab);
  if (activeTab === "strategy" && currencyInput) {
    currencyInput.value = DEFAULT_STRATEGY_CURRENCY;
    updateAmountLabels("strategy");
  }
  syncCalculationInputs();
  setFormMode(false);
}

function parseOptionalNumber(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function syncCalculationInputs() {
  if (activeTab === "lending") {
    interestInput.disabled = true;
    currentInput.disabled = false;
    return;
  }
  const hasInterestValue = interestInput.value.trim() !== "";
  const hasCurrentValue = currentInput.value.trim() !== "";

  if (hasInterestValue && !hasCurrentValue) {
    currentInput.disabled = true;
    interestInput.disabled = false;
    return;
  }

  if (hasCurrentValue && !hasInterestValue) {
    interestInput.disabled = true;
    currentInput.disabled = false;
    return;
  }

  interestInput.disabled = false;
  currentInput.disabled = false;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.tab);
  });
});

pageTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setPage(tab.dataset.pageTarget);
  });
});

interestInput.addEventListener("input", () => {
  if (interestInput.value.trim() !== "") {
    currentInput.value = "";
  }
  syncCalculationInputs();
});

currentInput.addEventListener("input", () => {
  if (currentInput.value.trim() !== "") {
    interestInput.value = "";
  }
  syncCalculationInputs();
});

collateralInput?.addEventListener("change", () => {
  if (activeTab === "lending") {
    updateAmountLabels("lending");
  }
});

currencyInput?.addEventListener("change", () => {
  if (activeTab === "strategy") {
    updateAmountLabels("strategy");
  }
});

sortableHeaders.forEach((header) => {
  const button = header.querySelector(".sort-btn");
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    const tableName = button.dataset.sortTable;
    const key = button.dataset.sortKey;
    if (!tableName || !key || !sortState[tableName]) {
      return;
    }

    const state = sortState[tableName];
    if (state.key === key) {
      state.direction = state.direction === "asc" ? "desc" : "asc";
    } else {
      state.key = key;
      state.direction = "asc";
    }

    updateSortUi();
    if (tableName === "active") {
      renderActiveTable();
    } else {
      renderArchivedTable();
    }
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const editingPosition = editingPositionId ? positions.find((entry) => entry.id === editingPositionId) : null;

  const next = {
    id: crypto.randomUUID(),
    type: editingPosition?.type || activeTab,
    date: normalizeDateTimeValue(dateInput.value) || "",
    wallet: walletInput.value,
    chain: chainInput.value,
    projectName: projectInput.value.trim(),
    strategyName: strategyNameInput.value.trim(),
    currency: "",
    investedAmount: Number(investedInput.value),
    interestAmount: 0,
    currentValue: 0,
    collateral: "",
    debtUsd: 0,
    borrowPayout: 0,
    calculationMode: "interest",
    ptAmount: null,
    maturityDate: null,
    notes: notesInput.value.trim(),
    status: "active",
    archivedAt: null
  };
  const providedInterest = parseOptionalNumber(interestInput.value);
  const providedCurrent = parseOptionalNumber(currentInput.value);

  if (!parsePositionDate(next.date)) {
    setStatus("Datum/Uhrzeit ist erforderlich (stunden-genau, z.B. 2026-04-22T16:00).");
    return;
  }

  if (maturityInput?.value) {
    const normalizedMaturity = normalizeDateTimeValue(maturityInput.value);
    if (!normalizedMaturity || !parsePositionDate(normalizedMaturity)) {
      setStatus("Maturity muss ein gültiges Datum mit Uhrzeit auf Stunde sein.");
      return;
    }
    next.maturityDate = normalizedMaturity;
  }

  if (ptAmountInput?.value.trim()) {
    const ptAmount = Number(ptAmountInput.value);
    if (!Number.isFinite(ptAmount) || ptAmount < 0) {
      setStatus("PT-Anzahl muss eine nicht-negative Zahl sein.");
      return;
    }
    next.ptAmount = ptAmount;
  }
  if (next.type === "lending") {
    next.collateral = collateralInput?.value.trim() || "";
    next.strategyName = next.collateral || "Lending Position";
    if (!next.collateral) {
      setStatus("Collateral ist fuer Lending/Borrow Positionen erforderlich.");
      return;
    }
    const debt = parseOptionalNumber(debtInput?.value || "");
    if (debt !== null) {
      if (Number.isNaN(debt) || debt < 0) {
        setStatus("Borrow Schulden muessen eine nicht-negative Zahl sein.");
        return;
      }
      next.debtUsd = debt;
    }
    const borrowPayout = parseOptionalNumber(borrowPayoutInput?.value || "");
    if (borrowPayout !== null) {
      if (Number.isNaN(borrowPayout) || borrowPayout < 0) {
        setStatus("Borrow Ausgezahlt muss eine nicht-negative Zahl sein.");
        return;
      }
      next.borrowPayout = borrowPayout;
    }
  } else if (next.type === "strategy") {
    next.currency = currencyInput?.value.trim() || "";
    next.strategyName = next.currency;
    if (!next.currency) {
      setStatus("Waehrung ist fuer klassische Yield Strategien erforderlich.");
      return;
    }
  }

  if (next.type === "pendle" && !next.strategyName) {
    setStatus("Name der Strategie ist erforderlich.");
    return;
  }

  if (Number.isNaN(next.investedAmount) || next.investedAmount < 0) {
    setStatus("Der eingezahlte Betrag muss eine nicht-negative Zahl sein.");
    return;
  }

  if (next.type !== "lending" && providedInterest !== null && Number.isNaN(providedInterest)) {
    setStatus("Zinsen müssen eine gültige Zahl sein.");
    return;
  }

  if (providedCurrent !== null && Number.isNaN(providedCurrent)) {
    setStatus("Aktueller Wert muss eine gültige Zahl sein.");
    return;
  }

  if (next.type !== "lending" && providedInterest !== null && providedCurrent !== null) {
    setStatus("Bitte entweder Zinsen oder aktuellen Wert eintragen, nicht beides.");
    return;
  }

  if (next.type === "lending" && providedCurrent === null) {
    setStatus("Aktueller Wert muss eingetragen werden.");
    return;
  }

  if (next.type !== "lending" && providedInterest === null && providedCurrent === null) {
    setStatus("Bitte entweder Zinsen oder aktuellen Wert eintragen.");
    return;
  }

  if (next.type !== "lending" && providedInterest !== null && providedInterest < 0) {
    setStatus("Zinsen müssen eine nicht-negative Zahl sein.");
    return;
  }

  if (providedCurrent !== null && providedCurrent < 0) {
    setStatus("Aktueller Wert muss eine nicht-negative Zahl sein.");
    return;
  }

  if (next.type === "lending") {
    next.currentValue = providedCurrent;
    next.interestAmount = next.currentValue - next.investedAmount;
    next.calculationMode = "current";
  } else if (providedInterest !== null) {
    next.interestAmount = providedInterest;
    next.currentValue = next.investedAmount + next.interestAmount;
    next.calculationMode = "interest";
  } else {
    next.currentValue = providedCurrent;
    next.interestAmount = next.currentValue - next.investedAmount;
    next.calculationMode = "current";
  }

  if (next.interestAmount < 0) {
    setStatus("Der aktuelle Wert darf nicht kleiner als der eingezahlte Betrag sein.");
    return;
  }

  if (!wallets.includes(next.wallet)) {
    setStatus("Bitte eine gültige Wallet aus der Liste wählen.");
    return;
  }

  if (!SUPPORTED_CHAINS.has(next.chain)) {
    setStatus("Bitte eine gültige Chain aus der Liste wählen.");
    return;
  }

  next.projectName = next.projectName || TYPE_LABELS[next.type] || "Projekt";

  if (editingPositionId) {
    positions = positions.map((entry) =>
      entry.id === editingPositionId ? { ...entry, ...next, id: editingPositionId, status: "active", archivedAt: null } : entry
    );
    setStatus("Position aktualisiert.");
  } else {
    positions.unshift(next);
    setStatus("Position gespeichert.");
  }

  savePositions();
  render();
  resetFormMode();
});

tableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const id = target.dataset.id;
  if (!id) {
    return;
  }

  if (target.classList.contains("edit-btn")) {
    const position = positions.find((entry) => entry.id === id && entry.status === "active");
    if (!position) {
      return;
    }

    editingPositionId = id;
    dateInput.value = normalizeDateTimeValue(position.date) || localDateTimeNowHour();
    walletInput.value = position.wallet;
    chainInput.value = position.chain;
    projectInput.value = position.projectName;
    strategyNameInput.value = position.strategyName;
    if (currencyInput) {
      currencyInput.value = position.currency || position.strategyName || DEFAULT_STRATEGY_CURRENCY;
    }
    ptAmountInput.value = position.ptAmount === null || position.ptAmount === undefined ? "" : String(position.ptAmount);
    maturityInput.value = normalizeDateTimeValue(position.maturityDate || "") || "";
    if (collateralInput) {
      collateralInput.value = position.collateral || "";
    }
    if (debtInput) {
      debtInput.value = Number(position.debtUsd || 0) > 0 ? String(position.debtUsd) : "";
    }
    if (borrowPayoutInput) {
      borrowPayoutInput.value = Number(position.borrowPayout || 0) > 0 ? String(position.borrowPayout) : "";
    }
    investedInput.value = String(position.investedAmount);
    if (position.calculationMode === "current") {
      currentInput.value = String(Number(position.currentValue || 0));
      interestInput.value = "";
    } else {
      interestInput.value = String(Number(position.interestAmount || 0));
      currentInput.value = "";
    }
    notesInput.value = position.notes || "";
    syncTypeSpecificFields(position.type);
    syncCalculationInputs();
    setFormMode(true);
    setStatus("Position wird bearbeitet.");
    if (position.type === "strategy" && currencyInput) {
      currencyInput.focus();
    } else {
      strategyNameInput.focus();
    }
    return;
  }

  if (target.classList.contains("archive-btn")) {
    positions = positions.map((entry) =>
      entry.id === id ? { ...entry, status: "archived", archivedAt: new Date().toISOString() } : entry
    );

    if (editingPositionId === id) {
      resetFormMode();
    }

    savePositions();
    render();
    setStatus("Position archiviert.");
    return;
  }

  if (target.classList.contains("delete-btn")) {
    positions = positions.filter((entry) => entry.id !== id);

    if (editingPositionId === id) {
      resetFormMode();
      setStatus("Position entfernt. Bearbeitungsmodus beendet.");
    } else {
      setStatus("Position entfernt.");
    }

    savePositions();
    render();
  }
});

archivedBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const id = target.dataset.id;
  if (!id) {
    return;
  }

  if (target.classList.contains("restore-btn")) {
    positions = positions.map((entry) =>
      entry.id === id ? { ...entry, status: "active", archivedAt: null } : entry
    );
    savePositions();
    render();
    setStatus("Position wiederhergestellt und im Dashboard aktiv.");
    return;
  }

  if (target.classList.contains("delete-btn")) {
    positions = positions.filter((entry) => entry.id !== id);
    savePositions();
    render();
    setStatus("Archivierte Position gelöscht.");
  }
});

walletForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextWallet = walletNameInput?.value.trim() || "";
  if (!nextWallet) {
    setWalletStatus("Wallet-Name ist erforderlich.");
    return;
  }

  const exists = wallets.some((wallet) => wallet.toLowerCase() === nextWallet.toLowerCase());
  if (exists) {
    setWalletStatus("Wallet existiert bereits.");
    return;
  }

  wallets.push(nextWallet);
  saveWallets();
  renderWalletSelect();
  renderWalletList();
  walletForm.reset();
  setWalletStatus(`Wallet "${nextWallet}" hinzugefügt.`);
});

walletList?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const walletName = target.dataset.wallet;
  if (!walletName || !wallets.includes(walletName)) {
    return;
  }

  if (target.classList.contains("edit-wallet-btn")) {
    const input = window.prompt("Neuer Wallet-Name:", walletName);
    if (input === null) {
      return;
    }

    const nextWalletName = input.trim();
    if (!nextWalletName) {
      setWalletStatus("Wallet-Name ist erforderlich.");
      return;
    }

    if (nextWalletName.length > 40) {
      setWalletStatus("Wallet-Name darf maximal 40 Zeichen haben.");
      return;
    }

    if (nextWalletName === walletName) {
      setWalletStatus("Wallet-Name unverändert.");
      return;
    }

    const exists = wallets.some(
      (wallet) => wallet.toLowerCase() === nextWalletName.toLowerCase() && wallet !== walletName
    );
    if (exists) {
      setWalletStatus("Wallet existiert bereits.");
      return;
    }

    const shouldKeepSelection = walletInput?.value === walletName;
    wallets = wallets.map((wallet) => (wallet === walletName ? nextWalletName : wallet));
    positions = positions.map((entry) => (entry.wallet === walletName ? { ...entry, wallet: nextWalletName } : entry));

    saveWallets();
    savePositions();
    render();
    if (shouldKeepSelection && walletInput) {
      walletInput.value = nextWalletName;
    }
    setWalletStatus(`Wallet "${walletName}" umbenannt zu "${nextWalletName}".`);
    return;
  }

  if (!target.classList.contains("delete-wallet-btn")) {
    return;
  }

  if (wallets.length <= 1) {
    setWalletStatus("Mindestens eine Wallet muss bestehen bleiben.");
    return;
  }

  const inUse = positions.some((entry) => entry.wallet === walletName);
  if (inUse) {
    setWalletStatus(`Wallet "${walletName}" wird noch in Positionen verwendet.`);
    return;
  }

  wallets = wallets.filter((wallet) => wallet !== walletName);
  saveWallets();
  renderWalletSelect();
  renderWalletList();
  setWalletStatus(`Wallet "${walletName}" gelöscht.`);
});

supabaseForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (supabaseConfigSource === "runtime") {
    setSupabaseStatus("Supabase wird per ENV-Konfiguration verwaltet.");
    return;
  }
  const url = supabaseUrlInput?.value.trim() || "";
  const anonKey = supabaseAnonKeyInput?.value.trim() || "";

  if (!url || !anonKey) {
    setSupabaseStatus("Supabase URL und Anon Key sind erforderlich.", true);
    return;
  }

  const nextConfig = {
    url,
    anonKey,
    savedAt: new Date().toISOString(),
    lastCheckedAt: null
  };
  const saved = writeSupabaseConfig(nextConfig);
  if (!saved) {
    setSupabaseStatus("Supabase Konfiguration konnte nicht gespeichert werden.", true);
    return;
  }

  supabaseClient = createSupabaseClient(nextConfig);
  updateSupabaseMeta(nextConfig);
  setSupabaseStatus("Supabase Konfiguration gespeichert. Jetzt Verbindung testen.");
});

supabaseTestButton?.addEventListener("click", () => {
  testSupabaseConnection();
});

supabaseSchemaButton?.addEventListener("click", () => {
  validateSupabaseSchema();
});

loadWallets();
loadPositions();
initializeSupabaseSettings();
setPage(activePage);
resetFormMode();
render();
updateActiveTableColumns();
updateStrategyColumnLabel();
updateSortUi();
console.log("DEF-66 wallet rename update loaded");
