import {z} from 'zod';
export const ACTIVE_WORK=['queued','running','waiting','waiting_input','paused','blocked','outcome_unknown'];
export const WORK_MAX_STEPS=36;
export const workCostSchema=z.number().min(.25).max(25).multipleOf(.25);
export const workPlanSchema=z.object({steps:z.array(z.object({id:z.string().regex(/^[a-z0-9_-]{1,30}$/),label:z.string().trim().min(1).max(160),status:z.enum(['pending','working','done']),dependsOn:z.array(z.string().max(30)).max(12),evidence:z.string().max(700)}).strict()).min(1).max(12)}).strict().superRefine((v,ctx)=>{
 const prior=new Map<string,string>();for(const s of v.steps){if(prior.has(s.id)||s.dependsOn.some(d=>!prior.has(d))||(s.status!=='pending'&&s.dependsOn.some(d=>prior.get(d)!=='done'))||(s.status==='done'&&!s.evidence.trim()))ctx.addIssue({code:'custom',message:'Use unique ordered steps; dependencies must be completed first and done steps need evidence.'});prior.set(s.id,s.status);}
});
export type WorkStep=z.infer<typeof workPlanSchema>['steps'][number];
export const assignmentControlSchema=z.object({operation:z.literal('assignment'),id:z.uuid(),threadId:z.uuid(),action:z.enum(['pause','resume']),message:z.string().trim().max(2000).default(''),maxCostDollars:workCostSchema.optional()}).strict();
export const workModelTools=[
 {type:'function',name:'update_work_plan',description:'Save a short plan and progress for a multi-step assignment. Dependencies reference earlier steps. Mark done only with actual saved results or evidence; a proposal is waiting, never done. This does not perform the steps.',strict:true,parameters:{type:'object',properties:{steps:{type:'array',items:{type:'object',properties:{id:{type:'string'},label:{type:'string'},status:{type:'string',enum:['pending','working','done']},dependsOn:{type:'array',items:{type:'string'}},evidence:{type:'string'}},required:['id','label','status','dependsOn','evidence'],additionalProperties:false}}},required:['steps'],additionalProperties:false}},
 {type:'function',name:'request_employee_input',description:'Pause this assignment for a necessary clarification. Ask one self-contained question; saved work and spending ceiling remain in place. Never use this to bypass exact action review.',strict:true,parameters:{type:'object',properties:{question:{type:'string'}},required:['question'],additionalProperties:false}},
];
