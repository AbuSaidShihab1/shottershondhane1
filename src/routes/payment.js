import express from "express";
import {    
  fetch_status,
  update_trans_status,
  payment,
  payout,
  checkout,
  payment_submit,
  change_payment_status,
  change_payout_status,
  resend_callback_payment,
  resend_callback_payout,
  callback_sms,
} from "../controllers/payment_controller.js";

import { payment_bkash, callback_bkash } from "../controllers/payment_bkash_controller.js"

import { payment_nagad, callback_nagad } from "../controllers/payment_nagad_controller.js"

const router = express.Router();

router.post("/status", fetch_status);
router.get("/updateTransStatus", update_trans_status);

router.post("/payment", payment);
router.post("/payout", payout);
router.post("/checkout", checkout);
router.post("/paymentSubmit", payment_submit);
router.post("/changePaymentStatus", change_payment_status);
router.post("/changePayoutStatus", change_payout_status);
router.post("/resendCallbackPayment", resend_callback_payment);
router.post("/resendCallbackPayout", resend_callback_payout);
router.post("/callbackSms", callback_sms);

router.post("/p2c/bkash/payment", payment_bkash);
router.post("/p2c/bkash/callback", callback_bkash);

router.post("/p2c/nagad/payment", payment_nagad);
router.post("/bkash",payment_bkash)
router.post("/nagad",payment_nagad)

router.post("/p2c/nagad/callback", callback_nagad);


export default router;
