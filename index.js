/* eslint-disable no-console */
const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const cors = require("cors");
const routes = require("./src/routes");
const NotFoundError = require("./src/common/classes/NotFoundError");
const { errorHandler } = require("./src/common/helpers");

const app = express();
const port = 4000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/", routes);

// Path not found handler
app.use("*", (req, res, next) => {
  next(new NotFoundError(req.path));
});

// Error handler
app.use(errorHandler);

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
});

module.exports = app;
