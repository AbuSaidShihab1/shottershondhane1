import PayinTransaction from "../model/PayinTransaction.js";
import PayoutTransaction from "../model/PayoutTransaction.js";
import User from "../model/User.js";
import getCountryISO3 from "country-iso-2-to-3";
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import ShortUniqueId from 'short-unique-id';
import querystring from 'querystring';
import crypto, { sign } from 'crypto';
import TelegramBot from 'node-telegram-bot-api';
import ForwardedSms from "../model/ForwardedSms.js";
import AgentNumber from "../model/AgentNumber.js";
import { fetchPayinTransactions } from "./client_controller.js";
import cron from 'node-cron';

const easypay_bot = new TelegramBot('7695376916:AAG-uLbiZ4TihTCZFE1noisu3WO8KHKJlr0');
const easypay_payin_bot = new TelegramBot('7781747255:AAH43uavlFgaIaRkQUtjicswFHbk86YFA80');
const easypay_payout_bot = new TelegramBot('7239382816:AAG6ujAczpEEAZftr5O5eJbqbhoy2eBc3Yk');
const easypay_request_payout_bot = new TelegramBot('8181052206:AAHgnpvHaHNw_ssd97V4K-EdkBHoU78E-N4');

const SERVER_URL = 'https://eassypay.com/api';
const BASE_URL = 'https://eassypay.com';

function generate256Hash(data) {
  // Use SHA256 to generate a hash
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

function generateHmacSha512(data, key) {
  // Use HMAC-SHA512 to generate a hash
  const hmac = crypto.createHmac('sha512', key);
  hmac.update(data);
  return hmac.digest('hex');
}

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const fetch_status = async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const data = req.body;
  console.log('fetch-status', data);

  try {
    const merchant = await User.findOne({name: data.mid, apiKey, status: 'activated'});
    // console.log('merchant', merchant);
    if (!merchant) {
      return res.status(200).json({
        success: false,
        message: "There is not existing activated merchant with API key"
      })
    }

    if (!data.mid || !data.orderId) {
      return res.status(200).json({
        success: false,
        message: "Please send correct mid and orderId for checking PayinTransaction."
      })
    }

    let where = {
			merchantId: data.mid,
      orderId: data.orderId,
		};
    if (data.transactionId) {
      where.transactionId =  data.transactionId;
    }
    const PayinTransaction = await PayinTransaction.findOne(where);

		if (!PayinTransaction) {
			return res.status(200).json({
        success: false,
        message: "There is not existing PayinTransaction with provided order id and PayinTransaction id"
      })
		}
		
    return res.status(200).json({
      success: true,
      status: PayinTransaction.status,
      amount: PayinTransaction.amount,
      currency: PayinTransaction.currency,
      time: PayinTransaction.statusDate,
    })

  } catch (e) {
    console.log('fetch-status-error', e.message)
    res.status(400).json({ 
      success: false,
      message: "Bad request" 
    });
  }
};

export const update_trans_status = async (req, res) => {
  console.log('---update_trans_status---');
	console.log('req.query', req.query); // https://easypay.com/api/payment/updateTransStatus?transactionId=GwiMnCU7&status=approved
	const data = req.query;
	const txId = data.transactionId;
	try {
		const payinTransaction = await PayinTransaction.findOne({
			transactionId: txId,
		});
		if (!payinTransaction) {
			return res.send("There is no PayinTransaction.");
		}
		
    payinTransaction.status = data.status;
    payinTransaction.response = JSON.stringify(data);
    payinTransaction.statusDate = new Date();
    if (data.paymentId)
      payinTransaction.paymentId = data.paymentId;
    if (data.mode)
      payinTransaction.mode = data.mode;
    await payinTransaction.save();

    
    let payload = {};
    if (payinTransaction.status === "approved") {
      payload = {
        orderId: payinTransaction.orderId,
        status: "success",
        hash: payinTransaction.hash,
        transactionId: payinTransaction.transactionId,
        amount: payinTransaction.amount,
        currency: payinTransaction.currency,
        message: "This PayinTransaction has been completed."
      };
    } else {
      payload = {
        orderId: payinTransaction.orderId,
        status: "fail",
        message: "An error occured. PayinTransaction failed or not founds."
      };
    }

    if (payinTransaction.callbackUrl) {
      await axios
      .post(
        payinTransaction.callbackUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      )
      .then(async (resp) => {
        console.log('update-trans-status-callback-trnsxnd-hpp-callback-to-mechant-resp', resp.data);
        res.send('PayinTransaction status has been updated and returned callback to its callbackUrl. ' + JSON.stringify(resp.data));  
      })
      .catch((e) => {
        console.log('update-trans-status-callback-trnsxnd-hpp-callback-to-mechant-resp-error', e.message);
        res.send('PayinTransaction status has been updated and returned callback to its callbackUrl. ' + e.message);  
      });
    }
    
  } catch (e) {
    console.log('update_trans_status_error', e.message);
    return res.send('Updating PayinTransaction status failed.');  
  }
};

const capitalize = (str) => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export const payment = async (req, res) => {
  const apiKey = req.headers["x-api-key"] ? req.headers["x-api-key"] : "";
  const data = req.body;
  console.log("payment-data", data);

  if (
    !data.mid ||
    !data.provider ||
    !data.orderId ||
    !data.payerId ||
    !data.amount ||
    !data.currency ||
    !data.redirectUrl
  ) {
    // || !data.callbackUrl
    return res.status(200).json({
      success: false,
      orderId: data.orderId,
      message: "Required fields are not filled out.",
    });
  }

  if (
    (data.currency === "BDT" || data.currency === "INR") &&
    parseFloat(data.amount) < 300
  ) {
    return res.status(200).json({
      success: false,
      orderId: data.orderId,
      message: `Minimum deposit amount should be at least 300 for ${data.currency} currency.`,
    });
  } else if (data.currency === "USD" && parseFloat(data.amount) < 10) {
    return res.status(200).json({
      success: false,
      orderId: data.orderId,
      message: "Minimum deposit amount should be at least 10 for USD currency.",
    });
  }

  try {
    const merchant = await User.findOne({
      name: data.mid,
      status: "activated",
    });
    if (data.mid !== "merchant1" && (!merchant || merchant.apiKey !== apiKey)) {
      return res.status(200).json({
        success: false,
        orderId: data.orderId,
        message: "There is not existing activated merchant with API key",
      });
    }

    const payinTransaction = await PayinTransaction.findOne({
      orderId: data.orderId,
      merchant: data.mid,
    });

    if (payinTransaction) {
      console.log(
        "same order id for payment",
        data.orderId,
        payinTransaction.status
      );
      return res.status(200).json({
        success: false,
        orderId: data.orderId,
        message: "Transaction with duplicated order id, " + data.orderId + ".",
      });
    }

    let criteria = {};
    criteria = {
      $and: [
        {
          limitRemaining: {
            $gte: 0, // $gte: transaction.expectedAmount
            // $lte: transaction.expectedAmount
          },
        },
        { merchant: data.mid },
        { mfs: data.provider },
        { currency: data.currency },
        { status: "activated" },
      ],
    };

    const agentNumbers = await AgentNumber.find(criteria)
      .sort({ limitRemaining: -1 })
      .limit(1);

    if (agentNumbers.length == 0) {
      return res.status(200).json({
        success: false,
        orderId: data.orderId,
        message: "There is no available agent number for a specific provider",
      });
    }

    const paymentId = nanoid(8); // uuidv4();

    const newTransaction = await PayinTransaction.create({
      paymentId,
      merchant: data.mid,
      provider: data.provider,
      orderId: data.orderId,
      payerId: data.payerId,
      expectedAmount: data.amount,
      currency: data.currency,
      redirectUrl: data.redirectUrl,
      callbackUrl: data.callbackUrl,
      paymentType: "p2p",
    });

    return res.status(200).json({
      success: true,
      message: "Payment link created.",
      orderId: data.orderId,
      paymentId,
      link: `http://localhost:3000/checkout/${paymentId}`,
    });
  } catch (e) {
    console.log("payment-general-error", e.message);

    res.status(500).json({
      success: false,
      orderId: data.orderId,
      message: e.message,
    });
  }
};

export const payout = async (req, res) => {
  const apiKey = req.headers["x-api-key"] ? req.headers["x-api-key"] : "";
  const data = req.body;
  console.log("payout-data", data);

  if (
    !data.mid ||
    !data.provider ||
    !data.orderId ||
    !data.payeeId ||
    !data.payeeAccount ||
    !data.amount ||
    !data.currency
  ) {
    // || !data.callbackUrl
    return res.status(200).json({
      success: false,
      orderId: data.orderId,
      message: "Required fields are not filled out.",
    });
  }

  if (
    (data.currency === "BDT" || data.currency === "INR") &&
    (parseFloat(data.amount) < 10 || parseFloat(data.amount) > 25000)
  ) {
    return res.status(200).json({
      success: false,
      orderId: data.orderId,
      message: `Withdraw amount should be in 10 ~ 25000 for ${data.currency} currency.`,
    });
  } else if (
    data.currency === "USD" &&
    (parseFloat(data.amount) < 10 || parseFloat(data.amount) > 2000)
  ) {
    return res.status(200).json({
      success: false,
      orderId: data.orderId,
      message: "Withdraw amount should be in 10 ~ 2000 for USD currency.",
    });
  }

  try {
    const merchant = await User.findOne({
      name: data.mid,
      status: "activated",
    });
    if (data.mid !== "easypay" && (!merchant || merchant.apiKey !== apiKey)) {
      return res.status(200).json({
        success: false,
        orderId: data.orderId,
        message: "There is not existing activated merchant with API key",
      });
    }

    const payoutTransaction = await PayoutTransaction.findOne({
      orderId: data.orderId,
      merchant: data.mid,
    });
    if (
      payoutTransaction &&
      (payoutTransaction.status === "sent" ||
        payoutTransaction.status === "completed")
    ) {
      console.log(
        "same order id for payout",
        data.orderId,
        payoutTransaction.status
      );
      return res.status(200).json({
        success: false,
        orderId: data.orderId,
        message: "Transaction with duplicated order id, " + data.orderId + ".",
      });
    }

    let criteria = {};
    criteria = {
      $and: [
        // { limitRemaining:
        //   {
        //     $gte: 0, // $gte: transaction.expectedAmount
        //     // $lte: transaction.expectedAmount
        //   }
        // },
        { merchant: data.mid },
        { mfs: data.provider },
        { currency: data.currency },
        { status: "activated" },
      ],
    };

    const agentNumbers = await AgentNumber.find(criteria)
      .sort({ limitRemaining: -1 })
      .limit(1);

    // if (agentNumbers.length == 0) {
    //   return res.status(200).json({
    //     success: false,
    //     orderId: data.orderId,
    //     message: "There is no available agent number for a specific provider."
    //   });
    // }

    const paymentId = nanoid(8); // uuidv4();

    const newTransaction = await PayoutTransaction.create({
      paymentId,
      merchant: data.mid,
      provider: data.provider,
      orderId: data.orderId,
      payeeId: data.payeeId,
      payeeAccount: data.payeeAccount,
      requestAmount: data.amount,
      currency: data.currency,
      callbackUrl: data.callbackUrl,
      status: "assigned",
    });

    const payload =
      "New Payout Alert!\n" +
      "\n" +
      "Order id: " +
      data.orderId +
      "\n" +
      "Bank name: " +
      capitalize(data.provider) +
      " Personal\n" +
      "Payee wallet: `" +
      data.payeeAccount +
      "`\n" +
      data.currency +
      " amount: " +
      data.amount +
      "\n";

    easypay_request_payout_bot.sendMessage(-1002121763678, payload, {
      parse_mode: "Markdown",
    });

    if (data.mid !== "easypay") {
      const hash = generate256Hash(
        paymentId +
          newTransaction.orderId +
          newTransaction.requestAmount.toString() +
          newTransaction.currency +
          merchant.apiKey
      );

      let paybody = {
        success: true,
        paymentId: paymentId,
        orderId: newTransaction.orderId,
        amount: newTransaction.requestAmount,
        currency: newTransaction.currency,
        transactionId: "",
        status: newTransaction.status,
        hash,
      };

      await axios
        .post(data.callbackUrl, paybody, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        })
        .then(async (resp) => {
          console.log("payout-callback-to-mechant-resp", resp.data);
          if (resp.data.success) {
            newTransaction.sentCallbackDate = new Date();
            await newTransaction.save();
          }
        })
        .catch((e) => {
          console.log("payout-callback-to-mechant-resp-error", e.message);
        });
    }

    return res.status(200).json({
      success: true,
      message: "Payout request received.",
      orderId: data.orderId,
      paymentId,
    });
  } catch (e) {
    console.log("payout-general-error", e.message);

    res.status(500).json({
      success: false,
      orderId: data.orderId,
      message: e.message,
    });
  }
};

export const checkout = async (req, res) => {
  const { paymentId } = req.body;
  console.log("checkout-paymentId", paymentId);

  try {
    const transaction = await PayinTransaction.findOne({ paymentId });
    if (transaction) {
      let criteria = {};
      criteria = {
        $and: [
          {
            limitRemaining: {
              $gte: 0, // $gte: transaction.expectedAmount
              // $lte: transaction.expectedAmount
            },
          },
          { merchant: transaction.merchant },
          { mfs: transaction.provider },
          { currency: transaction.currency },
          { status: "activated" },
        ],
      };

      const agentNumbers = await AgentNumber.find(criteria)
        .sort({ limitRemaining: -1 })
        .limit(1);

      // console.log('available-agent-numbers', agentNumbers);

      const data = {
        amount: transaction.expectedAmount,
        currency: transaction.currency,
        provider: transaction.provider,
        agentAccount: agentNumbers[0].accountNumber,
        redirectUrl: transaction.redirectUrl,
      };

      // console.log('checkout-data', data);

      res.status(200).json({ success: true, data });
    } else {
      res
        .status(200)
        .json({
          success: false,
          message: "There is no transaction with payment id",
        });
    }
  } catch (error) {
    console.log("checkout-error", error.message);

    res.status(404).json({ message: error.message });
  }
};

export const payment_submit = async (req, res) => {
  console.log("---payment-submit-data---");
  let data = req.body;
  console.log(data);
  const { paymentId, provider, agentAccount, payerAccount, transactionId } =
    req.body;

  try {
    const forwardedSms = await ForwardedSms.findOne({
      transactionId,
      transactionType: "payin",
      provider:"bkash",
      agentAccount:"01688494103",
      customerAccount: "01688494104",
    }); // , status: 'arrived'
    if (!forwardedSms) {
      // transaction should be arrived via forwarded sms from mfs provider
      return res
        .status(200)
        .json({
          success: false,
          type: "tid",
          message: "Transaction ID is not valid.",
        });
    }

    const transaction_old = await PayinTransaction.findOne({ transactionId });
    if (transaction_old) {
      // transaction id should be used only one time.
      return res
        .status(200)
        .json({
          success: false,
          type: "tid",
          message: "Transaction ID is used already.",
        });
    }

    // console.log('wwwwwwwwwwwwwwwwww', forwardedSms, transaction_old);

    const transaction = await PayinTransaction.findOne({ paymentId });
    if (!transaction) {
      // transaction should be existing in payintransctions with a unique payment id
      return res
        .status(200)
        .json({
          success: false,
          type: "pid",
          message: "There is no transaction with your payment id.",
        });
    }

    const expirationDuration = 24 * 60 * 60 * 1000;
    const currentTime = new Date();
    const elapsedTime = currentTime - transaction.createdAt;

    // if (elapsedTime > expirationDuration) { // if checkout page created before 1 day, this transaction is expired
    //   transaction.status = "expired";
    //   transaction.statusDate = currentTime;
    //   await transaction.save();
    //   return res.status(200).json({success: false, type: 'pid', message: 'Your payment transaction is expired.'});
    // }

    // transaction is updated for some fields with forwarded sms transaction info
    transaction.agentAccount = forwardedSms.agentAccount;
    transaction.payerAccount = forwardedSms.customerAccount;
    transaction.transactionId = forwardedSms.transactionId;
    transaction.receivedAmount = forwardedSms.transactionAmount;
    transaction.balanceAmount = forwardedSms.balanceAmount;
    transaction.transactionDate = forwardedSms.transactionDate;
    transaction.submitDate = currentTime;
    transaction.statusDate = currentTime;
    transaction.status =
      elapsedTime > expirationDuration ? "expired" : "processing";
    await transaction.save();

    /************** moved to callback_sms **************/
    // const agentNumber = await AgentNumber.findOne({agentAccount});
    // if (agentNumber) { // agent number's balance and remaining limit should be updated with transaction amount
    //   agentNumber.balanceAmount = forwardedSms.balanceAmount;
    //   agentNumber.limitRemaining = parseFloat(agentNumber.limitRemaining) - parseFloat(forwardedSms.transactionAmount);
    //   await agentNumber.save();
    // }

    forwardedSms.status = "used"; // finally, forwarded sms should be updated to 'used' from 'arrived' of original status
    await forwardedSms.save();

    if (elapsedTime > expirationDuration) {
      // if checkout page created before 1 day, this transaction is expired
      return res
        .status(200)
        .json({
          success: false,
          type: "pid",
          message: "Your payment transaction is expired.",
        });
    } else {
      return res
        .status(200)
        .json({ success: true, message: "Your payment is received." });
    }
  } catch (error) {
    console.log("payment-submit-error", error.message);

    res.status(404).json({ message: error.message });
  }
};

export const change_payment_status = async (req, res) => {
  const { id, status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ message: 'Please check all fields' });
  }

  try {
    const transaction = await PayinTransaction.findById(id);
    if (!transaction) throw Error('Transaction does not exists');

    transaction.status = status;
    transaction.statusDate = new Date();

    const savedTransaction = await transaction.save();
    if (!savedTransaction) throw Error('Something went wrong saving the status of transaction');
    
    let result = {
      success: true,
    };

    if (transaction.callbackUrl && (status === 'fully paid' || status === 'partially paid' || status === 'suspended')) {
      
      const merchant = await User.findOne({name: transaction.merchant, role: 'merchant'});
      if (!merchant) throw Error('Merchant does not exist for callback');

      const hash = generate256Hash(transaction.paymentId + transaction.orderId + transaction.receivedAmount.toString() + transaction.currency + merchant.apiKey);

      let payload = {
        paymentId: transaction.paymentId,
        orderId: transaction.orderId,
        amount: transaction.receivedAmount,
        currency: transaction.currency,
        transactionId: transaction.transactionId,
        status,
        hash,
      };

      result  = await axios
      .post(
        transaction.callbackUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      )
      .then(async (resp) => {
        console.log('change-payment-status-callback-to-mechant-resp', resp.data);
        if (resp.data.success) {
          transaction.sentCallbackDate = new Date();
          await transaction.save();
        }
        return {
          success: true,
          message: 'Callback has been sent to the merchant successfully'
        }; 
      })
      .catch((e) => {
        console.log('change-payment-status-callback-to-mechant-resp-error', e.message);
        return {
          success: false,
          message: 'Callback to the merchant failed'
        };   
      });
    }

    res.status(200).json(result);

  } catch (e) {
    res.status(400).json({ 
      success: false,
      error: e.message 
    });
  }
};

export const change_payout_status = async (req, res) => {
  const { id, status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ message: 'Please check all fields' });
  }

  try {
    const transaction = await PayoutTransaction.findById(id);
    if (!transaction) throw Error('Transaction does not exists');

    transaction.status = status;
    transaction.statusDate = new Date();

    const savedTransaction = await transaction.save();
    if (!savedTransaction) throw Error('Something went wrong saving the status of transaction');
    
    let result = {
      success: true,
    };

    if (transaction.callbackUrl && (status === 'assigned' || status === 'sent' || status === 'rejected' || status === 'failed')) {
      
      const merchant = await User.findOne({name: transaction.merchant, role: 'merchant'});
      if (!merchant) throw Error('Merchant does not exists for callback');

      const hash = generate256Hash(transaction.paymentId + transaction.orderId + transaction.sentAmount.toString() + transaction.currency + merchant.apiKey);

      let payload = {
        paymentId: transaction.paymentId,
        orderId: transaction.orderId,
        amount: transaction.sentAmount,
        currency: transaction.currency,
        transactionId: transaction.transactionId,
        status,
        hash,
      };

      result  = await axios
      .post(
        transaction.callbackUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      )
      .then(async (resp) => {
        console.log('change-payout-status-callback-to-mechant-resp', resp.data);
        if (resp.data.success) {
          transaction.sentCallbackDate = new Date();
          await transaction.save();
        }
        return {
          success: true,
          message: 'Callback has been sent to the merchant successfully'
        }; 
      })
      .catch((e) => {
        console.log('change-payout-status-callback-to-mechant-resp-error', e.message);
        return {
          success: false,
          message: 'Callback to the merchant failed'
        };   
      });
    }

    res.status(200).json(result);

  } catch (e) {
    res.status(400).json({ 
      success: false,
      error: e.message 
    });
  }
};

export const resend_callback_payment = async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Please check all fields' });
  }

  try {
    const transaction = await PayinTransaction.findById(id);
    if (!transaction) throw Error('Transaction does not exists');

    let result = {
      success: true,
    };

    if (transaction.callbackUrl) {
      
      const merchant = await User.findOne({name: transaction.merchant, role: 'merchant'});
      if (!merchant) throw Error('Merchant does not exists for callback');

      const hash = generate256Hash(transaction.paymentId + transaction.orderId + transaction.receivedAmount.toString() + transaction.currency + merchant.apiKey);

      let payload = {
        paymentId: transaction.paymentId,
        orderId: transaction.orderId,
        amount: transaction.receivedAmount,
        currency: transaction.currency,
        transactionId: transaction.transactionId,
        status: transaction.status,
        hash,
      };

      result  = await axios
      .post(
        transaction.callbackUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      )
      .then(async (resp) => {
        console.log('resend-callback-payment-to-mechant-resp', resp.data);
        if (resp.data.success) {
          transaction.sentCallbackDate = new Date();
          await transaction.save();
        }
        return {
          success: true,
          message: 'Callback has been sent to the merchant successfully'
        }; 
      })
      .catch((e) => {
        console.log('resend-callback-payment-to-mechant-resp-error', e.message);
        return {
          success: false,
          message: 'Callback to the merchant failed'
        };   
      });
    }

    res.status(200).json(result);

  } catch (e) {
    res.status(400).json({ 
      success: false,
      error: e.message 
    });
  }
};

export const resend_callback_payout = async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Please check all fields' });
  }

  try {
    const transaction = await PayoutTransaction.findById(id);
    if (!transaction) throw Error('Transaction does not exists');

    let result = {
      success: true,
    };

    if (transaction.callbackUrl) {
      
      const merchant = await User.findOne({name: transaction.merchant, role: 'merchant'});
      if (!merchant) throw Error('Merchant does not exists for callback');

      const hash = generate256Hash(transaction.paymentId + transaction.orderId + transaction.sentAmount.toString() + transaction.currency + merchant.apiKey);

      let payload = {
        paymentId: transaction.paymentId,
        orderId: transaction.orderId,
        amount: transaction.sentAmount,
        currency: transaction.currency,
        transactionId: transaction.transactionId,
        status: transaction.status,
        hash,
      };

      result  = await axios
      .post(
        transaction.callbackUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      )
      .then(async (resp) => {
        console.log('resend-callback-payout-to-mechant-resp', resp.data);
        if (resp.data.success) {
          transaction.sentCallbackDate = new Date();
          await transaction.save();
        }
        return {
          success: true,
          message: 'Callback has been sent to the merchant successfully'
        }; 
      })
      .catch((e) => {
        console.log('resend-callback-payout-to-mechant-resp-error', e.message);
        return {
          success: false,
          message: 'Callback to the merchant failed'
        };   
      });
    }

    res.status(200).json(result);

  } catch (e) {
    res.status(400).json({ 
      success: false,
      error: e.message 
    });
  }
};

export const callback_sms = async (req, res) => {
  console.log('---callback_sms---');
  const data = req.body;

  try {
    const {
      provider,
      agentAccount,
      customerAccount,
      transactionType,
      transactionAmount,
      feeAmount,
      balanceAmount,
      transactionId,
      sentStamp,
      receivedStamp,
      transactionDate, // Ensure this is a valid date
    } = data;

    // Validate required fields
    if (
      !provider ||
      !agentAccount ||
      !transactionType ||
      !transactionAmount ||
      !transactionId ||
      !transactionDate
    ) {
      throw new Error('Missing required fields.');
    }

    // Parse and validate `transactionDate`
    const parsedTransactionDate = new Date(transactionDate);
    if (isNaN(parsedTransactionDate.getTime())) {
      throw new Error('Invalid transactionDate format. Must be a valid ISO 8601 date.');
    }

    // Ensure `currency` is valid (use default 'BDT' if missing)
    const currency = 'BDT';

    // Save transaction to the database
    const newTransaction = await ForwardedSms.create({
      provider,
      agentAccount,
      customerAccount,
      transactionType,
      currency,
      transactionAmount: parseFloat(transactionAmount),
      feeAmount: parseFloat(feeAmount),
      balanceAmount: parseFloat(balanceAmount),
      transactionId,
      transactionDate: parsedTransactionDate,
      sentStamp,
      receivedStamp,
    });

    // Update agent balance and limit
    const agentNumber = await AgentNumber.findOne({ agentAccount });
    if (agentNumber) {
      agentNumber.balanceAmount = balanceAmount;
      if (transactionType.toLowerCase() === 'payin') {
        agentNumber.limitRemaining = parseFloat(agentNumber.limitRemaining) - parseFloat(transactionAmount);
      }
      await agentNumber.save();
    }

    // Handle payouts
    if (transactionType.toLowerCase() === 'payout') {
      const payoutTransaction = await PayoutTransaction.findOne({
        provider,
        payeeAccount: customerAccount,
        requestAmount: parseFloat(transactionAmount),
        currency: 'BDT',
        status: 'assigned',
      }).sort({ createdAt: 1 });

      if (payoutTransaction) {
        payoutTransaction.agentAccount = agentAccount;
        payoutTransaction.transactionId = transactionId;
        payoutTransaction.sentAmount = parseFloat(transactionAmount);
        payoutTransaction.balanceAmount = parseFloat(balanceAmount);
        payoutTransaction.transactionDate = parsedTransactionDate;
        await payoutTransaction.save();
      }
    }

    return res.status(200).json({ success: true, transaction: newTransaction });
  } catch (error) {
    console.error('Error processing callback_sms:', error.message);
    return res.status(400).json({ success: false, error: error.message });
  }
};

// export const callback_sms = async (req, res) => {

//   console.log('---callback_sms---');
// 	let data = req.body;
// 	console.log(data);

//   // return res.status(200).json({
//   //   success: true
//   // });

//   let text = JSON.stringify(data?.text);
//   // console.log(text);

//   let provider = data?.from?.toLowerCase();
//   let agentAccount = data?.number;
//   let sentStamp = data?.sentStamp;
//   let receivedStamp = data?.receivedStamp;
//   let customerAccount = '';
//   let transactionType = '';
//   let currency = '';
//   let transactionAmount = 0;
//   let feeAmount = 0;
//   let balanceAmount = 0;
//   let transactionId = '';
//   let transactionDate = '';

//   if (provider === 'nagad') {

//     if (text.includes("Cash In")) {
//       transactionType = "payout";
//     } else if (text.includes("Cash Out")) {
//       transactionType = "payin";
//     }
//     //  else {
//     //   easypay_bot.sendMessage(-1002018697203, JSON.stringify(data));
//     //   return res.sendStatus(200);
//     // }
    
//     transactionAmount = parseFloat(text.match(/Amount: Tk ([\d.]+)/)[1]);
//     customerAccount = text.match(/Customer: (\d+)/)[1];
//     transactionId = text.match(/TxnID: (\w+)/)[1];
//     feeAmount = parseFloat(text.match(/Comm: Tk ([\d.]+)/)[1]);
//     balanceAmount = parseFloat(text.match(/Balance: Tk ([\d.]+)/)[1]);
//     transactionDate = text.match(/(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/)[0];
//     currency = text.match(/Amount: (\w+)/)[1];
//     currency = (currency === 'Tk')?'BDT':currency;

//   } else if (provider === 'bkash') {

//     if (text.includes("Cash In")) {
//       transactionType = "payout";
//     } else if (text.includes("Cash Out")) {
//       transactionType = "payin";
//     }
//     //  else {
//     //   easypay_bot.sendMessage(-1002018697203, JSON.stringify(data));
//     //   return res.sendStatus(200);
//     // }
    
//     transactionAmount = (transactionType === "payout")?parseFloat(text.match(/Cash In Tk ([\d,.]+)/)[1].replace(/,/g, '')):parseFloat(text.match(/Cash Out Tk ([\d,.]+)/)[1].replace(/,/g, ''));
//     customerAccount = (transactionType === "payout")?text.match(/to (\d+)/)[1]:text.match(/from (\d+)/)[1];
//     transactionId = text.match(/TrxID (\w+)/)[1];
//     feeAmount = parseFloat(text.match(/Fee Tk ([\d,.]+)/)[1].replace(/,/g, ''));
//     balanceAmount = parseFloat(text.match(/Balance Tk ([\d,.]+)/)[1].replace(/,/g, ''));
//     transactionDate = text.match(/(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/)[0];
//     if (transactionType === "payout") {
//       currency = text.match(/Cash In (Tk)/)[1];
//     } else {
//       currency = text.match(/Cash Out (Tk)/)[1];
//     }    
//     currency = (currency === 'Tk')?'BDT':currency;

//   } 
//   // else {
//   //   easypay_bot.sendMessage(-1002018697203, JSON.stringify(data));
//   //   return res.sendStatus(200);
//   // }

//   const parts = transactionDate.split(/[\s\/:]/);

//   const year = parseInt(parts[2]);
//   const month = parseInt(parts[1]) - 1; // Month is zero-based
//   const day = parseInt(parts[0]);
//   const hour = parseInt(parts[3]);
//   const minute = parseInt(parts[4]);

//   transactionDate = new Date(year, month, day, hour, minute);

//   const newTransaction = await ForwardedSms.create({
//     provider,
//     agentAccount, // : '12345678901',
//     customerAccount,
//     transactionType,
//     currency,
//     transactionAmount,
//     feeAmount,
//     balanceAmount,
//     transactionId,
//     transactionDate,
//     sentStamp,
//     receivedStamp
//   }); 

//   const agentNumber = await AgentNumber.findOne({agentAccount});
//   if (agentNumber) { // agent number's balance and remaining limit should be updated with transaction amount
//     agentNumber.balanceAmount = balanceAmount;
//     if (transactionType === 'payin') {
//       agentNumber.limitRemaining = parseFloat(agentNumber.limitRemaining) - parseFloat(transactionAmount);
//     }
//     await agentNumber.save();
//   }

//   if (transactionType === 'payout') {
//     const payoutTransaction = await PayoutTransaction.findOne({provider, payeeAccount: customerAccount, requestAmount: transactionAmount, currency, status: 'assigned'}).sort({createdAt: 1});
//     if (payoutTransaction) {
//       payoutTransaction.agentAccount = agentAccount;
//       payoutTransaction.transactionId = transactionId;
//       payoutTransaction.sentAmount = transactionAmount;
//       payoutTransaction.balanceAmount = balanceAmount;
//       payoutTransaction.transactionDate = transactionDate;
//       // payoutTransaction.status = 'completed';
//       await payoutTransaction.save();
//     }
//   }

//   // if (transactionType === 'payin') {
//   //   easypay_payin_bot.sendMessage(-1002014453533, JSON.stringify(data));
//   // } else if (transactionType === 'payout') {
//   //   easypay_payout_bot.sendMessage(-1002046012648, JSON.stringify(data));
//   // }    
  
//   return res.sendStatus(200);

// };

// setInterval(() => {
//   console.log('setinterval-----------')
// }, 1000 * 60);

// Schedule the task to run daily at midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  try {

    const documentsToUpdate = await AgentNumber.find({});

    // Update each document to set remainingDailyLimit to dailyLimit
    const updatePromises = documentsToUpdate.map(async (doc) => {
      doc.limitRemaining = doc.limitAmount;
      await doc.save();
    });

    await Promise.all(updatePromises);

    console.log('Daily task completed successfully');
  } catch (error) {
    console.error('Error running daily task:', error);
  }
});

// easypay_payin_bot.onText(/\/getchatid/, (msg) => {
//   const chatId = msg.chat.id;
//   const groupName = msg.chat.title || 'this group';

//   // Send a message back to the group with the chat ID
//   easypay_payin_bot.sendMessage(chatId, `The chat ID of ${groupName} is: ${chatId}`);
// });
// easypay_payin_bot.startPolling();

// easypay_payout_bot.onText(/\/getchatid/, (msg) => {
//   const chatId = msg.chat.id;
//   const groupName = msg.chat.title || 'this group';

//   // Send a message back to the group with the chat ID
//   easypay_payout_bot.sendMessage(chatId, `The chat ID of ${groupName} is: ${chatId}`);
// });
// easypay_payout_bot.startPolling();

// easypay_request_payout_bot.onText(/\/getchatid/, (msg) => {
//   const chatId = msg.chat.id;
//   const groupName = msg.chat.title || 'this group';

//   // Send a message back to the group with the chat ID
//   easypay_request_payout_bot.sendMessage(chatId, `The chat ID of ${groupName} is: ${chatId}`);
// });
// easypay_request_payout_bot.startPolling();

// easypay_bot.onText(/\/getchatid/, (msg) => {
//   const chatId = msg.chat.id;
//   const groupName = msg.chat.title || 'this group';

//   // Send a message back to the group with the chat ID
//   easypay_bot.sendMessage(chatId, `The chat ID of ${groupName} is: ${chatId}`);
// });
// easypay_bot.startPolling();