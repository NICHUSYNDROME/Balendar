import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Calendar {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export default function Calendars() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/calendars')
      .then((res) => setCalendars(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await api.post('/calendars', { name: newName.trim() });
      setCalendars((prev) => [...prev, res.data.data]);
      setNewName('');
    } catch {
      alert('创建失败');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除此日历？')) return;
    try {
      await api.delete(`/calendars/${id}`);
      setCalendars((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('删除失败');
    }
  };

  if (loading) {
    return <div style={centerStyle}>加载中...</div>;
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', margin: 0 }}>日历列表</h1>
          <p style={{ color: '#666', margin: '4px 0 0' }}>
            {user?.nickname || user?.username} · {user?.role}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => navigate('/songs')} style={navBtnStyle}>
            🎵 歌曲库
          </button>
          <button onClick={logout} style={logoutBtnStyle}>
            退出
          </button>
        </div>
      </div>

      {/* 创建日历（仅 admin） */}
      {user?.role === 'admin' && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
          }}
        >
          <input
            placeholder="新日历名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
          />
          <button onClick={handleCreate} style={createBtnStyle}>
            创建
          </button>
        </div>
      )}

      {/* 日历列表 */}
      {calendars.length === 0 ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
          暂无日历
        </p>
      ) : (
        calendars.map((cal) => (
          <div
            key={cal.id}
            onClick={() => navigate(`/calendars/${cal.id}`)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              marginBottom: '8px',
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              cursor: 'pointer',
            }}
          >
            <div>
              <strong style={{ fontSize: '16px' }}>{cal.name}</strong>
            </div>
            {user?.role === 'admin' && (
              <button
                onClick={(e) => handleDelete(cal.id, e)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d32f2f',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                删除
              </button>
            )}
          </div>
        ))
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

const navBtnStyle: React.CSSProperties = {
  background: '#e0e7ff',
  color: '#4338ca',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
};

const logoutBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #ddd',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
};

const createBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#1976d2',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
