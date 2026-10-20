import { analyticsEventSchema } from "./validation";

export const measurementSchema = analyticsEventSchema.omit({
  id: true,
  eventName: true,
  target: true,
  targetPath: true,
  formType: true,
});
export type MeasurementContext = import("zod").infer<typeof measurementSchema>;

export function privacyRequested(headers: Headers) {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}

export function readMeasurement(value: unknown, headers: Headers) {
  if (privacyRequested(headers)) return undefined;
  const parsed = measurementSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
