import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader, AlertTriangle } from 'lucide-react';

const SUGGESTIONS = [
  'What does my risk level mean?',
  'Why did I get this score?',
  'What should I do next?',
];

/**
 * PatientAssistant — lets a patient ask questions about their own assessment.
 * The assistant explains the result; it never diagnoses or changes the triage.
 */
export default function PatientAssistant({ assessmentId, token }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  if (!assessmentId) return null;

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;
    setInput('');
    setError('');
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setSending(true);
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assessment_id: assessmentId, message: question, history })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'The assistant could not answer');
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, emergency: data.emergency }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <MessageCircle size={18} color="#0284c7" /> Ask about your result
      </h3>
      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
        The AI assistant explains your assessment in plain words. It can't diagnose you; for medical decisions, talk to your doctor.
      </p>

      {messages.length > 0 && (
        <div ref={listRef} style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '0.6rem 0.8rem',
                borderRadius: '10px',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                background: m.emergency ? '#fef2f2' : m.role === 'user' ? '#0284c7' : '#f1f5f9',
                color: m.emergency ? '#991b1b' : m.role === 'user' ? '#ffffff' : '#0f172a',
                border: m.emergency ? '1px solid #fecaca' : 'none'
              }}
            >
              {m.emergency && <AlertTriangle size={14} style={{ marginRight: '0.35rem', verticalAlign: '-2px' }} />}
              {m.content}
            </div>
          ))}
          {sending && (
            <div style={{ alignSelf: 'flex-start', color: '#64748b', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking…
            </div>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="btn btn-outline btn-sm" onClick={() => send(s)} disabled={sending}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ color: '#991b1b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{error}</p>}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        style={{ display: 'flex', gap: '0.5rem' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          maxLength={1500}
          disabled={sending}
          style={{ flex: 1, minWidth: 0, padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem' }}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()} aria-label="Send question">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
