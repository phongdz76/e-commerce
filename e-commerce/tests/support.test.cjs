const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const rawSourceLoader=require('./fixtures/load-source.cjs');
const sourceLoader=mocks=>rawSourceLoader({'@/libs/notificationStorage':{ensureNotificationStorage:async()=>{}},...mocks});
const {installStockDatabase}=require('./fixtures/stock-db.cjs');
const {installNotificationDatabase}=require('./fixtures/notification-db.cjs');
const png=require('./fixtures/support-image.cjs');
function fixture(){
 const conversations=new Map(),messages=new Map(),attachments=new Map();
 const owner={id:'a'.repeat(24),role:'USER',name:'Buyer'},other={id:'b'.repeat(24),role:'USER',name:'Other buyer'},admin={id:'c'.repeat(24),role:'ADMIN',name:'First admin'},admin2={id:'d'.repeat(24),role:'ADMIN',name:'Second admin'};
 const state={user:owner,limited:false,rateCalls:0,failMessage:false};
 class RateError extends Error{constructor(){super('Too many requests. Try again later.');this.retryAfter=23;}}
 const match=(row,where={})=>Object.entries(where).every(([key,value])=>{
  if(key==='AND')return value.every(v=>match(row,v));if(key==='OR')return value.some(v=>match(row,v));
  if(value===null)return row[key]==null;
  if(value && typeof value==='object' && !(value instanceof Date))return Object.entries(value).every(([op,v])=>op==='in'?v.includes(row[key]):op==='gt'?row[key]>v:op==='lt'?row[key]<v:op==='lte'?row[key]!=null&&row[key]<=v:op==='isSet'?(row[key]!==undefined)===v:false);
  return row[key]===value;
 });
 const delegate=(rows,defaults={})=>({
  findUnique:async({where})=>structuredClone([...rows.values()].find(row=>match(row,where))||null),
  findFirst:async({where})=>structuredClone([...rows.values()].find(row=>match(row,where))||null),
  findMany:async({where={},orderBy,skip=0,take=100})=>{let out=[...rows.values()].filter(row=>match(row,where));if(orderBy?.sequence)out.sort((a,b)=>orderBy.sequence==='desc'?b.sequence-a.sequence:a.sequence-b.sequence);return structuredClone(out.slice(skip,skip+take));},
  count:async({where={}}={})=>[...rows.values()].filter(row=>match(row,where)).length,
  create:async({data})=>{if(rows===messages&&state.failMessage)throw Error('private database outage');if(rows.has(data.id))throw Object.assign(Error('duplicate'),{code:'P2002'});const row={createdAt:new Date(),updatedAt:new Date(),...structuredClone(defaults),...structuredClone(data)};rows.set(row.id,row);return structuredClone(row);},
  update:async({where,data})=>{const row=[...rows.values()].find(row=>match(row,where));if(!row)throw Error('not found');Object.assign(row,structuredClone(data));return structuredClone(row);},
  updateMany:async({where,data})=>{let count=0;for(const row of rows.values())if(match(row,where)){for(const [key,value]of Object.entries(data))row[key]=value&&typeof value==='object'&&'increment'in value?row[key]+value.increment:structuredClone(value);count++;}return {count};},
 });
 const userRows=new Map([owner,other,admin,admin2].map(u=>[u.id,{...u,email:u.name+'@example.invalid'}]));
 const db={supportConversation:delegate(conversations,{status:'OPEN',version:1,assignedTo:null,sequence:0,customerReadSequence:0,adminReadSequence:0,customerUnread:0,adminUnread:0,lastMessageAt:new Date()}),supportMessage:delegate(messages),supportAttachment:delegate(attachments),user:delegate(userRows),order:{findFirst:async({where})=>where.id==='e'.repeat(24)&&where.userId===owner.id?{id:where.id}:null}};
 const notifications=installNotificationDatabase(db);
 const stock=installStockDatabase(db,[],[conversations,messages,attachments,...notifications.maps]);
 const load=sourceLoader({'@/libs/supportStorage':{ensureSupportStorage:async()=>{}},'@/libs/prismadb':{__esModule:true,default:db},'@/actions/getCurrentUser':{getCurrentUser:async()=>state.user},'@/libs/authRateLimit':{checkAuthRateLimit:async()=>{state.rateCalls++;if(state.limited)throw new RateError();},AuthRateLimitError:RateError},'@/libs/storefrontProductNames':{getStorefrontProduct:async id=>id==='f'.repeat(24)?{id,name:'Current product name',variants:[{id:'1'.repeat(24),name:'Black 256GB'}]}:null},'next/server':{NextResponse:{json:Response.json}}});
 const service=load('libs/support.ts'),parse=load('utils/support.ts').parseSupportMessage;
 const input=(text='Hello support',extra={})=>parse({text,requestId:randomUUID(),...extra});
 const send=(viewer=owner,text='Hello support',extra={})=>service.sendSupportMessage(owner.id,viewer,input(text,extra));
 const action=(viewer,kind,requestId=randomUUID(),version=conversations.get(owner.id)?.version)=>service.changeSupportConversation(owner.id,viewer,kind,version,requestId);
 return {conversations,messages,attachments,db,owner,other,admin,admin2,state,stock,load,service,input,send,action,png};
}

test('support API requires login and prevents customers from accessing admin conversations or actions',async()=>{
 const f=fixture(),route=f.load('app/api/support/route.ts'),inbox=f.load('app/api/admin/support/route.ts'),adminRoute=f.load('app/api/admin/support/[conversationId]/route.ts');
 const req=body=>new Request('http://localhost/api/support',{method:'POST',body:JSON.stringify(body)}),ctx={params:Promise.resolve({conversationId:f.owner.id})};
 f.state.user=null;assert.equal((await route.GET(new Request('http://localhost'))).status,401);
 f.state.user=f.owner;assert.equal((await inbox.GET(new Request('http://localhost'))).status,403);assert.equal((await adminRoute.GET(new Request('http://localhost'),ctx)).status,403);
 const response=await route.POST(req({action:'SEND',...f.input(),conversationId:f.other.id,senderRole:'ADMIN',authorId:f.admin.id}));assert.equal(response.status,200);
 assert.equal(f.messages.size,1);assert.equal([...f.messages.values()][0].senderRole,'CUSTOMER');assert.ok(f.conversations.has(f.owner.id));assert.ok(!f.conversations.has(f.other.id));
 await assert.rejects(f.service.getSupportThread(f.owner.id,f.other),e=>e.status===404);
});

test('concurrent message retries commit one durable message and one unread increment',async()=>{
 const f=fixture(),input=f.input();const results=await Promise.all(Array.from({length:6},()=>f.service.sendSupportMessage(f.owner.id,f.owner,input)));
 assert.equal(new Set(results.map(r=>r.id)).size,1);assert.equal(f.messages.size,1);assert.equal(f.conversations.get(f.owner.id).adminUnread,1);assert.equal(f.conversations.get(f.owner.id).sequence,1);
 await assert.rejects(f.service.sendSupportMessage(f.owner.id,f.owner,{...input,text:'Different message'}),e=>e.status===409);assert.equal(f.messages.size,1);
});

test('two admins cannot claim the same conversation and only the assigned admin can reply',async()=>{
 const f=fixture();await f.send();const version=f.conversations.get(f.owner.id).version;
 const results=await Promise.allSettled([f.action(f.admin,'CLAIM',randomUUID(),version),f.action(f.admin2,'CLAIM',randomUUID(),version)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(f.conversations.get(f.owner.id).assignedTo,f.admin.id);await assert.rejects(f.send(f.admin2,'Unassigned reply'),e=>e.code==='SUPPORT_NOT_ASSIGNED');
 await f.send(f.admin,'We can help.');assert.equal(f.conversations.get(f.owner.id).customerUnread,1);
 await assert.rejects(f.action(f.admin2,'RELEASE'),e=>e.status===409);
});

test('read cursors preserve new unread messages during concurrent reading and sending, and reject future positions',async()=>{
 const f=fixture();await f.send();await Promise.all([f.service.readSupportMessages(f.owner.id,f.admin,1),f.send(f.owner,'Another question')]);
 assert.equal(f.conversations.get(f.owner.id).adminUnread,1);assert.equal(f.conversations.get(f.owner.id).adminReadSequence,1);
 const oldRead=await f.service.readSupportMessages(f.owner.id,f.admin,1);assert.equal(oldRead.unread,1);
 await assert.rejects(f.service.readSupportMessages(f.owner.id,f.admin,999),e=>e.status===400);
 await f.service.readSupportMessages(f.owner.id,f.admin2,2);assert.equal(f.conversations.get(f.owner.id).adminUnread,0);
});

test('close/reopen keeps saved history and uses assignment/version and replay protection',async()=>{
 const f=fixture();await f.send();await f.action(f.admin,'CLAIM');const version=f.conversations.get(f.owner.id).version,key=randomUUID();
 await f.action(f.admin,'CLOSE',key,version);await f.action(f.admin,'CLOSE',key,version);assert.equal(f.conversations.get(f.owner.id).status,'CLOSED');
 await assert.rejects(f.send(f.owner,'Question after closing'),e=>e.code==='SUPPORT_CLOSED');
 await assert.rejects(f.action(f.owner,'REOPEN',randomUUID(),version),e=>e.status===409);
 await f.action(f.owner,'REOPEN');await f.send(f.owner,'Question after reopening');assert.equal(f.messages.size,2);assert.equal(f.conversations.get(f.owner.id).assignedTo,null);
});

test('public thread omits internal identity/fingerprints and never attributes another admin message to the viewer',async()=>{
 const f=fixture();await f.send();await f.action(f.admin,'CLAIM');await f.send(f.admin,'First reply');await f.action(f.admin,'RELEASE');await f.action(f.admin2,'CLAIM');await f.send(f.admin2,'Second reply');
 const publicView=await f.service.getSupportThread(f.owner.id,f.owner);const text=JSON.stringify(publicView);
 assert.doesNotMatch(text,/authorId|fingerprint|uploadedBy|assignedTo|example.invalid|First admin|Second admin/);assert.equal(publicView.messages[1].label,'Support team');
 const adminView=await f.service.getSupportThread(f.owner.id,f.admin);assert.equal(adminView.messages[1].mine,true);assert.equal(adminView.messages[2].mine,false);assert.equal(adminView.messages[2].label,'Second admin');
});

test('message history is bounded, ordered and paginated before the supplied sequence',async()=>{
 const f=fixture();for(let i=0;i<25;i++)await f.send(f.owner,'Message '+i);
 const latest=await f.service.getSupportThread(f.owner.id,f.owner);assert.equal(latest.messages.length,20);assert.equal(latest.messages[0].sequence,6);assert.equal(latest.hasOlder,true);
 const older=await f.service.getSupportThread(f.owner.id,f.owner,latest.messages[0].sequence);assert.equal(older.messages.length,5);assert.equal(older.messages[0].sequence,1);assert.equal(older.hasOlder,false);
});

test('product/SKU and order context use server snapshots and enforce ownership',async()=>{
 const f=fixture();await f.send(f.owner,'About this product',{context:{kind:'PRODUCT',id:'f'.repeat(24),variantId:'1'.repeat(24),title:'Forged label',href:'https://bad.example'}});
 const view=await f.service.getSupportThread(f.owner.id,f.owner);assert.equal(view.messages[0].context.title,'Current product name · Black 256GB');assert.match(view.messages[0].context.href,/^\/product\//);
 await assert.rejects(f.send(f.owner,'Unavailable option',{context:{kind:'PRODUCT',id:'f'.repeat(24),variantId:'2'.repeat(24)}}),e=>e.status===409);
 await assert.rejects(f.send(f.owner,'Another order',{context:{kind:'ORDER',id:'2'.repeat(24)}}),e=>e.status===404);
 await f.send(f.owner,'My order',{context:{kind:'ORDER',id:'e'.repeat(24)}});const admin=await f.service.getSupportThread(f.owner.id,f.admin);assert.match(admin.messages.at(-1).context.href,/^\/admin\/orders\//);
});

test('attachments are private, type/size checked, idempotent and can be bound to only one message',async()=>{
 const f=fixture(),key=randomUUID();const image=await f.service.uploadSupportImage(f.owner.id,f.owner,png,key);
 assert.equal((await f.service.uploadSupportImage(f.owner.id,f.owner,png,key)).id,image.id);assert.equal(f.attachments.size,1);
 await assert.rejects(f.service.uploadSupportImage(f.owner.id,f.owner,Buffer.from('<svg onload=alert(1)>'),randomUUID()),e=>e.status===400);
 await assert.rejects(f.service.uploadSupportImage(f.owner.id,f.owner,Buffer.concat([png,Buffer.alloc(1024*1024)]),randomUUID()),e=>e.status===400);
 const outcomes=await Promise.allSettled([f.send(f.owner,'Image one',{attachmentId:image.id}),f.send(f.owner,'Image two',{attachmentId:image.id})]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.messages.size,1);
 const route=f.load('app/api/support/attachments/[attachmentId]/route.ts'),ctx={params:Promise.resolve({attachmentId:image.id})};
 const response=await route.GET(new Request('http://localhost'),ctx);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
 f.state.user=f.other;assert.equal((await route.GET(new Request('http://localhost'),ctx)).status,404);f.state.user=null;assert.equal((await route.GET(new Request('http://localhost'),ctx)).status,401);
});

test('actual multipart route bounds payloads and reads images without trusting client MIME',async()=>{
 const f=fixture(),route=f.load('app/api/support/attachments/route.ts');const form=new FormData();form.set('requestId',randomUUID());form.set('image',new Blob([png],{type:'text/plain'}),'picture.txt');
 const response=await route.POST(new Request('http://localhost/upload',{method:'POST',body:form}));assert.equal(response.status,200);const saved=[...f.attachments.values()][0];assert.equal(saved.contentType,'image/png');
 const large=new FormData();large.set('requestId',randomUUID());large.set('image',new Blob([Buffer.alloc(2*1024*1024)]),'too-large.png');assert.equal((await route.POST(new Request('http://localhost/upload',{method:'POST',body:large}))).status,413);
});

test('failed message writes roll back sequence, unread counter and attachment binding',async()=>{
 const f=fixture();const image=await f.service.uploadSupportImage(f.owner.id,f.owner,png,randomUUID());f.state.failMessage=true;
 await assert.rejects(f.send(f.owner,'Keep this draft',{attachmentId:image.id}));assert.equal(f.messages.size,0);assert.equal(f.conversations.get(f.owner.id).sequence,0);assert.equal(f.conversations.get(f.owner.id).adminUnread,0);assert.ok(!f.attachments.get(image.id).messageId);
 f.state.failMessage=false;await f.send(f.owner,'Keep this draft',{attachmentId:image.id});assert.equal(f.messages.size,1);
});

test('rate limits return Retry-After while saved message replay remains available',async()=>{
 const f=fixture(),input=f.input();await f.service.sendSupportMessage(f.owner.id,f.owner,input);f.state.limited=true;
 assert.equal((await f.service.sendSupportMessage(f.owner.id,f.owner,input)).replayed,true);
 const route=f.load('app/api/support/route.ts');const response=await route.POST(new Request('http://localhost',{method:'POST',body:JSON.stringify({action:'SEND',...f.input('New rate-limited message')})}));assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'23');assert.equal(f.messages.size,1);
});

test('conversation assignment audit failure does not claim the conversation',async()=>{
 const f=fixture();await f.send();f.db.auditLog.create=async()=>{throw Error('audit outage');};await assert.rejects(f.action(f.admin,'CLAIM'));assert.equal(f.conversations.get(f.owner.id).assignedTo,null);assert.equal(f.conversations.get(f.owner.id).version,1);
});

test('storage initialization is shared across concurrent sends, accepts only NamespaceExists and retries failures',async()=>{
 const calls=[];let fail=true;
 const db={$runCommandRaw:async command=>{calls.push(command);if(fail){fail=false;throw Object.assign(Error('auth failure'),{meta:{code:'13'}});}if(command.create)throw Object.assign(Error('existing collection'),{meta:{code:'48'}});return {ok:1};}};
 const service=sourceLoader({'@/libs/prismadb':{__esModule:true,default:db}})('libs/supportStorage.ts');
 await assert.rejects(service.ensureSupportStorage());calls.length=0;
 await Promise.all([service.ensureSupportStorage(),service.ensureSupportStorage(),service.ensureSupportStorage()]);
 assert.deepEqual(calls.filter(c=>c.create).map(c=>c.create),['SupportConversation','SupportMessage','SupportAttachment']);assert.equal(calls.filter(c=>c.createIndexes).length,3);
});

test('an unsent image draft does not create an inbox item until its first message is saved',async()=>{
 const f=fixture();const image=await f.service.uploadSupportImage(f.owner.id,f.owner,png,randomUUID());
 assert.equal((await f.service.getSupportInbox(f.admin,'OPEN',1)).total,0);
 await f.send(f.owner,'Here is the product photo',{attachmentId:image.id});
 const inbox=await f.service.getSupportInbox(f.admin,'UNASSIGNED',1);assert.equal(inbox.total,1);assert.equal(inbox.conversations[0].unread,1);
});

test('notification storage failure rolls back the support message and its unread state',async()=>{
 const f=fixture();f.db.notification.create=async()=>{throw Error('Notification write failed');};
 await assert.rejects(f.send());assert.equal(f.messages.size,0);assert.equal(f.conversations.size,0);assert.equal(await f.db.notificationEvent.count(),0);
});

test('opening or marking a notification does not change the chat read cursor',async()=>{
 const f=fixture();await f.send();const notifications=f.load('libs/notifications.ts');const list=await notifications.getNotifications(f.admin.id,'ADMIN');assert.equal(list.unread,1);
 await notifications.readNotifications(f.admin.id,'ADMIN',{id:list.items[0].id});assert.equal(f.conversations.get(f.owner.id).adminUnread,1);
 await f.service.readSupportMessages(f.owner.id,f.admin,1);assert.equal((await notifications.getNotifications(f.admin2.id,'ADMIN')).unread,1);
});

test('an active administrator can recover an unavailable assignee, while another active handler stays protected',async()=>{
 const f=fixture();await f.send();await f.action(f.admin,'CLAIM');
 assert.equal((await f.service.getSupportThread(f.owner.id,f.admin2)).conversation.canClaim,false);
 await assert.rejects(f.action(f.admin2,'CLAIM'),e=>e.status===409);
 await f.db.user.update({where:{id:f.admin.id},data:{status:'BLOCKED'}});
 assert.equal((await f.service.getSupportThread(f.owner.id,f.admin2)).conversation.canClaim,true);
 await f.action(f.admin2,'CLAIM');assert.equal(f.conversations.get(f.owner.id).assignedTo,f.admin2.id);
 await f.send(f.admin2,'The support team can continue this conversation.');
 assert.equal((await f.service.getSupportThread(f.owner.id,f.owner)).messages.at(-1).text,'The support team can continue this conversation.');
});
