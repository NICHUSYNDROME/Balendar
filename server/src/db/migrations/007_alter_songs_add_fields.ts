import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. 添加 notes 列
  await knex.schema.alterTable('songs', (table) => {
    table.text('notes');
  });

  // 2. 添加 original_keys 列（JSONB 数组）
  await knex.schema.alterTable('songs', (table) => {
    table.jsonb('original_keys').defaultTo('[]');
  });

  // 3. 将现有 original_key 数据迁移到 original_keys
  await knex.raw(`
    UPDATE songs
    SET original_keys = CASE
      WHEN original_key IS NOT NULL AND original_key != ''
      THEN to_jsonb(ARRAY[original_key])
      ELSE '[]'::jsonb
    END
  `);

  // 4. 删除旧的 original_key 列
  await knex.schema.alterTable('songs', (table) => {
    table.dropColumn('original_key');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('songs', (table) => {
    table.string('original_key', 10);
  });

  // 从 original_keys 恢复第一个值到 original_key
  await knex.raw(`
    UPDATE songs
    SET original_key = CASE
      WHEN jsonb_array_length(original_keys) > 0
      THEN original_keys->>0
      ELSE NULL
    END
  `);

  await knex.schema.alterTable('songs', (table) => {
    table.dropColumn('original_keys');
    table.dropColumn('notes');
  });
}
