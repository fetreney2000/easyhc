import { Types } from "mongoose";

// Role codes (English enum, stored in DB)
export const ROLES = [
  "superadmin",
  "admin",
  "dept_head",
  "unit_head",
  "floor_head",
  "safety_head",
  "user",
] as const;

export type Role = (typeof ROLES)[number];

// Role display labels in Bahasa Melayu
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  dept_head: "Ketua Jabatan",
  unit_head: "Ketua Unit",
  floor_head: "Ketua Lantai",
  safety_head: "Ketua Keselamatan",
  user: "Pengguna Biasa",
};

// Attendance type
export type AttendanceType = "employee" | "visitor";

// Check-out method
export type CheckoutBy = "self" | string; // "self" or admin userId

// Check-in method
export type CheckInMethod = "qr" | "manual";

// User status
export type UserStatus = "active" | "inactive";

// Interfaces for documents
export interface IUser {
  _id: Types.ObjectId;
  name: string;
  username: string;
  passwordHash: string;
  phone?: string;
  role: Role;
  jabatanId?: Types.ObjectId;
  unitId?: Types.ObjectId;
  status: UserStatus;
  sessionVersion: number; // For JWT invalidation on password reset
  createdAt: Date;
  updatedAt: Date;
}

export interface IJabatan {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUnit {
  _id: Types.ObjectId;
  name: string;
  jabatanId: Types.ObjectId;
  homeFloorId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFloor {
  _id: Types.ObjectId;
  name: string;
  qrToken: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttendance {
  _id: Types.ObjectId;
  type: AttendanceType;
  userId?: Types.ObjectId;
  visitorName?: string;
  floorId: Types.ObjectId;
  checkedInAt: Date;
  checkedOutAt?: Date;
  checkedOutBy?: string; // "self" or admin userId string
  method: CheckInMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLog {
  _id: Types.ObjectId;
  actorUserId: Types.ObjectId;
  action: string;
  targetId?: Types.ObjectId;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}