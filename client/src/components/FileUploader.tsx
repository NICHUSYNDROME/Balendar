import { useEffect, useState } from 'react';
import api from '../lib/api';

interface SongFile {
  id: string;
  song_id: string;
  file_type: string;
  file_url: string;
  original_name: string;
  uploaded_by: string;
  created_at: string;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  guitar: '🎸 吉他谱',
  keyboard: '🎹 键盘谱',
  drum: '🥁 鼓谱',
  bass: '🎸 贝斯谱',
  lyrics: '📝 歌词',
  original_audio: '🎵 原曲',
  backing_audio: '🎶 伴奏',
  pgm: '💻 PGM',
  other: '📄 其他',
};

const FILE_TYPE_OPTIONS = Object.entries(FILE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

interface FileUploaderProps {
  songId: string;
  canEdit: boolean;
}

export default function FileUploader({ songId, canEdit }: FileUploaderProps) {
  const [files, setFiles] = useState<SongFile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('guitar');

  const loadFiles = async () => {
    try {
      const res = await api.get(`/songs/${songId}/files`);
      setFiles(res.data.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadFiles(); }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const signRes = await api.get('/upload/presigned-url', {
        params: { fileName: selectedFile.name, songId },
      });
      const { uploadUrl, fileUrl } = signRes.data.data;

      await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      await api.post('/song-files', {
        song_id: songId,
        file_type: fileType,
        file_url: fileUrl,
        original_name: selectedFile.name,
      });

      setSelectedFile(null);
      await loadFiles();
    } catch {
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: SongFile) => {
    if (!confirm(`确定删除 ${file.original_name}？`)) return;
    try {
      await api.delete(`/song-files/${file.id}`);
      await loadFiles();
    } catch {
      alert('删除失败');
    }
  };

  // 按类型统计
  const typeSummary = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.file_type] = (acc[f.file_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      {/* 触发按钮 */}
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 13,
            cursor: 'pointer',
            color: '#555',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          📁 文件
          {files.length > 0 && (
            <span style={{
              background: '#3b82f6',
              color: '#fff',
              borderRadius: 10,
              padding: '0 6px',
              fontSize: 11,
              lineHeight: '18px',
            }}>
              {files.length}
            </span>
          )}
        </button>
        {/* 缩略信息 */}
        {files.length > 0 && (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
            {Object.entries(typeSummary).map(([type, count]) =>
              `${FILE_TYPE_LABELS[type]?.split(' ')[1] || type}(${count})`
            ).join(' · ')}
          </span>
        )}
      </div>

      {/* 弹窗 */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 12,
              width: '90%', maxWidth: 520,
              maxHeight: '80vh', overflow: 'auto',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>📁 文件管理</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
              >
                ✕
              </button>
            </div>

            {/* 上传区域 */}
            {canEdit && (
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                padding: 12, background: '#f9f9f9', borderRadius: 8, marginBottom: 16,
              }}>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ fontSize: 13, flex: 1, minWidth: 140 }}
                  disabled={uploading}
                />
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  style={{ fontSize: 13, padding: '4px 8px' }}
                >
                  {FILE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  style={{
                    padding: '6px 16px', fontSize: 13,
                    background: !selectedFile || uploading ? '#ccc' : '#3b82f6',
                    color: '#fff', border: 'none', borderRadius: 6,
                    cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uploading ? '上传中...' : '📤 上传'}
                </button>
              </div>
            )}

            {/* 文件列表 */}
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '32px 0', fontSize: 14 }}>
                暂无文件
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, fontSize: 13,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ marginRight: 6 }}>{FILE_TYPE_LABELS[file.file_type] || '📄 其他'}</span>
                      <a
                        href={`/api/files/${file.id}/download`}
                        target="_blank" rel="noreferrer"
                        style={{ color: '#1677ff', wordBreak: 'break-all' }}
                      >
                        {file.original_name}
                      </a>
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(file)}
                        style={{
                          border: 'none', background: 'none',
                          color: '#ff4d4f', cursor: 'pointer',
                          fontSize: 16, padding: '2px 6px', flexShrink: 0,
                        }}
                        title="删除"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
