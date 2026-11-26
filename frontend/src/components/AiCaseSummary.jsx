import React, { useState, useEffect } from 'react';
import { Sparkles, Loader, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * AiCaseSummary — LLM-written clinical summary of an assessment for the
 * reviewing healthcare worker. Built only from recorded assessment data.
 */
export default function AiCaseSummary({ assessmentId, token }) {
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!assessmentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ai/case-summary/${assessmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not generate summary');
      setSummary(data.summary);
      setMeta(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSummary(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #7c3aed' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} color="#7c3aed" /> AI Case Summary
        </h3>
        {!loading && (
          <button className="btn btn-outline btn-sm" onClick={load}>
            <RefreshCw size={14} /> Regenerate
          </button>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
          <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Summarising this assessment…
        </div>
      )}

      {!loading && error && (
        <div style={{ display: 'flex', gap: '0.5rem', color: '#991b1b', fontSize: '0.85rem' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> {error}
        </div>
      )}

      {!loading && summary && (
        <>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.6, color: '#1e293b' }}>
            {summary}
          </div>
          <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
            {meta?.disclaimer} Model: {meta?.model}.
          </p>
        </>
      )}
    </div>
  );
}
