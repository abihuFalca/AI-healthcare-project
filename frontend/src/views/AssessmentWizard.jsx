import React, { useState, useEffect } from 'react';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, Check,
  Heart, Sparkles, ShieldAlert, Stethoscope, Clock, Zap
} from 'lucide-react';

export default function AssessmentWizard({ onComplete, onCancel, token }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Basic
    age: 58,
    gender: 'Male',
    height: 178,
    weight: 86,
    // Step 2: Symptoms
    symptomText: '',
    selectedSymptoms: [],
    extractedSymptoms: [],
    duration: '3 hours',
    severity: 'Moderate',
    // Step 3: Medical History
    medicalHistory: ['Hypertension'],
    // Step 4: Medications
    medications: [{ name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily' }],
    // Step 5: Risk Factors
    riskFactors: ['Smoking', 'Family History'],
    // Step 6: Vitals
    vitals: {
      systolic_bp: 165,
      diastolic_bp: 100,
      heart_rate: 108,
      spo2: 96,
      temperature: 37.1,
      respiratory_rate: 18,
      blood_glucose: 110
    }
  });

  // Calculate live BMI
  const calculateBMI = () => {
    if (!formData.height || !formData.weight) return '--';
    const h = formData.height / 100;
    return (formData.weight / (h * h)).toFixed(1);
  };

  // Structured symptom list options
  const symptomList = [
    'chest discomfort', 'shortness of breath', 'dizziness', 'sweating',
    'palpitations', 'headache', 'fatigue', 'cough', 'fever', 'nausea',
    'vomiting', 'abdominal pain', 'blurred vision', 'drowsiness'
  ];

  const historyOptions = [
    'Hypertension', 'Diabetes', 'Heart Disease / CAD', 'Asthma',
    'Kidney Disease', 'Previous Stroke / TIA', 'Cancer History'
  ];

  const riskOptions = [
    'Smoking', 'Alcohol use', 'Family History', 'Obesity', 'Physical inactivity'
  ];

  // Helper to load Hackathon Demo Scenario (PRD Section 15)
  const loadDemoScenario = () => {
    setFormData({
      age: 58,
      gender: 'Male',
      height: 178,
      weight: 86,
      symptomText: 'I have chest discomfort and dizziness for 3 hours and I am sweating.',
      selectedSymptoms: ['chest discomfort', 'dizziness', 'sweating'],
      extractedSymptoms: ['chest discomfort', 'dizziness', 'sweating'],
      duration: '3 hours',
      severity: 'Moderate',
      medicalHistory: ['Hypertension'],
      medications: [{ name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily' }],
      riskFactors: ['Smoking', 'Family History'],
      vitals: {
        systolic_bp: 165,
        diastolic_bp: 100,
        heart_rate: 108,
        spo2: 96,
        temperature: 37.1,
        respiratory_rate: 18,
        blood_glucose: 110
      }
    });
    setStep(2); // Jump to symptoms so user sees the NLP inputs
  };

  // NLP extraction trigger (PRD Section 6.5)
  const runNlpExtraction = async () => {
    if (!formData.symptomText.trim()) return;
    setNlpLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-symptoms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: formData.symptomText })
      });
      if (res.ok) {
        const data = await res.json();
        const extracted = data.extracted_symptoms || [];
        setFormData(prev => ({
          ...prev,
          extractedSymptoms: extracted,
          selectedSymptoms: Array.from(new Set([...prev.selectedSymptoms, ...extracted])),
          duration: data.duration !== 'Unknown' ? data.duration : prev.duration,
          severity: data.severity !== 'Unknown' ? data.severity : prev.severity
        }));
      }
    } catch (err) {
      console.error('NLP error:', err);
    } finally {
      setNlpLoading(false);
    }
  };

  // Vitals soft validation warnings (Appendix A)
  const getVitalWarnings = () => {
    const w = [];
    const v = formData.vitals;
    if (v.systolic_bp && (v.systolic_bp < 90 || v.systolic_bp > 180)) {
      w.push(`Systolic BP (${v.systolic_bp} mmHg) is unusually high/low.`);
    }
    if (v.diastolic_bp && (v.diastolic_bp < 60 || v.diastolic_bp > 110)) {
      w.push(`Diastolic BP (${v.diastolic_bp} mmHg) is outside normal ranges.`);
    }
    if (v.heart_rate && (v.heart_rate < 50 || v.heart_rate > 120)) {
      w.push(`Heart rate (${v.heart_rate} bpm) is elevated/reduced.`);
    }
    if (v.spo2 && v.spo2 < 94) {
      w.push(`SpO₂ (${v.spo2}%) indicates low blood oxygen saturation.`);
    }
    return w;
  };

  // Submission to API
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        age: Number(formData.age),
        gender: formData.gender,
        height: Number(formData.height),
        weight: Number(formData.weight),
        symptom_text: formData.symptomText,
        selected_symptoms: formData.selectedSymptoms,
        duration: formData.duration,
        severity: formData.severity,
        medical_history: formData.medicalHistory,
        medications: formData.medications.map(m => `${m.name} ${m.dosage || ''}`).filter(Boolean),
        risk_factors: formData.riskFactors,
        vitals: {
          systolic_bp: formData.vitals.systolic_bp ? Number(formData.vitals.systolic_bp) : null,
          diastolic_bp: formData.vitals.diastolic_bp ? Number(formData.vitals.diastolic_bp) : null,
          heart_rate: formData.vitals.heart_rate ? Number(formData.vitals.heart_rate) : null,
          spo2: formData.vitals.spo2 ? Number(formData.vitals.spo2) : null,
          temperature: formData.vitals.temperature ? Number(formData.vitals.temperature) : null,
          respiratory_rate: formData.vitals.respiratory_rate ? Number(formData.vitals.respiratory_rate) : null,
          blood_glucose: formData.vitals.blood_glucose ? Number(formData.vitals.blood_glucose) : null
        }
      };

      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Assessment analysis failed');
      }

      const result = await res.json();
      onComplete(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '820px' }}>
      {/* Top Banner: One-Click Demo Scenario (PRD Section 15) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
          color: 'white',
          padding: '0.875rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 4px 6px rgba(2, 132, 199, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Sparkles size={20} color="#fef08a" />
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.925rem' }}>
              Hackathon Evaluation Mode (PRD Section 15)
            </div>
            <div style={{ fontSize: '0.775rem', color: '#bae6fd' }}>
              John Doe, 58yo, Chest Discomfort, BP 165/100, HR 108
            </div>
          </div>
        </div>
        <button
          onClick={loadDemoScenario}
          className="btn"
          style={{
            backgroundColor: '#ffffff',
            color: '#0369a1',
            fontSize: '0.8rem',
            padding: '0.4rem 0.85rem'
          }}
        >
          <Zap size={14} /> Auto-Fill Demo Scenario
        </button>
      </div>

      <div className="card">
        {/* Step Progress Indicators (7 Steps) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', position: 'relative' }}>
          {[
            { num: 1, title: 'Basics' },
            { num: 2, title: 'Symptoms' },
            { num: 3, title: 'History' },
            { num: 4, title: 'Meds' },
            { num: 5, title: 'Risks' },
            { num: 6, title: 'Vitals' },
            { num: 7, title: 'Review' }
          ].map(s => (
            <div
              key={s.num}
              onClick={() => s.num < step && setStep(s.num)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: s.num < step ? 'pointer' : 'default',
                zIndex: 2
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.825rem',
                  backgroundColor: step === s.num ? '#0284c7' : step > s.num ? '#10b981' : '#f1f5f9',
                  color: step >= s.num ? '#ffffff' : '#64748b',
                  border: `2px solid ${step === s.num ? '#0284c7' : step > s.num ? '#10b981' : '#cbd5e1'}`
                }}
              >
                {step > s.num ? <Check size={16} /> : s.num}
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  marginTop: '0.35rem',
                  color: step === s.num ? '#0284c7' : '#64748b'
                }}
              >
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem'
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* STEP 1: Basic Information */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              Step 1: Patient Basic Information
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Demographic inputs used for baseline physiological calibration.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="form-label">Age (Years) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.age}
                  onChange={e => setFormData({ ...formData, age: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Biological Gender *</label>
                <select
                  className="form-input"
                  value={formData.gender}
                  onChange={e => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="form-label">Height (cm)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.height}
                  onChange={e => setFormData({ ...formData, height: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.weight}
                  onChange={e => setFormData({ ...formData, weight: e.target.value })}
                />
              </div>
            </div>

            {/* Calculated BMI Badge */}
            <div
              style={{
                marginTop: '1.5rem',
                padding: '0.875rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: '600' }}>
                Body Mass Index (BMI):
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0284c7' }}>
                {calculateBMI()} kg/m²
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: Symptoms (NLP Free-Text + Checklist) */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              Step 2: Symptoms & Medical Complaints
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              You may describe your symptoms naturally in your own words, and our NLP engine will structure them for confirmation.
            </p>

            {/* Option A: Free Text & Real-time NLP */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Free-Text Symptom Description (NLP Enabled)</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Example: I have chest discomfort and dizziness for 3 hours and I am sweating."
                value={formData.symptomText}
                onChange={e => setFormData({ ...formData, symptomText: e.target.value })}
              />
              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={runNlpExtraction}
                  disabled={nlpLoading || !formData.symptomText}
                  className="btn btn-outline btn-sm"
                >
                  <Sparkles size={14} color="#0284c7" />
                  {nlpLoading ? 'Analyzing NLP...' : 'Run NLP Symptom Extraction'}
                </button>
              </div>
            </div>

            {/* Extracted Symptoms Confirmation Banner (PRD Section 6.5) */}
            {formData.extractedSymptoms && formData.extractedSymptoms.length > 0 && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.875rem',
                  marginBottom: '1.25rem'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#166534', marginBottom: '0.35rem' }}>
                  ✓ NLP Identified Symptoms (Confirmed for Analysis):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {formData.extractedSymptoms.map(s => (
                    <span
                      key={s}
                      style={{
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px'
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Option B: Structured Symptom Checklist */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Structured Clinical Checklist (Select all that apply)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem' }}>
                {symptomList.map(s => {
                  const isChecked = formData.selectedSymptoms.includes(s);
                  return (
                    <label
                      key={s}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.825rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: isChecked ? '#e0f2fe' : '#f8fafc',
                        border: `1px solid ${isChecked ? '#0284c7' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        color: isChecked ? '#0369a1' : '#334155'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          const list = e.target.checked
                            ? [...formData.selectedSymptoms, s]
                            : formData.selectedSymptoms.filter(x => x !== s);
                          setFormData({ ...formData, selectedSymptoms: list });
                        }}
                      />
                      {s}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Duration and Severity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">Symptom Duration</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 3 hours, 2 days"
                  value={formData.duration}
                  onChange={e => setFormData({ ...formData, duration: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Severity Level</label>
                <select
                  className="form-input"
                  value={formData.severity}
                  onChange={e => setFormData({ ...formData, severity: e.target.value })}
                >
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Medical History */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              Step 3: Past Medical History
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Pre-existing diagnoses help the risk engine weigh acute presentations.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {historyOptions.map(h => {
                const isChecked = formData.medicalHistory.includes(h);
                return (
                  <label
                    key={h}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '8px',
                      backgroundColor: isChecked ? '#f0f9ff' : '#ffffff',
                      border: `1px solid ${isChecked ? '#0284c7' : '#cbd5e1'}`,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: isChecked ? '600' : '400',
                      color: isChecked ? '#0369a1' : '#1e293b'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...formData.medicalHistory, h]
                          : formData.medicalHistory.filter(x => x !== h);
                        setFormData({ ...formData, medicalHistory: next });
                      }}
                    />
                    {h}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Medications */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              Step 4: Current Medications
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              List your prescribed pharmaceuticals and dosages.
            </p>

            {formData.medications.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1.5fr auto',
                  gap: '0.625rem',
                  alignItems: 'center',
                  marginBottom: '0.75rem'
                }}
              >
                <input
                  type="text"
                  placeholder="Medication name (e.g. Amlodipine)"
                  className="form-input"
                  value={m.name}
                  onChange={e => {
                    const copy = [...formData.medications];
                    copy[idx].name = e.target.value;
                    setFormData({ ...formData, medications: copy });
                  }}
                />
                <input
                  type="text"
                  placeholder="Dosage (e.g. 5mg)"
                  className="form-input"
                  value={m.dosage}
                  onChange={e => {
                    const copy = [...formData.medications];
                    copy[idx].dosage = e.target.value;
                    setFormData({ ...formData, medications: copy });
                  }}
                />
                <input
                  type="text"
                  placeholder="Frequency (e.g. Daily)"
                  className="form-input"
                  value={m.frequency}
                  onChange={e => {
                    const copy = [...formData.medications];
                    copy[idx].frequency = e.target.value;
                    setFormData({ ...formData, medications: copy });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const copy = formData.medications.filter((_, i) => i !== idx);
                    setFormData({ ...formData, medications: copy });
                  }}
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    border: 'none',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                setFormData({
                  ...formData,
                  medications: [...formData.medications, { name: '', dosage: '', frequency: '' }]
                });
              }}
              className="btn btn-outline btn-sm"
              style={{ marginTop: '0.5rem' }}
            >
              + Add Another Medication
            </button>
          </div>
        )}

        {/* STEP 5: Risk Factors */}
        {step === 5 && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              Step 5: Lifestyle & Familial Risk Factors
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Secondary risk determinants that modify cardiovascular and metabolic thresholds.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {riskOptions.map(r => {
                const isChecked = formData.riskFactors.includes(r);
                return (
                  <label
                    key={r}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '8px',
                      backgroundColor: isChecked ? '#f0f9ff' : '#ffffff',
                      border: `1px solid ${isChecked ? '#0284c7' : '#cbd5e1'}`,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: isChecked ? '600' : '400',
                      color: isChecked ? '#0369a1' : '#1e293b'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...formData.riskFactors, r]
                          : formData.riskFactors.filter(x => x !== r);
                        setFormData({ ...formData, riskFactors: next });
                      }}
                    />
                    {r}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 6: Vitals with Range Validations (Appendix A) */}
        {step === 6 && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              Step 6: Objective Vital Signs
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Input recent vital readings. Hard limits reject physiologically impossible numbers; soft warnings highlight unusual values.
            </p>

            {/* Warnings Alert */}
            {getVitalWarnings().length > 0 && (
              <div
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '0.875rem',
                  marginBottom: '1.25rem'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#92400e', marginBottom: '0.25rem' }}>
                  Clinical Range Alert (Soft Warning):
                </div>
                <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#b45309' }}>
                  {getVitalWarnings().map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="form-label">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 120"
                  value={formData.vitals.systolic_bp}
                  onChange={e => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, systolic_bp: e.target.value }
                  })}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Normal: 90–120 mmHg</span>
              </div>

              <div>
                <label className="form-label">Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 80"
                  value={formData.vitals.diastolic_bp}
                  onChange={e => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, diastolic_bp: e.target.value }
                  })}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Normal: 60–80 mmHg</span>
              </div>

              <div>
                <label className="form-label">Heart Rate (bpm)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 72"
                  value={formData.vitals.heart_rate}
                  onChange={e => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, heart_rate: e.target.value }
                  })}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Normal: 60–100 bpm</span>
              </div>

              <div>
                <label className="form-label">SpO₂ Oxygen Saturation (%)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 98"
                  value={formData.vitals.spo2}
                  onChange={e => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, spo2: e.target.value }
                  })}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Target: ≥ 95%</span>
              </div>

              <div>
                <label className="form-label">Body Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  placeholder="e.g. 36.8"
                  value={formData.vitals.temperature}
                  onChange={e => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, temperature: e.target.value }
                  })}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Normal: 36.5–37.5°C</span>
              </div>

              <div>
                <label className="form-label">Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 100"
                  value={formData.vitals.blood_glucose}
                  onChange={e => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, blood_glucose: e.target.value }
                  })}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Fasting: 70–100 mg/dL</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: Review & Final Submission */}
        {step === 7 && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              Step 7: Final Review & Risk Analysis
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Please review your recorded symptoms and physiological parameters before executing the AI risk model.
            </p>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div><strong>Patient:</strong> Age {formData.age} ({formData.gender}), BMI {calculateBMI()}</div>
                <div><strong>Duration:</strong> {formData.duration} (Severity: {formData.severity})</div>
                <div><strong>Symptoms:</strong> {formData.selectedSymptoms.join(', ') || 'None selected'}</div>
                <div><strong>Vitals:</strong> BP {formData.vitals.systolic_bp}/{formData.vitals.diastolic_bp} · HR {formData.vitals.heart_rate} · SpO₂ {formData.vitals.spo2}%</div>
                <div><strong>History:</strong> {formData.medicalHistory.join(', ') || 'None'}</div>
                <div><strong>Risk Factors:</strong> {formData.riskFactors.join(', ') || 'None'}</div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '0.875rem',
                fontSize: '0.8rem',
                color: '#1e40af',
                marginBottom: '1.5rem'
              }}
            >
              🔒 <strong>Clinical Disclaimer:</strong> This system uses deterministic safety rules and explainable ML attribution to provide a clinical risk estimate. It does not replace emergency medical care or doctor diagnosis.
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="btn btn-outline"
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-outline"
            >
              Cancel
            </button>
          )}

          {step < 7 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="btn btn-primary"
            >
              Next Step <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0f766e)',
                padding: '0.75rem 1.75rem',
                fontSize: '0.95rem'
              }}
            >
              {loading ? 'Analyzing Clinical Pipeline...' : 'Analyze My Risk Now'}
              <Sparkles size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
