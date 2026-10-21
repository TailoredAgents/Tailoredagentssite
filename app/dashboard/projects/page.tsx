import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Search, ShieldCheck } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { DashboardPagination } from "@/components/dashboard/pagination";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { saveProjectAction } from "@/lib/operations/actions";
import { clientOptions, getWorkspaceMembers, listProjects, siteOptions } from "@/lib/operations/data";
import { formatOperationalDate, statusLabel } from "@/lib/operations/format";
import { projectStatuses } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[]; client?: string }> }) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  const [projects, clients, sites, members] = await Promise.all([
    listProjects(context, params), clientOptions(context), siteOptions(context), getWorkspaceMembers(context),
  ]);
  const selectedClient = clients.some((client) => client.id === params.client) ? params.client : "";
  const mutable = context.role !== "viewer";

  return (
    <>
      <header className="dashboard-topbar"><div><span>Operations</span><strong>Projects</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content">
        <section className="dashboard-page-heading dashboard-page-heading-compact"><div><span>Delivery</span><h1>Projects</h1><p>Track the active work, accountable owner, next milestones, decisions, and deliverables for every engagement.</p></div>{mutable ? <Link className="dashboard-primary-button" href="#create-project">Add project</Link> : null}</section>
        <div className="dashboard-list-create-grid">
          <div>
            <form className="dashboard-filter-bar" method="get"><label><Search size={15} /><input type="search" aria-label="Search projects" name="q" defaultValue={projects.q} placeholder="Search project or client" /></label><label><select aria-label="Filter projects by status" name="status" defaultValue={projects.status}><option value="all">All statuses</option>{projectStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label><button type="submit">Apply</button>{(projects.q || projects.status !== "all") ? <Link href="/dashboard/projects">Clear</Link> : null}</form>
            <section className="dashboard-panel dashboard-table-panel"><div className="dashboard-table-summary"><span><FolderKanban size={15} />{projects.total} project{projects.total === 1 ? "" : "s"}</span><small>Updated recently</small></div><div className="dashboard-data-table dashboard-projects-table"><div className="dashboard-data-head"><span>Project</span><span>Client</span><span>Owner</span><span>Progress</span><span>Due</span></div>{projects.items.length ? projects.items.map((project) => <Link className="dashboard-data-row" href={`/dashboard/projects/${project.id}`} key={project.id}><span data-label="Project"><strong>{project.name}</strong><small><em className={`dashboard-status status-${project.status}`}>{statusLabel(project.status)}</em></small></span><span data-label="Client"><strong>{project.client_name}</strong></span><span data-label="Owner"><strong>{project.owner_name || "Unassigned"}</strong></span><span data-label="Progress"><strong>{project.milestonesOpen} open milestone{project.milestonesOpen === 1 ? "" : "s"}</strong></span><time data-label="Due date">{project.dueAt ? formatOperationalDate(project.dueAt, { dateOnly: true }) : "No due date"}</time></Link>) : <div className="dashboard-empty"><FolderKanban size={21} /><strong>No projects match this view</strong></div>}</div><DashboardPagination basePath="/dashboard/projects" page={projects.page} pages={projects.pages} values={{ q: projects.q, status: projects.status }} /></section>
          </div>
          <aside id="create-project" className="dashboard-panel dashboard-create-panel"><div className="dashboard-panel-heading"><div><span>New engagement</span><h2>Create project</h2></div></div>{clients.length ? <OperationForm disabled={!mutable} action={saveProjectAction} submitLabel="Create project" pendingLabel="Creating"><fieldset disabled={!mutable} className="dashboard-form-grid"><label className="dashboard-field dashboard-field-full"><span>Client</span><select name="clientId" defaultValue={selectedClient} required><option value="" disabled>Select client</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label className="dashboard-field dashboard-field-full"><span>Project name</span><input name="name" required minLength={2} maxLength={180} /></label><label className="dashboard-field"><span>Owner</span><select name="ownerUserId" defaultValue={context.user.id}><option value="">Unassigned</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name || member.email}</option>)}</select></label><label className="dashboard-field"><span>Status</span><select name="status" defaultValue="planned">{projectStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label><label className="dashboard-field dashboard-field-full"><span>Related site</span><select name="siteId" defaultValue=""><option value="">No site</option>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label><label className="dashboard-field"><span>Start date</span><input type="date" name="startedAt" /></label><label className="dashboard-field"><span>Due date</span><input type="date" name="dueAt" /></label><label className="dashboard-field dashboard-field-full"><span>Summary</span><textarea name="summary" maxLength={4000} /></label></fieldset></OperationForm> : <div className="dashboard-empty"><FolderKanban size={21} /><strong>Create a client first</strong><p>Every project belongs to a client record.</p><Link href="/dashboard/clients#create-client">Create a client</Link></div>}</aside>
        </div>
      </div>
    </>
  );
}
