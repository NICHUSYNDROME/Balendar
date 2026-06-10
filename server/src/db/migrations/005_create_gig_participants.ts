import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('gig_participants', (table) => {
    table.uuid('gig_id').notNullable().references('id').inTable('gigs').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.primary(['gig_id', 'user_id']);
  });

  await knex.raw('CREATE INDEX idx_gig_participants_user ON gig_participants(user_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('gig_participants');
}
