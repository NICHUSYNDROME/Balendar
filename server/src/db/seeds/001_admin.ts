import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // 先清空已有数据
  await knex('calendar_members').del();
  await knex('calendars').del();
  await knex('users').del();

  const passwordHash = await bcrypt.hash('admin123', 10);

  await knex('users').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      username: 'admin',
      password_hash: passwordHash,
      role: 'admin',
      nickname: '管理员',
      instruments: '[]',
    },
    {
      id: knex.raw('gen_random_uuid()'),
      username: 'demo_manager',
      password_hash: passwordHash,
      role: 'manager',
      nickname: '演示管理者',
      instruments: '[]',
    },
    {
      id: knex.raw('gen_random_uuid()'),
      username: 'demo_musician',
      password_hash: passwordHash,
      role: 'musician',
      nickname: '演示乐手',
      instruments: '["吉他", "键盘"]',
    },
  ]);
}
