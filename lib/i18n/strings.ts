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

  // Attendance
  checkIn: "Daftar Masuk",
  checkedIn: "Daftar Masuk",
  checkOut: "Daftar Keluar",
  checkInError: "Gagal daftar masuk. Sila cuba lagi.",
  qrInvalid: "Kod QR tidak sah atau telah pun ditukar.",
  invalidCheckoutToken: "Token daftar keluar tidak sah. Sila imbas kod QR semula.",
  visitorAlreadyOnThisFloor:
    "Anda sudah berdaftar masuk di lantai ini. Sila daftar keluar dahulu.",
  visitorAlreadyOnFloor: (floorName: string) =>
    `Anda sudah berdaftar masuk di ${floorName}. Sila daftar keluar dahulu.`,
  visitorAlreadyCheckedIn:
    "Anda sudah berdaftar masuk. Sila daftar keluar dahulu.",
  visitorUseOriginalDevice:
    "Sila daftar keluar dengan peranti yang anda guna untuk mendaftar masuk, atau minta bantuan staf.",
  checkOutSuccess: "Berjaya daftar keluar",
  checkOutError: "Gagal daftar keluar. Sila cuba lagi.",
  forceCheckout: "Paksa Keluar",
  forceCheckoutConfirm: "Anda pasti mahu memaksa keluar pengguna ini?",
  forceCheckoutSuccess: "Berjaya memaksa keluar",

  // Visitor
  visitor: "Pelawat",
  visitorName: "Nama Pelawat",
  visitorPhone: "No. Telefon",
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
  loading: "Memuatkan...",

  // User Management
  addUser: "Tambah Pengguna",
  editUser: "Sunting Pengguna",
  deleteUser: "Padam Pengguna",
  deleteConfirm: "Anda pasti mahu memadam pengguna ini?",
  deleteUserSuccess: "Berjaya memadam pengguna",
  userSaved: "Berjaya menyimpan pengguna",
  userSaveError: "Gagal menyimpan pengguna",
  name: "Nama",
  phone: "No. Telefon",
  jawatanInfo: "Jawatan",
  jawatanInfoPlaceholder: "Contoh: Penolong Pegawai Farmasi",
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
  allRoles: "Semua Peranan",

  // Floor Management
  addFloor: "Tambah Lantai",
  addJabatan: "Tambah Jabatan",
  addUnit: "Tambah Unit",
  editFloor: "Sunting Lantai",
  deleteFloor: "Padam Lantai",
  deleteFloorConfirm: "Anda pasti mahu memadam lantai ini?",
  floorName: "Nama Lantai",
  floorSaved: "Berjaya menyimpan lantai",
  floorSaveError: "Gagal menyimpan lantai",
  floorDeleted: "Berjaya memadam lantai",
  regenerateQR: "Jana Semula Kod QR",
  regenerateQRConfirm: "Anda pasti? Kod QR lama akan tidak sah serta-merta.",
  printQR: "Cetak Kod QR",
  qrCodeFor: "Kod QR untuk",

  // Manual Check-in
  manualCheckInDesc: "Daftar masuk pengguna ke lantai tanpa imbasan kod QR. Hanya untuk Superadmin dan Admin.",
  selectUser: "Pilih Pengguna",
  selectFloor: "Pilih Lantai",
  manualCheckInSuccess: "Berjaya daftar masuk secara manual",
  manualCheckInError: "Gagal daftar masuk secara manual",

  // Reports
  exportCSV: "Eksport CSV",
  printReport: "Cetak Laporan",
  fromDate: "Dari Tarikh",
  toDate: "Hingga Tarikh",
  noReportData: "Tiada data untuk julat tarikh yang dipilih",

  // Profile
  editProfile: "Sunting Profil",
  changePassword: "Tukar Kata Laluan",
  currentPassword: "Kata Laluan Semasa",
  confirmNewPassword: "Sahkan Kata Laluan Baharu",
  passwordChanged: "Kata laluan berjaya ditukar",
  reloginRequired: "Sila log masuk semula dengan kata laluan baharu.",
  passwordChangeError: "Gagal menukar kata laluan",
  passwordMismatch: "Kata laluan tidak sepadan",
  profileUpdated: "Profil berjaya dikemaskini",
  profileUpdateError: "Gagal mengemaskini profil",

  // QR Scanner
  scanQRTitle: "Imbas Kod QR Lantai",
  scanQRInstruction: "Halakan kamera ke kod QR di pintu masuk lantai",
  cameraPermissionDenied: "Akses kamera dinafikan. Sila benarkan akses kamera dalam tetapan pelayar anda.",
  cameraError: "Gagal mengakses kamera. Sila pastikan kamera tersedia.",

  // Validation
  required: "Ruangan ini wajib diisi",
  invalidUsername: "Nama pengguna tidak sah",
  minLength: (field: string, min: number) => `${field} mestilah sekurang-kurangnya ${min} aksara`,
  maxLength: (field: string, max: number) => `${field} mestilah tidak melebihi ${max} aksara`,
  invalidPhone: "Nombor telefon tidak sah",
  passwordMinLength: "Kata laluan mestilah sekurang-kurangnya 6 aksara",

  // General
  save: "Simpan",
  cancel: "Batal",
  delete: "Padam",
  edit: "Sunting",
  create: "Cipta",
  confirm: "Sahkan",
  back: "Kembali",
  search: "Cari...",
  error: "Ralat",
  success: "Berjaya",
  warning: "Amaran",
  no: "Tidak",
  print: "Cetak",

  // Time/Date

  // Offline
  offlineMessage: "Anda sedang luar talian. Tindakan daftar masuk/keluar memerlukan sambungan internet.",
  backOnline: "Sambungan internet dipulihkan",

  // Cron/Auto checkout

  // Errors
  serverError: "Ralat pelayan. Sila cuba lagi.",
  forbidden: "Akses ditolak",
  tooManyAttempts: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi.",
  unauthorized: "Anda tidak mempunyai kebenaran untuk tindakan ini",

  // Shell / misc (previously inline in components)
  copyright: "Hak Cipta",
  lightMode: "Mod Siang",
  darkMode: "Mod Gelap",
  menu: "Menu",
  skipToContent: "Langkau ke kandungan utama",
  retry: "Cuba Lagi",
  pageNotFound: "Halaman tidak dijumpai",
  pageError: "Ralat semasa memaparkan halaman ini",
  offlineTitle: "Tiada sambungan internet",
  currentLocation: "Lokasi Semasa",
  unknownFloor: "Tidak Diketahui",
  employee: "Kakitangan",

  // Dashboard presence card
  checkedInAtFloor: "Anda berdaftar masuk di",
  pressButtonToCheckOut: "Tekan butang di sebelah untuk daftar keluar",

  // Placeholders & empty states
  namePlaceholder: "Contoh: Ali Bin Abu",
  jabatanPlaceholder: "Contoh: Jabatan Teknologi Maklumat",
  unitPlaceholder: "Contoh: Unit Pembangunan Sistem",
  noJabatanAvailable: "Tiada jabatan tersedia. Sila tambah jabatan dahulu.",
  noUnitAvailable: "Tiada unit tersedia. Sila tambah unit dahulu.",
  noUnitsYet: "Tiada unit. Sila tambah unit baharu.",
  noFloorsYet: "Tiada lantai dikonfigurasi. Sila tambah lantai dahulu.",

  // Delete confirmations
  deleteJabatan: "Padam Jabatan",
  jabatanDeleted: "Jabatan berjaya dipadam",
  deleteJabatanConfirm: (name: string) =>
    `Anda pasti mahu memadam jabatan "${name}"?`,
  deleteUnit: "Padam Unit",
  unitDeleted: "Unit berjaya dipadam",
  deleteUnitConfirm: (name: string) =>
    `Anda pasti mahu memadam unit "${name}"?`,

  // QR codes page + print labels
  qrIntro:
    "Setiap lantai mempunyai 2 jenis kod QR: satu untuk kakitangan (imbas dalam aplikasi) dan satu untuk pelawat (imbas dengan kamera telefon).",
  qrStaffLabel: "Kakitangan / Staff",
  qrVisitorLabel: "Pelawat / Visitor",
  qrStaffScanHint: "Imbas dalam aplikasi EasyHC",
  qrVisitorScanHint: "Imbas dengan kamera telefon (URL pelawat)",
  qrPrintStaffLabel: "KAKITANGAN / STAFF",
  qrPrintVisitorLabel: "PELAWAT / VISITOR",
  qrPrintStaffDesc: "Imbas menggunakan aplikasi EasyHC untuk daftar masuk",
  qrPrintVisitorDesc:
    "Imbas menggunakan kamera telefon anda untuk daftar masuk sebagai pelawat",
  qrRegenerated: "Kod QR berjaya dijana semula",

  // Row counts / export feedback
  recordsCount: (n: number) => `${n} rekod`,
  showingRange: (from: number, to: number, total: number) =>
    `Memaparkan ${from}–${to} daripada ${total} rekod`,
  csvExported: "Fail CSV berjaya dimuat turun",
  csvLimited: (n: number) => `Eksport dihadkan kepada ${n} rekod`,
  invalidDate: "Tarikh tidak sah",

  // Tables, filters and forms (previously inline literals)
  typeLabel: "Jenis",
  all: "Semua",
  searchByName: "Cari mengikut nama...",
  jabatanName: "Nama Jabatan",
  unitName: "Nama Unit",
  createdAt: "Tarikh Dicipta",
  homeFloor: "Lantai Asal",
  pickJabatan: "Pilih jabatan",
  pickFloorOptional: "Pilih lantai (pilihan)",
  editJabatan: "Sunting Jabatan",
  editUnit: "Sunting Unit",
  jabatanSaved: "Jabatan berjaya disimpan",
  unitSaved: "Unit berjaya disimpan",
  noJabatansYet: "Tiada jabatan. Sila tambah jabatan baharu.",
  countStaff: (n: number) => `${n} kakitangan`,
  countVisitors: (n: number) => `${n} pelawat`,
  qrEmployeeAlt: "Kod QR kakitangan",
  qrVisitorAlt: "Kod QR pelawat",

  // One-time setup API responses
  setupMissingFields:
    "Semua medan diperlukan: nama, nama pengguna, kata laluan",
  setupCredentialsRequired: "Nama pengguna dan kata laluan diperlukan",
  systemInitialized: "Sistem telah dikonfigurasi. Pengguna sudah wujud.",
  superadminCreated: "Superadmin berjaya dicipta",
  invalidSecret: "Rahsia tidak sah",
} as const;

export type StringKeys = keyof typeof strings;
