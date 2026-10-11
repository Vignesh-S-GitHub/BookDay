async function automaticHolidayRegression(page) {
  const base = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|Refused to/.test(message.text())
    )
      errors.push(message.text());
  });
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  try {
    await p.goto(base + "/#/calendar");
    await p.waitForSelector("#calendar-today");
    check(
      await p.evaluate(() => {
        const button = document.querySelector("#calendar-today");
        return (
          button.previousElementSibling.dataset.layer === "all" &&
          !button.closest("details") &&
          document.querySelectorAll("#calendar-today").length === 1
        );
      }),
      "Today must appear once immediately beside All, outside collapsed options",
    );
    const current = await p.evaluate(() =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
        new Date(),
      ),
    );
    for (const [year, month] of [
      ["2024", "1"],
      ["2030", "12"],
    ]) {
      await p.selectOption("#year-select", year);
      await p.selectOption("#month-select", month);
      await p.locator("#calendar-today").click();
      await p.waitForSelector(
        `[data-day="${current}"].selected[aria-current="date"]`,
      );
      check(
        (await p.locator("#year-select").inputValue()) === current.slice(0, 4),
        "Today did not restore current year",
      );
      check(
        Number(await p.locator("#month-select").inputValue()) ===
          Number(current.slice(5, 7)),
        "Today did not restore current month",
      );
    }
    const delivery = await p.evaluate(async () => {
      const cache = await caches.open("bookday-holiday-data");
      const urls = (await cache.keys()).map((r) => r.url);
      const manifestUrl = urls.find(
        (url) =>
          url.startsWith("https://raw.githubusercontent.com/") &&
          url.endsWith("/manifest.json"),
      );
      if (!manifestUrl) return null;
      const manifest = await (await cache.match(manifestUrl)).json();
      const states = (await (await fetch("/data/catalog.json")).json()).states;
      return { manifest, states };
    });
    check(
      delivery?.manifest.automatic_updates.enabled,
      "Live automatically published manifest was not loaded/cached",
    );
    check(
      delivery.states.length === 36 &&
        delivery.states.every(
          (state) => delivery.manifest.datasets["2026:" + state],
        ),
      "Validated 2026 coverage missing for a configured jurisdiction",
    );
    for (const [state, date, name] of [
      ["Tamil Nadu", "2026-10-19", "Ayutha Pooja"],
      ["Delhi", "2026-03-04", "Holi"],
      ["Goa", "2026-12-25", "Christmas"],
      ["Ladakh", "2026-01-26", "Republic Day"],
    ]) {
      await p.selectOption("#home-state", state);
      await p.selectOption("#year-select", "2026");
      await p.selectOption("#month-select", String(Number(date.slice(5, 7))));
      await p.locator(`[data-day="${date}"]`).click();
      await p.waitForFunction(
        (name) =>
          document.querySelector(".detail-list").textContent.includes(name),
        name,
      );
    }
    for (const width of [320, 390, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Calendar overflow at " + width,
      );
      check(
        await p.locator("#calendar-today").isVisible(),
        "Today unavailable at " + width,
      );
      await p.screenshot({
        path: `output/playwright/automatic-calendar-${width}.png`,
        fullPage: true,
      });
    }
    await p.selectOption("#home-state", "Tamil Nadu");
    await p.selectOption("#month-select", "10");
    await p.locator('[data-day="2026-10-19"]').click();
    await p.waitForFunction(() =>
      document
        .querySelector(".detail-list")
        .textContent.includes("Ayutha Pooja"),
    );
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    await p.waitForSelector("#calendar-today");
    await context.setOffline(true);
    await p.reload();
    await p.waitForSelector("#calendar-today");
    await p.selectOption("#year-select", "2026");
    await p.selectOption("#month-select", "10");
    await p.locator('[data-day="2026-10-19"]').click();
    await p.waitForFunction(() =>
      document
        .querySelector(".detail-list")
        .textContent.includes("Ayutha Pooja"),
    );
    check(errors.length === 0, errors.join("\n"));
    return "PASS: Today beside All; past/future month jump to India today; live automatic feed and all 36 jurisdiction datasets; Tamil Nadu/Delhi/Goa/Ladakh public dates; 320/390/1280 layouts; cached live holidays offline; no page/CSP errors.";
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}
