const moment = require("moment");
const axios = require("axios");
const httpStatus = require("http-status");

const { v4: uuidv4 } = require("uuid");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// let requests = 0;

const processQueue = async (req, res) => {

  // requests+=1;

  // console.log('requests=', requests);

  await sleep(5000);

  const currentDate = moment().format("YYYY-MM-DD hh:mm:ss");

  const processId = uuidv4();

  const logTag = `processId=${processId}`;

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
    const message = `No pending tasks found`;
    console.log(logTag, "message", message);
    return res.status(httpStatus.OK).send({
      message,
    });
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
    const message = `Task no longer pending or taken by another process`;
    console.log(logTag, "message", message);
    return res.status(httpStatus.OK).send({
      message,
    });
  }

  // Before doing anything, count the attempt

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

    const message = `Task completed`;
    console.log(logTag, "message", message);
    return res.status(httpStatus.OK).send({
      message,
    });
  }

  // Set it to pending again if the worker
  // didn't explicitly state that it was completed

  console.log(logTag, "invalidWorkerResponse");
  return updateTaskToPending(req, res, task);
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

  const message = `Task not completed`;
  console.log(logTag, "message", message);
  return res.status(httpStatus.OK).send({
    message,
  });
};

module.exports = {
  processQueue,
};
