/** 北京时间 (UTC+8) 工具函数 */

/** 将 UTC ISO 字符串转为北京时间的日期和时间 */
export function toBeijingTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai' });
  return { date, time: time.slice(0, 5) };
}

/** 将北京时间日期+时间转为 UTC ISO 字符串 */
export function fromBeijingTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

/** 格式化北京时间显示 */
export function formatBeijing(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 格式化北京时间短日期 */
export function formatBeijingShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
