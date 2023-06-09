const router = require("express").Router();

const middleware = require("./common/middleware");
const taskController = require("./controller");

const { wrapMidd } = require("./common/helpers");

router.post(
  "/queue/process",
  middleware.getDbClient,
  wrapMidd(taskController.processQueue)
);

router.post(
  "/task",
  middleware.getDbClient,
  wrapMidd(taskController.addTask)
);

router.post("/ping", (req, res) => {
  console.log("answering to ping");
  return res.send({
    data: { taskResult: "completed" },
  });
});

module.exports = router;
