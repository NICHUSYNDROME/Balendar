// 临时脚本：配置 OSS Bucket CORS
const OSS = require('ali-oss');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function main() {
  const client = new OSS({
    region: 'oss-cn-chengdu',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: 'balendar-files',
    secure: true,
  });

  const rules = [
    {
      allowedOrigin: ['http://localhost:5173', 'http://8.137.166.216:3000'],
      allowedMethod: ['PUT', 'GET', 'HEAD', 'POST', 'DELETE'],
      allowedHeader: ['*'],
      exposeHeader: ['ETag'],
      maxAgeSeconds: 3600,
    },
  ];

  const result = await client.putBucketCORS('balendar-files', rules);
  console.log('CORS 配置成功:', JSON.stringify(result, null, 2));

  // 验证
  const currentRules = await client.getBucketCORS('balendar-files');
  console.log('当前 CORS 规则:', JSON.stringify(currentRules, null, 2));
}

main().catch(console.error);
