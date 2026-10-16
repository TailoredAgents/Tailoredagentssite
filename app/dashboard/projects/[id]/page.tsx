import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDot, FileCheck2, Gavel, MessageSquareText, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { OperationForm } from "@/components/dashboard/operation-form";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { addMilestoneAction, addProjectRecordAction, saveProjectAction, updateMilestoneStatusAction } from "@/lib/operations/actions";
import { clientOptions, getProject, getWorkspaceMembers, siteOptions } from "@/lib/operations/data";
import { formatOperationalDate, inputDate, statusLabel } from "@/lib/operations/format";
import { milestoneStatuses, projectStatuses, recordKinds } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Project workspace" };

const recordIcons = { deliverable: FileCheck2, decision: Gavel, note: MessageSquareText } as const;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireDashboardContext();
  const { id } = await params;
  const [project, clients, sites, members] = await Promise.all([
    getProject(context, id), clientOptions(context), siteOptions(context), getWorkspaceMembers(context),
  ]);
  if (!project) notFound();
  const mutable = context.role !== "viewer";

  return (
    <>
      <header className="dashboard-topbar"><div><span>Projects</span><strong>{project.name}</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content">
        <Link className="dashboard-back-link" href="/dashboard/projects"><ArrowLeft size={14} />Back to projects</Link>
        <section className="dashboard-page-heading dashboard-page-heading-compact dashboard-record-heading"><div><span>{project.client_name}</span><h1>{project.name}</h1><p>{project.summary || "No project summary has been recorded yet."}</p></div><em className={`dashboard-status status-${project.status}`}>{statusLabel(project.status)}</em></section>
        <div className="dashboard-record-grid">
          <div className="dashboard-record-main">
            <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Plan</span><h2>Milestones</h2></div><small>{project.milestones.length}</small></div><div className="dashboard-milestone-list">{project.milestones.length ? project.milestones.map((milestone) => <article key={milestone.id}><span>{milestone.status === "completed" ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}</span><div><strong>{milestone.title}</strong><small>{milestone.dueAt ? `Due ${formatOperationalDate(milestone.dueAt, { dateOnly: true })}` : "No due date"}</small></div><form action={updateMilestoneStatusAction}><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="milestoneId" value={milestone.id} /><select name="status" defaultValue={milestone.status} disabled={!mutable}>{milestoneStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select><button type="submit" disabled={!mutable}>Update</button></form></article>) : <div className="dashboard-empty"><CircleDot size={21} /><strong>No milestones yet</strong></div>}</div><OperationForm action={addMilestoneAction} submitLabel="Add milestone" resetOnSuccess><fieldset disabled={!mutable} className="dashboard-form-grid dashboard-form-grid-three"><input type="hidden" name="projectId" value={project.id} /><label className="dashboard-field"><span>Milestone</span><input name="title" required minLength={2} maxLength={220} /></label><label className="dashboard-field"><span>Status</span><select name="status" defaultValue="pending">{milestoneStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label><label className="dashboard-field"><span>Due date</span><input name="dueAt" type="date" /></label></fieldset></OperationForm></section>

            <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Working record</span><h2>Deliverables, decisions, and notes</h2></div></div><OperationForm action={addProjectRecordAction} submitLabel="Add record" resetOnSuccess><fieldset disabled={!mutable} className="dashboard-form-grid dashboard-form-grid-two"><input type="hidden" name="projectId" value={project.id} /><label className="dashboard-field"><span>Type</span><select name="kind" defaultValue="note">{recordKinds.map((kind) => <option value={kind} key={kind}>{statusLabel(kind)}</option>)}</select></label><label className="dashboard-field"><span>Title</span><input name="title" required minLength={2} maxLength={220} /></label><label className="dashboard-field dashboard-field-full"><span>Detail</span><textarea name="body" maxLength={8000} /></label></fieldset></OperationForm><div className="dashboard-record-list">{project.records.length ? project.records.map((record) => { const Icon = recordIcons[record.kind as keyof typeof recordIcons] || MessageSquareText; return <article key={record.id}><span><Icon size={16} /></span><div><small>{statusLabel(record.kind)}</small><h3>{record.title}</h3>{record.body ? <p>{record.body}</p> : null}<em>{record.authorName} · {formatOperationalDate(record.createdAt)}</em></div></article>; }) : <div className="dashboard-empty"><MessageSquareText size={21} /><strong>No project records yet</strong></div>}</div></section>
          </div>

          <aside className="dashboard-record-aside"><section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Project controls</span><h2>Engagement settings</h2></div></div><OperationForm action={saveProjectAction} submitLabel="Save project"><fieldset disabled={!mutable} className="dashboard-form-grid"><input type="hidden" name="projectId" value={project.id} /><label className="dashboard-field dashboard-field-full"><span>Client</span><select name="clientId" defaultValue={project.client_id}>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label className="dashboard-field dashboard-field-full"><span>Project name</span><input name="name" defaultValue={project.name} required minLength={2} maxLength={180} /></label><label className="dashboard-field"><span>Owner</span><select name="ownerUserId" defaultValue={project.owner_user_id || ""}><option value="">Unassigned</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name || member.email}</option>)}</select></label><label className="dashboard-field"><span>Status</span><select name="status" defaultValue={project.status}>{projectStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label><label className="dashboard-field dashboard-field-full"><span>Related site</span><select name="siteId" defaultValue={project.site_id || ""}><option value="">No site</option>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label><label className="dashboard-field"><span>Start date</span><input type="date" name="startedAt" defaultValue={inputDate(project.startedAt)} /></label><label className="dashboard-field"><span>Due date</span><input type="date" name="dueAt" defaultValue={inputDate(project.dueAt)} /></label><label className="dashboard-field dashboard-field-full"><span>Summary</span><textarea name="summary" defaultValue={project.summary || ""} maxLength={4000} /></label></fieldset></OperationForm></section></aside>
        </div>
      </div>
    </>
  );
}
