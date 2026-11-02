import ts from 'typescript';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
// Generated inventory makes omissions visible when new dashboard actions ship.
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','.next'].includes(entry.name))continue;const name=path.join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(name));else if(/\.tsx?$/.test(name)&&!name.endsWith('.test.ts'))files.push(name);}return files;}
const implementations={
 'lib/sales/actions.ts#saveTaskAction':['prepare_save_sales_task'],
 'lib/sales/actions.ts#completeTaskAction':['prepare_complete_sales_task'],
 'lib/booking/actions.ts#saveCalendar':['prepare_block_time','prepare_publish_consultation_time','prepare_close_calendar_entry','prepare_cancel_consultation'],
 'lib/operations/actions.ts#updateLeadAction':['prepare_update_lead'],
 'lib/operations/actions.ts#updateLeadStatusAction':['prepare_update_lead_status'],
 'lib/operations/actions.ts#addLeadNoteAction':['prepare_add_lead_note'],
 'lib/operations/actions.ts#saveClientAction':['prepare_save_client'],
 'lib/operations/actions.ts#saveContactAction':['prepare_save_contact'],
 'lib/operations/actions.ts#saveSiteAction':['prepare_save_site'],
 'lib/operations/actions.ts#saveProjectAction':['prepare_save_project'],
 'lib/operations/actions.ts#addMilestoneAction':['prepare_add_milestone'],
 'lib/operations/actions.ts#updateMilestoneStatusAction':['prepare_update_milestone_status'],
 'lib/operations/actions.ts#addProjectRecordAction':['prepare_add_project_record'],

 'lib/sales/actions.ts#createOpportunityAction':['prepare_create_opportunity'],
 'lib/sales/actions.ts#updateOpportunityAction':['prepare_update_opportunity'],
 'lib/sales/actions.ts#requestMockupAction':['prepare_request_mockup'],
 'lib/conversations/actions.ts#addConversationNoteAction':['prepare_add_conversation_note'],
 'lib/conversations/actions.ts#loadConversationSourceHistoryAction':['get_source_history'],
 'lib/voice/actions.ts#getVoiceCallAction':['get_call'],
};
const partial={
 'lib/sales/actions.ts#logActivityAction':['prepare_log_activity','Internal notes only; imported communications and outcomes remain in dashboard.'],
};
const handoffs=/connectSmsNumber|saveSmsGrant|connectVoiceLine|saveVoiceGrant|saveCallingPhone|issueVoiceToken|updateVoicePresence|acceptVoiceCall|createVoiceIntent|startPhoneCall|saveVoiceRouting|saveVoiceForwarding|saveRecordingPreferences|deleteCallRecording|deleteVoicemail|deleteLead/;
const inventory=[];
for(const file of [...await walk('lib'),...await walk('app')].sort()){
 const text=await readFile(file,'utf8');const server=/^[\s]*["']use server["']/.test(text);const route=file.startsWith('app/api/')&&file.endsWith('/route.ts');if(!server&&!route)continue;
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 for(const n of ast.statements){if(!ts.isFunctionDeclaration(n)||!n.name||!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))continue;
  const name=n.name.text,key=file+'#'+name;
  let status='pending',tools=[],reason='Service extraction, permission/revision checks and acceptance tests remain.';
  if(implementations[key]){status='implemented';tools=implementations[key];reason='Shared domain service behind delegated access; changes require dashboard review.';}
  else if(partial[key]){status='partial';tools=[partial[key][0]];reason=partial[key][1];}
  else if(file.includes('/assistant/')){status='control';reason='Authenticated owner control or MCP transport; deliberately not callable as an approval tool.';}
  else if(handoffs.test(name)){status='human_handoff';reason='Identity, security, deletion or physical-device operation remains in the trusted dashboard.';}
  else if(route){status='transport_review';reason='HTTP transport inventory; classify staff capability versus public webhook/worker before adding a tool. This endpoint is not exposed generically.';}
  inventory.push({file,export:name,status,tools,reason});
 }
}
const output=JSON.stringify({version:1,generatedBy:'node scripts/assistant/coverage.mjs',meaning:'Implemented is source coverage, not a live client acceptance claim. Pending and partial rows must not be reported as complete.',entries:inventory},null,2)+'\n';
const dest='docs/OPERATIONS_ASSISTANT_COVERAGE.json';
if(process.argv.includes('--check')){if(await readFile(dest,'utf8')!==output)throw new Error('Assistant capability inventory changed. Regenerate and review coverage.');}else await writeFile(dest,output);
console.log(`${inventory.length} exported actions/transports inventoried; ${inventory.filter(x=>x.status==='pending'||x.status==='partial').length} pending or partial.`);
