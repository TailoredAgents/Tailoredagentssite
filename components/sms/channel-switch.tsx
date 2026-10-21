import Link from "next/link";
import { Mail, MessageSquareText } from "lucide-react";

export function InboxChannelSwitch({ active }: { active: "email" | "sms" }) {
  return <nav className="inbox-channel-switch" aria-label="Inbox channel"><Link href="/dashboard/inbox" className={active === "email" ? "is-current" : ""} aria-current={active === "email" ? "page" : undefined}><Mail size={17} aria-hidden="true" />Email</Link><Link href="/dashboard/inbox?channel=sms" className={active === "sms" ? "is-current" : ""} aria-current={active === "sms" ? "page" : undefined}><MessageSquareText size={17} aria-hidden="true" />SMS</Link></nav>;
}
