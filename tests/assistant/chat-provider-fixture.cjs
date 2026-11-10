// Test-process preload only: synthetic Responses replies, never a production switch.
const target = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/ta_reporting_browser_test' || process.env.NODE_ENV === 'production') {
 throw new Error('Assistant provider fixture requires the isolated local browser database and development server.');
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
 if (String(input) !== 'https://api.openai.com/v1/responses') return originalFetch(input, init);
 const payload = JSON.parse(init.body);
 const outputs = payload.input.filter(x => x.type === 'function_call_output');
 let output;
 if (!outputs.length) output = [{type:'function_call',name:'find_business_tools',call_id:'fixture_discover',arguments:JSON.stringify({query:'save_goal'})}];
 else if (outputs.length === 1) output = [{type:'function_call',name:'use_business_tool',call_id:'fixture_save',arguments:JSON.stringify({name:'save_goal',arguments:JSON.stringify({title:'Browser fixture: agent onboarding'})})}];
 else {
  const receipt = JSON.parse(outputs.at(-1).output);
  output = [{type:'message',role:'assistant',content:[{type:'output_text',text:receipt.status==='succeeded'?'Your onboarding goal is saved.':'Your onboarding goal is ready for review.'}]}];
 }
 return Response.json({status:'completed',output,usage:{input_tokens:100,output_tokens:20}});
};
