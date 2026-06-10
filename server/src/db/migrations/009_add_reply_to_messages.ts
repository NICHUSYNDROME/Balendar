import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('gig_messages', (table) => {
    table.uuid('reply_to_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('gig_messages', (table) => {
    table.dropColumn('reply_to_id');
  });
}
