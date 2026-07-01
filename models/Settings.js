module.exports = (sequelize, DataTypes) => {
  const Settings = sequelize.define(
    "Settings",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        defaultValue: 1,
      },
      low_stock_threshold: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      default_shipping_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100.00,
      },
      store_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "Tunify",
      },
      store_contact_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      store_contact_phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
    },
    {
      tableName: "settings",
      timestamps: false,
    }
  );
  return Settings;
};
