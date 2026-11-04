import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail } from 'lucide-react';
import { api } from '../services/api';
import './AuthPage.css';

type Mode = 'login' | 'signup' | 'forgot';
interface AuthPageProps { onLoginSuccess: () => void; onSkipSignIn: () => void; }

const asset = (mode: Mode, name: string, ext: 'svg' | 'png' = 'svg') => `/assets/nexus-figma/${mode}_${name}.${ext}`;

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess, onSkipSignIn }) => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawMode = params.get('mode');
  const mode: Mode = rawMode === 'signup' || rawMode === 'forgot' ? rawMode : 'login';
  const setMode = (next: Mode) => { setParams(next === 'login' ? {} : { mode: next }); setError(''); setNotice(''); };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [batch, setBatch] = useState('2023');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true);
    try {
      if (mode === 'login') {
        await api.login({ username_or_email: email, password });
        onLoginSuccess(); navigate('/dashboard');
      } else if (mode === 'signup') {
        const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30) || `student${Date.now()}`;
        await api.register({ username, email, password, full_name: fullName, program: 'BS-MS', academic_year: batch, department: 'General Sciences' });
        onLoginSuccess(); navigate('/dashboard');
      } else {
        await api.requestPasswordReset(email);
        setNotice('If an account exists for this address, a secure reset link has been sent.');
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  const title = mode === 'login' ? 'Good to have you back.' : mode === 'signup' ? 'Your campus starts here.' : 'Forgot your password?';
  const subtitle = mode === 'login' ? 'Your people and your next big idea are waiting.' : mode === 'signup' ? 'Let’s make your student life a little more connected.' : 'It happens. Enter your institute email and we’ll send you a secure reset link.';
  const photoName = 'imgCampusLifePhotograph';

  return <main className="nexus-auth">
    <section className="nexus-auth-campus">
      <Link className="nexus-auth-brand" to="/" aria-label="NEXUS home"><span className="nexus-auth-brand-mark">N</span><span>NEXUS</span></Link>
      <div className="nexus-auth-campus-copy">
        <span className="nexus-auth-eyebrow">ONE CAMPUS. COUNTLESS CONNECTIONS.</span>
        <h1>Your people.<br />Your possibilities.</h1>
        <p>A home for everything that makes IISER Tirupati yours.</p>
      </div>
      <img className="nexus-auth-photo" src={asset(mode, photoName, 'png')} alt="Students sharing campus life at IISER Tirupati" />
      <blockquote>“From finding the right notes to finding my study group — it just makes campus feel smaller.”</blockquote>
      <p className="nexus-auth-attribution">Meera Iyer · BS–MS, Batch 2023</p>
      <span className="nexus-auth-campus-glow" aria-hidden="true" />
    </section>

    <section className="nexus-auth-main">
      <Link className="nexus-auth-back" to="/"><ArrowLeft size={15} /> Back to NEXUS</Link>
      <div className="nexus-auth-form-wrap">
        {mode === 'forgot' ? <div className="nexus-auth-icon"><KeyRound size={21} /></div> : <div className="nexus-auth-kicker"><LockKeyhole size={13} /> {mode === 'signup' ? 'IISER TIRUPATI STUDENTS ONLY' : 'YOUR CAMPUS, ONE SIGN-IN AWAY'}</div>}
        <h2>{title}</h2><p className="nexus-auth-subtitle">{subtitle}</p>
        {error && <div className="nexus-auth-message error" role="alert">{error}</div>}
        {notice && <div className="nexus-auth-message success" role="status"><Check size={17} />{notice}</div>}
        <form className="nexus-auth-form" onSubmit={submit}>
          {mode === 'signup' && <label>Full name<input autoComplete="name" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" /></label>}
          {mode === 'signup' && <label>Batch<select value={batch} onChange={e => setBatch(e.target.value)}>{['2023','2024','2025','2026'].map(year => <option key={year}>{year}</option>)}</select></label>}
          <label>Institute email<span className="nexus-auth-input-icon"><Mail size={16} /><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@students.iisertirupati.ac.in" /></span></label>
          {mode !== 'forgot' && <label>{mode === 'signup' ? 'Create password' : 'Password'}<span className="nexus-auth-input-icon"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /><button className="nexus-auth-eye" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>}
          {mode === 'signup' && <p className="nexus-auth-hint">Use at least 8 characters, including a number or symbol.</p>}
          {mode === 'login' && <div className="nexus-auth-options"><label className="nexus-auth-checkbox"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />Remember me</label><button type="button" className="nexus-auth-text-button" onClick={() => setMode('forgot')}>Forgot password?</button></div>}
          {mode === 'signup' && <p className="nexus-auth-consent">By creating an account, you agree to keep NEXUS a respectful, student-only space.</p>}
          {mode === 'forgot' && <p className="nexus-auth-hint">The link expires after 30 minutes. Check your spam folder too — campus mail can be unpredictable.</p>}
          <button className="nexus-auth-submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? <>Log in to NEXUS <ArrowRight size={16} /></> : mode === 'signup' ? <>Create account &amp; verify email <ArrowUpRight size={16} /></> : <>Send reset link <ArrowRight size={16} /></>}</button>
        </form>
        {mode !== 'forgot' && <p className="nexus-auth-switch">{mode === 'login' ? 'New around here?' : 'Already part of NEXUS?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Create your account' : 'Log in'} <ArrowRight size={14} /></button></p>}
        {mode === 'login' && <><button type="button" className="nexus-auth-preview" onClick={() => { onSkipSignIn(); navigate('/courses'); }}>Skip sign in · Open Courses preview</button><p className="nexus-auth-preview-note">Opens the local demo student session for working on Courses.</p></>}
        {mode === 'forgot' && <button type="button" className="nexus-auth-return" onClick={() => setMode('login')}><ArrowLeft size={15} /> Back to login</button>}
      </div>
      <p className="nexus-auth-privacy">Private by design. Exclusively for IISER Tirupati students.</p>
    </section>
  </main>;
};
