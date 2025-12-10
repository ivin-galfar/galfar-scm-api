import express from "express";
import {
  AddlogisticsStatement,
  approverDetails,
  fetchAllCs,
  fetchAllID,
  fetchLogisticsStatement,
  softdeletestatement,
  updateCS,
  UpdatelogisticsStatement,
} from "../Controllers/logisticsStatement.js";
const router = express.Router();

router.route("/").post(AddlogisticsStatement);
router.route("/allcs").get(fetchAllID);
router.route("/statements").get(fetchAllCs);
router.route("/:cs_id").get(fetchLogisticsStatement);
router.route("/updatestatement/:cs_id").post(updateCS);
router.route("/updatestatementvalues/:cs_id").put(UpdatelogisticsStatement);
router.route("/delete/:cs_id").post(softdeletestatement);
router.route("/statements/approverdetails/:cs_id").get(approverDetails);

export default router;
