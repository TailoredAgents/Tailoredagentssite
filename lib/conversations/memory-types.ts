export type ClientMemory = {
  id: string; sourceId: string; category: "context" | "preference" | "commitment" | "question";
  text: string; quote: string; evidenceId: string; occurredAt: string;
  origin: "call" | "assistant" | "team"; useInDrafts: boolean; edited: boolean;
  revision: number; channel: string; conversationId: string;
};
export const memoryLabels = { context: "About the client", preference: "Preference", commitment: "Commitment", question: "Open question" } as const;
