const STORAGE_KEYS = {
  primary: "defi-dashboard-positions-v2",
  legacy: "defi-dashboard-positions-v1",
  backup: "defi-dashboard-positions-backup-v1"
};
const WALLET_STORAGE_KEY = "defi-dashboard-wallets-v1";
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
    investedAmount: 910000,
    interestAmount: 18000,
    currentValue: 928000,
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
const sortState = {
  active: { key: null, direction: "asc" },
  archive: { key: null, direction: "asc" }
};

const form = document.getElementById("position-form");
const dateInput = document.getElementById("position-date");
const walletInput = document.getElementById("position-wallet");
const chainInput = document.getElementById("position-chain");
const projectInput = document.getElementById("position-project");
const strategyNameInput = document.getElementById("position-strategy-name");
const maturityField = document.getElementById("position-maturity-field");
const maturityInput = document.getElementById("position-maturity");
const ptAmountField = document.getElementById("position-pt-amount-field");
const ptAmountInput = document.getElementById("position-pt-amount");
const investedInput = document.getElementById("position-invested");
const interestInput = document.getElementById("position-interest");
const currentInput = document.getElementById("position-current");
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

const kpiCurrent = document.getElementById("kpi-current");
const kpiApy = document.getElementById("kpi-apy");
const kpiCashflow = document.getElementById("kpi-cashflow");
const activeTableTitle = document.getElementById("active-table-title");
const activePositionsTotal = document.getElementById("active-positions-total");
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
    strategyName:
      typeof entry?.strategyName === "string" && entry.strategyName.trim()
        ? entry.strategyName.trim()
        : typeof entry?.name === "string" && entry.name.trim()
          ? entry.name.trim()
          : "Unbenannte Position",
    investedAmount: normalizedInvested,
    interestAmount: computedInterest,
    currentValue: computedCurrent,
    calculationMode: normalizedCalculationMode,
    ptAmount: normalizedPtAmount,
    maturityDate: normalizedMaturityDate,
    notes: typeof entry?.notes === "string" ? entry.notes.trim() : "",
    status: safeStatus,
    archivedAt: safeStatus === "archived" && typeof entry?.archivedAt === "string" ? entry.archivedAt : null
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

function setWalletStatus(message) {
  if (walletStatus) {
    walletStatus.textContent = message;
  }
}

function loadWallets() {
  const raw = readStorage(WALLET_STORAGE_KEY);
  if (!raw) {
    wallets = [...DEFAULT_WALLETS];
    saveWallets();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Wallet payload invalid");
    }
    const cleaned = parsed.map((entry) => String(entry || "").trim()).filter((entry) => entry.length > 0);
    wallets = cleaned.length > 0 ? cleaned : [...DEFAULT_WALLETS];
  } catch (_error) {
    wallets = [...DEFAULT_WALLETS];
  }

  saveWallets();
}

function saveWallets() {
  writeStorage(WALLET_STORAGE_KEY, JSON.stringify(wallets));
}

function parseStoredPositions(raw) {
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed?.positions;
  if (!Array.isArray(list)) {
    return null;
  }

  const normalized = list.map(normalizePosition).filter(Boolean);
  return normalized.length > 0 ? normalized : null;
}

function fallbackWallet() {
  return wallets[0] || DEFAULT_WALLETS[0];
}

function loadPositions() {
  const storageOrder = [STORAGE_KEYS.primary, STORAGE_KEYS.legacy, STORAGE_KEYS.backup];
  for (const key of storageOrder) {
    const raw = readStorage(key);
    if (!raw) {
      continue;
    }

    try {
      const parsed = parseStoredPositions(raw);
      if (!parsed) {
        continue;
      }
      positions = parsed;
      savePositions();
      return;
    } catch (_error) {
      continue;
    }
  }

  positions = [...initialPositions];
  savePositions();
}

function savePositions() {
  const payload = JSON.stringify({
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    positions
  });
  const legacyPayload = JSON.stringify(positions);

  writeStorage(STORAGE_KEYS.primary, payload);
  writeStorage(STORAGE_KEYS.legacy, legacyPayload);
  writeStorage(STORAGE_KEYS.backup, legacyPayload);
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

function computeApyAnnual(entry) {
  const invested = Number(entry.investedAmount || 0);
  if (invested <= 0) {
    return 0;
  }

  const monthlyCashflow = computeObservedMonthlyCashflow(entry);
  const monthlyRate = monthlyCashflow / invested;
  if (!Number.isFinite(monthlyRate) || monthlyRate <= -1) {
    return 0;
  }

  const annualized = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
  if (!Number.isFinite(annualized)) {
    return 0;
  }

  return Math.max(-100, Math.min(annualized, 10000));
}

function computeMonthlyCashflow(entry) {
  return computeObservedMonthlyCashflow(entry);
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
  const totalInvested = active.reduce((acc, item) => acc + Math.max(0, Number(item.investedAmount || 0)), 0);
  const avgApy =
    totalInvested > 0
      ? active.reduce((acc, item) => {
          const weight = Math.max(0, Number(item.investedAmount || 0));
          return acc + computeApyAnnual(item) * weight;
        }, 0) / totalInvested
      : 0;
  const totalMonthlyCashflow = active.reduce((acc, item) => {
    const monthlyCashflow = item.type === "pendle" ? computeFixedMonthlyCashflow(item) : computeMonthlyCashflow(item);
    return acc + monthlyCashflow;
  }, 0);

  kpiCurrent.textContent = formatCurrency(totalCurrentValue);
  kpiApy.textContent = formatPercent(avgApy);
  kpiCashflow.textContent = formatCurrency(totalMonthlyCashflow);
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

function isMaturityColumnVisible() {
  return activeTab === "pendle";
}

function updateActiveTableColumns() {
  const showMaturity = isMaturityColumnVisible();
  if (activePtAmountHeader) {
    activePtAmountHeader.hidden = !showMaturity;
    const ptAmountButton = activePtAmountHeader.querySelector(".sort-btn");
    if (ptAmountButton instanceof HTMLButtonElement) {
      ptAmountButton.disabled = !showMaturity;
      ptAmountButton.setAttribute("aria-hidden", showMaturity ? "false" : "true");
    }
  }
  if (activeFixedCashflowHeader) {
    activeFixedCashflowHeader.hidden = !showMaturity;
    const fixedCashflowButton = activeFixedCashflowHeader.querySelector(".sort-btn");
    if (fixedCashflowButton instanceof HTMLButtonElement) {
      fixedCashflowButton.disabled = !showMaturity;
      fixedCashflowButton.setAttribute("aria-hidden", showMaturity ? "false" : "true");
    }
  }
  if (!activeMaturityHeader) {
    if (activeRoiMaturityHeader) {
      activeRoiMaturityHeader.hidden = !showMaturity;
      const roiMaturityButton = activeRoiMaturityHeader.querySelector(".sort-btn");
      if (roiMaturityButton instanceof HTMLButtonElement) {
        roiMaturityButton.disabled = !showMaturity;
        roiMaturityButton.setAttribute("aria-hidden", showMaturity ? "false" : "true");
      }
    }
    if (activeNotesHeader) {
      activeNotesHeader.hidden = showMaturity;
      const notesButton = activeNotesHeader.querySelector(".sort-btn");
      if (notesButton instanceof HTMLButtonElement) {
        notesButton.disabled = showMaturity;
        notesButton.setAttribute("aria-hidden", showMaturity ? "true" : "false");
      }
    }
    return;
  }

  activeMaturityHeader.hidden = !showMaturity;
  const maturityButton = activeMaturityHeader.querySelector(".sort-btn");
  if (maturityButton instanceof HTMLButtonElement) {
    maturityButton.disabled = !showMaturity;
    maturityButton.setAttribute("aria-hidden", showMaturity ? "false" : "true");
  }
  if (activeRoiMaturityHeader) {
    activeRoiMaturityHeader.hidden = !showMaturity;
    const roiMaturityButton = activeRoiMaturityHeader.querySelector(".sort-btn");
    if (roiMaturityButton instanceof HTMLButtonElement) {
      roiMaturityButton.disabled = !showMaturity;
      roiMaturityButton.setAttribute("aria-hidden", showMaturity ? "false" : "true");
    }
  }
  if (activeNotesHeader) {
    activeNotesHeader.hidden = showMaturity;
    const notesButton = activeNotesHeader.querySelector(".sort-btn");
    if (notesButton instanceof HTMLButtonElement) {
      notesButton.disabled = showMaturity;
      notesButton.setAttribute("aria-hidden", showMaturity ? "true" : "false");
    }
  }
}

function syncMaturityField(positionType) {
  const isPendle = positionType === "pendle";
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
    case "strategyName":
    case "notes":
      return String(entry[key] || "");
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
  const tableColspan = showMaturity ? 16 : 13;

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
        <td>${escapeHtml(row.strategyName)}</td>
        <td>${formatCurrency(Number(row.investedAmount || 0))}</td>
        <td>${formatCurrency(Number(row.currentValue || 0))}</td>
        <td>${formatCurrency(Number(row.interestAmount || 0))}</td>
        <td>${roiDisplay(row)}</td>
        <td>${formatCurrency(computeMonthlyCashflow(row))}</td>
        ${showMaturity ? `<td>${formatCurrency(computeFixedMonthlyCashflow(row))}</td>` : ""}
        <td>${formatPercent(computeApyAnnual(row))}</td>
        ${showMaturity ? `<td>${formatQuantity(row.ptAmount)}</td>` : ""}
        ${showMaturity ? `<td>${formatCurrency(computeRoiAtMaturity(row))}</td>` : ""}
        ${showMaturity ? `<td>${formatDate(row.maturityDate)}</td>` : ""}
        ${showMaturity ? "" : `<td>${escapeHtml(row.notes || "-")}</td>`}
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
        <td>${escapeHtml(row.strategyName)}</td>
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
  if (!editingPositionId) {
    syncMaturityField(nextTab);
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
  updateActiveTableColumns();
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
  syncMaturityField(activeTab);
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
    investedAmount: Number(investedInput.value),
    interestAmount: 0,
    currentValue: 0,
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

  if (!next.strategyName) {
    setStatus("Name der Strategie ist erforderlich.");
    return;
  }

  if (Number.isNaN(next.investedAmount) || next.investedAmount < 0) {
    setStatus("Der eingezahlte Betrag muss eine nicht-negative Zahl sein.");
    return;
  }

  if (providedInterest !== null && Number.isNaN(providedInterest)) {
    setStatus("Zinsen müssen eine gültige Zahl sein.");
    return;
  }

  if (providedCurrent !== null && Number.isNaN(providedCurrent)) {
    setStatus("Aktueller Wert muss eine gültige Zahl sein.");
    return;
  }

  if (providedInterest !== null && providedCurrent !== null) {
    setStatus("Bitte entweder Zinsen oder aktuellen Wert eintragen, nicht beides.");
    return;
  }

  if (providedInterest === null && providedCurrent === null) {
    setStatus("Bitte entweder Zinsen oder aktuellen Wert eintragen.");
    return;
  }

  if (providedInterest !== null && providedInterest < 0) {
    setStatus("Zinsen müssen eine nicht-negative Zahl sein.");
    return;
  }

  if (providedCurrent !== null && providedCurrent < 0) {
    setStatus("Aktueller Wert muss eine nicht-negative Zahl sein.");
    return;
  }

  if (providedInterest !== null) {
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
    setStatus("Position im localStorage des Browsers gespeichert.");
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
    ptAmountInput.value = position.ptAmount === null || position.ptAmount === undefined ? "" : String(position.ptAmount);
    maturityInput.value = normalizeDateTimeValue(position.maturityDate || "") || "";
    investedInput.value = String(position.investedAmount);
    if (position.calculationMode === "current") {
      currentInput.value = String(Number(position.currentValue || 0));
      interestInput.value = "";
    } else {
      interestInput.value = String(Number(position.interestAmount || 0));
      currentInput.value = "";
    }
    notesInput.value = position.notes || "";
    syncMaturityField(position.type);
    syncCalculationInputs();
    setFormMode(true);
    setStatus("Position wird bearbeitet.");
    strategyNameInput.focus();
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

loadWallets();
loadPositions();
setPage(activePage);
resetFormMode();
render();
updateActiveTableColumns();
updateSortUi();
console.log("DEF-66 wallet rename update loaded");
