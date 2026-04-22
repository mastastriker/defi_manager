const STORAGE_KEYS = {
  primary: "defi-dashboard-positions-v2",
  legacy: "defi-dashboard-positions-v1",
  backup: "defi-dashboard-positions-backup-v1"
};
const STORAGE_VERSION = 2;

const TYPE_LABELS = {
  lending: "Kreditvergabe",
  pendle: "Pendle PT",
  strategy: "Strategie"
};

const VALID_TYPES = new Set(["lending", "pendle", "strategy"]);
const VALID_STATUSES = new Set(["active", "archived"]);

const initialPositions = [
  {
    id: crypto.randomUUID(),
    type: "lending",
    date: "2026-01-10",
    wallet: "Ledger 1",
    chain: "ETH",
    projectName: "Aave",
    strategyName: "USDC Lending Core",
    investedAmount: 910000,
    interestAmount: 18000,
    currentValue: 928000,
    notes: "Blue-chip lending baseline",
    status: "active",
    archivedAt: null
  },
  {
    id: crypto.randomUUID(),
    type: "pendle",
    date: "2026-02-14",
    wallet: "Safe Treasury",
    chain: "ARB",
    projectName: "Pendle",
    strategyName: "PT-ETH Dec 2026",
    investedAmount: 310000,
    interestAmount: 24500,
    currentValue: 334500,
    notes: "Seasonal convexity thesis",
    status: "active",
    archivedAt: null
  },
  {
    id: crypto.randomUUID(),
    type: "strategy",
    date: "2026-03-02",
    wallet: "Hot Wallet",
    chain: "BASE",
    projectName: "Morpho",
    strategyName: "Stablecoin Basis Loop",
    investedAmount: 220000,
    interestAmount: 9500,
    currentValue: 229500,
    notes: "Low-vol carry",
    status: "active",
    archivedAt: null
  }
];

let positions = [];
let activeTab = "all";
let editingPositionId = null;
let activePage = "dashboard";
const sortState = {
  active: { key: null, direction: "asc" },
  archive: { key: null, direction: "asc" }
};

const form = document.getElementById("position-form");
const typeInput = document.getElementById("position-type");
const dateInput = document.getElementById("position-date");
const walletInput = document.getElementById("position-wallet");
const chainInput = document.getElementById("position-chain");
const projectInput = document.getElementById("position-project");
const strategyNameInput = document.getElementById("position-strategy-name");
const investedInput = document.getElementById("position-invested");
const interestInput = document.getElementById("position-interest");
const notesInput = document.getElementById("position-notes");
const formStatus = document.getElementById("form-status");
const tableBody = document.getElementById("positions-body");
const archivedBody = document.getElementById("archived-body");
const tabs = Array.from(document.querySelectorAll(".tab"));
const pageTabs = Array.from(document.querySelectorAll(".page-tab"));
const sortableHeaders = Array.from(document.querySelectorAll("th[data-sort-table][data-sort-key]"));
const pageSections = {
  dashboard: document.getElementById("dashboard-page"),
  archive: document.getElementById("archive-page")
};

const kpiCount = document.getElementById("kpi-count");
const kpiCurrent = document.getElementById("kpi-current");
const kpiApy = document.getElementById("kpi-apy");

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

function formatDate(value) {
  const parsed = parsePositionDate(value);
  if (!parsed) {
    return "-";
  }
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium"
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
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function normalizePosition(entry) {
  const safeType = VALID_TYPES.has(entry?.type) ? entry.type : "lending";
  const safeStatus = VALID_STATUSES.has(entry?.status) ? entry.status : "active";
  const normalizedDate = typeof entry?.date === "string" && parsePositionDate(entry.date) ? entry.date : new Date().toISOString().slice(0, 10);
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
  const normalizedInterest = Number.isFinite(Number(entry?.interestAmount))
    ? Number(entry.interestAmount)
    : Number.isFinite(Number(entry?.interest))
      ? Number(entry.interest)
      : Math.max(0, normalizedCurrent - normalizedInvested);
  const computedCurrent = normalizedInvested + normalizedInterest;

  return {
    id: typeof entry?.id === "string" && entry.id.length > 0 ? entry.id : crypto.randomUUID(),
    type: safeType,
    date: normalizedDate,
    wallet: typeof entry?.wallet === "string" && entry.wallet.trim() ? entry.wallet.trim() : "Main Wallet",
    chain: typeof entry?.chain === "string" && entry.chain.trim() ? entry.chain.trim().toUpperCase() : "ETH",
    projectName: typeof entry?.projectName === "string" && entry.projectName.trim() ? entry.projectName.trim() : TYPE_LABELS[safeType],
    strategyName:
      typeof entry?.strategyName === "string" && entry.strategyName.trim()
        ? entry.strategyName.trim()
        : typeof entry?.name === "string" && entry.name.trim()
          ? entry.name.trim()
          : "Unbenannte Position",
    investedAmount: normalizedInvested,
    interestAmount: normalizedInterest,
    currentValue: computedCurrent,
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

function computeApyAnnual(entry) {
  const invested = Number(entry.investedAmount || 0);
  const current = Number(entry.currentValue || 0);
  const startDate = parsePositionDate(entry.date);

  if (invested <= 0 || current <= 0 || !startDate) {
    return 0;
  }

  const now = new Date();
  const elapsedMs = now.getTime() - startDate.getTime();
  const elapsedDays = Math.max(1, elapsedMs / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) {
    return 0;
  }

  const growthFactor = current / invested;
  if (growthFactor <= 0) {
    return 0;
  }

  const annualized = (Math.pow(growthFactor, 365 / elapsedDays) - 1) * 100;
  if (!Number.isFinite(annualized)) {
    return 0;
  }

  return Math.max(-100, Math.min(annualized, 10000));
}

function computeMonthlyCashflow(entry) {
  return (Number(entry.currentValue || 0) * computeApyAnnual(entry)) / 100 / 12;
}

function roiDisplay(entry) {
  const roiPercent = computeRoiPercent(entry);
  const roiUsd = computeRoiUsd(entry);
  return `${formatPercent(roiPercent)} (${formatCurrency(roiUsd)})`;
}

function updateKpis() {
  const active = activePositions();
  const totalCount = active.length;
  const totalCurrentValue = active.reduce((acc, item) => acc + Number(item.currentValue || 0), 0);
  const avgApy = totalCount ? active.reduce((acc, item) => acc + computeApyAnnual(item), 0) / totalCount : 0;

  kpiCount.textContent = String(totalCount);
  kpiCurrent.textContent = formatCurrency(totalCurrentValue);
  kpiApy.textContent = formatPercent(avgApy);
}

function filteredActivePositions() {
  const active = activePositions();
  if (activeTab === "all") {
    return active;
  }
  return active.filter((entry) => entry.type === activeTab);
}

function getSortValue(entry, key) {
  switch (key) {
    case "date": {
      const parsedDate = parsePositionDate(entry.date);
      return parsedDate ? parsedDate.getTime() : 0;
    }
    case "wallet":
    case "chain":
    case "projectName":
    case "strategyName":
    case "notes":
      return String(entry[key] || "");
    case "investedAmount":
    case "currentValue":
    case "interestAmount":
      return Number(entry[key] || 0);
    case "roiPercent":
      return computeRoiPercent(entry);
    case "monthlyCashflow":
      return computeMonthlyCashflow(entry);
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

  if (rows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="13" class="empty">In diesem Bereich sind noch keine aktiven Positionen vorhanden.</td>
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
        <td>${formatPercent(computeApyAnnual(row))}</td>
        <td>${escapeHtml(row.notes || "-")}</td>
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
  renderActiveTable();
  renderArchivedTable();
}

function setActiveTab(nextTab) {
  activeTab = nextTab;
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === nextTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
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
  typeInput.value = "lending";
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  setFormMode(false);
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

  const next = {
    id: crypto.randomUUID(),
    type: typeInput.value,
    date: dateInput.value,
    wallet: walletInput.value.trim(),
    chain: chainInput.value.trim().toUpperCase(),
    projectName: projectInput.value.trim(),
    strategyName: strategyNameInput.value.trim(),
    investedAmount: Number(investedInput.value),
    interestAmount: Number(interestInput.value || 0),
    notes: notesInput.value.trim(),
    status: "active",
    archivedAt: null
  };

  next.currentValue = next.investedAmount + next.interestAmount;

  if (!parsePositionDate(next.date)) {
    setStatus("Datum ist erforderlich.");
    return;
  }

  if (!next.strategyName) {
    setStatus("Name der Strategie ist erforderlich.");
    return;
  }

  if (Number.isNaN(next.investedAmount) || next.investedAmount < 0) {
    setStatus("Der eingezahlte Betrag muss eine nicht-negative Zahl sein.");
    return;
  }

  if (Number.isNaN(next.interestAmount) || next.interestAmount < 0) {
    setStatus("Zinsen müssen eine nicht-negative Zahl sein.");
    return;
  }

  next.wallet = next.wallet || "Main Wallet";
  next.chain = next.chain || "ETH";
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
    typeInput.value = position.type;
    dateInput.value = position.date;
    walletInput.value = position.wallet;
    chainInput.value = position.chain;
    projectInput.value = position.projectName;
    strategyNameInput.value = position.strategyName;
    investedInput.value = String(position.investedAmount);
    interestInput.value = String(Number(position.interestAmount || 0));
    notesInput.value = position.notes || "";
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

loadPositions();
setPage(activePage);
resetFormMode();
render();
updateSortUi();
console.log("DEF-31 required column + editability update loaded");
