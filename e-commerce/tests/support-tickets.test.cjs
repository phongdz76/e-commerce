const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {fixture}=require('./fixtures/support-tickets.cjs');
test('six ticket retries atomically create one ticket, one initial chat message and audience-specific notifications',async()=>{
 const f=fixture(),input=f.input();const results=await Promise.all(Array.from({length:6},()=>f.service.createSupportTicket(f.owner,input)));
 assert.equal(new Set(results.map(r=>r.id)).size,1);assert.equal(f.tickets.size,1);assert.equal(f.messages.size,1);assert.equal(f.conversations.get(f.owner.id).adminUnread,1);assert.equal(f.notifications.events.size,1);assert.equal(f.notifications.notifications.size,3);
 assert.ok([...f.notifications.notifications.values()].every(n=>n.href.includes(results[0].id)));await assert.rejects(f.service.createSupportTicket(f.owner,{...input,subject:'Changed request'}),e=>e.status===409);
});
test('ticket failure rolls back its message, unread increment, attachment binding and event together',async()=>{
 const f=fixture(),image='2'.repeat(24);f.attachments.set(image,{id:image,conversationId:f.owner.id,uploadedBy:f.owner.id,messageId:null});const input=f.input({attachmentId:image});
 const original=f.db.notification.create;f.db.notification.create=async()=>{throw Error('database outage');};await assert.rejects(f.service.createSupportTicket(f.owner,input));
 assert.equal(f.tickets.size,0);assert.equal(f.messages.size,0);assert.equal(f.conversations.size,0);assert.equal(f.notifications.events.size,0);assert.equal(f.attachments.get(image).messageId,null);
 f.db.notification.create=original;await f.service.createSupportTicket(f.owner,input);assert.ok(f.attachments.get(image).messageId);assert.equal(f.messages.size,1);
});
test('server verifies order ownership and product/SKU context instead of accepting forged snapshots',async()=>{
 const f=fixture();await assert.rejects(f.service.createSupportTicket(f.other,f.input({context:{kind:'ORDER',id:'e'.repeat(24)}})),e=>e.status===404);
 await assert.rejects(f.create({context:{kind:'PRODUCT',id:'f'.repeat(24),variantId:'2'.repeat(24)}}),e=>e.status===409);
 const {id}=await f.create({context:{kind:'PRODUCT',id:'f'.repeat(24),variantId:'1'.repeat(24),title:'Forged title',href:'https://bad.example'}});
 const view=await f.service.getSupportTicket(id,f.owner);assert.match(view.ticket.context.title,/Verified product.*Black SKU/);assert.doesNotMatch(JSON.stringify(view),/Forged|bad\.example|fingerprint|ownerId/);
});
test('only the conversation assignee changes a ticket, notes remain admin-only and are not public events',async()=>{
 const f=fixture(),{id}=await f.create();await assert.rejects(f.change(id,'IN_PROGRESS'),e=>e.code==='TICKET_NOT_ASSIGNED');await f.claim();await f.change(id,'IN_PROGRESS');await assert.rejects(f.change(id,'RESOLVED',f.admin2),e=>e.status===409);
 const before=f.notifications.events.size,input={action:'NOTE',version:f.tickets.get(id).version,requestId:randomUUID(),text:'PRIVATE-AGENT-ONLY-NOTE'};
 await f.service.changeSupportTicket(id,f.admin,input);await f.service.changeSupportTicket(id,f.admin,input);assert.equal(f.notes.size,1);assert.equal(f.notifications.events.size,before);
 assert.doesNotMatch(JSON.stringify(await f.service.getSupportTicket(id,f.owner)),/PRIVATE-AGENT|notes|actorId|fingerprint|@example/);assert.match(JSON.stringify(await f.service.getSupportTicket(id,f.admin)),/PRIVATE-AGENT-ONLY-NOTE/);
 await assert.rejects(f.service.getSupportTicket(id,f.other),e=>e.status===404);
});
test('resolving one request does not close the shared conversation or another request; customer reopening preserves history',async()=>{
 const f=fixture(),first=await f.create(),second=await f.create({subject:'Another support request'});await f.claim();await f.change(first.id,'RESOLVED');assert.equal(f.conversations.get(f.owner.id).status,'OPEN');assert.equal(f.tickets.get(second.id).state,'OPEN');
 await f.change(first.id,'CLOSED',f.owner);await f.chat.changeSupportConversation(f.owner.id,f.admin,'CLOSE',f.conversations.get(f.owner.id).version,randomUUID());await f.change(first.id,'REOPEN',f.owner);
 assert.equal(f.tickets.get(first.id).state,'OPEN');assert.equal(f.conversations.get(f.owner.id).status,'OPEN');assert.equal(f.conversations.get(f.owner.id).assignedTo,null);assert.equal(f.messages.size,2);
});
test('new ticket reopens a closed conversation without losing saved messages or inventing an assignee',async()=>{
 const f=fixture();await f.create();await f.claim();await f.chat.changeSupportConversation(f.owner.id,f.admin,'CLOSE',f.conversations.get(f.owner.id).version,randomUUID());await f.create({subject:'A later support question'});assert.equal(f.conversations.get(f.owner.id).status,'OPEN');assert.equal(f.conversations.get(f.owner.id).assignedTo,null);assert.equal(f.messages.size,2);
});
test('stale or conflicting ticket actions cannot overwrite a status, and changed request replays are rejected',async()=>{
 const f=fixture(),{id}=await f.create();await f.claim();const input={action:'RESOLVED',version:1,requestId:randomUUID()};await f.service.changeSupportTicket(id,f.admin,input);
 await assert.rejects(f.service.changeSupportTicket(id,f.admin,{...input,action:'WAITING_CUSTOMER'}),e=>e.status===409);await assert.rejects(f.change(id,'IN_PROGRESS',f.admin,{version:1}),e=>e.status===409);assert.equal(f.tickets.get(id).state,'RESOLVED');
});
test('ticket HTTP boundaries enforce login, role, ownership, valid state and shared quotas',async()=>{
 const f=fixture(),list=f.load('app/api/support/requests/route.ts'),admin=f.load('app/api/admin/support-requests/route.ts'),detail=f.load('app/api/support/requests/[ticketId]/route.ts');
 const req=(body)=>new Request('http://localhost',{method:'POST',body:JSON.stringify(body)});f.state.user=null;assert.equal((await list.GET(new Request('http://localhost'))).status,401);f.state.user=f.owner;assert.equal((await admin.GET(new Request('http://localhost'))).status,403);
 assert.equal((await list.POST(req({}))).status,400);assert.equal((await list.GET(new Request('http://localhost?state=FORGED'))).status,400);
 const {id}=await f.create(),ctx={params:Promise.resolve({ticketId:id})};assert.equal((await detail.POST(req({action:'NOTE',version:1,requestId:randomUUID(),text:'Forged private note'}),ctx)).status,403);f.state.user=f.other;assert.equal((await detail.GET(new Request('http://localhost'),ctx)).status,404);
 f.state.user=f.owner;f.state.limited=true;assert.equal((await list.POST(req({requestId:randomUUID(),category:'GENERAL',subject:'Another request',description:'More details about my own request.'}))).status,429);
});
test('public intake from an administrator account still creates a CUSTOMER message and cannot impersonate staff',async()=>{
 const f=fixture();await f.service.createSupportTicket(f.admin,f.input());const saved=[...f.messages.values()][0];assert.equal(saved.senderRole,'CUSTOMER');assert.equal(saved.authorId,f.admin.id);assert.equal([...f.tickets.values()][0].ownerId,f.admin.id);
});
