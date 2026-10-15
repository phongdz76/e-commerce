function matches(row,where={}){return Object.entries(where).every(([key,value])=>{
 if(key==='AND')return value.every(v=>matches(row,v));if(key==='OR')return value.some(v=>matches(row,v));
 if(value===null)return row[key]==null;
 if(value instanceof Date)return row[key] instanceof Date && +row[key]===+value;
 if(value&&typeof value==='object'&&!(value instanceof Date))return Object.entries(value).every(([op,v])=>op==='in'?v.includes(row[key]):op==='notIn'?!v.includes(row[key]):op==='not'?row[key]!==v:op==='gt'?row[key]>v:op==='gte'?row[key]>=v:op==='lt'?row[key]<v:op==='lte'?row[key]!=null&&row[key]<=v:op==='isSet'?(row[key]!==undefined)===v:false);
 return row[key]===value;
});}
function installNotificationDatabase(db){const events=new Map(),inboxes=new Map(),notifications=new Map(),deliveries=new Map();
 function delegate(rows,defaults={}){return{
  findUnique:async({where})=>structuredClone([...rows.values()].find(row=>matches(row,where))||null),
  findFirst:async({where})=>structuredClone([...rows.values()].find(row=>matches(row,where))||null),
  findMany:async({where={},orderBy,take=100,skip=0})=>{let out=[...rows.values()].filter(row=>matches(row,where));if(orderBy)out.sort((a,b)=>{for(const field of Array.isArray(orderBy)?orderBy:[orderBy])for(const [key,direction]of Object.entries(field)){const result=a[key]>b[key]?1:a[key]<b[key]?-1:0;if(result)return direction==='desc'?-result:result;}return 0;});return structuredClone(out.slice(skip,skip+take));},
  count:async({where={}}={})=>[...rows.values()].filter(row=>matches(row,where)).length,
  create:async({data})=>{if(rows.has(data.id))throw Object.assign(Error('duplicate'),{code:'P2002'});const row={createdAt:new Date(),...defaults,...structuredClone(data)};rows.set(row.id,row);return structuredClone(row);},
  updateMany:async({where,data})=>{let count=0;for(const row of rows.values())if(matches(row,where)){for(const [key,value]of Object.entries(data))row[key]=value&&typeof value==='object'&&'increment'in value?row[key]+value.increment:structuredClone(value);count++;}return{count};},
 };}
 db.notificationEvent=delegate(events);db.notificationInbox=delegate(inboxes,{sequence:0});db.notification=delegate(notifications);
 db.notificationDelivery=delegate(deliveries,{state:'PENDING',version:1,attempts:0,autoAttempts:0,nextAttemptAt:new Date(),updatedAt:new Date()});
 return{events,inboxes,notifications,deliveries,delegate,maps:[events,inboxes,notifications,deliveries]};
}
module.exports={installNotificationDatabase,matches};
