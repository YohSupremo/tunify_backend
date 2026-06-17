const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Brand = sequelize.define(
  "Brand",
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
    logo_path: DataTypes.STRING(255),
    deleted_at: DataTypes.DATE,
  },
  {
    tableName: "brand",
    createdAt: "created_at",
    updatedAt: false,
  },
);

module.exports = Brand;
