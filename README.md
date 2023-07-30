# Simple task queue

This is a simple task queue made using Node.js + Express and Postgres.

## How it works

Tasks are saved in Postgres by making a POST request to /task.

You can request the queue processor to get a pending task and execute it by making a POST request to /queue/process. This endpoint can be executed every N seconds using a cron job.

## Set up

npm install

cp .env.example .env

Open the .env file and set the Postgres credentials and database name

Create the tasks table using the SQL file in this file /sql/tasks-table.sql

## Running the app

node index.js

## Cron example

To execute the queue processor every 10 seconds, add to a cron tab these lines:

    * * * * * curl -X POST http://localhost:4000/queue/process
    * * * * * sleep 10; curl -X POST http://localhost:4000/queue/process
    * * * * * sleep 20; curl -X POST http://localhost:4000/queue/process
    * * * * * sleep 30; curl -X POST http://localhost:4000/queue/process
    * * * * * sleep 40; curl -X POST http://localhost:4000/queue/process
    * * * * * sleep 50; curl -X POST http://localhost:4000/queue/process
