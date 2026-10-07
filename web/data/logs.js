const API_BASE = "https://5eifrv56p8.execute-api.ap-southeast-2.amazonaws.com";
let LOG_DATE_STRING = new Date().toISOString().split("T")[0]; // Default to today (the UTC date, as on the live and bulk pages)

// Utility to parse URL parameters
function getUrlParameter(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// The day being shown: ?date=YYYY-MM-DD if given and valid, otherwise today.
function resolveLogDate() {
  const urlDate = getUrlParameter("date");
  if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
    LOG_DATE_STRING = urlDate;
  }
  return LOG_DATE_STRING;
}
document.getElementById("logDate").textContent = resolveLogDate();

async function fetchLogs() {
  resolveLogDate();
  const response = await fetch(`${API_BASE}/log?activity_id=sorrento_youth_sunday&date=${encodeURIComponent(LOG_DATE_STRING)}`);
  const data = await response.json();
  const tableBody = document.querySelector("#logTable tbody");
  tableBody.innerHTML = "";

  data.logs.forEach(log => {
    const row = document.createElement("tr");
    [log.name_id, log.direction, log.date_time].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    tableBody.appendChild(row);
  });
  document.getElementById("logsStatus").textContent = `${data.logs.length} entries for ${LOG_DATE_STRING}`;
}

async function submitLog(event) {
  event.preventDefault();
  const form = document.getElementById("addLogForm");
  const name_id = form.name_id.value.trim();
  const direction = form.direction.value;
  const date_time = form.date_time.value.trim();

  const payload = {
    activity_id: "sorrento_youth_sunday",
    name_id: name_id,
    direction: direction,
    date_time: date_time
  };

  try {
    const response = await fetch(`${API_BASE}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    document.getElementById("message").textContent = result.message || "Log added";
    if (response.status === 201) {
      fetchLogs(); // Refresh table
    }
  } catch (err) {
    document.getElementById("message").textContent = "Error submitting log";
    console.error(err);
  }
}

document.getElementById("fetchLogsButton").addEventListener("click", fetchLogs);
document.getElementById("addLogForm").addEventListener("submit", submitLog);
