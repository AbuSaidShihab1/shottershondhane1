import mongoose from "mongoose";

const PayinTransactionSchema = new mongoose.Schema(
  {
    paymentId: String,
    merchant: String,
    provider: String, // bkash, nagad, rocket, upay
    orderId: String,
    payerId: String,
    payerAccount: String,
    agentAccount: String,
    transactionId: String,
    referenceId: String, // for p2c merchantInvoiceNumber
    expectedAmount: Number,
    receivedAmount: Number,
    balanceAmount: Number,
    redirectUrl: String,
    callbackUrl: String,
    sentCallbackDate: Date,
    currency: {
      type: String,
      enum: ["BDT", "INR", "USD"],
      default: "BDT",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "hold", "fully paid", "partially paid", "completed", "suspended", "expired"],
      default: "pending",
    },
    transactionDate: Date,
    submitDate: Date,
    statusDate: Date,
    paymentType: String, // 'p2p' or 'p2c'
    mode: {
      type: String,
      enum: ["test", "live"],
      default: "live",
    },
},
  { timestamps: true }
);

PayinTransactionSchema.index({ merchant: 'text', mode: 'text', transactionId: 'text', orderId: 'text', paymentId: 'text', provider: 'text', agentAccount: 'text', payerAccount: 'text', payerid: 'text', status: 'text' });
const PayinTransaction = mongoose.model("PayinTransaction", PayinTransactionSchema);
export default PayinTransaction;
