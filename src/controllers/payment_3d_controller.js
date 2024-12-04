import PayinTransaction from "../model/PayinTransaction.js";
import User from "../model/User.js";
import axios from 'axios';
import { nanoid } from 'nanoid';


// live
const TRANSXND_S2S_URL = 'https://api.transxndpay.com/api/v2';
const TRANSXND_S2S_ID = "169338565426519";
const TRANSXND_S2S_KEY = "TDqg2iRKX8qTrrA6";

// test
const TRANSXND_S2S_URL_TEST = 'https://dev.api.transxndpay.com/api/v2';
const TRANSXND_S2S_ID_TEST = "169303567919482";
const TRANSXND_S2S_KEY_TEST = "LE4M4zO4GrgXN9Jk";


const save_transaction = async (trans, status, response, token) => {
  trans.status = status;
  trans.response = JSON.stringify(response);
  trans.statusDate = new Date();
  trans.paymentMethod = token;
  await trans.save();
};

const call_gateway = async (url, body, endpoint, api_key) => {
  try {
    const result = await axios.post(`${url}/${endpoint}`, body, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${api_key}`
      }
    })
    .then(result => result.data);
    console.log(endpoint, result);
    return { status: result.status, result: result.data, message: result.message };
  } catch (e) {
    console.log(`${endpoint} error:`, `${e.message}`);
    return { status: "fail", message: e.message };
  }
};

const get_token = async (url, clientId, api_key) => {
  const action = await call_gateway(url, {
    clientId,
    api_key
  }, 'generatePayToken', api_key);
  const token = action.result?.token;
  if (!token) {
    return { status: 'fail' };
  }
  return { status: 'success', token };
};

const initiate_authentication = async (url, body, api_key) => {
  const action = await call_gateway(url, body, 'initiate_authentication', api_key);
  return action;
};

const authenticate_payment = async (url, body, api_key) => {
  const action = await call_gateway(url, body, 'authenticate_payer', api_key);
  return action;
};

export const process_3d_initiate = async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const data = req.body;

  if (!data.mid || !data.amount || !data.firstName || !data.lastName || !data.cardNumber || !data.currency || !data.cardExpMonth || !data.cardExpYear || !data.cardCVV || !data.country || !data.address || !data.city || !data.zipCode || !data.state || !data.redirectUrl) {
    return res.status(200).json({
      status: "fail",
      message: "Required fields are not filled out."
    })
  }

  try {
    const merchant = await User.findOne({name: data.mid, apiKey, status: 'activated'});
    if (!merchant) {
      return res.status(200).json({
        status: "fail",
        message: "There is not existing activated merchant with API key"
      })
    }

    let test = merchant.mode === "test";
    const url = test ? TRANSXND_S2S_URL_TEST : TRANSXND_S2S_URL;
    const clientId = test ? TRANSXND_S2S_ID_TEST : TRANSXND_S2S_ID;
    const api_key = test ? TRANSXND_S2S_KEY_TEST : TRANSXND_S2S_KEY;

    const res_token = await get_token(url, clientId, api_key);
    if (res_token.status !== 'success') {
      return res.status(200).json({ status: 'fail', message: 'Invalid Session' });
    }
    const token = res_token.token;

    const trxId = nanoid(8);

    const res_init = await initiate_authentication(url, {
      clientId,
      token,
      orderId: trxId,
      orderCurrency: data.currency,
      cardNumber: data.cardNumber
    }, api_key);
    if (res_init.status !== 'success') {
      return res.status(200).json({ status: 'fail', message: res_init.message });
    }

    let html = `<div style="display: none;">${res_init.result.authentication.redirect.html}</div>`;

    const res_auth = await authenticate_payment(url, {
      clientId,
      token,
      t_id: res_init.result.t_id,
      orderId: trxId,
      orderAmount: data.amount,
      orderCurrency: data.currency,
      cardNumber: data.cardNumber,
      cardExpiryMonth: data.cardExpMonth,
      cardExpiryYear: data.cardExpYear,
      cardSecurityCode: data.cardCVV,
      browser: 'MOZILLA',
      ipAddress: '127.0.0.1',
      redirect_url: data.redirectUrl
    }, api_key);
    if (res_auth.status !== 'success') {
      return res.status(200).json({ status: 'fail', message: res_auth.message });
    }

    const trans = await PayinTransaction.create({
      merchantId: merchant.name,
      transactionId: trxId,
      transactionType: 'S2S',
      paymentId: res_init.result.t_id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      zipCode: data.zipCode,
      clientIp: data.clientIp?data.clientIp:req.ip,
      amount: data.amount,
      currency: data.currency,
      orderId: data.orderId,
      orderDetail: data.orderDetail,
      cardType: data.cardType,
      cardNumber: data.cardNumber,
      cardCVV: data.cardCVV,
      cardExpMonth: data.cardExpMonth,
      cardExpYear: data.cardExpYear,
      redirectUrl: data.redirectUrl,
      callbackUrl: data.callbackUrl,
      mode: test ? "test" : "live"
    });
    save_transaction(trans, 'pending', res_auth.result, token);

    html += `<div>${res_auth.result.authentication.redirect.html}</div>`;

    const result = {
      ...res_auth.result,
      authentication: {
        ...res_auth.result.authentication,
        redirect: {
          ...res_auth.result.authentication.redirect,
          html,
        }
      },
      merchant: merchant.name,
      order: {
        ...res_auth.result.order,
        id: data.orderId
      },
      PayinTransaction: {
        ...res_auth.result.PayinTransaction,
        acquirer: { merchant: merchant.name },
        id: trxId
      }
    };

    console.log('initialize-result:', result);

    return res.status(200).json({
      status: 'success',
      result
    });
  } catch (e) {
    console.log('initialize-error', e.message);
    res.status(200).json({
      status: "fail",
      message: `Catch Error: ${e.message}`
    });
  }
}

export const process_3d_pay = async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const data = req.body;

  if (!data.mid || !data.order_id) {
    return res.status(200).json({
      status: 'fail',
      message: 'Required fields are not filled out.',
    });
  }

  try {
    const trans = await PayinTransaction.findOne({
      transactionId: data.order_id
      // $or: [
      //   { transactionId: data.order_id },
      //   { orderId: data.order_id },
      // ]
    });

    const merchant = await User.findOne({name: data.mid, apiKey, status: 'activated'});
    if (!merchant) {
      save_transaction(trans, 'error', null, 'Transxnd');
      return res.status(200).json({
        status: "error",
        message: "There is not existing activated merchant with API key"
      })
    }

    let test = merchant.mode === "test";

    const url = test ? TRANSXND_S2S_URL_TEST : TRANSXND_S2S_URL;
    const clientId = test ? TRANSXND_S2S_ID_TEST : TRANSXND_S2S_ID;
    const api_key = test ? TRANSXND_S2S_KEY_TEST : TRANSXND_S2S_KEY;

    const action = await call_gateway(url, {
      clientId,
      token: trans.paymentMethod,
      t_id: trans.paymentId,
      orderId: data.order_id,
      transaction_description: "Test",
      orderAmount: trans.amount,
      orderCurrency: trans.currency,
      cardholderName: `${trans.firstName} ${trans.lastName}`,
      cardNumber: trans.cardNumber,
      cardExpiryMonth: trans.cardExpMonth,
      cardExpiryYear: trans.cardExpYear,
      cardSecurityCode: trans.cardCVV,
      billingAddress: {
        country: trans.country,
        AddressLine1: trans.address,
        AddressLine2: "",
        city: trans.city,
        postCode: trans.zipCode,
        state: trans.state
      }
    }, 'pay', api_key);

    const result = {
      ...action.result,
      merchant: merchant.name,
      order: {
        ...action.result.order,
        id: trans.orderId
      },
      PayinTransaction: {
        ...action.result.PayinTransaction,
        acquirer: { merchantId: merchant.name },
        id: trans.transactionId,
        reference: trans.transactionId
      }
    };
    console.log('pay result:', result);

    if (action.result?.order?.status !== 'CAPTURED' || action.status !== 'success') {
      save_transaction(trans, 'declined', action.result, 'Transxnd');
      return res.status(200).json({
        status: 'declined',
        message: action.message,
        result
      });
    }

    save_transaction(trans, 'approved', action.result, 'Transxnd');
    return res.status(200).json({
      status: 'approved',
      result
    });
  } catch (e) {
    console.log('pay-error', e.message);
    res.status(200).json({
      status: "fail",
      message: `Catch Error: ${e.message}`
    });
  }
}
