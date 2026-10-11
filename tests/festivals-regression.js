async function festivalRegression(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
    });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (error) => errors.push(error.message));
  p.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const base = new URL(page.url()).origin;
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const loadArt = async () => {
    await p.evaluate(() => {
      for (const image of document.images) image.loading = "eager";
    });
    await p.waitForFunction(() =>
      [...document.images].every((i) => i.complete && i.naturalWidth),
    );
  };
  const geometry = async () =>
    p.evaluate(() => {
      const card = document
        .querySelector(".festival-card")
        .getBoundingClientRect();
      const title = document
        .querySelector(".festival-card h2")
        .getBoundingClientRect();
      const date = document
        .querySelector(".festival-date")
        .getBoundingClientRect();
      const arrow = document
        .querySelector(".festival-card .round-arrow")
        .getBoundingClientRect();
      const style = getComputedStyle(document.querySelector(".festival-date"));
      return (
        title.bottom <= date.top &&
        date.bottom <= card.bottom &&
        date.left >= card.left &&
        date.right <= arrow.left &&
        style.color === "rgb(8, 14, 60)" &&
        style.backgroundColor === "rgb(255, 249, 235)" &&
        document.documentElement.scrollWidth <= innerWidth
      );
    });
  try {
    await p.clock.install({ time: new Date("2026-10-11T06:30:00Z") });
    await p.goto(base + "/#/home");
    await p.waitForFunction(() => !!document.querySelector(".festival-card"));
    await loadArt();
    check(
      (await p.locator(".festival-card h2").innerText()) === "Ayutha Pooja",
      "Next local festival",
    );
    check(
      (await p.locator(".festival-date").getAttribute("datetime")) ===
        "2026-10-19",
      "Visible next festival date",
    );
    check(
      (await p.locator(".festival-card img").getAttribute("src")).endsWith(
        "/ayutha_pooja.webp",
      ),
      "Associated Home art",
    );
    const data = await p.evaluate(async () =>
      (await fetch("/data/holidays/manifest.json")).json(),
    );
    for (const width of [320, 360, 390, 430, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      for (const theme of Object.values(data.festival_art)) {
        await p
          .locator(".festival-card h2")
          .evaluate((el, name) => (el.textContent = name), theme.name);
        check(
          await geometry(),
          `Home title/date/arrow overlap: ${width} ${theme.name}`,
        );
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.reload();
    await p.locator(".festival-card").click();
    await p.waitForURL("**/#/calendar");
    check(
      (await p.locator(".day.selected").getAttribute("data-day")) ===
        "2026-10-19",
      "Home opens exact date",
    );
    check(
      (
        await p.locator(".holiday-thumbnail").first().getAttribute("src")
      ).endsWith("/ayutha_pooja.webp"),
      "Calendar associated art",
    );
    check(
      (await p.locator(".holiday-date").first().getAttribute("datetime")) ===
        "2026-10-19",
      "Calendar detail date",
    );
    check(
      (await p.locator(".festival-guide-item").count()) === 17,
      "2026 guide count",
    );
    await loadArt();
    await p.screenshot({
      path: "output/playwright/festivals-calendar-2026.png",
      fullPage: true,
    });
    await p.locator("#year-select").selectOption("2027");
    check(
      (await p.locator(".festival-guide-item").count()) === 16,
      "2027 sourced guide count",
    );
    await p.locator('[data-festival-date="2027-03-26"]').click();
    check(
      (await p.locator(".day.selected").getAttribute("data-day")) ===
        "2027-03-26",
      "Guide jumps to yearly Good Friday date",
    );
    check(
      (await p.locator(".holiday-thumbnail").getAttribute("src")).endsWith(
        "/good_friday.webp",
      ),
      "Good Friday art",
    );
    check(
      (await p.locator(".detail-list").innerText()).includes(
        "Festival observance",
      ),
      "Not falsely labelled public holiday",
    );
    await p.locator('[data-festival-date="2027-10-29"]').click();
    check(
      (await p.locator(".holiday-date").getAttribute("datetime")) ===
        "2027-10-29",
      "2027 Diwali date",
    );
    check(
      (await p.locator(".holiday-thumbnail").getAttribute("src")).endsWith(
        "/diwali.webp",
      ),
      "Reusable Diwali art",
    );
    await p.locator("#year-select").selectOption("2028");
    check(
      (await p.locator(".festival-guide-item").count()) === 0,
      "No guessed 2028 dates",
    );
    check(
      (await p.locator(".festival-guide").innerText()).includes(
        "No reviewed festival dates for 2028",
      ),
      "Unreviewed-year message",
    );
    await p.locator("#year-select").selectOption("2026");
    await p.locator('[data-festival-date="2026-11-08"]').click();
    await p.locator("[data-layer=festivals]").click();
    check(
      (await p.locator(".festival-guide").count()) === 0,
      "Festival layer controls guide",
    );
    await p.locator("[data-layer=festivals]").click();
    await p.waitForFunction(() => navigator.serviceWorker.controller, null, {
      timeout: 45000,
    });
    await context.setOffline(true);
    await p.reload();
    await p.waitForFunction(() => !!document.querySelector(".festival-guide"));
    await loadArt();
    check(
      (await p.locator(".festival-guide-item").count()) === 17,
      "Festival guide works offline",
    );
    check(
      await p.evaluate(async () => {
        const data = await (await fetch("/data/holidays/manifest.json")).json();
        const result = await Promise.all(
          Object.values(data.festival_art).map(
            async (theme) => (await fetch(theme.image)).ok,
          ),
        );
        return result.every(Boolean);
      }),
      "All 34 festival images cached offline",
    );
    await context.setOffline(false);
    for (const width of [320, 390, 430, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Calendar overflow ${width}`,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + "/#/insights");
    await p.locator("[name=date]").fill("2026-12-24");
    await p.locator("#insights-form button[type=submit]").click();
    check(
      (
        await p
          .locator(".holiday-card .insight-festival-art")
          .getAttribute("src")
      ).endsWith("/christmas.webp"),
      "Nearby festival insight artwork",
    );
    check(
      (await p.locator(".holiday-card").innerText()).includes("25 Dec 2026"),
      "Nearby festival insight date",
    );
    await p.screenshot({
      path: "output/playwright/festivals-insights.png",
      fullPage: true,
    });
    await p.clock.setSystemTime(new Date("2026-12-26T06:30:00Z"));
    await p.goto(base + "/#/home");
    check(
      (await p.locator(".festival-date").getAttribute("datetime")) ===
        "2027-01-01",
      "Next festival crosses year boundary",
    );
    await p.setViewportSize({ width: 390, height: 844 });
    await p.clock.setSystemTime(new Date("2026-10-11T06:30:00Z"));
    await p.reload();
    await loadArt();
    await p.screenshot({
      path: "output/playwright/festivals-home.png",
      fullPage: true,
    });
    check(errors.length === 0, "Browser errors: " + errors.join("\n"));
    return "PASS: 34 festival artworks; 2026/2027 dates; local overrides; Home dates and navigation; all titles at five widths without overlap; illustrated guide; festival layer; unreviewed years; yearly crossover; offline art; zero console errors.";
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}
