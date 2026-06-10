import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth';
import { getUploadUrl, getDownloadUrl, deleteFile, extractStoreKey } from '../lib/oss';

const FILE_TYPES = [
  'guitar', 'keyboard', 'drum', 'bass', 'lyrics',
  'original_audio', 'backing_audio', 'pgm', 'other',
] as const;

const createFileRecordSchema = z.object({
  song_id: z.string().uuid(),
  file_type: z.enum(FILE_TYPES),
  file_url: z.string().url(),
  original_name: z.string().min(1).max(200),
});

export async function uploadRoutes(app: FastifyInstance) {
  // GET /api/upload/presigned-url — 获取上传签名
  app.get('/api/upload/presigned-url', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const query = z.object({
      fileName: z.string().min(1),
      songId: z.string().uuid(),
    }).safeParse(request.query);

    if (!query.success) {
      return reply.status(400).send({ error: '参数错误', details: query.error.flatten().fieldErrors });
    }

    try {
      const { uploadUrl, fileUrl } = await getUploadUrl(query.data.fileName, query.data.songId);
      return { data: { uploadUrl, fileUrl } };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({ error: '生成上传签名失败' });
    }
  });

  // GET /api/files/:id/download — 获取文件下载签名 URL
  app.get('/api/files/:id/download', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const { id } = request.params as { id: string };
    const file = await app.knex('song_files').where({ id }).first();
    if (!file) {
      return reply.status(404).send({ error: '文件不存在' });
    }

    try {
      const storeKey = extractStoreKey(file.file_url);
      const signedUrl = await getDownloadUrl(storeKey);
      return { data: { downloadUrl: signedUrl } };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({ error: '获取下载链接失败' });
    }
  });

  // GET /api/songs/:id/files — 获取歌曲的文件列表
  app.get('/api/songs/:id/files', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const { id } = request.params as { id: string };
    const files = await app.knex('song_files')
      .where({ song_id: id })
      .orderBy('created_at', 'desc');
    return { data: files };
  });

  // POST /api/song-files — 上传完成后记录文件信息
  app.post('/api/song-files', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const body = createFileRecordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: '参数错误', details: body.error.flatten().fieldErrors });
    }

    const [record] = await app.knex('song_files').insert({
      song_id: body.data.song_id,
      file_type: body.data.file_type,
      file_url: body.data.file_url,
      original_name: body.data.original_name,
      uploaded_by: user.sub,
    }).returning('*');

    return { data: record };
  });

  // DELETE /api/song-files/:id — 删除文件记录（上传者或 admin）
  app.delete('/api/song-files/:id', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const { id } = request.params as { id: string };
    const file = await app.knex('song_files').where({ id }).first();
    if (!file) {
      return reply.status(404).send({ error: '文件不存在' });
    }

    // 只有上传者或 admin 可删除
    if (file.uploaded_by !== user.sub && user.role !== 'admin') {
      return reply.status(403).send({ error: '无权限删除此文件' });
    }

    try {
      // 删除 OSS 文件
      const storeKey = extractStoreKey(file.file_url);
      await deleteFile(storeKey).catch(() => {});
    } catch {
      // OSS 删除失败不阻塞数据库删除
    }

    await app.knex('song_files').where({ id }).del();
    return { data: { id } };
  });
}
