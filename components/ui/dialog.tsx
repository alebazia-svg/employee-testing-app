'use client';
export function Dialog({open,children}:{open:boolean;children:React.ReactNode}){if(!open) return null; return <div className='fixed inset-0 bg-black/30 p-4'><div className='mx-auto mt-20 max-w-md rounded bg-white p-4'>{children}</div></div>}
