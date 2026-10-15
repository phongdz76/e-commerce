const {loadEnvConfig}=require('@next/env');
const {workerConfiguration,workerAuthorization}=require('./payment-worker.cjs');
async function runEmailWorker(config,{fetchImpl=fetch,log=console,authorization=workerAuthorization}={}){
 const response=await fetchImpl(new URL('/api/jobs/notification-emails',config.base),{headers:{authorization:await authorization(config)},redirect:'error',signal:AbortSignal.timeout(290000)});
 if(!response.ok)throw new Error('Email job failed');
 if(response.status===202){log.info('[Emails] Another worker owns this cycle.');return;}
 const result=await response.json();
 if(!Number.isSafeInteger(result.processed)||result.processed<0||result.processed>5)throw new Error('Invalid email job result');
 log.info('[Emails] processed='+result.processed+' disabled='+(result.disabled===1?1:0));
}
module.exports={runEmailWorker};
if(require.main===module){
 loadEnvConfig(process.cwd());
 Promise.resolve().then(()=>runEmailWorker(workerConfiguration())).catch(()=>{console.error('[Emails] Processing failed. Check the email delivery queue and job configuration.');process.exitCode=1;});
}
