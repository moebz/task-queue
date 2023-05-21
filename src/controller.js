"use strict";

const moment = require("moment");
const axios = require("axios");
const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");

const maxConcurrentProcesses = process.env.MAX_CONCURRENT || 3;

let concurrentProcesses = 0;

const processQueue = async (req, res) => {
  const message = await doProcessQueue(req);

  console.log("message", message);

  return res.status(httpStatus.OK).send({
    message,
  });
};

const doProcessQueue = async (req) => {
  let processId = null;
  let logTag = "noProcessId";

  try {
    if (concurrentProcesses >= maxConcurrentProcesses) {
      return {
        message: "Max concurrent processes reached",
        concurrentProcesses,
      };
    }

    concurrentProcesses += 1;

    console.log("concurrentProcesses=", concurrentProcesses);

    const currentDate = moment().format("YYYY-MM-DD HH:mm:ss");

    processId = uuidv4();

    logTag = `processId=${processId}`;

    console.log(logTag, "currentDate", currentDate);

    // Get the oldest task that is valid, pending and has attemps left

    const result = await req.dbClient.query(
      `select
        id,
        status,
        valid_since,
        valid_until,
        url,
        attempts
      from tasks
      where status = 'pending' -- is not in process nor is completed
        and valid_since <= $1 -- is in validity window
        and valid_until > $1 -- is in validity window
        and attempts < attempts_limit -- has attemps left
      order by created_at asc -- fifo
      limit 1`,
      [currentDate]
    );

    const task = result?.rows?.[0];

    if (!task) {
      return { processId, message: `No pending tasks found` };
    }

    // Try to claim the task for this process

    await req.dbClient.query(
      `update tasks
        set status = 'processing',
        process_id = $1
      where
        status = 'pending' -- claim it only if it is still pending
        and id = $2`,
      [processId, task.id]
    );

    // Check if the task was succesfully claimed by this process

    const taskToProcessResult = await req.dbClient.query(
      `select
        id
      from tasks
      where
        status = 'processing'
        and process_id = $1 -- only return it if no other process claimed it
        and id = $2`,
      [processId, task.id]
    );

    const taskToProcess = taskToProcessResult?.rows?.[0];

    if (!taskToProcess) {
      return {
        processId,
        message: `Task no longer pending or taken by another process`,
      };
    }

    // Before executing the task, count the attempt

    await req.dbClient.query(
      `update tasks
        set attempts = attempts + 1
      where
        id = $1`,
      [task.id]
    );

    let requestResult;

    try {
      // Call the worker so the task is executed

      requestResult = await axios.post(task.url);
    } catch (error) {
      // Set it to pending again if there was an error

      console.log(logTag, "workerError", error);
      return updateTaskToPending(req, res, task);
    }

    // Set the task as completed only if the worker
    // stated it explicitly

    if (requestResult?.data?.data?.taskResult === "completed") {
      await req.dbClient.query(
        `update tasks
          set status = 'completed'
        where
          id = $1`,
        [task.id]
      );

      return {
        processId,
        message: `Task completed`,
      };
    }

    // Set it to pending again if the worker
    // didn't explicitly state that it was completed

    console.log(logTag, "invalidWorkerResponse");
    return updateTaskToPending(task);
  } catch (error) {
    console.log(logTag, "unexpectedError.message", error?.message);
    console.log(logTag, "unexpectedError.stack", error?.stack);

    return {
      processId,
      message: `An unexpected error occurred`,
    };
  } finally {
    concurrentProcesses -= 1;
  }
};

const updateTaskToPending = async (req, res, task) => {
  await req.dbClient.query(
    `update tasks
      set status = 'pending',
      process_id = null
    where
      id = $1`,
    [task.id]
  );

  return {
    processId,
    message: `Task not completed`,
  };
};

const addTask = async (req, res) => {
  const { valid_since, valid_until, url, attempts_limit } = req.body;

  await req.dbClient.query(
    `insert into tasks (
      status, -- Status set to 'pending'.
      valid_since, -- It will be executed from this date and time.
      valid_until, -- If it fails, it will be retried until this date and time (or until the attempts_limit is reached).
      url, -- The url to make a POST request to.
      attempts, -- Attempt counter set to zero.
      attempts_limit -- Max number of times to attempt the request.
    ) values (
      $1,$2,$3,$4,$5,$6
    )`,
    ["pending", valid_since, valid_until, url, 0, attempts_limit]
  );

  return res.status(httpStatus.OK).send({
    message: "Task added",
  });
};

module.exports = {
  processQueue,
  addTask,
};
