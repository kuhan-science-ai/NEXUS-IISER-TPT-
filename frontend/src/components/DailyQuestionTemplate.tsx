import React from 'react';
import { Lightbulb, UsersRound } from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import './DailyQuestionTemplate.css';

export interface DailyQuestionRecord {
  id?: string;
  date?: string;
  category?: string;
  question_latex?: string;
  explanation_latex?: string;
  options?: string[];
  points?: number;
  answered_count?: number;
  user_answer?: { id: string; answer_latex: string; selected_option?: number; attachment_file_id?: string | null; points_awarded: number; submitted_at: string } | null;
  total_points?: number;
}

interface DailyQuestionTemplateProps {
  question: DailyQuestionRecord | null;
  number?: string;
  compact?: boolean;
  children?: React.ReactNode;
  onActivate?: () => void;
  animateOnHover?: boolean;
}

export const DailyQuestionTemplate: React.FC<DailyQuestionTemplateProps> = ({ question, number, compact = false, children, onActivate, animateOnHover = true }) => (
  <article
    className={`daily-question-template${compact ? ' compact' : ''}${onActivate ? ' is-interactive' : ''}${animateOnHover ? '' : ' is-static'}`}
    role={onActivate ? 'button' : undefined}
    tabIndex={onActivate ? 0 : undefined}
    aria-label={onActivate ? `Open today’s ${question?.category || 'daily'} question to answer` : undefined}
    onClick={onActivate}
    onKeyDown={onActivate ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onActivate(); } } : undefined}
  >
    <div className="daily-question-template-face">
      <span className="daily-question-template-shine" aria-hidden="true" />
      <header className="daily-question-template-heading">
        <span><Lightbulb size={14} /> {number ? `QUESTION #${number} · ` : ''}{question?.category || 'DAILY CHALLENGE'} · QOTD</span>
        <time>{question?.date || 'Today'}</time>
      </header>
      <div className="daily-question-template-body">
        <MathRenderer content={question?.question_latex || 'A new question will appear here when the daily question feed is available.'} />
      </div>
      <footer className="daily-question-template-footer">
        <span><UsersRound size={13} /> {question?.answered_count ?? 0} answered</span>
        <span>{question?.points ?? 10} points for this question</span>
        <span>{question?.total_points ?? 0} total points</span>
      </footer>
      {children}
    </div>
  </article>
);
