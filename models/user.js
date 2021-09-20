const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 2,
  },
  pic: { type: String },
  drink: { type: String },
})

module.exports = mongoose.model('User', schema)
