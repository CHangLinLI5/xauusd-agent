import { describe, expect, it } from "vitest";

/**
 * Integration tests for Custom LLM API.
 * These tests require real environment variables and network access.
 * They are skipped by default. To run them:
 *   RUN_INTEGRATION_TESTS=1 pnpm test
 */
const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1";
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration("Custom LLM API (integration)", () => {
  it("should have CUSTOM_LLM_API_URL configured", () => {
    const url = process.env.CUSTOM_LLM_API_URL;
    expect(url).toBeTruthy();
    // Validate it's a valid URL (no hardcoded IPs or secrets)
    expect(url).toMatch(/^https?:\/\/.+/);
  });

  it("should have CUSTOM_LLM_API_KEY configured", () => {
    const key = process.env.CUSTOM_LLM_API_KEY;
    expect(key).toBeTruthy();
    // Only check that it's a non-empty string, do not assert format
    expect(typeof key).toBe("string");
  });

  it("should have CUSTOM_LLM_MODEL configured", () => {
    const model = process.env.CUSTOM_LLM_MODEL;
    expect(model).toBeTruthy();
  });

  it("should successfully call the custom LLM API", async () => {
    const url = process.env.CUSTOM_LLM_API_URL;
    const key = process.env.CUSTOM_LLM_API_KEY;
    const model = process.env.CUSTOM_LLM_MODEL;

    if (!url || !key || !model) {
      console.warn("Custom LLM env vars not set, skipping live test");
      return;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 10,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    expect(data.choices[0].message.content).toBeTruthy();
  }, 30000);
});
