# electro_bot

Pet project to track information about electricity outages.

## Prerequisites

- install NodeJS, nvm, fly console
- `nvm use`
- `npm ci`
- see [https://fly.io/docs](https://fly.io/docs)
- create fly apps with `electrobot` and `electrobotstg` names
- crate `pg-electro-bot` and `pg-electro-bot-stg` fly Postgres clusters for prod and stg envs
- attach apps to corresponding Postgres clusters
- set secrests for prod and stg envs (see **apps/electro-bot/.env.example**)

## Run in local dev env mode

- set values in **apps/electro-bot/.env** (see **apps/electro-bot/.env.example** and **fly.toml**)
- `npm start`

## Migrations

- `npm run migrate:electro-bot` to apply migrations
- `npx knex migrate:make some_migration_name` to create new migration

## Connect to remote Postgre

Staging: `fly proxy 5433 -a pg-electro-bot-stg`, production: `fly proxy 5433 -a pg-electro-bot`.

## Deploy

TODO: this is tmp solution that causes downtime during deployment, come up with normal flow.

!Always deploy staging env first (this minimizes prod downtime since all images are already built).

Staging:

- `fly --config fly.stg.toml scale count 0`
- `fly --config fly.stg.toml deploy`
- `fly --config fly.stg.toml scale count 1`

Production:

- `fly scale count 0`
- `fly deploy`
- `fly scale count 1`

## Restart

Staging: `fly apps restart electrobotstg`, production: `fly apps restart electrobot`.

## Logs

Staging: `fly --config fly.stg.toml logs`, production: `fly logs`.

## Recreate builder

Do this when no space left on builder device:

- `fly apps list | grep builder`
- `fly apps destroy <name>`

## Generate HTML docs

- `npm run gendoc`
