/** Prices verified against official OpenAI documentation on 2026-10-26.
 * Keep this independent of SEO/call-analysis budgets. No unpriced model override.
 */
export const factoryModelPolicy = {
  model: "gpt-6.1-sol", pricing: "2026-10-26-standard-30m",
  maxToolCalls: 2, researchOutputTokens: 4000, planOutputTokens: 7000,
  // Responses web search has a 128k context window, even on larger models.
  searchContextTokens: 128000, providerTimeoutMs: 65000,
  maxInputBytes: 110000, maxResponseBytes: 1_000_000,
  maximumStageMicros: 5_000_000,
} as const;

export function factoryConfiguration() {
  return { configured: Boolean((process.env.FACTORY_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "").trim()) };
}
export const getFactoryConfiguration = factoryConfiguration;

/** Conservative pricing: long-context 30m cache-write and output rates; no cache discount.
 * USD/million tokens equals microdollars/token. Account-specific regional premiums
 * receive an additional 10% contingency. These are conservative estimates, not
 * provider invoices; unexpected overages pause further work. Searches cost $0.01/call.
 */
export function factoryUsageCost(inputTokens: number, outputTokens: number, toolCalls: number) {
  if (![inputTokens, outputTokens, toolCalls].every((n) => Number.isSafeInteger(n) && n >= 0))
    throw new Error("Invalid Factory provider usage.");
  return Math.ceil((inputTokens * 5 + outputTokens * 15 + toolCalls * 10000) * 1.1);
}

export function factoryReservation(stage: "research" | "plan", inputBytes: number) {
  if (!Number.isSafeInteger(inputBytes) || inputBytes < 0 || inputBytes > factoryModelPolicy.maxInputBytes)
    throw new Error("The planning context exceeds its size limit. Shorten the latest instructions.");
  if (stage === "research") {
    // Charge a full search context on each possible model turn, including the final
    // answer. Output bound is repeated too rather than assuming cumulative reporting.
    return factoryUsageCost((factoryModelPolicy.searchContextTokens + inputBytes + 8192) * (factoryModelPolicy.maxToolCalls + 1),
      factoryModelPolicy.researchOutputTokens * (factoryModelPolicy.maxToolCalls + 1), factoryModelPolicy.maxToolCalls);
  }
  return factoryUsageCost(inputBytes + 8192, factoryModelPolicy.planOutputTokens, 0);
}
