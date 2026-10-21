import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChatbotGraph,advanceConversation} from '../src/services/chatbotService.js';

const node=(id,type,config={},x=0,y=0)=>({id,type,config,position:{x,y}});
test('chatbot graph validator accepts a complete question flow and rejects missing option branches',()=>{
 const nodes=[node('start','start'),node('q','askQuestion',{question:'Name?',field:'name'}),node('end','end')];
 assert.equal(validateChatbotGraph(nodes,[{source:'start',target:'q'},{source:'q',target:'end'}]).valid,true);
 const options=[node('start','start'),node('options','options',{question:'Choose',options:['A','B']}),node('end','end')];
 const result=validateChatbotGraph(options,[{source:'start',target:'options'},{source:'options',target:'end',sourceHandle:'option-0'}]);
 assert.equal(result.valid,false);assert.ok(result.errors.some(e=>e.includes('option 2')));
});
test('simulated answers persist only in test session and complete the conversation',async()=>{
 const version={nodes:[node('start','start'),node('question','askQuestion',{question:'Name?',field:'name'}),node('end','end')],edges:[{source:'start',target:'question'},{source:'question',target:'end'}]};
 const session={currentNodeId:'start',status:'active',variables:{},transcript:[]};
 await advanceConversation(session,version);assert.equal(session.currentNodeId,'question');assert.equal(session.transcript[0].role,'bot');
 await advanceConversation(session,version,{reply:'Ari'});assert.equal(session.variables.name,'Ari');assert.equal(session.status,'completed');assert.equal(session.transcript[1].synthetic,true);assert.equal(session.transcript[2].role,'system');
});
test('unknown condition state ends safely instead of selecting the false branch',async()=>{
 const version={nodes:[node('condition','condition',{field:'service',operator:'eq',value:'Website'}),node('yes','end'),node('no','end')],edges:[{source:'condition',target:'yes',sourceHandle:'true'},{source:'condition',target:'no',sourceHandle:'false'}]};
 const session={currentNodeId:'condition',status:'active',variables:{},transcript:[]};await advanceConversation(session,version);
 assert.equal(session.status,'completed');assert.match(session.transcript[0].content,/unknown/i);assert.match(session.transcript[0].content,/No negative answer/);
});
test('mock lead qualification is retained in the isolated session only',async()=>{
 const version={nodes:[node('lead','createLead',{field:'service',value:'Website Development'}),node('end','end')],edges:[{source:'lead',target:'end'}]};
 const session={currentNodeId:'lead',status:'active',variables:{name:'Ari'},transcript:[]};await advanceConversation(session,version);
 assert.equal(session.variables.simulatedLead.service,'Website Development');assert.equal(session.variables.simulationOnly,true);assert.match(session.transcript[0].content,/No CRM contact was created/);
});
