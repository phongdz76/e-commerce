const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');

// Called only by the HTTP runner connected to its generated, disposable QA database.
async function verifyOrderLifecycleHttp({call,prisma,cookies,users,variant,body,checks}) {
  const json=(cookie,payload)=>({cookie,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const admin=cookies[0],owner=cookies[1];
  const create=async()=>{
    const payload=body(users[1]);
    const quote=await (await call('/api/checkout/quote',json(owner,payload))).json();
    const response=await call('/api/order/create-cod',json(owner,{...payload,quoteToken:quote.token}));
    assert.equal(response.status,200);return (await response.json()).order;
  };
  const balance=await prisma.productVariant.findUnique({where:{id:variant.id}});
  await prisma.productVariant.update({where:{id:variant.id},data:{inventory:{set:{onHand:10,reserved:0,version:balance.inventory.version+1,updatedAt:new Date()}}}});
  const view=(id)=>call(`/api/admin/orders/${id}/manage`,{cookie:admin}).then(r=>r.json());
  const manage=async(id,action,extra={})=>{
    const current=await view(id);
    return call(`/api/admin/orders/${id}/manage`,json(admin,{action,version:current.version,requestId:randomUUID(),confirmed:true,reason:'Reviewed the isolated QA order details.',...extra}));
  };
  const refundView=(id,cookie=admin)=>call(cookie===admin?`/api/admin/orders/${id}/refund`:`/api/order/${id}/refund`,{cookie}).then(r=>r.json());
  const refund=async(id,action,cookie=admin,extra={})=>{
    const current=await refundView(id,cookie);
    return call(cookie===admin?`/api/admin/orders/${id}/refund`:`/api/order/${id}/refund`,json(cookie,{action,version:current.version,orderVersion:current.orderVersion,requestId:randomUUID(),confirmed:true,reason:'Cancel before dispatch in the isolated QA test.',...extra}));
  };
  const ship=async(id,status,version=0)=>call(`/api/admin/shipments/${id}`,{...json(admin,{deliveryStatus:status,version,carrier:status==='shipped'?'QA carrier':'',trackingNumber:status==='shipped'?'QA-TRACK':'',note:''}),method:'PATCH'});
  const cod=await create();
  for(const path of [`/api/admin/orders/${cod.id}/manage`,`/api/admin/orders/${cod.id}/refund`,'/api/admin/refunds']){
    assert.equal((await call(path)).status,401);assert.equal((await call(path,{cookie:owner})).status,403);
  }
  assert.equal((await ship(cod.id,'preparing')).status,409);
  const current=await view(cod.id);
  const decision={action:'CONFIRM',version:current.version,requestId:randomUUID(),confirmed:true,reason:'Confirmed the isolated COD order with the buyer.'};
  const decisions=await Promise.all([decision,{...decision,action:'REJECT',requestId:randomUUID()}].map(payload=>call(`/api/admin/orders/${cod.id}/manage`,json(admin,payload))));
  assert.equal(decisions.filter(r=>r.status===200).length,1);assert.equal(decisions.filter(r=>r.status===409).length,1);
  // Either decision may win the real race. Use a fresh order if rejection wins.
  const winner=await prisma.order.findUnique({where:{id:cod.id}});
  const confirmed=winner.management.state==='CONFIRMED'?cod:await create();
  if(confirmed.id!==cod.id)assert.equal((await manage(confirmed.id,'CONFIRM')).status,200);
  assert.equal((await manage(confirmed.id,'DELIVERY',{fullName:'Corrected QA recipient',phone:'0901234567',address:'Corrected QA street',city:'QA city',amount:1})).status,200);
  let saved=await prisma.order.findUnique({where:{id:confirmed.id}});
  assert.equal(saved.amount,25000);assert.equal(saved.status,'pending');assert.equal(saved.stockReservation.expiresAt,null);assert.equal(saved.address.provinceCode,'79');
  assert.equal((await manage(confirmed.id,'NOTE',{note:'Public delivery instruction',visibility:'PUBLIC',reason:'Internal approval explanation, never public.'})).status,200);
  const alertsBeforePrivate=await prisma.notificationEvent.count({where:{entityId:confirmed.id}});
  assert.equal((await manage(confirmed.id,'NOTE',{note:'PRIVATE-INTERNAL-INSTRUCTION',visibility:'INTERNAL'})).status,200);
  assert.equal(await prisma.notificationEvent.count({where:{entityId:confirmed.id}}),alertsBeforePrivate);
  const publicActivity=await (await call(`/api/order/${confirmed.id}/activity`,{cookie:owner})).text();
  assert.match(publicActivity,/Public delivery instruction/);assert.doesNotMatch(publicActivity,/PRIVATE-INTERNAL|Internal approval|fingerprint|providerRequestId/);
  assert.equal((await call(`/api/order/${confirmed.id}/activity`,{cookie:cookies[2]})).status,404);
  assert.equal((await ship(confirmed.id,'preparing')).status,200);
  assert.equal(await prisma.notificationEvent.count({where:{entityId:confirmed.id,kind:'SHIPMENT_UPDATED'}}),1);
  const privateShipment={deliveryStatus:'preparing',version:1,carrier:'',trackingNumber:'',note:'PRIVATE-PACKING-INSTRUCTION'};
  assert.equal((await call(`/api/admin/shipments/${confirmed.id}`,{...json(admin,privateShipment),method:'PATCH'})).status,200);
  assert.equal(await prisma.notificationEvent.count({where:{entityId:confirmed.id,kind:'SHIPMENT_UPDATED'}}),1);
  assert.equal((await manage(confirmed.id,'DELIVERY',{fullName:'Another recipient',phone:'0901234567',address:'Another street',city:'QA city'})).status,409);
  checks.push('real COD confirmation/rejection race, immutable totals and recipient correction; packing locks edits and customer activity excludes internal notes');
  // Explicit paid fixtures stand in for previous successful sandbox payments. No gateway is called.
  await prisma.order.update({where:{id:confirmed.id},data:{paymentMethod:'STRIPE',paymentIntentId:'pi_qa_'+confirmed.id,status:'paid'}});
  assert.equal((await refund(confirmed.id,'REQUEST',owner,{amount:1})).status,200);
  assert.equal((await ship(confirmed.id,'ready_to_ship',1)).status,409);
  const request=await refundView(confirmed.id);
  const approve={action:'APPROVE',version:request.version,orderVersion:request.orderVersion,requestId:randomUUID(),confirmed:true,reason:'Approved full cancellation before carrier handover.'};
  const approvals=await Promise.all([approve,{...approve,requestId:randomUUID()}].map(payload=>call(`/api/admin/orders/${confirmed.id}/refund`,json(admin,payload))));
  assert.equal(approvals.filter(r=>r.status===200).length,1);assert.equal(approvals.filter(r=>r.status===409).length,1);
  saved=await prisma.order.findUnique({where:{id:confirmed.id}});assert.equal(saved.status,'paid');assert.equal(saved.management.state,'CANCELLED');assert.equal(saved.stockReservation.state,'RELEASED');assert.equal(saved.refundInfo.amount,25000);
  assert.equal((await refund(confirmed.id,'EXECUTE')).status,503); // No Stripe key in this runner: no outbound request.
  assert.equal((await prisma.order.findUnique({where:{id:confirmed.id}})).refundInfo.state,'APPROVED');
  assert.equal((await call(`/api/order/${confirmed.id}/refund`,{cookie:cookies[2]})).status,404);
  checks.push('real paid cancellation freezes shipment; concurrent approval releases held stock once and preserves paid status; missing provider settings cannot claim money refunded');
  const manual=await create();await prisma.order.update({where:{id:manual.id},data:{status:'paid'}});
  assert.equal((await refund(manual.id,'REQUEST',owner)).status,200);assert.equal((await refund(manual.id,'APPROVE')).status,200);
  const receipt=await refundView(manual.id);const manualBody={action:'MANUAL',version:receipt.version,orderVersion:receipt.orderVersion,requestId:randomUUID(),confirmed:true,reason:'Verified the private QA manual refund receipt.',reference:'QA-MANUAL-BANK-001',occurredAt:new Date().toISOString()};
  for(let i=0;i<2;i++)assert.equal((await call(`/api/admin/orders/${manual.id}/refund`,json(admin,manualBody))).status,200);
  const manualSaved=await prisma.order.findUnique({where:{id:manual.id}});assert.equal(manualSaved.refundInfo.state,'SUCCEEDED');assert.equal(manualSaved.status,'paid');
  assert.equal(await prisma.auditLog.count({where:{entityId:manual.id,action:'REFUND_SUCCEEDED'}}),1);
  const refundEvents=await prisma.notificationEvent.findMany({where:{entityId:manual.id}});
  assert.equal(refundEvents.filter(event=>event.kind==='REFUND_SUCCEEDED').length,1);
  const refundEmail=await prisma.notificationDelivery.findFirst({where:{orderId:manual.id,subject:{startsWith:'Manual refund receipt recorded'}}});assert.ok(refundEmail);assert.equal(refundEmail.state,'PENDING');
  const queue=await (await call('/api/admin/refunds?state=SUCCEEDED',{cookie:admin})).json();assert.ok(queue.refunds.some(row=>row.orderId===manual.id));
  const customer=await (await call(`/api/order/${manual.id}/refund`,{cookie:owner})).text();assert.doesNotMatch(customer,/QA-MANUAL-BANK|decisionReason|merchantId|providerRequestId/);
  checks.push('manual COD refund requires a saved receipt and completes once on replay; real admin refund queue and customer projection stay consistent');
  const racing=await create();assert.equal((await manage(racing.id,'CONFIRM')).status,200);
  assert.equal((await ship(racing.id,'preparing')).status,200);assert.equal((await ship(racing.id,'ready_to_ship',1)).status,200);
  await prisma.order.update({where:{id:racing.id},data:{status:'paid'}});
  const raceView=await refundView(racing.id,owner);
  const raceInput={action:'REQUEST',version:raceView.version,orderVersion:raceView.orderVersion,requestId:randomUUID(),confirmed:true,reason:'Cancel this QA order before handover to the carrier.'};
  const race=await Promise.all([call(`/api/order/${racing.id}/refund`,json(owner,raceInput)),ship(racing.id,'shipped',2)]);
  assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status===409).length,1);
  const raced=await prisma.order.findUnique({where:{id:racing.id}});
  if(race[0].status===200){assert.equal(raced.refundInfo.state,'REQUESTED');assert.equal(raced.stockReservation.state,'HELD');assert.equal(raced.deliveryStatus,'ready_to_ship');}
  else{assert.equal(raced.deliveryStatus,'shipped');assert.equal(raced.stockReservation.state,'CONSUMED');assert.equal(raced.refundInfo,null);assert.equal((await refund(racing.id,'REQUEST',owner)).status,409);}
  checks.push('paid cancellation request and carrier handover race: exactly one succeeds; dispatched stock cannot be refunded as an unshipped reservation');
  const legacy=await create();
  await prisma.$runCommandRaw({update:'Order',updates:[{q:{_id:{$oid:legacy.id}},u:{$unset:{management:'',deliveryStatus:''},$set:{status:'paid'}}}]});
  assert.equal((await manage(legacy.id,'NOTE',{note:'Legacy address has been checked.',visibility:'PUBLIC'})).status,200);
  assert.equal((await refund(legacy.id,'REQUEST',owner)).status,200);assert.equal((await refund(legacy.id,'APPROVE')).status,200);
  const legacySaved=await prisma.order.findUnique({where:{id:legacy.id}});assert.equal(legacySaved.status,'paid');assert.equal(legacySaved.management.state,'CANCELLED');assert.equal(legacySaved.stockReservation.state,'RELEASED');
  checks.push('legacy BSON with missing management/delivery fields can be reviewed and cancelled without a backfill or invented payment state');
  const orderAlerts=await prisma.notification.findMany({where:{entityId:confirmed.id}}),emails=await prisma.notificationDelivery.findMany({where:{orderId:confirmed.id}});
  for(const kind of ['ORDER_CREATED','ORDER_CONFIRMED','ORDER_DELIVERY_UPDATED','ORDER_NOTE_PUBLIC','SHIPMENT_UPDATED','REFUND_REQUESTED','REFUND_APPROVED'])assert.ok(orderAlerts.some(alert=>alert.kind===kind),'missing '+kind);
  assert.doesNotMatch(JSON.stringify([...orderAlerts,...emails]),/PRIVATE-INTERNAL|PRIVATE-PACKING|Internal approval|Corrected QA street|0901234567|Cancel before dispatch/);
  assert.ok(emails.every(email=>email.state==='PENDING'&&email.attempts===0));
  checks.push('real domain transactions publish order/shipment/refund alerts and queue emails once; private notes do not publish or leak, manual receipts do not claim a gateway payout');
  const confirmationOrder=await create();
  const paidOrder=await create();await prisma.order.update({where:{id:paidOrder.id},data:{status:'paid'}});
  // The shared cart browser check expects one available unit; preserve these QA orders' existing holds.
  const browserBalance=await prisma.productVariant.findUnique({where:{id:variant.id}});
  await prisma.productVariant.update({where:{id:variant.id},data:{inventory:{set:{...browserBalance.inventory,onHand:browserBalance.inventory.reserved+1,version:browserBalance.inventory.version+1,updatedAt:new Date()}}}});
  return {confirmationOrderId:confirmationOrder.id,paidOrderId:paidOrder.id,ownerCookie:owner,adminCookie:admin};
}
module.exports={verifyOrderLifecycleHttp};
