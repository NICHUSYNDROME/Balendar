import OSS from 'ali-oss';

const REGION = 'oss-cn-chengdu';
const BUCKET = 'balendar-files';
const INTERNAL_ENDPOINT = 'oss-cn-chengdu-internal.aliyuncs.com';
const EXTERNAL_ENDPOINT = 'oss-cn-chengdu.aliyuncs.com';

let client: any = null;

function getClient(): any {
  if (!client) {
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    if (!accessKeyId || !accessKeySecret) {
      throw new Error('OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET must be set');
    }
    const isInternal = process.env.OSS_INTERNAL === 'true' || process.env.NODE_ENV === 'production';
    client = new OSS({
      region: REGION,
      accessKeyId,
      accessKeySecret,
      bucket: BUCKET,
      endpoint: isInternal ? INTERNAL_ENDPOINT : EXTERNAL_ENDPOINT,
      internal: isInternal,
    });
  }
  return client;
}

/**
 * 生成上传签名 URL（前端直传 OSS 用）
 */
export async function getUploadUrl(
  fileName: string,
  songId: string,
  expiresSeconds = 300,
): Promise<{ uploadUrl: string; fileUrl: string }> {
  const storeKey = `songs/${songId}/${fileName}`;
  const url = getClient().signatureUrl(storeKey, {
    method: 'PUT',
    expires: expiresSeconds,
  });
  return {
    uploadUrl: url,
    fileUrl: `https://${BUCKET}.${EXTERNAL_ENDPOINT}/${storeKey}`,
  };
}

/**
 * 生成下载/查看签名 URL
 */
export async function getDownloadUrl(
  storeKey: string,
  expiresSeconds = 3600,
): Promise<string> {
  return getClient().signatureUrl(storeKey, {
    expires: expiresSeconds,
  });
}

/**
 * 删除 OSS 文件
 */
export async function deleteFile(storeKey: string): Promise<void> {
  await getClient().delete(storeKey);
}

/**
 * 从 fileUrl 中提取 storeKey
 * 例: https://balendar-files.oss-cn-chengdu.aliyuncs.com/songs/xxx/file.pdf
 *     → songs/xxx/file.pdf
 */
export function extractStoreKey(fileUrl: string): string {
  const prefix = `https://${BUCKET}.${EXTERNAL_ENDPOINT}/`;
  if (fileUrl.startsWith(prefix)) {
    return fileUrl.slice(prefix.length);
  }
  return fileUrl;
}
