import express from "express";
import dotenv from "dotenv";
import { notFound, errorHandler } from "./Middlewares/errormiddlewares.js";
import cors from "cors";
import userRoutes from "./Routes/userRoutes.js";
import ParticularRoutes from "./Routes/ParticularRoutes.js";
import ReceiptRoutes from "./Routes/ReceiptRoutes.js";
import EmailRoutes from "./Routes/EmailRoutes.js";
import DepartmentRoutes from "./Routes/DepartmentRoutes.js";
import LogisticsRoutes from "./Routes/LogisticsRoutes.js";

import verifyToken from "./Utils/jwtTokenValidation.js";
import { cronemails } from "./cron/emailCron.js";
dotenv.config();
const port = process.env.PORT;

const app = express();

app.use(express.json());

const allowedOrigins = [
  "https://intranet.galfaremirates.com",
  "http://localhost:5173",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use("/users", userRoutes);
app.use("/receipts", verifyToken, ReceiptRoutes);
app.use("/particulars", verifyToken, ParticularRoutes);
app.use("/emailnotify", verifyToken, EmailRoutes);
app.use("/department", verifyToken, DepartmentRoutes);
app.use("/logistics", verifyToken, LogisticsRoutes);

app.get("/", (req, res) => res.send("API is running"));

app.use(notFound, errorHandler);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log("Current Time:", new Date());
});

cronemails();
