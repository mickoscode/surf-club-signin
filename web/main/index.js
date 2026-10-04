// Sign-in / sign-out page. Shared helpers and per-site settings are in common.js.

loadHeader("./header.snippet");

// Fetch valid names from the backend
async function fetchNames() {
    return getJson("/name", { activity_id: ACTIVITY_ID });
}

// Add log entry to the backend
async function addLog(nameId, direction) {
    return postJson("/log", {
        activity_id: ACTIVITY_ID,
        name_id: nameId,
        direction: direction,
        date_time: new Date().toISOString()
    });
}

const messageEl = document.getElementById("message");
const formEl = document.getElementById("signForm");
const spinnerEl = document.getElementById("spinner");
const nameInputField = document.getElementById("nameInput");
const name_idHiddenField = document.getElementById("name_id");
const clearNameButton = document.getElementById("clearName");
const directionInput = document.getElementById("direction");
const submitButton = document.getElementById("submitButton");


// Initialize the page
function init() {
    const { now, inStart: IN_START_TIME, outStart: OUT_START_TIME, end: END_TIME } = getSessionWindow();

    if (!isSunday() || now > END_TIME) {
        messageEl.textContent = `The next session is ${getNextSunday()}`;
        return;
    }

    if (now < IN_START_TIME) {
        messageEl.textContent = `Sign in starts at ${IN_START_TIME}`;
        return;
    }

    if (now >= IN_START_TIME && now < OUT_START_TIME) {
        setupForm("in");
        return;
    }

    if (now >= OUT_START_TIME && now < END_TIME) {
        setupForm("out");
        return;
    }
}

// Setup the form for sign-in or sign-out
async function setupForm(direction) {
    messageEl.textContent = "";  // don't display a message, button text is enough
    submitButton.disabled = false; // (re-)enable button
    submitButton.textContent = direction === "in" ? "Sign In" : "Sign Out";
    formEl.classList.remove("hidden");
    directionInput.value = direction;

    const savedName = localStorage.getItem("display");
    const savedName_id = localStorage.getItem("name_id");
    if (savedName) {
        nameInputField.value = savedName;
        name_idHiddenField.value = savedName_id;
    }

    const dropdown = document.createElement("ul");
    dropdown.classList.add("dropdown", "hidden");
    formEl.appendChild(dropdown);

    const names = (await fetchNames()).names || [];

    // Debounce function to limit filtering frequency
    function debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    }

    // Append text to parent, wrapping each case-insensitive occurrence of query in a highlight span.
    // Built with DOM nodes (not innerHTML) so names and typed text can never be interpreted as HTML or a regex.
    function appendHighlighted(parent, text, query) {
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let pos = 0;
        while (lowerQuery) {
            const found = lowerText.indexOf(lowerQuery, pos);
            if (found === -1) break;
            if (found > pos) parent.appendChild(document.createTextNode(text.slice(pos, found)));
            const span = document.createElement("span");
            span.classList.add("highlight");
            span.textContent = text.slice(found, found + lowerQuery.length);
            parent.appendChild(span);
            pos = found + lowerQuery.length;
        }
        if (pos < text.length) parent.appendChild(document.createTextNode(text.slice(pos)));
    }

    // Filter and display matching names
    function filterNames() {
        const inputValue = nameInputField.value.toLowerCase();
        const matches = names.filter(name => name.display.toLowerCase().includes(inputValue));

        dropdown.innerHTML = ""; // Clear previous suggestions
        if (matches.length > 0 && inputValue) {
            matches.forEach((match, index) => {
                const item = document.createElement("li");
                item.classList.add("dropdown-item");
                appendHighlighted(item, match.display, inputValue);

                item.addEventListener("click", () => {
                    nameInputField.value = match.display;
                    name_idHiddenField.value = match.name_id;
                    dropdown.classList.add("hidden");

                    // a (new) name has been selected, so clear message and (re-)enable button 
                    messageEl.textContent = "";
                    submitButton.disabled = false;
                });

                dropdown.appendChild(item);
            });
            dropdown.classList.remove("hidden");
        } else {
            dropdown.classList.add("hidden");
        }
    }

    // Add event listeners
    nameInputField.addEventListener("input", debounce(filterNames, 300));
    nameInputField.addEventListener("blur", () => {
        setTimeout(() => dropdown.classList.add("hidden"), 200);
    });
    nameInputField.addEventListener("focus", () => {
        if (dropdown.children.length > 0) {
            dropdown.classList.remove("hidden");
        }
    });

    // Keyboard navigation
    nameInputField.addEventListener("keydown", (e) => {
        const items = dropdown.querySelectorAll(".dropdown-item");
        let activeIndex = Array.from(items).findIndex(item => item.classList.contains("active"));

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (activeIndex < items.length - 1) {
                if (activeIndex >= 0) items[activeIndex].classList.remove("active");
                items[++activeIndex].classList.add("active");
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (activeIndex > 0) {
                items[activeIndex].classList.remove("active");
                items[--activeIndex].classList.add("active");
            }
        } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            items[activeIndex].click();
        }
    });
}

// Handle form submission
formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameId = name_idHiddenField.value;
    if (!nameId) {
        messageEl.textContent = "type and select an allowed name!";
        return;
    }

    spinnerEl.classList.remove("hidden");
    const direction = directionInput.value;

    try {
        const result = await addLog(nameId, direction);
        localStorage.setItem("display", nameInputField.value);
        localStorage.setItem("name_id", name_idHiddenField.value);
        messageEl.textContent = `${nameInputField.value} has signed ` + direction;
        submitButton.disabled = true; // Disable button after submission to prevent/reduce spam logs
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        spinnerEl.classList.add("hidden");
    }
});

// Clear saved name
clearNameButton.addEventListener("click", () => {
    localStorage.removeItem("display");
    localStorage.removeItem("name_id");
    nameInputField.value = "";
    name_idHiddenField.value = "";
    messageEl.textContent = "";
    submitButton.disabled = false; // re-enable button
});

// Initialize the page on load
init();