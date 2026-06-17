const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: DataTypes.TEXT,
    deleted_at: DataTypes.DATE,
  },
  {
    tableName: "category",
    createdAt: "created_at",
    updatedAt: false,
  },
);

module.exports = Category;
