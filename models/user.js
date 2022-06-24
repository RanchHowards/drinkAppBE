import mongoose from "mongoose";

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
  myEvents: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
  ],
});

export default mongoose.model("User", schema);
