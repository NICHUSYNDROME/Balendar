import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('gigs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('calendar_id').notNullable().references('id').inTable('calendars').onDelete('CASCADE');
    table.string('title', 200).notNullable();
    table.timestamp('start_time', { useTz: true }).notNullable();
    table.timestamp('end_time', { useTz: true }).notNullable();
    table.text('location');
    table.text('location_url');
    table.text('notes').defaultTo('');
    table.jsonb('setlist').defaultTo('{"items":[]}');
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_gigs_calendar ON gigs(calendar_id)');
  await knex.raw('CREATE INDEX idx_gigs_time ON gigs(start_time)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('gigs');
}
