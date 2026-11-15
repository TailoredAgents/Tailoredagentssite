'use client';
import {useState} from 'react';
import type {InvoiceDetails} from '@/lib/commercial/contract';
type Line=InvoiceDetails['lines'][number];
const empty:Line={description:'',classification:'recurring',amountCents:0,startsOn:null,endsOn:null};
export function InvoiceLines({initial=[]}:{initial?:Line[]}){
 const [lines,setLines]=useState(()=>initial.length?initial:[empty]);
 return <div>{lines.map((line,i)=><fieldset key={i} className="dashboard-panel work-record"><legend>Line {i+1}</legend><div className="dashboard-form-grid dashboard-form-grid-two">
 <label className="dashboard-field"><span>Description</span><input name="description" required maxLength={240} defaultValue={line.description}/></label>
 <label className="dashboard-field"><span>Revenue category</span><select name="classification" defaultValue={line.classification}><option value="recurring">Recurring service</option><option value="upfront">Upfront project / setup</option><option value="tax">Tax</option><option value="pass_through">Pass-through expense</option><option value="other">Other / review needed</option></select></label>
 <label className="dashboard-field"><span>Line total (USD)</span><input name="amount" inputMode="decimal" required defaultValue={line.amountCents?String(line.amountCents/100):''} placeholder="0.00"/></label>
 <label className="dashboard-field"><span>Service start (required for recurring)</span><input name="startsOn" type="date" defaultValue={line.startsOn??''}/></label>
 <label className="dashboard-field"><span>Service end (inclusive; required for recurring)</span><input name="endsOn" type="date" defaultValue={line.endsOn??''}/></label>
 </div></fieldset>)}<div className="work-focus-links"><button type="button" className="dashboard-secondary-button" disabled={lines.length>=50} onClick={()=>setLines([...lines,{...empty}])}>Add invoice line</button>{lines.length>1&&<button type="button" className="dashboard-secondary-button" onClick={()=>setLines(lines.slice(0,-1))}>Remove last line</button>}</div></div>;
}
export function BudgetParticipants({members,initial=[]}:{members:{id:string;name:string}[];initial?:{userId:string;role:'closer'|'developer';amountCents:number;condition:string}[]}){
 const [rows,setRows]=useState(()=>initial.length?initial:[{userId:'',role:'developer' as const,amountCents:0,condition:''}]);
 return <div>{rows.map((r,i)=><fieldset key={i} className="dashboard-panel work-record"><legend>Contributor {i+1}</legend><div className="dashboard-form-grid dashboard-form-grid-two"><label className="dashboard-field"><span>Teammate</span><select name="participant" required defaultValue={r.userId}><option value="">Choose teammate</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="dashboard-field"><span>Work performed</span><select name="participantRole" defaultValue={r.role}><option value="developer">Development</option><option value="closer">Sales closing</option></select></label><label className="dashboard-field"><span>Approved amount (USD)</span><input name="participantAmount" inputMode="decimal" required defaultValue={r.amountCents?String(r.amountCents/100):''}/></label><label className="dashboard-field"><span>Payment conditions</span><textarea name="condition" required defaultValue={r.condition} maxLength={2000}/></label></div></fieldset>)}<div className="work-focus-links"><button type="button" className="dashboard-secondary-button" disabled={rows.length>=30} onClick={()=>setRows([...rows,{userId:'',role:'developer',amountCents:0,condition:''}])}>Add contributor</button>{rows.length>1&&<button type="button" className="dashboard-secondary-button" onClick={()=>setRows(rows.slice(0,-1))}>Remove last contributor</button>}</div></div>;
}
