const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

module.exports = (sequelize, DataTypes) => {
const rsvp = sequelize.define('rsvp', {
  // Model attributes are defined here
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },  
  fishtank: {
    type: DataTypes.STRING,
    allowNull: false
  },
  pubkey: {
    type: DataTypes.STRING
  },  
  wallet: {
    type: DataTypes.STRING,
    allowNull: false
  },  
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },  
  period: {
    type: DataTypes.STRING,
    allowNull: false
  },  
  checkoutId: {
    type: DataTypes.STRING,
    allowNull: false
  },  

}, {
//  // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'rsvp', // We need to choose the model name
    freezeTableName: true
});

// `sequelize.define` also returns the model
//console.log(User === sequelize.models.User); // true

return rsvp

 
}