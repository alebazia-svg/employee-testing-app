'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { questionCountText } from '@/lib/test-format';

type Question = { id: number; text: string; options: string[]; correctIndex: number };
type Section = { id: number; title: string; questions: Question[] };
type Attestation = { id: number; title: string; passingScore: number; status: string; type: string; sections: Section[] };
type EditorTab = 'sections' | 'questions' | 'settings';

const letters = ['A', 'B', 'C', 'D'];
const emptyQuestion = { text: '', options: ['', '', '', ''], correctIndex: 0 };

export default function AttestationEditor({ attestation }: { attestation: Attestation }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<EditorTab>('sections');
  const [title, setTitle] = useState(attestation.title);
  const [passingScore, setPassingScore] = useState(attestation.passingScore);
  const [status, setStatus] = useState(attestation.status);
  const [type, setType] = useState(attestation.type);
  const [sections, setSections] = useState(attestation.sections);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<{ sectionId: number; questionId: number | 'new' } | null>(null);
  const [questionDraft, setQuestionDraft] = useState(emptyQuestion);

  async function saveAttestation() {
    await fetch(`/api/admin/attestations/${attestation.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, passingScore, status, type }),
    });
    router.refresh();
  }

  async function deleteAttestation() {
    if (!window.confirm('Удалить аттестацию, разделы, вопросы и связанные результаты?')) return;
    await fetch(`/api/admin/attestations/${attestation.id}`, { method: 'DELETE' });
    router.push('/admin/attestations');
    router.refresh();
  }

  async function createSection() {
    const response = await fetch(`/api/admin/attestations/${attestation.id}/sections`, {
      method: 'POST',
      body: JSON.stringify({ title: newSectionTitle }),
    });
    const section = await response.json();
    setSections((current) => [...current, { ...section, questions: [] }]);
    setNewSectionTitle('');
    router.refresh();
  }

  async function renameSection(sectionId: number, nextTitle: string) {
    setSections((current) => current.map((section) => (section.id === sectionId ? { ...section, title: nextTitle } : section)));
    await fetch(`/api/admin/sections/${sectionId}`, { method: 'PATCH', body: JSON.stringify({ title: nextTitle }) });
    router.refresh();
  }

  async function deleteSection(sectionId: number) {
    if (!window.confirm('Удалить раздел со всеми вопросами?')) return;
    await fetch(`/api/admin/sections/${sectionId}`, { method: 'DELETE' });
    setSections((current) => current.filter((section) => section.id !== sectionId));
    if (editingQuestion?.sectionId === sectionId) cancelQuestionEdit();
    router.refresh();
  }

  function startQuestion(sectionId: number, question?: Question) {
    setActiveTab('questions');
    setEditingQuestion({ sectionId, questionId: question?.id ?? 'new' });
    setQuestionDraft(question ? { text: question.text, options: [...question.options], correctIndex: question.correctIndex } : emptyQuestion);
  }

  function cancelQuestionEdit() {
    setEditingQuestion(null);
    setQuestionDraft(emptyQuestion);
  }

  async function saveQuestion() {
    if (!editingQuestion) return;
    const url = editingQuestion.questionId === 'new' ? `/api/admin/sections/${editingQuestion.sectionId}/questions` : `/api/admin/questions/${editingQuestion.questionId}`;
    const method = editingQuestion.questionId === 'new' ? 'POST' : 'PATCH';
    const response = await fetch(url, { method, body: JSON.stringify(questionDraft) });
    const saved = await response.json();
    setSections((current) =>
      current.map((section) => {
        if (section.id !== editingQuestion.sectionId) return section;
        return {
          ...section,
          questions: editingQuestion.questionId === 'new' ? [...section.questions, saved] : section.questions.map((question) => (question.id === saved.id ? saved : question)),
        };
      }),
    );
    cancelQuestionEdit();
    router.refresh();
  }

  async function deleteQuestion(sectionId: number, questionId: number) {
    if (!window.confirm('Удалить вопрос?')) return;
    await fetch(`/api/admin/questions/${questionId}`, { method: 'DELETE' });
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, questions: section.questions.filter((question) => question.id !== questionId) } : section)),
    );
    if (editingQuestion?.questionId === questionId) cancelQuestionEdit();
    router.refresh();
  }

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: 'sections', label: 'Разделы' },
    { id: 'questions', label: 'Вопросы' },
    { id: 'settings', label: 'Настройки' },
  ];

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <p className='text-sm text-slate-500'>Аттестации / {title}</p>
          <h1 className='text-2xl font-bold text-slate-900'>Структура аттестации</h1>
        </div>
        <Button className='bg-red-600 hover:bg-red-700' onClick={deleteAttestation}>Удалить аттестацию</Button>
      </div>

      <Card>
        <div className='flex flex-wrap gap-2 border-b border-border pb-3'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type='button'
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-200',
                activeTab === tab.id ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'sections' && (
          <div className='mt-5 space-y-4'>
            <div className='flex flex-col gap-2 md:flex-row'>
              <Input placeholder='Название раздела' value={newSectionTitle} onChange={(event) => setNewSectionTitle(event.target.value)} />
              <Button className='gap-2 md:w-auto' disabled={!newSectionTitle.trim()} onClick={createSection}>
                <Plus className='h-4 w-4' />
                Добавить раздел
              </Button>
            </div>

            <div className='space-y-3'>
              {sections.map((section, sectionIndex) => (
                <div key={section.id} className='rounded-lg border border-border bg-white p-4'>
                  <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                    <div className='flex flex-1 items-center gap-3'>
                      <span className='text-sm font-semibold text-slate-500'>{sectionIndex + 1}.</span>
                      <Input value={section.title} onChange={(event) => renameSection(section.id, event.target.value)} />
                      <Badge className='bg-slate-100 text-slate-700'>{questionCountText(section.questions.length)}</Badge>
                    </div>
                    <Button className='h-9 w-9 bg-white p-0 text-red-600 ring-1 ring-border hover:bg-red-50 hover:text-red-700' onClick={() => deleteSection(section.id)}>
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className='mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]'>
            <div className='space-y-4'>
              {sections.map((section) => (
                <div key={section.id} className='rounded-lg border border-border bg-white p-4'>
                  <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                    <div>
                      <h2 className='font-semibold text-slate-900'>{section.title}</h2>
                      <p className='mt-1 text-sm text-slate-500'>{questionCountText(section.questions.length)}</p>
                    </div>
                    <Button className='gap-2' onClick={() => startQuestion(section.id)}>
                      <Plus className='h-4 w-4' />
                      Добавить вопрос
                    </Button>
                  </div>

                  <div className='mt-3 space-y-2'>
                    {section.questions.map((question) => (
                      <div key={question.id} className='flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 md:flex-row md:items-center md:justify-between'>
                        <span className='text-sm font-medium text-slate-800'>{question.text}</span>
                        <div className='flex gap-2'>
                          <Button className='h-8 w-8 bg-white p-0 text-slate-700 ring-1 ring-border hover:bg-slate-50' onClick={() => startQuestion(section.id, question)}>
                            <Pencil className='h-4 w-4' />
                          </Button>
                          <Button className='h-8 w-8 bg-white p-0 text-red-600 ring-1 ring-border hover:bg-red-50' onClick={() => deleteQuestion(section.id, question.id)}>
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <QuestionEditor
              editingQuestion={editingQuestion}
              questionDraft={questionDraft}
              setQuestionDraft={setQuestionDraft}
              saveQuestion={saveQuestion}
              cancelQuestionEdit={cancelQuestionEdit}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className='mt-5 space-y-4'>
            <div className='grid gap-4 md:grid-cols-[1fr_150px_150px_160px]'>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              <Input type='number' min={0} max={100} value={passingScore} onChange={(event) => setPassingScore(Number(event.target.value))} />
              <select className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm' value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value='DRAFT'>Черновик</option>
                <option value='ACTIVE'>Активна</option>
              </select>
              <select className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm' value={type} onChange={(event) => setType(event.target.value)}>
                <option value='PRACTICE'>Пробная</option>
                <option value='CONTROL'>Контрольная</option>
              </select>
            </div>
            <div className='flex justify-end'>
              <Button disabled={!title.trim()} onClick={saveAttestation}>Сохранить настройки</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function QuestionEditor({
  editingQuestion,
  questionDraft,
  setQuestionDraft,
  saveQuestion,
  cancelQuestionEdit,
}: {
  editingQuestion: { sectionId: number; questionId: number | 'new' } | null;
  questionDraft: typeof emptyQuestion;
  setQuestionDraft: React.Dispatch<React.SetStateAction<typeof emptyQuestion>>;
  saveQuestion: () => Promise<void>;
  cancelQuestionEdit: () => void;
}) {
  if (!editingQuestion) {
    return (
      <div className='rounded-lg border border-dashed border-border bg-slate-50 p-5 text-sm text-slate-500'>
        Выберите карандаш у вопроса для редактирования или добавьте новый вопрос в нужном разделе.
      </div>
    );
  }

  return (
    <div className='rounded-lg border border-green-200 bg-green-50/80 p-5'>
      <h2 className='mb-3 text-lg font-semibold text-slate-900'>{editingQuestion.questionId === 'new' ? 'Новый вопрос' : 'Редактирование вопроса'}</h2>
      <label className='block text-sm font-medium text-slate-700'>
        Текст вопроса
        <textarea
          className='mt-1 min-h-24 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
          value={questionDraft.text}
          onChange={(event) => setQuestionDraft((draft) => ({ ...draft, text: event.target.value }))}
        />
      </label>

      <div className='mt-3 grid gap-3'>
        {letters.map((letter, index) => (
          <label key={letter} className='text-sm font-medium text-slate-700'>
            Вариант {letter}
            <Input className='mt-1' value={questionDraft.options[index]} onChange={(event) => setQuestionDraft((draft) => ({ ...draft, options: draft.options.map((option, optionIndex) => optionIndex === index ? event.target.value : option) }))} />
          </label>
        ))}
      </div>

      <label className='mt-3 block text-sm font-medium text-slate-700'>
        Правильный ответ
        <select className='mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm' value={questionDraft.correctIndex} onChange={(event) => setQuestionDraft((draft) => ({ ...draft, correctIndex: Number(event.target.value) }))}>
          {letters.map((letter, index) => <option key={letter} value={index}>{letter}</option>)}
        </select>
      </label>

      <div className='mt-4 flex flex-col gap-2 sm:flex-row'>
        <Button disabled={!questionDraft.text.trim() || questionDraft.options.some((option) => !option.trim())} onClick={saveQuestion}>Сохранить вопрос</Button>
        <Button className='bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-800' onClick={cancelQuestionEdit}>Отмена</Button>
      </div>
    </div>
  );
}
