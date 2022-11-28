# electro_bot

Pet project to track information about electricity outages.

## Prerequisites

- install NodeJS, nvm, flyctl
- `nvm use`
- `npm ci`

## Run in local dev env mode

- set values in **apps/electro-bot/.env** (see **apps/electro-bot/.env.example** and **fly.toml**)
- `npm start`

## Migrations

- `npm run migrate:electro-bot` to apply migrations
- `npx knex migrate:make some_migration_name` to create new migration

## Connect to prod Postgre

`flyctl proxy 5433 -a pg-electro-bot`

## Deploy

- `flyctl deploy`