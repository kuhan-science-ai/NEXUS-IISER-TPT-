import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight, Award, FileText, MessageCircle, Send, Sparkles } from 'lucide-react';
import { UserSummary, api } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { DailyQuestionRecord, DailyQuestionTemplate } from '../components/DailyQuestionTemplate';
import { MathRenderer } from '../components/MathRenderer';
import { BasketballPdfUploader } from '../components/BasketballPdfUploader';
import './DailyQuestionPages.css';

interface QOTDPageProps { currentUser: UserSummary | null; onLogout?: () => void; defaultTab?: 'question' | 'answer'; }
type DiscussionComment = { id: string; parent_comment_id?: string | null; author_name: string; content: string; created_at: string };
type CommunityAnswer = { id: string; author_name: string; answer_latex: string; selected_option?: number; attachment_file_id?: string | null; points_awarded: number; submitted_at: string; comments: DiscussionComment[] };

export const QOTDPage: React.FC<QOTDPageProps> = ({ currentUser, onLogout, defaultTab = 'question' }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [question, setQuestion] = useState<DailyQuestionRecord | null>(null);
  const [answers, setAnswers] = useState<CommunityAnswer[]>([]);
  const [answerDraft, setAnswerDraft] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyTargets, setReplyTargets] = useState<Record<string, string | null>>({});
  const [activeAnswerTab, setActiveAnswerTab] = useState<'mine' | 'community'>('mine');
  const [loading, setLoading] = useState(true);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [communityPage, setCommunityPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState('');
  const [sampleAnswersEnabled, setSampleAnswersEnabled] = useState(false);
  const [error, setError] = useState('');
  const isAnswerPage = defaultTab === 'answer';
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    api.getDailyQuestion().then(setQuestion).catch(reason => setError(reason.message || 'Could not load today’s question.')).finally(() => setLoading(false));
  }, [currentUser?.id]);

  const loadCommunityAnswers = async () => {
    if (!question?.id || !question.user_answer) return;
    setLoadingAnswers(true);
    setError('');
    try { setAnswers(await api.listDailyQuestionAnswers(question.id)); }
    catch (reason) { setError((reason as Error).message || 'Could not load answers.'); }
    finally { setLoadingAnswers(false); }
  };

  const submitAnswer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question?.id || !answerDraft.trim() || selectedOption === null || question.user_answer) return;
    setSubmitting(true); setError('');
    try {
      const uploaded = attachment ? await api.uploadDailyQuestionPdf(attachment) : null;
      const submitted = await api.submitDailyQuestionAnswer(question.id, answerDraft.trim(), selectedOption, uploaded?.file_id);
      setQuestion(previous => previous ? { ...previous, user_answer: submitted, total_points: submitted.total_points, answered_count: (previous.answered_count || 0) + 1 } : previous);
      setActiveAnswerTab('mine');
      setCommunityPage(1);
    } catch (reason) { setError((reason as Error).message || 'Could not submit your answer.'); }
    finally { setSubmitting(false); }
  };

  const openCommunityTab = () => { setActiveAnswerTab('community'); if (answers.length === 0) void loadCommunityAnswers(); };

  const downloadAttachment = async (answerId: string) => {
    if (!question?.id) return;
    setDownloadingPdf(answerId); setError('');
    try { await api.downloadDailyQuestionAttachment(question.id, answerId); }
    catch (reason) { setError((reason as Error).message || 'Could not download the PDF.'); }
    finally { setDownloadingPdf(''); }
  };

  const postComment = async (answerId: string, parentCommentId?: string | null) => {
    const draftKey = parentCommentId || answerId;
    if (!question?.id || !commentDrafts[draftKey]?.trim()) return;
    setError('');
    try {
      const created = await api.addDailyQuestionAnswerComment(question.id, answerId, commentDrafts[draftKey].trim(), parentCommentId || undefined);
      const authorName = currentUser.display_name || currentUser.full_name || currentUser.username;
      setAnswers(previous => previous.map(answer => answer.id === answerId ? { ...answer, comments: [...answer.comments, { ...created, author_name: authorName }] } : answer));
      setCommentDrafts(previous => ({ ...previous, [draftKey]: '' }));
      if (parentCommentId) setReplyTargets(previous => ({ ...previous, [answerId]: null }));
    } catch (reason) { setError((reason as Error).message || 'Could not post your reply.'); }
  };

  const renderCommentThread = (answer: CommunityAnswer, parentCommentId: string | null = null, depth = 0): React.ReactNode => answer.comments
    .filter(comment => (comment.parent_comment_id || null) === parentCommentId)
    .map(comment => <div className="daily-question-comment-thread" key={comment.id} style={{ marginLeft: `${Math.min(depth, 4) * 12}px` }}>
      <div className="daily-question-comment"><strong>{comment.author_name}</strong><p>{comment.content}</p><button type="button" onClick={() => setReplyTargets(previous => ({ ...previous, [answer.id]: comment.id }))}>Reply</button></div>
      {replyTargets[answer.id] === comment.id && <form className="daily-question-reply-form" onSubmit={event => { event.preventDefault(); void postComment(answer.id, comment.id); }}><input value={commentDrafts[comment.id] || ''} onChange={event => setCommentDrafts(previous => ({ ...previous, [comment.id]: event.target.value }))} maxLength={2000} placeholder={`Reply to ${comment.author_name}…`} aria-label={`Reply to ${comment.author_name}`} /><button type="submit" disabled={!commentDrafts[comment.id]?.trim()} aria-label="Send reply"><Send size={13} /></button></form>}
      {renderCommentThread(answer, comment.id, depth + 1)}
    </div>);

  if (!currentUser) return null;
  const totalPoints = question?.total_points ?? 0;
  const answersPerPage = 3;
  const sampleAnswers: CommunityAnswer[] = [
    { id: 'sample-answer-1', author_name: 'Aarav S. · sample', answer_latex: 'For the ground state, the oscillator energy is $E_0=\\frac{1}{2}\\hbar\\omega$. The zero-point energy remains even at absolute zero.', selected_option: 0, points_awarded: 10, submitted_at: new Date().toISOString(), comments: [{ id: 'sample-comment-1', author_name: 'Mira K. · sample', content: 'This follows from the lowest allowed energy level.', created_at: new Date().toISOString() }] },
    { id: 'sample-answer-2', author_name: 'Mira K. · sample', answer_latex: 'Using $E_n=(n+\\frac{1}{2})\\hbar\\omega$ and setting $n=0$ gives $E_0=\\frac{1}{2}\\hbar\\omega$.', selected_option: 0, points_awarded: 10, submitted_at: new Date().toISOString(), comments: [] },
    { id: 'sample-answer-3', author_name: 'Dev P. · sample', answer_latex: 'The minimum energy is nonzero because position and momentum cannot both have zero uncertainty.', selected_option: 1, points_awarded: 0, submitted_at: new Date().toISOString(), comments: [] },
  ];
  const communityAnswers = sampleAnswersEnabled ? [...answers, ...sampleAnswers] : answers;
  const displayedAnswerCount = Math.max(question?.answered_count ?? 0, sampleAnswersEnabled ? sampleAnswers.length : 0);
  const displayedCommunityCount = Math.max(0, displayedAnswerCount - (question?.user_answer ? 1 : 0));
  const totalAnswerPages = Math.max(1, Math.ceil(communityAnswers.length / answersPerPage));
  const visibleAnswers = communityAnswers.slice((communityPage - 1) * answersPerPage, communityPage * answersPerPage);

  return <div className="daily-question-page-layout">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="daily-question-page-shell">
      <TopHeader breadcrumb={`Workspace / ${isAnswerPage ? 'Answer of the Day' : 'Question of the Day'}`} currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="daily-question-page-main">
        <header className="daily-question-page-heading"><div><span className="dashboard-eyebrow">DAILY CAMPUS QUESTION</span><h1>{isAnswerPage ? 'Answer of the Day' : 'Question of the Day'}</h1><p>{isAnswerPage ? 'Share your response once, then compare ideas with the community.' : 'Today’s question, participation, and your points at a glance.'}</p></div><div className="daily-question-total-points"><Award size={16} /><span><strong>{totalPoints}</strong><small>your points</small></span></div></header>
        <nav className="daily-question-route-tabs" aria-label="Daily question pages"><Link to="/qotd" className={!isAnswerPage ? 'active' : ''}><Sparkles size={14} /> Question of the Day</Link><Link to="/aotd" className={isAnswerPage ? 'active' : ''}><MessageCircle size={14} /> Answer of the Day</Link></nav>
        <div className="daily-question-page-content">
          {loading ? <div className="daily-question-state">Loading today’s question…</div> : question ? <>
            <div className={`daily-question-wide-layout ${isAnswerPage ? 'is-aotd-layout' : 'is-qotd-layout'}`}>
            {!isAnswerPage ? <>
              <section className="daily-question-qotd-view">
                <div className="daily-question-card-stage"><DailyQuestionTemplate question={question} animateOnHover={false} onActivate={() => navigate('/aotd')} /></div>
                <div className="daily-question-qotd-actions"><div className="daily-question-answer-count"><UsersRoundIcon /> <span><strong>{question.answered_count ?? 0}</strong> students have answered</span></div><div className="daily-question-qotd-points"><strong>{question.points ?? 10}</strong><span>points available</span></div><Link to="/aotd" className="daily-question-primary-link">{question.user_answer ? 'View your answer' : 'Answer this question'} <ArrowRight size={15} /></Link></div>
                <Link className="daily-question-archive-link" to="/qotd/archive">View all previous questions <ArrowRight size={14} /></Link>
              </section>
              <aside className="daily-question-side-rail daily-question-qotd-rail">
                <div className="daily-question-creator-invite"><span className="daily-question-rail-eyebrow">HAVE A GOOD QUESTION IDEA?</span><h2>Create and apply for QOTD</h2><p>Submit a question, four LaTeX options, a solution, and notes for the card design.</p><Link to="/qotd/create" className="daily-question-primary-link">Create and apply <ArrowRight size={14} /></Link>{(currentUser.role === 'administrator' || currentUser.role === 'moderator') && <Link to="/qotd/review" className="daily-question-review-link">Review creator submissions <ArrowRight size={13} /></Link>}</div>
                <section className="daily-question-rules"><h3>QOTD rules &amp; terms</h3><ul><li>Questions must be accurate, clear, and suitable for campus learning.</li><li>Include exactly four distinct options and a correct worked explanation.</li><li>Write equations with LaTeX; include units and assumptions where needed.</li><li>No trolling, intentionally wrong questions or solutions, or offensive content.</li><li>Use original work or cite sources; do not include private information.</li><li>Submissions are reviewed before they can appear as a QOTD.</li></ul></section>
                <div className="daily-question-maker-bonus"><Sparkles size={17} /><div><strong>Future QOTD maker</strong><p>Consistently thoughtful, accurate submissions may earn an invitation to help make future QOTDs.</p></div></div>
              </aside>
            </> : <section className="daily-question-aotd-view">
              <div className="daily-question-aotd-main"><div className="daily-question-card-stage"><DailyQuestionTemplate question={question} animateOnHover={false} /></div>
                {!question.user_answer ? <form className="daily-question-answer-form" onSubmit={submitAnswer}><div><h2>Your answer</h2><p>Select one option, then explain your reasoning. One final submission per question.</p></div>
                  <fieldset className="daily-question-choice-grid" disabled={submitting}><legend>Choose one answer</legend>{(question.options?.length === 4 ? question.options : ['Option A', 'Option B', 'Option C', 'Option D']).map((option, index) => <label className={selectedOption === index ? 'selected' : ''} key={`${index}-${option}`}><input type="radio" name="daily-question-choice" value={index} checked={selectedOption === index} onChange={() => setSelectedOption(index)} /><span className="daily-question-choice-letter">{String.fromCharCode(65 + index)}</span><span className="daily-question-option-math"><MathRenderer content={option} /></span></label>)}</fieldset>
                  <textarea value={answerDraft} onChange={event => setAnswerDraft(event.target.value)} maxLength={2000} required placeholder="Write your explanation…" aria-label="Explain your answer" />
                  <BasketballPdfUploader file={attachment} onChange={setAttachment} disabled={submitting} />
                  <div className="daily-question-answer-form-footer"><span>{answerDraft.length}/2000 characters · {question.points ?? 10} points</span><button type="submit" disabled={submitting || !answerDraft.trim() || selectedOption === null}><Send size={14} /> {submitting ? 'Submitting…' : 'Submit answer'}</button></div></form> : <>
                  <article className="daily-question-own-answer"><div className="daily-question-own-answer-heading"><strong>Your submitted answer</strong><span>+{question.user_answer.points_awarded} points</span></div><p className="daily-question-selected-choice"><strong>Selected option:</strong> <MathRenderer content={(question.options || [])[question.user_answer.selected_option ?? 0] || `Option ${String.fromCharCode(65 + (question.user_answer.selected_option ?? 0))}`} /></p><MathRenderer className="daily-question-answer-rendered" content={question.user_answer.answer_latex} />{question.user_answer.attachment_file_id && <button type="button" className="daily-question-answer-attachment" disabled={downloadingPdf === question.user_answer.id} onClick={() => void downloadAttachment(question.user_answer!.id)}><ArrowDownToLine size={14} /> {downloadingPdf === question.user_answer.id ? 'Downloading…' : 'Download attached PDF'}</button>}<small>Submitted {new Date(question.user_answer.submitted_at).toLocaleString()}</small></article>
                </>}
                <aside className="daily-question-aotd-aside"><section className="daily-question-points-card"><Award size={19} /><span>Your points</span><strong>{totalPoints}</strong><small>+{question.user_answer?.points_awarded ?? question.points ?? 10} points for today’s question</small></section><section className="daily-question-streak-card"><Sparkles size={17} /><strong>Streak tracker</strong><p>Daily streak tracking is being reworked.</p></section></aside>
              </div>
              <aside className="daily-question-side-rail daily-question-answer-rail">
                <header className="daily-question-rail-heading"><div><span className="daily-question-rail-eyebrow">COMMUNITY RESPONSES</span><h2>Answers to this question</h2></div><span className="daily-question-rail-count">{displayedCommunityCount}</span></header>
                {import.meta.env.DEV && <button type="button" className="daily-question-sample-toggle" aria-pressed={sampleAnswersEnabled} onClick={() => { setSampleAnswersEnabled(value => !value); setCommunityPage(1); }}>Sample answers: {sampleAnswersEnabled ? 'On' : 'Off'}</button>}
                {displayedAnswerCount === 0 ? <div className="daily-question-no-answers"><MessageCircle size={19} /><strong>No answers yet</strong><p>Be the first to share your reasoning.</p></div> : !question.user_answer ? <div className="daily-question-locked-answers"><div className="daily-question-answer-skeletons" aria-hidden="true">{Array.from({ length: Math.min(5, displayedAnswerCount) }, (_, index) => <div className="daily-question-answer-skeleton" key={index}><i /><b /><span /><span /><span /></div>)}</div><div className="daily-question-locked-message"><Award size={18} /><strong>Submit your answer to unlock</strong><p>Community answers and discussions stay hidden until you submit your one-time response.</p></div></div> : <>
                  <div className="daily-question-answer-tabs" role="tablist" aria-label="Answer view"><button type="button" role="tab" aria-selected={activeAnswerTab === 'mine'} className={activeAnswerTab === 'mine' ? 'active' : ''} onClick={() => setActiveAnswerTab('mine')}>Your answer</button><button type="button" role="tab" aria-selected={activeAnswerTab === 'community'} className={activeAnswerTab === 'community' ? 'active' : ''} onClick={openCommunityTab}>Community answers</button></div>
                  {activeAnswerTab === 'mine' ? <div className="daily-question-own-answer"><div className="daily-question-own-answer-heading"><strong>Your answer</strong><span>+{question.user_answer.points_awarded} points</span></div><p className="daily-question-selected-choice"><MathRenderer content={(question.options || [])[question.user_answer.selected_option ?? 0] || `Option ${String.fromCharCode(65 + (question.user_answer.selected_option ?? 0))}`} /></p><MathRenderer className="daily-question-answer-rendered" content={question.user_answer.answer_latex} />{question.user_answer.attachment_file_id && <button type="button" className="daily-question-answer-attachment" disabled={downloadingPdf === question.user_answer.id} onClick={() => void downloadAttachment(question.user_answer!.id)}><ArrowDownToLine size={14} /> {downloadingPdf === question.user_answer.id ? 'Downloading…' : 'Download attached PDF'}</button>}</div> : <>
                    {loadingAnswers && answers.length === 0 ? <div className="daily-question-state">Loading community answers…</div> : communityAnswers.length ? <div className="daily-question-community-list">{visibleAnswers.map(answer => <article className="daily-question-community-answer" key={answer.id}><header><strong>{answer.author_name}</strong><time>{new Date(answer.submitted_at).toLocaleString()}</time></header><p className="daily-question-selected-choice"><strong>Selected answer:</strong> <MathRenderer content={(question.options || [])[answer.selected_option ?? 0] || `Option ${String.fromCharCode(65 + (answer.selected_option ?? 0))}`} /></p><MathRenderer className="daily-question-answer-rendered" content={answer.answer_latex} />{answer.attachment_file_id && <button type="button" className="daily-question-answer-attachment" disabled={downloadingPdf === answer.id} onClick={() => void downloadAttachment(answer.id)}><ArrowDownToLine size={14} /> {downloadingPdf === answer.id ? 'Downloading…' : 'Download attached PDF'}</button>}<div className="daily-question-discussion"><h3><MessageCircle size={14} /> Discussion · {answer.comments.length}</h3>{renderCommentThread(answer)}<form onSubmit={event => { event.preventDefault(); void postComment(answer.id); }}><input value={commentDrafts[answer.id] || ''} onChange={event => setCommentDrafts(previous => ({ ...previous, [answer.id]: event.target.value }))} maxLength={2000} placeholder="Add to the discussion…" aria-label={`Comment on ${answer.author_name}'s answer`} /><button type="submit" disabled={!commentDrafts[answer.id]?.trim()} aria-label="Send comment"><Send size={14} /></button></form></div></article>)}</div> : <div className="daily-question-state">No answers yet.</div>}
                    {communityAnswers.length > answersPerPage && <nav className="daily-question-answer-pagination" aria-label="Community answer pages"><button type="button" disabled={communityPage <= 1} onClick={() => setCommunityPage(page => Math.max(1, page - 1))}>Previous</button><span>Page {communityPage} of {totalAnswerPages}</span><button type="button" disabled={communityPage >= totalAnswerPages} onClick={() => setCommunityPage(page => Math.min(totalAnswerPages, page + 1))}>Next</button></nav>}
                  </>}
                </>}
              </aside>
            </section>}
            </div>
          </> : <div className="daily-question-state">No daily question is available yet.</div>}
          {error && <div className="daily-question-error" role="alert">{error}</div>}
        </div>
      </main>
    </div>
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};

const UsersRoundIcon: React.FC = () => <MessageCircle size={15} />;
