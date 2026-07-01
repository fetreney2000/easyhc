import { connectDB } from "@/lib/db/mongoose";
import { badRequest, serverError, success } from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";

export async function POST(request: Request) {
  await connectDB();

  try {
    const body = await request.json();
    const { attendanceId } = body;

    if (!attendanceId) {
      return badRequest("ID kehadiran diperlukan");
    }

    const record = await Attendance.findById(attendanceId);
    if (!record) return badRequest("Rekod tidak dijumpai");
    if (record.checkedOutAt) return badRequest("Sudah didaftar keluar");

    record.checkedOutAt = new Date();
    record.checkedOutBy = "self";
    await record.save();

    return success({ message: "Berjaya daftar keluar" });
  } catch (error) {
    console.error("Error checking out visitor:", error);
    return serverError();
  }
}