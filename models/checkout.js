const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

module.exports = (sequelize, DataTypes) => {
const checkout = sequelize.define('checkout', {
  // Model attributes are defined here
  checkoutId: {
    type: DataTypes.UUIDV4,
    defaultValue: DataTypes.UUIDV4
  },  
  fishtank: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date:{
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  period:{
    type: DataTypes.STRING,
    allowNull: false
  },
  status:{
    type: DataTypes.STRING,
    allowNull: false
  },
  pubkey:{
    type: DataTypes.STRING
  }
}, {
//  // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'checkout', // We need to choose the model name
    freezeTableName: true
});

// `sequelize.define` also returns the model
//console.log(User === sequelize.models.User); // true

return checkout

 
}