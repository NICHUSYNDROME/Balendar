import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE user_role AS ENUM ('admin', 'manager', 'musician')`);

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('username', 32).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.specificType('role', 'user_role').notNullable().defaultTo('musician');
    table.string('nickname', 64);
    table.string('phone', 20);
    table.jsonb('instruments').defaultTo('[]');
    table.timestamps(true, true);
  });

  await knex.raw(`CREATE UNIQUE INDEX idx_users_username ON users(username)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS user_role');
}
