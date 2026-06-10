import { useEffect, useState, useRef } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { formatBeijing } from '../lib/time';

interface Message {
  id: string;
  gig_id: string;
  user_id: string;
  content: string;
  images: string[];
  created_at: string;
  nickname: string | null;
  role: string;
  reply_to_id?: string | null;
  reply_to?: { nickname: string | null; content: string } | null;
}

interface GigMessagesProps {
  gigId: string;
}

export default function GigMessages({ gigId }: GigMessagesProps) {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string | null; content: string } | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/gigs/${gigId}/messages`);
      setMessages(res.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [gigId]);

  // 新留言时自动滚到底部
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      const payload: Record<string, unknown> = { content: content.trim() };
      if (replyTo) payload.reply_to_id = replyTo.id;
      const res = await api.post(`/gigs/${gigId}/messages`, payload);
      setMessages((prev) => [...prev, res.data.data]);
      setContent('');
      setReplyTo(null);
    } catch {
      alert('发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleReply = (msg: Message) => {
    setReplyTo({ id: msg.id, nickname: msg.nickname, content: msg.content });
    inputRef.current?.focus();
  };

  const cancelReply = () => setReplyTo(null);

  const handleDelete = async (msgId: string) => {
    if (!confirm('确定删除此留言？')) return;
    try {
      await api.delete(`/gigs/${gigId}/messages/${msgId}`);
      // 从列表中移除被删留言，同时更新引用它的回复为"已删除"
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== msgId)
          .map((m) =>
            m.reply_to_id === msgId
              ? { ...m, reply_to: { nickname: null, content: '已删除' } }
              : m,
          ),
      );
    } catch {
      alert('删除失败');
    }
  };

  const canDelete = (msg: Message) =>
    user?.role === 'admin' || msg.user_id === user?.id;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      background: '#fff', borderRadius: '8px', padding: '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '12px' }}>
        💬 留言板 ({messages.length})
      </div>

      {/* 留言列表 */}
      <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '12px' }}>
        {loading ? (
          <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>加载中...</p>
        ) : messages.length === 0 ? (
          <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>暂无留言</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={{
              display: 'flex', gap: '10px', padding: '10px 0',
              borderBottom: '1px solid #f3f4f6',
            }}>
              {/* 头像占位 */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'admin' ? '#dbeafe' : msg.role === 'manager' ? '#fef3c7' : '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, color: msg.role === 'admin' ? '#1d4ed8' : msg.role === 'manager' ? '#92400e' : '#666',
              }}>
                {(msg.nickname || '?')[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span>
                    <strong style={{ fontSize: '13px' }}>{msg.nickname || '未知用户'}</strong>
                    {msg.role === 'admin' && (
                      <span style={{
                        fontSize: '10px', background: '#dbeafe', color: '#1d4ed8',
                        padding: '1px 6px', borderRadius: '8px', marginLeft: '4px', fontWeight: 600,
                      }}>管理员</span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#999' }}>
                      {formatBeijing(msg.created_at)}
                    </span>
                    <button onClick={() => handleReply(msg)} style={{
                      background: 'none', border: 'none', color: '#3b82f6',
                      cursor: 'pointer', fontSize: '11px', padding: '0 2px',
                    }}>回复</button>
                    {canDelete(msg) && (
                      <button onClick={() => handleDelete(msg.id)} style={{
                        background: 'none', border: 'none', color: '#d32f2f',
                        cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px',
                      }} title="删除">×</button>
                    )}
                  </div>
                </div>
                {/* 回复目标信息 */}
                {msg.reply_to && (
                  <div style={{
                    margin: '4px 0 2px', padding: '6px 10px',
                    background: msg.reply_to.content === '已删除' ? '#f9fafb' : '#f9fafb',
                    borderRadius: '6px', borderLeft: `3px solid ${msg.reply_to.content === '已删除' ? '#d1d5db' : '#93c5fd'}`,
                    fontSize: '12px', color: msg.reply_to.content === '已删除' ? '#9ca3af' : '#666',
                  }}>
                    回复 <strong>{msg.reply_to.nickname || '未知用户'}</strong>：{msg.reply_to.content.slice(0, 80)}{msg.reply_to.content.length > 80 ? '…' : ''}
                  </div>
                )}
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={listEndRef} />
      </div>

      {/* 发送框 */}
      <div>
        {/* 回复上下文提示 */}
        {replyTo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
            background: '#f0f7ff', borderRadius: '6px 6px 0 0', fontSize: '12px', color: '#1d4ed8',
          }}>
            <span>回复 <strong>{replyTo.nickname || '未知用户'}</strong>：{replyTo.content.slice(0, 50)}{replyTo.content.length > 50 ? '…' : ''}</span>
            <button onClick={cancelReply} style={{
              marginLeft: 'auto', background: 'none', border: 'none', color: '#999',
              cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 4px',
            }}>×</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入留言… Enter 发送, Shift+Enter 换行"
            rows={2}
            style={{
              flex: 1, padding: '10px', borderRadius: replyTo ? '0 0 8px 8px' : '8px',
              border: '1px solid #ddd', borderTop: replyTo ? 'none' : '1px solid #ddd',
              fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit',
            }}
          />
        <button
          onClick={handleSend}
          disabled={sending || !content.trim()}
          style={{
            alignSelf: 'flex-end', padding: '10px 18px', borderRadius: '8px',
            border: 'none', background: sending || !content.trim() ? '#d1d5db' : '#3b82f6',
            color: '#fff', cursor: sending || !content.trim() ? 'default' : 'pointer',
            fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          {sending ? '发送中' : '发送'}
        </button>
      </div>
      </div>
    </div>
  );
}
