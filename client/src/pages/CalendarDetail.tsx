import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Calendar {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

interface Member {
  id: string;
  username: string;
  nickname: string | null;
  role: string;
  instruments: string[];
}

export default function CalendarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin || members.some((m) => m.id === user?.id);

  useEffect(() => {
    Promise.all([
      api.get(`/calendars/${id}`),
      api.get(`/calendars/${id}/members`),
    ])
      .then(([calRes, memRes]) => {
        setCalendar(calRes.data.data);
        setMembers(memRes.data.data);
      })
      .catch(() => navigate('/calendars'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    try {
      const res = await api.put(`/calendars/${id}`, { name: newName.trim() });
      setCalendar(res.data.data);
      setEditing(false);
    } catch {
      alert('更新失败');
    }
  };

  // 获取所有用户并过滤出非成员
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);

  useEffect(() => {
    if (isManager) {
      api.get('/users').then((res) => setAllUsers(res.data.data)).catch(() => {});
    }
  }, [isManager]);

  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.id === u.id),
  );

  const handleAddMember = async (userId: string) => {
    try {
      await api.post(`/calendars/${id}/members`, { user_id: userId });
      const added = allUsers.find((u) => u.id === userId);
      if (added) setMembers((prev) => [...prev, added]);
      setShowUserPicker(false);
    } catch {
      alert('添加失败');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('确定移除此成员？')) return;
    try {
      await api.delete(`/calendars/${id}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch {
      alert('移除失败');
    }
  };

  if (loading) return <div style={centerStyle}>加载中...</div>;
  if (!calendar) return <div style={centerStyle}>日历不存在</div>;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <button
        onClick={() => navigate('/calendars')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2', marginBottom: '16px', fontSize: '14px' }}
      >
        ← 返回日历列表
      </button>

      {/* 日历名称 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        {editing ? (
          <>
            <input
              defaultValue={calendar.name}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '18px',
              }}
              autoFocus
            />
            <button onClick={handleUpdateName} style={primaryBtnStyle}>
              保存
            </button>
            <button onClick={() => setEditing(false)} style={cancelBtnStyle}>
              取消
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '22px', margin: 0 }}>{calendar.name}</h1>
            {isManager && (
              <button onClick={() => { setNewName(calendar.name); setEditing(true); }} style={editBtnStyle}>
                编辑
              </button>
            )}
          </>
        )}
      </div>

      {/* 成员管理 */}
      <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>成员</h2>

      {members.map((m) => (
        <div
          key={m.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            background: '#fff',
            borderRadius: '8px',
            marginBottom: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div>
            <strong>{m.nickname || m.username}</strong>
            <span style={{ color: '#999', marginLeft: '8px', fontSize: '14px' }}>
              {m.username} · {m.role}
            </span>
            {m.instruments && m.instruments.length > 0 && (
              <span style={{ color: '#666', marginLeft: '8px', fontSize: '13px' }}>
                {m.instruments.join(', ')}
              </span>
            )}
          </div>
          {isManager && m.id !== user?.id && (
            <button
              onClick={() => handleRemoveMember(m.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#d32f2f',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              移除
            </button>
          )}
        </div>
      ))}

      {isManager && (
        <div style={{ marginTop: '12px' }}>
          {showUserPicker ? (
            <div
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '12px',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {availableUsers.length === 0 ? (
                <p style={{ color: '#999', fontSize: '14px' }}>没有可添加的用户</p>
              ) : (
                availableUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleAddMember(u.id)}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = '#f5f5f5')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    {u.nickname || u.username} ({u.username}) · {u.role}
                  </div>
                ))
              )}
            </div>
          ) : (
            <button onClick={() => setShowUserPicker(true)} style={addBtnStyle}>
              + 添加成员
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  color: '#666',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#1976d2',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#f5f5f5',
  border: '1px solid #ddd',
  borderRadius: '6px',
  cursor: 'pointer',
};

const editBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'none',
  border: '1px solid #ddd',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '13px',
};

const addBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#f5f5f5',
  border: '1px dashed #ccc',
  borderRadius: '8px',
  cursor: 'pointer',
  color: '#666',
  width: '100%',
};
