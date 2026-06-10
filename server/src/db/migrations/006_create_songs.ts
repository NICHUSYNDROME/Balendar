import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('songs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.string('artist', 100).notNullable();
    table.string('original_key', 10);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('songs');
}
