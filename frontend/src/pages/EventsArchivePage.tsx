import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Pin, X } from 'lucide-react';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { readStickyNotePreferences, StickyNotePreferences } from '../services/dashboard';
import './DashboardPage.css';
import './EventsArchivePage.css';

interface EventsArchivePageProps { currentUser: UserSummary; onLogout?: () => void; }
interface ArchiveNote { title: string; message: string; date: string; category: string; }

const archiveNotes: ArchiveNote[] = [
  { title: 'Library hours extended', message: 'The central library will stay open later during the mid-semester study period. Keep your student ID ready at the entrance.', date: 'Oct 28, 2026', category: 'Institute notice' },
  { title: 'Astronomy night recap', message: 'The astronomy club hosted an evening skywatch on the south lawn. Thanks to everyone who helped set up the telescopes.', date: 'Oct 24, 2026', category: 'Club event' },
  { title: 'Seminar: life in extreme environments', message: 'A visiting researcher joined the biology seminar series to discuss microbial life in extreme environments.', date: 'Oct 21, 2026', category: 'Academic' },
  { title: 'Campus clean-up day', message: 'Volunteers gathered around the campus trails and gardens for a morning clean-up. Reusable gloves are available from the student office.', date: 'Oct 18, 2026', category: 'Campus event' },
  { title: 'Choir open rehearsal', message: 'The campus choir held an open rehearsal in the auditorium. New singers are welcome at the next practice.', date: 'Oct 15, 2026', category: 'Club event' },
  { title: 'Research poster showcase', message: 'Students presented current projects in the research block foyer. The showcase included work from all four academic divisions.', date: 'Oct 12, 2026', category: 'Academic' },
  { title: 'Sports day highlights', message: 'The inter-house relay and badminton finals wrapped up a full day of campus sport. Congratulations to all participants.', date: 'Oct 9, 2026', category: 'Campus event' },
  { title: 'Debate society: open floor', message: 'The debate society hosted an open floor on technology and public life, followed by an informal discussion.', date: 'Oct 6, 2026', category: 'Club event' },
  { title: 'Water systems maintenance', message: 'Routine maintenance was completed in the east residence block. Normal water service resumed after the scheduled work.', date: 'Oct 3, 2026', category: 'Campus notice' },
  { title: 'Physics colloquium recap', message: 'This week’s colloquium explored new approaches to quantum materials, with time for questions from students afterward.', date: 'Sep 30, 2026', category: 'Academic' },
  { title: 'Film society screening', message: 'The film society screened a student-selected feature in the seminar hall. The next screening poll will be shared soon.', date: 'Sep 27, 2026', category: 'Club event' },
  { title: 'Monsoon garden planting', message: 'The campus garden group added native plants near the main walkway. Students can help with watering during the week.', date: 'Sep 24, 2026', category: 'Campus event' },
  { title: 'Workshop: scientific writing', message: 'The academic skills team ran a practical session on structuring abstracts, presenting results, and editing research drafts.', date: 'Sep 21, 2026', category: 'Academic' },
  { title: 'Board games evening', message: 'The games club brought strategy and cooperative games to the common room for an evening of friendly matches.', date: 'Sep 18, 2026', category: 'Club event' },
  { title: 'Health and wellness desk', message: 'The campus health team hosted a drop-in desk with wellness resources and signposting to student support services.', date: 'Sep 15, 2026', category: 'Campus notice' },
  { title: 'Chemistry demonstration day', message: 'The department welcomed school visitors for a series of hands-on demonstrations in the teaching laboratories.', date: 'Sep 12, 2026', category: 'Academic' },
  { title: 'Photography walk', message: 'The photography club explored campus architecture at golden hour. Members shared a selection of their favorite frames.', date: 'Sep 9, 2026', category: 'Club event' },
  { title: 'Reading room refresh', message: 'New quiet-study seating was added to the reading room. Please keep the area clear of food and return furniture after use.', date: 'Sep 6, 2026', category: 'Institute notice' },
  { title: 'Music jam session', message: 'Students brought acoustic instruments for an informal jam in the arts room. Everyone was welcome to listen or join in.', date: 'Sep 3, 2026', category: 'Campus event' },
  { title: 'Mathematics problem circle', message: 'The weekly problem circle explored elegant approaches to combinatorics. Notes from the session are available from the organizers.', date: 'Aug 31, 2026', category: 'Academic' },
  { title: 'Volunteering orientation', message: 'The outreach group welcomed new volunteers and shared upcoming opportunities to support local science activities.', date: 'Aug 28, 2026', category: 'Club event' },
  { title: 'Welcome week picnic', message: 'Students gathered on the central lawn to meet classmates and explore clubs during the welcome week picnic.', date: 'Aug 25, 2026', category: 'Campus event' },
  { title: 'Computer lab update', message: 'Scheduled software updates were completed in the shared computer lab. Please report any remaining access issues to IT support.', date: 'Aug 22, 2026', category: 'Institute notice' },
  { title: 'Ecology field walk', message: 'The ecology group led a guided walk through the campus green spaces and recorded seasonal observations.', date: 'Aug 19, 2026', category: 'Academic' },
  { title: 'Quiz club finals', message: 'The term quiz finals brought together teams from across campus for a fast-paced evening of general knowledge rounds.', date: 'Aug 16, 2026', category: 'Club event' },
  { title: 'Cultural evening', message: 'Student performers shared music, dance, and short readings in a campus cultural evening celebrating many traditions.', date: 'Aug 13, 2026', category: 'Campus event' },
  { title: 'Library book return reminder', message: 'Please return borrowed books by their due date so other students can access course and reference materials.', date: 'Aug 10, 2026', category: 'Institute notice' },
  { title: 'Data science guest lecture', message: 'A guest lecture introduced practical methods for working with scientific datasets and communicating uncertainty.', date: 'Aug 7, 2026', category: 'Academic' },
  { title: 'Badminton club meetup', message: 'The badminton club held a relaxed doubles meetup at the indoor court. Beginners and experienced players joined in.', date: 'Aug 4, 2026', category: 'Club event' },
  { title: 'Campus orientation trail', message: 'New students followed a guided route between key campus spaces and learned where to find everyday support.', date: 'Aug 1, 2026', category: 'Campus event' },
  { title: 'Open lab afternoon', message: 'Research groups welcomed students to visit selected labs, learn about current projects, and ask questions about research pathways.', date: 'Jul 29, 2026', category: 'Academic' },
  { title: 'Student magazine callout', message: 'The editorial club invited writing, illustration, and photography submissions for the upcoming student magazine issue.', date: 'Jul 26, 2026', category: 'Club event' },
];

export const EventsArchivePage: React.FC<EventsArchivePageProps> = ({ currentUser, onLogout }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [preferences, setPreferences] = useState<StickyNotePreferences>(() => readStickyNotePreferences(currentUser.id));
  const [gridSize, setGridSize] = useState({ columns: 4, rows: 4 });
  const [openNote, setOpenNote] = useState<ArchiveNote | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const refreshPreferences = () => setPreferences(readStickyNotePreferences(currentUser.id));
    window.addEventListener('nexus-dashboard-sticky-notes-updated', refreshPreferences);
    return () => window.removeEventListener('nexus-dashboard-sticky-notes-updated', refreshPreferences);
  }, [currentUser.id]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const resizeObserver = new ResizeObserver(() => {
      const style = window.getComputedStyle(board);
      const innerWidth = board.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const innerHeight = board.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const columnGap = parseFloat(style.columnGap) || 18;
      const rowGap = parseFloat(style.rowGap) || 16;
      const minNoteWidth = window.matchMedia('(max-width: 720px)').matches ? 145 : 165;
      const columns = Math.max(1, Math.floor((innerWidth + columnGap) / (minNoteWidth + columnGap)));
      const rows = Math.max(1, Math.floor((innerHeight + rowGap) / (150 + rowGap)));
      setGridSize(previous => previous.columns === columns && previous.rows === rows ? previous : { columns, rows });
    });
    resizeObserver.observe(board);
    return () => resizeObserver.disconnect();
  }, []);

  const closeNote = () => {
    if (!openNote || closing) return;
    setClosing(true);
    window.setTimeout(() => { setOpenNote(null); setClosing(false); }, 250);
  };

  return <div className="events-archive-layout">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="events-archive-shell">
      <TopHeader breadcrumb="Workspace / All events" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="events-archive-main">
        <header className="events-archive-heading">
          <div><span className="dashboard-eyebrow">CAMPUS NOTICEBOARD</span><h1>All events</h1><p>A sample archive of past campus notes. Select any note to read it.</p></div>
          <Link to="/dashboard" className="events-archive-back"><ArrowLeft size={14} /> Dashboard</Link>
        </header>
        <div ref={boardRef} className={`events-archive-board dashboard-sticky-board dashboard-sticky-${preferences.palette}${preferences.sway ? ' has-sway' : ''}${preferences.angle === 'straight' ? ' straight' : ''}`} style={{ gridTemplateColumns: `repeat(${gridSize.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${gridSize.rows}, minmax(0, 1fr))` }} aria-label="Past campus sticky notes">
          {archiveNotes.slice(0, gridSize.columns * gridSize.rows).map((note, index) => <button type="button" key={note.title} className={`dashboard-sticky-note${index % 2 ? ' note-tilt-alt' : ''}`} onClick={() => setOpenNote(note)} aria-label={`Open archived note: ${note.title}`}>
            <span className="dashboard-sticky-pin"><Pin size={13} fill="currentColor" /></span>
            <span className="dashboard-sticky-note-title">{note.title}</span>
            <span className="dashboard-sticky-demo-tag">SAMPLE · ARCHIVE</span>
            <span className="events-archive-category">{note.category}</span>
            <span className="dashboard-sticky-note-message">{note.message}</span>
            <span className="dashboard-sticky-note-detail">Released {note.date}</span>
            <span className="dashboard-sticky-fold" />
          </button>)}
        </div>
      </main>
    </div>
    {openNote && <div className={`dashboard-modal-backdrop dashboard-sticky-backdrop${closing ? ' closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeNote(); }}>
      <section className={`dashboard-sticky-dialog dashboard-sticky-${preferences.palette}`} role="dialog" aria-modal="true" aria-labelledby="events-archive-note-title">
        <header><div><span className="dashboard-sticky-dialog-kicker">SAMPLE ARCHIVED NOTE · {openNote.category.toUpperCase()}</span><h2 id="events-archive-note-title">{openNote.title}</h2><small>Released {openNote.date}</small></div><button type="button" onClick={closeNote} aria-label="Close note"><X size={18} /></button></header>
        <div className="dashboard-sticky-dialog-content">{openNote.message}</div>
        <footer><button type="button" onClick={closeNote}>Close note</button></footer>
      </section>
    </div>}
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};
