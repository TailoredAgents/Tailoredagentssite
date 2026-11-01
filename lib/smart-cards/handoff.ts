import {z} from 'zod';

export const cardInterests=['Let’s talk','Website','AI & automation','Custom software','Smart cards'] as const;
// A suggestion for a visitor to edit, never an instruction to write to the CRM.
export const handoffDraftSchema=z.object({
 name:z.string().max(100),email:z.string().max(254),phone:z.string().max(40),organization:z.string().max(140),
 message:z.string().max(2000),interest:z.enum(cardInterests),
 requestKind:z.enum(['inquiry','appointment']),preferredTime:z.string().max(240),
}).strict();
export type HandoffDraft=z.infer<typeof handoffDraftSchema>;
export const assistantReplySchema=z.object({answer:z.string().trim().min(1).max(2000),draft:handoffDraftSchema.nullable()}).strict();
export const assistantReplyFormat={type:'json_schema',name:'card_assistant_reply',strict:true,schema:{
 type:'object',additionalProperties:false,required:['answer','draft'],properties:{
  answer:{type:'string',maxLength:2000},
  draft:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,
   required:['name','email','phone','organization','message','interest','requestKind','preferredTime'],
   properties:{name:{type:'string',maxLength:100},email:{type:'string',maxLength:254},phone:{type:'string',maxLength:40},organization:{type:'string',maxLength:140},message:{type:'string',maxLength:2000},interest:{type:'string',enum:cardInterests},requestKind:{type:'string',enum:['inquiry','appointment']},preferredTime:{type:'string',maxLength:240}},
  }]},
 },
}};
