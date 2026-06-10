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
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('guitar');

  // 加载文件列表
  const loadFiles = async () => {
    try {
      const res = await api.get(`/songs/${songId}/files`);
      setFiles(res.data.data);
    } catch {
      // ignore
    }
  };

  // 初始加载
  useEffect(() => { loadFiles(); }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      // 1. 获取签名 URL
      const signRes = await api.get('/upload/presigned-url', {
        params: { fileName: selectedFile.name, songId },
      });
      const { uploadUrl, fileUrl } = signRes.data.data;

      // 2. 直传 OSS（Content-Type 必须与签名时一致）
      await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      // 3. 记录文件信息
      await api.post('/song-files', {
        song_id: songId,
        file_type: fileType,
        file_url: fileUrl,
        original_name: selectedFile.name,
      });

      setSelectedFile(null);
      await loadFiles();
    } catch (err) {
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

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px' }}>📁 文件</h4>

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            style={{ fontSize: 13 }}
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
              padding: '4px 12px',
              fontSize: 13,
              cursor: uploading ? 'wait' : 'pointer',
            }}
          >
            {uploading ? '上传中...' : '📤 上传'}
          </button>
        </div>
      )}

      {files.length === 0 ? (
        <div style={{ color: '#999', fontSize: 13 }}>暂无文件</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((file) => (
            <div
              key={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: '#f5f5f5',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <span>
                {FILE_TYPE_LABELS[file.file_type] || '📄 其他'}
                {' — '}
                <a
                  href={`/api/files/${file.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#1677ff' }}
                >
                  {file.original_name}
                </a>
              </span>
              {canEdit && (
                <button
                  onClick={() => handleDelete(file)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#ff4d4f',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '2px 6px',
                  }}
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
