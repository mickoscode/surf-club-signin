// Live counter page (leaders). Shared helpers and per-site settings are in common.js.

loadMenu("leader");

let LOG_DATE_STRING = new Date().toISOString().split('T')[0]; // Default to today
let uniqueTotalCount = 0;
let uniqueOutCount = 0;
let liveTotal = 0;
let names = [];
let logs = [];

// Fetch names from the backend
async function fetchNames() {
    const data = await getJson("/name", { activity_id: ACTIVITY_ID });
    names = data.names || [];
}

// Fetch logs from the backend
async function fetchLogs() {
    const data = await getJson("/log", { activity_id: ACTIVITY_ID, date: LOG_DATE_STRING });
    logs = data.logs || [];
    //setTimeout(fetchLogs, 30000); // every 30 seconds
}


// Calculate live total
function calculateLiveTotal() {
    const validNameIds = new Set(names.map(name => name.name_id));
    const validLogs = logs.filter(log => validNameIds.has(log.name_id));
    uniqueTotalCount = new Set(validLogs.map(log => log.name_id)).size;
    uniqueOutCount = new Set(validLogs.filter(log => log.direction === "out").map(log => log.name_id)).size;
    return Math.max(0, uniqueTotalCount - uniqueOutCount); // use max to prevent negative count
}

// Update live total display using global var liveTotal
function updateLiveTotalDisplay() {
    const timeString = convertTs2Time(new Date());
    document.getElementById("liveTotal").textContent = liveTotal;
    document.getElementById("liveMessage").textContent = `live count as of ${timeString}`;
}

// Initialize the page
async function init() {
    if (ENABLE_TEST_MODE) {
        const testDate = getUrlParameter("date");
        if (testDate && /^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
            LOG_DATE_STRING = testDate;
        }
    }

    if (!isSunday()) {
        document.getElementById("liveTotal").textContent = "";
        document.getElementById("liveMessage").textContent = `The next session is ${getNextSunday()}`;
        return;
    }

    await fetchNames();
    await fetchLogs();
    liveTotal = calculateLiveTotal();
    updateLiveTotalDisplay();
    renderFilterButtons(names, filterTable);

    const tableData = buildLogRows(names, logs);

    const tbody = document.getElementById("recordsTable");
    tbody.innerHTML = `
        <thead>
          <tr><th>name</th><th>in (${uniqueTotalCount})</th><th>out (${uniqueOutCount})</th></tr>
        </thead>
        <tbody></tbody>`;

    Object.values(tableData).forEach(row => {
        const tr = document.createElement("tr");
        tr.classList.add(`filter-${row.f}`);

        const tdDisplay = document.createElement("td");
        tdDisplay.textContent = row.d;
        tr.appendChild(tdDisplay);

        const tdIn = document.createElement("td");
        tdIn.textContent = convertTs2Time(row.in);
        tr.appendChild(tdIn);

        const tdOut = document.createElement("td");
        tdOut.textContent = convertTs2Time(row.out);
        tr.appendChild(tdOut);

        tbody.appendChild(tr);
    });
}

(async () => { await init(); })();