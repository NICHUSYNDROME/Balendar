import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, JwtPayload } from './jwt';

export function getAuthUser(request: FastifyRequest): JwtPayload | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    return verifyToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<JwtPayload | null> {
  const user = getAuthUser(request);
  if (!user) {
    reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    return null;
  }
  if (user.role !== 'admin') {
    reply.status(403).send({ error: '权限不足，需要管理员角色' });
    return null;
  }
  return user;
}
