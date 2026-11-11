import { Fragment } from "react";
import styles from "@/components/dashboard/admin-polish.module.css";
import { formatEasternTime } from "@/lib/time";
import type { Metadata } from "next";
import { Activity, ShieldCheck } from "lucide-react";
import { getDashboardActivity, requireDashboardContext } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Activity" };

function formatAction(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[._\s-]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default async function ActivityPage() {
  const context = await requireDashboardContext();
  const activity = await getDashboardActivity(context);

  return (
    <>
      <header className="dashboard-topbar"><div><span>System</span><strong>Activity</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className={`dashboard-content ${styles.activity}`}>
        <section className="dashboard-page-heading dashboard-page-heading-compact"><div><span>Team history</span><h1>Workspace activity</h1><p>The latest 100 account and workspace changes, with who made them and when. Times are shown in US Eastern (EST/EDT).</p></div></section>
        <section className="dashboard-panel dashboard-log-panel">
          <div className="dashboard-log-head"><span>Event</span><span>Actor</span><span>Target</span><span>Time</span></div>
          {activity.length ? activity.map((item, index) => (
            <Fragment key={item.id}>{(index===0||formatEasternTime(activity[index-1].createdAt,{dateOnly:true})!==formatEasternTime(item.createdAt,{dateOnly:true}))&&<h2 className={styles.logDate}>{formatEasternTime(item.createdAt,{dateOnly:true})}</h2>}
            <article className="dashboard-log-row" key={item.id}>
              <span><i><Activity size={14} /></i><strong title={item.action}>{formatAction(item.action)}</strong></span>
              <span data-label="Team member">{item.actorName}</span>
              <span data-label="Record">{formatAction(item.targetType)}</span>
              <time data-label="Time (Eastern)" dateTime={item.createdAt}>{formatEasternTime(item.createdAt)}</time>
            </article></Fragment>
          )) : <div className="dashboard-empty dashboard-log-empty"><Activity size={21} /><strong>No recorded events</strong><p>The first membership and future operational changes will appear here.</p></div>}
        </section>
      </div>
    </>
  );
}
