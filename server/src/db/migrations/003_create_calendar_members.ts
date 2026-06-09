import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE calendar_role AS ENUM ('manager')`);

  await knex.schema.createTable('calendar_members', (table) => {
    table.uuid('calendar_id').notNullable().references('id').inTable('calendars').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.specificType('role_in_calendar', 'calendar_role').notNullable().defaultTo('manager');
    table.primary(['calendar_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('calendar_members');
  await knex.raw('DROP TYPE IF EXISTS calendar_role');
}
