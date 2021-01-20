const mongoose = require("mongoose");

const URLSchema = mongoose.Schema({
  url: String,
  updateInterval: Number,
  createdAt: Number,
  statuses: [
    {
      alive: Boolean,
      timestamp: Number,
      responseTime: Number,
      _id: { id: false },
    },
  ],
});

module.exports = mongoose.model("urls", URLSchema);
