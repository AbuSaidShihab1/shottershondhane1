import express from "express";
import {
  login,
  register,
} from "../controllers/auth_controller.js";
import multer from "multer"
import bcrypt from "bcryptjs"
import Agent_model from "../model/Agentregistration.js";
const router = express.Router();

router.post("/login", login);
router.post("/register", register);


export default router;