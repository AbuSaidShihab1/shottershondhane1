import express from "express";
import {
  fetchMerchants,
  fetchUsers,
  fetchNumbers,
  fetchApiAccountBkash,
  fetchApiAccountNagad,
  fetchPayinTransactions,
  fetchPayoutTransactions,
} from "../controllers/client_controller.js";

const router = express.Router();

router.get("/merchants", fetchMerchants);
router.get("/users", fetchUsers);
router.get("/numbers", fetchNumbers);
router.get("/apiAccountBkash", fetchApiAccountBkash);
router.get("/apiAccountNagad", fetchApiAccountNagad);
router.get("/payinTransactions", fetchPayinTransactions);
router.get("/payoutTransactions", fetchPayoutTransactions);

export default router;
