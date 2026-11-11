import {z} from 'zod';

export const modelProfileSchema=z.object({model:z.enum(['gpt-6.1-sol','gpt-6-astra']),effort:z.enum(['low','medium','high'])}).strict();
export type ModelProfile=z.infer<typeof modelProfileSchema>;
export const DEFAULT_PROFILE:ModelProfile={model:'gpt-6.1-sol',effort:'low'};
export const routingSchema=modelProfileSchema.extend({reason:z.string().trim().min(20).max(600)});
export const reasoningTool={type:'function',name:'adjust_reasoning',description:'Adjust reasoning for the next steps. Use Sol low for routine work, medium for planning/comparisons, high for difficult analysis. Astra high is reserved for exceptional unresolved analytical complexity AFTER a completed Sol high attempt; explain the remaining analytical problem. Never escalate for missing data, permissions, or tool failures. At most two Astra requests and four routing changes per assignment. Return to Sol for ordinary work.',strict:true,parameters:{type:'object',properties:{model:{type:'string',enum:['gpt-6.1-sol','gpt-6-astra']},effort:{type:'string',enum:['low','medium','high']},reason:{type:'string'}},required:['model','effort','reason'],additionalProperties:false}};

export function resolveProfile(requested:ModelProfile,history:{model:string;effort:string;status:string}[]):ModelProfile{
 const profile=modelProfileSchema.parse(requested);
 if(profile.model==='gpt-6.1-sol')return profile;
 // Request ledger evidence, not a model-supplied claim of a prior attempt.
 const eligible=history.some(r=>r.model==='gpt-6.1-sol'&&r.effort==='high'&&r.status==='completed');
 const exhausted=history.filter(r=>r.model==='gpt-6-astra').length>=2;
 return eligible&&!exhausted?{model:'gpt-6-astra',effort:'high'}:{model:'gpt-6.1-sol',effort:'high'};
}
export function outputLimit(p:ModelProfile){return p.effort==='high'?8000:p.effort==='medium'?5000:3000;}
// Conservative 30-minute cache-write input rate. Estimates, not an OpenAI invoice.
export function modelCost(p:ModelProfile,input:number,output:number){const long=input>272000;return Math.ceil(input*(p.model==='gpt-6-astra'?12.5:2.5)*(long?2:1)+output*(p.model==='gpt-6-astra'?50:10)*(long?1.5:1));}
export function modelReservation(p:ModelProfile,bytes:number){
 if(bytes>100000)throw new Error('This conversation is too large. Start a new chat.');
 return modelCost(p,bytes+8192,outputLimit(p));
}
export function transferableInput(input:unknown,changed:boolean){
 // Encrypted reasoning belongs to the model that produced it. Keep visible context and tool receipts.
 return changed&&Array.isArray(input)?input.filter(item=>!(item&&typeof item==='object'&&item.type==='reasoning')):input;
}
