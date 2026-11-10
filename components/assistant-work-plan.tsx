import type {WorkStep} from '@/lib/assistant/assignment-contract';
export function AssistantWorkPlan({steps}:{steps:WorkStep[]}){
 if(!steps.length)return null;
 return <details className="assistant-work-plan" open={steps.some(s=>s.status!=='done')}><summary>Plan · {steps.filter(s=>s.status==='done').length} of {steps.length} complete</summary><ol>{steps.map(s=><li key={s.id}><strong>{s.label}</strong> · {s.status}{s.evidence&&<p>{s.evidence}</p>}</li>)}</ol></details>;
}
