import React, { useState } from 'react';
import { Volume2, Pause, AlertCircle } from 'lucide-react';

/**
 * TextToSpeech Component (Phase 3 Track A)
 * 
 * Provides browser-native TTS functionality for accessibility.
 * Uses Web Speech API to read text aloud.
 * Includes playback controls and error handling.
 */
export default function TextToSpeech({
  text,
  label = "Read Aloud",
  rate = 1,
  onStart = null,
  onStop = null
}) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [supported, setSupported] = useState(
    typeof window !== 'undefined' && window.speechSynthesis !== undefined
  );

  const handleSpeak = () => {
    if (!supported) {
      setError("Text-to-speech is not supported in your browser");
      return;
    }

    if (speaking) {
      // Stop speaking
      window.speechSynthesis.cancel();
      setSpeaking(false);
      if (onStop) onStop();
      return;
    }

    // Start speaking
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.5, Math.min(2, rate)); // Clamp 0.5–2.0
      
      utterance.onstart = () => {
        setSpeaking(true);
        setError(null);
        if (onStart) onStart();
      };
      
      utterance.onend = () => {
        setSpeaking(false);
        if (onStop) onStop();
      };
      
      utterance.onerror = (event) => {
        setSpeaking(false);
        setError(`Speech error: ${event.error}`);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      setError(err.message);
      setSpeaking(false);
    }
  };

  if (!supported) {
    return (
      <div
        style={{
          padding: '0.75rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        <AlertCircle size={16} />
        <span>Text-to-speech not available on your device</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleSpeak}
        style={{
          padding: '0.6rem 1rem',
          backgroundColor: speaking ? '#ef4444' : '#0284c7',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: '600',
          fontSize: '0.9rem',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!speaking) e.target.style.backgroundColor = '#0369a1';
        }}
        onMouseLeave={(e) => {
          if (!speaking) e.target.style.backgroundColor = '#0284c7';
        }}
      >
        {speaking ? (
          <>
            <Pause size={18} /> Stop Reading
          </>
        ) : (
          <>
            <Volume2 size={18} /> {label}
          </>
        )}
      </button>

      {error && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{error}</span>
        </div>
      )}

      {speaking && (
        <div
          style={{
            marginTop: '0.75rem',
            fontSize: '0.85rem',
            color: '#0c4a6e',
            fontStyle: 'italic'
          }}
        >
          Playing audio... (Click button to stop)
        </div>
      )}
    </div>
  );
}
