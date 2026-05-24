'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle, Circle, Clock3, XCircle } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type Question = { id: number; text: string; options: string[]; sectionTitle: string; sectionId: number };
type Result = { status: string; percent: number; correctCount: number; totalQuestions: number; mistakes: number };
type SectionStat = { sectionTitle: string; correct: number; total: number; percent: number };
const ATTESTATION_DURATION_SECONDS = 15 * 60;

export default function EmployeeAttestationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [sectionStats, setSectionStats] = useState<SectionStat[]>([]);
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(ATTESTATION_DURATION_SECONDS);
  const finishingRef = useRef(false);

  useEffect(() => {
    async function load() {
      await fetch(`/api/attestations/${id}/start`, { method: 'POST' });
      const response = await fetch(`/api/attestations/${id}/progress`);
      const data = await response.json();

      if (data.completed) {
        setResult(data.result);
        setSectionStats(data.sectionStats ?? []);
        return;
      }

      setQuestions(data.questions);
      setAnswers(data.answers ?? {});
      setCurrentIndex(data.progress.currentIndex ?? 0);

      const timerKey = `attestation:${id}:startedAt`;
      const existingStartedAt = window.localStorage.getItem(timerKey);
      if (!existingStartedAt) {
        window.localStorage.setItem(timerKey, String(Date.now()));
        setTimeLeft(ATTESTATION_DURATION_SECONDS);
      } else {
        const elapsed = Math.floor((Date.now() - Number(existingStartedAt)) / 1000);
        setTimeLeft(Math.max(ATTESTATION_DURATION_SECONDS - elapsed, 0));
      }
    }

    load();
  }, [id]);

  const question = questions[currentIndex];
  const sectionTitles = Array.from(new Set(questions.map((item) => item.sectionTitle)));
  const sectionIndex = question ? sectionTitles.indexOf(question.sectionTitle) + 1 : 0;
  const progressValue = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;
  const selected = question ? answers[String(question.id)] : undefined;
  const allAnswered = useMemo(() => questions.every((item) => typeof answers[String(item.id)] === 'number'), [answers, questions]);
  const timerText = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;

  async function persist(nextAnswers = answers, nextIndex = currentIndex) {
    await fetch(`/api/attestations/${id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ answers: nextAnswers, currentIndex: nextIndex }),
    });
  }

  async function selectAnswer(index: number) {
    if (!question) return;
    const nextAnswers = { ...answers, [question.id]: index };
    setAnswers(nextAnswers);
    await persist(nextAnswers, currentIndex);
  }

  async function move(nextIndex: number) {
    setCurrentIndex(nextIndex);
    await persist(answers, nextIndex);
  }

  async function finish(force = false) {
    if (finishingRef.current) return;

    if (!force && !allAnswered) {
      setMessage('Ответьте на все вопросы перед завершением аттестации.');
      return;
    }

    if (!force && !window.confirm('Вы уверены, что хотите завершить аттестацию? После завершения изменить ответы будет нельзя.')) return;

    finishingRef.current = true;
    const response = await fetch(`/api/attestations/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    const data = await response.json();
    setResult(data.result);
    setSectionStats(data.sectionStats ?? []);
    window.localStorage.removeItem(`attestation:${id}:startedAt`);
  }

  useEffect(() => {
    if (result || !questions.length) return;

    const intervalId = window.setInterval(() => {
      const startedAt = Number(window.localStorage.getItem(`attestation:${id}:startedAt`) ?? Date.now());
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const nextTimeLeft = Math.max(ATTESTATION_DURATION_SECONDS - elapsed, 0);
      setTimeLeft(nextTimeLeft);

      if (nextTimeLeft <= 0) {
        window.clearInterval(intervalId);
        setMessage('Время аттестации истекло. Ответы отправляются автоматически.');
        finish(true);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [id, questions.length, result, answers]);

  if (result) {
    const passed = result.status === 'Сдал';
    return (
      <main className='mx-auto max-w-5xl space-y-6 p-4 md:p-8'>
        <header className='flex flex-col gap-3 rounded-lg border border-border/80 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between'>
          <BrandBlock />
          <LogoutButton />
        </header>

        <Card className={passed ? 'overflow-hidden border-green-100 bg-green-50/70 p-0' : 'overflow-hidden border-red-100 bg-red-50/70 p-0'}>
          <div className='grid gap-6 p-6 md:grid-cols-[1fr_1fr] md:p-8'>
            <div className='flex items-center gap-5'>
              <div className={passed ? 'flex h-24 w-24 items-center justify-center rounded-full border-4 border-green-500 text-green-600' : 'flex h-24 w-24 items-center justify-center rounded-full border-4 border-red-500 text-red-600'}>
                {passed ? <CheckCircle className='h-14 w-14' /> : <XCircle className='h-14 w-14' />}
              </div>
              <div>
                <h1 className={passed ? 'text-3xl font-bold text-green-700' : 'text-3xl font-bold text-red-700'}>{result.status}</h1>
                <p className='mt-2 text-4xl font-bold text-slate-900'>{result.percent}%</p>
              </div>
            </div>
            <div className='grid content-center gap-3 text-sm text-slate-700'>
              <div className='flex justify-between border-b border-slate-200 pb-2'><span>Правильных ответов</span><b>{result.correctCount} из {result.totalQuestions}</b></div>
              <div className='flex justify-between border-b border-slate-200 pb-2'><span>Ошибок</span><b>{result.mistakes}</b></div>
              <div className='flex justify-between'><span>Проходной балл</span><b>80%</b></div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className='mb-4 text-lg font-semibold text-slate-900'>Результаты по разделам</h2>
          <div className='space-y-3'>
            {sectionStats.map((section) => (
              <div key={section.sectionTitle} className='grid gap-2 rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center'>
                <span className='font-medium text-slate-800'>{section.sectionTitle}</span>
                <span className='text-slate-600'>{section.correct} из {section.total}</span>
                <Badge className={section.percent >= 80 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>{section.percent}%</Badge>
              </div>
            ))}
          </div>
        </Card>

        <div className={passed ? 'rounded-lg border border-green-100 bg-green-50 px-5 py-4 text-sm text-green-900' : 'rounded-lg border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-900'}>
          <p className='font-semibold'>{passed ? 'Спасибо! Вы успешно прошли аттестацию.' : 'Аттестация не пройдена.'}</p>
          <p className='mt-1'>{passed ? 'Продолжайте в том же духе!' : 'Рекомендуем повторить рабочие правила по разделам, где были ошибки, и пройти аттестацию повторно после разрешения администратора.'}</p>
        </div>

        <Button onClick={() => router.push('/employee')}>Вернуться в кабинет</Button>
      </main>
    );
  }

  if (!question) return <main className='p-6 text-slate-600'>Загрузка аттестации...</main>;

  return (
    <main className='mx-auto max-w-5xl space-y-6 p-4 md:p-8'>
      <header className='flex flex-col gap-3 rounded-lg border border-border/80 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between'>
        <BrandBlock />
        <LogoutButton />
      </header>

      <Card className='space-y-5'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h1 className='text-xl font-bold text-slate-900'>Прохождение аттестации</h1>
            <p className='mt-2 text-sm text-slate-600'>
              <span className='font-semibold text-green-700'>Раздел {sectionIndex} из {sectionTitles.length}</span>
              <span className='px-2 text-slate-300'>/</span>
              {question.sectionTitle}
            </p>
          </div>
          <div className='flex flex-col items-stretch gap-2 sm:flex-row sm:items-center'>
            <div className={timeLeft <= 60 ? 'flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700' : 'flex h-10 items-center justify-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 text-sm font-bold text-green-700'}>
              <Clock3 className='h-4 w-4' />
              {timerText}
            </div>
            <Button className='bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900' onClick={() => router.push('/employee')}>
              Завершить позже
            </Button>
          </div>
        </div>

        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm text-slate-600'>
            <span>Вопрос {currentIndex + 1} из {questions.length}</span>
            <span>{progressValue}%</span>
          </div>
          <Progress value={progressValue} />
        </div>

        <div className='rounded-lg border border-border bg-white p-5'>
          <p className='mb-5 text-base font-semibold text-slate-900'>{question.text}</p>
          <div className='space-y-3'>
            {question.options.map((option, index) => {
              const active = selected === index;
              return (
                <button
                  key={index}
                  className={active ? 'flex w-full items-center gap-3 rounded-lg border border-green-500 bg-green-50 px-4 py-3 text-left text-sm text-slate-900 shadow-sm' : 'flex w-full items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-green-300 hover:bg-green-50/40'}
                  onClick={() => selectAnswer(index)}
                >
                  <span className={active ? 'flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white' : 'flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-transparent'}>
                    {active ? <Check className='h-3.5 w-3.5' /> : <Circle className='h-2 w-2' />}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {message && <p className='text-sm text-red-600'>{message}</p>}

        <div className='flex justify-between gap-2 border-t border-border pt-4'>
          <Button className='gap-2 bg-white text-slate-700 ring-1 ring-border hover:bg-slate-50 hover:text-slate-900' disabled={currentIndex === 0} onClick={() => move(currentIndex - 1)}>
            <ArrowLeft className='h-4 w-4' />
            Назад
          </Button>
          {currentIndex < questions.length - 1 ? (
            <Button className='gap-2' onClick={() => move(currentIndex + 1)}>
              Далее
              <ArrowRight className='h-4 w-4' />
            </Button>
          ) : (
            <Button onClick={() => finish(false)}>Завершить аттестацию</Button>
          )}
        </div>
      </Card>
    </main>
  );
}
