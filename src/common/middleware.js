const httpStatus = require("http-status");

require("dotenv").config();
const { db } = require("./database");
const ApiError = require("./classes/ApiError");

// Middleware to get a db client
// to execute queries.
const getDbClient = async (req, res, next) => {
  const client = await db.getClient();
  req.dbClient = client;
  next();
};

module.exports = {
  getDbClient,
};
