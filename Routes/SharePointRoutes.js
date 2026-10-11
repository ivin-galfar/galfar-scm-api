import express from "express";
import {
  fetchSharePointDataCount,
  fetchSharePointData,
} from "../Controllers/sharePoint.js";

const router = express.Router();

router.get("/items", fetchSharePointData);
router.get("/count", fetchSharePointDataCount);

export default router;
