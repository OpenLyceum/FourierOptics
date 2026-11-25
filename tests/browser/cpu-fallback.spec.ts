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
