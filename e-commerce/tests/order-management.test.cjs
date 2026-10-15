const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const sourceLoader = require('./fixtures/load-source.cjs');
const { installStockDatabase, matches } = require('./fixtures/stock-db.cjs');

function fixture() {
  const orders = new Map(), attempts = new Map();
  const delegate = rows => ({
    findUnique: async ({where}) => structuredClone([...rows.values()].find(row => matches(row, where)) || null),
    findFirst: async ({where}) => structuredClone([...rows.values()].find(row => matches(row, where)) || null),
    findMany: async ({where={},take=100,skip=0}) => structuredClone([...rows.values()].filter(row => matches(row,where)).slice(skip,skip+take)),
    updateMany: async ({where,data}) => { let count=0;for(const row of rows.values())if(matches(row,where)){for(const [key,value]of Object.entries(data))row[key]=structuredClone(value && typeof value==='object' && 'set' in value ? value.set : value);count++;}return {count};},
  });
  const db={order:delegate(orders),paymentAttempt:delegate(attempts)};
  const product={id:'a'.repeat(24),name:'Phone',description:'Snapshot',category:'Phones',brand:'Brand',price:100000,inStock:true,images:[{color:'Black',colorCode:'#000000',image:'/phone.webp'}]};
  const stock=installStockDatabase(db,[product],[orders,attempts]);
  const variant=[...stock.variants.values()][0];
  const state={user:{id:'b'.repeat(24),role:'ADMIN'}};
  const provider={submits:0,queries:0,result:{state:'PROCESSING',providerRefundId:'refund-original',resultCode:'pending'},error:false,prepareError:false};
  const load=sourceLoader({
    '@/libs/prismadb':{__esModule:true,default:db},
    '@/actions/getCurrentUser':{getCurrentUser:async()=>state.user},
    'next/server':{NextResponse:{json:Response.json}},
    '@/libs/refundProvider':{
      prepareRefundProvider:async(_order,info)=>{if(provider.prepareError)throw Error('private-merchant-key');return {transactionId:info.providerTransactionId || 'pi_fixture',merchantId:info.merchantId};},
      refundRequestId:(_order,info)=>info.id.slice(0,32),
      callRefundProvider:async(_order,info,submit)=>{provider[submit?'submits':'queries']++;provider.last=structuredClone(info);if(provider.error)throw Error('private-secret-provider');return structuredClone(provider.result);},
    },
    '@/libs/adminAudit':{startAdminAudit:async()=>({id:'e'.repeat(24)}),finishAdminAudit:async()=>{}},
  });
  const stocks=load('libs/orderStock.ts'), management=load('libs/orderManagement.ts'), refund=load('libs/orderRefund.ts');
  const owner={id:'c'.repeat(24),role:'USER'}, admin=state.user;
  let sequence=0;
  const order=async(options={})=>{
    const id=createHash('sha256').update(String(++sequence)).digest('hex').slice(0,24);
    const items=[{id:product.id,variantId:variant.id,sku:variant.sku,name:'Saved phone',description:'Old snapshot',category:'Phones',brand:'Brand',quantity:1,price:100000,selectedImg:product.images[0]}];
    const method=options.paymentMethod || 'COD';
    const hold=await stocks.withStockTransaction(tx=>stocks.reserveOrderStock(tx,id,owner.id,items,method));
    const row={id,userId:owner.id,amount:115000,currency:'vnd',status:method==='COD'?'pending':'paid',paymentMethod:method,paymentIntentId:'payment-'+id,paidPaymentAttemptId:null,createDate:new Date(Date.now()-60000),deliveryStatus:'pending',recipientName:'Recipient',recipientPhone:'0900000000',address:{line1:'Saved street',line2:null,city:'Saved city',country:'VN',state:'',postal_code:'',provinceCode:'79'},stockReservation:hold,management:{state:'PLACED',version:1,updatedAt:new Date()},refundInfo:null,shippingInfo:null,products:items,...options};
    orders.set(id,row);
    attempts.set(row.paymentIntentId,{id:row.paymentIntentId,orderId:id,paymentMethod:method,amount:row.amount,currency:'vnd',merchantId:'qa-merchant',state:method==='COD'?'COD_PENDING':'SUCCEEDED',providerTransactionId:'123456789',createDate:row.createDate});
    // A rolled-back transaction restores cloned records; callers must keep reading the live map.
    return new Proxy(row, { get: (_target, key) => orders.get(id)[key], set: (_target, key, value) => { orders.get(id)[key] = value; return true; } });
  };
  const manageInput=(row,action,extras={})=>load('utils/orderManagement.ts').parseOrderManagementInput({action,version:row.management?.version||0,requestId:randomUUID(),confirmed:true,reason:'Reviewed the order details carefully.',...extras});
  const refundInput=(row,action,extras={})=>load('utils/orderRefund.ts').parseRefundInput({action,version:row.refundInfo?.version||0,orderVersion:row.management?.version||0,requestId:randomUUID(),confirmed:true,reason:'Please cancel this order before shipping.',...extras});
  const callRefund=(row,action,viewer=admin,extras={})=>refund.changeOrderRefund(row.id,viewer,refundInput(row,action,extras));
  const manage=(row,action,extras={})=>management.updateOrderManagement(row.id,admin.id,manageInput(row,action,extras));
  return {orders,attempts,db,stock,load,owner,admin,state,provider,order,management,refund,stocks,manage,manageInput,refundInput,callRefund,
    get balance(){return stock.variants.get(variant.id).inventory;},
    async ship(row,status='preparing'){const route=load('app/api/admin/shipments/[orderId]/route.ts');return route.PATCH(new Request('http://localhost/shipment',{method:'PATCH',body:JSON.stringify({version:row.shippingInfo?.version||0,deliveryStatus:status,carrier:status==='shipped'?'Carrier':'',trackingNumber:status==='shipped'?'TRACK1':'',note:''})}),{params:Promise.resolve({orderId:row.id})});},
  };
}

test('order references use the full ID, round trip and distinguish identical suffixes',()=>{
  const u=sourceLoader()('utils/orderManagement.ts');
  const first='0000000000000000ffffffff', second='ffffffffffffffffffffffff';
  assert.notEqual(u.orderReference(first),u.orderReference(second));
  for(const id of [first,second,'0'.repeat(24)])assert.equal(u.orderIdFromReference(u.orderReference(id)),id);
  assert.equal(u.orderIdFromReference('SG-ZZZZZZZZZZZZZZZZZZZ'),null);
});

test('COD confirmation keeps payment pending and stock held, removes unconfirmed expiry and records activity',async()=>{
  const f=fixture(),o=await f.order();
  assert.equal((await f.ship(o)).status,409);
  await f.manage(o,'CONFIRM');
  assert.equal(o.status,'pending');assert.equal(o.management.state,'CONFIRMED');assert.equal(o.stockReservation.state,'HELD');assert.equal(o.stockReservation.expiresAt,null);
  assert.equal(await f.stocks.expireUnconfirmedCodStock(),0);
  assert.equal((await f.ship(o)).status,200);assert.equal(o.deliveryStatus,'preparing');
  const view=await f.management.getOrderManagement(o.id,f.owner);
  assert.equal(view.state,'CONFIRMED');assert.ok(view.events.some(e=>e.action==='ORDER_CONFIRMED'));
});

test('concurrent COD decisions have one winner and rejection releases exactly once',async()=>{
  const f=fixture(),o=await f.order();
  const input=f.manageInput(o,'REJECT');
  const results=await Promise.allSettled([f.management.updateOrderManagement(o.id,f.admin.id,input),f.management.updateOrderManagement(o.id,f.admin.id,{...input,action:'CONFIRM',requestId:randomUUID()})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(o.management.state,'CANCELLED');assert.equal(f.balance.reserved,0);
  await f.management.updateOrderManagement(o.id,f.admin.id,input);
  assert.equal([...f.stock.audits.values()].filter(a=>a.action==='STOCK_RELEASED').length,1);
});

test('expired COD cannot be confirmed and neither failed online payments nor started packing can be edited',async()=>{
  const f=fixture(),expired=await f.order();expired.stockReservation.expiresAt=new Date(0);
  await assert.rejects(f.manage(expired,'CONFIRM'),e=>e.code==='ORDER_ACTION_LOCKED');
  const failed=await f.order({paymentMethod:'MOMO',status:'failed'});
  await assert.rejects(f.manage(failed,'CONFIRM'),e=>e.code==='ORDER_ACTION_LOCKED');
  const packed=await f.order({management:{state:'CONFIRMED',version:2,updatedAt:new Date()},deliveryStatus:'preparing'});
  await assert.rejects(f.manage(packed,'DELIVERY',{fullName:'New name',phone:'0901111111',address:'New street',city:'Saved city'}),e=>e.code==='ORDER_ACTION_LOCKED');
});

test('recipient corrections preserve fee snapshot/amount and cannot silently change delivery area',async()=>{
  const f=fixture(),o=await f.order({totals:{grandTotal:115000,shippingFee:15000}});
  const before=structuredClone(o.totals);
  await f.manage(o,'DELIVERY',{fullName:'New name',phone:'0901111111',address:'New street',city:'Saved city',amount:1});
  assert.equal(o.recipientName,'New name');assert.equal(o.amount,115000);assert.deepEqual(o.totals,before);assert.equal(o.address.provinceCode,'79');
  await assert.rejects(f.manage(o,'DELIVERY',{fullName:'New name',phone:'0901111111',address:'New street',city:'Other city'}),e=>e.code==='ORDER_ACTION_LOCKED');
});

test('public activity filters internal notes before pagination and never exposes audit reasons or address snapshots',async()=>{
  const f=fixture(),o=await f.order();
  await f.manage(o,'NOTE',{note:'Private supplier instructions',visibility:'INTERNAL',reason:'Private administrative explanation.'});
  await f.manage(o,'NOTE',{note:'We received your delivery instructions.',visibility:'PUBLIC',reason:'Private second explanation.'});
  const view=await f.management.getOrderManagement(o.id,f.owner);
  assert.equal(view.events.length,1);assert.equal(view.events[0].message,'We received your delivery instructions.');
  assert.doesNotMatch(JSON.stringify(view),/Private|fingerprint|before|actorId/);
  assert.equal((await f.management.getOrderManagement(o.id,f.admin)).events.length,2);
});

test('audit failure rolls back rejection, reservation and payment attempt state together',async()=>{
  const f=fixture(),o=await f.order(),create=f.db.auditLog.create;
  f.db.auditLog.create=async options=>{if(options.data.action==='ORDER_REJECTED')throw Error('fixture audit outage');return create(options);};
  await assert.rejects(f.manage(o,'REJECT'));
  const current=f.orders.get(o.id);assert.equal(current.status,'pending');assert.equal(current.stockReservation.state,'HELD');assert.equal(f.balance.reserved,1);assert.equal(f.attempts.get(o.paymentIntentId).state,'COD_PENDING');
});

test('paid cancellation request freezes dispatch; approval cancels order and releases stock without erasing payment',async()=>{
  const f=fixture(),o=await f.order({paymentMethod:'STRIPE',deliveryStatus:'ready_to_ship',management:{state:'CONFIRMED',version:3,updatedAt:new Date()}});
  await f.callRefund(o,'REQUEST',f.owner,{amount:1});
  assert.equal(o.refundInfo.amount,115000);assert.equal(o.stockReservation.state,'HELD');assert.equal(o.status,'paid');
  assert.equal((await f.ship(o,'shipped')).status,409);
  await f.callRefund(o,'APPROVE');
  assert.equal(o.status,'paid');assert.equal(o.management.state,'CANCELLED');assert.equal(o.deliveryStatus,'cancelled');assert.equal(o.stockReservation.state,'RELEASED');assert.equal(o.refundInfo.state,'APPROVED');
  assert.equal((await f.ship(o,'shipped')).status,409);assert.equal(f.provider.submits,0);
});

test('declining a paid cancellation restores shipment availability without releasing or refunding stock',async()=>{
  const f=fixture(),o=await f.order({paymentMethod:'MOMO',management:{state:'CONFIRMED',version:2,updatedAt:new Date()}});
  await f.callRefund(o,'REQUEST',f.owner);await f.callRefund(o,'DECLINE');
  assert.equal(o.refundInfo.state,'DECLINED');assert.equal(o.management.state,'CONFIRMED');assert.equal(f.balance.reserved,1);assert.equal((await f.ship(o)).status,200);
});

test('unpaid, foreign-owned, dispatched or consumed orders cannot enter the paid refund flow',async()=>{
  const f=fixture();
  for(const options of [{},{paymentMethod:'MOMO',deliveryStatus:'shipped'},{paymentMethod:'STRIPE',deliveryStatus:'delivered'}]){
    const o=await f.order(options);await assert.rejects(f.callRefund(o,'REQUEST',f.owner),e=>e.code==='REFUND_LOCKED');
  }
  const o=await f.order({paymentMethod:'STRIPE'});
  await assert.rejects(f.callRefund(o,'REQUEST',{id:'d'.repeat(24),role:'USER'}),e=>e.status===404);
});

test('duplicate refund submissions send one provider operation and confirmed result is independent of paid status',async()=>{
  const f=fixture(),o=await f.order({paymentMethod:'STRIPE'});
  await f.callRefund(o,'REQUEST',f.owner);await f.callRefund(o,'APPROVE');
  const input=f.refundInput(o,'EXECUTE');
  const results=await Promise.allSettled([f.refund.changeOrderRefund(o.id,f.admin,input),f.refund.changeOrderRefund(o.id,f.admin,{...input,requestId:randomUUID()})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.provider.submits,1);assert.equal(o.refundInfo.state,'PROCESSING');
  await f.refund.changeOrderRefund(o.id,f.admin,input);assert.equal(f.provider.submits,1);
  f.provider.result={state:'SUCCEEDED',providerRefundId:'refund-original',resultCode:'succeeded'};
  await f.callRefund(o,'CHECK');assert.equal(o.refundInfo.state,'SUCCEEDED');assert.equal(o.status,'paid');assert.equal(o.management.state,'CANCELLED');
  await assert.rejects(f.callRefund(o,'EXECUTE'));assert.equal(f.provider.submits,1);
});

test('a lost provider response stays under review; recovery queries the original identity without another refund',async()=>{
  const f=fixture(),o=await f.order({paymentMethod:'MOMO'});
  await f.callRefund(o,'REQUEST',f.owner);await f.callRefund(o,'APPROVE');f.provider.error=true;
  await f.callRefund(o,'EXECUTE');assert.equal(o.refundInfo.state,'REVIEW');assert.equal(f.provider.submits,1);
  const id=o.refundInfo.providerRequestId;f.provider.error=false;f.provider.result={state:'SUCCEEDED',providerRefundId:'1234',resultCode:'0'};
  await f.callRefund(o,'CHECK');assert.equal(o.refundInfo.state,'SUCCEEDED');assert.equal(f.provider.last.providerRequestId,id);assert.equal(f.provider.submits,1);assert.equal(f.provider.queries,1);
});

test('COD manual refund requires approval, receipt/date and cannot complete an online refund',async()=>{
  const f=fixture(),o=await f.order({status:'paid'});
  await f.callRefund(o,'REQUEST',f.owner);await f.callRefund(o,'APPROVE');
  await f.callRefund(o,'MANUAL',f.admin,{reference:'BANK-RECEIPT-001',occurredAt:new Date().toISOString()});
  assert.equal(o.refundInfo.state,'SUCCEEDED');assert.equal(o.refundInfo.manualReference,'BANK-RECEIPT-001');assert.equal(f.provider.submits,0);
  const online=await f.order({paymentMethod:'STRIPE'});await f.callRefund(online,'REQUEST',f.owner);await f.callRefund(online,'APPROVE');
  await assert.rejects(f.callRefund(online,'MANUAL',f.admin,{reference:'fake',occurredAt:new Date().toISOString()}),e=>e.code==='REFUND_LOCKED');
});

test('admin/customer routes enforce ownership, role and input validation without leaking provider errors',async()=>{
  const f=fixture(),o=await f.order({paymentMethod:'STRIPE'});
  const admin=f.load('app/api/admin/orders/[orderId]/refund/route.ts'), customer=f.load('app/api/order/[orderId]/refund/route.ts'), management=f.load('app/api/admin/orders/[orderId]/manage/route.ts');
  const ctx={params:Promise.resolve({orderId:o.id})};
  const req=body=>new Request('http://localhost/action',{method:'POST',body:JSON.stringify({...body,confirmed:true})});
  f.state.user=null;assert.equal((await admin.GET(new Request('http://localhost'),ctx)).status,401);
  f.state.user=f.owner;assert.equal((await admin.GET(new Request('http://localhost'),ctx)).status,403);assert.equal((await management.POST(req({}),ctx)).status,403);
  assert.equal((await customer.POST(req(f.refundInput(o,'APPROVE')),ctx)).status,403);
  assert.equal((await customer.POST(req({}),ctx)).status,400);
  assert.equal((await customer.POST(req(f.refundInput(o,'REQUEST')),ctx)).status,200);
  await f.callRefund(o,'APPROVE');f.state.user=f.admin;f.provider.prepareError=true;
  const response=await admin.POST(req(f.refundInput(o,'EXECUTE')),ctx);assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private-/);
  assert.equal(o.refundInfo.state,'APPROVED');assert.equal(f.provider.submits,0);
  const publicView=await f.refund.getOrderRefund(o.id,f.owner);assert.equal(publicView.providerRefundId,undefined);assert.equal(publicView.decisionReason,undefined);
});

test('refund approval audit outage rolls stock and cancellation back, leaving a retryable request',async()=>{
  const f=fixture(),o=await f.order({paymentMethod:'STRIPE'});await f.callRefund(o,'REQUEST',f.owner);
  const create=f.db.auditLog.create;f.db.auditLog.create=async options=>{if(options.data.action==='REFUND_APPROVED')throw Error('audit outage');return create(options);};
  await assert.rejects(f.callRefund(o,'APPROVE'));
  const current=f.orders.get(o.id);assert.equal(current.refundInfo.state,'REQUESTED');assert.equal(current.stockReservation.state,'HELD');assert.equal(current.deliveryStatus,'pending');assert.equal(f.balance.reserved,1);
});

test('a later Stripe sync cannot overwrite a legacy delivery address corrected through order management',async()=>{
  const order={id:'a'.repeat(24),paymentMethod:'STRIPE',paymentIntentId:'pi_original',amount:115000,currency:'vnd',status:'paid',management:{state:'CONFIRMED',version:2,updatedAt:new Date()},recipientName:'Corrected recipient',address:{line1:'Corrected street'}};
  const db={order:{updateMany:async({data})=>{Object.assign(order,data);return {count:1};},findUnique:async()=>structuredClone(order)}};
  installStockDatabase(db,[],[]);
  const load=sourceLoader({'@/libs/prismadb':{__esModule:true,default:db},'./stripe':{getStripe:()=>({paymentIntents:{retrieve:async()=>({id:'pi_original',status:'succeeded',amount:115000,amount_received:115000,currency:'vnd',shipping:{name:'Old recipient',address:{line1:'Old street'}}})}})}});
  await load('libs/syncStripeOrder.ts').syncStripeOrder(order);
  assert.equal(order.recipientName,'Corrected recipient');assert.equal(order.address.line1,'Corrected street');
});

test('a paid COD order does not display an unpaid hold-expiry deadline',async()=>{
  const f=fixture(),o=await f.order({status:'paid'});
  const response=await f.load('app/api/order/[orderId]/stock/route.ts').GET(new Request('http://localhost'),{params:Promise.resolve({orderId:o.id})});
  const data=await response.json();assert.equal(data.expiresAt,null);assert.equal(data.canCancel,false);
});
