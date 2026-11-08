import Brand from './Brand'
import {safeLoginDestination,loginReturnKey} from '../services/loginRedirect';
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import "./Login.css";
import { supabase, authConfigurationError } from "../services/supabase";
import { useAuth } from "../services/authContext";

export default function Login() {
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    return params.get("error_description") || fragment.get("error_description") || "";
  });
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const { session, loading, error: sessionError } = useAuth();
  useEffect(() => {
    if (session) {
      let stored:string|null=null
      try{stored=sessionStorage.getItem(loginReturnKey);sessionStorage.removeItem(loginReturnKey)}catch{}
      window.location.replace(safeLoginDestination(new URLSearchParams(window.location.search).get('next')||stored));
    }
  }, [session]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const message = params.get("error_description") || fragment.get("error_description");
    if (message) {
      const next=params.get('next');
      window.history.replaceState(null, "", next?'/login?'+new URLSearchParams({next:safeLoginDestination(next)}):'/login');
    }
  }, []);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setNotice(authConfigurationError); return; }
    const form = new FormData(event.currentTarget);
    setBusy("email"); setNotice("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(form.get("email")).trim(), password: String(form.get("password")),
      });
      if (error) throw error;
    } catch (error) { setNotice(error instanceof Error ? error.message : "Sign-in failed. Please try again."); }
    finally { setBusy(null); }
  }
  async function signInWithGoogle() {
    if (!supabase) { setNotice(authConfigurationError); return; }
    try{sessionStorage.setItem(loginReturnKey,safeLoginDestination(new URLSearchParams(window.location.search).get('next')))}catch{}
    setBusy("google"); setNotice("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: {
        redirectTo: new URL("/login", window.location.origin).href,
      } });
      if (error) throw error;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
      setBusy(null);
    }
  }
  return <main className="geo-login">
    <header className="login-header"><Brand/></header>
    <section className="login-form-side">
      <div className="login-card">
        <span className="login-eyebrow">STATE FARM | GEOCAST</span>
        <h1>Sign in</h1>
        <p className="login-intro">Access GeoCast, a community disaster tool for State Farm.</p>
        <form onSubmit={signIn}>
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} />
          <label htmlFor="login-password">Password</label>
          <div className="login-password"><input id="login-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required maxLength={256} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
          {(notice || sessionError || !supabase) && <p className="login-notice" role="alert">{notice || sessionError || authConfigurationError}</p>}
          <button className="login-submit" type="submit" disabled={loading || !!busy || !supabase}>{busy === "email" ? "Signing in..." : "Sign in"} <ArrowRight size={19} /></button>
        </form>
        <button className="login-demo login-google" type="button" onClick={signInWithGoogle} disabled={loading || !!busy || !supabase}>
          {busy === "google" ? "Connecting to Google..." : "Continue with Google"}
        </button>
      </div>
      <footer className="login-footer">State Farm | GeoCast</footer>
    </section>
  </main>;
}
