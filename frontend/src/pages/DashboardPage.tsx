import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BellRing, BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, History, ListTodo, MessageCircle, Sparkles, UsersRound, X, Pin } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { UploadResourceModal } from '../components/UploadResourceModal';
import { DailyQuestionRecord, DailyQuestionTemplate } from '../components/DailyQuestionTemplate';
import { DashboardHistoryEntry, DashboardPreferences, DASHBOARD_HISTORY_EVENT, readDashboardHistory, readDashboardPreferences, readDashboardSessionHistory, readPersonalTimetable, writeDashboardPreferences, readStickyNotePreferences, StickyNotePreferences } from '../services/dashboard';
import './DashboardPage.css';

interface DashboardPageProps { currentUser: UserSummary; onLogout: () => void; }
type EventRecord = { id?: string; title?: string; description?: string; category?: string; event_type?: string; start_time?: string; end_time?: string; location?: string; priority?: string; is_important?: boolean };
type TaskRecord = { id: string; title: string; is_completed?: boolean; due_date?: string; priority?: string };
type NoticeRecord = { id?: string; title?: string; content?: string; notification_type?: string; created_at?: string; link?: string; is_read?: boolean };
type StickyDashboardNote = { id: string; title: string; message: string; detail: string; important: boolean; demo?: boolean };

const stickyDemoNotes: StickyDashboardNote[] = import.meta.env.DEV ? [
  {
    id: 'sticky-demo-long', title: 'DEMO · Long institute announcement', detail: 'Sample content · for layout testing', important: true, demo: true,
    message: 'This is a sample sticky note for testing the dashboard layout and full-message popup. The institute library will extend its evening hours during the mid-semester study period, with the reading rooms remaining open until 1:00 AM from Monday through Friday. Students should keep their institute identification cards ready at the entrance, return borrowed books to the marked desk before closing, and leave the quiet-study areas clear for the next group. The second floor will be reserved for silent study, while the collaboration rooms can be used for group work when booked in advance. If you notice a problem with the lighting, network access, or room equipment, please contact the library desk so staff can help. This deliberately long message checks how paragraphs wrap on the note, whether the popup scrolls smoothly, and whether the complete text remains readable without spilling outside the dashboard card.',
  },
  {
    id: 'sticky-demo-campus', title: 'DEMO · Campus reminder', detail: 'Sample content · for layout testing', important: false, demo: true,
    message: 'A second sample note helps check the folded corner, pin, alternate tilt, and spacing between notes. Click this note to open the full message, then close it to see the return recoil.',
  },
] : [];

const eventDate = (value?: string) => value ? new Date(value) : null;
const formatEventDate = (value?: string) => {
  const date = eventDate(value);
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date) : 'Time to be announced';
};
const routeFor = (path: string) => path.startsWith('/profile') ? '/dashboard' : path;

export const DashboardPage: React.FC<DashboardPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => readDashboardPreferences(currentUser.id));
  const [history, setHistory] = useState<DashboardHistoryEntry[]>([]);
  const [sessionHistory, setSessionHistory] = useState<DashboardHistoryEntry[]>([]);
  const [campusEvents, setCampusEvents] = useState<EventRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<EventRecord[]>([]);
  const [dailyQuestion, setDailyQuestion] = useState<DailyQuestionRecord | null>(null);
  const [notifications, setNotifications] = useState<NoticeRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskDraft, setTaskDraft] = useState('');
  const [clubSetupOpen, setClubSetupOpen] = useState(false);
  const [clubDraft, setClubDraft] = useState(() => preferences.clubs.join(', '));
  const [feedError, setFeedError] = useState('');
  const [dashboardView, setDashboardView] = useState<'overview' | 'extras'>('overview');
  const [eventScope, setEventScope] = useState<'institute' | 'clubs' | 'all'>('institute');
  const [stickyPreferences, setStickyPreferences] = useState<StickyNotePreferences>(() => readStickyNotePreferences(currentUser.id));
  const [openSticky, setOpenSticky] = useState<{ title: string; message: string; detail: string; important: boolean } | null>(null);
  const [stickyClosing, setStickyClosing] = useState(false);
  const navigate = useNavigate();

  const displayName = currentUser.display_name || currentUser.full_name || currentUser.username || 'Student';

  const refreshHistory = () => {
    setHistory(readDashboardHistory(currentUser.id));
    setSessionHistory(readDashboardSessionHistory(currentUser.id));
  };

  useEffect(() => {
    const refreshPreferences = () => setPreferences(readDashboardPreferences(currentUser.id));
    const refreshStickyPreferences = () => setStickyPreferences(readStickyNotePreferences(currentUser.id));
    refreshPreferences();
    const refresh = () => refreshHistory();
    refresh();
    window.addEventListener(DASHBOARD_HISTORY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('nexus-dashboard-preferences-updated', refreshPreferences);
    window.addEventListener('nexus-dashboard-sticky-notes-updated', refreshStickyPreferences);
    const wasAsked = localStorage.getItem(`nexus-dashboard-clubs-asked-v1-${currentUser.id}`) === 'true';
    if (!wasAsked) setClubSetupOpen(true);
    return () => {
      window.removeEventListener(DASHBOARD_HISTORY_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('nexus-dashboard-preferences-updated', refreshPreferences);
      window.removeEventListener('nexus-dashboard-sticky-notes-updated', refreshStickyPreferences);
    };
  }, [currentUser.id]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.listCampusEvents(), api.listCalendarEvents(), api.getDailyQuestion(), api.listNotifications()]).then(results => {
      if (!active) return;
      if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) setCampusEvents(results[0].value);
      if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) setCalendarEvents(results[1].value);
      if (results[2].status === 'fulfilled') setDailyQuestion(results[2].value);
      if (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) setNotifications(results[3].value);
      if (results.slice(0, 3).every(result => result.status === 'rejected')) setFeedError('Campus feeds are unavailable right now.');
    });
    return () => { active = false; };
  }, [currentUser.id]);

  useEffect(() => {
    if (!preferences.widgets.todo) return;
    let active = true;
    api.listTasks().then(result => { if (active && Array.isArray(result)) setTasks(result); }).catch(() => { if (active) setFeedError('Your task list could not be loaded.'); });
    return () => { active = false; };
  }, [currentUser.id, preferences.widgets.todo]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    const rows = [...campusEvents, ...calendarEvents].filter(event => {
      const date = eventDate(event.start_time);
      return !date || date.getTime() >= now - 60 * 60 * 1000;
    });
    const unique = new Map<string, EventRecord>();
    rows.forEach((event, index) => unique.set(event.id || `${event.title}-${event.start_time}-${index}`, event));
    return [...unique.values()].sort((a, b) => (eventDate(a.start_time)?.getTime() || Infinity) - (eventDate(b.start_time)?.getTime() || Infinity));
  }, [campusEvents, calendarEvents]);

  const academicEvents = upcomingEvents.filter(event => /academic|lecture|lab|exam|deadline|seminar|institute|official/i.test(`${event.category || ''} ${event.event_type || ''}`));
  const clubEvents = upcomingEvents.filter(event => preferences.clubs.some(club => `${event.category || ''} ${event.title || ''} ${event.description || ''}`.toLowerCase().includes(club.toLowerCase())));
  const officialNotices = notifications.filter(item => ['system_announcement', 'course_announcement', 'event_reminder', 'assignment_deadline'].includes(item.notification_type || ''));
  const clubNotices = notifications.filter(item => preferences.clubs.some(club => `${item.title || ''} ${item.content || ''}`.toLowerCase().includes(club.toLowerCase())));
  const currentSessionId = sessionHistory[0]?.sessionId;
  const studyEntries = history.filter(entry => entry.kind === 'upload' || (entry.kind === 'page' && ['/courses', '/repository', '/studygroups', '/latex', '/ai'].includes(entry.path.split('?')[0])));
  const previousStudyEntry = (currentSessionId ? studyEntries.find(entry => entry.sessionId !== currentSessionId) : studyEntries[0]) || studyEntries[0];
  const recentEntries = history.filter(entry => entry.path !== '/dashboard').slice(0, 3);
  const uploadedEntries = history.filter(entry => entry.kind === 'upload').slice(0, 3);
  const timetable = readPersonalTimetable(currentUser.id);
  const exams = upcomingEvents.filter(event => /exam|deadline/i.test(`${event.category || ''} ${event.event_type || ''} ${event.title || ''}`));
  const stickyNotesForView: StickyDashboardNote[] = eventScope === 'institute' ? [
    ...academicEvents.slice(0, 2).map((event, index) => ({ id: event.id || `${event.title}-${index}`, title: event.title || 'Campus event', message: event.description || event.title || 'Campus event', detail: `${formatEventDate(event.start_time)}${event.location ? ` · ${event.location}` : ''}`, important: !!event.is_important || /urgent|important/i.test(event.priority || '') })),
    ...officialNotices.slice(0, 2).map((notice, index) => ({ id: notice.id || `notice-${index}`, title: notice.title || 'Academic notice', message: notice.content || notice.title || 'Open notifications for details.', detail: notice.created_at ? new Date(notice.created_at).toLocaleString() : 'Institute notice', important: /lecture|schedule|change|cancel|urgent|important/i.test(`${notice.title || ''} ${notice.content || ''}`) })),
    ...stickyDemoNotes,
  ] : eventScope === 'all' ? [
    ...upcomingEvents.slice(0, 4).map((event, index) => ({ id: event.id || `${event.title}-${index}`, title: event.title || event.category || 'Campus event', message: event.description || event.title || 'Campus event', detail: `${event.category || event.event_type || 'Campus event'} · ${formatEventDate(event.start_time)}${event.location ? ` · ${event.location}` : ''}`, important: !!event.is_important || /urgent|important/i.test(event.priority || '') })),
    ...stickyDemoNotes,
  ] : [];

  const clubActivityItems = [
    ...clubEvents.slice(0, 3).map((event, index) => ({ id: event.id || `${event.title}-${index}`, title: event.title || event.category || 'Club event', message: event.description || event.title || 'Club event', detail: `${event.category || 'Campus club'} · ${formatEventDate(event.start_time)}`, important: !!event.is_important })),
    ...clubNotices.slice(0, 3).map((notice, index) => ({ id: notice.id || `club-notice-${index}`, title: notice.title || 'Club update', message: notice.content || notice.title || 'Club notification', detail: notice.created_at ? new Date(notice.created_at).toLocaleString() : 'Club notification', important: false })),
  ].slice(0, 4);

  const openClubPreferences = () => {
    setClubDraft(preferences.clubs.join(', '));
    setClubSetupOpen(true);
  };

  const saveClubPreferences = () => {
    const clubs = [...new Set(clubDraft.split(/[,\n]/).map(value => value.trim()).filter(Boolean))].slice(0, 30);
    const next = { ...preferences, clubs };
    setPreferences(next);
    writeDashboardPreferences(currentUser.id, next);
    localStorage.setItem(`nexus-dashboard-clubs-asked-v1-${currentUser.id}`, 'true');
    setClubSetupOpen(false);
  };

  const dismissClubSetup = () => {
    localStorage.setItem(`nexus-dashboard-clubs-asked-v1-${currentUser.id}`, 'true');
    setClubSetupOpen(false);
  };

  const addTask = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = taskDraft.trim();
    if (!title) return;
    try {
      const task = await api.createTask({ title, priority: 'medium' });
      setTasks(current => [task, ...current]);
      setTaskDraft('');
    } catch { setFeedError('Could not save that task. Try again from Productivity.'); }
  };

  const toggleTask = async (task: TaskRecord) => {
    try {
      await api.toggleTask(task.id);
      setTasks(current => current.map(item => item.id === task.id ? { ...item, is_completed: !item.is_completed } : item));
    } catch { setFeedError('Could not update that task.'); }
  };

  const closeSticky = () => {
    if (!openSticky || stickyClosing) return;
    setStickyClosing(true);
    window.setTimeout(() => { setOpenSticky(null); setStickyClosing(false); }, 250);
  };

  const card = (id: string, title: string, subtitle: string, icon: React.ReactNode, action?: React.ReactNode, className = '') => (
    <section className={`dashboard-card ${className}`} data-dashboard-widget={id} key={id}>
      <header className="dashboard-card-heading"><div className="dashboard-card-title"><span className="dashboard-card-icon">{icon}</span><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{action}</header>
      {id === 'events' ? <div className={`dashboard-event-tabs dashboard-sticky-board dashboard-sticky-${stickyPreferences.palette}${stickyPreferences.sway ? ' has-sway' : ''}`}>
        <div className="dashboard-segmented"><button type="button" className={eventScope === 'institute' ? 'active' : ''} aria-pressed={eventScope === 'institute'} onClick={() => setEventScope('institute')}>Institute</button><button type="button" className={eventScope === 'clubs' ? 'active' : ''} aria-pressed={eventScope === 'clubs'} onClick={() => setEventScope('clubs')}>Clubs</button><button type="button" onClick={() => navigate('/events/archive')}>All events</button></div>
        {eventScope === 'clubs' ? <section className="dashboard-club-tab-content"><header><div><h3>Club activities</h3><p>{preferences.clubs.length ? `Following ${preferences.clubs.join(' · ')}` : 'Choose clubs to personalize this activity feed.'}</p></div><button type="button" onClick={openClubPreferences}>{preferences.clubs.length ? 'Edit clubs' : 'Choose clubs'}</button></header>{clubActivityItems.length ? <div className="dashboard-club-tab-list">{clubActivityItems.map(item => <button type="button" key={item.id} onClick={() => setOpenSticky({ title: item.title, message: item.message, detail: item.detail, important: item.important })}><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={15} /></button>)}</div> : <div className="dashboard-empty"><p>{preferences.clubs.length ? 'No matching club activity is available right now.' : 'Follow clubs to see their events and notices here.'}</p><button type="button" onClick={openClubPreferences}>Set club preferences <ArrowRight size={13} /></button></div>}</section> : <>
        <div className={`dashboard-sticky-notes ${stickyPreferences.angle === 'straight' ? 'straight' : ''}`}>
          {stickyNotesForView.slice(0, 4).map((note, index) => <button type="button" key={note.id} className={`dashboard-sticky-note ${index % 2 ? 'note-tilt-alt' : ''}`} onClick={() => setOpenSticky({ title: note.title, message: note.message, detail: note.detail, important: note.important })} aria-label={`Open message: ${note.title}`}>
            <span className="dashboard-sticky-pin"><Pin size={13} fill="currentColor" /></span><span className="dashboard-sticky-note-title">{note.title}</span>{note.demo && <span className="dashboard-sticky-demo-tag">TEST DATA</span>}{note.important && <span className="dashboard-important-tag">IMPORTANT</span>}<span className="dashboard-sticky-note-message">{note.message}</span><span className="dashboard-sticky-note-detail">{note.detail}</span><span className="dashboard-sticky-fold" />
          </button>)}
          {!stickyNotesForView.length && <div className="dashboard-empty"><p>{feedError || (eventScope === 'institute' ? 'No upcoming institute messages are available.' : 'No upcoming campus events are available.')}</p><Link to="/campus?tab=events">Open campus calendar <ArrowRight size={13} /></Link></div>}
        </div>
        <div className="dashboard-source-note">Messages from campus calendar and academic notifications · Select a note to read it</div>
        </>}
      </div> : id === 'clubs' ? <div className="dashboard-list">
        {!preferences.clubs.length ? <div className="dashboard-empty"><p>Choose clubs to personalize this list.</p><button type="button" onClick={() => navigate('/settings')}>Set preferences <ArrowRight size={13} /></button></div> : clubEvents.length || clubNotices.length ? [...clubEvents.slice(0, 2).map((event, index) => ({ id: event.id || `${event.title}-${index}`, title: event.title || event.category || 'Club event', detail: `${event.category || 'Campus club'} · ${formatEventDate(event.start_time)}` })), ...clubNotices.slice(0, 2).map((notice, index) => ({ id: notice.id || `notice-${index}`, title: notice.title || 'Club update', detail: notice.content || 'Club notification' }))].slice(0, 3).map(item => <article className="dashboard-event-row" key={item.id}><span className="dashboard-event-date club"><UsersRound size={15} /></span><div className="dashboard-event-copy"><strong>{item.title}</strong><small>{item.detail}</small></div></article>) : <div className="dashboard-empty"><p>No matching club events or notifications were returned by the campus feeds.</p><Link to="/campus?tab=events">Browse campus events <ArrowRight size={13} /></Link></div>}
        {preferences.clubs.length > 0 && <div className="dashboard-club-following">Following {preferences.clubs.slice(0, 3).join(' · ')}{preferences.clubs.length > 3 ? ` +${preferences.clubs.length - 3}` : ''}</div>}
      </div> : id === 'question' ? <div className="dashboard-question-spotlight"><DailyQuestionTemplate question={dailyQuestion} onActivate={() => navigate('/qotd')} /><Link to="/qotd">View today’s question <ArrowRight size={14} /></Link></div> : id === 'history' ? <div className="dashboard-history-list compact">
        {recentEntries.length ? recentEntries.map(entry => <Link className="dashboard-history-row" to={routeFor(entry.path)} key={entry.id}><span className="dashboard-history-icon">{entry.kind === 'upload' ? <FileText size={16} /> : <History size={16} />}</span><span className="dashboard-history-info"><strong>{entry.title}</strong><small>{new Date(entry.visitedAt).toLocaleString()}</small></span></Link>) : <div className="dashboard-empty"><p>Your visits will appear here as you explore NEXUS.</p></div>}
        <Link className="dashboard-card-link" to="/history">View all history <ArrowRight size={14} /></Link>
      </div> : id === 'continue' ? previousStudyEntry ? <Link className="dashboard-continue-card" to={routeFor(previousStudyEntry.path)}><span className="dashboard-continue-icon"><BookOpen size={20} /></span><span><small>Pick up where you left off</small><strong>{previousStudyEntry.title}</strong><small>{previousStudyEntry.kind === 'upload' ? 'Uploaded resource' : 'Last visited study page'} · {new Date(previousStudyEntry.visitedAt).toLocaleDateString()}</small></span><ArrowRight size={17} /></Link> : <div className="dashboard-empty"><p>Open a course, resource, or study tool and it will appear here next time.</p><Link to="/courses">Browse courses <ArrowRight size={13} /></Link></div> : id === 'timetable' ? timetable ? <div className="dashboard-timetable"><div><CalendarDays size={18} /><strong>{timetable.name}</strong></div><a href={timetable.dataUrl} target="_blank" rel="noreferrer">Open timetable <ArrowRight size={14} /></a><Link to="/settings">Manage in Dashboard settings</Link></div> : <div className="dashboard-empty"><p>Upload your timetable from Dashboard settings to see it here.</p><Link to="/settings">Open settings <ArrowRight size={13} /></Link></div> : id === 'exams' ? exams.length ? exams.slice(0, 3).map((event, index) => <article className="dashboard-event-row" key={event.id || index}><span className="dashboard-event-date exam"><Clock3 size={15} /></span><div className="dashboard-event-copy"><strong>{event.title}</strong><small>{formatEventDate(event.start_time)}</small></div><span className="dashboard-important-tag">{/exam/i.test(`${event.title} ${event.category} ${event.event_type}`) ? 'EXAM' : 'DUE'}</span></article>) : <div className="dashboard-empty"><p>No exams or deadlines are listed in your calendar.</p><Link to="/courses">View courses <ArrowRight size={13} /></Link></div> : id === 'todo' ? <div className="dashboard-list"><form className="dashboard-task-form" onSubmit={addTask}><input value={taskDraft} onChange={event => setTaskDraft(event.target.value)} maxLength={255} placeholder="Add a task" aria-label="Add a task" /><button type="submit" disabled={!taskDraft.trim()}>Add</button></form>{tasks.slice(0, 4).map(task => <label className={`dashboard-task-row${task.is_completed ? ' done' : ''}`} key={task.id}><input type="checkbox" checked={!!task.is_completed} onChange={() => void toggleTask(task)} /><span>{task.title}</span>{task.due_date && <small>{formatEventDate(task.due_date)}</small>}</label>)}{!tasks.length && <div className="dashboard-empty"><p>No tasks yet.</p><Link to="/productivity">Open Productivity <ArrowRight size={13} /></Link></div>}</div> : id === 'messages' ? <div className="dashboard-empty"><MessageCircle size={18} /><p>Open your inbox to catch up on conversations.</p><Link to="/messaging">Go to Messenger <ArrowRight size={13} /></Link></div> : id === 'announcements' ? officialNotices.length ? officialNotices.slice(0, 3).map((notice, index) => <article className="dashboard-event-row" key={notice.id || index}><span className="dashboard-event-date"><BellRing size={15} /></span><div className="dashboard-event-copy"><strong>{notice.title || 'Campus notice'}</strong><small>{notice.content || 'Open notifications for details.'}</small></div>{/system_announcement|course_announcement/.test(notice.notification_type || '') && <span className="dashboard-important-tag">NOTICE</span>}</article>) : <div className="dashboard-empty"><BellRing size={18} /><p>No official or academic notices are in your notifications.</p><Link to="/notifications">Open notifications <ArrowRight size={13} /></Link></div> : <div className="dashboard-list">{uploadedEntries.length ? uploadedEntries.map(entry => <Link className="dashboard-history-row" to={routeFor(entry.path)} key={entry.id}><span className="dashboard-history-icon"><FileText size={16} /></span><span className="dashboard-history-info"><strong>{entry.title.replace(/^Uploaded: /, '')}</strong><small>{new Date(entry.visitedAt).toLocaleString()}</small></span></Link>) : <div className="dashboard-empty"><p>Your successful uploads will appear here.</p><Link to="/repository">Visit repository <ArrowRight size={13} /></Link></div>}</div>}
    </section>
  );

  const widgets = preferences.widgets;
  const hasDashboardExtras = widgets.timetable || widgets.exams || widgets.todo || widgets.messages || widgets.announcements || widgets.uploads;
  return <div className="dashboard-page">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="dashboard-shell"><TopHeader breadcrumb="Workspace / Dashboard" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} onOpenUpload={() => setUploadOpen(true)} />
      <main className="dashboard-main">
        <div className="dashboard-welcome"><div><span className="dashboard-eyebrow">YOUR CAMPUS, IN ONE PLACE</span><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {displayName.split(' ')[0]}.</h1><p>Here’s what’s coming up and where you left off.</p></div><Link className="dashboard-settings-link" to="/settings"><ListTodo size={15} /> Customize dashboard</Link></div>
        {feedError && <p className="dashboard-inline-status" role="status">{feedError}</p>}
        {hasDashboardExtras && <div className="dashboard-view-tabs" role="tablist" aria-label="Dashboard views"><button type="button" role="tab" aria-selected={dashboardView === 'overview'} className={dashboardView === 'overview' ? 'active' : ''} onClick={() => setDashboardView('overview')}>Overview</button><button type="button" role="tab" aria-selected={dashboardView === 'extras'} className={dashboardView === 'extras' ? 'active' : ''} onClick={() => setDashboardView('extras')}>My extras</button></div>}
        {dashboardView === 'overview' ? <div className="dashboard-columns">
          <div className="dashboard-primary-column">
            {widgets.events && card('events', 'Institute & academic', 'Lectures, campus events, and schedule updates', <CalendarDays size={17} />, <Link to="/campus?tab=events" className="dashboard-card-link">Calendar <ArrowRight size={13} /></Link>, `dashboard-events-card dashboard-events-view-${eventScope}`)}
            {widgets.question && card('question', 'Question of the Day', 'A little challenge for today', <Sparkles size={17} />, <Link to="/qotd" className="dashboard-card-link">QOTD <ArrowRight size={13} /></Link>, 'dashboard-question-card')}
          </div>
          <div className="dashboard-secondary-column">
            {widgets.history && card('history', 'Recently visited', 'Your activity stays available across sessions', <History size={17} />, <Link to="/history" className="dashboard-card-link">Full history <ArrowRight size={13} /></Link>, 'dashboard-history-widget')}
            {widgets.continue && card('continue', 'Continue studying', 'Return to a page from your last study session', <BookOpen size={17} />, undefined, 'dashboard-continue-widget')}
          </div>
        </div> : <div className="dashboard-extras-grid">
          {widgets.timetable && card('timetable', 'My timetable', 'Your personal semester schedule', <CalendarDays size={17} />, <Link to="/settings" className="dashboard-card-link">Manage <ArrowRight size={13} /></Link>, 'dashboard-timetable-widget')}
          {widgets.exams && card('exams', 'Exams & deadlines', 'From your calendar and campus schedule', <Clock3 size={17} />, <Link to="/courses" className="dashboard-card-link">Courses <ArrowRight size={13} /></Link>, 'dashboard-exams-widget')}
          {widgets.todo && card('todo', 'My to-do', 'Add a quick task or check one off', <CheckCircle2 size={17} />, <Link to="/productivity" className="dashboard-card-link">All tasks <ArrowRight size={13} /></Link>, 'dashboard-todo-widget')}
          {widgets.messages && card('messages', 'Messages', 'A shortcut to your conversations', <MessageCircle size={17} />, <Link to="/messaging" className="dashboard-card-link">Inbox <ArrowRight size={13} /></Link>, 'dashboard-messages-widget')}
          {widgets.announcements && card('announcements', 'Campus notices', 'Official notices and lecture changes', <BellRing size={17} />, <Link to="/campus" className="dashboard-card-link">Campus <ArrowRight size={13} /></Link>, 'dashboard-announcements-widget')}
          {widgets.uploads && card('uploads', 'Recent uploads', 'Resources you added to NEXUS', <FileText size={17} />, <button type="button" className="dashboard-card-link" onClick={() => setUploadOpen(true)}>Upload <ArrowRight size={13} /></button>, 'dashboard-uploads-widget')}
        </div>}
      </main>
    </div>
    {openSticky && <div className={`dashboard-modal-backdrop dashboard-sticky-backdrop${stickyClosing ? ' closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeSticky(); }}><section className={`dashboard-sticky-dialog dashboard-sticky-${stickyPreferences.palette}`} role="dialog" aria-modal="true" aria-labelledby="dashboard-sticky-dialog-title"><header><div><span className="dashboard-sticky-dialog-kicker">{openSticky.important ? 'IMPORTANT INSTITUTE MESSAGE' : 'CAMPUS MESSAGE'}</span><h2 id="dashboard-sticky-dialog-title">{openSticky.title}</h2><small>{openSticky.detail}</small></div><button type="button" onClick={closeSticky} aria-label="Close message"><X size={18} /></button></header><div className="dashboard-sticky-dialog-content">{openSticky.message}</div><footer><button type="button" onClick={closeSticky}>Close note</button></footer></section></div>}
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    <UploadResourceModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} onUploadSuccess={refreshHistory} currentUserId={currentUser.id} />
    {clubSetupOpen && <div className="dashboard-modal-backdrop" role="presentation"><section className="dashboard-club-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-club-modal-title"><span className="dashboard-card-icon"><UsersRound size={20} /></span><h2 id="dashboard-club-modal-title">What clubs should we keep up with?</h2><p>Add the clubs and activities you’re interested in. You can change this later from Settings → Dashboard.</p><label>Club names<textarea value={clubDraft} onChange={event => setClubDraft(event.target.value)} rows={3} placeholder="e.g. Astronomy Club, Football, Debate Society" /></label><div><button type="button" className="dashboard-secondary-button" onClick={dismissClubSetup}>Skip for now</button><button type="button" className="dashboard-primary-button" onClick={saveClubPreferences}>Save preferences</button></div></section></div>}
  </div>;
};
