type QuestionForDetails = {
  id: number;
  text: string;
  options: string;
  correctIndex: number;
  section: { id: number; title: string };
};

export type AnswerDetails = {
  questionId: number;
  sectionId: number;
  sectionTitle: string;
  question: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
};

export function parseOptions(options: string) {
  return JSON.parse(options) as string[];
}

export function shuffleIds(ids: number[]) {
  const result = [...ids];

  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function calculateResult(questions: QuestionForDetails[], answers: Record<string, number>) {
  const details: AnswerDetails[] = questions.map((question) => {
    const selected = answers[String(question.id)];
    const selectedIndex = typeof selected === 'number' ? selected : null;

    return {
      questionId: question.id,
      sectionId: question.section.id,
      sectionTitle: question.section.title,
      question: question.text,
      options: parseOptions(question.options),
      selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect: selectedIndex === question.correctIndex,
    };
  });

  const correctCount = details.filter((detail) => detail.isCorrect).length;
  const totalQuestions = details.length;
  const mistakes = totalQuestions - correctCount;
  const percent = totalQuestions ? Math.round((correctCount * 100) / totalQuestions) : 0;

  return { details, correctCount, totalQuestions, mistakes, percent };
}
