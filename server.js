import express from "express";
import dotenv from "dotenv";
import { notFound, errorHandler } from "./Middlewares/errormiddlewares.js";
import cors from "cors";
import userRoutes from "./Routes/userRoutes.js";
import ParticularRoutes from "./Routes/ParticularRoutes.js";
import ReceiptRoutes from "./Routes/ReceiptRoutes.js";

dotenv.config();
const port = process.env.PORT;

const app = express();

app.use(express.json());

const allowedOrigins = [
  "https://orange-meadow-02ae73903.1.azurestaticapps.net",
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
app.use("/receipts", ReceiptRoutes);
app.use("/particulars", ParticularRoutes);

app.get("/", (req, res) => res.send("API is running"));

app.use(notFound, errorHandler);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
