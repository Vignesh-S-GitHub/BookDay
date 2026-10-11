async function holidayUiRegression(page) {
  const base = new URL(page.url()).origin;
  const browser = page.context().browser();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  try {
    await p.goto(base + "/#/home");
    await p.waitForSelector(".hero-carousel");
    check(
      await p.evaluate(async () => {
        const cache = await caches.open("bookday-holiday-data");
        const manifestUrl = (await cache.keys())
          .map((r) => r.url)
          .find((url) => url.endsWith("/manifest.json"));
        const manifest = manifestUrl && (await cache.match(manifestUrl));
        if (!manifest) return false;
        const data = await manifest.json();
        const base = manifestUrl.slice(
          0,
          -"/data/holidays/manifest.json".length,
        );
        return Boolean(await cache.match(base + data.datasets["2026:IN"].url));
      }),
      "First-visit annual responses were not retained before worker control",
    );
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    await p.waitForSelector(".hero-carousel");
    await p.evaluate(
      () =>
        (window.bookdayOriginalImage =
          document.querySelector(".carousel-image")),
    );
    await p.locator('a.bd-navitem[href="#/explore"]').click();
    await p.locator('a.bd-navitem[href="#/home"]').click();
    check(
      await p.evaluate(
        () =>
          window.bookdayOriginalImage ===
          document.querySelector(".carousel-image"),
      ),
      "Decoded Home image was recreated",
    );
    const stateList = await p.locator("#home-state option").allTextContents();
    for (const width of [320, 360, 390, 430, 1280]) {
      await p.setViewportSize({ width, height: 900 });
      for (const state of stateList) {
        await p.selectOption("#home-state", state);
        const geometry = await p.evaluate(() => {
          const pill = document
            .querySelector(".state-pill")
            .getBoundingClientRect();
          const trigger = document
            .querySelector(".state-pill .select-trigger")
            .getBoundingClientRect();
          const value = document
            .querySelector(".state-pill .select-value")
            .getBoundingClientRect();
          const card = document
            .querySelector(".next-card")
            .getBoundingClientRect();
          const heading = document
            .querySelector(".next-card h3")
            .getBoundingClientRect();
          const caption = document
            .querySelector(".next-card > small")
            .getBoundingClientRect();
          const date = document
            .querySelector(".next-card p")
            .getBoundingClientRect();
          const button = document
            .querySelector(".next-card .bd-primary")
            .getBoundingClientRect();
          return {
            pillRight: pill.right,
            triggerRight: trigger.right,
            valueRight: value.right,
            cardBottom: card.bottom,
            headBottom: heading.bottom,
            headTop: heading.top,
            captionBottom: caption.bottom,
            dateTop: date.top,
            dateBottom: date.bottom,
            buttonTop: button.top,
            buttonBottom: button.bottom,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        check(!geometry.overflow, `Overflow ${state} at ${width}`);
        check(
          geometry.valueRight <= geometry.triggerRight + 1 &&
            geometry.triggerRight <= geometry.pillRight + 1,
          `State text outside pill ${state} ${width}`,
        );
        check(
          geometry.headTop >= geometry.captionBottom - 1 &&
            geometry.dateTop >= geometry.headBottom - 1 &&
            geometry.buttonTop >= geometry.dateBottom - 1 &&
            geometry.buttonBottom <= geometry.cardBottom,
          `Next booking overlap ${width}`,
        );
      }
    }
    await p.selectOption("#home-state", "Tamil Nadu");
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('a.bd-navitem[href="#/calendar"]').click();
    await p.selectOption("#year-select", "2024");
    await p.waitForFunction(
      () =>
        document.querySelectorAll('.festival-guide-item time[datetime^="2024"]')
          .length === 17,
    );
    await p.selectOption("#month-select", "1");
    await p.locator('[data-day="2024-01-15"]').click();
    check(
      (await p.locator(".detail-list").textContent()).includes("Pongal"),
      "Historical Pongal missing",
    );
    check(
      (await p
        .locator('[data-day="2024-01-15"] use[href$="#festival-lamp"]')
        .count()) === 1,
      "Festival lamp missing",
    );
    await p.screenshot({
      path: "output/playwright/pipeline-calendar-2024.png",
      fullPage: true,
    });
    await p.route("**/data/holidays/2025/tamil-nadu-*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await p.selectOption("#year-select", "2025");
    await p.selectOption("#year-select", "2024");
    await p.waitForTimeout(1000);
    check(
      (await p.locator("#year-select").inputValue()) === "2024",
      "Old year request replaced selection",
    );
    check(
      (await p
        .locator('.festival-guide-item time[datetime^="2025"]')
        .count()) === 0,
      "Stale 2025 response replaced 2024 dates",
    );
    await context.setOffline(true);
    await p.reload();
    await p.waitForSelector(".date-grid");
    check(
      (await p.locator("#home-state").inputValue()) === "Tamil Nadu",
      "Offline app failed",
    );
    check(
      await p.evaluate(async () => {
        const r = await fetch("/art/app_icon_512.png");
        return r.ok;
      }),
      "Offline white install icon missing",
    );
    await context.setOffline(false);
    await p.selectOption("#year-select", "2026");
    await p.waitForFunction(
      () =>
        document.querySelectorAll('.festival-guide-item time[datetime^="2026"]')
          .length === 17,
    );
    await p.locator('a.bd-navitem[href="#/explore"]').click();
    await p.locator('a[href="#/book/movies"]').click();
    await p.fill('input[name="event_date"]', "2026-12-15");
    await p.fill('input[name="reminder_time"]', "09:15");
    await p.selectOption('select[name="mode"]', "days");
    await p.fill('input[name="amount"]', "7");
    await p.locator('#booking-form button[type="submit"]').click();
    await p.waitForSelector('[data-action="calendar"]');
    await p.locator('[data-action="calendar"]').click();
    const link = new URL(
      await p.locator("#google-calendar").getAttribute("href"),
    );
    check(
      link.hostname === "www.google.com" &&
        link.pathname === "/calendar/render",
      "Mobile browser template route",
    );
    check(
      link.searchParams.get("action") === "TEMPLATE" &&
        link.searchParams.get("dates") === "20261208T034500Z/20261208T040000Z",
      "Prefilled reminder date/time",
    );
    check(
      link.searchParams.get("text").includes("Movies") &&
        link.searchParams.get("details").includes("2026-12-15"),
      "Prefilled entered plan",
    );
    check(errors.length === 0, errors.join("\n"));
    return "PASS: 36 state labels at five widths; Next Booking layout; decoded image reuse; historical calendar; lamp icon; stale-year response guard; offline data/icon; prefilled Google reminder date/time/title/details; zero browser errors.";
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}
