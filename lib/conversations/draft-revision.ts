import {z} from 'zod';
export const draftRevisionSchema=z.object({id:z.uuid(),updatedAt:z.iso.datetime({offset:true})});
export function draftRevisionMatches(current:{id:string;updated_at:Date}|undefined,expected:z.infer<typeof draftRevisionSchema>|null){
 return expected===null?!current:!!current&&current.id===expected.id&&current.updated_at.getTime()===Date.parse(expected.updatedAt);
}
