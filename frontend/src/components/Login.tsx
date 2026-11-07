import { useState } from "react";
import { ArrowRight, Eye, EyeOff, MapPin, ShieldCheck, HeartHandshake } from "lucide-react";
import "./Login.css";

export default function Login() {
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState("");
  return <main className="geo-login">
    <section className="login-story" aria-label="Welcome to Geo">
      <a className="login-brand" href="/">GEO<span>.</span><small>A shared perspective.</small></a>
      <div className="login-story-content">
        <span className="login-eyebrow">A LITTLE CONTEXT. A LOT OF CARE.</span>
        <h1>A clearer view.<br />A stronger <em>community.</em></h1>
        <p>Understand the risks. Find the resources.<br />Be there for the places that matter to you.</p>
        <div className="login-mascot-scene"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><img src="/geo-mascot.png" alt="Geo, a friendly globe wearing a red cap" /><span className="login-mascot-note">Your world, a little closer.</span></div>
      </div>
      <span className="login-story-footer"><ShieldCheck size={16} /> Built around people. Grounded in geography.</span>
    </section>
    <section className="login-form-side">
      <a className="login-back" href="/">Explore the demo <ArrowRight size={16} /></a>
      <div className="login-card">
        <span className="login-eyebrow">WELCOME TO YOUR SHARED PERSPECTIVE</span>
        <h2>Good to see you.</h2>
        <p className="login-intro">Sign in to keep your community in focus.</p>
        <form onSubmit={event => { event.preventDefault(); setNotice("Account sign-in is not connected yet. You can explore all current features in the demo below."); }}>
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} />
          <label htmlFor="login-password">Password</label>
          <div className="login-password"><input id="login-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required maxLength={256} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
          {notice && <p className="login-notice" role="status">{notice}</p>}
          <button className="login-submit" type="submit">Sign in <ArrowRight size={19} /></button>
        </form>
        <div className="login-divider"><span />or take a look around<span /></div>
        <a className="login-demo" href="/">Explore the demo <ArrowRight size={18} /></a>
        <p className="login-demo-note">No account needed. Discover what Geo can do.</p>
        <div className="login-features"><span><MapPin size={17} /> Explore local risks</span><span><HeartHandshake size={17} /> Find community resources</span></div>
        <p className="login-disclosure">Sign-in is a preview. The dashboard currently uses illustrative demo data.</p>
      </div>
      <footer className="login-footer"><span>GEO. Together, we see more.</span><span>Made for communities.</span></footer>
    </section>
  </main>;
}
