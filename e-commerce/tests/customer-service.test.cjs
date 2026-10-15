const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {fixture}=require('./fixtures/support-tickets.cjs');
const sourceLoader=require('./fixtures/load-source.cjs');
const pure=sourceLoader(),starter=()=>pure('utils/customerServiceStarter.ts').starterServiceContent();
function setup(){const f=fixture(),cms=f.load('libs/customerService.ts');const act=(action,version,extra={})=>cms.updateCustomerService(f.admin.id,{action,version,requestId:randomUUID(),content:null,revisionId:null,...extra});return{...f,cms,act};}
test('service content rejects unsafe links, invalid maps/contacts, duplicate FAQs and excessive content',()=>{
 const {parseServiceContent}=pure('utils/customerService.ts');assert.ok(parseServiceContent(starter()));
 for(const contact of [{zaloUrl:'javascript:alert(1)'},{zaloUrl:'https://zalo.me.evil.example/x'},{zaloUrl:'https://user:pass@zalo.me/123'},{zaloUrl:'https://zalo.me/123?redirect=evil'},{mapUrl:'https://evil.example/maps/embed?pb=x'},{mapUrl:'https://www.google.com/maps/embed?pb=x&callback=evil'},{email:'bad\r\nBcc:other@example.invalid'},{phone:'<script>'}])assert.equal(parseServiceContent({...starter(),contact:{...starter().contact,...contact}}),null);
 const duplicate=starter();duplicate.faq.items.push(duplicate.faq.items[0]);assert.equal(parseServiceContent(duplicate),null);
 const bad=starter();bad.pages.returns.sections[0].text='x'.repeat(1501);assert.equal(parseServiceContent(bad),null);
 const good=starter();good.contact.zaloUrl='https://zalo.me/0901234567';good.contact.mapUrl='https://www.google.com/maps/embed?pb=fixture';assert.ok(parseServiceContent(good));
});
test('FAQ matching uses normalized plain phrases, never evaluates editor-supplied regular expressions',()=>{
 const {findServiceFaq}=pure('utils/customerService.ts'),items=starter().faq.items;assert.match(findServiceFaq(items,'Tôi cần hỏi bảo hành').question,/warranty/);assert.equal(findServiceFaq(items,'unmatched private question'),undefined);
 assert.equal(findServiceFaq([{question:'Regex is text',answer:'Never execute it',keywords:['(a+)+$'],href:''}],'b'.repeat(20000)),undefined);
});
test('first reads expose demo guidance and no invented public contact without writing a settings row',async()=>{
 const f=setup(),pub=await f.cms.getServicePublication();assert.equal(pub.isDemo,true);assert.equal(pub.id,null);assert.equal(pub.content.contact.phone,'');assert.equal(f.serviceSettings.size,0);assert.equal(f.serviceRevisions.size,0);
});
test('draft saves are private, publication replays once and archived revisions do not change on edit/restore',async()=>{
 const f=setup(),one=starter();one.pages.returns.sections[0].text='First published return instructions.';const save={action:'SAVE',version:0,requestId:randomUUID(),content:one,revisionId:null};await f.cms.updateCustomerService(f.admin.id,save);assert.equal((await f.cms.getServicePublication()).id,null);
 const publish={action:'PUBLISH',version:1,requestId:randomUUID(),content:null,revisionId:null};await Promise.all([f.cms.updateCustomerService(f.admin.id,publish),f.cms.updateCustomerService(f.admin.id,publish)]);const first=await f.cms.getServicePublication();assert.equal(first.revision,2);assert.equal(f.serviceRevisions.size,1);
 const two=structuredClone(one);two.pages.returns.sections[0].text='Second published instructions.';await f.act('SAVE',2,{content:two});assert.deepEqual(await f.cms.getServicePublication(),first);await f.act('PUBLISH',3);const second=await f.cms.getServicePublication();assert.notEqual(second.id,first.id);
 await f.act('RESTORE',4,{revisionId:first.id});assert.equal((await f.cms.getServicePublication()).id,second.id);await f.act('PUBLISH',5);const restored=await f.cms.getServicePublication();assert.notEqual(restored.id,first.id);assert.deepEqual(restored.content,first.content);assert.deepEqual(await f.cms.getServicePublication(first.id),first);
 assert.doesNotMatch(JSON.stringify(restored),/publishedBy|fingerprint|draft/);
});
test('stale editors and changed action replays cannot publish or overwrite a saved draft',async()=>{
 const f=setup(),input={action:'SAVE',version:0,requestId:randomUUID(),content:starter(),revisionId:null};await f.cms.updateCustomerService(f.admin.id,input);
 await assert.rejects(f.cms.updateCustomerService(f.admin.id,{...input,content:{...input.content,contact:{...input.content.contact,storeName:'Changed replay'}}}),e=>e.status===409);
 await assert.rejects(f.act('PUBLISH',0),e=>e.status===409);assert.equal(f.serviceRevisions.size,0);
 await assert.rejects(f.act('RESTORE',1,{revisionId:'1'.repeat(24)}),e=>e.status===400);
});
test('publication audit failure rolls back the revision and pointer, leaving the saved draft retryable',async()=>{
 const f=setup();await f.act('SAVE',0,{content:starter()});const original=f.db.auditLog.create;f.db.auditLog.create=async()=>{throw Error('QA audit failure');};await assert.rejects(f.act('PUBLISH',1));assert.equal(f.serviceRevisions.size,0);assert.equal(f.serviceSettings.get('default').version,1);assert.equal((await f.cms.getServicePublication()).isDemo,true);f.db.auditLog.create=original;await f.act('PUBLISH',1);assert.equal(f.serviceRevisions.size,1);
});
test('public/admin service routes enforce role, strict input and shared write quota without exposing drafts',async()=>{
 const f=setup(),pub=f.load('app/api/customer-service/route.ts'),admin=f.load('app/api/admin/customer-service/route.ts');f.state.user=null;assert.equal((await pub.GET(new Request('http://local'))).status,200);assert.equal((await admin.GET(new Request('http://local'))).status,401);f.state.user=f.owner;assert.equal((await admin.GET(new Request('http://local'))).status,403);f.state.user=f.admin;
 assert.equal((await admin.POST(new Request('http://local',{method:'POST',body:'{}'}))).status,400);assert.equal((await pub.GET(new Request('http://local?revision=../private'))).status,400);
 f.state.limited=true;const response=await admin.POST(new Request('http://local',{method:'POST',body:JSON.stringify({action:'SAVE',version:0,requestId:randomUUID(),content:starter()})}));assert.equal(response.status,429);assert.equal(f.serviceSettings.size,0);
});
