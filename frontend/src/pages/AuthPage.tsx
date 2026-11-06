import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail } from 'lucide-react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { api } from '../services/api';
import { firebaseAuth, firebaseConfigured, googleProvider } from '../services/firebase';
import './AuthPage.css';

type Mode = 'login' | 'signup' | 'forgot';
interface AuthPageProps { onLoginSuccess: () => void; }
const asset = (mode: Mode, name: string, ext: 'svg' | 'png' = 'svg') => `/assets/nexus-figma/${mode}_${name}.${ext}`;
const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/;

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawMode = params.get('mode');
  const mode: Mode = rawMode === 'signup' || rawMode === 'forgot' ? rawMode : 'login';
  const setMode = (next: Mode) => { setParams(next === 'login' ? {} : { mode: next }); setError(''); setNotice(''); setGoogleProfileRequired(false); };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleProfileRequired, setGoogleProfileRequired] = useState(false);

  const finishLogin = () => { onLoginSuccess(); navigate('/dashboard'); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true);
    try {
      if (!firebaseConfigured || !firebaseAuth) throw new Error('Sign-in is not configured yet. The site owner must finish Firebase setup.');
      if (mode === 'forgot') {
        await sendPasswordResetEmail(firebaseAuth, email.trim());
        setNotice('If this email has a NEXUS account, Firebase has sent a password reset email.');
      } else if (googleProfileRequired) {
        if (!usernamePattern.test(username)) throw new Error('Username must be 3–30 characters using letters, numbers, or underscores.');
        const firebaseUser = firebaseAuth.currentUser;
        if (!firebaseUser) throw new Error('Google sign-in expired. Please sign in again.');
        const result = await api.firebaseSession(await firebaseUser.getIdToken(true), { username, display_name: displayName });
        if ('profile_required' in result) throw new Error('Username and display name are required to finish setup.');
        await updateProfile(firebaseUser, { displayName });
        finishLogin();
      } else if (mode === 'login') {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        const result = await api.firebaseSession(await credential.user.getIdToken(true));
        if ('profile_required' in result) { setGoogleProfileRequired(true); setNotice('Finish setting up your NEXUS username and display name.'); }
        else finishLogin();
      } else {
        if (!usernamePattern.test(username)) throw new Error('Username must be 3–30 characters using letters, numbers, or underscores.');
        if (!displayName.trim()) throw new Error('Enter a display name.');
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(credential.user, { displayName: displayName.trim() });
        const result = await api.firebaseSession(await credential.user.getIdToken(true), { username, display_name: displayName.trim() });
        if ('profile_required' in result) throw new Error('Could not finish creating the NEXUS profile. Please try again.');
        finishLogin();
      }
    } catch (err) { setError(firebaseError(err)); }
    finally { setLoading(false); }
  };

  const signInWithGoogle = async () => {
    setError(''); setNotice(''); setLoading(true);
    try {
      if (!firebaseConfigured || !firebaseAuth) throw new Error('Sign-in is not configured yet. The site owner must finish Firebase setup.');
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      const result = await api.firebaseSession(await credential.user.getIdToken(true));
      if ('profile_required' in result) {
        setEmail(result.email);
        setDisplayName(credential.user.displayName || '');
        setGoogleProfileRequired(true);
        setNotice('Choose a NEXUS username and display name to finish your Google sign-in.');
      } else finishLogin();
    } catch (err) { setError(firebaseError(err)); }
    finally { setLoading(false); }
  };

  const title = googleProfileRequired ? 'Finish your NEXUS profile.' : mode === 'login' ? 'Good to have you back.' : mode === 'signup' ? 'Your campus starts here.' : 'Forgot your password?';
  const subtitle = googleProfileRequired ? 'Your Google email is connected. Add a username and a display name.' : mode === 'login' ? 'Your people and your next big idea are waiting.' : mode === 'signup' ? 'Create an account with your institute or personal email.' : 'Enter the email you used for NEXUS and we’ll send a secure reset link.';
  const photoName = 'imgCampusLifePhotograph';

  return <main className="nexus-auth">
    <section className="nexus-auth-campus">
      <Link className="nexus-auth-brand" to="/" aria-label="NEXUS home"><span className="nexus-auth-brand-mark">N</span><span>NEXUS</span></Link>
      <div className="nexus-auth-campus-copy"><span className="nexus-auth-eyebrow">ONE CAMPUS. COUNTLESS CONNECTIONS.</span><h1>Your people.<br />Your possibilities.</h1><p>A home for everything that makes IISER Tirupati yours.</p></div>
      <img className="nexus-auth-photo" src={asset(mode, photoName, 'png')} alt="Students sharing campus life at IISER Tirupati" />
      <blockquote>“From finding the right notes to finding my study group — it just makes campus feel smaller.”</blockquote>
      <p className="nexus-auth-attribution">Meera Iyer · BS–MS, Batch 2023</p><span className="nexus-auth-campus-glow" aria-hidden="true" />
    </section>
    <section className="nexus-auth-main">
      <Link className="nexus-auth-back" to="/"><ArrowLeft size={15} /> Back to NEXUS</Link>
      <div className="nexus-auth-form-wrap">
        {mode === 'forgot' ? <div className="nexus-auth-icon"><KeyRound size={21} /></div> : <div className="nexus-auth-kicker"><LockKeyhole size={13} /> {mode === 'signup' ? 'CREATE YOUR NEXUS ACCOUNT' : 'YOUR CAMPUS, ONE SIGN-IN AWAY'}</div>}
        <h2>{title}</h2><p className="nexus-auth-subtitle">{subtitle}</p>
        {!firebaseConfigured && <div className="nexus-auth-message error" role="status">Firebase setup is not complete yet. The site owner needs to add the Firebase web app configuration.</div>}
        {error && <div className="nexus-auth-message error" role="alert">{error}</div>}
        {notice && <div className="nexus-auth-message success" role="status"><Check size={17} />{notice}</div>}
        <form className="nexus-auth-form" onSubmit={submit}>
          {(mode === 'signup' || googleProfileRequired) && <>
            <label>Username<input autoComplete="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" value={username} onChange={e => setUsername(e.target.value)} placeholder="letters, numbers, underscores" /></label>
            <label>Display name<input autoComplete="nickname" required maxLength={80} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Any text or emojis ✨" /></label>
          </>}
          {!googleProfileRequired && mode !== 'forgot' && <label>Email address<span className="nexus-auth-input-icon"><Mail size={16} /><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></span></label>}
          {mode !== 'forgot' && !googleProfileRequired && <label>{mode === 'signup' ? 'Create password' : 'Password'}<span className="nexus-auth-input-icon"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /><button className="nexus-auth-eye" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>}
          {mode === 'signup' && <p className="nexus-auth-hint">Institute and personal email addresses are accepted for now.</p>}
          {mode === 'login' && <div className="nexus-auth-options"><button type="button" className="nexus-auth-text-button" onClick={() => setMode('forgot')}>Forgot password?</button></div>}
          <button className="nexus-auth-submit" disabled={loading || !firebaseConfigured}>{loading ? 'Please wait…' : mode === 'login' ? <>Log in to NEXUS <ArrowRight size={16} /></> : mode === 'signup' ? <>Create account <ArrowUpRight size={16} /></> : <>Send reset link <ArrowRight size={16} /></>}</button>
        </form>
        {mode !== 'forgot' && !googleProfileRequired && <>
          <div className="nexus-auth-divider"><span>or</span></div>
          <button type="button" className="nexus-auth-google" disabled={loading || !firebaseConfigured} onClick={() => void signInWithGoogle()}><GoogleMark /> Continue with Google</button>
          <p className="nexus-auth-switch">{mode === 'login' ? 'New around here?' : 'Already have an account?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Create your account' : 'Log in'} <ArrowRight size={14} /></button></p>
        </>}
        {mode === 'forgot' && <button type="button" className="nexus-auth-return" onClick={() => setMode('login')}><ArrowLeft size={15} /> Back to login</button>}
      </div>
      <p className="nexus-auth-privacy">Your account is securely managed with Firebase Authentication.</p>
    </section>
  </main>;
};

function GoogleMark() { return <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 37.97 46.98 31.82 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59a14.43 14.43 0 0 1 0-9.18l-7.98-6.19a23.94 23.94 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>; }

function firebaseError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : 'Sign-in failed. Please try again.';
  const known: Record<string, string> = {
    'auth/email-already-in-use': 'This email already has an account. Log in instead.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
    'auth/unauthorized-domain': 'This website domain has not been authorized in Firebase Authentication settings.',
    'auth/operation-not-allowed': 'Enable this sign-in method in Firebase Authentication settings.',
  };
  return known[code] || message;
}
