import { QuestionSet, Question } from 'nest-commander';

@QuestionSet({ name: 'task-questions' })
export class TaskQuestions {
  @Question({
    message: 'What task would you like to execute?',
    name: 'task',
  })
  parseTask(val: string) {
    return val;
  }
}
