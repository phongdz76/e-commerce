const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {fixture}=require('./fixtures/event-email.cjs');
const sourceLoader=require('./fixtures/load-source.cjs');
test('financial transaction conflict retries stay bounded and uncertain commit errors are never retried',async()=>{
 for(const code of ['P2034','P2002']){
  let calls=0;const load=sourceLoader({'@/libs/prismadb':{__esModule:true,default:{$transaction:async operation=>{calls++;if(calls<2)throw Object.assign(Error('Confirmed conflict'),{code});return operation({});}}}});
  assert.equal(await load('libs/orderStock.ts').withStockTransaction(async()=>'committed'),'committed');assert.equal(calls,2);
 }
 for(const code of ['P2028','P1001','P2034']){
  let calls=0;const load=sourceLoader({'@/libs/prismadb':{__esModule:true,default:{$transaction:async()=>{calls++;throw Object.assign(Error('Fixture failure'),{code});}}}});
  await assert.rejects(load('libs/orderStock.ts').withStockTransaction(async()=>{}),error=>error.code===code);assert.equal(calls,code==='P2034'?4:1);
 }
});
test('order event retries create one event, one email and a notification for each allowed audience',async()=>{
 const f=fixture();await Promise.all(Array.from({length:6},()=>f.publish()));assert.equal(f.rows.events.size,1);assert.equal(f.rows.deliveries.size,1);assert.equal(f.rows.notifications.size,3);
 for(const row of f.rows.notifications.values())assert.equal(row.href,(row.audience==='ADMIN'?'/admin/orders/':'/orders/')+f.order.id);
 assert.match([...f.rows.deliveries.values()][0].subject,/payment pending/);
});
test('validated payment and notification/outbox writes roll back together on a notification failure',async()=>{
 const f=fixture();f.db.notification.create=async()=>{throw Error('notification storage unavailable');};
 await assert.rejects(f.load('libs/updateOrderPayment.ts').updateOrderPayment({where:{id:f.order.id,status:'pending'},data:{status:'paid'}}));
 assert.equal(f.orders.get(f.order.id).status,'pending');assert.equal(f.rows.events.size,0);assert.equal(f.rows.deliveries.size,0);
});
test('concurrent confirmation paths publish one payment receipt and an old failure cannot downgrade it',async()=>{
 const f=fixture(),update=f.load('libs/updateOrderPayment.ts').updateOrderPayment;
 await update({where:{id:f.order.id,status:'pending'},data:{status:'processing'}});assert.equal(f.rows.events.size,0);
 await Promise.all(Array.from({length:3},()=>update({where:{id:f.order.id,status:{notIn:['paid','complete','done']}},data:{status:'paid'}})));
 await update({where:{id:f.order.id,status:{in:['pending','processing']}},data:{status:'failed'}});
 assert.equal(f.orders.get(f.order.id).status,'paid');assert.equal(f.rows.events.size,1);assert.equal(f.rows.deliveries.size,1);
});
test('card preparation sends no order email; confirmed card payment does not claim it is still pending',async()=>{
 const f=fixture(),order=f.orders.get(f.order.id);order.status='draft';order.paymentMethod='STRIPE';
 await f.db.$transaction(tx=>f.events.notifyOrderCreated(tx,order));assert.equal(f.rows.events.size,0);
 await f.load('libs/updateOrderPayment.ts').updateOrderPayment({where:{id:order.id},data:{status:'complete'}});
 assert.equal(f.rows.events.size,2);assert.equal(f.rows.deliveries.size,1);const received=[...f.rows.notifications.values()].filter(n=>n.kind==='ORDER_CREATED');assert.equal(received.length,2);assert.ok(received.every(n=>n.audience==='ADMIN'&&n.title.includes('paid order')));
});
test('approval, unknown refund outcome and confirmed refund have distinct recipient/template rules',async()=>{
 const f=fixture(),next={id:'refund-original',state:'APPROVED'};
 await f.db.$transaction(tx=>f.events.notifyRefundChange(tx,f.order,{state:'REQUESTED'},next,f.admin.id));assert.match([...f.rows.deliveries.values()][0].subject,/refund pending/);
 await f.db.$transaction(tx=>f.events.notifyRefundChange(tx,f.order,next,{...next,state:'REVIEW'},f.admin.id));assert.equal(f.rows.deliveries.size,1);assert.ok([...f.rows.notifications.values()].filter(n=>n.kind==='REFUND_REVIEW').every(n=>n.audience==='ADMIN'));
 for(let i=0;i<2;i++)await f.db.$transaction(tx=>f.events.notifyRefundChange(tx,f.order,{state:'PROCESSING'},{...next,state:'SUCCEEDED'},f.admin.id));assert.equal(f.rows.deliveries.size,2);assert.match([...f.rows.deliveries.values()][1].subject,/Refund confirmed/);
});
test('SMTP acceptance is recorded once and another worker cannot send the same delivery concurrently',async()=>{
 const f=fixture();await f.publish();await Promise.all([f.service.processEmailDeliveries(),f.service.processEmailDeliveries()]);assert.equal(f.state.sends.length,1);
 const item=[...f.rows.deliveries.values()][0];assert.equal(item.state,'SENT');assert.equal(item.resultCode,'SMTP_ACCEPTED');assert.equal(item.attempts,1);
 await f.service.processEmailDeliveries();assert.equal(f.state.sends.length,1);
});
test('disabled or unconfigured email never calls SMTP and preserves queued work',async()=>{
 const f=fixture();await f.publish();f.state.enabled=false;assert.equal((await f.service.processEmailDeliveries()).disabled,1);f.state.enabled=true;f.state.configured=false;await assert.rejects(f.service.processEmailDeliveries());assert.equal(f.state.sends.length,0);assert.equal([...f.rows.deliveries.values()][0].state,'PENDING');
});
test('unverified, blocked, missing or changed recipient email cannot receive an order email',async()=>{
 for(const kind of ['unverified','blocked','missing']){const f=fixture();await f.publish();if(kind==='unverified')f.owner.emailVerified=null;if(kind==='blocked')f.owner.status='BLOCKED';if(kind==='missing')f.users.delete(f.owner.id);await f.service.processEmailDeliveries();assert.equal(f.state.sends.length,0);assert.equal([...f.rows.deliveries.values()][0].state,'SKIPPED');}
 const f=fixture();await f.publish();let reads=0;f.state.beforeRecipientRead=()=>{if(++reads===2)f.owner.email='changed@example.invalid';};await f.service.processEmailDeliveries();assert.equal(f.state.sends.length,0);assert.equal([...f.rows.deliveries.values()][0].resultCode,'RECIPIENT_CHANGED_BEFORE_SEND');
});
test('temporary SMTP rejection schedules bounded retries, permanent rejection stops and lost response stays unknown',async()=>{
 const f=fixture();await f.publish();f.state.mode='temporary';await f.service.processEmailDeliveries();let item=[...f.rows.deliveries.values()][0];assert.equal(item.state,'RETRY');assert.ok(item.nextAttemptAt>Date.now());
 item.autoAttempts=4;item.nextAttemptAt=new Date(0);await f.service.processEmailDeliveries();item=[...f.rows.deliveries.values()][0];assert.equal(item.state,'FAILED');assert.equal(item.resultCode,'RETRY_LIMIT_REACHED');
 for(const [mode,state]of [['permanent','FAILED'],['lost','UNKNOWN'],['empty','UNKNOWN']]){const f=fixture();await f.publish();f.state.mode=mode;await f.service.processEmailDeliveries();assert.equal([...f.rows.deliveries.values()][0].state,state);await f.service.processEmailDeliveries();assert.equal(f.state.sends.length,1);}
});
test('crash before or after SMTP acceptance is recovered conservatively without sending again',async()=>{
 const f=fixture();await f.publish();const update=f.db.notificationDelivery.updateMany;f.db.notificationDelivery.updateMany=async input=>{if(input.data.state==='SENT')throw Error('result commit unavailable');return update(input);};
 await assert.rejects(f.service.processEmailDeliveries());let item=[...f.rows.deliveries.values()][0];assert.equal(item.state,'SENDING');assert.equal(f.state.sends.length,1);
 f.db.notificationDelivery.updateMany=update;item.leaseExpiresAt=new Date(0);await f.service.processEmailDeliveries();assert.equal([...f.rows.deliveries.values()][0].state,'UNKNOWN');assert.equal(f.state.sends.length,1);
});
test('manual retry requires duplicate acknowledgement, retains identity, audits once and rejects changed replays',async()=>{
 const f=fixture();await f.publish();f.state.mode='lost';await f.service.processEmailDeliveries();let item=[...f.rows.deliveries.values()][0];const input={version:item.version,requestId:randomUUID(),reason:'Checked the SMTP record before retrying.',acknowledgeDuplicate:false};
 await assert.rejects(f.service.retryEmailDelivery(item.id,f.admin.id,input),e=>e.code==='EMAIL_DUPLICATE_ACK_REQUIRED');input.acknowledgeDuplicate=true;
 await f.service.retryEmailDelivery(item.id,f.admin.id,input);await f.service.retryEmailDelivery(item.id,f.admin.id,input);assert.equal(f.rows.deliveries.size,1);assert.equal(await f.db.auditLog.count(),1);
 await assert.rejects(f.service.retryEmailDelivery(item.id,f.admin.id,{...input,reason:'Changed replay reason'}),e=>e.status===409);
 f.state.mode='accept';await f.service.processEmailDeliveries();item=[...f.rows.deliveries.values()][0];assert.equal(item.state,'SENT');assert.equal(item.attempts,2);
});
test('admin email queue/retry routes reject anonymous users, customer access and invalid actions',async()=>{
 const f=fixture(),route=f.load('app/api/admin/notifications/email/route.ts');f.state.user=null;assert.equal((await route.GET(new Request('http://local'))).status,401);f.state.user=f.owner;assert.equal((await route.GET(new Request('http://local'))).status,403);f.state.user=f.admin;
 assert.equal((await route.GET(new Request('http://local?state=invalid'))).status,400);
 assert.equal((await route.POST(new Request('http://local',{method:'POST',body:'{}'}))).status,400);
 await f.publish();const response=await route.GET(new Request('http://local'));assert.equal(response.status,200);assert.equal((await response.json()).items.length,1);
});
