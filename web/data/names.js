const API_BASE = "https://5eifrv56p8.execute-api.ap-southeast-2.amazonaws.com";
const VALID_ACTIVITY_ID = [
  "sorrento_youth_sunday",
  "demo"
];
const DEFAULT_ACTIVITY_ID = "sorrento_youth_sunday";
const VALID_FILTER = ["u14", "u15", "u17", "u19"];

document.addEventListener("DOMContentLoaded", async () => {
  const messageEl = document.getElementById("message");
  const params = new URLSearchParams(window.location.search);
  const activity_id = params.get("activity_id");
  const name_id = params.get("name_id");
  const filter = params.get("filter");

  if (activity_id && name_id && filter) {
    await renderEditForm(activity_id, name_id, filter);
  } else {
    renderAddForm(messageEl);
    const names = (await fetchNames(DEFAULT_ACTIVITY_ID)).names || [];
    renderNameList(names);
  }
});

// Everything this page builds goes into #content (below the menu and the status message).
function addToPage(element) {
  document.getElementById("content").appendChild(element);
}

// Form-building helpers. Controls are created with DOM APIs (not innerHTML) because the edit form is
// populated from URL query parameters and API data, which must never be interpreted as HTML.
function createSelect(name, options, selected) {
  const select = document.createElement("select");
  select.name = name;
  select.id = `field-${name}`;
  options.forEach(optionValue => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === selected) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

function createTextInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.name = name;
  input.id = `field-${name}`;
  input.value = value;
  input.maxLength = 50;
  return input;
}

// A labelled field: the label is tied to the control (so clicking it focuses the control, and screen readers
// announce it), with optional help text underneath.
function appendField(form, labelText, control, hintText) {
  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = labelText;
  field.appendChild(label);
  field.appendChild(control);

  if (hintText) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.id = `${control.id}-hint`;
    hint.textContent = hintText;
    control.setAttribute("aria-describedby", hint.id);
    field.appendChild(hint);
  }
  form.appendChild(field);
}

const DISPLAY_HINT = "Letters, numbers and spaces only (anything else is removed). 50 characters at most.";

function createButton(text) {
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = text;
  return button;
}

function sanitizeDisplay(display) {
  return display.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50);
}

async function fetchNames(activity_id) {
  const response = await fetch(`${API_BASE}/name?activity_id=${encodeURIComponent(activity_id)}`);
  return response.json();
}

async function fetchName(activity_id, name_id, filter) {
  const response = await fetch(`${API_BASE}/name?activity_id=${encodeURIComponent(activity_id)}&name_id=${encodeURIComponent(name_id)}&filter=${encodeURIComponent(filter)}`);
  const data = await response.json();
  return data.names[0].display || "No name found for that name ID";
}

function renderAddForm(messageEl) {
  const container = document.createElement("section");
  container.className = "admin-section";

  const heading = document.createElement("h2");
  heading.textContent = "Add a name";
  container.appendChild(heading);

  const form = document.createElement("form");
  form.id = "addForm";
  form.className = "admin-form";

  appendField(form, "Activity ID", createSelect("activity_id", VALID_ACTIVITY_ID));
  appendField(form, "Filter (age group)", createSelect("filter", VALID_FILTER));
  appendField(form, "Display name", createTextInput("display", ""), DISPLAY_HINT);
  form.appendChild(createButton("Add"));

  form.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const display = sanitizeDisplay(form.display.value);
    const payload = {
      activity_id: form.activity_id.value,
      filter: form.filter.value,
      display: display
    };

    try {
      await addName(payload);
      messageEl.textContent = "Name added successfully";
    } catch (error) {
      alert("Error: " + error.message);
      return;
    }
    await refreshNameList(); // so the new name appears in the list below
  };

  container.appendChild(form);
  addToPage(container);
}

async function addName(payload) {
  const response = await fetch(`${API_BASE}/addname`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function renderEditForm(activity_id, name_id, filter) {
  const display = await fetchName(activity_id, name_id, filter);
  const container = document.createElement("section");
  container.className = "admin-section";

  const back = document.createElement("a");
  back.className = "back-link";
  back.href = "./names.html";
  back.textContent = "\u2190 Back to all names";
  container.appendChild(back);

  const heading = document.createElement("h2");
  heading.textContent = "Edit name";
  container.appendChild(heading);

  const form = document.createElement("form");
  form.id = "editForm";
  form.className = "admin-form";

  const nameIdInput = document.createElement("input");
  nameIdInput.type = "hidden";
  nameIdInput.name = "name_id";
  nameIdInput.value = name_id;
  form.appendChild(nameIdInput);
  appendField(form, "Activity ID", createSelect("activity_id", VALID_ACTIVITY_ID, activity_id));
  appendField(form, "Filter (age group)", createSelect("filter", VALID_FILTER, filter));
  appendField(form, "Display name", createTextInput("display", display), `${DISPLAY_HINT} Name ID: ${name_id}.`);
  form.appendChild(createButton("Update"));

  form.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const display = sanitizeDisplay(form.display.value);
    const payload = {
      activity_id: form.activity_id.value,
      name_id: form.name_id.value,
      filter: form.filter.value,
      display: display
    };
    try {
      await editName(payload);
      //messageEl.textContent = "name edited successfully";
    } catch (error) {
      alert("Error: " + error.message);
    }
    location.href = "./names.html";
  };

  container.appendChild(form);
  addToPage(container);
}

async function editName(payload) {
  const response = await fetch(`${API_BASE}/editname`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

// Fetch the names again and redraw the list. A failure here must not hide the "name added" message.
async function refreshNameList() {
  try {
    renderNameList((await fetchNames(DEFAULT_ACTIVITY_ID)).names || []);
  } catch (error) {
    console.error("Could not refresh the list of names:", error);
  }
}

function renderNameList(names) {
  const section = document.createElement("section");
  section.id = "nameListSection";
  section.className = "admin-section";

  const heading = document.createElement("h2");
  heading.textContent = `Existing names: ${DEFAULT_ACTIVITY_ID} (${names.length})`;
  section.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Choose a name to edit it.";
  section.appendChild(hint);

  const list = document.createElement("ul");
  list.className = "name-list";
  names.forEach(n => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `./names.html?activity_id=${encodeURIComponent(n.activity_id)}&name_id=${encodeURIComponent(n.name_id)}&filter=${encodeURIComponent(n.filter)}`;

    // display name, then the activity it belongs to, then its filter
    [["name-main", n.display], ["name-sub", n.activity_id], ["chip", n.filter]].forEach(([className, text]) => {
      const part = document.createElement("span");
      part.className = className;
      part.textContent = text;
      link.appendChild(part);
    });
    item.appendChild(link);
    list.appendChild(item);
  });
  section.appendChild(list);

  // redrawing replaces the list that is already on the page
  const previous = document.getElementById("nameListSection");
  if (previous) previous.remove();
  addToPage(section);
}
