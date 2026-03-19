import { describe, expect, it } from "vitest";

describe("Custom LLM API", () => {
  it("should have CUSTOM_LLM_API_URL configured", () => {
    const url = process.env.CUSTOM_LLM_API_URL;
    expect(url).toBeTruthy();
    expect(url).toContain("104.238.222.107");
  });

  it("should have CUSTOM_LLM_API_KEY configured", () => {
    const key = process.env.CUSTOM_LLM_API_KEY;
    expect(key).toBeTruthy();
    expect(key!.startsWith("sk-")).toBe(true);
  });

  it("should have CUSTOM_LLM_MODEL configured", () => {
    const model = process.env.CUSTOM_LLM_MODEL;
    expect(model).toBeTruthy();
    expect(model).toBe("gpt-5.4");
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
