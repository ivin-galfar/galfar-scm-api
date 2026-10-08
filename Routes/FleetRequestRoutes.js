import express from "express";
import {
  AddFleetRequest,
  fetchFleetRequestById,
  fetchFRDocid,
  FleetRequest,
  RequireFleetRequestInitiator,
  UpdateFleetRequestDetails,
} from "../Controllers/FleetRequestController.js";
import { requireStatementAccess } from "../Utils/userPermissions.js";

const router = express.Router();
router.use(requireStatementAccess("fl_req"));
router.route("/").post(RequireFleetRequestInitiator, AddFleetRequest);
router
  .route("/fetchdocid/:project")
  .get(requireStatementAccess("fl_req", "edit"), fetchFRDocid);
router.route("/fetchdocsdata").get(FleetRequest);
router.route("/:id").put(UpdateFleetRequestDetails);
router.route("/:id").get(fetchFleetRequestById);

export default router;
