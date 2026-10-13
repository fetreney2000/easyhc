# Panduan Ketua Keselamatan: EasyHC (Easy Head Count)

## Pengenalan

- Peranan **Ketua Keselamatan** mempunyai akses bangunan penuh: kehadiran semua staf, laporan semua staf, lokasi semua kakitangan, dan kuasa pengurusan kecemasan
- Anda boleh memulakan dan menutup **Mod Evakuasi**, mengesahkan ketibaan sesiapa sahaja, dan melihat laporan selepas sesi tamat
- Anda juga boleh membuat **Paksa Keluar** untuk menutup rekod kehadiran sesiapa sahaja (tindakan ini direkodkan dalam log audit)
- Anda **tidak** menguruskan pengguna, lantai atau kod QR, urusan tersebut diuruskan oleh pentadbir (admin)

## Log Masuk dan Aplikasi Mudah Alih

- Log masuk menggunakan nama pengguna dan kata laluan seperti pengguna biasa
- Tambah EasyHC ke skrin utama anda supaya aplikasi boleh dibuka serta merta semasa kecemasan
- Di telefon Android (Chrome): tekan menu tiga titik, kemudian **Tambah ke Skrin Utama** atau **Pasang Aplikasi**
- Di iPhone (Safari): tekan butang **Kongsi**, kemudian **Tambah ke Skrin Utama**

## Papan Pemuka (Dashboard)

- Paparan **Jumlah Hadir** bangunan pada masa semasa, termasuk bilangan kakitangan dan pelawat
- Senarai kehadiran menunjukkan **semua staf dan pelawat** dalam lingkungan akses anda
- Gunakan ruangan carian untuk mencari nama seseorang
- Jika seseorang masih merekod hadir tetapi sepatutnya sudah keluar, tekan **Paksa Keluar** pada baris nama mereka
- Anda akan diminta mengesahkan sebelum tindakan paksa keluar dilaksanakan

## Halaman Semua Lantai

- Menu **Semua Lantai** menunjukkan kehadiran mengikut setiap lantai di bangunan
- Paparan ringkas: **Jumlah Hadir**, bilangan **Kakitangan** dan **Pelawat** setiap lantai
- Senarai nama, jenis, dan masa daftar masuk bagi setiap orang yang hadir
- Kolum **Tindakan** dengan butang **Paksa Keluar** tersedia untuk anda (bangunan penuh)
- Gunakan ruangan carian untuk mencarian pantas

## Lokasi Semua Kakitangan

- Menu **Lokasi Semua Kakitangan** menunjukkan staf mengikut lokasi lantai semasa mereka
- Berguna untuk mengenal pasti kedudukan staf semasa operasi

## Laporan

- Menu **Laporan** menunjukkan sejarah kehadiran **semua staf dan pelawat**
- Pilih **Dari Tarikh** dan **Hingga Tarikh** terlebih dahulu, kedua-dua tarikh wajib diisi sebelum sebarang data dipaparkan
- Tapis mengikut lantai atau jenis (kakitangan atau pelawat) jika perlu
- **Eksport CSV** memuat turun fail mengikut julat tarikh yang dipilih, **Cetak Laporan** untuk cetakan kertas

## Mod Evakuasi: Memulakan Sesi

- Buka menu **Mod Evakuasi** (pengguna biasa tidak melihat menu ini)
- Tekan butang **Mula Sesi Evakuasi** dan sahkan pengesahan
- Pada saat itu, **senarai jangkaan (roster) direkod**: semua kakitangan dan pelawat yang **sedang mendaftar masuk** pada masa tersebut, beserta lantai masing-masing
- Sesiapa yang tidak mendaftar masuk tidak akan dikira sebagai hilang, dan mereka hanya melihat notifikasi sesi sedang berlangsung tanpa butang dan tanpa statistik
- Semua skrin yang log masuk dalam aplikasi akan **bertukar kepada paparan kecemasan skrin penuh secara automatik**

## Mod Evakuasi: Semasa Sesi Berlangsung

- Paparan kecemasan menunjukkan **Belum Kesan** dengan huruf gergasi (keutamaan operasi), diikuti **Selamat** dan **Dijangka**, serta pecahan mengikut lantai
- Jika anda sendiri mendaftar masuk, butang gergasi **Saya Selamat** dipaparkan untuk mengesahkan ketibaan anda sendiri di tempat berkumpul
- Walaupun anda sendiri tidak mendaftar masuk, anda tetap melihat **keseluruhan statistik** dan boleh menguruskan sesi dari paparan tersebut
- **Senarai Pengesahan** menunjukkan semua nama mengikut lantai, dengan status selamat atau belum kesan (belum kesan sentiasa dipaparkan dahulu)
- Untuk pelawat atau staf yang tidak dapat mengesahkan sendiri, tekan **Tandakan selamat** pada baris nama mereka
- Gunakan **Batal tanda** untuk membetulkan pengesahan yang tersilap, tindakan pengesahan orang lain direkodkan dalam log audit
- Jika terdapat butang **Tukar Akaun** atau **Log Masuk** pada paparan, tekan untuk menukar akaun atau log masuk semula jika log masuk anda telah tamat

## Mod Evakuasi: Menutup Sesi

- Selepas semua orang disahkan atau operasi tamat, tekan **Tutup Sesi** dan sahkan
- Sesi akan **dibekukan sebagai rekod laporan** dan semua skrin kembali kepada aplikasi normal
- Selepas ditutup, pelawat yang belum mengesahkan tidak boleh mengesahkan lagi

## Laporan Evakuasi (Selepas Kejadian)

- Buka menu **Mod Evakuasi**, senarai **Laporan Evakuasi** dipaparkan di bawah ruangan sesi
- Setiap baris menunjukkan tarikh, **Tempoh** sesi, bilangan selamat, dijangka, dan belum kesan
- Tekan **Lihat** untuk membuka butiran laporan
- Butiran mengandungi: ringkasan (Selamat, Belum Kesan, Tempoh), pecahan **Mengikut Lantai**, dan **Senarai Pengesahan** lengkap dengan masa pengesahan setiap orang
- Untuk ketua keselamatan, senarai penuh semua lantai dipaparkan
- Tekan **Eksport CSV** untuk mendapatkan fail senarai lengkap sebagai rekod dokumentasi kejadian

## Paksa Keluar

- **Paksa Keluar** menutup rekod kehadiran seseorang yang masih merekod hadir tetapi sebenarnya sudah keluar bangunan
- Tersedia di Papan Pemuka dan Halaman Semua Lantai, bangunan penuh untuk ketua keselamatan
- Sentiasa sahkan dahulu dengan orang tersebut sebelum membuat paksa keluar
- Semua tindakan paksa keluar direkodkan dalam log audit berserta nama pelaku dan skop tindakan

## Nota Penting

- Anda tidak boleh mencetak kod QR (pengurusan lantai dan kod QR diuruskan oleh admin)
- Untuk menukar maklumat profil atau kata laluan anda sendiri, gunakan menu **Profil**
- Log masuk semula diperlukan selepas menukar kata laluan
- Hubungi pentadbir sistem jika memerlukan pengurusan pengguna, unit, jabatan atau lantai
