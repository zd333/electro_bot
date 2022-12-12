/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTableIfNotExists('bot', function (table) {
      table.string('id').notNullable();
      table.string('place_id').references('place.id');
      table.string('token').notNullable();
      table.boolean('is_enabled').notNullable();
      table.dateTime('created_at', { useTz: true }).notNullable();

      table.primary(['id', 'place_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {};
