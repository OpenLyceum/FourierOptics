import { expect, test } from "@playwright/test";

test("WebGPU disabled launches the CPU fallback and explains the badge", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?screens=2&backend=gpu&ea");
  await expect(page.getByText("Compute backend CPU fallback, grid 256 by 256 samples.")).toBeAttached();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "WebGPU is unavailable. The simulation is running on the CPU." }),
  ).toBeAttached();
  await expect(page.getByRole("button", { name: "Dismiss" })).toBeAttached();
  await page.getByRole("button", { name: "Dismiss" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Automatic skips device creation for a reported software adapter", async ({ page }) => {
  await page.addInitScript(() => {
    let deviceRequested = false;
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.dataset["deviceRequested"] = String(deviceRequested);
    });
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: async () => ({
          info: { isFallbackAdapter: true },
          requestDevice: () => {
            deviceRequested = true;
            document.documentElement.dataset["deviceRequested"] = String(deviceRequested);
            throw new Error("Automatic attempted to open a software device.");
          },
        }),
      },
    });
  });
  await page.goto("/?screens=2&backend=auto&ea");
  await expect(page.getByText("Compute backend CPU fallback, grid 256 by 256 samples.")).toBeAttached();
  await expect(page.locator("html")).toHaveAttribute("data-device-requested", "false");
});
