const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {CDP}=require('../tests/fixtures/browser-cdp.cjs');

async function verifySupportBrowser({page,origin,artifactDirectory,checks,fixture}) {
  const host=new URL(page.socket.url).host;
  const info=await fetch('http://'+host+'/json/version').then(r=>r.json());
  const browser=new CDP(info.webSocketDebuggerUrl);
  let contextId,customer,stage='starting independent customer session';
  const exceptions=[];
  const cookie=async(client,value)=>{const split=value.indexOf('=');await client.send('Network.setCookies',{cookies:[{name:value.slice(0,split),value:value.slice(split+1),url:origin,httpOnly:true,sameSite:'Lax'}]});};
  const navigate=async(client,route,marker)=>{await client.send('Page.bringToFront');await client.send('Page.navigate',{url:origin+route});await client.wait(`location.pathname===${JSON.stringify(route.split('?')[0])} && ${marker}`);};
  const fill=(client,value)=>client.evaluate(`(()=>{const el=document.querySelector('[aria-label="Support message"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const click=async(client,label)=>{
    await client.wait(`Array.from(document.querySelectorAll('button')).some(el=>el.innerText===${JSON.stringify(label)} && !el.disabled)`);
    return client.evaluate(`Array.from(document.querySelectorAll('button')).find(el=>el.innerText===${JSON.stringify(label)}).click()`);
  };
  const ready="!!document.querySelector('[aria-label=\"Support message\"]') && !document.body.innerText.includes('Loading messages')";
  try {
    contextId=(await browser.send('Target.createBrowserContext',{disposeOnDetach:true})).browserContextId;
    const target=(await browser.send('Target.createTarget',{url:'about:blank',browserContextId:contextId,newWindow:true})).targetId;
    customer=new CDP('ws://'+host+'/devtools/page/'+target);
    for(const method of ['Page.enable','Runtime.enable','Network.enable','DOM.enable'])await customer.send(method);
    customer.listeners.set('Runtime.exceptionThrown',event=>exceptions.push(event.exceptionDetails.text));
    await cookie(customer,fixture.ownerCookie);await cookie(page,fixture.adminCookie);
    await page.send('Fetch.disable');
    for(const width of [320,1440]) {
      stage='customer support layout '+width;
      await customer.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await navigate(customer,'/support?productId='+fixture.productId+'&variantId='+fixture.variantId,ready);
      assert.equal(await customer.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
      let capture=await customer.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(artifactDirectory,`p1-support-customer-${width}.png`),Buffer.from(capture.data,'base64'));
      stage='admin inbox layout '+width;
      await page.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await navigate(page,'/admin/support',`!!document.querySelector('a[href="/admin/support/${fixture.conversationId}"]')`);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
      capture=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(artifactDirectory,`p1-support-inbox-${width}.png`),Buffer.from(capture.data,'base64'));
      stage='admin conversation layout '+width;
      await navigate(page,'/admin/support/'+fixture.conversationId,ready);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
      capture=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(artifactDirectory,`p1-support-admin-${width}.png`),Buffer.from(capture.data,'base64'));
      checks.push({width,customerSupportFits:true,supportInboxFits:true,adminConversationFits:true,independentCustomerAndAdminSessions:true});
    }
    stage='reading older messages and the private image';
    await customer.send('Page.bringToFront');await click(customer,'Older messages');
    await customer.wait("document.querySelector('[aria-label=\"Saved support messages\"]')?.innerText.includes('<img src=x onerror=window.__supportXss=1>')");
    assert.equal(await customer.evaluate("!!document.querySelector('img[src=\"x\"]') || !!window.__supportXss"),false);
    await customer.wait("Array.from(document.querySelectorAll('img[alt=\"Support attachment\"]')).some(image=>image.complete&&image.naturalWidth>0)");
    assert.equal(await customer.evaluate(`!!document.querySelector('a[href="/product/${fixture.productId}?variant=${fixture.variantId}"]')`),true);
    await click(customer,'Latest messages');await customer.wait("document.body.innerText.includes('Earlier QA question 23')");
    checks.push({olderMessagesPersist:true,privateImageLoadsWithOwnerSession:true,htmlMessageRenderedAsText:true,serverProductContextLink:true});
    stage='accepting the conversation';
    await page.send('Page.bringToFront');await click(page,'Accept conversation');
    await page.wait("Array.from(document.querySelectorAll('button')).some(button=>button.innerText==='Close conversation') && !document.querySelector('[aria-label=\"Support message\"]').disabled");
    stage='retaining a failed customer message';
    const attempts=[];
    customer.listeners.set('Fetch.requestPaused',({requestId,request})=>{
      const body=request.postData?JSON.parse(request.postData):null;
      if(request.method==='POST'&&body?.action==='SEND'){
        attempts.push(body);void customer.send('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:'QA support outage. Your message has been kept.'})).toString('base64')});
      }else void customer.send('Fetch.continueRequest',{requestId});
    });
    await customer.send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/support'}]});
    await customer.send('Page.bringToFront');await fill(customer,'Browser customer asks about this product.');
    for(let i=0;i<2;i++){await click(customer,'Send message');await customer.wait("document.querySelector('[role=alert]')?.innerText.includes('message has been kept') && Array.from(document.querySelectorAll('button')).find(b=>b.innerText==='Send message')?.disabled===false");}
    assert.equal(attempts.length,2);assert.equal(attempts[0].requestId,attempts[1].requestId);assert.equal(attempts[0].context.variantId,fixture.variantId);assert.equal(await customer.evaluate("document.querySelector('[aria-label=\"Support message\"]').value"),'Browser customer asks about this product.');
    await customer.send('Fetch.disable');
    stage='sending customer message with image';
    const imageFile=path.join(artifactDirectory,'support-qa-upload.png');fs.writeFileSync(imageFile,require('../tests/fixtures/support-image.cjs'));
    const doc=await customer.send('DOM.getDocument');const input=await customer.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[aria-label="Support image"]'});await customer.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[imageFile]});
    await customer.wait("document.body.innerText.includes('support-qa-upload.png') && Array.from(document.querySelectorAll('button')).some(button=>button.innerText==='Remove image')");
    await click(customer,'Send message');
    await customer.wait("document.querySelector('[aria-label=\"Saved support messages\"]')?.innerText.includes('Browser customer asks about this product.') && document.querySelector('[aria-label=\"Support message\"]').value===''");
    await page.send('Page.bringToFront');await click(page,'Refresh messages');
    await page.wait("document.querySelector('[aria-label=\"Saved support messages\"]')?.innerText.includes('Browser customer asks about this product.')");
    stage='sending the administrator reply';
    await page.wait("Array.from(document.querySelectorAll('img[alt=\"Support attachment\"]')).some(image=>image.complete&&image.naturalWidth>0)");
    await fill(page,'Browser support admin replies to the saved question.');await click(page,'Send message');
    await page.wait("document.querySelector('[aria-label=\"Saved support messages\"]')?.innerText.includes('Browser support admin replies to the saved question.')");
    stage='customer receives the actual admin reply and keeps history after reload';
    await customer.send('Page.bringToFront');await click(customer,'Refresh messages');
    await customer.wait("document.querySelector('[aria-label=\"Saved support messages\"]')?.innerText.includes('Browser support admin replies to the saved question.')");
    await customer.send('Page.reload');await customer.wait(ready+" && document.querySelector('[aria-label=\"Saved support messages\"]').innerText.includes('Browser support admin replies to the saved question.')");
    checks.push({failedSendKeepsDraftAndRequest:true,realImageUploadFromBrowser:true,customerMessageReachesAdmin:true,adminReplyReachesCustomer:true,historySurvivesReload:true});
    stage='closing and reopening the saved conversation';
    await page.send('Page.bringToFront');await click(page,'Close conversation');await page.wait("document.body.innerText.includes('Conversation closed.')");
    await customer.send('Page.bringToFront');await click(customer,'Refresh messages');await customer.wait("document.body.innerText.includes('Conversation closed.')");
    await click(customer,'Reopen conversation');await customer.wait(ready);
    assert.equal(await customer.evaluate("document.querySelector('[aria-label=\"Saved support messages\"]').innerText.includes('Browser support admin replies to the saved question.')"),true);
    assert.deepEqual(exceptions,[]);checks.push({adminCloseAndCustomerReopen:true,historyRetainedAfterReopen:true});
  }catch(error){
    console.error('Support browser QA failed at:',stage);
    for(const [client,name,endpoint]of [[customer,'customer','/api/support'],[page,'admin','/api/admin/support/'+fixture.conversationId]])if(client){
      const capture=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}).catch(()=>null);if(capture)fs.writeFileSync(path.join(artifactDirectory,`p1-support-browser-failure-${name}.png`),Buffer.from(capture.data,'base64'));
      const diagnostic=await client.evaluate(`fetch(${JSON.stringify(endpoint)}).then(async r=>{const v=await r.json();return {surface:${JSON.stringify(name)},path:location.pathname,status:r.status,conversationId:v.conversation?.id,lastSequence:v.conversation?.lastSequence,latestSequences:v.messages?.slice(-3).map(m=>m.sequence),savedExpected:v.messages?.some(m=>m.text==='Browser customer asks about this product.'),visibleExpected:document.querySelector('[aria-label="Saved support messages"]')?.textContent.includes('Browser customer asks about this product.'),alert:document.querySelector('[role="alert"]')?.textContent};})`).catch(()=>null);
      console.error('Support QA diagnostic:',JSON.stringify(diagnostic));
    }
    throw error;
  }finally{
    customer?.close();if(contextId)await browser.send('Target.disposeBrowserContext',{browserContextId:contextId}).catch(()=>{});browser.close();
  }
}
module.exports={verifySupportBrowser};
