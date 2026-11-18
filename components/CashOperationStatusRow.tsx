import { Badge } from '@/components/ui/badge';

export function CashOperationStatusRow({title,detail,status,done=false}:{title:string;detail:string;status:string;done?:boolean}){
 return (
                        <div className='flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 ring-1 ring-slate-200/80'>
                          <div className='min-w-0'>
                            <p className='text-xs font-extrabold text-slate-900'>
                              {title}
                            </p>
                            <p className='mt-0.5 text-xs font-bold text-slate-400'>{detail}</p>
                          </div>
                          <Badge
                            className={'employee-material-status shrink-0 px-2 py-0.5 text-[11px] '+(done?'employee-material-status-green':'employee-material-status-amber')}
                          >
                            {status}
                          </Badge>
                        </div>
 );
}
