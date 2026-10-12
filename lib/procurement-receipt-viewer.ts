export function receiptPreviewMime(value:string):string|null {
 const type=value.split(';')[0].trim().toLowerCase();
 return ['image/jpeg','image/png','image/webp','application/pdf'].includes(type)?type:null;
}

export function receiptFittedWidth(natural:{width:number;height:number},space:{width:number;height:number},zoom:number):number|undefined {
 if(![natural.width,natural.height,space.width,space.height,zoom].every(v=>Number.isFinite(v)&&v>0))return undefined;
 const scale=Math.min(1,space.width/natural.width,space.height/natural.height);
 return Math.max(1,natural.width*scale*Math.min(3,Math.max(1,zoom)));
}
