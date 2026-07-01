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
        allowNull: true,
        defaultValue: null
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sell_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
