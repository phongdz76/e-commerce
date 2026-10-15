const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

async function verifyOrderLifecycleBrowser({page,origin,artifactDirectory,checks,fixture}) {
  let stage='starting order browser checks';
  try {
  const cookie=async value=>{
    const split=value.indexOf('=');
    await page.send('Network.setCookies',{cookies:[{name:value.slice(0,split),value:value.slice(split+1),url:origin,httpOnly:true,sameSite:'Lax'}]});
  };
  const navigate=async(route,marker)=>{
    await page.send('Page.navigate',{url:origin+route});
    await page.wait(`location.pathname===${JSON.stringify(route)} && ${marker}`);
  };
  const fill=async(label,value)=>page.evaluate(`(()=>{const el=document.querySelector('[aria-label=${JSON.stringify(label)}]');if(!el)throw Error('Field missing');const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);
  const confirm=async section=>page.evaluate(`(()=>{const el=document.querySelector('[aria-label=${JSON.stringify(section)}] input[type=checkbox]');if(!el.checked)el.click();})()`);
  const submit=async section=>page.evaluate(`document.querySelector('[aria-label=${JSON.stringify(section)}] button[type=submit]').click()`);
  const refundReady="!!document.querySelector('[aria-label=\"Cancellation and refund\"] textarea')";
  const manageReady="!!document.querySelector('[aria-label=\"Order action\"]')";
  await page.send('Fetch.disable');
  for(const width of [320,1440]){
    stage='customer layout at '+width;
    await page.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await cookie(fixture.ownerCookie);
    await navigate('/orders/'+fixture.paidOrderId,refundReady);
    await page.wait("!document.querySelector('[aria-label=\"Cancellation and refund\"]').innerText.includes('Loading refund')");
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'Customer order must fit '+width);
    let capture=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(artifactDirectory,`p1-paid-cancel-customer-${width}.png`),Buffer.from(capture.data,'base64'));
    await cookie(fixture.adminCookie);
    stage='admin layout at '+width;
    await navigate('/admin/orders/'+fixture.confirmationOrderId,manageReady);
    await page.wait("!document.querySelector('[aria-label=\"Order management and activity\"]').innerText.includes('Loading order')");
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'Admin order must fit '+width);
    capture=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(artifactDirectory,`p1-order-management-${width}.png`),Buffer.from(capture.data,'base64'));
    checks.push({width,customerPaidCancellationFits:true,adminOrderManagementFits:true});
  }
  stage='confirming COD';
  await fill('Order action','CONFIRM');
  await fill('Order change reason','Confirmed the QA order with its customer.');
  await confirm('Order management and activity');await submit('Order management and activity');
  await page.wait("document.querySelector('[aria-label=\"Order management and activity\"]')?.innerText.includes('· Confirmed') && !document.querySelector('[aria-label=\"Order management and activity\"]').innerText.includes('Loading order')");
  const cod=await page.evaluate(`fetch('/api/admin/orders/${fixture.confirmationOrderId}').then(r=>r.json())`);assert.equal(cod.status,'pending');assert.equal(cod.orderState,'CONFIRMED');
  // A transport outage must keep the note and retry identity. No write reaches even the QA database here.
  const attempts=[];
  stage='retaining a failed note';
  page.listeners.set('Fetch.requestPaused',({requestId,request})=>{
    if(request.method==='POST'){
      attempts.push(JSON.parse(request.postData));
      void page.send('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:'QA outage. Your input has been kept.'})).toString('base64')});
    }else void page.send('Fetch.continueRequest',{requestId});
  });
  await page.send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/admin/orders/'+fixture.confirmationOrderId+'/manage'}]});
  await fill('Order action','NOTE');await fill('Note visibility','PUBLIC');await fill('Order note','Please call before delivery.');await fill('Order change reason','Reviewed the customer delivery instructions.');await confirm('Order management and activity');
  for(let i=0;i<2;i++){await submit('Order management and activity');await page.wait("document.querySelector('[aria-label=\"Order management and activity\"] [role=alert]')?.innerText.includes('input has been kept') && !document.querySelector('[aria-label=\"Order management and activity\"] button[type=submit]').disabled");}
  assert.equal(attempts.length,2);assert.equal(attempts[0].requestId,attempts[1].requestId);assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Order note\"]').value"),'Please call before delivery.');
  await page.send('Fetch.disable');
  checks.push({codConfirmationKeepsPaymentPending:true,failedOrderNoteKeepsInputAndRequest:true});
  await cookie(fixture.ownerCookie);await navigate('/orders/'+fixture.paidOrderId,refundReady);
  stage='requesting paid cancellation';
  await fill('Refund reason','Please cancel this paid order before dispatch.');await confirm('Cancellation and refund');await submit('Cancellation and refund');
  await page.wait("document.querySelector('[aria-label=\"Cancellation and refund\"]')?.innerText.includes('Cancellation requested')");
  await cookie(fixture.adminCookie);await navigate('/admin/orders/'+fixture.paidOrderId,"document.querySelector('[aria-label=\"Refund action\"]')?.value==='APPROVE'");
  stage='approving paid cancellation';
  await fill('Refund reason','Approved cancellation before carrier handover.');await confirm('Cancellation and refund');await submit('Cancellation and refund');
  await page.wait("document.querySelector('[aria-label=\"Refund action\"]')?.value==='MANUAL'");
  stage='recording manual refund';
  await fill('Manual refund reference','QA-BROWSER-RECEIPT-001');
  const localTime=await page.evaluate("(()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);})()");
  await fill('Manual refund time',localTime);await fill('Refund reason','Verified the private QA manual refund receipt.');await confirm('Cancellation and refund');await submit('Cancellation and refund');
  await page.wait("document.querySelector('[aria-label=\"Cancellation and refund\"]')?.innerText.includes('Manual refund receipt recorded')");
  await cookie(fixture.ownerCookie);await navigate('/orders/'+fixture.paidOrderId,"document.querySelector('[aria-label=\"Cancellation and refund\"]')?.innerText.includes('Manual refund receipt recorded')");
  assert.equal(await page.evaluate("document.body.innerText.includes('QA-BROWSER-RECEIPT-001')"),false);
  const paid=await page.evaluate(`fetch('/api/order/${fixture.paidOrderId}').then(r=>r.json())`);assert.equal(paid.status,'paid');assert.equal(paid.orderState,'CANCELLED');
  checks.push({realCustomerCancellation:true,realAdminApproval:true,realManualRefundReceipt:true,paidStatusPreserved:true,privateReceiptHiddenFromCustomer:true});
  await cookie(fixture.adminCookie);
  stage='viewing refund queue';
  await navigate('/admin/refunds',"document.querySelector('[aria-label=\"Paid-order cancellation requests\"] select') && !document.querySelector('[aria-label=\"Paid-order cancellation requests\"]').innerText.includes('Loading cancellation')");
  await fill('Refund queue status','SUCCEEDED');
  await page.wait(`!!document.querySelector('[aria-label="Paid-order cancellation requests"] a[href="/admin/orders/${fixture.paidOrderId}"]')`);
  checks.push({realRefundQueueShowsConfirmedRefund:true});
  } catch(error) {
    console.error('Order browser QA failed at:',stage);
    const capture=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}).catch(()=>null);
    if(capture)fs.writeFileSync(path.join(artifactDirectory,'p1-order-browser-failure.png'),Buffer.from(capture.data,'base64'));
    throw error;
  }
}
module.exports={verifyOrderLifecycleBrowser};
