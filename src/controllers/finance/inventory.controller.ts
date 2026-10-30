import type { POStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as inventoryService from "../../services/finance/inventory.service";
import * as supplierService from "../../services/finance/supplier.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const listSuppliers = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await supplierService.findAllSuppliers(schoolId, pagination, {
    category: req.query.category as string | undefined,
    is_active:
      req.query.is_active === undefined ? undefined : req.query.is_active === "true"
  });

  res.json(successResponse(result.data, result.meta));
};

export const createSupplier = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await supplierService.createSupplier(schoolId, req.user?.id, req.body);
  res.status(201).json(successResponse(record));
};

export const getSupplier = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await supplierService.findSupplierById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateSupplier = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await supplierService.updateSupplier(schoolId, req.params.id, req.user?.id, req.body);
  res.json(successResponse(record));
};

export const deleteSupplier = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await supplierService.deleteSupplier(schoolId, req.params.id, req.user?.id);
  res.json(successResponse(record));
};

export const listInventoryItems = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await inventoryService.findAllInventoryItems(schoolId, pagination, {
    status: req.query.status as POStatus | undefined,
    category: req.query.category as string | undefined,
    supplier_id: req.query.supplier_id as string | undefined,
    low_stock: req.query.low_stock === "true"
  });

  res.json(successResponse(result.data, result.meta));
};

export const listInventoryCategories = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  res.json(successResponse(await inventoryService.findInventoryCategories(schoolId)));
};

export const createInventoryCategory = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const category = await inventoryService.createInventoryCategory(schoolId, req.body.name);
  res.status(201).json(successResponse(category));
};

export const createInventoryItem = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await inventoryService.createInventoryItem(
    schoolId,
    req.user?.id,
    req.body
  );
  res.status(201).json(successResponse(record));
};

export const getInventoryItem = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await inventoryService.findInventoryItemById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateInventoryItem = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await inventoryService.updateInventoryItem(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body
  );
  res.json(successResponse(record));
};

export const updateInventoryStatus = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await inventoryService.updateInventoryStatus(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body.status
  );
  res.json(successResponse(record));
};

export const paySupplier = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await inventoryService.paySupplier(schoolId, req.params.id, req.user?.id, req.body);
  res.json(successResponse(record));
};

export const deleteInventoryItem = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await inventoryService.deleteInventoryItem(schoolId, req.params.id, req.user?.id);
  res.json(successResponse(record));
};

export const uploadInventoryInvoice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);

  if (!req.file) {
    throw new AppError("bad_request", "Invoice file is required", 400);
  }

  const record = await inventoryService.attachInventoryInvoice(
    schoolId,
    req.params.id,
    `uploads/${req.file.filename}`
  );
  res.json(successResponse(record));
};
