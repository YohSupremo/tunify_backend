module.exports = (sequelize, DataTypes) => {
  const Item = sequelize.define(
    "Item",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      brand_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      supplier_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      cost_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      sell_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      image_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      }
    },
    {
      tableName: "item",
      createdAt: "created_at",
      updatedAt: false,
      underscored: true
    }
  );
  return Item;
};
