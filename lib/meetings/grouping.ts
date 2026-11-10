import type {MeetingPart} from './contract';

// An allowance reservation, not an OpenAI invoice. Round each recording up to
// a minute; reserve one analysis for the complete conversation, not each part.
export const MEETING_ANALYZE_RESERVE=250_000;
export const transcriptionReserve=(seconds:number)=>Math.max(1,Math.ceil(seconds/60))*6_000;
export const MAX_COMBINED_TRANSCRIPT_BYTES=160_000;
export const MAX_MEETING_PARTS=24;
export function processingEstimate(parts:Pick<MeetingPart,'duration_seconds'|'transcribed'>[]){
 return (parts.reduce((sum,p)=>sum+(p.transcribed?0:transcriptionReserve(p.duration_seconds??0)),0)+MEETING_ANALYZE_RESERVE)/1e6;
}
export function combineTranscripts(parts:{part_order:number;part_transcript:string|null;gap_before_seconds:number;boundary_reason:string|null}[]){
 if(parts.length===1)return parts[0].part_transcript||'';
 return parts.map((p,i)=>`[Recording ${i+1}${p.gap_before_seconds?`; possible delivery gap: about ${p.gap_before_seconds} seconds`:''}${p.boundary_reason==='sample_rate'?'; audio sample rate changed':''}]\n${p.part_transcript||'[Transcription pending]'}`).join('\n\n');
}
