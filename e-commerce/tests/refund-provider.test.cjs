const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const sourceLoader=require('./fixtures/load-source.cjs');
const originalFetch=global.fetch;
test.afterEach(()=>{global.fetch=originalFetch;});
test.beforeEach(()=>{
  Object.assign(process.env,{MOMO_PARTNER_CODE:'QA-MOMO',MOMO_ACCESS_KEY:'qa-access',MOMO_SECRET_KEY:'qa-momo-secret',MOMO_API_ENDPOINT:'https://test-payment.momo.vn/v2/gateway/api/create',MOMO_QUERY_ENDPOINT:'https://test-payment.momo.vn/v2/gateway/api/query',ZALOPAY_APP_ID:'2553',ZALOPAY_KEY1:'qa-zalo-key1',ZALOPAY_KEY2:'qa-zalo-key2',VNP_TMNCODE:'QAVNPAY1',VNP_HASHSECRET:'qa-vnp-secret',VNP_URL:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',VNP_QUERY_URL:'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'});
});
function fixture(method){
  const order={id:'a'.repeat(24),paymentMethod:method,amount:115000,currency:'vnd'};
  const info={id:'f'.repeat(64),amount:115000,currency:'vnd',paymentReference:method==='STRIPE'?'pi_original':'original-payment',paymentCreatedAt:new Date('2026-10-15T00:00:00Z'),merchantId:method==='MOMO'?'QA-MOMO':method==='VNPAY'?'QAVNPAY1':'2553',providerTransactionId:'123456789',providerRequestId:'b'.repeat(32),approvedBy:'c'.repeat(24),providerRefundId:null};
  const calls=[],state={status:'pending',throwCreate:false,listCount:0};
  const refund=()=>({id:'re_original',payment_intent:info.paymentReference,amount:info.amount,currency:'vnd',status:state.status,metadata:{sgtechRefundId:info.id,orderId:order.id}});
  const stripe={paymentIntents:{retrieve:async()=>({id:info.paymentReference,status:'succeeded',amount:115000,amount_received:115000,currency:'vnd',livemode:false})},refunds:{
    create:async(data,options)=>{calls.push({data,options});if(state.throwCreate)throw Error('lost response');return refund();},
    retrieve:async id=>{assert.equal(id,'re_original');return refund();},
    list:async function*(){state.listCount++;yield {...refund(),id:'unrelated',metadata:{sgtechRefundId:'other'}};yield refund();},
  }};
  const service=sourceLoader({'@/libs/stripe':{getStripe:()=>stripe}})('libs/refundProvider.ts');
  const mock=callback=>{global.fetch=async(endpoint,options)=>{const body=JSON.parse(options.body);calls.push({endpoint:String(endpoint),options,body});return Response.json(await callback(String(endpoint),body));};};
  return {order,info,calls,state,stripe,service,mock};
}
test('Stripe full refund uses original intent/amount and stable idempotency key; pending is not refunded',async()=>{
 const f=fixture('STRIPE');await f.service.prepareRefundProvider(f.order,f.info);
 assert.equal((await f.service.callRefundProvider(f.order,f.info,true)).state,'PROCESSING');
 assert.equal(f.calls[0].data.payment_intent,'pi_original');assert.equal(f.calls[0].data.amount,115000);assert.equal(f.calls[0].options.idempotencyKey,'sgtech-refund-'+f.info.id);
 f.state.status='succeeded';const result=await f.service.callRefundProvider(f.order,{...f.info,providerRefundId:'re_original'},false);assert.equal(result.state,'SUCCEEDED');assert.equal(f.calls.length,1);
});
test('Stripe lost response recovers the original refund by metadata; checks never create a new operation',async()=>{
 const f=fixture('STRIPE');f.state.throwCreate=true;await assert.rejects(f.service.callRefundProvider(f.order,f.info,true));
 f.state.status='succeeded';const result=await f.service.callRefundProvider(f.order,f.info,false);assert.equal(result.state,'SUCCEEDED');assert.equal(f.state.listCount,1);assert.equal(f.calls.length,1);
 f.stripe.paymentIntents.retrieve=async()=>({id:'pi_original',status:'succeeded',amount:1,amount_received:1,currency:'vnd'});await assert.rejects(f.service.prepareRefundProvider(f.order,f.info));
});
test('MoMo refund signatures cover server amount, original transaction and fixed refund identity',async()=>{
 const f=fixture('MOMO');await f.service.prepareRefundProvider(f.order,f.info);
 f.mock((_url,b)=>({partnerCode:b.partnerCode,requestId:b.requestId,orderId:b.orderId,amount:b.amount,resultCode:0,transId:'987654321'}));
 const result=await f.service.callRefundProvider(f.order,f.info,true);assert.equal(result.state,'SUCCEEDED');
 const call=f.calls[0],b=call.body;
 const raw=`accessKey=qa-access&amount=115000&description=${b.description}&orderId=${f.info.providerRequestId}&partnerCode=QA-MOMO&requestId=${f.info.providerRequestId}&transId=123456789`;
 assert.equal(b.signature,createHmac('sha256','qa-momo-secret').update(raw).digest('hex'));
 assert.equal(call.endpoint,'https://test-payment.momo.vn/v2/gateway/api/refund');assert.equal(call.options.redirect,'error');
});
test('MoMo query success alone is insufficient: match refund line, amount and settlement result',async()=>{
 const f=fixture('MOMO');let rows=[];
 f.mock((_url,b)=>({partnerCode:'QA-MOMO',requestId:b.requestId,orderId:'original-payment',resultCode:0,refundTrans:rows}));
 assert.equal((await f.service.callRefundProvider(f.order,f.info,false)).state,'REVIEW');
 rows=[{orderId:f.info.providerRequestId,amount:115000,resultCode:7002,transId:'987654321'}];assert.equal((await f.service.callRefundProvider(f.order,f.info,false)).state,'PROCESSING');
 rows[0].resultCode=0;assert.equal((await f.service.callRefundProvider(f.order,f.info,false)).state,'SUCCEEDED');
 rows[0].amount=1;assert.equal((await f.service.callRefundProvider(f.order,f.info,false)).state,'REVIEW');
 assert.ok(f.calls.every(c=>c.endpoint.endsWith('/refund/query')));
});
test('MoMo rejects mismatched merchant echoes and cannot submit using a different merchant receipt',async()=>{
 const f=fixture('MOMO');await assert.rejects(f.service.prepareRefundProvider(f.order,{...f.info,merchantId:'OTHER'}));
 f.mock((_url,b)=>({partnerCode:'OTHER',requestId:b.requestId,orderId:b.orderId,amount:115000,resultCode:0,transId:'123'}));
 await assert.rejects(f.service.callRefundProvider(f.order,f.info,true));
});
test('ZaloPay verifies original paid order then signs refund and checks status using the same merchant ID',async()=>{
 const f=fixture('ZALOPAY');
 f.mock((url)=>url.endsWith('/query')?{return_code:1,amount:115000,zp_trans_id:'123456789'}:{return_code:1,sub_return_code:1,refund_id:'987654321'});
 const source=await f.service.prepareRefundProvider(f.order,f.info);assert.equal(source.transactionId,'123456789');
 const id=f.service.refundRequestId(f.order,f.info,new Date('2026-10-14T18:00:00Z'));assert.match(id,/^261015_2553_/);
 f.info.providerRequestId=id;assert.equal((await f.service.callRefundProvider(f.order,f.info,true)).state,'PROCESSING');
 const b=f.calls.at(-1).body;const raw=`2553|123456789|115000|${b.description}|${b.timestamp}`;
 assert.equal(b.mac,createHmac('sha256','qa-zalo-key1').update(raw).digest('hex'));
 assert.equal((await f.service.callRefundProvider(f.order,f.info,false)).state,'SUCCEEDED');
 assert.equal(f.calls.at(-1).body.m_refund_id,id);assert.ok(f.calls.at(-1).endpoint.endsWith('/query_refund'));
});
test('VNPay signed refund uses original payment date and full amount; an original payment success is not refund success',async()=>{
 const f=fixture('VNPAY');let refundType='02',refundStatus='05',badMac=false;
 f.mock((_url,b)=>{
  const r={vnp_ResponseId:'response-id',vnp_Command:b.vnp_Command,vnp_ResponseCode:'00',vnp_Message:'OK',vnp_TmnCode:'QAVNPAY1',vnp_TxnRef:'original-payment',vnp_Amount:'11500000',vnp_BankCode:'NCB',vnp_PayDate:'20261015100000',vnp_TransactionNo:'987654321',vnp_TransactionType:refundType,vnp_TransactionStatus:refundStatus,vnp_OrderInfo:b.vnp_OrderInfo};
  const fields=['vnp_ResponseId','vnp_Command','vnp_ResponseCode','vnp_Message','vnp_TmnCode','vnp_TxnRef','vnp_Amount','vnp_BankCode','vnp_PayDate','vnp_TransactionNo','vnp_TransactionType','vnp_TransactionStatus','vnp_OrderInfo',...(b.vnp_Command==='querydr'?['vnp_PromotionCode','vnp_PromotionAmount']:[])];
  r.vnp_SecureHash=badMac?'bad':createHmac('sha512','qa-vnp-secret').update(fields.map(k=>r[k]??'').join('|')).digest('hex');return r;
 });
 await f.service.prepareRefundProvider(f.order,f.info);
 assert.equal((await f.service.callRefundProvider(f.order,f.info,true)).state,'PROCESSING');
 const b=f.calls[0].body;assert.equal(b.vnp_TransactionDate,'20261015070000');assert.equal(b.vnp_TransactionType,'02');assert.equal(b.vnp_Amount,'11500000');
 const signature=createHmac('sha512','qa-vnp-secret').update(Object.entries(b).filter(([k])=>k!=='vnp_SecureHash').map(([,v])=>v).join('|')).digest('hex');assert.equal(signature,b.vnp_SecureHash);
 refundType='01';refundStatus='00';assert.equal((await f.service.callRefundProvider(f.order,f.info,false)).state,'REVIEW');
 refundType='02';assert.equal((await f.service.callRefundProvider(f.order,f.info,false)).state,'SUCCEEDED');
 badMac=true;await assert.rejects(f.service.callRefundProvider(f.order,f.info,false));
});
