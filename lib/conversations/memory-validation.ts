import { z } from "zod";
export const memoryCategory = z.enum(["context", "preference", "commitment", "question"]);
export const memorySuggestionSchema = z.object({
  evidenceId: z.string().max(300), category: memoryCategory,
  text: z.string().trim().min(1).max(1200), quote: z.string().trim().min(8).max(1200),
}).strict();
export const memorySuggestionsSchema = z.array(memorySuggestionSchema).max(8);
export type MemorySuggestion = z.infer<typeof memorySuggestionSchema>;
export const memoryEditSchema = z.object({
  sourceId: z.uuid(), id: z.uuid().optional(), revision: z.number().int().positive().optional(),
  category: memoryCategory, text: z.string().trim().min(1).max(1200),
  useInDrafts: z.boolean(), dismiss: z.boolean().optional(),
}).strict();
