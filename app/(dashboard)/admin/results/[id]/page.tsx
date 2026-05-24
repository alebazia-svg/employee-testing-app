import { CheckCircle, XCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import ResetAttemptButton from './ResetAttemptButton';

type Detail = {
  questionId: number;
  sectionTitle: string;
  question: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
};

export default async function ResultDetailsPage({ params }: { params: { id: string } }) {
  const result = await prisma.result.findUnique({
    where: { id: Number(params.id) },
    include: { user: true, attestation: true },
  });

  if (!result) {
    return (
      <AdminShell>
        <p className='text-slate-700'>Результат не найден.</p>
      </AdminShell>
    );
  }

  const details = JSON.parse(result.details) as Detail[];
  const grouped = details.reduce<Record<string, Detail[]>>((acc, detail) => {
    acc[detail.sectionTitle] = acc[detail.sectionTitle] ?? [];
    acc[detail.sectionTitle].push(detail);
    return acc;
  }, {});
  const errorsBySection = Object.entries(grouped).map(([sectionTitle, items]) => ({
    sectionTitle,
    errors: items.filter((item) => !item.isCorrect).length,
  }));

  return (
    <AdminShell>
      <div className='mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Детали результата</h1>
          <p className='text-sm text-slate-500'>{result.user.name} · {new Date(result.date).toLocaleDateString('ru-RU')}</p>
        </div>
        <ResetAttemptButton resultId={result.id} />
      </div>

      <div className='mb-6 grid gap-4 md:grid-cols-[280px_1fr]'>
        <Card className={result.status === 'Сдал' ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}>
          <div className='flex items-center gap-4'>
            {result.status === 'Сдал' ? <CheckCircle className='h-12 w-12 text-green-600' /> : <XCircle className='h-12 w-12 text-red-600' />}
            <div>
              <p className={result.status === 'Сдал' ? 'text-2xl font-bold text-green-700' : 'text-2xl font-bold text-red-700'}>{result.status}</p>
              <p className='text-3xl font-bold text-slate-900'>{result.percent}%</p>
            </div>
          </div>
          <p className='mt-4 text-sm text-slate-700'>{result.correctCount} из {result.totalQuestions} правильных ответов</p>
        </Card>
        <Card>
          <div className='grid gap-3 text-sm text-slate-700 md:grid-cols-2'>
            <div className='flex justify-between border-b border-border pb-2'><span>Аттестация</span><b>{result.attestation.title}</b></div>
            <div className='flex justify-between border-b border-border pb-2'><span>Проходной балл</span><b>{result.attestation.passingScore}%</b></div>
            <div className='flex justify-between'><span>Правильных ответов</span><b>{result.correctCount}</b></div>
            <div className='flex justify-between'><span>Ошибок</span><b>{result.mistakes}</b></div>
          </div>
        </Card>
      </div>

      <Card className='mb-6'>
        <h2 className='mb-3 text-lg font-semibold text-slate-900'>Ошибки по разделам</h2>
        <div className='space-y-2'>
          {errorsBySection.map((item) => (
            <div key={item.sectionTitle} className='flex justify-between rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm'>
              <span className='font-medium text-slate-800'>{item.sectionTitle}</span>
              <span className={item.errors ? 'text-red-700' : 'text-green-700'}>{item.errors}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className='mb-3 text-lg font-semibold text-slate-900'>Вопросы</h2>
        <div className='space-y-3'>
          {details.map((detail) => (
            <div key={detail.questionId} className='rounded-lg border border-border bg-slate-50 p-3'>
              <div className='mb-2 flex items-start justify-between gap-3'>
                <p className='font-medium text-slate-900'>{detail.question}</p>
                <Badge className={detail.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
                  {detail.isCorrect ? 'Верно' : 'Ошибка'}
                </Badge>
              </div>
              <p className='text-sm text-slate-600'>Ответ сотрудника: {detail.selectedIndex === null ? 'Нет ответа' : `${String.fromCharCode(65 + detail.selectedIndex)}. ${detail.options[detail.selectedIndex]}`}</p>
              <p className='text-sm text-green-800'>Правильный ответ: {String.fromCharCode(65 + detail.correctIndex)}. {detail.options[detail.correctIndex]}</p>
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
