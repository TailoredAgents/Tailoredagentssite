import {z} from 'zod';
const binding={installationId:z.uuid(),secret:z.string().regex(/^[A-Za-z0-9_-]{43,128}$/)};
export const pushRequestSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('register'),...binding,token:z.string().regex(/^[a-f0-9]{32,512}$/),environment:z.enum(['development','production']),permission:z.enum(['authorized','provisional'])}).strict(),
 z.object({operation:z.literal('confirm'),...binding,id:z.uuid(),code:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict(),
 z.object({operation:z.literal('revoke'),...binding}).strict(),
 z.object({operation:z.literal('status'),...binding}).strict(),
 z.object({operation:z.literal('open'),...binding,id:z.uuid(),notificationId:z.uuid()}).strict(),
]);
export type PushRequest=z.infer<typeof pushRequestSchema>;
