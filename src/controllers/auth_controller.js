import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../model/User.js";
import dotenv from "dotenv";
import crypto from "crypto";

// Load environment variables
dotenv.config();
const JWT_SECRET = process.env.SECRET_KEY;

/**
 * Generates a unique API key for a new user.
 * @returns {string} - A randomly generated 32-byte API key.
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}
export const login = async (req, res) => {
  const { email, password } = req.body;
     console.log(email)
  if (!email || !password) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    // Check for existing user
    const user = await User.findOne({ email });
    if (!user) throw new Error("User does not exist");

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        websiteUrl: user.websiteUrl,
        apiKey: user.apiKey,
      },
      JWT_SECRET,
      { expiresIn: 1800 }
    );
    if (!token) throw new Error("Couldn't sign the token");

    console.log("Token: ", token);

    // Respond with user data and token in JSON
    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const register = async (req, res) => {
  const {
    name,
    email,
    password,
    type = "3D (STLP)",
    currency = "USD",
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  const apiKey = generateApiKey();

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error("User already exists");

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create and save the new user
    const newUser = new User({
      name,
      email,
      type,
      currency,
      apiKey,
      password: hashedPassword,
    });

    const savedUser = await newUser.save();
    if (!savedUser) throw new Error("Failed to save the user");

    // Generate JWT token for new user
    const token = jwt.sign(
      {
        id: savedUser._id,
        role: savedUser.role,
        websiteUrl: savedUser.websiteUrl,
        apiKey: savedUser.apiKey,
      },
      JWT_SECRET,
      { expiresIn: 3600 }
    );

    // Respond with user data and token in JSON
    res.status(200).json({
      token,
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,

      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getPassword = async (req, res) => {
  try {
    // Find user by ID and exclude password from the result
    const user = await User.findById(req.user.id).select("-password");
    if (!user) throw new Error("User does not exist");

    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};