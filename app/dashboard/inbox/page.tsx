import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { listConversationWorkspace } from "@/lib/conversations/data";
import type { ConversationFilters } from "@/lib/conversations/types";
import { ConversationWorkspace } from "@/components/conversations/workspace";
import LegacyEmailPage from "@/components/conversations/legacy-email-page";
import { SmsWorkspacePage } from "@/components/sms/workspace";
import "./sms.css";
import "./conversations.css";

export const metadata: Metadata = { title: "Conversations" };
type Filters = ConversationFilters & { channel?: string | string[]; mailbox?: string | string[]; number?: string | string[]; compose?: string | string[]; unread?: string | string[] };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function InboxPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const channel = one(filters.channel);
  if (channel === "sms") return <><Link className="conversation-legacy-back" href="/dashboard/inbox"><ArrowLeft size={16} aria-hidden="true" />Back to customer conversations</Link><SmsWorkspacePage filters={filters} /></>;
  if (channel === "email" || (!one(filters.conversation) && (one(filters.mailbox) || one(filters.thread) || one(filters.compose)))) return <><Link className="conversation-legacy-back" href="/dashboard/inbox"><ArrowLeft size={16} aria-hidden="true" />Back to customer conversations</Link><LegacyEmailPage searchParams={Promise.resolve(filters)} /></>;
  const context = await requireDashboardContext();
  const data = await listConversationWorkspace(context, filters);
  if (one(filters.text) && !data.selected) notFound();
  if ((one(filters.contact) || one(filters.lead)) && !data.recipient) notFound();
  return <ConversationWorkspace key={one(filters.contact) || one(filters.lead) || data.selected?.conversation.id || "list"} data={data} userId={context.user.id} readOnly={context.role === "viewer"} />;
}
