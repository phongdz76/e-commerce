const sourceLoader=require('./load-source.cjs');
const {installNotificationDatabase,matches}=require('./notification-db.cjs');
const {installStockDatabase}=require('./stock-db.cjs');
const {randomUUID}=require('node:crypto');
function fixture(extraMaps=[]){
 const db={},notifications=installNotificationDatabase(db),delegate=notifications.delegate;
 const owner={id:'a'.repeat(24),role:'USER',name:'Customer',status:'ACTIVE'},other={id:'b'.repeat(24),role:'USER',name:'Other'},admin={id:'c'.repeat(24),role:'ADMIN',name:'Admin',status:'ACTIVE'},admin2={id:'d'.repeat(24),role:'ADMIN',name:'Admin 2',status:'ACTIVE'};
 const users=new Map([owner,other,admin,admin2].map(u=>[u.id,u])),conversations=new Map(),messages=new Map(),tickets=new Map(),notes=new Map(),settings=new Map(),attachments=new Map(),orders=new Map([['e'.repeat(24),{id:'e'.repeat(24),userId:owner.id}]]);
 db.user=delegate(users);db.order=delegate(orders);db.supportTicket=delegate(tickets,{state:'OPEN',version:1,updatedAt:new Date()});db.supportTicketNote=delegate(notes);db.supportSettings=delegate(settings,{version:0});
 db.supportConversation=delegate(conversations,{status:'OPEN',version:1,assignedTo:null,sequence:0,customerReadSequence:0,adminReadSequence:0,customerUnread:0,adminUnread:0,lastMessageAt:new Date(),updatedAt:new Date()});db.supportMessage=delegate(messages);db.supportAttachment=delegate(attachments);
 db.supportAttachment.update=async({where,data})=>{const row=attachments.get(where.id);if(!row)throw Error('missing');Object.assign(row,data);return structuredClone(row);};
 const serviceSettings=new Map(),serviceRevisions=new Map();db.customerServiceSettings=delegate(serviceSettings,{version:0});db.customerServiceRevision=delegate(serviceRevisions,{publishedAt:new Date()});
 const stock=installStockDatabase(db,[],[users,orders,conversations,messages,tickets,notes,settings,attachments,serviceSettings,serviceRevisions,...notifications.maps,...extraMaps]);
 const state={user:owner,limited:false};class RateError extends Error{constructor(){super('Too many requests');this.retryAfter=30;}}
 const load=sourceLoader({'@/libs/prismadb':{__esModule:true,default:db},'@/libs/supportStorage':{ensureSupportStorage:async()=>{}},'@/libs/supportTicketStorage':{ensureSupportTicketStorage:async()=>{}},'@/libs/notificationStorage':{ensureNotificationStorage:async()=>{}},'@/libs/authRateLimit':{AuthRateLimitError:RateError,checkAuthRateLimit:async()=>{if(state.limited)throw new RateError();}},'@/actions/getCurrentUser':{getCurrentUser:async()=>state.user},'@/libs/storefrontProductNames':{getStorefrontProduct:async id=>id==='f'.repeat(24)?{id,name:'Verified product',variants:[{id:'1'.repeat(24),name:'Black SKU'}]}:null},'next/server':{NextResponse:{json:Response.json}}});
 const service=load('libs/supportTickets.ts'),chat=load('libs/support.ts'),hours=load('libs/supportSettings.ts'),parse=load('utils/supportTickets.ts').parseTicketCreate;
 const input=(extra={})=>parse({requestId:randomUUID(),category:'GENERAL',subject:'Help with my product',description:'Please check the selected product for me.',...extra});
 const create=async(extra={})=>service.createSupportTicket(owner,input(extra));
 const claim=async(actor=admin)=>{const row=conversations.get(owner.id);return chat.changeSupportConversation(owner.id,actor,'CLAIM',row.version,randomUUID());};
 const change=(id,action,actor=admin,extra={})=>service.changeSupportTicket(id,actor,{action,version:tickets.get(id).version,requestId:randomUUID(),...extra});
 return{db,notifications,stock,state,owner,other,admin,admin2,users,orders,conversations,messages,tickets,notes,settings,attachments,serviceSettings,serviceRevisions,load,service,chat,hours,input,create,claim,change,matches};
}
module.exports={fixture};
