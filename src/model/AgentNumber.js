import mongoose from "mongoose";

const AgentNumberSchema = new mongoose.Schema(
  {
    merchant: String, // { type: mongoose.Types.ObjectId, ref: "User" },
    mfs: String,
    accountNumber: String,
    limitAmount: Number,
    limitRemaining: Number,
    balanceAmount: Number,
    // accountType: String, // payment, payout
    currency: {
      type: String,
      enum: ["BDT", "INR", "USD"],
      default: "BDT",
    },
    status: {
      type: String,
      enum: ["activated", "deactivated"],
      default: "activated",
    },
  },
  { timestamps: true }
);

const AgentNumber = mongoose.model("AgentNumber", AgentNumberSchema);
export default AgentNumber;
