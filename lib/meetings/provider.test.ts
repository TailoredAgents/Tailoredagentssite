import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {analyzeMeeting,parseMeetingAnalysisResponse,validateMeetingAnalysis} from './provider';

const transcript='We copy orders into our CRM.';
const sparse={summary:'A brief fragment mentions copying orders into a CRM; the wider workflow is unknown.',findings:[
 {category:'workflow',detail:'Orders are copied into a CRM.',evidence:transcript,basis:'stated'},
 {category:'missing_information',detail:'The CRM and order source are unspecified.',evidence:'',basis:'unknown'}
]};
const completed=(value:unknown)=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('Meeting analysis provider boundaries',()=>{
 it('accepts sparse evidence and explicit unknowns without filling every category',()=>{
  expect(parseMeetingAnalysisResponse(completed(sparse),transcript)).toEqual(sparse);
  expect(validateMeetingAnalysis({summary:'No business context is available.',findings:[]},'Testing.').findings).toEqual([]);
 });
 it.each(['stated','suggestion','unknown'])('rejects invented evidence for %s findings',basis=>{
  expect(()=>validateMeetingAnalysis({summary:'Review',findings:[{category:'tool',detail:'Unknown tool',evidence:'Not mentioned',basis}]},transcript)).toThrow('analysis_evidence');
 });
 it('rejects a stated fact without a quote',()=>{
  expect(()=>validateMeetingAnalysis({summary:'Review',findings:[{category:'tool',detail:'Uses a CRM',evidence:'',basis:'stated'}]},transcript)).toThrow('analysis_evidence');
 });
 it('does not repair paraphrases or punctuation into fabricated exact quotes',()=>{
  expect(()=>validateMeetingAnalysis({summary:'Review',findings:[{category:'workflow',detail:'Copies orders',evidence:'We copy orders into our CRM!',basis:'stated'}]},transcript)).toThrow('analysis_evidence');
 });
 it.each([
  [{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}},'analysis_incomplete'],
  [{status:'completed',output:[{content:[{type:'refusal',refusal:'Private provider text'}]}]},'analysis_refused'],
  [{status:'completed',output:[{content:[{type:'output_text',text:'not JSON'}]}]},'analysis_format'],
  [completed({summary:'Review'}),'analysis_format'],
  [{status:'completed',output:null},'analysis_format'],
 ])('returns a bounded diagnostic without including response content', (response,code)=>{
  expect(()=>parseMeetingAnalysisResponse(response,transcript)).toThrow(String(code));
 });
 it('uses the existing private provider request with strict output and no automatic retry',async()=>{
  vi.stubEnv('OPENAI_API_KEY','fixture-only');
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(completed(sparse))));vi.stubGlobal('fetch',fetcher);
  expect(await analyzeMeeting(transcript)).toEqual(sparse);expect(fetcher).toHaveBeenCalledTimes(1);
  const [url,init]=fetcher.mock.calls[0];expect(url).toBe('https://api.openai.com/v1/responses');
  const request=JSON.parse(init.body);expect(request).toMatchObject({model:'gpt-6-luna',store:false,max_output_tokens:6000,text:{format:{strict:true}}});
  expect(request.input[1].content).toBe(transcript);
 });
});
