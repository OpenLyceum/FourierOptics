import { defineConfig } from "@playwright/test";
import template from "./playwright.config.js";

export default defineConfig(template, {
  testDir: "./tests/browser",
  projects: [
    {
      name: "chromium",
      testMatch: "webgpu.spec.ts",
      use: { browserName: "chromium", launchOptions: { args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"] } },
    },
    {
      name: "chromium-no-webgpu",
      testMatch: "cpu-fallback.spec.ts",
      use: { browserName: "chromium", launchOptions: { args: ["--disable-features=WebGPU,WebGPUService"] } },
    },
  ],
});
