const sourceLoader=require('./load-source.cjs');
const {installNotificationDatabase,matches}=require('./notification-db.cjs');
const {installStockDatabase}=require('./stock-db.cjs');
function fixture(){
 const owner={id:'a'.repeat(24),role:'USER',status:'ACTIVE',email:'buyer@example.invalid',emailVerified:new Date()},admin={id:'b'.repeat(24),role:'ADMIN',status:'ACTIVE',email:'admin@example.invalid',emailVerified:new Date()},admin2={...admin,id:'c'.repeat(24)},other={...owner,id:'d'.repeat(24),email:'other@example.invalid'};
 const users=new Map([owner,admin,admin2,other].map(user=>[user.id,user])),orders=new Map(),state={enabled:true,configured:true,mode:'accept',sends:[],user:admin,beforeRecipientRead:null};
 const db={user:{findUnique:async({where})=>{state.beforeRecipientRead?.();return structuredClone(users.get(where.id)||null);},findMany:async({where})=>structuredClone([...users.values()].filter(user=>matches(user,where)))},
  order:{findUnique:async({where})=>structuredClone(orders.get(where.id)||null),updateMany:async({where,data})=>{let count=0;for(const order of orders.values())if(matches(order,where)){for(const [key,value]of Object.entries(data))order[key]=structuredClone(value&&typeof value==='object'&&'set'in value?value.set:value);count++;}return{count};}},
  operationalJob:{findUnique:async()=>null},
 };
 const rows=installNotificationDatabase(db);installStockDatabase(db,[],[orders,...rows.maps]);
 const sender=async delivery=>{state.sends.push(structuredClone(delivery));if(state.mode==='temporary')throw Object.assign(Error('private SMTP response'),{responseCode:451,command:'DATA'});if(state.mode==='permanent')throw Object.assign(Error('private SMTP response'),{responseCode:550,command:'RCPT TO'});if(state.mode==='lost')throw Object.assign(Error('private SMTP response'),{code:'ECONNECTION',command:'CONN'});return {accepted:state.mode==='empty'?[]:[delivery.toEmail],rejected:[]};};
 const load=sourceLoader({'@/libs/prismadb':{__esModule:true,default:db},'@/libs/notificationStorage':{ensureNotificationStorage:async()=>{}},'@/libs/eventEmailTransport':{eventEmailSettings:()=>({enabled:state.enabled,configured:state.configured}),sendNotificationEmail:sender},'@/libs/authRateLimit':{checkAuthRateLimit:async()=>{}},'@/actions/getCurrentUser':{getCurrentUser:async()=>state.user},'next/server':{NextResponse:{json:Response.json}}});
 const service=load('libs/emailDeliveries.ts'),events=load('libs/orderNotifications.ts');
 const order={id:'1'.repeat(24),userId:owner.id,amount:115000,currency:'vnd',paymentMethod:'MOMO',paymentIntentId:'MOMO_original',status:'pending',stockReservation:null,refundInfo:null,deliveryStatus:'pending',management:{state:'PLACED',version:1,updatedAt:new Date()},...{}};orders.set(order.id,structuredClone(order));
 const publish=(kind='ORDER_CREATED',key='once',options={})=>db.$transaction(tx=>events.notifyOrderEvent(tx,orders.get(order.id),kind,key,options));
 return{owner,admin,admin2,other,users,orders,order,db,rows,state,load,service,events,publish};
}
module.exports={fixture};
