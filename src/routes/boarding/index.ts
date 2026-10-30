import { Router } from "express";
import { dormitoryRoutes } from "./dormitory.routes";
import { dormRoomRoutes } from "./room.routes";
import { dormAssignmentRoutes } from "./assignment.routes";
import { rollCallRoutes } from "./roll-call.routes";
import { studentLeaveRoutes } from "./leave.routes";
import { absenceAlertRoutes } from "./alert.routes";
import { patronRoutes } from "./patron.routes";
import { boardingSupervisorRoutes } from "./supervisor.routes";
import { leaveV2Routes } from "./leave-v2.routes";
import { boardingAttendanceRoutes } from "./boarding-attendance.routes";
import { diningRoutes } from "./dining.routes";

export const boardingRoutes = Router();

boardingRoutes.use("/dormitories", dormitoryRoutes);
boardingRoutes.use("/rooms", dormRoomRoutes);
boardingRoutes.use("/assignments", dormAssignmentRoutes);
boardingRoutes.use("/roll-calls", rollCallRoutes);
boardingRoutes.use("/student-leaves", studentLeaveRoutes);   // legacy
boardingRoutes.use("/leaves", leaveV2Routes);                 // new full state machine
boardingRoutes.use("/absence-alerts", absenceAlertRoutes);
boardingRoutes.use("/patrons", patronRoutes);
boardingRoutes.use("/supervisors", boardingSupervisorRoutes);
boardingRoutes.use("/attendance", boardingAttendanceRoutes);
boardingRoutes.use("/dining", diningRoutes);
