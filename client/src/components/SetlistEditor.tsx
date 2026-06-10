import { useEffect, useState } from 'react';
import api from '../lib/api';
import CircleKeySelector from './CircleKeySelector';

// ==================== 类型定义 ====================

type SetlistItem =
  | { order: number; type: 'song'; song_id?: string; song_name: string; artist: string; original_key?: string; transpose?: number; temp_note?: string }
  | { order: number; type: 'break'; duration_minutes: number; note?: string }
  | { order: number; type: 'game'; description: string };

interface Song {
  id: string;
  name: string;
  artist: string;
  original_keys: string[];
}

const KEY_OPTIONS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const displayKey = (k: string | undefined): string => {
  const map: Record<string, string> = { 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb' };
  return k ? (map[k] || k) : '';
};

/** 根据原调和移调量计算实际演奏调 */
const actualKey = (original: string | undefined, transpose: number | undefined): string => {
  if (!original || !transpose || transpose === 0) return displayKey(original);
  const idx = KEY_OPTIONS.indexOf(original);
  if (idx === -1) return displayKey(original);
  const newIdx = ((idx + transpose) % 12 + 12) % 12;
  return displayKey(KEY_OPTIONS[newIdx]);
};

/** 将歌单项按 Part 分组：break/game 作为前一个 Part 的结尾，之后的第一首歌开启新 Part */
function computeParts(items: SetlistItem[]): SetlistItem[][] {
  const parts: SetlistItem[][] = [];
  let current: SetlistItem[] = [];
  for (const item of items) {
    if (item.type === 'song') {
      if (current.length > 0 && current.some((x) => x.type !== 'song')) {
        parts.push([...current]);
        current = [item];
      } else {
        current.push(item);
      }
    } else {
      current.push(item);
    }
  }
  if (current.length > 0) parts.push(current);
  // 如果第一个 Part 没有歌曲，合并到第二个 Part
  if (parts.length >= 2 && parts[0].every((x) => x.type !== 'song')) {
    parts[1] = [...parts[0], ...parts[1]];
    parts.shift();
  }
  return parts;
}

// ==================== 只读行 ====================

function ReadonlyRow({ item }: { item: SetlistItem }) {
  if (item.type === 'song') {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '14px' }}>
        <span style={{ color: '#3b82f6' }}>🎵</span>{' '}
        <strong>{item.song_name}</strong>
        <span style={{ color: '#999', marginLeft: '6px' }}>{item.artist}</span>
        {item.original_key && (
          <span style={{ marginLeft: '8px', color: '#666', fontSize: '12px' }}>
            {displayKey(item.original_key)}
            {item.transpose ? (
              <span style={{ color: '#d97706' }}>
                {' → '}{actualKey(item.original_key, item.transpose)} ({item.transpose > 0 ? '+' : ''}{item.transpose})
              </span>
            ) : ''}
            {item.temp_note ? <span style={{ color: '#999' }}> — {item.temp_note}</span> : ''}
          </span>
        )}
      </div>
    );
  }
  if (item.type === 'break') {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '14px', color: '#92400e' }}>
        ☕ 中场休息 {item.duration_minutes}分钟{item.note ? ` — ${item.note}` : ''}
      </div>
    );
  }
  if (item.type === 'game') {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '14px', color: '#6d28d9' }}>
        🎮 游戏环节{item.description ? ` — ${item.description}` : ''}
      </div>
    );
  }
  return null;
}

// ==================== 编辑行（歌曲只读曲名/歌手，仅可调移调和备注）====================

function EditItemRow({
  item, index, onUpdate, onRemove, onDragStart, onDragOver, onDrop, isDragging,
}: {
  item: SetlistItem; index: number;
  onUpdate: (idx: number, partial: Partial<SetlistItem>) => void;
  onRemove: (idx: number) => void;
  onDragStart: (e: React.DragEvent, idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 0',
        borderBottom: '1px solid #f3f4f6', opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* 拖拽把手 */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '20px', cursor: 'grab',
      }}>
        <span style={{ fontSize: '16px', color: '#9ca3af', lineHeight: 1, userSelect: 'none' }}>⠿</span>
      </div>

      <div style={{ flex: 1 }}>
        {item.type === 'song' && (
          <div>
            {/* 只读：曲名 / 歌手 / 原调 */}
            <div style={{ fontSize: '14px' }}>
              <span style={{ color: '#3b82f6' }}>🎵</span>{' '}
              <strong>{item.song_name}</strong>
              <span style={{ color: '#999', marginLeft: '6px' }}>{item.artist}</span>
              {item.original_key && (
                <span style={{
                  display: 'inline-block', background: '#e0e7ff', color: '#4338ca',
                  fontSize: '11px', fontWeight: 600, padding: '1px 8px',
                  borderRadius: '10px', marginLeft: '6px',
                }}>{displayKey(item.original_key)}</span>
              )}
            </div>
            {/* 可编辑：移调 + 临时备注 */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#666' }}>移调：</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <button onClick={() => onUpdate(index, { transpose: (item.transpose || 0) - 1 } as Partial<SetlistItem>)} style={adjBtnStyle}>−</button>
                <span style={{
                  display: 'inline-block', minWidth: '36px', textAlign: 'center',
                  fontFamily: 'monospace', fontSize: '14px', fontWeight: 700,
                  color: item.transpose ? '#d97706' : '#666',
                }}>
                  {item.transpose ? (item.transpose > 0 ? '+' : '') + item.transpose : '0'}
                </span>
                <button onClick={() => onUpdate(index, { transpose: (item.transpose || 0) + 1 } as Partial<SetlistItem>)} style={adjBtnStyle}>+</button>
              </div>
              <span style={{ fontSize: '12px', color: '#999' }}>
                ({displayKey(item.original_key)}
                {item.transpose ? ` → ${actualKey(item.original_key, item.transpose)}` : ''})
              </span>
              <input style={{
                border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px',
                fontSize: '12px', outline: 'none', width: '120px',
              }}
                value={item.temp_note || ''}
                onChange={(e) => onUpdate(index, { temp_note: e.target.value } as Partial<SetlistItem>)}
                placeholder="临时备注" />
            </div>
          </div>
        )}
        {item.type === 'break' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#f59e0b' }}>☕</span>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#92400e' }}>中场休息</span>
            <input type="number" style={{ ...editInputStyle, width: '60px' }} value={item.duration_minutes}
              onChange={(e) => onUpdate(index, { duration_minutes: Math.max(1, parseInt(e.target.value) || 10) } as Partial<SetlistItem>)} />
            <span style={{ fontSize: '13px', color: '#666' }}>分钟</span>
            <input style={{ ...editInputStyle, width: '120px', fontSize: '11px' }} value={item.note || ''}
              onChange={(e) => onUpdate(index, { note: e.target.value } as Partial<SetlistItem>)} placeholder="备注" />
          </div>
        )}
        {item.type === 'game' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#8b5cf6' }}>🎮</span>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#6d28d9' }}>游戏环节</span>
            <input style={{ ...editInputStyle, flex: 1 }} value={item.description}
              onChange={(e) => onUpdate(index, { description: e.target.value } as Partial<SetlistItem>)} placeholder="游戏描述" />
          </div>
        )}
      </div>

      <button onClick={() => onRemove(index)} style={{
        background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer',
        fontSize: '20px', lineHeight: 1, padding: '2px 4px',
      }}>×</button>
    </div>
  );
}

// ==================== 主组件 ====================

interface SetlistEditorProps {
  gigId: string;
  initialItems: SetlistItem[];
  onSaved: (items: SetlistItem[]) => void;
  canEdit: boolean;
}

export default function SetlistEditor({ gigId, initialItems, onSaved, canEdit }: SetlistEditorProps) {
  const [items, setItems] = useState<SetlistItem[]>(initialItems);
  const [showEditor, setShowEditor] = useState(false);
  const [editItems, setEditItems] = useState<SetlistItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNewSong, setShowNewSong] = useState(false);
  const [newSongForm, setNewSongForm] = useState({ name: '', artist: '', original_keys: [] as string[] });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  useEffect(() => {
    if (!search.trim()) { setSongs([]); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/songs', { params: { q: search.trim() } });
        setSongs(res.data.data);
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openEditor = () => {
    setEditItems(JSON.parse(JSON.stringify(items)));
    setSearch(''); setSongs([]); setShowNewSong(false);
    setShowEditor(true);
  };

  const handleSearchFocus = () => {
    setSearchFocused(true);
    // 如果已有搜索词，立即搜索
    if (search.trim()) {
      setSearching(true);
      api.get('/songs', { params: { q: search.trim() } })
        .then((res) => setSongs(res.data.data))
        .catch(() => {})
        .finally(() => setSearching(false));
    }
  };

  const handleSearchClear = () => {
    setSearch('');
    setSongs([]);
  };

  const addSongFromLibrary = (song: Song) => {
    setEditItems((prev) => [...prev, {
      order: prev.length, type: 'song',
      song_id: song.id, song_name: song.name, artist: song.artist,
      original_key: song.original_keys?.[0] || '', transpose: 0,
    } as SetlistItem]);
  };

  const removeFromSetlist = (songId: string) => {
    setEditItems((prev) => prev.filter((item) => !(item.type === 'song' && item.song_id === songId)));
  };

  const isInSetlist = (songId: string) =>
    editItems.some((item) => item.type === 'song' && item.song_id === songId);

  const addBreak = () => {
    setEditItems((prev) => [...prev, { order: prev.length, type: 'break', duration_minutes: 10 } as SetlistItem]);
  };

  const addGame = () => {
    setEditItems((prev) => [...prev, { order: prev.length, type: 'game', description: '' } as SetlistItem]);
  };

  const updateItem = (index: number, partial: Partial<SetlistItem>) => {
    setEditItems((prev) => prev.map((item, i) => i === index ? { ...item, ...partial } as SetlistItem : item));
  };

  const removeItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 拖拽排序
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(idx);
  };

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === toIdx) return;
    const next = [...editItems];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(toIdx, 0, moved);
    setEditItems(next);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const ordered = editItems.map((item, i) => ({ ...item, order: i }));
      const res = await api.put(`/gigs/${gigId}/setlist`, { items: ordered });
      setItems(res.data.data.items);
      onSaved(res.data.data.items);
      setShowEditor(false);
    } catch { alert('保存失败'); } finally { setSaving(false); }
  };

  const handleNewSongSave = async () => {
    if (!newSongForm.name.trim() || !newSongForm.artist.trim()) return;
    try {
      const res = await api.post('/songs', {
        name: newSongForm.name.trim(),
        artist: newSongForm.artist.trim(),
        original_keys: newSongForm.original_keys,
      });
      addSongFromLibrary(res.data.data);
      setShowNewSong(false);
      setNewSongForm({ name: '', artist: '', original_keys: [] });
      setSearch('');
    } catch { alert('添加歌曲失败'); }
  };

  const renderSearchDropdown = () => {
    // 未获取焦点且无搜索内容时隐藏
    if (!searchFocused && !search.trim()) return null;

    const hasSearch = search.trim().length > 0;

    return (
      <div style={{
        marginTop: '4px', border: '1px solid #e5e7eb', borderRadius: '8px',
        background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxHeight: '280px', overflowY: 'auto',
      }}>
        {hasSearch && searching && (
          <div style={{ padding: '12px', textAlign: 'center', color: '#999', fontSize: '13px' }}>搜索中...</div>
        )}

        {hasSearch && !searching && songs.length > 0 && (
          songs.map((song) => {
            const added = isInSetlist(song.id);
            return (
              <div key={song.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f9fafb',
              }}
                onClick={() => !added && addSongFromLibrary(song)}
                onMouseEnter={(e) => { if (!added) (e.currentTarget as HTMLDivElement).style.background = '#f0f7ff'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div>
                  <strong style={{ fontSize: '14px' }}>{song.name}</strong>
                  <span style={{ color: '#666', marginLeft: '6px', fontSize: '13px' }}>{song.artist}</span>
                  {song.original_keys?.map((k) => (
                    <span key={k} style={{
                      display: 'inline-block', background: '#e0e7ff', color: '#4338ca',
                      fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                      borderRadius: '8px', marginLeft: '4px',
                    }}>{displayKey(k)}</span>
                  ))}
                </div>
                {added ? (
                  <button onClick={(e) => { e.stopPropagation(); removeFromSetlist(song.id); }}
                    style={{
                      background: '#fee2e2', border: 'none', color: '#d32f2f',
                      padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 600,
                    }}>已添加 ×</button>
                ) : (
                  <span style={{ color: '#3b82f6', fontSize: '12px', fontWeight: 600 }}>+ 添加</span>
                )}
              </div>
            );
          })
        )}

        {hasSearch && !searching && songs.length === 0 && (
          <div style={{ padding: '12px', textAlign: 'center', color: '#999', fontSize: '13px' }}>未找到匹配歌曲</div>
        )}

        {!hasSearch && (
          <div style={{ padding: '12px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
            输入曲名或歌手搜索歌曲
          </div>
        )}

        {/* 添加新歌到曲库 */}
        <div style={{ borderTop: '1px solid #e5e7eb' }}>
          <div onClick={() => { setShowNewSong(true); setSearchFocused(false); }} style={{
            padding: '10px 14px', cursor: 'pointer', color: '#059669', fontWeight: 600, fontSize: '13px',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f0fdf4'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
            + 添加新歌到曲库
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontWeight: 600, fontSize: '15px' }}>🎶 歌单 ({items.length})</span>
        {canEdit && (
          <button onClick={openEditor} style={{
            background: '#3b82f6', color: '#fff', border: 'none',
            padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          }}>编辑歌单</button>
        )}
      </div>

      {items.length === 0 ? (
        <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>暂无歌单</p>
      ) : (
        <div>
          {(() => {
            const parts = computeParts(items);
            let globalSongCount = 0;
            return parts.map((part, pIdx) => (
              <div key={pIdx}>
                {parts.length > 1 && (
                  <div style={{
                    fontSize: '12px', fontWeight: 700, color: '#64748b',
                    padding: '8px 0 4px', letterSpacing: '0.5px',
                    borderTop: pIdx > 0 ? '1px dashed #e2e8f0' : 'none',
                    marginTop: pIdx > 0 ? '8px' : 0,
                  }}>
                    Part {pIdx + 1}
                  </div>
                )}
                {part.map((item, i) => {
                  if (item.type === 'song') {
                    globalSongCount++;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '20px', height: '20px', borderRadius: '50%', marginTop: '8px',
                          background: '#e5e7eb', color: '#555', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                        }}>{globalSongCount}</span>
                        <div style={{ flex: 1 }}><ReadonlyRow item={item} /></div>
                      </div>
                    );
                  }
                  return <div key={i} style={{ paddingLeft: '28px' }}><ReadonlyRow item={item} /></div>;
                })}
              </div>
            ));
          })()}
        </div>
      )}

      {/* 编辑弹窗 */}
      {showEditor && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }} onClick={() => setShowEditor(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '12px', width: '640px', maxWidth: '95vw',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{ padding: '20px 20px 0' }}>
              <h2 style={{ fontSize: '18px', margin: '0 0 12px' }}>编辑歌单</h2>
              <div style={{ position: 'relative' }}>
                <input autoFocus placeholder="搜索曲名或歌手..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={handleSearchFocus}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  style={{
                    width: '100%', padding: '10px 36px 10px 14px', borderRadius: '8px',
                    border: '1px solid #ddd', fontSize: '14px', outline: 'none',
                  }} />
                {search && (
                  <button onClick={handleSearchClear}
                    style={{
                      position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                      fontSize: '18px', lineHeight: 1,
                    }}>×</button>
                )}
              </div>
              {renderSearchDropdown()}
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <button onClick={addBreak} style={chipBtnStyle}>☕ 中场休息</button>
                <button onClick={addGame} style={chipBtnStyle}>🎮 游戏环节</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {editItems.length === 0 ? (
                <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>歌单为空，在上方搜索添加歌曲</p>
              ) : (() => {
                const parts = computeParts(editItems);
                let globalSongCount = 0;
                return parts.map((part, pIdx) => {
                  const partElements: React.ReactNode[] = [];
                  partElements.push(
                    <div key={pIdx}>
                      {parts.length > 1 && (
                        <div style={{
                          fontSize: '12px', fontWeight: 700, color: '#64748b',
                          padding: '8px 0 4px', letterSpacing: '0.5px',
                          borderTop: pIdx > 0 ? '1px dashed #e2e8f0' : 'none',
                          marginTop: pIdx > 0 ? '8px' : 0,
                        }}>
                          Part {pIdx + 1}
                        </div>
                      )}
                      {part.map((item) => {
                        const globalIdx = editItems.indexOf(item);
                        if (item.type === 'song') {
                          globalSongCount++;
                          return (
                            <div key={globalIdx} onDragEnd={handleDragEnd}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                ...(dragOverIndex === globalIdx && dragIndex !== globalIdx ? { borderTop: '2px solid #3b82f6' } : {}),
                              }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                                background: '#e5e7eb', color: '#555', fontSize: '11px', fontWeight: 700,
                              }}>{globalSongCount}</span>
                              <div style={{ flex: 1 }}>
                                <EditItemRow item={item} index={globalIdx}
                                  onUpdate={updateItem} onRemove={removeItem}
                                  onDragStart={handleDragStart}
                                  onDragOver={handleDragOver}
                                  onDrop={handleDrop}
                                  isDragging={dragIndex === globalIdx} />
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={globalIdx} onDragEnd={handleDragEnd}
                            style={{ paddingLeft: '26px', ...(dragOverIndex === globalIdx && dragIndex !== globalIdx ? { borderTop: '2px solid #3b82f6' } : {}) }}>
                            <EditItemRow item={item} index={globalIdx}
                              onUpdate={updateItem} onRemove={removeItem}
                              onDragStart={handleDragStart}
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                              isDragging={dragIndex === globalIdx} />
                          </div>
                        );
                      })}
                    </div>
                  );
                  return partElements;
                });
              })()}
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditor(false)} style={{
                background: '#f3f4f6', border: '1px solid #ddd', padding: '10px 20px',
                borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
              }}>取消</button>
              <button onClick={save} disabled={saving} style={{
                background: '#059669', color: '#fff', border: 'none', padding: '10px 20px',
                borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              }}>{saving ? '保存中...' : '💾 保存歌单'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 添加新歌到曲库弹窗 */}
      {showNewSong && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
        }} onClick={() => { setShowNewSong(false); setNewSongForm({ name: '', artist: '', original_keys: [] }); }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '12px', width: '440px', maxWidth: '90vw',
            padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: '18px', margin: '0 0 16px' }}>添加新歌到曲库</h2>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>曲名 *</label>
              <input autoFocus placeholder="曲名" value={newSongForm.name}
                onChange={(e) => setNewSongForm({ ...newSongForm, name: e.target.value })}
                style={editInputStyle} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>歌手 *</label>
              <input placeholder="歌手" value={newSongForm.artist}
                onChange={(e) => setNewSongForm({ ...newSongForm, artist: e.target.value })}
                style={{ ...editInputStyle, width: '100%' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>原调</label>
              <CircleKeySelector
                value={newSongForm.original_keys}
                onChange={(keys) => setNewSongForm({ ...newSongForm, original_keys: keys })}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNewSong(false); setNewSongForm({ name: '', artist: '', original_keys: [] }); }}
                style={{ background: '#f3f4f6', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                取消
              </button>
              <button onClick={handleNewSongSave}
                style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                保存并添加到歌单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Styles ====================

const editInputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px',
  fontSize: '13px', outline: 'none', width: '130px',
};

const chipBtnStyle: React.CSSProperties = {
  background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '6px 12px',
  borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
};

const adjBtnStyle: React.CSSProperties = {
  width: '26px', height: '26px', borderRadius: '4px',
  border: '1px solid #d1d5db', background: '#f9fafb',
  cursor: 'pointer', fontSize: '14px', fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: '#555', lineHeight: 1,
};
