import React, { useState } from 'react';

export default function DemoJourneyProgress({ onOpenInboundModal, onOpenTestConsole }) {
  const [completedSteps, setCompletedSteps] = useState([1, 2]); // Initial default steps

  const steps = [
    { id: 1, title: 'Explore Workspace', desc: 'Verify business profile & industry settings.' },
    { id: 2, title: 'Setup Sample Demo', desc: 'Provision synthetic test contacts and rules.' },
    { id: 3, title: 'Choose Template Draft', desc: 'Select industry-specific messaging templates.' },
    { id: 4, title: 'Create Mock Campaign', desc: 'Configure audience and preview eligible recipients.' },
    { id: 5, title: 'Simulate Dispatch', desc: 'Queue messages and inspect lifecycle events.' },
    { id: 6, title: 'Open Two-Way Inbox', desc: 'Review simulated threads and message history.' },
    { id: 7, title: 'Simulate Customer Inbound', desc: 'Send simulated messages like BROCHURE or TRIAL.' },
    { id: 8, title: 'Observe Auto-Reply', desc: 'Verify automated keyword-triggered responses.' },
    { id: 9, title: 'Test STOP Opt-Out', desc: 'Verify affirmative consent and suppression checks.' },
    { id: 10, title: 'Inspect Reports', desc: 'Audit simulated delivery metrics and analytics.' },
  ];

  const toggleStep = (id) => {
    setCompletedSteps((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const progressPercent = Math.round((completedSteps.length / steps.length) * 100);

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid #E5E7EB',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
            Customer Demo & Verification Journey
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#667085' }}>
            Experience the complete WhatsApp automation lifecycle before connecting a live number.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0D9488' }}>
            {progressPercent}% Complete
          </span>
          <div style={{ width: '120px', height: '6px', background: '#E5E7EB', borderRadius: '999px', marginTop: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#0D9488', borderRadius: '999px', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
        {steps.map((s) => {
          const isDone = completedSteps.includes(s.id);
          return (
            <div
              key={s.id}
              onClick={() => toggleStep(s.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px',
                borderRadius: '8px',
                border: isDone ? '1px solid #CCFBF1' : '1px solid #E5E7EB',
                background: isDone ? '#F0FDFA' : '#FAFAFA',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: isDone ? '2px solid #0D9488' : '2px solid #9CA3AF',
                background: isDone ? '#0D9488' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}>
                {isDone && <span style={{ color: '#FFFFFF', fontSize: '10px', fontWeight: 900 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: isDone ? '#0F766E' : '#111827' }}>
                  {s.id}. {s.title}
                </div>
                <div style={{ fontSize: '11px', color: '#667085', marginTop: '2px' }}>
                  {s.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F3F4F6' }}>
        {onOpenInboundModal && (
          <button
            onClick={onOpenInboundModal}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #0D9488',
              background: '#0D9488',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Quick Inbound Simulator
          </button>
        )}
        {onOpenTestConsole && (
          <button
            onClick={onOpenTestConsole}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#374151',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open Test Console
          </button>
        )}
      </div>
    </div>
  );
}
