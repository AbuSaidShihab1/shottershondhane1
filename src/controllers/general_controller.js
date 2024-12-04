import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../model/User.js";
import AgentNumber from "../model/AgentNumber.js";
import ApiAccountBkash from "../model/ApiAccountBkash.js";
import ApiAccountNagad from "../model/ApiAccountNagad.js";
import PayinTransaction from "../model/PayinTransaction.js";
import PayoutTransaction from "../model/PayoutTransaction.js";
import generateApiKey from "../utils/cryptoUtils.js";

// User signup function
export const signup = async (req, res) => {
  const {
    name,
    email,
    password,
    city,
    state,
    country,
    occupation,
    phoneNumber,
    transactions,
    role,
  } = req.body;

  try {
    const oldUser = await User.findOne({ email });
    if (oldUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await User.create({
      email,
      password: hashedPassword,
      name,
      city,
      state,
      country,
      occupation,
      phoneNumber,
      transactions,
      role,
    });

    const token = jwt.sign(
      { email: result.email, id: result._id },
      process.env.SECRET_KEY,
      { expiresIn: "48h" }
    );

    res.status(201).json({
      status: 201,
      message: "User registered successfully!",
      result: {
        _id: result._id,
        email: result.email,
        password: result.password,
        name: result.name,
        city: result.city,
        state: result.state,
        country: result.country,
        occupation: result.occupation,
        phoneNumber: result.phoneNumber,
        transactions: result.transactions,
        role: result.role,
      },
      token: token,
    });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
    console.log(error.message);
  }
};

// User signin function
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const oldUser = await User.findOne({ email });
    if (!oldUser)
      return res.status(404).json({ message: "User doesn't exist" });

    const isPasswordCorrect = await bcrypt.compare(password, oldUser.password);
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: oldUser._id }, process.env.SECRET_KEY, {
      expiresIn: "148h",
    });

    res
      .status(200)
      .json({ status: 200, message: "User login successfully!", token: token });
  } catch (err) {
    res
      .status(500)
      .json({ status: 500, message: "Internal server error!", error: err });
  }
};

// Fetch user by ID
export const fetchUser = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await User.findById(id);
    res.status(200).json(result);
  } catch (e) {
    res.status(404).json({ message: e.message });
  }
};

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const { id, startDate, endDate, mode } = req.query;
    const user = JSON.parse(id);
    const _startDate = new Date(startDate);
    let _endDate = new Date(endDate);
    _endDate.setDate(_endDate.getDate() + 1);

    let criteria = {
      createdAt: { $gte: _startDate, $lte: _endDate },
    };
    if (user.role !== "admin") {
      criteria.merchant = user.name;
    }

    let transactions;
    if (mode === "payin") {
      transactions = await PayinTransaction.aggregate([
        { $match: criteria },
        { $addFields: { amountDouble: { $toDouble: "$receivedAmount" } } },
        {
          $group: {
            _id: null,
            bkashAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "bkash"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            rocketAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "rocket"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            nagadAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "nagad"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            bkashApprovedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "bkash"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            rocketApprovedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "rocket"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            nagadApprovedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "nagad"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            bkashTotalCount: {
              $sum: { $cond: [{ $eq: ["$provider", "bkash"] }, 1, 0] },
            },
            rocketTotalCount: {
              $sum: { $cond: [{ $eq: ["$provider", "rocket"] }, 1, 0] },
            },
            nagadTotalCount: {
              $sum: { $cond: [{ $eq: ["$provider", "nagad"] }, 1, 0] },
            },
          },
        },
      ]);
    } else {
      transactions = await PayoutTransaction.aggregate([
        { $match: criteria },
        { $addFields: { amountDouble: { $toDouble: "$sentAmount" } } },
        {
          $group: {
            _id: null,
            bkashAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "bkash"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            rocketAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "rocket"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            nagadAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "nagad"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            bkashApprovedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "bkash"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            rocketApprovedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "rocket"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            nagadApprovedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "nagad"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            bkashTotalCount: {
              $sum: { $cond: [{ $eq: ["$provider", "bkash"] }, 1, 0] },
            },
            rocketTotalCount: {
              $sum: { $cond: [{ $eq: ["$provider", "rocket"] }, 1, 0] },
            },
            nagadTotalCount: {
              $sum: { $cond: [{ $eq: ["$provider", "nagad"] }, 1, 0] },
            },
          },
        },
      ]);
    }

    let result = {
      bkashAmount: 0,
      rocketAmount: 0,
      nagadAmount: 0,
      bkashApproved: 0,
      rocketApproved: 0,
      nagadApproved: 0,
      bkashTotal: 0,
      rocketTotal: 0,
      nagadTotal: 0,
    };
    if (transactions.length > 0) {
      result = {
        bkashAmount: transactions[0].bkashAmount,
        rocketAmount: transactions[0].rocketAmount,
        nagadAmount: transactions[0].nagadAmount,
        bkashApproved: transactions[0].bkashApprovedCount,
        rocketApproved: transactions[0].rocketApprovedCount,
        nagadApproved: transactions[0].nagadApprovedCount,
        bkashTotal: transactions[0].bkashTotalCount,
        rocketTotal: transactions[0].rocketTotalCount,
        nagadTotal: transactions[0].nagadTotalCount,
      };
    }

    res.status(200).json(result);
  } catch (error) {
    console.log("dashboard-error", error.message);
    res.status(404).json({ message: error.message });
  }
};

// Get chart statistics
export const getChartStats = async (req, res) => {
  try {
    const { id, startDate, endDate, mode } = req.query;
    const user = JSON.parse(id);
    const _startDate = new Date(startDate);
    let _endDate = new Date(endDate);

    let criteria = {
      createdAt: { $gte: _startDate, $lte: _endDate },
    };
    if (user.role !== "admin") {
      criteria.merchantId = user.name;
    }

    let transactions;
    if (mode === "payin") {
      transactions = await PayinTransaction.aggregate([
        { $match: criteria },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            totalCount: { $sum: 1 },
            approvedCount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", "fully paid"] },
                      { $eq: ["$status", "partially paid"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: "$_id.day",
                  },
                },
              },
            },
            totalCount: 1,
            approvedCount: 1,
          },
        },
        { $sort: { date: 1 } },
      ]);
    } else {
      transactions = await PayoutTransaction.aggregate([
        { $match: criteria },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            totalCount: { $sum: 1 },
            approvedCount: {
              $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: "$_id.day",
                  },
                },
              },
            },
            totalCount: 1,
            approvedCount: 1,
          },
        },
        { $sort: { date: 1 } },
      ]);
    }

    const generateDateList = (start, end) => {
      let dateArray = [];
      let currentDate = start;
      while (currentDate <= end) {
        dateArray.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return dateArray;
    };

    const allDates = generateDateList(_startDate, _endDate);
    const result = allDates.map((date) => {
      const dateString = date.toISOString().slice(0, 10);
      const matchedData = transactions.find((d) => d.date === dateString);
      return matchedData
        ? {
            date: dateString,
            totalCount: matchedData.totalCount,
            approvedCount: matchedData.approvedCount,
          }
        : { date: dateString, totalCount: 0, approvedCount: 0 };
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Get pie statistics
export const getPieStats = async (req, res) => {
  try {
    const { id, startDate, endDate, mode } = req.query;
    const user = JSON.parse(id);
    const _startDate = new Date(startDate);
    let _endDate = new Date(endDate);
    _endDate.setDate(_endDate.getDate() + 1);

    let criteria = {
      createdAt: { $gte: _startDate, $lte: _endDate },
    };
    if (user.role !== "admin") {
      criteria.merchant = user.name;
    }

    let transactions;
    if (mode === "payin") {
      transactions = await PayinTransaction.aggregate([
        { $match: criteria },
        { $addFields: { amountDouble: { $toDouble: "$receivedAmount" } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amountDouble" },
            bkashAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "bkash"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            rocketAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "rocket"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            nagadAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$status", "fully paid"] },
                          { $eq: ["$status", "partially paid"] },
                        ],
                      },
                      { $eq: ["$provider", "nagad"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
          },
        },
      ]);
    } else {
      transactions = await PayoutTransaction.aggregate([
        { $match: criteria },
        { $addFields: { amountDouble: { $toDouble: "$sentAmount" } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amountDouble" },
            bkashAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "bkash"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            rocketAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "rocket"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
            nagadAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "sent"] },
                      { $eq: ["$provider", "nagad"] },
                    ],
                  },
                  "$amountDouble",
                  0,
                ],
              },
            },
          },
        },
      ]);
    }

    const result =
      transactions.length > 0
        ? {
            totalAmount: transactions[0].totalAmount,
            bkashAmount: transactions[0].bkashAmount,
            rocketAmount: transactions[0].rocketAmount,
            nagadAmount: transactions[0].nagadAmount,
          }
        : {
            totalAmount: 0,
            bkashAmount: 0,
            rocketAmount: 0,
            nagadAmount: 0,
          };

    res.status(200).json(result);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Add a new user
export const addUser = async (req, res) => {
  const {
    name,
    email,
    password,
    authCode = "123456",
    websiteUrl = "",
    currency = "",
    role = "subadmin",
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  let apiKey = generateApiKey();
  if (role === "subadmin") {
    apiKey = "";
  }

  try {
    const user = await User.findOne({ email });
    if (user) throw Error("User already exists");

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      authCode,
      websiteUrl,
      currency,
      role,
      apiKey,
      password: hash,
    });

    const savedUser = await newUser.save();
    if (!savedUser) throw Error("Something went wrong saving the user");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Update user details
export const updateUser = async (req, res) => {
  const {
    id,
    name,
    authCode,
    websiteUrl = "",
    currency = "",
    apiKey = "",
    status = "activated",
  } = req.body;

  if (!name || !authCode) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    const user = await User.findById(id);
    if (!user) throw Error("User does not exist");

    user.name = name;
    user.authCode = authCode;
    user.websiteUrl = websiteUrl;
    user.currency = currency;
    user.apiKey = apiKey;
    user.status = status;

    const savedUser = await user.save();
    if (!savedUser) throw Error("Something went wrong saving the user");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Update user password
export const updatePassword = async (req, res) => {
  const { id, oldP, newP } = req.body;

  if (!oldP || !newP) {
    return res
      .status(200)
      .json({ success: false, error: "Please enter all fields." });
  }

  try {
    const user = await User.findById(id);
    if (!user) throw Error("User does not exist");

    const isMatch = await bcrypt.compare(oldP, user.password);
    if (!isMatch) throw Error("Wrong old password");

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newP, salt);

    user.password = hash;

    const savedUser = await user.save();
    if (!savedUser) throw Error("Something went wrong saving the user");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(200).json({ success: false, error: e.message });
  }
};

// Delete a user
export const deleteUser = async (req, res) => {
  const { id } = req.body;

  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) throw Error("Something went wrong deleting the user");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Add a new agent number
export const addAgentNumber = async (req, res) => {
  const {
    merchant,
    mfs,
    currency,
    accountNumber,
    limitAmount = 1500000,
  } = req.body;

  if (!merchant || !mfs || !currency || !accountNumber) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    const agentNumber = await AgentNumber.findOne({ accountNumber, merchant });
    if (agentNumber)
      throw Error("Same agent number for this merchant already exists");

    const newAgentNumber = new AgentNumber({
      merchant,
      mfs,
      currency,
      accountNumber,
      limitAmount,
      limitRemaining: limitAmount,
      balanceAmount: 0,
    });

    const savedAgentNumber = await newAgentNumber.save();
    if (!savedAgentNumber)
      throw Error("Something went wrong saving the agent number");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Update agent number details
export const updateAgentNumber = async (req, res) => {
  const {
    id,
    merchant,
    mfs,
    currency,
    accountNumber,
    limitAmount = 1500000,
    status = "activated",
  } = req.body;

  if (!id || !merchant || !mfs || !currency || !accountNumber) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    const agentNumber = await AgentNumber.findById(id);
    if (!agentNumber) throw Error("Agent number does not exist");

    agentNumber.merchant = merchant;
    agentNumber.mfs = mfs;
    agentNumber.currency = currency;
    agentNumber.accountNumber = accountNumber;
    agentNumber.limitAmount = limitAmount;
    agentNumber.limitRemaining =
      parseFloat(agentNumber.limitRemaining) -
      (parseFloat(agentNumber.limitAmount) - parseFloat(limitAmount));
    agentNumber.status = status;

    const savedAgentNumber = await agentNumber.save();
    if (!savedAgentNumber)
      throw Error("Something went wrong saving the agent number");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Delete an agent number
export const deleteAgentNumber = async (req, res) => {
  const { id } = req.body;

  try {
    const agentNumber = await AgentNumber.findByIdAndDelete(id);
    if (!agentNumber)
      throw Error("Something went wrong deleting the agent number");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Add a new API account for bKash
export const addApiAccountBkash = async (req, res) => {
  const {
    accountName,
    accountNumber,
    username,
    password,
    appKey,
    appSecretKey,
  } = req.body;

  if (
    !accountName ||
    !accountNumber ||
    !username ||
    !password ||
    !appKey ||
    !appSecretKey
  ) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    const apiAccountBkash = await ApiAccountBkash.findOne({ accountNumber });
    if (apiAccountBkash)
      throw Error("Same API account for this account number already exists");

    const newApiAccountBkash = new ApiAccountBkash({
      accountName,
      accountNumber,
      username,
      password,
      appKey,
      appSecretKey,
    });

    const savedApiAccountBkash = await newApiAccountBkash.save();
    if (!savedApiAccountBkash)
      throw Error("Something went wrong saving the API account");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Update API account details for bKash
export const updateApiAccountBkash = async (req, res) => {
  const {
    id,
    accountName,
    accountNumber,
    username,
    password,
    appKey,
    appSecretKey,
    status = "activated",
  } = req.body;

  if (
    !id ||
    !accountName ||
    !accountNumber ||
    !username ||
    !password ||
    !appKey ||
    !appSecretKey
  ) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    const apiAccountBkash = await ApiAccountBkash.findById(id);
    if (!apiAccountBkash) throw Error("API account does not exist");

    if (apiAccountBkash.accountNumber == accountNumber)
      throw Error("Same API account for this account number already exists");

    apiAccountBkash.accountName = accountName;
    apiAccountBkash.accountNumber = accountNumber;
    apiAccountBkash.username = username;
    apiAccountBkash.password = password;
    apiAccountBkash.appKey = appKey;
    apiAccountBkash.appSecretKey = appSecretKey;
    apiAccountBkash.status = status;

    const savedApiAccountBkash = await apiAccountBkash.save();
    if (!savedApiAccountBkash)
      throw Error("Something went wrong saving the API account");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Delete an API account for bKash
export const deleteApiAccountBkash = async (req, res) => {
  const { id } = req.body;

  try {
    const apiAccountBkash = await ApiAccountBkash.findByIdAndDelete(id);
    if (!apiAccountBkash)
      throw Error("Something went wrong deleting the API account");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Add a new API account for bKash
export const addApiAccountNagad = async (req, res) => {
  const {
    accountName,
    accountNumber,
    username,
    password,
    appKey,
    appSecretKey,
  } = req.body;

  if (
    !accountName ||
    !accountNumber ||
    !username ||
    !password ||
    !appKey ||
    !appSecretKey
  ) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    const apiAccountNagad = await ApiAccountNagad.findOne({ accountNumber });
    if (apiAccountNagad)
      throw Error("Same API account for this account number already exists");

    const newApiAccountNagad = new ApiAccountNagad({
      accountName,
      accountNumber,
      username,
      password,
      appKey,
      appSecretKey,
    });

    const savedApiAccountNagad = await newApiAccountNagad.save();
    if (!savedApiAccountNagad)
      throw Error("Something went wrong saving the API account");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Update API account details for Nagad
export const updateApiAccountNagad = async (req, res) => {
  const {
    id,
    accountName,
    accountNumber,
    username,
    password,
    appKey,
    appSecretKey,
    status = "activated",
  } = req.body;

  if (
    !id ||
    !accountName ||
    !accountNumber ||
    !username ||
    !password ||
    !appKey ||
    !appSecretKey
  ) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    const apiAccountNagad = await ApiAccountNagad.findById(id);
    if (!apiAccountNagad) throw Error("API account does not exist");

    if (apiAccountNagad.accountNumber == accountNumber)
      throw Error("Same API account for this account number already exists");

    apiAccountNagad.accountName = accountName;
    apiAccountNagad.accountNumber = accountNumber;
    apiAccountNagad.username = username;
    apiAccountNagad.password = password;
    apiAccountNagad.appKey = appKey;
    apiAccountNagad.appSecretKey = appSecretKey;
    apiAccountNagad.status = status;

    const savedApiAccountNagad = await apiAccountNagad.save();
    if (!savedApiAccountNagad)
      throw Error("Something went wrong saving the API account");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Delete an API account for Nagad
export const deleteApiAccountNagad = async (req, res) => {
  const { id } = req.body;

  try {
    const apiAccountNagad = await ApiAccountNagad.findByIdAndDelete(id);
    if (!apiAccountNagad)
      throw Error("Something went wrong deleting the API account");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Delete a payin transaction
export const deletePayinTransaction = async (req, res) => {
  const { id } = req.body;

  try {
    const user = await PayinTransaction.findByIdAndDelete(id);
    if (!user) throw Error("Something went wrong deleting the transaction");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// Delete a payout transaction
export const deletePayoutTransaction = async (req, res) => {
  const { id } = req.body;

  try {
    const user = await PayoutTransaction.findByIdAndDelete(id);
    if (!user) throw Error("Something went wrong deleting the transaction");

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};
