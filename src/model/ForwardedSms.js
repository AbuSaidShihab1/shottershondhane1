import mongoose from "mongoose";

const ForwardedSmsSchema = new mongoose.Schema(
  {
    provider: String, // BKASH Agent, Nagad Agent,Rocket Agent,Upay Agent
    agentAccount: String,
    customerAccount: String,
    transactionType: String, // payin, payout
    currency: {
      type: String,
      enum: ["BDT", "INR", "USD"],
      default: "BDT",
    },
    transactionAmount: Number,
    feeAmount: Number,
    balanceAmount: Number,
    transactionId: String,
    transactionDate: Date,
    sentStamp: String,
    receivedStamp: String,
    status: {
      type: String,
      enum: ["arrived", "used", "confirmed"],
      default: "arrived",
    },
},
  { timestamps: true }
);

const ForwardedSms = mongoose.model("ForwardedSms", ForwardedSmsSchema);
export default ForwardedSms;
