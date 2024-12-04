import mongoose from "mongoose";

const ApiAccountNagadSchema = new mongoose.Schema(
  {
    accountName: String,
    accountNumber: String,
    username: String,
    password: String,
    appKey: String,
    appSecretKey: String,
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

const ApiAccountNagad = mongoose.model(
  "ApiAccountNagad",
  ApiAccountNagadSchema
);
export default ApiAccountNagad;
