"use client";
import {useActionState} from "react";
import Link from "next/link";
import {ArrowUpRight,Check,LoaderCircle,Sparkles} from "lucide-react";
import {LocalTime} from "@/components/sales/date-time-field";
import type {FactoryWorkNotice,FactoryWorkNoticeList} from "@/lib/factory/work-notices";
import type {FactoryActionState} from "@/lib/factory/types";
import {markFactoryWorkNoticeSeenAction} from "@/lib/factory/work-notice-actions";

const copy={plan_ready:{title:"Website plan ready",detail:"Review the proposal, add any direction, then approve when you are ready.",action:"Review plan"},website_ready:{title:"Website ready to share",detail:"Your checked preview is ready. Open the project to view it and copy its link.",action:"Open website project"},needs_attention:{title:"Website needs attention",detail:"Open the project to see what stopped and the next step.",action:"Review issue"}};

export function FactoryWorkNotices({data,team=false}:{data:FactoryWorkNoticeList;team?:boolean}){
  if(!data.items.length)return null;
  return <section className="dashboard-panel sales-panel factory-work-notices" aria-label="Website updates"><header className="sales-panel-heading"><div><span className="sales-eyebrow">{team?"Team website updates":"Your website updates"}</span><h2><Sparkles size={18} aria-hidden="true"/>Ready for your next step</h2><p>Unassigned updates stay visible to the team. Mark seen acknowledges an update for everyone; the website stays available.</p></div></header><div className="factory-work-notice-list">{data.items.slice(0,5).map(notice=><WorkNotice key={notice.id} notice={notice} canEdit={data.canEdit}/>)}</div>{data.items.length>5?<details className="factory-work-notices-more"><summary>Show {data.items.length-5} more website updates</summary>{data.items.slice(5).map(notice=><WorkNotice key={notice.id} notice={notice} canEdit={data.canEdit}/>)}</details>:null}</section>;
}
function WorkNotice({notice,canEdit}:{notice:FactoryWorkNotice;canEdit:boolean}){
  return <article className="factory-work-notice"><div><strong>{notice.leadName} · {copy[notice.kind].title}</strong><p>{copy[notice.kind].detail}</p><small>{notice.ownerName||"Team · unassigned"} · <LocalTime value={notice.createdAt}/></small></div><div className="factory-work-notice-actions"><Link className="sales-button" href={`/dashboard/sales/factory/${notice.projectId}`}>{copy[notice.kind].action}<ArrowUpRight size={14}/></Link>{canEdit?<SeenButton notice={notice}/>:null}</div></article>;
}
function SeenButton({notice}:{notice:FactoryWorkNotice}){
  const [state,action,pending]=useActionState(async(previous:FactoryActionState,form:FormData):Promise<FactoryActionState>=>{
    try{return await markFactoryWorkNoticeSeenAction(previous,form);}catch{return {status:"error",message:"The update could not be marked seen. Please try again."};}
  },{status:"idle"});
  return <form action={action}><input type="hidden" name="noticeId" value={notice.id}/><button className="sales-button" disabled={pending} aria-label={`Mark ${notice.leadName} website update seen`}>{pending?<LoaderCircle size={14}/>:<Check size={14}/>}Mark seen</button>{state.status==="error"?<p className="factory-form-message is-error" role="alert">{state.message}</p>:null}</form>;
}
