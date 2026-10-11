async function checkControls(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(new URL(page.url()).origin + "/#/insights");
  await p.waitForFunction(() => document.body.dataset.route === "insights");
  await p.screenshot({ path: "output/playwright/insights-controls.png" });
  await p
    .getByRole("button", { name: "Travel destination", exact: true })
    .click();
  await p.getByRole("searchbox", { name: "Search choices" }).fill("Goa");
  await p.getByRole("option", { name: "Goa", exact: true }).click();
  if (
    !(await p.locator(".bd-hero img").getAttribute("src")).includes("goa_coast")
  )
    throw Error("Destination art");
  await p
    .getByRole("button", { name: "Increase Stay duration in days" })
    .click();
  if ((await p.locator("[name=duration]").inputValue()) !== "4")
    throw Error("Stay stepper");
  await p.getByRole("button", { name: "Track This Trip", exact: true }).click();
  await p.waitForURL("**/#/book/hotels");
  if ((await p.locator("[name=destination]").inputValue()) !== "Goa")
    throw Error("Trip transfer");
  await p
    .getByRole("button", { name: "Choose reminder time", exact: true })
    .click();
  await p.getByRole("spinbutton", { name: "Hour", exact: true }).fill("9");
  await p.getByRole("spinbutton", { name: "Minute", exact: true }).fill("15");
  await p.getByRole("button", { name: "Use this time", exact: true }).click();
  if ((await p.locator("[name=reminder_time]").inputValue()) !== "09:15")
    throw Error("Time picker");
  await p
    .getByRole("button", { name: "Choose event date", exact: true })
    .click();
  await p.getByRole("spinbutton", { name: "Picker year" }).fill("2028");
  await p.getByRole("spinbutton", { name: "Picker year" }).press("Tab");
  await p.getByRole("button", { name: "Picker month", exact: true }).click();
  await p.getByRole("option", { name: "February", exact: true }).click();
  await p.getByRole("button", { name: "2028-02-29", exact: true }).click();
  if ((await p.locator("[name=event_date]").inputValue()) !== "2028-02-29")
    throw Error("Leap-date picker");
  await p.locator("[name=reminder_time]").fill("");
  await p.locator(".find-date").click();
  if (!p.url().includes("book/hotels")) throw Error("Required reminder time");
  await p.locator("[name=reminder_time]").fill("09:15");
  if (errors.length) throw Error(errors.join("\n"));
  await context.close();
  return "PASS: themed state selector, number stepper, trip handoff, time picker, leap-date picker, required reminder time; zero page errors.";
}
