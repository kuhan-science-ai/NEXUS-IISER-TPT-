import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Send, Sparkles } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { MathRenderer } from '../components/MathRenderer';
import './DailyQuestionPages.css';
import './QOTDCreatePage.css';

interface QOTDCreatePageProps { currentUser: UserSummary; onLogout?: () => void; }

const emptyOptions = ['', '', '', ''];

export const QOTDCreatePage: React.FC<QOTDCreatePageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState('Physics');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(emptyOptions);
  const [correctOption, setCorrectOption] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [animationNotes, setAnimationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createDailyQuestionProposal({
        category,
        question_latex: question.trim(),
        options: options.map(option => option.trim()),
        correct_option: correctOption,
        explanation_latex: explanation.trim(),
        template_notes: templateNotes.trim(),
        animation_notes: animationNotes.trim(),
      });
      setSubmitted(true);
    } catch (reason) {
      setError((reason as Error).message || 'Your proposal could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <div className="daily-question-page-layout">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="daily-question-page-shell"><TopHeader breadcrumb="Workspace / QOTD creator application" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="daily-question-page-main qotd-create-success-wrap"><section className="qotd-create-success"><CheckCircle2 size={34} /><span className="daily-question-rail-eyebrow">APPLICATION SENT</span><h1>Your QOTD proposal is with the reviewers.</h1><p>Your question, LaTeX options, solution, design notes, and animation notes were saved for review.</p><div><Link to="/qotd">Back to Question of the Day <ArrowRight size={14} /></Link></div></section></main>
    </div><GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;

  return <div className="daily-question-page-layout">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="daily-question-page-shell">
      <TopHeader breadcrumb="Workspace / Create QOTD" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="daily-question-page-main qotd-create-main">
        <header className="daily-question-page-heading"><div><span className="dashboard-eyebrow">QOTD CREATOR APPLICATION</span><h1>Create and apply</h1><p>Send a complete, reviewable question proposal to the QOTD team.</p></div><Link className="daily-question-back-link" to="/qotd"><ArrowLeft size={14} /> Back to QOTD</Link></header>
        <form className="qotd-create-form" onSubmit={submit}>
          <div className="qotd-create-columns">
            <section className="qotd-create-editor" aria-label="Question and answer options">
              <div className="qotd-create-field qotd-create-category"><label htmlFor="qotd-category">Subject</label><select id="qotd-category" value={category} onChange={event => setCategory(event.target.value)}><option>Physics</option><option>Chemistry</option><option>Mathematics</option></select><small>Write chemistry equations with KaTeX mhchem, for example <code>{'$\\ce{H2O}'}</code>.</small></div>
              <div className="qotd-create-field"><label htmlFor="qotd-question">Question <span>LaTeX supported</span></label><textarea id="qotd-question" value={question} onChange={event => setQuestion(event.target.value)} minLength={10} maxLength={5000} required placeholder={'Example: Find $x$ if $x^2 - 5x + 6 = 0$.'} />{question && <div className="qotd-create-preview"><small>Preview</small><MathRenderer content={question} /></div>}</div>
              <fieldset className="qotd-create-options"><legend>Four answer options <span>Select the correct one · LaTeX supported</span></legend><div className="qotd-create-option-grid">{options.map((option, index) => <label className={`qotd-create-field ${correctOption === index ? 'is-correct-option' : ''}`} key={index}><span className="qotd-create-option-label"><input type="radio" name="qotd-correct-option" checked={correctOption === index} onChange={() => setCorrectOption(index)} /> Option {String.fromCharCode(65 + index)}{correctOption === index && <small>Correct answer</small>}</span><textarea value={option} onChange={event => setOptions(previous => previous.map((value, optionIndex) => optionIndex === index ? event.target.value : value))} maxLength={1000} required placeholder={`Option ${String.fromCharCode(65 + index)} · e.g. $x = 2$`} />{option && <div className="qotd-create-preview qotd-create-option-preview"><MathRenderer content={option} /></div>}</label>)}</div></fieldset>
              <div className="qotd-create-field"><label htmlFor="qotd-explanation">Correct answer and worked explanation <span>LaTeX supported</span></label><textarea id="qotd-explanation" value={explanation} onChange={event => setExplanation(event.target.value)} minLength={10} maxLength={5000} required placeholder={'Show why the correct option is right. Use $...$ for equations and \\ce{...} for chemistry.'} />{explanation && <div className="qotd-create-preview"><small>Preview</small><MathRenderer content={explanation} /></div>}</div>
            </section>
            <aside className="qotd-create-notes">
              <div className="qotd-create-field"><label htmlFor="qotd-template">Template / card design request</label><textarea id="qotd-template" value={templateNotes} onChange={event => setTemplateNotes(event.target.value)} maxLength={1500} placeholder="Describe the template style, colors, layout, or visual assets you need for this question." /><small>Tell the team how the question should be presented on its quiz card.</small></div>
              <div className="qotd-create-field"><label htmlFor="qotd-animation">Animation notes for the QOTD team</label><textarea id="qotd-animation" value={animationNotes} onChange={event => setAnimationNotes(event.target.value)} maxLength={1500} placeholder="Describe motion, timing, triggers, and what the animation should communicate." /><small>These notes are included with your application for the team to implement.</small></div>
              <div className="qotd-create-review-note"><Sparkles size={16} /><p>Questions are reviewed before publication. Check the facts, options, and worked solution before sending.</p></div>
            </aside>
          </div>
          {error && <div className="daily-question-error" role="alert">{error}</div>}
          <footer className="qotd-create-footer"><span>One proposal includes the question, four options, solution, card request, and animation notes.</span><button type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Submit for review'} <Send size={14} /></button></footer>
        </form>
      </main>
    </div>
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};

export default QOTDCreatePage;
