import {z} from 'zod';
import {createLeadSchema} from '@/lib/operations/validation';
// Reuse field normalization without requiring a phone/email for an encounter.
export const encounterSchema=z.object(createLeadSchema.shape).omit({submissionId:true}).extend({
 requestId:z.uuid(),leadId:z.uuid().optional(),createSeparate:z.boolean().default(false),
 channel:z.enum(['meetup','business_visit','phone','referral','other']),eventName:z.string().trim().max(200).default(''),metAt:z.iso.datetime({offset:true}).optional(),
 notes:z.string().trim().max(4000).default(''),ownerUserId:z.string().min(1).max(200),appointmentSetterUserId:z.string().max(200).default(''),partnerId:z.uuid().optional(),
}).superRefine((v,c)=>{if(!v.leadId&&![v.name,v.organization,v.email,v.phone,v.notes,v.eventName].some(Boolean))c.addIssue({code:'custom',message:'Add anything you know: a name, meeting context or contact detail.'});});
export const focusSchema=z.object({focus:z.enum(['relationships','appointments','delivery','finance'])});
export type WorkFocus=z.infer<typeof focusSchema>['focus'];
export const focusLabels:Record<WorkFocus,string>={relationships:'Sales & relationships',appointments:'Appointment setting',delivery:'Development & delivery',finance:'Finance & partnerships'};
