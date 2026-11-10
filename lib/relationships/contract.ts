import {z} from 'zod';
export const discoveryFields={problems:'Business problems',software:'Current software',workflows:'How work happens today',repetition:'Repetitive tasks',documents:'Document types and volumes',timeSpent:'Estimated time spent',outcomes:'Desired outcomes',opportunities:'Potential automations (ideas to explore)',nextSteps:'Agreed next steps'} as const;
export const targetSchema=z.object({kind:z.enum(['lead','business','opportunity','client','contact']),id:z.uuid()});
export type RelationshipTarget=z.infer<typeof targetSchema>;
export const fieldsSchema=z.object(Object.fromEntries(Object.keys(discoveryFields).map(k=>[k,z.string().trim().max(4000).default('')])) as Record<keyof typeof discoveryFields,z.ZodDefault<z.ZodString>>).strict();
export const discoverySchema=targetSchema.extend({fields:fieldsSchema}).refine(v=>Object.values(v.fields).some(Boolean),'Add at least one discovery detail.');
