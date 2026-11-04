import {prisma} from '@/lib/prisma';
import {runKkmCloseBackgroundCycle} from '@/lib/kkm-close-background-cycle';

async function main(){
 if(process.argv.includes('--inspect')){
  // Safe readback: verifies the installed runner and scoped working-day population without writes or source calls.
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date());
  const retailDays=await prisma.workDayEntry.count({where:{date,department:'retail',user:{role:'EMPLOYEE',isActive:true,portalArea:'WORKDAY'}}});
  console.log(JSON.stringify({ok:true,applied:false,runner:'kkm-close-background-v1',date,retailDays}));return;
 }
 const result=await runKkmCloseBackgroundCycle();
 console.log(JSON.stringify({ok:!('error' in result.kkmClosePrefetch)&&!('error' in result.kkmShiftClose),runner:'kkm-close-background-v1',...result}));
}
main().catch(()=>{console.error('KKM_CLOSE_BACKGROUND_FAILED');process.exitCode=1;}).finally(()=>prisma.$disconnect());
