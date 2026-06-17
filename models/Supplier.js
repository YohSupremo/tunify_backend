const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Supplier = sequelize.define(
  "Supplier",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    contact_name: DataTypes.STRING(150),
    email: DataTypes.STRING(255),
    phone: DataTypes.STRING(30),
    address_line: DataTypes.STRING(255),
    deleted_at: DataTypes.DATE,
  },
  {
    tableName: "supplier",
    createdAt: "created_at",
    updatedAt: false,
  },
);

module.exports = Supplier;
