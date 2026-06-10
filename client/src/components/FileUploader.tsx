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

const btnStyle: React.CSSProperties = {
  background: '#f3f4f6',
  border: '1px solid #ddd',
  padding: '6px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #ddd',
  fontSize: '13px',
  outline: 'none',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.4)',
};

const modalStyle: React.CSSProperties = {
  background: '#fff', padding: 24, borderRadius: 12,
  width: '90%', maxWidth: 520,
  maxHeight: '80vh', overflow: 'auto',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
};

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
    // 乐观更新：立即从界面移除
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    try {
      await api.delete(`/song-files/${file.id}`, { timeout: 5000 });
    } catch {
      // 失败则回滚
      setFiles((prev) => [...prev, file]);
      alert('删除失败，服务器无响应');
    }
  };

  const handleDownload = async (file: SongFile) => {
    try {
      const res = await api.get(`/files/${file.id}/download`);
      const signedUrl = res.data?.data?.downloadUrl;
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        window.open(file.file_url, '_blank');
      }
    } catch {
      window.open(file.file_url, '_blank');
    }
  };

  const fileChips = files.map(f => FILE_TYPE_LABELS[f.file_type] || '📄 其他');

  return (
    <>
      {/* 触发按钮 + 文件类型标签 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowModal(true)}
          style={btnStyle}
        >
          📁 文件
        </button>
        {fileChips.map((chip, i) => (
          <span key={i} style={{
            background: '#f0f0f0',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 12,
            color: '#666',
            cursor: 'pointer',
          }} onClick={() => setShowModal(true)}>
            {chip}
          </span>
        ))}
      </div>

      {/* 弹窗 */}
      {showModal && (
        <div
          style={overlayStyle}
          onClick={() => setShowModal(false)}
        >
          <div
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>📁 文件管理</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', padding: '4px 8px' }}
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
                <label style={{
                  ...inputStyle,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  cursor: 'pointer', width: 'auto', flex: 1, minWidth: 120,
                  background: '#fff',
                }}>
                  <span style={{ color: '#666' }}>📎</span>
                  <span style={{ color: selectedFile ? '#333' : '#999', fontSize: 13 }}>
                    {selectedFile ? selectedFile.name : '选择文件'}
                  </span>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  {FILE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  style={{
                    ...primaryBtnStyle,
                    opacity: !selectedFile || uploading ? 0.5 : 1,
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
                        style={{ color: '#1677ff', wordBreak: 'break-all', cursor: 'pointer' }}
                        onClick={() => handleDownload(file)}
                      >
                        {file.original_name}
                      </a>
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(file)}
                        style={btnStyle}
                        title="删除"
                      >
                        🗑 删除
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
