module.exports = (sequelize, DataTypes) => {
  const ItemImage = sequelize.define(
    "ItemImage",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      image_path: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }
    },
    {
      tableName: "item_images",
      createdAt: "created_at",
      updatedAt: false,
      underscored: true
    }
  );
  return ItemImage;
};
