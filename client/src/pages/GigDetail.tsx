import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import SetlistEditor from '../components/SetlistEditor';
import TimePicker from '../components/TimePicker';
import GigMessages from '../components/GigMessages';
import { toBeijingTime, fromBeijingTime, formatBeijing } from '../lib/time';

interface Participant {
  user_id: string;
  nickname: string | null;
  instruments: string[];
  phone?: string;
}

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
  setlist: { items: any[] };
  participants: Participant[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  username: string;
  nickname: string | null;
  role: string;
  instruments: string[];
}

export default function GigDetail() {
  const { calendarId, gigId } = useParams<{ calendarId: string; gigId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: '',
    start_time: '19:00',
    end_time: '22:00',
    location: '',
    notes: '',
  });

  // 参与者管理
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const backUrl = calendarId ? `/calendars/${calendarId}/gigs` : '/calendars';

  useEffect(() => {
    if (!gigId) return;
    api.get(`/gigs/${gigId}`)
      .then((res) => {
        const g = res.data.data;
        setGig(g);
        const { date, time: startTime } = toBeijingTime(g.start_time);
        const { time: endTime } = toBeijingTime(g.end_time);
        setForm({
          title: g.title,
          date,
          start_time: startTime,
          end_time: endTime,
          location: g.location || '',
          notes: g.notes || '',
        });
      })
      .catch(() => navigate(backUrl))
      .finally(() => setLoading(false));
  }, [gigId, navigate, backUrl]);

  useEffect(() => {
    if (canEdit) {
      api.get('/users').then((res) => setAllUsers(res.data.data)).catch(() => {});
    }
  }, [canEdit]);

  const handleSave = async () => {
    if (!gigId) return;
    if (!form.date) { alert('请选择日期'); return; }
    if (form.start_time >= form.end_time) {
      alert('结束时间必须晚于开始时间');
      return;
    }
    try {
      const startISO = fromBeijingTime(form.date, form.start_time);
      const endISO = fromBeijingTime(form.date, form.end_time);
      const res = await api.put(`/gigs/${gigId}`, {
        title: form.title.trim(),
        start_time: startISO,
        end_time: endISO,
        location: form.location.trim() || null,
        notes: form.notes.trim() || '',
      });
      setGig(res.data.data);
      setEditing(false);
    } catch {
      alert('保存失败');
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定删除此演出？')) return;
    try {
      await api.delete(`/gigs/${gigId}`);
      navigate(backUrl);
    } catch {
      alert('删除失败');
    }
  };

  const handleAddParticipant = async (userId: string) => {
    if (!gigId) return;
    try {
      await api.post(`/gigs/${gigId}/participants`, { user_id: userId });
      // 刷新数据
      const res = await api.get(`/gigs/${gigId}`);
      setGig(res.data.data);
      setShowAddParticipant(false);
    } catch {
      alert('添加失败');
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!confirm('确定移除此参与者？')) return;
    try {
      await api.delete(`/gigs/${gigId}/participants/${userId}`);
      setGig((prev) =>
        prev
          ? { ...prev, participants: prev.participants.filter((p) => p.user_id !== userId) }
          : null,
      );
    } catch {
      alert('移除失败');
    }
  };

  if (loading) return <div style={centerStyle}>加载中...</div>;
  if (!gig) return <div style={centerStyle}>演出不存在</div>;

  const participantIds = new Set(gig.participants.map((p) => p.user_id));
  const availableUsers = allUsers.filter((u) => !participantIds.has(u.id));

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <button onClick={() => navigate(backUrl)} style={linkBtnStyle}>
        ← 返回演出列表
      </button>

      {editing ? (
        /* ====== 编辑模式 ====== */
        <div style={{ marginTop: '16px' }}>
          <h2>编辑演出</h2>
          <div style={fieldStyle}>
            <label>标题 *</label>
            <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div style={fieldStyle}>
            <label>日期 *</label>
            <input type="date" style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label>开始时间</label>
              <TimePicker value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
            </div>
            <div style={fieldStyle}>
              <label>结束时间</label>
              <TimePicker value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label>地点</label>
            <input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="输入地址" />
          </div>
          <div style={fieldStyle}>
            <label>备注</label>
            <textarea style={{ ...inputStyle, minHeight: '80px' }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button onClick={handleSave} style={primaryBtnStyle}>保存</button>
            <button onClick={() => setEditing(false)} style={secondaryBtnStyle}>取消</button>
          </div>
        </div>
      ) : (
        /* ====== 查看模式 ====== */
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '24px', margin: '0 0 4px' }}>{gig.title}</h1>
              <span style={{ color: '#666', fontSize: '14px' }}>{gig.calendar_name}</span>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setEditing(true)} style={secondaryBtnStyle}>编辑</button>
                <button onClick={handleDelete} style={dangerBtnStyle}>删除</button>
              </div>
            )}
          </div>

          {/* 时间 */}
          <div style={{ ...infoCardStyle, marginTop: '20px' }}>
            <div style={infoRowStyle}>
              <span style={infoLabelStyle}>🕐 开始</span>
              <span>{formatBeijing(gig.start_time)}</span>
            </div>
            <div style={infoRowStyle}>
              <span style={infoLabelStyle}>🕐 结束</span>
              <span>{formatBeijing(gig.end_time)}</span>
            </div>
          </div>

          {/* 地点 */}
          {gig.location && (
            <div style={infoCardStyle}>
              <div style={infoRowStyle}>
                <span style={infoLabelStyle}>📍 地点</span>
                <span>{gig.location}</span>
              </div>
              {gig.location_url && (
                <a
                  href={gig.location_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#3b82f6', fontSize: '13px', textDecoration: 'none' }}
                >
                  在地图中查看 →
                </a>
              )}
            </div>
          )}

          {/* 备注 */}
          {gig.notes && (
            <div style={infoCardStyle}>
              <div style={infoLabelStyle}>📝 备注</div>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#444', whiteSpace: 'pre-wrap' }}>{gig.notes}</p>
            </div>
          )}

          {/* 参与者 */}
          <div style={infoCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>👥 参与者 ({gig.participants.length})</span>
              {canEdit && (
                <button onClick={() => setShowAddParticipant(!showAddParticipant)} style={smallBtnStyle}>
                  + 添加
                </button>
              )}
            </div>

            {showAddParticipant && (
              <div style={{ marginBottom: '12px', background: '#f9fafb', borderRadius: '8px', padding: '10px' }}>
                {availableUsers.length === 0 ? (
                  <span style={{ color: '#999', fontSize: '13px' }}>没有可添加的用户</span>
                ) : (
                  availableUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleAddParticipant(u.id)}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span>
                        {u.nickname || u.username}
                        <span style={{ color: '#999', marginLeft: '6px', fontSize: '12px' }}>
                          {u.instruments?.join(', ') || ''}
                        </span>
                      </span>
                      <span style={{ color: '#3b82f6' }}>+ 添加</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {gig.participants.length === 0 ? (
              <p style={{ color: '#999', fontSize: '13px' }}>暂无参与者</p>
            ) : (
              <div>
                {gig.participants.map((p) => (
                  <div
                    key={p.user_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>{p.nickname || p.user_id.slice(0, 8)}</span>
                      {p.instruments?.length > 0 && (
                        <span style={{ color: '#666', marginLeft: '8px', fontSize: '13px' }}>
                          {p.instruments.join(', ')}
                        </span>
                      )}
                      {p.phone && (
                        <span style={{ color: '#999', marginLeft: '8px', fontSize: '12px' }}>
                          {p.phone}
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveParticipant(p.user_id)}
                        style={smallDangerBtnStyle}
                      >
                        移除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 歌单编辑器 */}
          {gig && (
            <div style={{ marginTop: '16px' }}>
              <SetlistEditor
                gigId={gig.id}
                initialItems={gig.setlist?.items || []}
                onSaved={(items) => setGig((prev) => prev ? { ...prev, setlist: { items } } : null)}
                canEdit={canEdit}
              />
            </div>
          )}

          {/* 留言板 */}
          {gig && (
            <div style={{ marginTop: '16px' }}>
              <GigMessages gigId={gig.id} />
            </div>
          )}

          {/* 时间戳 */}
          <div style={{ color: '#999', fontSize: '12px', marginTop: '16px', textAlign: 'center' }}>
            创建于 {formatBeijing(gig.created_at)} · 更新于 {formatBeijing(gig.updated_at)}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 样式 ====================

const centerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '14px', padding: 0,
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
};

const secondaryBtnStyle: React.CSSProperties = {
  background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', fontSize: '14px',
};

const dangerBtnStyle: React.CSSProperties = {
  background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
};

const smallBtnStyle: React.CSSProperties = {
  background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '13px',
};

const smallDangerBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px',
};

const infoCardStyle: React.CSSProperties = {
  background: '#f9fafb', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px',
};

const infoRowStyle: React.CSSProperties = {
  display: 'flex', gap: '12px', fontSize: '14px', padding: '4px 0',
};

const infoLabelStyle: React.CSSProperties = {
  color: '#666', fontWeight: 500, minWidth: '60px',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box',
};
