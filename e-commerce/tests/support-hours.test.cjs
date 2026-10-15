const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {fixture}=require('./fixtures/support-tickets.cjs');
test('support schedule validates exactly seven unique days, same-day intervals and a bounded plain-text message',()=>{
 const f=fixture(),{parseSupportSchedule,blankSupportSchedule}=f.load('utils/supportHours.ts'),schedule=blankSupportSchedule();assert.ok(parseSupportSchedule(schedule));
 for(const patch of [{timeZone:'UTC'},{week:schedule.week.slice(1)},{week:[...schedule.week.slice(1),schedule.week[1]]},{message:''},{message:'x'.repeat(301)},{week:schedule.week.map((r,i)=>i?r:{...r,start:'24:00'})},{week:schedule.week.map((r,i)=>i?r:{...r,start:'18:00',end:'09:00'})}])assert.equal(parseSupportSchedule({...schedule,...patch}),null);
});
test('published hours use Vietnam day boundaries, inclusive start and exclusive end without claiming staff presence',()=>{
 const f=fixture(),{supportHoursStatus,blankSupportSchedule}=f.load('utils/supportHours.ts'),schedule=blankSupportSchedule();schedule.week[1]={day:1,enabled:true,start:'09:00',end:'17:00'};
 assert.equal(supportHoursStatus(null),'UNCONFIGURED');for(const [date,state]of [['2026-10-19T01:59:59Z','OUTSIDE_HOURS'],['2026-10-19T02:00:00Z','IN_HOURS'],['2026-10-19T09:59:59Z','IN_HOURS'],['2026-10-19T10:00:00Z','OUTSIDE_HOURS'],['2026-10-18T17:00:00Z','OUTSIDE_HOURS']])assert.equal(supportHoursStatus(schedule,new Date(date)),state);
});
test('saving a draft never publishes it; publication uses the saved version and retains idempotent audit history',async()=>{
 const f=fixture(),schedule=f.load('utils/supportHours.ts').blankSupportSchedule();schedule.week[1].enabled=true;
 assert.equal((await f.hours.getPublicSupportHours()).schedule,null);const input={action:'SAVE',version:0,requestId:randomUUID(),schedule};await f.hours.updateSupportHours(f.admin.id,input);await f.hours.updateSupportHours(f.admin.id,input);
 assert.equal((await f.hours.getPublicSupportHours()).schedule,null);assert.equal((await f.hours.getAdminSupportHours()).version,1);
 const publish={action:'PUBLISH',version:1,requestId:randomUUID(),schedule:null};await f.hours.updateSupportHours(f.admin.id,publish);await f.hours.updateSupportHours(f.admin.id,publish);assert.equal((await f.hours.getPublicSupportHours()).schedule.week[1].enabled,true);
 schedule.message='Unpublished changed message';await f.hours.updateSupportHours(f.admin.id,{action:'SAVE',version:2,requestId:randomUUID(),schedule});assert.notEqual((await f.hours.getPublicSupportHours()).schedule.message,schedule.message);
 await assert.rejects(f.hours.updateSupportHours(f.admin2.id,{...publish,requestId:randomUUID()}),e=>e.status===409);assert.equal((await f.hours.getAdminSupportHours()).version,3);
});
test('public hours expose only published data; saving/publishing requires administrator access and strict input',async()=>{
 const f=fixture(),publicRoute=f.load('app/api/support/hours/route.ts'),adminRoute=f.load('app/api/admin/support-hours/route.ts');f.state.user=null;assert.equal((await publicRoute.GET()).status,200);assert.equal((await adminRoute.GET()).status,401);f.state.user=f.owner;assert.equal((await adminRoute.GET()).status,403);f.state.user=f.admin;
 assert.equal((await adminRoute.POST(new Request('http://localhost',{method:'POST',body:JSON.stringify({action:'PUBLISH',version:0,requestId:randomUUID()})}))).status,400);
 assert.doesNotMatch(await (await publicRoute.GET()).text(),/draft|fingerprint|actorId|version/);
});
