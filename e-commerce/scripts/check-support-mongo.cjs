const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const sourceLoader=require('../tests/fixtures/load-source.cjs');
require('@next/env').loadEnvConfig(path.resolve(__dirname,'..'));
async function main(){
 const database='sgtech_chat_qa_'+Date.now()+'_'+randomUUID().slice(0,6);
 const connection=new URL(process.env.DATABASE_URL),original=connection.pathname;connection.pathname='/'+database;assert.notEqual(connection.pathname,original);assert.match(database,/^sgtech_chat_qa_\d+_[a-f0-9]+$/);
 const db=new PrismaClient({datasources:{db:{url:connection.toString()}}}),second=new PrismaClient({datasources:{db:{url:connection.toString()}}});
 const load=sourceLoader({'@/libs/prismadb':{__esModule:true,default:db}}),service=load('libs/support.ts'),parse=load('utils/support.ts').parseSupportMessage;
 const checks=[];
 try{
  const users=await Promise.all(['USER','ADMIN','ADMIN','USER'].map((role,i)=>db.user.create({data:{name:'Chat QA '+i,email:'chat-'+i+'@example.invalid',role}})));
  const [owner,admin,admin2,other]=users;
  const message=(text,extra={})=>parse({text,requestId:randomUUID(),...extra});
  const send=(actor=owner,text='Hello from Mongo QA',extra={})=>service.sendSupportMessage(owner.id,actor,message(text,extra));
  // No pre-created support collections: first use must work on an existing app database without a data backfill.
  const first=message('First saved message');const duplicate=await Promise.all(Array.from({length:6},()=>service.sendSupportMessage(owner.id,owner,first)));
  assert.equal(new Set(duplicate.map(r=>r.id)).size,1);assert.equal(await db.supportMessage.count(),1);assert.equal((await db.supportConversation.findUnique({where:{id:owner.id}})).adminUnread,1);
  checks.push('first-use collection creation and six simultaneous message retries persist one message and one unread increment');
  await Promise.all([send(owner,'Concurrent first question'),send(owner,'Concurrent second question')]);
  const rows=await db.supportMessage.findMany({where:{conversationId:owner.id},orderBy:{sequence:'asc'}});assert.deepEqual(rows.map(m=>m.sequence),[1,2,3]);
  checks.push('distinct concurrent sends preserve unique ordered sequences without losing a message');
  const current=await db.supportConversation.findUnique({where:{id:owner.id}});
  const claims=await Promise.allSettled([admin,admin2].map(actor=>service.changeSupportConversation(owner.id,actor,'CLAIM',current.version,randomUUID())));assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
  const claimed=await db.supportConversation.findUnique({where:{id:owner.id}}),handler=users.find(u=>u.id===claimed.assignedTo),unassigned=handler.id===admin.id?admin2:admin;
  await assert.rejects(send(unassigned,'Unassigned reply'),e=>e.status===409);
  await Promise.all([service.readSupportMessages(owner.id,handler,3),send(owner,'Question arriving while support reads')]);
  assert.equal((await db.supportConversation.findUnique({where:{id:owner.id}})).adminUnread,1);
  checks.push('two-admin assignment has one winner; unassigned replies fail; read/send race leaves the new message unread');
  await send(handler,'Saved admin reply');const view=await service.getSupportThread(owner.id,owner);assert.equal(view.conversation.unread,1);assert.doesNotMatch(JSON.stringify(view),/authorId|fingerprint|@example|assignedTo/);
  await assert.rejects(service.getSupportThread(owner.id,other),e=>e.status===404);
  await service.readSupportMessages(owner.id,owner,view.messages.at(-1).sequence);assert.equal((await db.supportConversation.findUnique({where:{id:owner.id}})).customerUnread,0);
  checks.push('private customer projection and durable read state across fresh database reads');
  const png=require('../tests/fixtures/support-image.cjs');
  const attachment=await service.uploadSupportImage(owner.id,owner,png,randomUUID());await send(owner,'Private image',{attachmentId:attachment.id});
  const stored=await db.supportAttachment.findUnique({where:{id:attachment.id}});assert.deepEqual(Buffer.from(stored.bytes),png);assert.ok(stored.messageId);
  await assert.rejects(send(owner,'Cannot attach a sent image twice',{attachmentId:attachment.id}),e=>e.status===409);
  checks.push('MongoDB binary image round trip and single-message attachment binding');
  let latest=await db.supportConversation.findUnique({where:{id:owner.id}});await service.changeSupportConversation(owner.id,handler,'CLOSE',latest.version,randomUUID());
  await assert.rejects(send(owner,'Closed conversation draft'),e=>e.code==='SUPPORT_CLOSED');latest=await db.supportConversation.findUnique({where:{id:owner.id}});await service.changeSupportConversation(owner.id,owner,'REOPEN',latest.version,randomUUID());
  assert.equal((await service.getSupportThread(owner.id,owner)).messages.length,6);
  checks.push('closed conversation rejects sends, customer can reopen and all history remains');
  const oldOrphan=await service.uploadSupportImage(owner.id,owner,png,randomUUID()),recentOrphan=await service.uploadSupportImage(owner.id,owner,png,randomUUID());
  const oldLinked=await service.uploadSupportImage(owner.id,owner,png,randomUUID()),boundDuringScan=await service.uploadSupportImage(owner.id,owner,png,randomUUID());
  await send(owner,'Old linked image must remain',{attachmentId:oldLinked.id});
  await db.supportAttachment.updateMany({where:{id:{in:[oldOrphan.id,oldLinked.id,boundDuringScan.id]}},data:{createdAt:new Date(Date.now()-2*86400000)}});
  const cleanup=sourceLoader({'@/libs/prismadb':{__esModule:true,default:{supportAttachment:{
    findMany:async input=>{const found=await db.supportAttachment.findMany(input);await send(owner,'Image sent after cleanup scanned it',{attachmentId:boundDuringScan.id});return found;},
    deleteMany:input=>db.supportAttachment.deleteMany(input),
  }}}})('libs/supportCleanup.ts');
  assert.equal(await cleanup.cleanupOrphanSupportImages(),1);assert.equal(await db.supportAttachment.findUnique({where:{id:oldOrphan.id}}),null);
  for(const id of [recentOrphan.id,oldLinked.id,boundDuringScan.id])assert.ok(await db.supportAttachment.findUnique({where:{id}}));
  checks.push('real orphan cleanup removes only expired unbound images and preserves recent, linked and concurrently bound files');
  const otherService=sourceLoader({'@/libs/prismadb':{__esModule:true,default:second}})('libs/support.ts');
  for(let i=0;i<20;i++)await service.sendSupportMessage(other.id,other,message('Rate-limited QA message '+i));
  await assert.rejects(otherService.sendSupportMessage(other.id,other,message('Twenty-first message')),e=>e.name==='AuthRateLimitError');
  assert.equal(await db.supportMessage.count({where:{conversationId:other.id}}),20);
  checks.push('message quota is shared across independent Prisma instances and rejected sends do not create messages');
  fs.writeFileSync(path.resolve(__dirname,'../.artifacts/support-mongo-results.json'),JSON.stringify({checks,databaseIsolated:true,applicationDatabaseWrites:0,externalMessages:0},null,2));console.log('Support MongoDB passed: '+checks.length+' groups.');
 }finally{
  assert.equal(connection.pathname,'/'+database);assert.match(database,/^sgtech_chat_qa_\d+_[a-f0-9]+$/);await db.$runCommandRaw({dropDatabase:1});await Promise.all([db.$disconnect(),second.$disconnect()]);
 }
}
main().catch(error=>{console.error('Support MongoDB failed:',error.code||error.name);if(error.name==='AssertionError')console.error(error.stack);if(error.meta?.error)console.error(String(error.meta.error).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[REDACTED]'));if(error.meta?.code)console.error('Database command code:',error.meta.code);process.exitCode=1;});
