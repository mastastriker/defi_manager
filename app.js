const STORAGE_KEY = "defi-dashboard-positions-v1";
const TYPE_LABELS = {
  lending: "Kreditvergabe",
  pendle: "Pendle PT",
  strategy: "Strategie"
};

const VALID_TYPES = new Set(["lending", "pendle", "strategy"]);
const VALID_STATUSES = new Set(["active", "archived"]);

const initialPositions = [
  { id: crypto.randomUUID(), type: "lending", name: "Aave v3 USDC", notional: 910000, yield: 6.2, status: "active", archivedAt: null },
  { id: crypto.randomUUID(), type: "pendle", name: "PT-ETH Dec 2026", notional: 310000, yield: 17.1, status: "active", archivedAt: null },
  { id: crypto.randomUUID(), type: "strategy", name: "Stablecoin-Basis-Loop", notional: 220000, yield: 11.4, status: "active", archivedAt: null }
];

let positions = [];
let activeTab = "all";
let editingPositionId = null;
let activePage = "dashboard";

const form = document.getElementById("position-form");
const typeInput = document.getElementById("position-type");
const nameInput = document.getElementById("position-name");
const notionalInput = document.getElementById("position-notional");
const yieldInput = document.getElementById("position-yield");
const formStatus = document.getElementById("form-status");
const tableBody = document.getElementById("positions-body");
const archivedBody = document.getElementById("archived-body");
const tabs = Array.from(document.querySelectorAll(".tab"));
const pageTabs = Array.from(document.querySelectorAll(".page-tab"));
const pageSections = {
  dashboard: document.getElementById("dashboard-page"),
  archive: document.getElementById("archive-page")
};

const kpiCount = document.getElementById("kpi-count");
const kpiNotional = document.getElementById("kpi-notional");
const kpiYield = document.getElementById("kpi-yield");

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
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

function normalizePosition(entry) {
  const safeType = VALID_TYPES.has(entry?.type) ? entry.type : "lending";
  const safeStatus = VALID_STATUSES.has(entry?.status) ? entry.status : "active";

  return {
    id: typeof entry?.id === "string" && entry.id.length > 0 ? entry.id : crypto.randomUUID(),
    type: safeType,
    name: typeof entry?.name === "string" && entry.name.trim() ? entry.name.trim() : "Unbenannte Position",
    notional: Number.isFinite(Number(entry?.notional)) ? Number(entry.notional) : 0,
    yield: Number.isFinite(Number(entry?.yield)) ? Number(entry.yield) : 0,
    status: safeStatus,
    archivedAt: safeStatus === "archived" && typeof entry?.archivedAt === "string" ? entry.archivedAt : null
  };
}

function loadPositions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    positions = [...initialPositions];
    savePositions();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Stored data is not an array");
    }
    positions = parsed.map(normalizePosition);
  } catch (_error) {
    positions = [...initialPositions];
    savePositions();
  }
}

function savePositions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
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

function updateKpis() {
  const active = activePositions();
  const totalCount = active.length;
  const totalNotional = active.reduce((acc, item) => acc + Number(item.notional || 0), 0);
  const avgYield = totalCount ? active.reduce((acc, item) => acc + Number(item.yield || 0), 0) / totalCount : 0;

  kpiCount.textContent = String(totalCount);
  kpiNotional.textContent = formatCurrency(totalNotional);
  kpiYield.textContent = `${avgYield.toFixed(2)}%`;
}

function filteredActivePositions() {
  const active = activePositions();
  if (activeTab === "all") {
    return active;
  }
  return active.filter((entry) => entry.type === activeTab);
}

function renderActiveTable() {
  const rows = filteredActivePositions();

  if (rows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">In diesem Bereich sind noch keine aktiven Positionen vorhanden.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = rows
    .map((row) => {
      return `
      <tr>
        <td>${TYPE_LABELS[row.type] || row.type}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${formatCurrency(Number(row.notional || 0))}</td>
        <td>${Number(row.yield || 0).toFixed(2)}%</td>
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
  const rows = archivedPositions();

  if (rows.length === 0) {
    archivedBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty">Noch keine archivierten Positionen.</td>
      </tr>
    `;
    return;
  }

  archivedBody.innerHTML = rows
    .map((row) => {
      return `
      <tr>
        <td>${TYPE_LABELS[row.type] || row.type}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${formatCurrency(Number(row.notional || 0))}</td>
        <td>${Number(row.yield || 0).toFixed(2)}%</td>
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

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const next = {
    id: crypto.randomUUID(),
    type: typeInput.value,
    name: nameInput.value.trim(),
    notional: Number(notionalInput.value),
    yield: Number(yieldInput.value),
    status: "active",
    archivedAt: null
  };

  if (!next.name) {
    setStatus("Name ist erforderlich.");
    return;
  }

  if (Number.isNaN(next.notional) || next.notional < 0) {
    setStatus("Der Nominalwert muss eine nicht-negative Zahl sein.");
    return;
  }

  if (Number.isNaN(next.yield)) {
    setStatus("Die Rendite muss eine gueltige Zahl sein.");
    return;
  }

  if (editingPositionId) {
    positions = positions.map((entry) => (entry.id === editingPositionId ? { ...entry, ...next, id: editingPositionId, status: "active", archivedAt: null } : entry));
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
    nameInput.value = position.name;
    notionalInput.value = String(position.notional);
    yieldInput.value = String(position.yield);
    setFormMode(true);
    setStatus("Position wird bearbeitet.");
    nameInput.focus();
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
render();
console.log("DEF-9 dunkles Einseiten-MVP geladen");
