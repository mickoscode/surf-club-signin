// Leader bulk sign-in / sign-out page. Shared helpers and per-site settings are in common.js.

loadMenu();

let LOG_DATE_STRING = new Date().toISOString().split('T')[0]; // Default to today

const messageEl = document.getElementById("message");
const formEl = document.getElementById("bulkForm");
const spinnerEl = document.getElementById("spinner");
const directionInputEl = document.getElementById("direction");
const activityInputEl = document.getElementById("activity_id");
const submitButton = document.getElementById("bulkSubmitButton");

let names = [];
let logs = [];

// Fetch names from the backend and populate global array
async function fetchNames() {
    const data = await getJson("/name", { activity_id: ACTIVITY_ID });
    names = data.names || [];
}

// Fetch logs from the backend
async function fetchLogs() {
    const data = await getJson("/log", { activity_id: ACTIVITY_ID, date: LOG_DATE_STRING });
    logs = data.logs || [];
}

// Add bulk log entries to the backend
async function addBulkLogs(payload) {
    return postJson("/bulk", payload);
}


// Show the chosen group's rows (and its name in the message line)
function selectGroup(filter) {
    messageEl.textContent = filter === "all" ? "All" : filter; // the button says "All", so the heading does too
    filterTable(filter);
}

// Initialize the page
async function init() {
    const { now, inStart: IN_START_TIME, outStart: OUT_START_TIME, end: END_TIME } = getSessionWindow();

    if (!isSunday() || now > END_TIME) {
        messageEl.textContent = `The next session is ${getNextSunday()}`;
        return;
    }

    if (now < IN_START_TIME) {
        messageEl.textContent = `Sign in starts at ${formatClock(IN_START_TIME)}`;
        return;
    }

    let verified_direction = "in";
    if (now >= OUT_START_TIME && now < END_TIME) {
        verified_direction = "out";
    }

    messageEl.textContent = `Select a group for bulk sign-${verified_direction}`;
    await fetchNames(); //populates global names[]
    await fetchLogs();  //populates global logs[]
    renderFilterButtons(names, selectGroup);
    setupBulkForm(verified_direction);
    return;
}

// Setup the form for BULK sign-in or sign-out
async function setupBulkForm(direction) {
    submitButton.disabled = false; // (re-)enable button
    submitButton.textContent = direction === "in" ? "Bulk Sign In" : "Bulk Sign Out";
    formEl.classList.remove("hidden");
    directionInputEl.value = direction;

    const tbody = document.querySelector("#namesTable tbody");
    tbody.innerHTML = "";
  
    names.forEach(name => {
        const name_id = name.name_id;
        const row = document.createElement("tr");
        row.classList.add(`filter-${name.filter || "no-filter"}`);  // this enables filter buttons
    
        // Column 1: Display name & hidden input for name_id
        const nameCell = document.createElement("td");
        nameCell.textContent = name.display;
  
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.value = name_id;
        hiddenInput.classList.add("name-id");
        nameCell.appendChild(hiddenInput);
        row.appendChild(nameCell);

        // Column 2: In  [time if in-log found / checkbox if direction=in / - if direction=out] 
        const inCell = document.createElement("td");
        const matchIn = logs.find(
            log => log.name_id === name_id && log.direction === "in"
        );

        if (matchIn) {
            inCell.textContent = convertTs2Time(matchIn.date_time);
        } else if (direction === "in") {
            const toggle = document.createElement("input");
            toggle.type = "checkbox";
            toggle.classList.add("name-toggle");
            toggle.dataset.nameId = name.name_id;
            inCell.appendChild(toggle);
        } else {
            inCell.textContent = "-";
        }
        row.appendChild(inCell);

        // Column 3: Out  [time if out-log found / checkbox if direction=out AND matchIn / - if direction=in] 
        const outCell = document.createElement("td");
        const matchOut = logs.find(
            log => log.name_id === name.name_id && log.direction === "out"
        );

        if (matchOut) {
            outCell.textContent = convertTs2Time(matchOut.date_time);
        } else if (direction === "out") {
            if (matchIn) {
                const toggle = document.createElement("input");
                toggle.type = "checkbox";
                toggle.classList.add("name-toggle");
                toggle.dataset.nameId = name.name_id;
                outCell.appendChild(toggle);
            } else {
                outCell.textContent = "-";
            }
        } else {
          outCell.textContent = "-";
        }
        row.appendChild(outCell);

        // Initially hide all rows; they will be shown when a filter button is clicked
        row.classList.add("hidden");

        tbody.appendChild(row);
    });
}

// Timestamp for the current bulk submission; kept across retries after a failure
let bulkDateTime = null;

// Handle form submission
formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    spinnerEl.classList.remove("hidden");

    const direction = directionInputEl.value;
    const activity_id = activityInputEl.value;
    const toggles = document.querySelectorAll(".name-toggle");
    const listOfNameId = [];

    toggles.forEach(toggle => {
      if (toggle.checked) {
        listOfNameId.push(toggle.dataset.nameId);
      }
    });

    if (listOfNameId.length === 0) {
      messageEl.textContent = "No names selected for submission"; 
      spinnerEl.classList.add("hidden");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Reuse the same timestamp when retrying a failed submission, so names that were already
    // written are recognised as duplicates (log_id includes the timestamp) and skipped, not logged twice.
    bulkDateTime = bulkDateTime || new Date().toISOString();

    try {
      const result = await addBulkLogs({
        activity_id: activity_id,
        direction: direction,
        name_id_list: listOfNameId,
        date_time: bulkDateTime
      });

      const skipped = (result.skipped || []).length;
      messageEl.textContent = "Bulk submission completed" +
        (skipped ? ` (${skipped} already recorded)` : "");
      submitButton.disabled = true;
    } catch (error) {
      // button stays enabled so the manager can retry (same timestamp, so already-written names are skipped)
      messageEl.textContent = "Bulk submission failed: " + error.message;
      alert("Error: " + error.message);
    } finally {
      spinnerEl.classList.add("hidden");
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Initialize the page on load
(async () => { await init(); })();