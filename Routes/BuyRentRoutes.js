import express from "express";
import { AddBuyRentStatements } from "../Controllers/BuyRentController.js";

const router = express.Router();
router.route("/").post(AddBuyRentStatements);

export default router;
