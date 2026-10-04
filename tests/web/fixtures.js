const { XSS } = require("./helpers");

const names = [
  { activity_id: "demo", name_id: "alice", display: "Alice Smith", filter: "u14" },
  { activity_id: "demo", name_id: "evil", display: XSS, filter: "u15" },
  { activity_id: "demo", name_id: "bob", display: "Bob (b) [x]", filter: "u14" },
];

const logs = [
  { name_id: "alice", direction: "in", date_time: "2025-08-12T08:05:00Z" },
  { name_id: "alice", direction: "out", date_time: "2025-08-12T09:40:00Z" },
  { name_id: "evil", direction: "in", date_time: "2025-08-12T08:06:00Z" },
];

// Standard read-only API: names, dates, a day's logs, one person's logs.
function readApi(url) {
  if (url.includes("/name?")) return { names };
  if (url.includes("/date?")) return { dates: ["2025-08-12", XSS] };
  if (url.includes("/userlog?")) return { logs: logs.filter((l) => l.name_id === "alice") };
  if (url.includes("/log?")) return { logs };
  return {};
}

module.exports = { names, logs, readApi };
