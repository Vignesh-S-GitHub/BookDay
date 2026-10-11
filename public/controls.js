/** One themed selector and number control shared across all application screens. */
let chooser, activeSelect;
const controlLabel = (select) =>
  select.getAttribute("aria-label") ||
  [...(select.labels?.[0]?.childNodes || [])]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent.trim())
    .join(" ") ||
  select.name ||
  "Choose an option";
function sync(select) {
  const button = select.parentElement.querySelector(".select-trigger");
  if (button)
    button.querySelector(".select-value").textContent =
      select.selectedOptions[0]?.textContent || "Choose";
}
function closeChooser() {
  chooser.close();
  const button = activeSelect?.parentElement.querySelector(".select-trigger");
  button?.setAttribute("aria-expanded", "false");
  if (button?.isConnected) button.focus();
}
function openChooser(select) {
  activeSelect = select;
  if (!chooser) {
    chooser = document.createElement("dialog");
    chooser.className = "control-dialog";
    chooser.innerHTML =
      '<div class="control-heading"><h2 id="control-title"></h2><button type="button" class="icon-button" aria-label="Close choices">×</button></div><input class="bd-input control-search" type="search" placeholder="Search choices…" aria-label="Search choices"><div class="control-options" role="listbox" aria-labelledby="control-title"></div>';
    document.body.append(chooser);
    chooser.querySelector("button").addEventListener("click", closeChooser);
    chooser.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeChooser();
    });
    chooser.addEventListener("click", (e) => {
      if (e.target === chooser) closeChooser();
    });
    chooser.querySelector("input").addEventListener("input", () => {
      const query = chooser.querySelector("input").value.toLowerCase();
      for (const option of chooser.querySelectorAll("[role=option]"))
        option.hidden = !option.textContent.toLowerCase().includes(query);
    });
    chooser.addEventListener("keydown", (e) => {
      const options = [...chooser.querySelectorAll("[role=option]")].filter(
        (o) => !o.hidden,
      );
      if (
        !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) ||
        !options.length
      )
        return;
      e.preventDefault();
      const current = options.indexOf(document.activeElement);
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? options.length - 1
            : e.key === "ArrowDown"
              ? (current + 1) % options.length
              : (current - 1 + options.length) % options.length;
      options[next].focus();
    });
  }
  chooser.querySelector("h2").textContent = controlLabel(select);
  const search = chooser.querySelector("input");
  search.value = "";
  search.hidden = select.options.length < 10;
  const list = chooser.querySelector(".control-options");
  list.replaceChildren();
  for (const option of select.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "option";
    button.textContent = option.textContent;
    button.setAttribute("aria-selected", String(option.selected));
    button.disabled = option.disabled;
    button.addEventListener("click", () => {
      select.value = option.value;
      sync(select);
      closeChooser();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    list.append(button);
  }
  select.parentElement
    .querySelector(".select-trigger")
    .setAttribute("aria-expanded", "true");
  chooser.showModal();
  if (!search.hidden) search.focus();
  else list.querySelector('[aria-selected="true"]')?.focus();
}
export function enhanceControls(root = document) {
  for (const input of root.querySelectorAll(
    'input[type="date"], input[type="time"]',
  )) {
    if (input.dataset.themedPicker) continue;
    input.dataset.themedPicker = "true";
    input.parentElement.classList.add("picker-field");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picker-trigger";
    button.setAttribute(
      "aria-label",
      `Choose ${input.name?.replaceAll("_", " ") || input.type}`,
    );
    button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${input.type === "date" ? "chevron" : "clock"}"></use></svg>`;
    if (input.type === "date") {
      button.classList.add("date-picker-trigger");
      const leadingIcon = input
        .closest("label")
        ?.querySelector(".category-symbol");
      if (leadingIcon) {
        const leadingButton = document.createElement("button");
        leadingButton.type = "button";
        leadingButton.className =
          leadingIcon.className + " leading-picker-trigger";
        leadingButton.innerHTML = leadingIcon.innerHTML;
        leadingButton.setAttribute(
          "aria-label",
          `Open ${input.name?.replaceAll("_", " ") || "date"} calendar`,
        );
        leadingIcon.replaceWith(leadingButton);
        leadingButton.addEventListener("click", () => openDateTime(input));
      }
    }
    input.after(button);
    button.addEventListener("click", () => openDateTime(input));
  }
  for (const select of root.querySelectorAll("select")) {
    if (select.classList.contains("native-select")) {
      sync(select);
      continue;
    }
    const wrapper = document.createElement("span");
    wrapper.className = "theme-select";
    select.before(wrapper);
    wrapper.append(select);
    select.classList.add("native-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    select.addEventListener("focus", () =>
      wrapper.querySelector(".select-trigger")?.focus(),
    );
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bd-input select-trigger";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", controlLabel(select));
    button.innerHTML =
      '<span class="select-value"></span><svg class="icon" aria-hidden="true"><use href="#chevron"></use></svg>';
    wrapper.append(button);
    sync(select);
    button.addEventListener("click", () => openChooser(select));
    select.addEventListener("change", () => sync(select));
  }
  for (const input of root.querySelectorAll('input[type="number"]')) {
    if (input.closest(".number-control")) continue;
    const wrapper = document.createElement("span");
    wrapper.className = "number-control";
    input.before(wrapper);
    for (const direction of [-1, 1]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "number-step";
      button.textContent = direction === 1 ? "+" : "−";
      button.setAttribute(
        "aria-label",
        (direction === 1 ? "Increase " : "Decrease ") +
          (input.getAttribute("aria-label") || input.name || "number"),
      );
      button.addEventListener("click", () => {
        if (!input.value) input.value = input.min || "0";
        direction === 1 ? input.stepUp() : input.stepDown();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      if (direction === -1) wrapper.append(button, input);
      else wrapper.append(button);
    }
  }
}
function openDateTime(input) {
  const dialog = document.createElement("dialog");
  dialog.className = "control-dialog date-time-dialog";
  const heading = document.createElement("h2");
  heading.textContent =
    input.type === "date" ? "Choose date" : "Reminder / opening time (IST)";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close picker");
  const bar = document.createElement("div");
  bar.className = "control-heading";
  bar.append(heading, close);
  const body = document.createElement("div");
  dialog.append(bar, body);
  document.body.append(dialog);
  const finish = () => {
    dialog.close();
    dialog.remove();
    if (input.isConnected) input.focus();
  };
  close.addEventListener("click", finish);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    finish();
  });
  if (input.type === "time") {
    const [hour, minute] = (input.value || "08:00").split(":").map(Number);
    body.innerHTML = `<div class="time-controls"><label>Hour<input class="bd-input" name="picker_hour" aria-label="Hour" type="number" min="1" max="12" value="${hour % 12 || 12}" required></label><label>Minute<input class="bd-input" name="picker_minute" aria-label="Minute" type="number" min="0" max="59" value="${minute}" required></label><label>Period<select class="bd-input" aria-label="AM or PM"><option ${hour < 12 ? "selected" : ""}>AM</option><option ${hour >= 12 ? "selected" : ""}>PM</option></select></label></div><button type="button" class="bd-primary full apply-time">Use this time</button>`;
    body.querySelector(".apply-time").addEventListener("click", () => {
      const inputs = [...body.querySelectorAll("input")];
      if (!inputs.every((i) => i.reportValidity())) return;
      const h =
        (Number(inputs[0].value) % 12) +
        (body.querySelector("select").value === "PM" ? 12 : 0);
      input.value = `${String(h).padStart(2, "0")}:${String(Number(inputs[1].value)).padStart(2, "0")}`;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      finish();
    });
    enhanceControls(body);
  } else {
    const value =
      input.value ||
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
        new Date(),
      );
    let view = new Date(value + "T00:00:00Z");
    function renderDays() {
      const year = view.getUTCFullYear(),
        month = view.getUTCMonth();
      const start = new Date(Date.UTC(year, month, 1));
      start.setUTCDate(1 - start.getUTCDay());
      const controls = document.createElement("div");
      controls.className = "picker-month-controls";
      controls.innerHTML = `<button type="button" class="icon-button prev-date" aria-label="Previous picker month">‹</button><label>Month<select class="bd-input" aria-label="Picker month">${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${i === month ? "selected" : ""}>${new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 1)))}</option>`).join("")}</select></label><label>Year<input class="bd-input" aria-label="Picker year" name="picker_year" type="number" min="1900" max="2100" value="${year}" required></label><button type="button" class="icon-button next-date" aria-label="Next picker month">›</button>`;
      const grid = document.createElement("div");
      grid.className = "picker-date-grid";
      for (const name of ["S", "M", "T", "W", "T", "F", "S"]) {
        const span = document.createElement("span");
        span.textContent = name;
        grid.append(span);
      }
      for (let i = 0; i < 42; i++) {
        const day = new Date(start);
        day.setUTCDate(day.getUTCDate() + i);
        const iso = day.toISOString().slice(0, 10);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = day.getUTCDate();
        button.className = day.getUTCMonth() === month ? "" : "outside-month";
        button.setAttribute("aria-label", iso);
        button.setAttribute("aria-pressed", String(iso === input.value));
        button.disabled =
          (input.min && iso < input.min) || (input.max && iso > input.max);
        button.addEventListener("click", () => {
          input.value = iso;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          finish();
        });
        grid.append(button);
      }
      body.replaceChildren(controls, grid);
      function changeMonth(delta) {
        const next = new Date(Date.UTC(year, month + delta, 1));
        if (next.getUTCFullYear() >= 1900 && next.getUTCFullYear() <= 2100) {
          view = next;
          renderDays();
        }
      }
      controls
        .querySelector(".prev-date")
        .addEventListener("click", () => changeMonth(-1));
      controls
        .querySelector(".next-date")
        .addEventListener("click", () => changeMonth(1));
      controls.querySelector("select").addEventListener("change", (e) => {
        view = new Date(Date.UTC(year, Number(e.target.value), 1));
        renderDays();
      });
      controls.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checkValidity()) {
          view = new Date(Date.UTC(Number(e.target.value), month, 1));
          renderDays();
        }
      });
      enhanceControls(controls);
    }
    renderDays();
  }
  dialog.showModal();
}
