import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, MapPin, ShieldCheck, HeartHandshake } from "lucide-react";
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
    if (session) window.location.replace("/");
  }, [session]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const message = params.get("error_description") || fragment.get("error_description");
    if (message) {
      window.history.replaceState(null, "", "/login");
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
    <section className="login-story" aria-label="Welcome to GeoCast">
      <a className="login-brand" href="/">GeoCast<span>.</span><small>A shared perspective.</small></a>
      <div className="login-story-content">
        <span className="login-eyebrow">A LITTLE CONTEXT. A LOT OF CARE.</span>
        <h1>A clearer view.<br />A stronger <em>community.</em></h1>
        <p>Understand the risks. Find the resources.<br />Be there for the places that matter to you.</p>
        <div className="login-mascot-scene"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><img src="/geo.png" alt="Geo, a friendly globe wearing a red cap" /><span className="login-mascot-note">Your world, a little closer.</span></div>
      </div>
      <span className="login-story-footer"><ShieldCheck size={16} /> Built around people. Grounded in geography.</span>
    </section>
    <section className="login-form-side">
      <a className="login-back" href="/map">Explore the map <ArrowRight size={16} /></a>
      <div className="login-card">
        <span className="login-eyebrow">WELCOME TO YOUR SHARED PERSPECTIVE</span>
        <h2>Good to see you.</h2>
        <p className="login-intro">Sign in to keep your community in focus.</p>
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
        <div className="login-divider"><span />or take a look around<span /></div>
        <a className="login-demo" href="/map">Explore the map <ArrowRight size={18} /></a>
        <p className="login-demo-note">No account needed. Discover what GeoCast can do.</p>
        <div className="login-features"><span><MapPin size={17} /> Explore local risks</span><span><HeartHandshake size={17} /> Find community resources</span></div>
        <p className="login-disclosure">Secure sign-in with Supabase. Public sources and synthetic demo scenarios are clearly separated.</p>
      </div>
      <footer className="login-footer"><span>GeoCast. Together, we see more.</span><span>Made for communities.</span></footer>
    </section>
  </main>;
}
