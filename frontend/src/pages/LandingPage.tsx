import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import './LandingMotion.css';

const ASSET_ROOT = '/assets/nexus-figma/';
const asset = (name: string, ext: 'svg' | 'png' = 'svg') => `${ASSET_ROOT}landing_${name}.${ext}`;

const MASKS = {
  wordmark: asset('imgPurpleEmeraldRightToLeftColorCycle'),
  home: asset('imgHomeRightToLeftColorCycle'),
  features: asset('imgFeaturesRightToLeftColorCycle'),
  community: asset('imgCommunityRightToLeftColorCycle'),
  about: asset('imgAboutRightToLeftColorCycle'),
};

const featureGroups = [
  {
    title: 'Academic Resources',
    description: 'Access notes, previous papers, presentations and shared study materials.',
    bullet: '29:4',
    flame: '29:731',
    reveal: '29:865',
  },
  {
    title: 'Student Community',
    description: 'Connect with classmates, make friends and communicate through personal and group chats.',
    bullet: '29:6',
    flame: '29:748',
    reveal: '29:881',
  },
  {
    title: 'Collaborative Learning',
    description: 'Discuss problems, exchange knowledge, join study groups and participate in daily QOTD/AOTD.',
    bullet: '29:8',
    flame: '29:765',
    reveal: '29:897',
  },
  {
    title: 'Campus Updates',
    description: 'Discover events, workshops, announcements, Lost & Found and exciting opportunities.',
    bullet: '29:10',
    flame: '29:782',
    reveal: '29:913',
  },
  {
    title: 'Student Productivity',
    description: 'Organise assignments, timetables, deadlines, personal notes and study schedules.',
    bullet: '29:12',
    flame: '29:799',
    reveal: '29:929',
  },
  {
    title: 'AI Study Companion',
    description: 'Get help understanding concepts, exploring study materials and summarising academic documents.',
    bullet: '29:14',
    flame: '29:816',
    reveal: '29:945',
  },
];

const everydayTools = [
  { icon: 'imgFolderOpen', title: 'A shared academic memory', description: 'Good notes shouldn’t disappear after a semester. Find material by course, topic and batch.', meta: '2,400+ resources · Student curated', href: '/repository' },
  { icon: 'imgMessagesSquare', title: 'Your people, closer', description: 'Find a lab partner, untangle a problem set, or just ask who’s heading to the mess.', meta: 'Friends · Messages · Study groups', href: '/messaging' },
  { icon: 'imgCalendarDays', title: 'Never miss the good stuff', description: 'Seminars, stargazing, internships and everything happening beyond your timetable.', meta: 'Events · Campus Pulse · Opportunities', href: '/campus?tab=events' },
  { icon: 'imgCircleCheck', title: 'A little structure. A lot of calm.', description: 'Timetables, deadlines and focused study sessions. Built around the way students actually work.', meta: 'Tasks · Timetable · Focus timer', href: '/productivity' },
];

const rayData = [
  { id: '15:15393', file: 'imgRay1', inset: '27% 50.25% 5% 2%', origin: '100.524% 1.471%' },
  { id: '15:15397', file: 'imgRay2', inset: '30% 49.75% 1% 11.5%', origin: '99.355% -2.899%' },
  { id: '15:15401', file: 'imgRay3', inset: '29% 7.75% 1% 50.75%', origin: '-1.807% -1.429%' },
  { id: '15:15405', file: 'imgRay4', inset: '13% 1.5% 35% 52%', origin: '-4.301% 28.846%' },
  { id: '15:15409', file: 'imgRay5', inset: '26% 50.75% 33% 3.25%', origin: '101.63% 4.878%' },
  { id: '15:15413', file: 'imgRay6', inset: '30% 12.75% 1% 50.75%', origin: '-2.055% -2.899%' },
  { id: '15:15417', file: 'imgRay7', inset: '27% 5% 6% 51.25%', origin: '-2.857% 1.493%' },
  { id: '15:15421', file: 'imgRay8', inset: '32% 50.25% 2% 22%', origin: '100.901% -6.061%' },
];

const glitterData = [
  { id: '15:15475', file: 'imgGlitter1', inset: '4.35% 53.64% 74.6% 36.36%' },
  { id: '15:15482', file: 'imgGlitter2', inset: '3.35% 36.62% 79% 53.34%' },
  { id: '15:15489', file: 'imgGlitter3', inset: '23% 56.13% 52.55% 25.39%' },
  { id: '15:15496', file: 'imgGlitter4', inset: '22% 27.14% 52.6% 55.86%' },
  { id: '15:15503', file: 'imgGlitter5', inset: '55.4% 63.6% 14.55% 15.39%' },
  { id: '15:15509', file: 'imgGlitter6', inset: '53.5% 14.13% 12.55% 65.14%' },
];

const faqs = [
  {
    question: 'Who can join NEXUS?',
    answer: 'Current IISER Tirupati students with a verified institute student email. This is your campus space, and we keep it that way.',
  },
  {
    question: 'Is NEXUS free to use?',
    answer: 'Yes. NEXUS is free for IISER Tirupati students.',
  },
  {
    question: 'What happens to shared resources?',
    answer: 'Resources are organised by course and shared with the student community for future batches to find and use.',
  },
];

function FigmaImage({ name, className = '', alt = '' }: { name: string; className?: string; alt?: string }) {
  const ext = name === 'imgRectangle' || name.startsWith('imgCampusPhotograph') ? 'png' : 'svg';
  return <img className={className} src={asset(name, ext)} alt={alt} />;
}

function TurboFlame({ motionId, className = '', assetVariant = '' }: { motionId: string; className?: string; assetVariant?: string }) {
  return <span className={`nexus-turbo-flame ${className}`} data-figma-motion={motionId} aria-hidden="true">
    <span className="nexus-turbo-flame-frame">
      <FigmaImage name={`imgPlumeHalo${assetVariant}`} />
      <FigmaImage name={`imgVioletExhaust${assetVariant}`} />
      <FigmaImage name={`imgLuminousCore${assetVariant}`} />
      <FigmaImage name={`imgLavenderSparks${assetVariant}`} />
    </span>
  </span>;
}

function MaskedWord({ label, mask, distance, motionId, className = '' }: { label: string; mask: string; distance: number; motionId: string; className?: string }) {
  return (
    <span className={`nexus-cycle-word ${className}`} aria-label={label} style={{ '--word-mask': `url("${mask}")`, '--flow-distance': `${distance}px` } as React.CSSProperties}>
      <span className="nexus-cycle-flow" data-figma-motion={motionId} aria-hidden="true" />
    </span>
  );
}

function CampusLight() {
  return (
    <div className="nexus-disco" aria-hidden="true">
      {rayData.map((ray) => (
        <div key={ray.id} className="nexus-disco-ray" data-figma-motion={ray.id} style={{ inset: ray.inset, transformOrigin: ray.origin }}>
          <FigmaImage name={ray.file} />
        </div>
      ))}
      <div className="nexus-disco-hanger"><FigmaImage name="imgVector" /></div>
      <div className="nexus-disco-pin"><FigmaImage name="imgVector1" /></div>
      <div className="nexus-disco-ball">
        <FigmaImage name="imgVector2" className="nexus-disco-sphere" />
        <span className="nexus-disco-tiles" style={{ maskImage: `url("${asset('imgMirrorTiles')}")`, WebkitMaskImage: `url("${asset('imgMirrorTiles')}")` }}>
          <FigmaImage name="imgMirrorTiles1" />
        </span>
        <FigmaImage name="imgVector3" className="nexus-disco-detail nexus-disco-detail-one" />
        <FigmaImage name="imgVector4" className="nexus-disco-detail nexus-disco-detail-two" />
        <FigmaImage name="imgVector5" className="nexus-disco-detail nexus-disco-detail-three" />
        <FigmaImage name="imgVector6" className="nexus-disco-detail nexus-disco-detail-four" />
      </div>
      {glitterData.map((glitter) => (
        <div key={glitter.id} className="nexus-disco-glitter" data-figma-motion={glitter.id} style={{ inset: glitter.inset }}>
          <FigmaImage name={glitter.file} />
        </div>
      ))}
    </div>
  );
}

export const LandingPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="nexus-landing">
      <header className="nexus-public-nav">
        <Link className="nexus-public-brand" to="/" aria-label="NEXUS home">
          <span className="nexus-brand-mark" data-figma-motion="3:111015"><FigmaImage name="imgRectangle" /></span>
          <MaskedWord label="NEXUS" mask={MASKS.wordmark} distance={-188} motionId="9:19" className="nexus-wordmark" />
        </Link>

        <nav className="nexus-public-links" aria-label="Main navigation">
          <a href="#home"><MaskedWord label="Home" mask={MASKS.home} distance={-74} motionId="10:3" /></a>
          <a href="#tools"><MaskedWord label="Features" mask={MASKS.features} distance={-108} motionId="10:8" /></a>
          <a href="#community"><MaskedWord label="Community" mask={MASKS.community} distance={-142} motionId="10:13" /></a>
          <a href="#about"><MaskedWord label="About" mask={MASKS.about} distance={-74} motionId="10:18" /></a>
        </nav>

        <div className="nexus-public-actions">
          <Link to="/auth?mode=login" className="nexus-login-motion" data-figma-motion="12:4">
            <span className="nexus-login-sheen" data-figma-motion="12:6" />
            <span>Login</span>
          </Link>
          <Link to="/auth?mode=signup" className="nexus-start-button">Get Started</Link>
        </div>
      </header>

      <section className="nexus-campus-promise" id="home">
        <CampusLight />
        <div className="nexus-campus-badge">Crafted by the students. Forged for IISER Tirupati.</div>
        <h1 className="nexus-landing-headline" aria-label="Your Campus. Your Community. Connected.">
          {'Your Campus. Your Community. Connected.'.split('').map((char, index) => (
            <span key={index} className="nexus-landing-char" style={{ '--char-index': index } as React.CSSProperties}>{char}</span>
          ))}
        </h1>
        <p className="nexus-hero-support" data-figma-motion="3:111031">
          Meet NEXUS. Your notes, your people, your next big thing — finally in one place. A little less chaos. A lot more campus.
        </p>
        <div className="nexus-hero-actions" data-figma-motion="3:111032">
          <Link to="/auth?mode=signup" className="nexus-primary-button">
            <FigmaImage name="imgArrowRight" />
            <span>Find your campus</span>
          </Link>
          <a href="#tools" className="nexus-secondary-button">Take a look</a>
        </div>
        <div className="nexus-membership" data-figma-motion="3:111038">
          <FigmaImage name="imgShieldCheck" />
          <span>Verified @students.iisertirupati.ac.in access</span>
        </div>
        <div className="nexus-typing-caret" data-figma-motion="21:33" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
      </section>

      <section className="nexus-preview-section" aria-label="NEXUS feature preview">
        <div className="nexus-preview" data-figma-motion="3:111041">
          <div className="nexus-preview-light" data-figma-motion="29:1006" />
          <div className="nexus-preview-toolbar">
            <div className="nexus-preview-label"><FigmaImage name="imgLayoutDashboard" /><span>Your everyday, connected.</span></div>
            <span className="nexus-preview-location">NEXUS / Discover</span>
          </div>
          <h2 data-figma-motion="26:5">What NEXUS brings to you</h2>
          <ul className="nexus-preview-list">
            {featureGroups.map((feature) => (
              <li key={feature.title} className="nexus-feature-row">
                <span className="nexus-feature-bullet" data-figma-motion={feature.bullet} />
                <span className="nexus-feature-copy-clip" data-figma-motion={feature.reveal}>
                  <span className="nexus-feature-copy">
                    <strong>{feature.title}</strong>
                    <small>{feature.description}</small>
                  </span>
                </span>
                <TurboFlame motionId={feature.flame} className="nexus-feature-flame" />
              </li>
            ))}
          </ul>
          <div className="nexus-preview-footer">
            <span>One campus. All your connections.</span>
            <span className="nexus-online"><i />124 students online</span>
          </div>
          <div className="nexus-preview-tagline-wrap">
            <p className="nexus-preview-tagline" data-figma-motion="26:25">One platform. Every part of student life.</p>
          </div>
        </div>
      </section>

      <section className="nexus-campus-proof" data-figma-motion="3:111080" aria-label="NEXUS campus community">
        <div><strong>1,200+</strong><span>campus connections</span></div>
        <div><strong>2,400+</strong><span>shared resources</span></div>
        <div><strong>60+</strong><span>student-led groups</span></div>
      </section>

      <section className="nexus-everyday" id="tools" data-figma-motion="3:111090">
        <div className="nexus-page-width">
          <header className="nexus-section-intro">
            <span className="nexus-eyebrow">LESS TAB-SWITCHING. MORE LIVING.</span>
            <h2>Everything campus. Nothing extra.</h2>
            <p>From the first lecture to the last chai break, keep your day together.</p>
          </header>
          <div className="nexus-tool-grid">
            {everydayTools.map((tool, index) => (
              <Link to={tool.href} key={tool.title} className={`nexus-tool-card nexus-tool-card-${index + 1}`}>
                <FigmaImage name={tool.icon} className="nexus-tool-icon" />
                <FigmaImage name="imgArrowUpRight" className="nexus-tool-open" />
                <strong>{tool.title}</strong>
                <p>{tool.description}</p>
                <small>{tool.meta}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="nexus-academic-life" id="community" data-figma-motion="3:111124">
        <div className="nexus-page-width">
          <div className="nexus-repository-showcase">
            <div className="nexus-repository-story">
              <span className="nexus-eyebrow">PASS IT ON</span>
              <h2>Someone’s already solved the “where are the notes?” problem.</h2>
              <p>Lecture notes, past papers and the explanation that finally clicks. A searchable repository built by the people taking your courses.</p>
              <Link to="/repository" className="nexus-small-button"><FigmaImage name="imgArrowRight" />Explore the repository</Link>
            </div>
            <div className="nexus-repository-preview">
              <div className="nexus-repository-head"><strong>Academic Repository</strong><Link to="/repository">Browse all</Link></div>
              <div className="nexus-resource-filters"><span>PHY 301 ×</span><span>Lecture notes ×</span><span>Semester V</span></div>
              <div className="nexus-resource-row"><FigmaImage name="imgFileText" /><div><strong>Quantum Mechanics — Complete Notes</strong><small>PHY 301 · Meera Iyer · 42 pages</small></div><em>PDF</em></div>
              <div className="nexus-resource-row"><FigmaImage name="imgFileText" /><div><strong>Linear Algebra · Mid-semester 2025</strong><small>MAT 201 · Arjun Nair · 8 pages</small></div><em>PDF</em></div>
              <div className="nexus-resource-row"><FigmaImage name="imgFileText" /><div><strong>Spectroscopy quick reference</strong><small>CHM 301 · Dev Patel · 12 pages</small></div><em>PDF</em></div>
              <p className="nexus-resource-proof">✓ Course-tagged. Peer-reviewed. Always within reach.</p>
            </div>
          </div>

          <div className="nexus-study-showcase">
            <div className="nexus-study-card">
              <strong>Quantum Collective</strong>
              <small>12 students · PHY 301 · Library, Room 2</small>
              <div><FigmaImage name="imgUsers" /><span>Next session: perturbation theory</span></div>
              <small>Tuesday, 3 Nov · 18:00 – 19:30</small>
              <div className="nexus-study-tags"><span>4 seats open</span><span>Bring problem set 04</span></div>
            </div>
            <div className="nexus-study-story">
              <span className="nexus-eyebrow">BETTER IN GOOD COMPANY</span>
              <h2>Hard problems. Shared whiteboards.</h2>
              <p>Turn “I’m stuck” into “we’ve got this.” Find your study circle and make progress, together.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="nexus-people" data-figma-motion="3:111176">
        <div className="nexus-page-width">
          <div className="nexus-messaging-showcase">
            <div className="nexus-community-story">
              <span className="nexus-eyebrow">A CAMPUS, NOT A CONTACT LIST</span>
              <h2>Find the people who get your kind of curious.</h2>
              <p>Course conversations, club plans and late-night ideas. Real connections with verified students — no noise from the outside.</p>
              <div className="nexus-student-presence"><span>MI</span><span>AN</span><span>SK</span><small>Your next lab partner is here.</small></div>
            </div>
            <div className="nexus-chat-preview">
              <header><strong>Meera Iyer</strong><span><i />Online</span></header>
              <small className="nexus-chat-time">TODAY · 10:42 AM</small>
              <p className="nexus-chat-message">Did you get the last step in the perturbation proof? I think we missed a minus sign 😅</p>
              <p className="nexus-chat-reply">Yes! Let’s work through it at the library after lunch?</p>
              <small className="nexus-typing-status">Meera is typing...</small>
            </div>
          </div>

          <div className="nexus-campus-highlights">
            <header className="nexus-campus-section-heading">
              <div><span className="nexus-eyebrow">THERE’S A WORLD BEYOND CLASS</span><h2>Make room for a little campus life.</h2></div>
              <Link to="/campus?tab=events" className="nexus-small-button">See what's happening</Link>
            </header>
            <div className="nexus-event-grid">
              <article className="nexus-event-card">
                <FigmaImage name="imgCampusPhotograph" className="nexus-event-photo" alt="Students looking through a telescope at night" />
                <span className="nexus-event-date">6 NOV · 19:00</span><strong>Astronomy night</strong><small>Skywatchers Club</small>
              </article>
              <article className="nexus-event-card">
                <FigmaImage name="imgCampusPhotograph1" className="nexus-event-photo" alt="Students working in a research laboratory" />
                <span className="nexus-event-date">9 NOV · 16:00</span><strong>Inside the research lab</strong><small>Chemistry Society</small>
              </article>
              <article className="nexus-event-card">
                <FigmaImage name="imgCampusPhotograph2" className="nexus-event-photo" alt="Students studying together outdoors" />
                <span className="nexus-event-date">APPLY BY 15 NOV</span><strong>Your next research chapter</strong><small>Summer research opportunities</small>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="nexus-story" id="about" data-figma-motion="3:111227">
        <div className="nexus-page-width nexus-story-inner">
          <FigmaImage name="imgCampusPhotograph3" className="nexus-story-photo" alt="IISER Tirupati campus and students" />
          <div className="nexus-story-copy">
            <span className="nexus-eyebrow">OF THIS CAMPUS. FOR THIS CAMPUS.</span>
            <h2>Built between lectures, not in a boardroom.</h2>
            <p>We’re students who were tired of lost PDFs, buried messages and missed opportunities. So we built a calmer home for life at IISER Tirupati.</p>
            <blockquote>“The best part isn’t another app. It’s finally knowing where to find each other.”</blockquote>
            <div className="nexus-quote-author"><span>AN</span><div><strong>Arjun Nair</strong><small>BS–MS 2023 · NEXUS student team</small></div></div>
          </div>
        </div>
      </section>

      <section className="nexus-faq">
        <div className="nexus-page-width">
          <h2>A few things you might be wondering.</h2>
          <div className="nexus-faq-list">
            {faqs.map((faq, index) => {
              const open = openFaq === index;
              return (
                <button type="button" key={faq.question} className={`nexus-faq-item ${open ? 'is-open' : ''}`} onClick={() => setOpenFaq(open ? -1 : index)} aria-expanded={open}>
                  <span className="nexus-faq-question">{faq.question}</span>
                  <FigmaImage name={open ? 'imgMinus' : 'imgPlus'} className="nexus-faq-icon" />
                  {open && <span className="nexus-faq-answer">{faq.answer}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="nexus-join">
        <span className="nexus-eyebrow">YOUR CAMPUS IS ALREADY HERE.</span>
        <h2>Come for the notes. Stay for the people.</h2>
        <p>Make your IISER Tirupati experience a little more connected.</p>
        <Link to="/auth?mode=signup" className="nexus-primary-button"><FigmaImage name="imgArrowRight" />Get started with NEXUS</Link>
        <small>Free for students · Institute email required · No outside noise</small>
      </section>

      <footer className="nexus-footer">
        <div className="nexus-page-width">
          <div className="nexus-footer-main">
            <div className="nexus-footer-brand">
              <Link to="/" className="nexus-footer-logo"><span>N</span><strong>NEXUS</strong></Link>
              <p>A shared home for curious minds.<br />Exclusively for IISER Tirupati students.</p>
              <small>Student-built. Independently run.</small>
            </div>
            <div className="nexus-footer-links"><strong>Explore</strong><a href="#home">Home</a><a href="#tools">Features</a><Link to="/repository">Academic Repository</Link><Link to="/campus">Campus Pulse</Link></div>
            <div className="nexus-footer-links"><strong>Community</strong><Link to="/studygroups">Study Groups</Link><Link to="/campus?tab=events">Events</Link><a href="#about">Our story</a><a href="#community">Community guidelines</a></div>
            <div className="nexus-footer-links"><strong>Support</strong><a href="mailto:support@nexus.iisertirupati.ac.in">Help & feedback</a><a href="#about">Privacy</a><a href="#about">Terms</a><a href="mailto:support@nexus.iisertirupati.ac.in">Contact us</a></div>
          </div>
          <div className="nexus-footer-legal"><span>© 2026 NEXUS. Made with care, on campus.</span><span>Tirupati, Andhra Pradesh ↗</span></div>
        </div>
      </footer>
    </main>
  );
};
