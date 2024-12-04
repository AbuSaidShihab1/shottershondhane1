import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import chalk from "chalk";
import multer from "multer"
import bcrypt from "bcryptjs"
// Import route handlers
import clientRoutes from "./routes/client.js";
import generalRoutes from "./routes/general.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payment.js";

// Import models and data
import User from "./model/User.js";
import { dataUser } from "./data/index.js";
import agent_route from "./routes/Agent.js";
// import agent_route from "./routes/Agent.js";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('module-alias/register');
// Load environment variables from .env file
dotenv.config();

const app = express();

// Security and Body Parsing Middleware
app.use(express.json());
app.use(helmet());
app.use(express.static("public"))
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(
  cors({
    origin: "https://eassypay.com",
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Set view engine for rendering templates
app.set("view engine", "ejs");

// Custom Morgan Logger with Chalk for Colorful Output
app.use(
  morgan((tokens, req, res) => {
    return [
      chalk.blue.bold(tokens.method(req, res)),
      chalk.yellow(tokens.url(req, res)),
      chalk.green(tokens.status(req, res)),
      chalk.magenta(`${tokens["response-time"](req, res)} ms`),
      chalk.cyan(tokens["remote-addr"](req, res)),
    ].join(" ");
  })
);

// Routes
app.use("/api/client", clientRoutes);
app.use("/api/general", generalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payment", paymentRoutes);
app.use(agent_route)

// Database Connection and Server Setup
const PORT = process.env.PORT || 9000;
mongoose.set("strictQuery", false);

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () =>
      console.log(
        chalk.green.bold(`Server Running on Port: http://localhost:${PORT}`)
      )
    );

    // Uncomment the line below to add data to the database once, if needed
    // User.insertMany(dataUser);
  })
  .catch((error) =>
    console.log(
      chalk.red.bold(
        `\n\nError: ${error.message} - Could not connect to MongoDB`
      )
    )
  );