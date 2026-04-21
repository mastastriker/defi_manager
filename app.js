const STORAGE_KEY = "defi-dashboard-positions-v1";

const initialPositions = [
  { id: crypto.randomUUID(), type: "lending", name: "Aave v3 USDC", notional: 910000, yield: 6.2 },
  { id: crypto.randomUUID(), type: "pendle", name: "PT-ETH Dec 2026", notional: 310000, yield: 17.1 },
  { id: crypto.randomUUID(), type: "strategy", name: "Stablecoin basis loop", notional: 220000, yield: 11.4 }
];

let positions = [];
let activeTab = "all";

const form = document.getElementById("position-form");
const typeInput = document.getElementById("position-type");
const nameInput = document.getElementById("position-name");
const notionalInput = document.getElementById("position-notional");
const yieldInput = document.getElementById("position-yield");
const formStatus = document.getElementById("form-status");
const tableBody = document.getElementById("positions-body");
const tabs = Array.from(document.querySelectorAll(".tab"));

const kpiCount = document.getElementById("kpi-count");
const kpiNotional = document.getElementById("kpi-notional");
const kpiYield = document.getElementById("kpi-yield");

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
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
    positions = parsed;
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

function updateKpis() {
  const totalCount = positions.length;
  const totalNotional = positions.reduce((acc, item) => acc + Number(item.notional || 0), 0);
  const avgYield = totalCount
    ? positions.reduce((acc, item) => acc + Number(item.yield || 0), 0) / totalCount
    : 0;

  kpiCount.textContent = String(totalCount);
  kpiNotional.textContent = formatCurrency(totalNotional);
  kpiYield.textContent = `${avgYield.toFixed(2)}%`;
}

function filteredPositions() {
  if (activeTab === "all") {
    return positions;
  }
  return positions.filter((entry) => entry.type === activeTab);
}

function renderTable() {
  const rows = filteredPositions();

  if (rows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">No positions in this section yet.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = rows
    .map((row) => {
      return `
      <tr>
        <td>${row.type}</td>
        <td>${row.name}</td>
        <td>${formatCurrency(Number(row.notional || 0))}</td>
        <td>${Number(row.yield || 0).toFixed(2)}%</td>
        <td>
          <button type="button" class="delete-btn" data-id="${row.id}">Delete</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function render() {
  updateKpis();
  renderTable();
}

function setActiveTab(nextTab) {
  activeTab = nextTab;
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === nextTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  renderTable();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.tab);
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const next = {
    id: crypto.randomUUID(),
    type: typeInput.value,
    name: nameInput.value.trim(),
    notional: Number(notionalInput.value),
    yield: Number(yieldInput.value)
  };

  if (!next.name) {
    setStatus("Name is required.");
    return;
  }

  if (Number.isNaN(next.notional) || next.notional < 0) {
    setStatus("Notional must be a non-negative number.");
    return;
  }

  if (Number.isNaN(next.yield)) {
    setStatus("Yield must be a valid number.");
    return;
  }

  positions.unshift(next);
  savePositions();
  render();

  form.reset();
  typeInput.value = "lending";
  setStatus("Position saved to browser localStorage.");
});

tableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("delete-btn")) {
    return;
  }

  const id = target.dataset.id;
  positions = positions.filter((entry) => entry.id !== id);
  savePositions();
  render();
  setStatus("Position removed.");
});

loadPositions();
render();
console.log("DEF-9 dark single-page MVP loaded");