import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import CircleKeySelector from '../components/CircleKeySelector';

// DB 音名 → 显示名（统一降号）
const DB_TO_DISPLAY: Record<string, string> = {
  'C': 'C', 'G': 'G', 'D': 'D', 'A': 'A', 'E': 'E', 'B': 'B',
  'F#': 'F#', 'C#': 'C#',
  'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb', 'F': 'F',
};

interface Song {
  id: string;
  name: string;
  artist: string;
  original_keys: string[];
  notes: string | null;
}

export default function Songs() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', artist: '', original_keys: [] as string[], notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchSongs = async (keyword = '') => {
    try {
      const params: Record<string, string> = {};
      if (keyword.trim()) params.q = keyword.trim();
      const res = await api.get('/songs', { params });
      setSongs(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => fetchSongs(search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', artist: '', original_keys: [], notes: '' });
    setShowForm(true);
  };

  const openEdit = (song: Song) => {
    setEditingId(song.id);
    setForm({
      name: song.name,
      artist: song.artist,
      original_keys: song.original_keys || [],
      notes: song.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.artist.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        artist: form.artist.trim(),
        original_keys: form.original_keys,
        notes: form.notes.trim() || '',
      };
      if (editingId) {
        const res = await api.put(`/songs/${editingId}`, payload);
        setSongs((prev) => prev.map((s) => (s.id === editingId ? res.data.data : s)));
      } else {
        const res = await api.post('/songs', payload);
        setSongs((prev) => [...prev, res.data.data]);
      }
      setShowForm(false);
    } catch {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此歌曲？')) return;
    try {
      await api.delete(`/songs/${id}`);
      setSongs((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert('删除失败');
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      {/* 顶栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <button onClick={() => navigate('/calendars')} style={linkBtnStyle}>
            ← 返回日历列表
          </button>
          <h1 style={{ fontSize: '22px', margin: '8px 0 0' }}>歌曲库</h1>
        </div>
        {canEdit && (
          <button onClick={openCreate} style={primaryBtnStyle}>
            + 添加歌曲
          </button>
        )}
      </div>

      {/* 搜索框 */}
      <input
        placeholder="搜索曲名或歌手..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={searchInputStyle}
      />

      {/* 创建/编辑表单弹窗 */}
      {showForm && (
        <div style={overlayStyle} onClick={() => setShowForm(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>
              {editingId ? '编辑歌曲' : '添加歌曲'}
            </h2>
            <div style={fieldStyle}>
              <label style={labelStyle}>曲名 *</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>歌手 *</label>
              <input
                style={inputStyle}
                value={form.artist}
                onChange={(e) => setForm({ ...form, artist: e.target.value })}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>原调（按顺序添加，体现转调）</label>
              <CircleKeySelector
                value={form.original_keys}
                onChange={(keys) => setForm((prev) => ({ ...prev, original_keys: keys }))}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>备注</label>
              <textarea
                style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="如歌曲风格、特殊要求等"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => setShowForm(false)} style={secondaryBtnStyle}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 歌曲列表 */}
      {loading ? (
        <div style={centerStyle}>加载中...</div>
      ) : songs.length === 0 ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
          {search ? '未找到匹配的歌曲' : '暂无歌曲，点击右上角添加'}
        </p>
      ) : (
        <div>
          {songs.map((song) => (
            <div key={song.id} style={cardStyle}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '15px' }}>{song.name}</strong>
                <span style={{ color: '#666', marginLeft: '8px', fontSize: '13px' }}>
                  {song.artist}
                </span>
                {song.original_keys?.map((key) => (
                  <span key={key} style={keyBadgeStyle}>{DB_TO_DISPLAY[key] || key}</span>
                ))}
                {song.notes && (
                  <span style={{ color: '#999', marginLeft: '8px', fontSize: '12px' }}>
                    — {song.notes}
                  </span>
                )}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => openEdit(song)} style={smallBtnStyle}>
                    编辑
                  </button>
                  <button onClick={() => handleDelete(song.id)} style={smallDangerBtnStyle}>
                    删除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Styles ====================

const centerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '60vh',
  color: '#666',
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
  padding: '10px 20px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
};

const secondaryBtnStyle: React.CSSProperties = {
  background: '#f3f4f6',
  color: '#333',
  border: '1px solid #ddd',
  padding: '10px 20px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
};

const smallBtnStyle: React.CSSProperties = {
  background: '#f3f4f6',
  border: '1px solid #ddd',
  padding: '6px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
};

const smallDangerBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #fca5a5',
  color: '#d32f2f',
  padding: '6px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '14px',
  marginBottom: '16px',
  outline: 'none',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  background: '#fff',
  padding: '24px',
  borderRadius: '12px',
  width: '400px',
  maxWidth: '90vw',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
};

const fieldStyle: React.CSSProperties = {
  marginBottom: '12px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#555',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #ddd',
  fontSize: '14px',
  outline: 'none',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  marginBottom: '6px',
  background: '#fff',
  borderRadius: '8px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const keyBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#e0e7ff',
  color: '#4338ca',
  fontSize: '11px',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '10px',
  marginLeft: '8px',
};
