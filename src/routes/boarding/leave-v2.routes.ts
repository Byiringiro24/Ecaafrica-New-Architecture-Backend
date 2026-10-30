import { Router } from "express";
import * as leaveV2Controller from "../../controllers/boarding/leave-v2.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireLeaveApprovalRole, requireGateKeeperOrAdmin, requireBoardingRole } from "../../middleware/roleGuard";

export const leaveV2Routes = Router();
leaveV2Routes.use(verifyToken, requireSchoolAccess);

// List and create
leaveV2Routes.get("/", asyncWrapper(leaveV2Controller.listLeaves));
leaveV2Routes.post("/", asyncWrapper(leaveV2Controller.createLeave));

// Gate keeper — approved exits view
leaveV2Routes.get("/approved-exits", asyncWrapper(leaveV2Controller.getApprovedExits));

// Single leave
leaveV2Routes.get("/:id", asyncWrapper(leaveV2Controller.getLeave));

// DOD / school-admin only — approve / reject
leaveV2Routes.patch("/:id/approve", requireLeaveApprovalRole, asyncWrapper(leaveV2Controller.approveLeave));
leaveV2Routes.patch("/:id/reject", requireLeaveApprovalRole, asyncWrapper(leaveV2Controller.rejectLeave));

// Gate keeper confirms physical exit (creates immutable audit record)
leaveV2Routes.patch("/:id/confirm-exit", requireGateKeeperOrAdmin, asyncWrapper(leaveV2Controller.confirmGateExit));

// Patron/Matron confirms student return (RETURNED -> CLOSED, spec §21)
leaveV2Routes.patch("/:id/confirm-return", requireBoardingRole, asyncWrapper(leaveV2Controller.confirmReturn));
