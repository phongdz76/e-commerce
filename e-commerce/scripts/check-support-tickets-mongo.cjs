const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const sourceLoader=require('../tests/fixtures/load-source.cjs');
require('@next/env').loadEnvConfig(path.resolve(__dirname,'..'));
async function main(){
 const database='sgtech_ticket_qa_'+Date.now()+'_'+randomUUID().slice(0,6),connection=new URL(process.env.DATABASE_URL),application=connection.pathname;connection.pathname='/'+database;assert.notEqual(connection.pathname,application);assert.match(database,/^sgtech_ticket_qa_\d+_[a-f0-9]+$/);
 const db=new PrismaClient({datasources:{db:{url:connection.toString()}}}),second=new PrismaClient({datasources:{db:{url:connection.toString()}}});
 const loader=client=>sourceLoader({'@/libs/prismadb':{__esModule:true,default:client}}),load=loader(db),otherLoad=loader(second),service=load('libs/supportTickets.ts'),otherService=otherLoad('libs/supportTickets.ts'),chat=load('libs/support.ts'),hours=load('libs/supportSettings.ts'),parse=load('utils/supportTickets.ts').parseTicketCreate,checks=[];
 try{
  const [owner,admin,admin2,other]=await Promise.all(['USER','ADMIN','ADMIN','USER'].map((role,i)=>db.user.create({data:{role,name:'Ticket QA '+i,email:'ticket-'+i+'@example.invalid',status:'ACTIVE'}})));
  await db.$runCommandRaw({create:'AuditLog'});
  assert.equal((await hours.getPublicSupportHours()).status,'UNCONFIGURED');assert.equal((await service.listSupportTickets(owner,'ALL',1)).total,0);
  const order=await db.order.create({data:{userId:owner.id,status:'paid',amount:115000,currency:'vnd',paymentMethod:'COD',paymentIntentId:'COD_QA_'+randomUUID(),products:[]}});
  const image=await chat.uploadSupportImage(owner.id,owner,require('../tests/fixtures/support-image.cjs'),randomUUID());
  const input=parse({requestId:randomUUID(),category:'DELIVERY',subject:'Where is my QA delivery?',description:'Please check this isolated order and attached picture.',context:{kind:'ORDER',id:order.id},attachmentId:image.id});
  const created=await Promise.all(Array.from({length:6},(_,i)=>(i%2?otherService:service).createSupportTicket(owner,input))),id=created[0].id;
  assert.equal(new Set(created.map(r=>r.id)).size,1);assert.equal(await db.supportTicket.count(),1);assert.equal(await db.supportMessage.count(),1);assert.equal((await db.supportConversation.findUnique({where:{id:owner.id}})).adminUnread,1);assert.equal(await db.notificationEvent.count(),1);assert.equal(await db.notification.count(),3);assert.ok((await db.supportAttachment.findUnique({where:{id:image.id}})).messageId);
  checks.push('first-use collections across two clients and six concurrent creates commit one ticket/message/image binding and one notification per audience');
  await assert.rejects(service.getSupportTicket(id,other),e=>e.status===404);await assert.rejects(otherService.createSupportTicket(other,input),e=>e.status===404);assert.equal((await service.listSupportTickets(other,'ALL',1)).total,0);
  const initial=await db.supportConversation.findUnique({where:{id:owner.id}}),claims=await Promise.allSettled([admin,admin2].map(actor=>chat.changeSupportConversation(owner.id,actor,'CLAIM',initial.version,randomUUID())));assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
  let conversation=await db.supportConversation.findUnique({where:{id:owner.id}});const handler=conversation.assignedTo===admin.id?admin:admin2,unassigned=handler.id===admin.id?admin2:admin;
  const action=async(kind,actor=handler,extra={})=>service.changeSupportTicket(id,actor,{action:kind,version:(await db.supportTicket.findUnique({where:{id}})).version,requestId:randomUUID(),...extra});
  await assert.rejects(action('RESOLVED',unassigned),e=>e.code==='TICKET_NOT_ASSIGNED');
  checks.push('actual owner scoping and foreign-order checks; concurrent assignment has one handler and another administrator cannot decide');
  const alerts=await db.notificationEvent.count(),note={action:'NOTE',version:1,requestId:randomUUID(),text:'PRIVATE-QA-TICKET-NOTE'};
  await Promise.all([service.changeSupportTicket(id,handler,note),otherService.changeSupportTicket(id,handler,note)]);assert.equal(await db.supportTicketNote.count(),1);assert.equal(await db.notificationEvent.count(),alerts);
  assert.doesNotMatch(JSON.stringify(await service.getSupportTicket(id,owner)),/PRIVATE-QA|notes|fingerprint|actorId|@example/);assert.match(JSON.stringify(await service.getSupportTicket(id,handler)),/PRIVATE-QA-TICKET-NOTE/);
  await db.supportTicketNote.createMany({data:Array.from({length:21},(_,i)=>({id:'qa-history-'+i,ticketId:id,actorId:handler.id,text:'Private historical note '+i,fingerprint:'qa-history'}))});
  assert.equal((await service.getSupportTicket(id,handler)).notes.length,20);assert.equal((await service.getSupportTicket(id,handler,2)).notes.length,2);
  checks.push('internal notes replay once, stay outside notifications/customer data and paginate twenty at a time');
  conversation=await db.supportConversation.findUnique({where:{id:owner.id}});
  const race=await Promise.allSettled([action('RESOLVED'),chat.changeSupportConversation(owner.id,handler,'CLOSE',conversation.version,randomUUID())]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
  conversation=await db.supportConversation.findUnique({where:{id:owner.id}});if(conversation.status==='CLOSED'){await chat.changeSupportConversation(owner.id,owner,'REOPEN',conversation.version,randomUUID());conversation=await db.supportConversation.findUnique({where:{id:owner.id}});await chat.changeSupportConversation(owner.id,handler,'CLAIM',conversation.version,randomUUID());await action('RESOLVED');}
  await action('CLOSED',owner);conversation=await db.supportConversation.findUnique({where:{id:owner.id}});await chat.changeSupportConversation(owner.id,handler,'CLOSE',conversation.version,randomUUID());await action('REOPEN',owner);assert.equal((await db.supportConversation.findUnique({where:{id:owner.id}})).status,'OPEN');assert.equal(await db.supportMessage.count(),1);
  checks.push('ticket decision versus conversation close has one winner; customer reopen retains messages and clears closed assignment');
  const failedClient=db.$extends({query:{notification:{create:async()=>{throw Error('QA notification write failure');}}}}),failedService=loader(failedClient)('libs/supportTickets.ts'),retryInput=parse({...input,requestId:randomUUID(),attachmentId:null,subject:'Rollback QA request'});
  await assert.rejects(failedService.createSupportTicket(owner,retryInput));assert.equal(await db.supportTicket.count(),1);assert.equal(await db.supportMessage.count(),1);
  await service.createSupportTicket(owner,retryInput);assert.equal(await db.supportTicket.count(),2);assert.equal(await db.supportMessage.count(),2);
  checks.push('a real notification failure rolls back the new ticket, original message and unread change; same request succeeds after recovery');
  const schedule=load('utils/supportHours.ts').blankSupportSchedule();schedule.week[1].enabled=true;const save={action:'SAVE',version:0,requestId:randomUUID(),schedule};await hours.updateSupportHours(admin.id,save);assert.equal((await hours.getPublicSupportHours()).schedule,null);
  const publish={action:'PUBLISH',version:1,requestId:randomUUID(),schedule:null};await Promise.all([hours.updateSupportHours(admin.id,publish),otherLoad('libs/supportSettings.ts').updateSupportHours(admin.id,publish)]);assert.equal((await hours.getAdminSupportHours()).version,2);assert.equal((await hours.getPublicSupportHours()).schedule.week[1].enabled,true);
  await assert.rejects(hours.updateSupportHours(admin2.id,{...save,requestId:randomUUID()}),e=>e.status===409);
  schedule.message='PRIVATE-UNPUBLISHED-DRAFT';await hours.updateSupportHours(admin.id,{...save,version:2,requestId:randomUUID(),schedule});assert.doesNotMatch(JSON.stringify(await hours.getPublicSupportHours()),/PRIVATE-UNPUBLISHED|draft|fingerprint/);
  checks.push('draft/publication are separate in MongoDB; concurrent publication replays once and stale editors cannot overwrite published hours');
  fs.mkdirSync(path.resolve(__dirname,'../.artifacts'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../.artifacts/support-tickets-mongo-results.json'),JSON.stringify({checks,applicationDatabaseWrites:0,externalEmails:0,providerNetworkCalls:0},null,2));console.log('Support tickets MongoDB passed: '+checks.length+' groups.');
 }finally{assert.equal(connection.pathname,'/'+database);assert.notEqual(connection.pathname,application);assert.match(database,/^sgtech_ticket_qa_\d+_[a-f0-9]+$/);await db.$runCommandRaw({dropDatabase:1});await Promise.all([db.$disconnect(),second.$disconnect()]);}
}
main().catch(error=>{console.error('Support tickets MongoDB verification failed.',error instanceof assert.AssertionError?error.stack:{name:error.name,code:error.code});process.exitCode=1;});
