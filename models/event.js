const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
    minlength: 2,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  attendees: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  location: { type: String },
  eventType: { type: String },
  eventPic: { type: String },
})

module.exports = mongoose.model('Event', schema)
