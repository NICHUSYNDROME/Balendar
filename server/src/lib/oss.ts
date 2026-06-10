import OSS from 'ali-oss';

const REGION = 'oss-cn-chengdu';
const BUCKET = 'balendar-files';
const INTERNAL_ENDPOINT = 'oss-cn-chengdu-internal.aliyuncs.com';
const EXTERNAL_HOST = 'balendar-files.oss-cn-chengdu.aliyuncs.com';

let internalClient: any = null;
let externalClient: any = null;

function getClient(internal = false): any {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET must be set');
  }
  if (internal) {
    if (!internalClient) {
      internalClient = new OSS({
        region: REGION,
        accessKeyId,
        accessKeySecret,
        bucket: BUCKET,
        endpoint: INTERNAL_ENDPOINT,
        internal: true,
      });
    }
    return internalClient;
  }
  if (!externalClient) {
    externalClient = new OSS({
      region: REGION,
      accessKeyId,
      accessKeySecret,
      bucket: BUCKET,
      secure: true,
    });
  }
  return externalClient;
}

/**
 * 生成上传签名 URL（前端直传 OSS 用 — 始终用公网 Endpoint）
 */
export async function getUploadUrl(
  fileName: string,
  songId: string,
  expiresSeconds = 300,
): Promise<{ uploadUrl: string; fileUrl: string }> {
  const storeKey = `songs/${songId}/${fileName}`;
  const url = getClient(false).signatureUrl(storeKey, {
    method: 'PUT',
    expires: expiresSeconds,
  });
  return {
    uploadUrl: url,
    fileUrl: `https://${EXTERNAL_HOST}/${storeKey}`,
  };
}

/**
 * 生成下载/查看签名 URL（始终用公网 Endpoint，供浏览器使用）
 */
export async function getDownloadUrl(
  storeKey: string,
  expiresSeconds = 3600,
): Promise<string> {
  return getClient(false).signatureUrl(storeKey, {
    expires: expiresSeconds,
  });
}

/**
 * 删除 OSS 文件（服务端操作，用内网减少延迟）
 */
export async function deleteFile(storeKey: string): Promise<void> {
  await getClient(true).delete(storeKey);
}

/**
 * 从 fileUrl 中提取 storeKey
 */
export function extractStoreKey(fileUrl: string): string {
  const prefix = `https://${EXTERNAL_HOST}/`;
  if (fileUrl.startsWith(prefix)) {
    return fileUrl.slice(prefix.length);
  }
  return fileUrl;
}
