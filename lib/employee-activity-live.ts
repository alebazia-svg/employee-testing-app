/** Pure cadence policy: bounded polling, no overlap, no refresh while hidden. */
export function activityRefreshDelay(failures:number){return failures===0?5000:Math.min(30000,5000*2**Math.min(3,failures));}
export function activityMayRefresh(input:{visible:boolean;currentDay:boolean;inFlight:boolean;now:number;lastAttempt:number;failures:number;force?:boolean}){
 return input.visible&&!input.inFlight&&(input.force||input.currentDay&&input.now-input.lastAttempt>=activityRefreshDelay(input.failures));
}
/** Fixed user-facing wording: never expose a browser exception or an API's raw error. */
export function activityReadFailure(status:number|null,timeout=false){
 if(timeout)return 'Портал не ответил вовремя. Повторим обновление автоматически.';
 if(status===401)return 'Для обновления истории нужен повторный вход.';
 if(status===403)return 'Обновление истории недоступно для этого входа.';
 if(status===404)return 'История сотрудника сейчас недоступна.';
 return status===null?'Не удалось связаться с журналом. Повторим обновление автоматически.':'Не удалось получить историю от портала. Повторим обновление автоматически.';
}
