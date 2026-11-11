import {z} from 'zod';
import {targetSchema} from './contract';
export const briefFields={workflow:'Confirmed workflow and problem',systems:'Systems and access required',volumes:'Document or transaction volumes',baseline:'Current time, cost and evidence',outcomes:'Desired outcome',assumptions:'Assumptions and unknowns',pilot:'Proposed pilot and boundaries',checkpoints:'Where a person stays in control',acceptance:'How the team will accept the work',delivery:'Delivery responsibility',support:'Agreed support and ongoing scope'} as const;
export const briefFieldsSchema=z.object(Object.fromEntries(Object.keys(briefFields).map(k=>[k,z.string().trim().max(4000).default('')])) as Record<keyof typeof briefFields,z.ZodDefault<z.ZodString>>).strict();
export const briefSourceSchema=z.object({kind:z.enum(['discovery','meeting']),id:z.uuid()});
export const briefSchema=targetSchema.extend({requestId:z.uuid(),briefId:z.uuid().optional(),revision:z.number().int().positive().optional(),title:z.string().trim().min(2).max(180),status:z.enum(['draft','reviewed']),fields:briefFieldsSchema,sources:z.array(briefSourceSchema).max(20).default([])}).superRefine((v,c)=>{
 if(v.briefId&&!v.revision)c.addIssue({code:'custom',message:'Read the current brief revision before editing.'});
 if(!Object.values(v.fields).some(Boolean))c.addIssue({code:'custom',message:'Add at least one useful detail.'});
 if(v.status==='reviewed'&&(!v.fields.pilot||!v.fields.acceptance||!v.fields.delivery))c.addIssue({code:'custom',message:'A reviewed brief needs the pilot, acceptance criteria and delivery responsibility.'});
});
