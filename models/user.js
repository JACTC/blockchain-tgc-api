const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');
module.exports = (sequelize, DataTypes) => {
const User = sequelize.define('User', {
  // Model attributes are defined here
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },  
  wallet: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'User', // We need to choose the model name
    freezeTableName: true
});

// `sequelize.define` also returns the model
console.log(User === sequelize.models.User); // true

return User

 
}