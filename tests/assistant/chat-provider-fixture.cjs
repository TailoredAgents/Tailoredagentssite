// Test-process preload only: synthetic Responses replies, never a production switch.
const target = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/ta_reporting_browser_test' || process.env.NODE_ENV === 'production') {
 throw new Error('Assistant provider fixture requires the isolated local browser database and development server.');
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
 if(String(input)==='https://api.openai.com/v1/audio/transcriptions')return Response.json({text:'Ask Devon about discovery.'});
 if (String(input) !== 'https://api.openai.com/v1/responses') return originalFetch(input, init);
 const payload = JSON.parse(init.body);
 const outputs = payload.input.filter(x => x.type === 'function_call_output');
 const documentRequest=payload.input.find(x=>x.role==='user'&&typeof x.content==='string'&&x.content.includes('Make a document brief from my attachment.'));
 if(documentRequest){
  const fileId=documentRequest.content.match(/file IDs.*?: ([0-9a-f-]{36})/)?.[1];
  const read=outputs.find(x=>x.call_id==='fixture_document_read'),created=outputs.find(x=>x.call_id==='fixture_document_create');
  const output=!read?[{type:'function_call',name:'read_document',call_id:'fixture_document_read',arguments:JSON.stringify({id:fileId,query:'',offset:0})}]:!created?[{type:'function_call',name:'create_document',call_id:'fixture_document_create',arguments:JSON.stringify({format:'docx',title:'Discovery brief',body:'The customer wants document automation. Budget needs confirmation.',columns:[],rows:[],sources:[{id:fileId,chunk:'c1'}]})}]:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Your brief is ready: [Open Discovery brief]('+JSON.parse(created.output).document.url+')'}]}];
  return Response.json({status:'completed',output,usage:{input_tokens:100,output_tokens:20}});
 }

 let output;
 const plan=(status,evidence)=>({steps:[{id:'goal',label:'Save onboarding goal',status,dependsOn:[],evidence}]});
 if (!outputs.length) output = [{type:'function_call',name:'update_work_plan',call_id:'fixture_plan',arguments:JSON.stringify(plan('working',''))}];
 else if (outputs.length === 1) output = [{type:'function_call',name:'find_business_tools',call_id:'fixture_discover',arguments:JSON.stringify({query:'save_goal'})}];
 else if (outputs.length === 2) output = [{type:'function_call',name:'use_business_tool',call_id:'fixture_save',arguments:JSON.stringify({name:'save_goal',arguments:JSON.stringify({title:'Browser fixture: agent onboarding'})})}];
 else if (outputs.length === 3) output = [{type:'function_call',name:'update_work_plan',call_id:'fixture_done',arguments:JSON.stringify(plan('done','Saved goal action receipt confirms success.'))}];
 else {
  const receipt = JSON.parse(outputs.find(x=>x.call_id==='fixture_save').output);
  output = [{type:'message',role:'assistant',content:[{type:'output_text',text:receipt.status==='succeeded'?'Your onboarding goal is saved.':'Your onboarding goal is ready for review.'}]}];
 }
 return Response.json({status:'completed',output,usage:{input_tokens:100,output_tokens:20}});
};
