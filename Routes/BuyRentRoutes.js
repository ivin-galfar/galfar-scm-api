import express from "express";
import {
  AddBuyRentStatements,
  fetchBuyRentStatement,
  fetchBuyRentStatements,
  updateBuyRentStatement,
  updateBuyRentStatementValues,
} from "../Controllers/BuyRentController.js";

const router = express.Router();
router.route("/").post(AddBuyRentStatements);
router.route("/").get(fetchBuyRentStatements);
router.route("/:cs_id").get(fetchBuyRentStatement);
router.route("/updatebrstatement/:cs_id").put(updateBuyRentStatement);
router
  .route("/updatebrstatementvalues/:cs_id")
  .put(updateBuyRentStatementValues);

export default router;
