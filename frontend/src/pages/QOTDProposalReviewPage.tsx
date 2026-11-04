import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { MathRenderer } from '../components/MathRenderer';
import './DailyQuestionPages.css';
import './QOTDCreatePage.css';

interface Proposal { id: string; author_name: string; category: string; question_latex: string; options: string[]; correct_option: number; explanation_latex: string; template_notes: string; animation_notes: string; status: string; submitted_at: string; }
interface QOTDProposalReviewPageProps { currentUser: UserSummary; onLogout?: () => void; }

export const QOTDProposalReviewPage: React.FC<QOTDProposalReviewPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { api.listDailyQuestionProposals().then(setProposals).catch(reason => setError((reason as Error).message || 'Could not load proposals.')).finally(() => setLoading(false)); }, []);
  return <div className="daily-question-page-layout">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="daily-question-page-shell"><TopHeader breadcrumb="Workspace / QOTD proposals" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="daily-question-page-main qotd-review-main">
        <header className="daily-question-page-heading"><div><span className="dashboard-eyebrow">REVIEW QUEUE</span><h1>QOTD proposals</h1><p>Question maker applications, with card and animation notes.</p></div><Link className="daily-question-back-link" to="/qotd"><ArrowLeft size={14} /> Back to QOTD</Link></header>
        <section className="qotd-review-list" aria-label="QOTD proposals">{loading ? <div className="daily-question-state">Loading proposals…</div> : error ? <div className="daily-question-error" role="alert">{error}</div> : proposals.length === 0 ? <div className="daily-question-state">No creator applications have been submitted yet.</div> : proposals.map(proposal => <article className="qotd-review-card" key={proposal.id}>
          <header><div><span className="daily-question-rail-eyebrow">{proposal.category} · {proposal.status}</span><h2>Submitted by {proposal.author_name}</h2></div><time>{new Date(proposal.submitted_at).toLocaleString()}</time></header>
          <section><h3>Question</h3><MathRenderer content={proposal.question_latex} /></section>
          <section className="qotd-review-options"><h3>Options</h3>{proposal.options.map((option, index) => <div className={proposal.correct_option === index ? 'is-correct-option' : ''} key={index}><b>{String.fromCharCode(65 + index)}</b><MathRenderer content={option} />{proposal.correct_option === index && <small>Correct</small>}</div>)}</section>
          <section><h3>Expected answer and explanation</h3><MathRenderer content={proposal.explanation_latex} /></section>
          <section className="qotd-review-notes"><div><h3>Template request</h3><p>{proposal.template_notes || 'No template notes.'}</p></div><div><h3><Sparkles size={14} /> Animation notes</h3><p>{proposal.animation_notes || 'No animation notes.'}</p></div></section>
        </article>)}</section>
      </main>
    </div><GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};

export default QOTDProposalReviewPage;
