import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import Review from './review';

export default async function Page(){
  const host=(await headers()).get('host')||'';
  if(process.env.NODE_ENV!=='development'||! /^(localhost|127\.0\.0\.1):3167$/.test(host))notFound();
  return <Review/>;
}
