'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function TestPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [res, setRes] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/tests/${id}`).then((r) => r.json()).then(setTest);
  }, [id]);

  if (!test) return <div className='p-6 text-slate-600'>Загрузка...</div>;

  async function submit() {
    const r = await fetch(`/api/tests/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
    setRes(await r.json());
  }

  return (
    <main className='mx-auto max-w-3xl space-y-4 p-4 md:p-6'>
      <Card><h1 className='text-xl font-bold text-slate-800'>{test.title}</h1></Card>
      {test.questions.map((q: any, qi: number) => (
        <Card key={q.id}>
          <p className='mb-3 font-medium text-slate-800'>{qi + 1}. {q.text}</p>
          <div className='space-y-2'>
            {q.options.map((o: string, oi: number) => (
              <button
                key={oi}
                onClick={() => setAnswers((p) => { const n = [...p]; n[qi] = oi; return n; })}
                className={`block w-full rounded-lg border p-3 text-left text-sm transition ${answers[qi] === oi ? 'border-green-500 bg-green-50' : 'border-border bg-white hover:border-green-400/60'}`}
              >
                {String.fromCharCode(65 + oi)}. {o}
              </button>
            ))}
          </div>
        </Card>
      ))}
      <Button onClick={submit}>Завершить тест</Button>
      {res && (
        <Card className='space-y-2'>
          <Badge className={res.result.status === 'Сдал' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>{res.result.status}</Badge>
          <p className='text-slate-700'>Процент: {res.result.percent}%</p>
          <Progress value={res.result.percent} />
          <p className='text-slate-700'>Ошибок: {res.result.mistakes}</p>
          {res.showCorrectAnswers && res.mistakes.map((m: any, i: number) => <p key={i} className='text-sm text-slate-600'>{m.question} — Верно: <b>{m.correct}</b></p>)}
        </Card>
      )}
    </main>
  );
}
