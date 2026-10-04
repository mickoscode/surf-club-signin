// History page. Shared helpers and per-site settings are in common.js.

let names = [];  // get valid names to filter out any junk logs!
let dates = [];
let logs = [];

// By default, this page will be loaded via age-manger view, so will use the leader.snippet
// But if we want the users (youth & nippers) to access the history page, then the basic header.snippet should be used.
const SOURCE = getUrlParameter("source");
const headerSnippet = SOURCE === "user" ? './header.snippet' : './header_leader.snippet';
loadHeader(headerSnippet);


// Fetch names from the backend
async function fetchNames() {
    const data = await getJson("/name", { activity_id: ACTIVITY_ID });
    names = data.names || [];
}

// Fetch list of dates from the backend
async function fetchDates() {
    const data = await getJson("/date", { activity_id: ACTIVITY_ID });
    dates = data.dates || [];
}

// Fetch logs from the backend
async function fetchLogs(dateString) {
    const data = await getJson("/log", { activity_id: ACTIVITY_ID, date: dateString });
    logs = data.logs || [];
}
// Fetch logs for a specific user from the backend
async function fetchUserLogs(name_id) {
    const data = await getJson("/userlog", { activity_id: ACTIVITY_ID, name_id: name_id });
    logs = data.logs || [];
}

// My log cleaning function to build table records for specific user!
function micksUserLogRowObject() {
    const tr = {};
    logs.forEach(log => {
        const ymd = convertTs2YMD(log.date_time);

        // initialise table row if not already done :)
        if (!tr[ymd]) {
            tr[ymd] = {
                ymd: ymd,
                in: "-",
                out: "-"
            };
        }

        if (log.direction === "in") {
            tr[ymd].in = log.date_time;
        } else if (log.direction === "out") {
            tr[ymd].out = log.date_time;
        }
    });

    return tr;
}

// Initialize the page
async function init() {
    const testDate = getUrlParameter("date");
    const url_name_id = getUrlParameter("name_id");
    const messageEl = document.getElementById("message");

    if (testDate && /^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
        messageEl.textContent = testDate;

        await fetchNames(); // populates global 'names'
        await fetchLogs(testDate); // populates global 'logs'

        renderFilterButtons(names, filterTable);
        const tableData = buildLogRows(names, logs);

        const tbody = document.getElementById("recordsTable");
        tbody.innerHTML = `
            <thead>
              <tr><th>name</th><th>in</th><th>out</th></tr>
            </thead>
            <tbody></tbody>`;

        Object.values(tableData).forEach(row => {
            const tr = document.createElement("tr");
            tr.classList.add(`filter-${row.f}`);

            const tdDisplay = document.createElement("td");
            const link = document.createElement("a");
            link.href = `./history.html?source=user&name_id=${encodeURIComponent(row.name_id)}`;
            link.textContent = row.d;
            tdDisplay.appendChild(link);
            tr.appendChild(tdDisplay);

            const tdIn = document.createElement("td");
            tdIn.textContent = convertTs2Time(row.in);
            tr.appendChild(tdIn);

            const tdOut = document.createElement("td");
            tdOut.textContent = convertTs2Time(row.out);
            tr.appendChild(tdOut);

            tbody.appendChild(tr);
        });

    } else if (url_name_id && /^[a-z0-9_]+$/.test(url_name_id)) {

        await fetchNames(); // populates global 'names'
        const name = names.find(n => n.name_id === url_name_id);
        if (!name) {
            messageEl.textContent = "Name not found";
            return;
        }
        messageEl.textContent = "History for " + name.display;

        await fetchUserLogs(url_name_id); // populates global 'logs' with all logs for activity & name
        const tableData = micksUserLogRowObject();

        const tbody = document.getElementById("recordsTable");
        tbody.innerHTML = `
            <thead>
              <tr><th>date</th><th>in</th><th>out</th></tr>
            </thead>
            <tbody></tbody>`;

        Object.values(tableData).forEach(row => {
            const tr = document.createElement("tr");

            const tdDate = document.createElement("td");
            tdDate.textContent = row.ymd;
            tr.appendChild(tdDate);

            const tdIn = document.createElement("td");
            tdIn.textContent = convertTs2Time(row.in);
            tr.appendChild(tdIn);

            const tdOut = document.createElement("td");
            tdOut.textContent = convertTs2Time(row.out);
            tr.appendChild(tdOut);

            tbody.appendChild(tr);
        });

    } else {

        messageEl.textContent = "History Available";
        await fetchDates(); // populates global 'dates'
        const dateList = document.getElementById('dateList');
        dateList.textContent = "";
        dates
            .sort((a, b) => b.localeCompare(a)) // descending order
            .forEach(date => {
                const link = document.createElement("a");
                link.href = `./history.html?date=${encodeURIComponent(date)}`;
                link.textContent = date;
                dateList.appendChild(link);
                dateList.appendChild(document.createElement("br"));
            });
    }
}

// Initialize the page on load
(async () => { await init(); })();