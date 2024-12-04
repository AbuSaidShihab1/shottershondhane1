import PayinTransaction from "../model/PayinTransaction.js";
import PayoutTransaction from "../model/PayoutTransaction.js";
import User from "../model/User.js";
import AgentNumber from "../model/AgentNumber.js";
import ApiAccountBkash from "../model/ApiAccountBkash.js";
import ApiAccountNagad from "../model/ApiAccountNagad.js";
import getCountryISO3 from "country-iso-2-to-3";

/**
 * Fetches all users with the role 'merchant'.
 */
export const fetchMerchants = async (req, res) => {
  try {
    const merchants = await User.find({ role: "merchant" }).select("-password");
    res.status(200).json(merchants);
  } catch (e) {
    res.status(404).json({ message: e.message });
  }
};

/**
 * Fetches all users with the role 'subadmin'.
 */
export const fetchUsers = async (req, res) => {
  try {
    const merchants = await User.find({ role: "subadmin" }).select("-password");
    res.status(200).json(merchants);
  } catch (e) {
    res.status(404).json({ message: e.message });
  }
};

/**
 * Fetches all agent numbers sorted by merchant.
 */
export const fetchNumbers = async (req, res) => {
  try {
    const merchants = await AgentNumber.find().sort({ merchant: "1" });
    res.status(200).json(merchants);
  } catch (e) {
    res.status(404).json({ message: e.message });
  }
};

/**
 * Fetches all API accounts for Bkash sorted by merchant.
 */
export const fetchApiAccountBkash = async (req, res) => {
  try {
    const apiAccountBkash = await ApiAccountBkash.find().sort({
      merchant: "1",
    });
    res.status(200).json(apiAccountBkash);
  } catch (e) {
    res.status(404).json({ message: e.message });
  }
};

/**
 * Fetches all API accounts for Nagad sorted by merchant.
 */
export const fetchApiAccountNagad = async (req, res) => {
  try {
    const apiAccountNagad = await ApiAccountNagad.find().sort({
      merchant: "1",
    });
    res.status(200).json(apiAccountNagad);
  } catch (e) {
    res.status(404).json({ message: e.message });
  }
};


/**
 * Fetches payin transactions with filtering and sorting options.
 */
export const fetchPayinTransactions = async (req, res) => {
  try {
    const {
      authUser,
      provider,
      orderId,
      paymentId,
      agentAccount,
      payerAccount,
      payerId,
      transactionId,
      minAmount,
      maxAmount,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      sort = "[]",
      mode = "live",
    } = req.query;
    const user = JSON.parse(authUser);
    const _startDate = new Date(startDate);
    let _endDate = new Date(endDate);
    _endDate.setDate(_endDate.getDate() + 1);

    // Generate sort object from query
    const generateSort = () => {
      let sortParsed = JSON.parse(sort);
      if (sortParsed.length > 0) sortParsed = sortParsed[0];
      else sortParsed = { field: "createdAt", sort: "desc" };
      return { [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1 };
    };
    const sortFormatted = Boolean(sort) ? generateSort() : {};

    // Build criteria for filtering transactions
    let criteria = {
      $and: [
        { createdAt: { $gte: _startDate, $lte: _endDate } },
        // { mode: mode },
      ],
    };

    if (user.role === "merchant") criteria.$and.push({ merchant: user.name });
    if (provider !== "all") criteria.$and.push({ provider });
    if (orderId !== "") criteria.$and.push({ orderId });
    if (paymentId !== "") criteria.$and.push({ paymentId });
    if (agentAccount !== "") criteria.$and.push({ agentAccount });
    if (payerAccount !== "") criteria.$and.push({ payerAccount });
    if (payerId !== "") criteria.$and.push({ payerId });
    if (transactionId !== "") criteria.$and.push({ transactionId });
    if (minAmount !== "")
      criteria.$and.push({ receivedAmount: { $gte: parseFloat(minAmount) } });
    if (maxAmount !== "")
      criteria.$and.push({ receivedAmount: { $lte: parseFloat(maxAmount) } });
    if (paymentStatus !== "all") criteria.$and.push({ status: paymentStatus });

    // Fetch transactions based on criteria
    let transactions = await PayinTransaction.find(criteria)
      .sort(sortFormatted)
      .skip(page * pageSize)
      .limit(pageSize);

    // Add merchant URL to each transaction
    transactions = await Promise.all(
      transactions.map(async (transaction) => {
        const merchant = await User.findOne({ name: transaction.merchant });
        return {
          ...transaction._doc,
          merchant_url: merchant ? merchant.websiteUrl : "",
        };
      })
    );

    // Count total transactions
    const total = await PayinTransaction.countDocuments(criteria);

    // Aggregate transaction amounts by currency
    const trans = await PayinTransaction.aggregate([
      { $match: criteria },
      { $addFields: { amountDouble: { $toDouble: "$receivedAmount" } } },
      {
        $group: {
          _id: null,
          usdAmount: {
            $sum: {
              $cond: [{ $eq: ["$currency", "USD"] }, "$amountDouble", 0],
            },
          },
          inrAmount: {
            $sum: {
              $cond: [{ $eq: ["$currency", "INR"] }, "$amountDouble", 0],
            },
          },
          bdtAmount: {
            $sum: {
              $cond: [{ $eq: ["$currency", "BDT"] }, "$amountDouble", 0],
            },
          },
        },
      },
    ]);

    // Initialize amounts
    let amounts = { usdAmount: 0, inrAmount: 0, bdtAmount: 0 };
    if (trans.length > 0) {
      amounts.usdAmount = trans[0].usdAmount;
      amounts.inrAmount = trans[0].inrAmount;
      amounts.bdtAmount = trans[0].bdtAmount;
    }

    res.status(200).json({ transactions, total, amounts });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Fetches payout transactions with filtering and sorting options.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
export const fetchPayoutTransactions = async (req, res) => {
  try {
    const {
      authUser,
      provider,
      orderId,
      paymentId,
      agentAccount,
      payeeAccount,
      payeeId,
      transactionId,
      minAmount,
      maxAmount,
      payoutStatus,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      sort = "[]",
      mode = "live",
    } = req.query;
    const user = JSON.parse(authUser);
    const _startDate = new Date(startDate);
    let _endDate = new Date(endDate);
    _endDate.setDate(_endDate.getDate() + 1);

    // Generate sort object from query
    const generateSort = () => {
      let sortParsed = JSON.parse(sort);
      if (sortParsed.length > 0) sortParsed = sortParsed[0];
      else sortParsed = { field: "createdAt", sort: "desc" };
      return { [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1 };
    };
    const sortFormatted = Boolean(sort) ? generateSort() : {};

    // Build criteria for filtering transactions
    let criteria = {
      $and: [
        { createdAt: { $gte: _startDate, $lte: _endDate } },
        // { mode: mode },
      ],
    };

    if (user.role === "merchant") criteria.$and.push({ merchant: user.name });
    if (provider !== "all") criteria.$and.push({ provider });
    if (orderId !== "") criteria.$and.push({ orderId });
    if (paymentId !== "") criteria.$and.push({ paymentId });
    if (agentAccount !== "") criteria.$and.push({ agentAccount });
    if (payeeAccount !== "") criteria.$and.push({ payeeAccount });
    if (payeeId !== "") criteria.$and.push({ payeeId });
    if (transactionId !== "") criteria.$and.push({ transactionId });
    if (minAmount !== "")
      criteria.$and.push({ requestAmount: { $gte: parseFloat(minAmount) } });
    if (maxAmount !== "")
      criteria.$and.push({ requestAmount: { $lte: parseFloat(maxAmount) } });
    if (payoutStatus !== "all") criteria.$and.push({ status: payoutStatus });

    // Fetch transactions based on criteria
    let transactions = await PayoutTransaction.find(criteria)
      .sort(sortFormatted)
      .skip(page * pageSize)
      .limit(pageSize);

    // Add merchant URL to each transaction
    transactions = await Promise.all(
      transactions.map(async (transaction) => {
        const merchant = await User.findOne({ name: transaction.merchant });
        return {
          ...transaction._doc,
          merchant_url: merchant ? merchant.websiteUrl : "",
        };
      })
    );

    // Count total transactions
    const total = await PayoutTransaction.countDocuments(criteria);

    // Aggregate transaction amounts by currency
    const trans = await PayoutTransaction.aggregate([
      { $match: criteria },
      { $addFields: { amountDouble: { $toDouble: "$requestAmount" } } },
      {
        $group: {
          _id: null,
          usdAmount: {
            $sum: {
              $cond: [{ $eq: ["$currency", "USD"] }, "$amountDouble", 0],
            },
          },
          inrAmount: {
            $sum: {
              $cond: [{ $eq: ["$currency", "INR"] }, "$amountDouble", 0],
            },
          },
          bdtAmount: {
            $sum: {
              $cond: [{ $eq: ["$currency", "BDT"] }, "$amountDouble", 0],
            },
          },
        },
      },
    ]);

    // Initialize amounts
    let amounts = { usdAmount: 0, inrAmount: 0, bdtAmount: 0 };
    if (trans.length > 0) {
      amounts.usdAmount = trans[0].usdAmount;
      amounts.inrAmount = trans[0].inrAmount;
      amounts.bdtAmount = trans[0].bdtAmount;
    }

    res.status(200).json({ transactions, total, amounts });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
