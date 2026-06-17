const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DATABASE,
  process.env.DB_USER,
  process.env.DB_PASSWORD,

  {
    host: process.env.DB_HOST,
    dialect: "mysql",
  },
);

sequelize
  .authenticate()
  .then(() => console.log("DB connected"))
  .catch((err) => console.error("DB connection failed:", err));

module.exports = sequelize;
