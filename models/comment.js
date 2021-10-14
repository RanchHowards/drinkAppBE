const mongoose = require('mongoose')

const schema = new mongoose.Schema(
  {
    comment: {
      type: String,
      required: true,

      minlength: 1,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },

    responses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comments',
      },
    ],
  },

  { timestamps: true }
)

module.exports = mongoose.model('Comment', schema)
