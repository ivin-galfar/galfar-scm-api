import express from "express";
import {
  AddBuyRentStatements,
  fetchBuyRentStatement,
  fetchBuyRentStatements,
  fetchBuyRentTotalStatements,
  softdeletebrstatement,
  updateBuyRentStatement,
  updateBuyRentStatementValues,
} from "../Controllers/BuyRentController.js";

const router = express.Router();
router.route("/").post(AddBuyRentStatements);
router.route("/").get(fetchBuyRentStatements);
router.route("/totalstatements").get(fetchBuyRentTotalStatements);
router.route("/:cs_id").get(fetchBuyRentStatement);
router.route("/updatebrstatement/:cs_id").put(updateBuyRentStatement);
router
  .route("/updatebrstatementvalues/:cs_id")
  .put(updateBuyRentStatementValues);

router.route("/delete/:cs_id").post(softdeletebrstatement);

export default router;
