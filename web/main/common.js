// Helpers shared by every templated page (index, bulk, live, history).
// Loaded with a plain <script src="common.js"> before the page's own script, so everything here is a global.
//
// Per-site settings come from data-* attributes on <body> (written by inject-config.js from config.json):
//   data-api-url, data-activity-id, data-test-mode ("true" enables the test/demo behaviour)

const API_BASE = document.body.dataset.apiUrl;
const ACTIVITY_ID = document.body.dataset.activityId;
const ENABLE_TEST_MODE = document.body.dataset.testMode === "true";

// The sign-in window. Kept in one place; the demo site overrides it with ?test=in / ?test=out.
const SESSION_TIMES = { inStart: "08:00", outStart: "09:30", end: "11:00" };

// ---------------------------------------------------------------------------
// Page chrome
// ---------------------------------------------------------------------------

// Load a menu snippet into #header-container. A snippet that fails to load is not inserted: CloudFront answers a
// missing file with the 404 page (a whole HTML document, status 404), which would otherwise end up inside the menu bar.
function loadHeader(snippetPath) {
    fetch(snippetPath)
        .then(response => {
            if (!response.ok) throw new Error(`${snippetPath} returned HTTP ${response.status}`);
            return response.text();
        })
        .then(data => {
            document.getElementById("header-container").innerHTML = data;
            useMenuFavicon();
        })
        .catch(error => console.error("Header load error:", error));
}

// Which menu a page shows: "user" (people signing in/out: header.snippet) or "leader" (age managers:
// header_leader.snippet). The links in the menus carry ?source=user / ?source=leader so the choice survives
// moving between pages; anything else falls back to the page's own default.
function getMenuSource(defaultSource) {
    const source = getUrlParameter("source");
    return source === "user" || source === "leader" ? source : defaultSource;
}

function loadMenu(source) {
    loadHeader(source === "user" ? "./header.snippet" : "./header_leader.snippet");
}

// A menu file can name its own tab icon with data-favicon on its top element. The youth site's age manager menu does
// (favicon-am.png), so age manager tabs look different from youth tabs, whichever page they are on. A menu without it
// leaves the page's own icon (the site's INJECT_FAVICON) alone.
function useMenuFavicon() {
    const menu = document.querySelector("#header-container [data-favicon]");
    const link = document.querySelector('link[rel="icon"]');
    if (menu && link) link.setAttribute("href", menu.dataset.favicon);
}

// Utility to parse URL parameters
function getUrlParameter(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// ---------------------------------------------------------------------------
// Dates and times
// ---------------------------------------------------------------------------

// Utility to convert human readable time strings (e.g. "08:00") to a Date object for today.
function convertTimeStringToDateObj(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    const now = new Date();
    now.setHours(hours, minutes, 0, 0);
    return now;
}

// Today's sign-in window: { now, inStart, outStart, end }.
// In test mode, ?test=in or ?test=out moves the window around the current time so a page can be tried at any hour.
function getSessionWindow() {
    const now = new Date();
    let inStart = convertTimeStringToDateObj(SESSION_TIMES.inStart);
    let outStart = convertTimeStringToDateObj(SESSION_TIMES.outStart);
    let end = convertTimeStringToDateObj(SESSION_TIMES.end);

    if (ENABLE_TEST_MODE) {
        const minutes = (n) => new Date(now.getTime() + n * 60 * 1000);
        const testParam = getUrlParameter("test");
        if (testParam === "in") {
            inStart = minutes(-10);
            outStart = minutes(10);
            end = minutes(20);
        }
        if (testParam === "out") {
            inStart = minutes(-20);
            outStart = minutes(-10);
            end = minutes(20);
        }
    }
    return { now, inStart, outStart, end };
}

// Utility to check if today is Sunday (always true in test mode)
function isSunday() {
    if (ENABLE_TEST_MODE) {
        return true;
    }
    return new Date().getDay() === 0;
}

// Utility to calculate the next Sunday, as a display string
function getNextSunday() {
    const now = new Date();
    let daysUntilSunday = (7 - now.getDay()) % 7;
    // if today is sunday, then it will be 7 days to next sunday.
    daysUntilSunday = daysUntilSunday === 0 ? 7 : daysUntilSunday;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    return nextSunday.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// convert timestamp string to HH:MM format
function convertTs2Time(timestamp) {
    if (!timestamp || timestamp === "-") return "-";
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

// convert timestamp string to yyyy-mm-dd format
function convertTs2YMD(timestamp) {
    if (!timestamp || timestamp === "-") return "-";
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

// Build an API URL, URL-encoding every query value.
function apiUrl(path, params = {}) {
    const query = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");
    return `${API_BASE}${path}${query ? "?" + query : ""}`;
}

// GET a JSON document (no status check: callers fall back to empty lists, as before).
async function getJson(path, params) {
    const response = await fetch(apiUrl(path, params));
    return response.json();
}

// POST a JSON payload. Surfaces API errors (4xx/5xx, including HTTP 429 when throttled) as thrown
// Errors with a readable message, instead of treating them as success.
async function postJson(path, payload) {
    const response = await fetch(apiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    let data = {};
    try {
        data = await response.json();
    } catch (_) {
        // non-JSON error body
    }
    if (!response.ok) {
        if (response.status === 429) {
            throw new Error("Too many requests right now, please wait a moment and try again.");
        }
        throw new Error(data.message || `Request failed (HTTP ${response.status})`);
    }
    return data;
}

// ---------------------------------------------------------------------------
// Names, logs and filter buttons
// ---------------------------------------------------------------------------

// One record per person who has a log, with their latest "in" and "out" timestamps.
// Logs for names that are not in the names list are skipped (junk logs).
function buildLogRows(names, logs) {
    const rows = {};
    logs.forEach(log => {
        const name = names.find(n => n.name_id === log.name_id);
        if (!name) return; // skip if name not found

        // initialise table row if not already done
        if (!rows[log.name_id]) {
            rows[log.name_id] = {
                name_id: log.name_id,
                d: name.display,
                f: name.filter || "default",
                in: "-",
                out: "-"
            };
        }

        if (log.direction === "in") {
            rows[log.name_id].in = log.date_time;
        } else if (log.direction === "out") {
            rows[log.name_id].out = log.date_time;
        }
    });
    return rows;
}

// Render "All" plus one button per filter (age group) into #filterButtons. onSelect(filter) runs on click.
function renderFilterButtons(names, onSelect) {
    const filters = Array.from(new Set(names.map(name => name.filter))).sort();
    const buttonsContainer = document.getElementById("filterButtons");
    buttonsContainer.innerHTML = "";

    // Add "all" button
    const allButton = document.createElement("button");
    allButton.textContent = "All";
    allButton.onclick = () => onSelect("all");
    buttonsContainer.appendChild(allButton);

    // Add filter-specific buttons
    filters.forEach(filter => {
        const button = document.createElement("button");
        button.textContent = filter;
        button.onclick = () => onSelect(filter);
        buttonsContainer.appendChild(button);
    });
}

// Show only the table rows (class "filter-<name>") matching filter; "all" shows everything.
function filterTable(filter) {
    const allRows = document.querySelectorAll("[class^='filter-']");
    allRows.forEach(row => row.classList.remove("hidden"));

    if (filter !== "all") {
        allRows.forEach(row => {
            if (!row.classList.contains(`filter-${filter}`)) {
                row.classList.add("hidden");
            }
        });
    }
}
