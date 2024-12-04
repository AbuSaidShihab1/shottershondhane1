import mongoose from "mongoose";

const PayoutTransactionSchema = new mongoose.Schema(
  {
    paymentId: String,
    merchant: String,
    provider: String, // BKASH Personal, NAGAD Personal, Rocket Personal, Upay Personal
    orderId: String,
    payeeId: String,
    payeeAccount: String,
    agentAccount: String,
    transactionId: String,
    requestAmount: Number,
    sentAmount: Number,
    balanceAmount: Number,
    callbackUrl: String,
    sentCallbackDate: Date,
    currency: {
      type: String,
      enum: ["BDT", "INR", "USD"],
      default: "BDT",
    },
    // paymentType: String,
    status: {
      type: String,
      enum: ["pending", "hold", "assigned", "sent", "completed", "rejected", "failed"],
      default: "pending",
    },
    transactionDate: Date,
    statusDate: Date,
    mode: {
      type: String,
      enum: ["test", "live"],
      default: "live",
    },
},
  { timestamps: true }
);

PayoutTransactionSchema.index({ merchant: 'text', mode: 'text', transactionId: 'text', orderId: 'text', paymentId: 'text', provider: 'text', agentAccount: 'text', payeeAccount: 'text', payeeid: 'text', status: 'text' });
const PayoutTransaction = mongoose.model("PayoutTransaction", PayoutTransactionSchema);
export default PayoutTransaction;
