// Synthetic transport only, explicitly loaded by the isolated browser suite.
// No production code imports this file and no real provider request is allowed.
const database = new URL(process.env.DATABASE_URL || '');
if (!['127.0.0.1','localhost'].includes(database.hostname) || database.pathname !== '/ta_reporting_browser_test' || process.env.OPENAI_API_KEY !== 'meeting-synthetic-no-live-key') throw new Error('Meeting fixtures require the isolated local database and synthetic key.');
const originalFetch = globalThis.fetch, objects = new Map();
globalThis.fetch = async function(input, options = {}) {
 const url = new URL(String(input instanceof Request ? input.url : input));
 if (url.origin === 'https://meeting-storage.example.test') {
  if (options.headers?.authorization !== 'Bearer meeting-synthetic-storage-not-for-production') return new Response(null,{status:401});
  const key = url.searchParams.get('key');
  if (options.method === 'PUT') { objects.set(key,Buffer.from(options.body)); return new Response(null,{status:204}); }
  if (options.method === 'DELETE') { for(const k of objects.keys())if(k.startsWith(url.searchParams.get('prefix')))objects.delete(k);return new Response(null,{status:204}); }
  const bytes = objects.get(key);return bytes?new Response(bytes,{headers:{'content-length':String(bytes.length)}}):new Response(null,{status:404});
 }
 if (url.origin === 'https://api.openai.com') {
  if (url.pathname === '/v1/audio/transcriptions') return Response.json({text:'Morgan runs a freight brokerage. We use Excel. We spend five hours a week retyping shipment updates. Please send a workflow proposal on Friday.'});
  if (url.pathname === '/v1/responses') return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary:'Synthetic freight discovery meeting. Review the order update workflow.',findings:[{category:'tool',detail:'The team uses Excel.',evidence:'We use Excel.',basis:'stated'},{category:'opportunity',detail:'Explore an automated shipment update workflow.',evidence:'',basis:'suggestion'},{category:'commitment',detail:'A workflow proposal was requested for Friday; confirm the specific date.',evidence:'Please send a workflow proposal on Friday.',basis:'stated'}]})}]}]});
  throw new Error('Unexpected OpenAI request in synthetic tests.');
 }
 if (!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('External network is disabled in meeting browser tests.');
 return originalFetch(input, options);
};
