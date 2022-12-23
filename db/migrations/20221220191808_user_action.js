/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTableIfNotExists('user_action', function (table) {
      table.integer('chat_id');
      table.string('place_id').references('place.id');
      table.string('command').notNullable();
      table.dateTime('created_at', { useTz: true }).notNullable();

      table.index(['chat_id', 'created_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {};
