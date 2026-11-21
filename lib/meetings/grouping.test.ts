import {describe,it,expect} from 'vitest';
import {combineTranscripts} from './grouping';
describe('Completed empty recording parts',()=>{
 it('distinguishes pending audio, completed empty audio and actual speech',()=>{
  const combined=combineTranscripts([null,'','Actual speech.'].map((part_transcript,part_order)=>({part_order,part_transcript,gap_before_seconds:0,boundary_reason:null})));
  expect(combined).toContain('[Recording 1]\n[Transcription pending]');
  expect(combined).toContain('[Recording 2]\n[No speech recognized in this recording; original audio retained]');
  expect(combined).toContain('[Recording 3]\nActual speech.');
 });
});
