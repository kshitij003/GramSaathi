const mongoose = require('mongoose')
const dbconnect = require('../db')
const bcrypt = require('bcryptjs');

//Call the db to connect the mongo db
dbconnect()

// User Schema
const UserSchema = mongoose.Schema({
    name: {
        type: String
    },
    username: {
        type: String,
        unique: true,
        required: true
    },
    email: {
        type: String
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String
    }
});

const User = module.exports = mongoose.model('User', UserSchema);

module.exports.registerUser = async function (newUser) {
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(newUser.password, salt);
    return await newUser.save();
}

module.exports.getUserByUsername = async function(username){
    const query = {username: username}
    return await User.findOne(query);
}
  
module.exports.getUserById = async function(id){
    return await User.findById(id);
}

module.exports.comparePassword = async function(candidatePassword, hash){
    return await bcrypt.compare(candidatePassword, hash);
}

module.exports.getEngineer = async function(){
    const query = {role: "jeng"}
    return await User.find(query);
}