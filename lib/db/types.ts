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
  jawatanInfo?: string;
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
  visitorPhone?: string; // normalised; dedupes open visitor check-ins
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

/** One person on an evacuation roster (embedded snapshot, never populated). */
export interface IRosterEntry {
  _id: Types.ObjectId;
  /** Employees point at their account; visitors at their open check-in. */
  userId?: Types.ObjectId;
  visitorAttendanceId?: Types.ObjectId;
  name: string;
  type: AttendanceType;
  /** Resolved at snapshot time (employees via their unit's home floor). */
  floorId?: Types.ObjectId;
  floorName?: string;
  confirmedAt?: Date;
  /**
   * Who recorded the confirmation — derivable provenance, no extra field:
   * employee self-confirm stores their OWN userId, a warden's mark stores
   * the warden's id (for any roster entry), and a visitor confirming from
   * their own device leaves this undefined. So `confirmedBy === userId` =
   * self, `confirmedBy` set + different id = warden, `confirmedBy` absent
   * on a visitor entry = their device.
   */
  confirmedBy?: Types.ObjectId;
}

/**
 * An evacuation/drill session. The roster is SNAPSHOT when the alarm goes so
 * that "missing" always means expected-minus-confirmed relative to that
 * instant. Only ONE session may be active at a time — enforced by a partial
 * unique index on { status: "active" }, not by application code.
 */
export interface IEvacuation {
  _id: Types.ObjectId;
  status: "active" | "closed";
  startedBy: Types.ObjectId;
  /** Snapshot of the starter's name (avoids a populate on every poll). */
  startedByName: string;
  startedAt: Date;
  closedAt?: Date;
  roster: IRosterEntry[];
  createdAt: Date;
  updatedAt: Date;
}