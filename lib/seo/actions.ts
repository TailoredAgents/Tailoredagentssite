"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import type { OperationActionState } from "@/lib/operations/validation";
import { ReportingAccessError } from "@/lib/dashboard/site-access";
import {
  saveSeoSettings,
  pauseSeo,
  queueSeoRun,
  publishSeoChange,
  rollbackSeoChange,
  rejectSeoChange,
  reconcileSeoCost,
} from "./service";
import { SeoInputError } from "./types";
function fail(error: unknown): OperationActionState {
  return {
    status: "error",
    message:
      error instanceof ZodError
        ? error.issues[0]?.message || "Review the form."
        : error instanceof SeoInputError
          ? error.message
          : error instanceof ReportingAccessError
            ? "An owner or administrator must perform this SEO action."
            : "The SEO change could not be confirmed. Refresh before trying again.",
  };
}
function refresh() {
  revalidatePath("/dashboard/seo");
  revalidatePath("/dashboard/seo/changes/[id]", "page");
}
export async function saveSeoSettingsAction(
  _: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    await saveSeoSettings(context, {
      enabled: form.get("enabled") === "on",
      aiEnabled: form.get("aiEnabled") === "on",
      budget: form.get("budget"),
      localMarkets: form.get("localMarkets"),
      keywords: form.get("keywords"),
      instructions: form.get("instructions"),
      profileReviewed: form.get("profileReviewed") === "on",
    });
    refresh();
    return { status: "success", message: "SEO settings saved." };
  } catch (e) {
    return fail(e);
  }
}
export async function pauseSeoAction(): Promise<void> {
  await pauseSeo(await requireDashboardContext());
  refresh();
}
export async function queueSeoAction(
  _: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    const kind = String(form.get("kind"));
    if (!["monitor", "strategy", "research"].includes(kind))
      throw new SeoInputError("Choose a supported SEO run.");
    await queueSeoRun(context, kind as "monitor" | "strategy" | "research");
    refresh();
    return {
      status: "success",
      message: "Queued. The SEO worker will pick this up on its next check.",
    };
  } catch (e) {
    return fail(e);
  }
}
export async function publishSeoAction(
  _: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    const path = await publishSeoChange(context, {
      id: form.get("id"),
      version: form.get("version"),
      title: form.get("title"),
      description: form.get("description"),
      factChecked: form.get("factChecked") === "on",
    });
    revalidatePath(path);
    refresh();
    return {
      status: "success",
      message:
        "Published. A live verification and 28-day observation window are scheduled.",
    };
  } catch (e) {
    return fail(e);
  }
}
export async function rollbackSeoAction(
  _: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    const path = await rollbackSeoChange(context, String(form.get("id")));
    revalidatePath(path);
    refresh();
    return {
      status: "success",
      message: "The previous search metadata was restored.",
    };
  } catch (e) {
    return fail(e);
  }
}
export async function rejectSeoAction(
  _: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    await rejectSeoChange(context, String(form.get("id")));
    refresh();
    return {
      status: "success",
      message: "Proposal rejected. Its history is retained for the next plan.",
    };
  } catch (e) {
    return fail(e);
  }
}
export async function reconcileSeoAction(
  _: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const context = await requireDashboardContext();
  try {
    await reconcileSeoCost(context, Object.fromEntries(form));
    refresh();
    return {
      status: "success",
      message:
        "Provider charge reconciled. A new run can be queued when ready.",
    };
  } catch (e) {
    return fail(e);
  }
}
