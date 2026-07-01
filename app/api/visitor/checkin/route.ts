import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { badRequest, serverError, success } from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
import Floor from "@/lib/db/models/Floor";
import { visitorCheckInSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  await connectDB();

  try {
    const body = await request.json();
    const validation = visitorCheckInSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    const { visitorName, visitorDept, visitorPhone, floorId } = validation.data;

    // Validate floor exists
    const floor = await Floor.findById(floorId);
    if (!floor) {
      return badRequest("Lantai tidak dijumpai");
    }

    // Create visitor attendance record
    const attendance = await Attendance.create({
      type: "visitor",
      visitorName,
      visitorDept,
      floorId: floor._id,
      checkedInAt: new Date(),
      method: "qr",
    });

    return success(
      {
        message: `Berjaya daftar masuk sebagai pelawat di ${floor.name}`,
        attendance: {
          _id: attendance._id,
          floorName: floor.name,
          checkedInAt: attendance.checkedInAt,
        },
      },
      201
    );
  } catch (error) {
    console.error("Error checking in visitor:", error);
    return serverError();
  }
}