import {randomUUID} from 'node:crypto';
export function RequestIdentity({action,values={}}:{action:string;values?:Record<string,string|number>}) {
 return <><input type="hidden" name="action" value={action}/><input type="hidden" name="requestId" value={randomUUID()}/>{Object.entries(values).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}</>;
}
export function Field({label,name,value,required=false,type='text',maxLength=2000,rows,children}:{label:string;name:string;value?:string;required?:boolean;type?:string;maxLength?:number;rows?:number;children?:React.ReactNode}) {
 return <label className="dashboard-field"><span>{label}</span>{children??(rows?<textarea name={name} defaultValue={value} rows={rows} maxLength={maxLength} required={required}/>:<input type={type} name={name} defaultValue={value} maxLength={maxLength} required={required}/>)}</label>;
}
export function Confirm({children}:{children:React.ReactNode}) {return <label className="work-confirm"><input type="checkbox" name="confirm" value="yes" required/><span>{children}</span></label>;}
export const dollars=(cents:number|string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents)/100);
export const dateOnly=(value:string|Date)=>new Date(value).toISOString().slice(0,10);
