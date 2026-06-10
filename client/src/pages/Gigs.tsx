import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import '@fullcalendar/core/locales/zh-cn';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Gig {
  id: string;
  calendar_id: string;
  calendar_name: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  location_url: string | null;
  notes: string;
  participants: Array<{
    user_id: string;
    nickname: string | null;
    instruments: string[];
  }>;
  created_by: string;
}

interface Calendar {
  id: string;
  name: string;
}

export default function Gigs() {
  const { id: calendarId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    start_time: '',
    end_time: '',
    location: '',
    notes: '',
  });

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const fetchGigs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (calendarId) params.calendar_id = calendarId;
      const res = await api.get('/gigs', { params });
      setGigs(res.data.data);
    } catch {
      // ignore
    }
  }, [calendarId]);

  useEffect(() => {
    Promise.all([
      fetchGigs(),
      calendarId
        ? api.get(`/calendars/${calendarId}`).then((r) => setCalendar(r.data.data))
        : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [fetchGigs, calendarId]);

  // FullCalendar 事件
  const events = gigs.map((gig) => ({
    id: gig.id,
    title: gig.title,
    start: gig.start_time,
    end: gig.end_time,
    extendedProps: {
      location: gig.location,
      calendarName: gig.calendar_name,
      participantCount: gig.participants.length,
    },
  }));

  const handleEventClick = (info: EventClickArg) => {
    const target = calendarId
      ? `/calendars/${calendarId}/gigs/${info.event.id}`
      : `/gigs/${info.event.id}`;
    navigate(target);
  };

  const handleDateSelect = (info: DateSelectArg) => {
    if (!canEdit) return;
    // 预填时间
    const startStr = info.startStr;
    const endStr = info.endStr;
    setForm({
      title: '',
      start_time: startStr,
      end_time: endStr,
      location: '',
      notes: '',
    });
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !calendarId) return;
    try {
      await api.post('/gigs', {
        calendar_id: calendarId,
        title: form.title.trim(),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setShowCreate(false);
      setForm({ title: '', start_time: '', end_time: '', location: '', notes: '' });
      await fetchGigs();
    } catch {
      alert('创建失败');
    }
  };

  if (loading) {
    return <div style={centerStyle}>加载中...</div>;
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <button
            onClick={() => navigate(calendarId ? `/calendars/${calendarId}` : '/calendars')}
            style={{ ...linkBtnStyle, marginBottom: '8px' }}
          >
            ← {calendar ? `返回 ${calendar.name}` : '返回日历列表'}
          </button>
          <h1 style={{ fontSize: '22px', margin: 0 }}>
            {calendar ? `${calendar.name} · 演出日历` : '全部演出'}
          </h1>
        </div>
        {canEdit && calendarId && (
          <button
            onClick={() => {
              const now = new Date();
              const nextHour = new Date(now.getTime() + 3600000);
              setForm({
                title: '',
                start_time: now.toISOString().slice(0, 16),
                end_time: nextHour.toISOString().slice(0, 16),
                location: '',
                notes: '',
              });
              setShowCreate(true);
            }}
            style={primaryBtnStyle}
          >
            + 新建演出
          </button>
        )}
      </div>

      {/* 快捷列表 */}
      {gigs.length > 0 && (
        <div style={{ marginBottom: '20px', background: '#f9fafb', borderRadius: '8px', padding: '12px 16px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>近期演出</h3>
          {gigs.slice(0, 5).map((gig) => (
            <div
              key={gig.id}
              onClick={() => {
                const target = calendarId
                  ? `/calendars/${calendarId}/gigs/${gig.id}`
                  : `/gigs/${gig.id}`;
                navigate(target);
              }}
              style={{
                padding: '6px 0',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
              }}
            >
              <span>
                <strong>{gig.title}</strong>
                {gig.calendar_name && !calendarId && (
                  <span style={{ color: '#999', marginLeft: '8px' }}>{gig.calendar_name}</span>
                )}
              </span>
              <span style={{ color: '#666' }}>
                {new Date(gig.start_time).toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {gig.participants.length > 0 && (
                  <span style={{ marginLeft: '8px', color: '#999' }}>
                    👥 {gig.participants.length}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* FullCalendar */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          selectable={canEdit}
          selectMirror={canEdit}
          events={events}
          eventClick={handleEventClick}
          select={handleDateSelect}
          height="auto"
          locale="zh-cn"
          buttonText={{
            today: '今天',
            month: '月',
            week: '周',
          }}
        />
      </div>

      {/* 创建演出弹窗 */}
      {showCreate && (
        <div style={modalOverlayStyle} onClick={() => setShowCreate(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>新建演出</h2>
            <form onSubmit={handleCreate}>
              <div style={fieldStyle}>
                <label>标题 *</label>
                <input
                  style={inputStyle}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={fieldStyle}>
                  <label>开始时间 *</label>
                  <input
                    type="datetime-local"
                    style={inputStyle}
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    required
                  />
                </div>
                <div style={fieldStyle}>
                  <label>结束时间 *</label>
                  <input
                    type="datetime-local"
                    style={inputStyle}
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={fieldStyle}>
                <label>地点</label>
                <input
                  style={inputStyle}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="输入地址，自动生成地图链接"
                />
              </div>
              <div style={fieldStyle}>
                <label>备注</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '60px' }}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={secondaryBtnStyle}>
                  取消
                </button>
                <button type="submit" style={primaryBtnStyle}>
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 样式 ====================

const centerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '200px',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#3b82f6',
  cursor: 'pointer',
  fontSize: '14px',
  padding: 0,
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 20px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
};

const secondaryBtnStyle: React.CSSProperties = {
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '8px 20px',
  cursor: 'pointer',
  fontSize: '14px',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  padding: '28px',
  maxWidth: '480px',
  width: '90%',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '12px',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};
