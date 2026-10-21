import "./inbox.css";

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <div className="inbox-workspace">{children}</div>;
}
