const sequelize = require('../config/database');
const Item = require('./Item');
const User = require('./User');
const Customer = require('./Customer');
const Brand = require('./Brand');
const Category = require('./Category');
const Supplier = require('./Supplier');
const ItemImage = require('./ItemImage');
const Review = require('./Review');
const Settings = require('./Settings');
const RestockLog = require('./RestockLog');

const db = {};
db.Item = Item(sequelize, require('sequelize').DataTypes);
db.User = User(sequelize, require('sequelize').DataTypes);
db.Customer = Customer(sequelize, require('sequelize').DataTypes);
db.Brand = Brand(sequelize, require('sequelize').DataTypes);
db.Category = Category(sequelize, require('sequelize').DataTypes);
db.Supplier = Supplier(sequelize, require('sequelize').DataTypes);
db.ItemImage = ItemImage(sequelize, require('sequelize').DataTypes);
db.Review = Review(sequelize, require('sequelize').DataTypes);
db.Settings = Settings(sequelize, require('sequelize').DataTypes);
db.RestockLog = RestockLog(sequelize, require('sequelize').DataTypes);


db.User.hasOne(db.Customer, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE'
});
db.Customer.belongsTo(db.User, {
    foreignKey: 'user_id'
});


db.Brand.hasMany(db.Item, {
    foreignKey: 'brand_id'
});
db.Item.belongsTo(db.Brand, {
    foreignKey: 'brand_id'
});


db.Category.hasMany(db.Item, {
    foreignKey: 'category_id'
});
db.Item.belongsTo(db.Category, {
    foreignKey: 'category_id'
});







db.Item.hasMany(db.ItemImage, {
    foreignKey: 'item_id',
    as: 'images'
});
db.ItemImage.belongsTo(db.Item, {
    foreignKey: 'item_id'
});


db.Item.hasMany(db.RestockLog, {
    foreignKey: 'item_id',
    as: 'restockLogs'
});
db.RestockLog.belongsTo(db.Item, {
    foreignKey: 'item_id'
});
db.Supplier.hasMany(db.RestockLog, {
    foreignKey: 'supplier_id',
    as: 'restockLogs'
});
db.RestockLog.belongsTo(db.Supplier, {
    foreignKey: 'supplier_id'
});


db.Item.hasMany(db.Review, {
    foreignKey: 'item_id',
    as: 'reviews'
});
db.Review.belongsTo(db.Item, {
    foreignKey: 'item_id'
});
db.User.hasMany(db.Review, {
    foreignKey: 'user_id'
});
db.Review.belongsTo(db.User, {
    foreignKey: 'user_id'
});

db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;
