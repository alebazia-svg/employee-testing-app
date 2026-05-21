export function Progress({ value }: { value: number }) {
  return (
    <div className='h-2.5 w-full rounded-full bg-slate-200'>
      <div className='h-2.5 rounded-full bg-primary transition-all' style={{ width: `${value}%` }} />
    </div>
  );
}
