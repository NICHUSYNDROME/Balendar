import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('song_files', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('song_id').notNullable().references('id').inTable('songs').onDelete('CASCADE');
    table.string('file_type', 30).notNullable(); // guitar, keyboard, drum, bass, lyrics, original_audio, backing_audio, pgm, other
    table.string('file_url', 500).notNullable();  // OSS 公网 URL
    table.string('original_name', 200).notNullable(); // 原始文件名
    table.uuid('uploaded_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('song_files');
}
