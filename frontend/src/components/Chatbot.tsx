import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, LoaderCircle, MapPin, Package, ShieldCheck } from "lucide-react";
import "./Chatbot.css";

type Message = { role: "user" | "assistant"; content: string };
type Props = { context: string; onNavigate: (target: "filters" | "assistance" | "about") => void };
const welcome: Message = { role: "assistant", content: "How can I help you today?" };

export default function Chatbot({ context, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { if (open && !busy) field.current?.focus(); }, [open, busy]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy, error, open]);
  function close() { setOpen(false); trigger.current?.focus(); }
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setHasStartedChat(true);
    const next: Message[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next); setInput(""); setError(""); setBusy(true);
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const base = import.meta.env.VITE_CHAT_API_BASE_URL?.replace(/\/$/, "") || "";
      const response = await fetch(`${base}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1).slice(-19), context }), signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Chat is unavailable. Make sure the backend is running.");
      if (typeof data?.reply !== "string") throw new Error("The AI service returned an invalid response.");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages(messages); setInput(text);
      setError(err instanceof Error && err.name !== "AbortError" ? err.message : "The request timed out. Please try again.");
    } finally { window.clearTimeout(timeout); setBusy(false); }
  }
  return <div className="geo-chat">
    {open && <section id="geo-chat-panel" className="geo-chat-panel" role="dialog" aria-label="GEO Guide chatbot" onKeyDown={e => { if (e.key === "Escape") close(); }}>
      <header className="geo-chat-header">
        <img className="geo-chat-avatar" src="/geo-mascot.png" alt="Geo, a smiling globe wearing a red cap" />
        <h2>Chat with Geo</h2>
        <button type="button" onClick={close} aria-label="Close chatbot"><X size={23} strokeWidth={1.8} /></button>
      </header>
      <div className="geo-chat-body">
        <div className="geo-chat-messages" role="log" aria-live="polite" aria-busy={busy}>
          {messages.map((m, i) => <div key={i} className={`geo-chat-message ${m.role}${i === 0 ? " welcome" : ""}`}>
            {i === 0 ? <strong>Hi! I'm Geo <span aria-hidden="true">&#127758;</span></strong> : <small>{m.role === "user" ? "You" : "Geo"}</small>}
            <p>{m.content}</p>
          </div>)}
          {busy && <p className="geo-chat-thinking"><LoaderCircle size={15} className="geo-chat-spin" /> Thinking...</p>}
          <div ref={bottom} />
        </div>
        {!hasStartedChat && <div className="geo-chat-shortcuts" aria-label="Website navigation">
          <button type="button" onClick={() => { onNavigate("filters"); close(); }}><MapPin size={25} /><span>Check my area's risk</span></button>
          <button type="button" onClick={() => { onNavigate("assistance"); close(); }}><Package size={25} /><span>Find nearby resources</span></button>
          <button type="button" disabled={busy} onClick={() => void send("How can I use GEO to find relief resources and safety information? Explain the demo limitations.")}><ShieldCheck size={25} /><span>Get relief &amp; safety tips</span></button>
        </div>}
        {error && <p className="geo-chat-error" role="alert">{error}</p>}
        <form className="geo-chat-form" onSubmit={e => { e.preventDefault(); void send(input); }}>
          <input ref={field} value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Geo anything..." aria-label="Message GEO Guide" maxLength={4000} disabled={busy} />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">{busy ? <LoaderCircle size={21} className="geo-chat-spin" /> : <ArrowRight size={23} strokeWidth={2.5} />}</button>
        </form>
        <div className="geo-chat-footnote"><span>AI can make mistakes.</span><button type="button" onClick={() => { onNavigate("about"); close(); }}>About the data</button></div>
      </div>
    </section>}
    <button ref={trigger} className={`geo-chat-launcher${open ? " is-open" : ""}`} onClick={() => open ? close() : setOpen(true)} aria-label={open ? "Close GEO Guide" : "Open GEO Guide chatbot"} aria-expanded={open} aria-controls="geo-chat-panel">
      {open ? <X size={23} /> : <><img src="/geo-mascot.png" alt="" /><span>Chat with Geo</span></>}
    </button>
  </div>;
}
