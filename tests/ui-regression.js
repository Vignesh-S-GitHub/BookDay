async function regression(page) {
  const base = new URL(page.url()).origin;
  const browser = page.context().browser();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  const goto = async (route) => {
    await p.goto(base + "/#/" + route);
    await p.waitForFunction(() => !document.querySelector(".loading"));
  };
  const assets = async () => {
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() =>
      [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    );
  };
  const details = async () => {
    const d = p.locator("#rule-options");
    if (!(await d.evaluate((e) => e.open))) await d.locator("summary").click();
  };
  try {
    await goto("home");
    await assets();
    check(
      (await p.locator(".quick .category").count()) === 8,
      "Home categories",
    );
    await p.locator("#home-state").selectOption("Kerala");
    await p.reload();
    await p.waitForFunction(() => !document.querySelector(".loading"));
    check(
      (await p.locator("#home-state").inputValue()) === "Kerala",
      "State persistence",
    );
    await goto("explore");
    await assets();
    check(
      (await p.locator(".category-grid .category").count()) === 14,
      "Explore categories",
    );
    check(
      (await p.locator(".category-grid .category").allTextContents())
        .slice(0, 12)
        .map((s) => s.trim())
        .join("|") ===
        "Trains|Flights|Buses|Hotels|Movies|Temples|Events|Tourism|Appointments|Govt Services|Education|Custom",
      "Reference category order",
    );
    await p.locator("#search-input").fill("passport");
    await p.locator("#search-form").press("Enter");
    check(
      (await p.locator(".category-grid .category").count()) === 1,
      "Search filter",
    );
    await p.locator("#search-input").fill("");
    await p.locator("#search-form").press("Enter");
    const cats = await p
      .locator(".category-grid .category")
      .evaluateAll((es) => es.map((e) => e.hash.split("/").at(-1)));
    for (const cat of cats) {
      await goto("book/" + cat);
      await p.locator("[name=event_date]").fill("2026-12-15");
      await p.locator(".find-date").click();
      await p.waitForURL("**/#/result");
      check(
        (await p.locator(".opening-date").innerText()) ===
          (cat === "trains" ? "16 Oct 2026" : "Not announced"),
        "Calculation " + cat,
      );
      check(
        (await p.locator("[data-action=calendar]").isDisabled()) ===
          (cat !== "trains"),
        "Unknown export " + cat,
      );
    }
    await goto("book/trains");
    await p.locator("[name=event_date]").fill("2026-12-15");
    check(
      (await p
        .locator('[data-mini-day="2026-12-15"]')
        .getAttribute("class")) === "selected",
      "Mini calendar sync",
    );
    await p.locator('[data-mini-day="2026-12-16"]').click();
    check(
      (await p.locator("[name=event_date]").inputValue()) === "2026-12-16",
      "Mini calendar selection",
    );
    await p.locator("[name=event_date]").fill("2026-12-15");
    await details();
    await p.locator("[name=title]").fill("Chennai → Madurai");
    await p.locator("[name=origin]").fill("Chennai (MAS)");
    await p.locator("[name=destination]").fill("Madurai (MDU)");
    await p.locator(".find-date").click();
    await p.waitForURL("**/#/result");
    await assets();
    await p.screenshot({
      path: "output/playwright/redesign-result.png",
      fullPage: true,
    });
    await p.locator("[data-action=save]").click();
    const stored = await p.evaluate(
      () => JSON.parse(localStorage.getItem("bookday.plans.v1")).plans,
    );
    check(
      stored.length === 1 && stored[0].title === "Chennai → Madurai",
      "Save plan",
    );
    const id = stored[0].id;
    await p.locator("[data-action=calendar]").click();
    let url = new URL(await p.locator("#google-calendar").getAttribute("href"));
    check(
      url.searchParams.get("dates") === "20261016/20261017",
      "All-day Google opening",
    );
    await p.locator("#close-dialog").click();
    await p.locator("[data-action=edit]").click();
    await details();
    await p.locator("[data-rule=tatkal]").click();
    await p.locator("[name=origin_date]").fill("2026-12-14");
    await p.locator("[name=train_class]").selectOption("non-ac");
    await p.locator(".find-date").click();
    await p.waitForURL("**/#/result");
    check(
      (await p.locator(".opening-date").innerText()) === "13 Dec 2026",
      "Tatkal origin date",
    );
    check(
      (await p.locator(".result-facts").innerText()).includes("11:00"),
      "Tatkal time",
    );
    await p.locator("[data-action=save]").click();
    check(
      (await p.evaluate(
        () => JSON.parse(localStorage.getItem("bookday.plans.v1")).plans.length,
      )) === 1,
      "Edit UUID retained",
    );
    await p.locator("[data-action=calendar]").click();
    url = new URL(await p.locator("#google-calendar").getAttribute("href"));
    check(
      url.searchParams.get("dates") === "20261213T053000Z/20261213T054500Z",
      "IST to UTC opening",
    );
    await p
      .getByRole("checkbox", { name: "1 day before", exact: true })
      .check();
    const dl = p.waitForEvent("download");
    await p.locator("#download-ics").click();
    await (await dl).saveAs("output/playwright/redesign-export.ics");
    await p.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async ({ files }) => {
          window.qaShare = files[0].name;
        },
      });
    });
    await p.locator("#share-ics").click();
    check(
      (await p.evaluate(() => window.qaShare)).endsWith(".ics"),
      "Native file share",
    );
    await p.evaluate(() =>
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          throw new DOMException("cancel", "AbortError");
        },
      }),
    );
    await p.locator("#share-ics").click();
    check(
      (await p.locator("#toast").innerText()).includes("canceled"),
      "Share cancellation",
    );
    await p.evaluate(() =>
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => false,
      }),
    );
    const fallback = p.waitForEvent("download");
    await p.locator("#share-ics").click();
    await fallback;
    await p.locator("#close-dialog").click();
    await goto("saved");
    check((await p.locator(".saved-card").count()) === 1, "Saved card");
    await p.locator(".plan-menu summary").click();
    await p.locator("[data-action=complete]").click();
    check((await p.locator(".saved-card").count()) === 0, "Complete plan");
    await p.locator("[data-tab=completed]").click();
    check((await p.locator(".saved-card").count()) === 1, "Completed tab");
    await p.locator(".plan-menu summary").click();
    await p.locator("[data-action=complete]").click();
    await p.locator("[data-tab=upcoming]").click();
    await goto("calendar");
    await p.locator("#month-select").selectOption("10");
    await p.locator("#year-select").selectOption("2026");
    await p.locator('[data-day="2026-10-20"]').click();
    check(
      (await p.locator(".detail-list").innerText()).includes("Mahanavami"),
      "Verified Kerala holiday",
    );
    check((await p.locator(".date-grid .day").count()) === 42, "42-cell grid");
    await p.locator('[data-day="2026-10-20"]').press("ArrowRight");
    check(
      (await p.locator(".day.selected").getAttribute("data-day")) ===
        "2026-10-21",
      "Keyboard day navigation",
    );
    await p.locator("[data-layer=holidays]").click();
    await goto("more");
    check(
      !(await p.locator("[data-setting=holidays]").isChecked()),
      "Calendar layer persistence",
    );
    await p.locator("[data-setting=holidays]").check();
    await p.locator("[data-setting=dark]").check();
    check(
      (await p.locator("html").getAttribute("class")) === "dark",
      "Dark theme",
    );
    await p.screenshot({
      path: "output/playwright/redesign-dark.png",
      fullPage: true,
    });
    await p.locator("[data-setting=dark]").uncheck();
    await p
      .locator("details")
      .filter({
        has: p.locator("summary").filter({ hasText: "Reminder Time" }),
      })
      .first()
      .locator("summary")
      .click();
    await p.locator("#default-custom").fill("120");
    await p.locator("#save-offsets").click();
    check(
      await p.evaluate(() =>
        JSON.parse(
          localStorage.getItem("bookday.settings.v1"),
        ).offsets.includes(120),
      ),
      "Reminder defaults",
    );
    await goto("insights");
    await p.locator("[name=date]").fill("2026-12-25");
    await p.locator("#insights-form button").click();
    check(
      (await p.locator("#insights-result").innerText()).includes("Christmas"),
      "Christmas insight",
    );
    await goto("book/custom");
    await details();
    await p.locator("[name=event_date]").fill("2028-03-31");
    await p.locator("#rule-mode").selectOption("months");
    await p.locator("[name=amount]").fill("1");
    await p.locator("[name=title]").fill("<img src=x onerror=alert(1)>");
    await p.locator(".find-date").click();
    await p.waitForURL("**/#/result");
    check(
      (await p.locator(".opening-date").innerText()) === "29 Feb 2028",
      "Month-end clipping",
    );
    check(
      (await p.locator(".result img[src=x]").count()) === 0,
      "HTML escaping",
    );
    for (const width of [320, 360, 390, 430, 1280]) {
      await p.waitForFunction(
        () => !document.querySelector("#toast").textContent,
      );
      await p.setViewportSize({ width, height: 844 });
      for (const route of [
        "home",
        "explore",
        "calendar",
        "saved",
        "more",
        "insights",
        "book/trains",
        "detail/" + id,
      ]) {
        await goto(route);
        await assets();
        check(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "Overflow " + width + " " + route,
        );
        if (width === 390)
          await p.screenshot({
            path: "output/playwright/redesign-" + route.split("/")[0] + ".png",
            fullPage: true,
          });
      }
    }
    await goto("saved");
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await p.reload();
    await p.waitForFunction(() => !document.querySelector(".loading"));
    check(
      (await p.locator(".saved-card").count()) === 1,
      "Offline saved persistence",
    );
    await assets();
    await p.locator(".plan-menu summary").click();
    await p.locator("[data-action=calendar]").click();
    check(
      (await p.locator("#google-calendar").count()) === 1,
      "Offline exports",
    );
    await p.locator("#close-dialog").click();
    await context.setOffline(false);
    await p.evaluate(() =>
      localStorage.setItem("bookday.settings.v1", "{broken"),
    );
    await p.reload();
    await p.waitForFunction(() => !document.querySelector(".loading"));
    check(
      (await p.locator("#home-state").inputValue()) === "Tamil Nadu",
      "Malformed settings fallback",
    );
    await p.evaluate(() => localStorage.setItem("bookday.plans.v1", "{broken"));
    await p.reload();
    await p.waitForFunction(() => !document.querySelector(".loading"));
    check(
      (await p.locator(".saved-card").count()) === 0,
      "Malformed plans fallback",
    );
    check(errors.length === 0, "Browser errors: " + errors.join("\n"));
    return "PASS: 14 categories; reference order; search; general/Tatkal/month rules; mini-calendar; save/edit/complete; UTC/all-day exports; download/native/fallback/cancel; holiday keyboard/layers; settings; insights; escaping; 320/360/390/430/1280 layouts; loaded artwork/fonts; first install; offline exports; malformed storage; zero console errors.";
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}
