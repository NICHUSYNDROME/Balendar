import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('gig_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('gig_id').notNullable().references('id').inTable('gigs').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users');
    table.text('content').notNullable();
    table.jsonb('images').defaultTo('[]');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_messages_gig ON gig_messages(gig_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('gig_messages');
}
