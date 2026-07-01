/**
 * Centralized Bahasa Melayu strings for the EasyHC application.
 * All user-facing text MUST be defined here, not inline in components.
 * Variable/function/component names in code stay English.
 */

export const strings = {
  // App
  appName: "EasyHC",
  appDescription: "Sistem Kehadiran Lantai",

  // Auth
  login: "Log Masuk",
  logout: "Log Keluar",
  username: "Nama Pengguna",
  password: "Kata Laluan",
  loginTitle: "Log Masuk ke Akaun Anda",
  loginError: "Nama pengguna atau kata laluan salah",
  loginButton: "Log Masuk",
  loggedOut: "Anda telah berjaya log keluar",

  // Navigation
  dashboard: "Papan Pemuka",
  scanQR: "Imbas Kod QR",
  profile: "Profil",
  reports: "Laporan",
  floors: "Lantai",
  floorManagement: "Pengurusan Lantai",
  userManagement: "Pengurusan Pengguna",
  qrCodes: "Kod QR",
  myUnit: "Unit Saya",
  allFloors: "Semua Lantai",
  allStaffLocations: "Lokasi Semua Kakitangan",
  manualCheckIn: "Daftar Masuk Manual",
  more: "Lagi",

  // Attendance
  checkIn: "Daftar Masuk",
  checkedIn: "Daftar Masuk",
  checkOut: "Daftar Keluar",
  checkedOut: "Berjaya Daftar Keluar",
  checkInSuccess: "Berjaya daftar masuk ke lantai",
  checkInError: "Gagal daftar masuk. Sila cuba lagi.",
  checkOutSuccess: "Berjaya daftar keluar",
  checkOutError: "Gagal daftar keluar. Sila cuba lagi.",
  alreadyCheckedIn: "Anda sudah berdaftar masuk di lantai lain. Daftar masuk baru akan mendaftar keluar dari lantai sebelumnya.",
  forceCheckout: "Paksa Keluar",
  forceCheckoutConfirm: "Anda pasti mahu memaksa keluar pengguna ini?",
  forceCheckoutSuccess: "Berjaya memaksa keluar",

  // Visitor
  visitor: "Pelawat",
  visitorName: "Nama Pelawat",
  visitorDept: "Jabatan Pelawat",
  visitorPhone: "No. Telefon (Pilihan)",
  visitorCheckInTitle: "Daftar Masuk Pelawat",
  visitorCheckInSuccess: "Berjaya daftar masuk sebagai pelawat",
  visitorCheckOutSuccess: "Berjaya daftar keluar",
  visitorPhonePlaceholder: "Contoh: 0123456789",

  // Dashboard
  totalPresent: "Jumlah Kehadiran",
  totalEmployees: "Kakitangan",
  totalVisitors: "Pelawat",
  noOnePresent: "Tiada sesiapa di lantai ini",
  noDataAvailable: "Tiada data tersedia",
  lastUpdated: "Kemaskini Terakhir",
  refresh: "Muat Semula",
  autoRefresh: "Muat Semula Auto",
  loading: "Memuatkan...",
  currentPresence: "Kehadiran Semasa",

  // User Management
  addUser: "Tambah Pengguna",
  editUser: "Sunting Pengguna",
  deleteUser: "Padam Pengguna",
  deleteConfirm: "Anda pasti mahu memadam pengguna ini?",
  deleteUserSuccess: "Berjaya memadam pengguna",
  saveUser: "Simpan Pengguna",
  userSaved: "Berjaya menyimpan pengguna",
  userSaveError: "Gagal menyimpan pengguna",
  name: "Nama",
  staffId: "No. Pekerja",
  phone: "No. Telefon",
  role: "Peranan",
  jabatan: "Jabatan",
  unit: "Unit",
  status: "Status",
  active: "Aktif",
  inactive: "Tidak Aktif",
  actions: "Tindakan",
  resetPassword: "Tetap Semula Kata Laluan",
  resetPasswordConfirm: "Anda pasti mahu menetap semula kata laluan pengguna ini?",
  resetPasswordSuccess: "Kata laluan berjaya ditetap semula",
  newPassword: "Kata Laluan Baharu",
  searchUsers: "Cari pengguna...",
  filterByRole: "Tapis mengikut peranan",
  allRoles: "Semua Peranan",

  // Floor Management
  addFloor: "Tambah Lantai",
  editFloor: "Sunting Lantai",
  deleteFloor: "Padam Lantai",
  deleteFloorConfirm: "Anda pasti mahu memadam lantai ini? Semua data kehadiran berkaitan akan dipadam.",
  floorName: "Nama Lantai",
  floorSaved: "Berjaya menyimpan lantai",
  floorSaveError: "Gagal menyimpan lantai",
  floorDeleted: "Berjaya memadam lantai",
  regenerateQR: "Jana Semula Kod QR",
  regenerateQRConfirm: "Anda pasti? Kod QR lama akan tidak sah serta-merta.",
  printQR: "Cetak Kod QR",
  qrCodeFor: "Kod QR untuk",

  // Manual Check-in
  manualCheckInTitle: "Daftar Masuk Manual",
  manualCheckInDesc: "Daftar masuk pengguna ke lantai tanpa imbasan kod QR. Hanya untuk Superadmin dan Admin.",
  selectUser: "Pilih Pengguna",
  selectFloor: "Pilih Lantai",
  manualCheckInSuccess: "Berjaya daftar masuk secara manual",
  manualCheckInError: "Gagal daftar masuk secara manual",

  // Reports
  generateReport: "Jana Laporan",
  exportCSV: "Eksport CSV",
  printReport: "Cetak Laporan",
  dateRange: "Julat Tarikh",
  fromDate: "Dari Tarikh",
  toDate: "Hingga Tarikh",
  reportType: "Jenis Laporan",
  presenceReport: "Laporan Kehadiran",
  attendanceHistory: "Sejarah Kehadiran",
  noReportData: "Tiada data untuk julat tarikh yang dipilih",
  reportGenerated: "Laporan berjaya dijana",

  // Profile
  editProfile: "Sunting Profil",
  changePassword: "Tukar Kata Laluan",
  currentPassword: "Kata Laluan Semasa",
  confirmNewPassword: "Sahkan Kata Laluan Baharu",
  passwordChanged: "Kata laluan berjaya ditukar",
  passwordChangeError: "Gagal menukar kata laluan",
  passwordMismatch: "Kata laluan tidak sepadan",
  profileUpdated: "Profil berjaya dikemaskini",
  profileUpdateError: "Gagal mengemaskini profil",

  // QR Scanner
  scanQRTitle: "Imbas Kod QR Lantai",
  scanQRInstruction: "Halakan kamera ke kod QR di pintu masuk lantai",
  cameraPermissionDenied: "Akses kamera dinafikan. Sila benarkan akses kamera dalam tetapan pelayar anda.",
  cameraError: "Gagal mengakses kamera. Sila pastikan kamera tersedia.",
  scanningReady: "Sedia untuk mengimbas...",
  scanFailed: "Gagal mengimbas kod QR. Sila cuba lagi.",
  invalidQRCode: "Kod QR tidak sah",

  // Validation
  required: "Ruangan ini wajib diisi",
  invalidUsername: "Nama pengguna tidak sah",
  minLength: (field: string, min: number) => `${field} mestilah sekurang-kurangnya ${min} aksara`,
  maxLength: (field: string, max: number) => `${field} mestilah tidak melebihi ${max} aksara`,
  invalidPhone: "Nombor telefon tidak sah",
  passwordMinLength: "Kata laluan mestilah sekurang-kurangnya 8 aksara",

  // General
  save: "Simpan",
  cancel: "Batal",
  delete: "Padam",
  edit: "Sunting",
  create: "Cipta",
  close: "Tutup",
  confirm: "Sahkan",
  back: "Kembali",
  next: "Seterusnya",
  search: "Cari...",
  noResults: "Tiada keputusan",
  error: "Ralat",
  success: "Berjaya",
  warning: "Amaran",
  info: "Maklumat",
  yes: "Ya",
  no: "Tidak",
  loading2: "Sedang memuatkan...",
  view: "Lihat",
  download: "Muat Turun",
  print: "Cetak",

  // Time/Date
  today: "Hari Ini",
  yesterday: "Semalam",
  justNow: "Baru sahaja",
  minutesAgo: (n: number) => `${n} minit yang lalu`,
  hoursAgo: (n: number) => `${n} jam yang lalu`,
  dateTimeFormat: "DD/MM/YYYY HH:mm",
  dateFormat: "DD/MM/YYYY",

  // Offline
  offlineMessage: "Anda sedang luar talian. Tindakan daftar masuk/keluar memerlukan sambungan internet.",
  backOnline: "Sambungan internet dipulihkan",

  // Cron/Auto checkout
  autoCheckoutTitle: "Daftar Keluar Automatik",
  autoCheckoutDesc: "Semua pengguna telah didaftar keluar secara automatik pada pukul 3:00 AM",

  // Errors
  serverError: "Ralat pelayan. Sila cuba lagi.",
  notFound: "Tidak dijumpai",
  unauthorized: "Anda tidak mempunyai kebenaran untuk tindakan ini",
  forbidden: "Akses ditolak",
} as const;

export type StringKeys = keyof typeof strings;