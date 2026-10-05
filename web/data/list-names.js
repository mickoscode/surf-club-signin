const API_BASE = "https://5eifrv56p8.execute-api.ap-southeast-2.amazonaws.com";
const VALID_ACTIVITY_ID = [
  "sorrento_youth_sunday",
  "demo"
];
//const DEFAULT_ACTIVITY_ID = "sorrento_youth_sunday";
const DEFAULT_ACTIVITY_ID = "demo";

const params = new URLSearchParams(window.location.search);
activity_id = params.get("activity_id");
if (!VALID_ACTIVITY_ID.includes(activity_id)) {
  activity_id = DEFAULT_ACTIVITY_ID;
}
document.getElementById("activityName").textContent = activity_id;

async function fetchNames() {
  const response = await fetch(`${API_BASE}/name?activity_id=${encodeURIComponent(activity_id)}`);
  const data = await response.json();
  const tableBody = document.querySelector("#namesTable tbody");
  tableBody.innerHTML = "";

  data.names.forEach(name => {
    const row = document.createElement("tr");
    [name.display, name.name_id, name.filter].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    tableBody.appendChild(row);
  });
}

document.getElementById("fetchNamesButton").addEventListener("click", fetchNames);
