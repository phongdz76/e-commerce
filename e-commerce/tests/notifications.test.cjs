const test=require('node:test'),assert=require('node:assert/strict');
const sourceLoader=require('./fixtures/load-source.cjs');
const {installNotificationDatabase,matches}=require('./fixtures/notification-db.cjs');
const {installStockDatabase}=require('./fixtures/stock-db.cjs');
function fixture(){
 const owner={id:'a'.repeat(24),role:'USER'},other={id:'b'.repeat(24),role:'USER'},admin={id:'c'.repeat(24),role:'ADMIN',status:'ACTIVE'},admin2={id:'d'.repeat(24),role:'ADMIN',status:'ACTIVE'},blocked={id:'e'.repeat(24),role:'ADMIN',status:'BLOCKED'};
 const users=[owner,other,admin,admin2,blocked],state={user:owner};
 const db={user:{findMany:async({where})=>users.filter(user=>matches(user,where))}};
 const rows=installNotificationDatabase(db);installStockDatabase(db,[],rows.maps);
 const load=sourceLoader({'@/libs/prismadb':{__esModule:true,default:db},'@/actions/getCurrentUser':{getCurrentUser:async()=>state.user},'next/server':{NextResponse:{json:Response.json}}});
 const service=load('libs/notifications.ts');let n=0;
 const publish=(recipient=owner,audience='CUSTOMER',key='event-'+(++n))=>db.$transaction(tx=>service.publishNotification(tx,{key,kind:'SUPPORT_MESSAGE',entityId:owner.id},[{id:recipient.id,audience,title:'A saved support reply',href:audience==='ADMIN'?'/admin/support/'+owner.id:'/support'}]));
 const support=(assignedTo=null,author=owner)=>db.$transaction(tx=>service.notifySupportMessage(tx,{id:owner.id,ownerId:owner.id,assignedTo},{id:'message-'+(++n),authorId:author.id,senderRole:author.role==='ADMIN'?'ADMIN':'CUSTOMER'}));
 return{owner,other,admin,admin2,blocked,db,rows,state,service,load,publish,support};
}
test('six concurrent event retries create one event, one notification and one inbox sequence',async()=>{
 const f=fixture();await Promise.all(Array.from({length:6},()=>f.publish(f.owner,'CUSTOMER','same-event')));
 assert.equal(f.rows.events.size,1);assert.equal(f.rows.notifications.size,1);assert.equal([...f.rows.inboxes.values()][0].sequence,1);
});
test('unassigned support alerts active admins, assigned support alerts its handler and blocked assignment falls back',async()=>{
 const f=fixture();await f.support();assert.deepEqual([...f.rows.notifications.values()].map(n=>n.recipientId).sort(),[f.admin.id,f.admin2.id].sort());
 await f.support(f.admin.id);assert.equal((await f.service.getNotifications(f.admin.id,'ADMIN')).unread,2);assert.equal((await f.service.getNotifications(f.admin2.id,'ADMIN')).unread,1);
 await f.support(f.blocked.id);assert.equal((await f.service.getNotifications(f.admin2.id,'ADMIN')).unread,2);assert.equal((await f.service.getNotifications(f.blocked.id,'ADMIN')).unread,0);
 await f.support(f.admin.id,f.admin);assert.equal((await f.service.getNotifications(f.owner.id,'CUSTOMER')).unread,1);assert.equal((await f.service.getNotifications(f.other.id,'CUSTOMER')).unread,0);
});
test('notification rollback removes its event, all recipients and inbox increments',async()=>{
 const f=fixture(),create=f.db.notification.create;let created=0;f.db.notification.create=async input=>{if(++created===2)throw Error('Storage unavailable');return create(input);};
 await assert.rejects(f.support());assert.equal(f.rows.events.size,0);assert.equal(f.rows.notifications.size,0);assert.equal(f.rows.inboxes.size,0);
});
test('mark all uses the observed sequence and never clears a message that arrived afterwards',async()=>{
 const f=fixture();await f.publish();const observed=await f.service.getNotifications(f.owner.id,'CUSTOMER');await f.publish();
 await f.service.readNotifications(f.owner.id,'CUSTOMER',{through:observed.through});const latest=await f.service.getNotifications(f.owner.id,'CUSTOMER');assert.equal(latest.unread,1);assert.equal(latest.items[0].read,false);assert.equal(latest.items[1].read,true);
 await assert.rejects(f.service.readNotifications(f.owner.id,'CUSTOMER',{through:999}),e=>e.status===400);
});
test('read state is private, idempotent and distinct between customer and admin inboxes',async()=>{
 const f=fixture();await f.publish(f.admin,'CUSTOMER');await f.publish(f.admin,'ADMIN');const item=(await f.service.getNotifications(f.admin.id,'ADMIN')).items[0];
 await assert.rejects(f.service.readNotifications(f.other.id,'ADMIN',{id:item.id}),e=>e.status===404);await assert.rejects(f.service.readNotifications(f.admin.id,'CUSTOMER',{id:item.id}),e=>e.status===404);
 await f.service.readNotifications(f.admin.id,'ADMIN',{id:item.id});const saved=f.rows.notifications.get(item.id).readAt;
 await f.service.readNotifications(f.admin.id,'ADMIN',{id:item.id});assert.equal(+f.rows.notifications.get(item.id).readAt,+saved);
 assert.equal((await f.service.getNotifications(f.admin.id,'ADMIN')).unread,0);assert.equal((await f.service.getNotifications(f.admin.id,'CUSTOMER')).unread,1);
});
test('history and unread filtering paginate by stable per-recipient sequence without leaking storage metadata',async()=>{
 const f=fixture();for(let i=0;i<25;i++)await f.publish();const latest=await f.service.getNotifications(f.owner.id,'CUSTOMER');assert.equal(latest.items.length,20);assert.equal(latest.items[0].sequence,25);assert.equal(latest.hasOlder,true);
 const older=await f.service.getNotifications(f.owner.id,'CUSTOMER',latest.items.at(-1).sequence);assert.equal(older.items.length,5);assert.equal(older.items.at(-1).sequence,1);
 await f.service.readNotifications(f.owner.id,'CUSTOMER',{id:latest.items[0].id});assert.equal((await f.service.getNotifications(f.owner.id,'CUSTOMER',undefined,true)).items[0].sequence,24);
 assert.doesNotMatch(JSON.stringify(latest),/recipientId|eventId|audience|entityId/);
});
test('notification routes enforce session, role, payload bounds and ownership instead of trusting client recipient fields',async()=>{
 const f=fixture(),publicRoute=f.load('app/api/notifications/route.ts'),adminRoute=f.load('app/api/admin/notifications/route.ts');
 const req=body=>new Request('http://local/api/notifications',{method:'POST',body:JSON.stringify(body)});
 f.state.user=null;assert.equal((await publicRoute.GET(new Request('http://local'))).status,401);f.state.user=f.owner;assert.equal((await adminRoute.GET(new Request('http://local'))).status,403);
 await f.publish();const id=(await f.service.getNotifications(f.owner.id,'CUSTOMER')).items[0].id;
 assert.equal((await publicRoute.POST(req({action:'READ',id,recipientId:f.other.id,audience:'ADMIN'}))).status,200);assert.equal((await f.service.getNotifications(f.owner.id,'CUSTOMER')).unread,0);
 for(const body of [{action:'READ_ALL',through:-1},{action:'READ_ALL',through:1.5},{action:'READ',id:'invalid'},null])assert.equal((await publicRoute.POST(req(body))).status,400);
 assert.equal((await publicRoute.GET(new Request('http://local?before=Infinity'))).status,400);
});

test('chat retries a confirmed transaction conflict with backoff but does not retry an uncertain outcome',async()=>{
 let calls=0;const load=sourceLoader({'@/libs/prismadb':{__esModule:true,default:{$transaction:async operation=>{if(++calls===1)throw Object.assign(Error('Write conflict'),{code:'P2034'});return operation({});}}}});
 assert.equal(await load('libs/supportTransaction.ts').withSupportTransaction(async()=>'committed'),'committed');assert.equal(calls,2);
 let uncertainCalls=0;const uncertain=sourceLoader({'@/libs/prismadb':{__esModule:true,default:{$transaction:async()=>{uncertainCalls++;throw Object.assign(Error('Unknown outcome'),{code:'P2028'});}}}});
 await assert.rejects(uncertain('libs/supportTransaction.ts').withSupportTransaction(async()=>'must not run'),e=>e.code==='P2028');assert.equal(uncertainCalls,1);
});
