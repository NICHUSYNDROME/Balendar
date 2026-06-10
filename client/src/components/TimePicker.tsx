import { useRef, useEffect, useState } from 'react';

interface TimePickerProps {
  value: string;       // "HH:MM"
  onChange: (v: string) => void;
  minuteStep?: number; // 分钟粒度，默认 10
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

export default function TimePicker({ value, onChange, minuteStep = 10 }: TimePickerProps) {
  const [h, m] = (value || '00:00').split(':').map(Number);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const MINUTES = Array.from(
    { length: Math.ceil(60 / minuteStep) },
    (_, i) => String(i * minuteStep).padStart(2, '0'),
  );

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', userSelect: 'none' }}>
      {/* 触发器 */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '2px',
          padding: '8px 14px', borderRadius: '6px', cursor: 'pointer',
          fontSize: '15px', fontWeight: 600, fontFamily: 'monospace',
          background: open ? '#eff6ff' : '#fff',
          border: open ? '1px solid #3b82f6' : '1px solid #d1d5db',
          color: '#1e293b', transition: 'all 0.1s',
        }}
      >
        <span>{String(h).padStart(2, '0')}</span>
        <span style={{ color: '#9ca3af' }}>:</span>
        <span>{String(m).padStart(2, '0')}</span>
      </div>

      {/* 下拉面板：两列 */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 50,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', display: 'flex', overflow: 'hidden',
        }}>
          {/* 小时列 */}
          <div style={{ maxHeight: '220px', overflowY: 'auto', minWidth: '56px', borderRight: '1px solid #f3f4f6' }}>
            {HOURS.map((hour) => (
              <div key={hour}
                onClick={() => { onChange(`${hour}:${String(m).padStart(2, '0')}`); }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  padding: '8px 14px', cursor: 'pointer', textAlign: 'center',
                  fontSize: '14px', fontFamily: 'monospace',
                  fontWeight: hour === String(h).padStart(2, '0') ? 700 : 400,
                  color: hour === String(h).padStart(2, '0') ? '#1d4ed8' : '#1e293b',
                  background: hour === String(h).padStart(2, '0') ? '#eff6ff' : 'transparent',
                }}
              >
                {hour}
              </div>
            ))}
          </div>
          {/* 分钟列 */}
          <div style={{ maxHeight: '220px', overflowY: 'auto', minWidth: '56px' }}>
            {MINUTES.map((minute) => (
              <div key={minute}
                onClick={() => { onChange(`${String(h).padStart(2, '0')}:${minute}`); setOpen(false); }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  padding: '8px 14px', cursor: 'pointer', textAlign: 'center',
                  fontSize: '14px', fontFamily: 'monospace',
                  fontWeight: minute === String(m).padStart(2, '0') ? 700 : 400,
                  color: minute === String(m).padStart(2, '0') ? '#1d4ed8' : '#1e293b',
                  background: minute === String(m).padStart(2, '0') ? '#eff6ff' : 'transparent',
                }}
              >
                {minute}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
