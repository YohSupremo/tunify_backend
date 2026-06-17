module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("admin", "customer"),
        allowNull: false,
        defaultValue: "customer",
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      }
    },
    {
      tableName: "users",
      createdAt: "created_at",
      updatedAt: false,
      underscored: true
    }
  );
  return User;
};
