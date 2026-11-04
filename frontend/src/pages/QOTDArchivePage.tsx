import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { UserSummary, api } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { DailyQuestionRecord, DailyQuestionTemplate } from '../components/DailyQuestionTemplate';
import { MathRenderer } from '../components/MathRenderer';
import './DailyQuestionPages.css';

interface QOTDArchivePageProps { currentUser: UserSummary | null; onLogout?: () => void; }
const PAGE_SIZE = 8;

export const QOTDArchivePage: React.FC<QOTDArchivePageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [questions, setQuestions] = useState<DailyQuestionRecord[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!currentUser) return;
    api.listDailyQuestions().then(setQuestions).catch(reason => setError(reason.message || 'Could not load previous questions.')).finally(() => setLoading(false));
  }, [currentUser?.id]);
  if (!currentUser) return null;
  const pageCount = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const pageQuestions = questions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <div className="daily-question-page-layout">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="daily-question-page-shell"><TopHeader breadcrumb="Workspace / Previous questions" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="daily-question-page-main daily-question-archive-main">
        <header className="daily-question-page-heading"><div><span className="dashboard-eyebrow">QUESTION ARCHIVE</span><h1>Previous questions</h1><p>Browse earlier prompts and their official answers.</p></div><Link className="daily-question-back-link" to="/qotd"><ArrowLeft size={14} /> Today’s question</Link></header>
        <div className="daily-question-archive-grid">{loading ? <div className="daily-question-state">Loading question archive…</div> : pageQuestions.length ? pageQuestions.map((question, index) => <article className="daily-question-archive-card" key={question.id}><DailyQuestionTemplate question={question} number={String((page - 1) * PAGE_SIZE + index + 1).padStart(3, '0')} compact /><section className="daily-question-archive-answer"><span>OFFICIAL ANSWER</span><MathRenderer content={question.explanation_latex || 'No answer has been added for this question yet.'} /></section><footer>{question.answered_count ?? 0} students answered · {question.points ?? 10} points</footer></article>) : !error && <div className="daily-question-state">There are no previous questions in the archive yet.</div>}</div>
        <nav className="daily-question-archive-pagination" aria-label="Question archive pages"><button type="button" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ArrowLeft size={14} /> Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Next <ArrowRight size={14} /></button></nav>
        {error && <div className="daily-question-error" role="alert">{error}</div>}
      </main>
    </div>
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};
