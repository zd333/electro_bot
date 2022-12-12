/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTableIfNotExists('place', function (table) {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('timezone').notNullable();
      table.dateTime('created_at', { useTz: true }).notNullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {};
