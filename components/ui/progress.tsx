export function Progress({ value }: { value: number }) { return <div className='h-2 w-full rounded bg-gray-200'><div className='h-2 rounded bg-primary' style={{ width: `${value}%` }} /></div>; }
