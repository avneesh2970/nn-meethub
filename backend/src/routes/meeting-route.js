import express from "express";
import { getMeetings, createMeeting, deleteMeeting, createInstantMeeting, joinMeeting, manageParticipants, getMeetingDetails, endMeeting, getParticipantsForSidebar, leaveMeeting, allowParticipant, denyParticipant } from "../controllers/meeting-controller.js";
import { protectRoute } from "../middleware/auth-middleware.js";

const router = express.Router();

router.get("/", protectRoute, getMeetings);
router.post("/", protectRoute, createMeeting);
router.delete("/:id", protectRoute, deleteMeeting);

router.post("/instant", protectRoute, createInstantMeeting);
router.post("/join", protectRoute, joinMeeting);
router.post("/manage-participants", protectRoute, manageParticipants);
router.get("/:meetingCode", protectRoute, getMeetingDetails);
router.post("/leave", protectRoute, leaveMeeting);
router.post("/end", protectRoute, endMeeting);
router.get("/:meetingCode/participants", protectRoute, getParticipantsForSidebar);
router.post("/allow", protectRoute, allowParticipant);
router.post("/deny", protectRoute, denyParticipant);

export default router;