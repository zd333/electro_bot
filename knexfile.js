/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      database: 'electrobot_local',
      user: 'test_user',
      password: 'test',
      port: 2345,
      host: 'localhost',
    },
    pool: {
      min: 0,
      max: 7,
    },
    migrations: {
      directory: './db/migrations',
      tableName: 'knex_migrations',
    },
    useNullAsDefault: true,
  },
  production: {
    client: 'postgresql',
    connection: {
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      host: process.env.DB_HOST,
    },
    pool: {
      min: 0,
      max: 7,
    },
    migrations: {
      directory: './db/migrations',
      tableName: 'knex_migrations',
    },
    useNullAsDefault: true,
  },
};
