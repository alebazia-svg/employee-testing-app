// Only local, same-day issue links are handled without a page navigation.
export function workdayIssueTarget(href:string, currentHref:string, date:string): number|null {
  try {
    const current = new URL(currentHref), target = new URL(href,current);
    if(target.origin!==current.origin || target.pathname!=='/admin/workday' || (target.searchParams.get('date')??date)!==date)return null;
    const id=target.searchParams.get('issue')??'';
    return /^\d+$/.test(id)&&Number.isSafeInteger(Number(id))&&Number(id)>0 ? Number(id) : null;
  } catch { return null; }
}
export function workdayIssueLocation(currentHref:string, id:number|null) {
  const url=new URL(currentHref);
  url.searchParams.delete('employee');url.searchParams.delete('focus');url.searchParams.delete('issue');
  if(id!==null)url.searchParams.set('issue',String(id));
  return url.pathname+url.search+url.hash;
}
