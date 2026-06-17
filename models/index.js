const sequelize = require('../config/database');
const Item = require('./Item');
const Stock = require('./Stock');
const User = require('./User');
const Customer = require('./Customer');

const db = {};
db.Item = Item(sequelize, require('sequelize').DataTypes);
db.Stock = Stock(sequelize, require('sequelize').DataTypes);
db.User = User(sequelize, require('sequelize').DataTypes);
db.Customer = Customer(sequelize, require('sequelize').DataTypes);

// Define associations natively
db.Item.hasOne(db.Stock, {
    foreignKey: 'item_id',
    onDelete: 'CASCADE'
});
db.Stock.belongsTo(db.Item, {
    foreignKey: 'item_id'
});

db.User.hasOne(db.Customer, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE'
});
db.Customer.belongsTo(db.User, {
    foreignKey: 'user_id'
});

db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;
