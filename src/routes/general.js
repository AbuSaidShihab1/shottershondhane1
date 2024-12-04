import express from "express";
import {
  fetchUser,
  getDashboardStats,
  getChartStats,
  getPieStats,
  signin,
  signup,
  addUser,
  updateUser,
  updatePassword,
  deleteUser,
  addAgentNumber,
  updateAgentNumber,
  deleteAgentNumber,
  addApiAccountBkash,
  updateApiAccountBkash,
  deleteApiAccountBkash,
  deletePayinTransaction,
  addApiAccountNagad,
  updateApiAccountNagad,
  deleteApiAccountNagad,
} from "../controllers/general_controller.js";

const router = express.Router();

// User management routes
router.get("/user/:id", fetchUser);
router.get("/dashboard", getDashboardStats);
router.get("/chart", getChartStats);
router.get("/pie", getPieStats);
router.post("/addUser", addUser);
router.post("/updateUser", updateUser);
router.post("/updatePassword", updatePassword);
router.post("/deleteUser", deleteUser);

// Agent number management routes
router.post("/addAgentNumber", addAgentNumber);
router.post("/updateAgentNumber", updateAgentNumber);
router.post("/deleteAgentNumber", deleteAgentNumber);

// Bkash API account management routes
router.post("/addApiAccountBkash", addApiAccountBkash);
router.post("/updateApiAccountBkash", updateApiAccountBkash);
router.post("/deleteApiAccountBkash", deleteApiAccountBkash);


// Nagad API account management routes
router.post("/addApiAccountNagad", addApiAccountNagad);
router.post("/updateApiAccountNagad", updateApiAccountNagad);
router.post("/deleteApiAccountNagad", deleteApiAccountNagad);

// Transaction management routes
router.post("/deletePayinTransaction", deletePayinTransaction);

export default router;
