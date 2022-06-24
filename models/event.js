import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      minlength: 2,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    location: { type: String },
    eventType: { type: String },
    description: { type: String },
    eventPic: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTJ8fHBhcnR5fGVufDB8fDB8fA%3D%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
    },
    max: { type: Boolean },
    maxGuests: { type: Number },
    eventDate: { type: Date, default: Date.now },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  { timestamps: true }
);

export default mongoose.model("Event", schema);
