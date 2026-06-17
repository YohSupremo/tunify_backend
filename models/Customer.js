module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define(
    "Customer",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      address_line: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      zip_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      profile_image_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      }
    },
    {
      tableName: "customer",
      createdAt: "created_at",
      updatedAt: false,
      underscored: true
    }
  );
  return Customer;
};
