/*
  dtc-katalog.js
  Katalog DTC bersama untuk dashboard.html dan instruktur.html.
  Satu sumber data supaya skenario yang dibuat instruktur SAMA dengan yang dijalankan dashboard.

  Isi:
    FAMILIES  : kode DTC (nama, MIL, dampak, aturan deteksi, daftar pemeriksaan)
    ROOTS     : akar masalah yang bisa dipilih instruktur (id TETAP, jangan diubah urutannya
                karena id dipakai di kode skenario)
    buildSteps/answerKey : langkah quiz berlapis + kunci jawaban
    encode/decode Scenario/Result : kode skenario (instruktur -> peserta) dan kode hasil (peserta -> instruktur)
    randomScenario : skenario acak

  CATATAN: ini hosting statis. Kode hanya disamarkan ringan, bukan diamankan.
*/
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- umum
  const COMMON_CHECK = {
    dtc: { label: 'Baca DTC dan freeze-frame',
           why: 'Ini selalu langkah pertama: kode dan kondisi saat error terjadi mempersempit pencarian.' },
  };
  // Pengecoh umum (selalu salah sebagai langkah pemeriksaan)
  const GLOBAL_WRONG = [
    { id: 'g_ctrl',  label: 'Ganti controller',            why: 'Mahal dan belum ada bukti controller rusak. Isolasi dulu dari sensor, kabel, dan suplai.' },
    { id: 'g_motor', label: 'Ganti motor BLDC',            why: 'Gejala belum mengarah ke motor. Periksa sinyal dan suplai sebelum mengganti komponen besar.' },
    { id: 'g_clear', label: 'Hapus DTC lalu coba lagi',    why: 'Menghapus kode tidak memperbaiki akar masalah. Kode akan muncul lagi.' },
    { id: 'g_batt',  label: 'Ganti baterai',               why: 'Gejala tidak mengarah ke baterai.' },
    { id: 'g_learn', label: 'Jalankan self-learning ulang', why: 'Self-learning mengatur ulang parameter motor. Itu tidak memperbaiki sinyal atau kabel yang bermasalah.' },
  ];
  // Pengecoh untuk langkah "simpulkan akar masalah" dan "tindakan perbaikan"
  const GLOBAL_CAUSE = [
    { label: 'Controller rusak',          fb: 'Hasil pengukuran sebelumnya tidak menunjukkan kerusakan di controller.' },
    { label: 'Baterai lemah',             fb: 'Tegangan dan gejala tidak mengarah ke baterai.' },
    { label: 'Motor BLDC rusak',          fb: 'Hasil pengukuran sebelumnya tidak menunjukkan kerusakan pada motor.' },
  ];
  const GLOBAL_REPAIR = [
    { label: 'Ganti controller',   fb: 'Tindakan ini tidak menyentuh akar masalah yang sudah Anda buktikan.' },
    { label: 'Ganti motor BLDC',   fb: 'Tindakan ini tidak menyentuh akar masalah yang sudah Anda buktikan.' },
    { label: 'Hapus DTC saja',     fb: 'Menghapus kode tidak memperbaiki penyebabnya. Kode akan muncul lagi.' },
  ];

  // ---------------------------------------------------------------- keluarga DTC
  // impact: motor_off | limp | nocomm | none     mil: lampu MIL menyala saat terkonfirmasi
  // phys  : true bila bisa terdeteksi dari sensor kit (opsional "Deteksi fisik" di dashboard)
  const FAMILIES = {
    P0120: { name: 'Sirkuit throttle di luar rentang', mil: true, impact: 'motor_off', phys: false,
      rule: 'Status kanal TH tidak valid (hanya skenario virtual; error fisik belum terbaca karena throttle 0% = 0 V).',
      checks: {
        m5vthr: { label: 'Ukur +5V di header throttle', why: 'Dilakukan setelah DTC dibaca, untuk memastikan sensor mendapat suplai.' },
        m5vctl: { label: 'Ukur +5V di header controller', why: 'Berguna bila suplai di throttle hilang, untuk menentukan lokasi putusnya.' },
        mgnd:   { label: 'Ukur kontinuitas GND throttle ke controller', why: 'Dilakukan setelah suplai +5V terbukti normal.' },
        csig:   { label: 'Cek kontinuitas kabel SIG throttle ke controller', why: 'Dilakukan setelah suplai +5V dan GND terbukti baik.' },
        pot:    { label: 'Ukur resistansi potensiometer throttle', why: 'Dilakukan terakhir, setelah kabel suplai, GND, dan SIG terbukti baik.' },
      } },
    P0560: { name: 'Tegangan +5V rendah', mil: true, impact: 'motor_off', phys: true,
      rule: 'Pembacaan V5 turun di bawah 88% dari kondisi normal yang direkam (butuh "Deteksi fisik" + baseline).',
      checks: {
        m5vctl: { label: 'Ukur +5V di header controller', why: 'Dilakukan setelah DTC dibaca untuk melihat apakah rel +5V itu sendiri bermasalah.' },
        cwire:  { label: 'Periksa kabel +5V ke header controller', why: 'Dilakukan bila +5V di controller rendah dan beban belum dicurigai.' },
        unload: { label: 'Cabut sensor satu per satu sambil memantau +5V', why: 'Dilakukan bila +5V rendah tetapi kabel suplai tampak terpasang baik (curiga beban hubung singkat).' },
        mthr:   { label: 'Ukur +5V di header throttle', why: 'Belum perlu sebelum rel +5V di controller diperiksa.' },
      } },
    P0A3F: { name: 'Sensor Hall tidak terdeteksi', mil: true, impact: 'motor_off', phys: true,
      rule: 'Bit HALL berbeda dari kondisi normal yang direkam selama 2 detik.',
      checks: {
        conhall: { label: 'Periksa konektor HALL di controller dan motor', why: 'Pemeriksaan paling cepat; lakukan sebelum mengukur kabel.' },
        wiret:   { label: 'Cek kontinuitas 5 kabel Hall (+5V, GND, Ha, Hb, Hc)', why: 'Dilakukan setelah konektor terbukti terpasang baik.' },
        m5vhall: { label: 'Ukur +5V pada konektor Hall', why: 'Belum perlu bila konektor dan kabel belum diperiksa.' },
        other:   { label: 'Uji dengan motor BLDC lain', why: 'Terlalu mahal sebagai langkah awal.' },
      } },
    P0A04: { name: 'Fasa motor U/V/W tidak konsisten', mil: true, impact: 'motor_off', phys: true,
      rule: 'Pembacaan U/V/W tidak berada di kelas daya yang sama selama 1 detik.',
      checks: {
        phv:  { label: 'Baca nilai tiap fasa U, V, dan W', why: 'Dilakukan setelah DTC dibaca untuk melihat fasa mana yang menyimpang.' },
        hdr:  { label: 'Periksa header U/V/W yang terpasang di kotak BLDC', why: 'Dilakukan setelah terlihat ketiga fasa terbaca di kelas berbeda.' },
        conn: { label: 'Periksa kabel fasa satu per satu', why: 'Dilakukan bila ada fasa yang terbaca nol.' },
      } },
    U0100: { name: 'Komunikasi CAN BMS hilang', mil: true, impact: 'limp', phys: true,
      rule: 'Bit CAN BMS berbeda dari kondisi normal yang direkam selama 2 detik.',
      checks: {
        conn: { label: 'Periksa konektor CAN BMS di controller dan battery pack', why: 'Pemeriksaan paling cepat; lakukan sebelum polaritas dan terminasi.' },
        pol:  { label: 'Periksa polaritas CAN H/L (H ke H, L ke L)', why: 'Dilakukan setelah konektor terbukti terpasang baik.' },
        term: { label: 'Cek terminasi 120 ohm', why: 'Dilakukan bila polaritas dan konektor sudah benar tetapi komunikasi tetap gagal.' },
        bmsp: { label: 'Periksa suplai daya BMS', why: 'Belum perlu sebelum konektor dan polaritas CAN diperiksa.' },
      } },
    U0101: { name: 'Komunikasi CAN head unit hilang', mil: true, impact: 'nocomm', phys: true,
      rule: 'Bit CAN HU berbeda dari kondisi normal yang direkam selama 2 detik.',
      checks: {
        conn: { label: 'Periksa konektor CAN head unit di controller dan head unit', why: 'Pemeriksaan paling cepat; lakukan sebelum mengukur kabel.' },
        pol:  { label: 'Periksa polaritas CAN H/L', why: 'Dilakukan setelah konektor terbukti terpasang baik.' },
        cont: { label: 'Cek kontinuitas kedua konduktor CAN H dan L', why: 'Dilakukan setelah konektor dan polaritas terbukti benar.' },
      } },
    P0563: { name: 'Tegangan baterai tidak cocok dengan BLDC', mil: true, impact: 'none', phys: true,
      rule: 'Kombinasi BLDC dan tegangan paket termasuk Overvoltage/Extreme Over/Fatal Over di tabel kecepatan.',
      checks: {
        packv: { label: 'Cek paket baterai yang terpasang (jack BAT+)', why: 'Dilakukan setelah DTC dibaca untuk mengetahui tegangan yang masuk.' },
        rate:  { label: 'Cek rating tegangan BLDC yang terpasang', why: 'Dilakukan setelah tegangan paket diketahui, untuk dibandingkan.' },
        temp:  { label: 'Periksa suhu BLDC dan controller', why: 'Suhu relevan, tetapi tidak menjelaskan penyebab ketidakcocokan.' },
      } },
    P0A0C: { name: 'Baterai error (jalur negatif)', mil: true, impact: 'motor_off', phys: true,
      rule: 'BATT− terbaca di atas 300 selama 2 detik.',
      checks: {
        mbat: { label: 'Ukur BATT+ dan BATT− pada controller', why: 'Dilakukan setelah DTC dibaca untuk melihat sisi mana yang bermasalah.' },
        cneg: { label: 'Periksa kabel BAT− dari battery pack ke controller', why: 'Dilakukan setelah BATT− terbukti tidak normal.' },
        mcb:  { label: 'Periksa posisi MCB', why: 'BATT+ yang normal menunjukkan MCB sudah ON; pemeriksaan ini tidak membantu.' },
      } },
    P0571: { name: 'Rem tertahan saat throttle dibuka', mil: true, impact: 'none', phys: true,
      rule: 'Sinyal BRK aktif sementara throttle di atas 20% selama 3 detik.',
      checks: {
        sw:    { label: 'Lepas saklar rem lalu cek sinyal BRK', why: 'Langkah pembeda paling cepat antara saklar dan kabel.' },
        wire:  { label: 'Cek kabel BRK terhadap GND (hubung singkat)', why: 'Dilakukan bila sinyal tetap aktif walau saklar dilepas.' },
        lever: { label: 'Periksa tuas rem mekanik', why: 'Tuas yang macet tidak menjelaskan sinyal yang tetap aktif saat saklar dilepas.' },
      } },
    B1001: { name: 'Standar samping terdeteksi saat throttle dibuka', mil: false, impact: 'none', phys: true,
      rule: 'Sinyal STND aktif sementara throttle di atas 10% selama 1 detik.',
      checks: {
        mech: { label: 'Periksa posisi standar samping secara mekanik', why: 'Pastikan standar benar-benar terlipat sebelum mencurigai kelistrikan.' },
        sw:   { label: 'Lepas saklar standar lalu cek sinyal STND', why: 'Dilakukan setelah posisi mekanik terbukti benar.' },
        wire: { label: 'Cek kabel STND terhadap GND', why: 'Dilakukan bila sinyal tetap aktif walau saklar dilepas.' },
      } },
    B0500: { name: 'Error charger', mil: false, impact: 'none', phys: true,
      rule: 'Pembacaan ADC charger berada di rentang 1400-2200 (stabil 0,5 detik).',
      checks: {
        plug:  { label: 'Periksa jenis plug dan port charging yang dipakai', why: 'Pemeriksaan paling cepat untuk error charger.' },
        cable: { label: 'Periksa kabel charger', why: 'Dilakukan setelah plug dan port terbukti cocok.' },
        pack:  { label: 'Periksa paket baterai tujuan', why: 'Dilakukan setelah plug, port, dan kabel terbukti baik.' },
      } },
    // Tidak bisa disuntik instruktur, tetapi muncul dari simulasi
    P0A02: { name: 'Kerusakan BLDC', mil: true, impact: 'motor_off', phys: true, rule: 'Model kerusakan overvoltage: throttle penuh dipertahankan pada kombinasi yang tidak cocok.', checks: null },
    P0A03: { name: 'Kerusakan controller', mil: true, impact: 'motor_off', phys: true, rule: 'Model kerusakan overvoltage: controller panas atau hangus.', checks: null },
    P0217: { name: 'Proteksi suhu BLDC aktif', mil: true, impact: 'none', phys: true, rule: 'Suhu BLDC 8000W mencapai 110 C (turun otomatis ke Mode 1 sampai 90 C).', checks: null },
  };

  // ---------------------------------------------------------------- akar masalah (id TETAP)
  const R = (id, dtc, key, title, symptom, inject, path, repair, learn) =>
    ({ id, dtc, key, title, symptom, inject, path, repair, learn });

  const ROOTS = [
    R(1, 'P0120', 'thr_sig_open', 'Kabel SIG throttle putus',
      'Knob throttle diputar tetapi motor tidak berputar. Lampu MIL menyala.',
      { th: 'open' },
      [['dtc'], ['m5vthr', '5,02 V. Suplai +5V di header throttle normal.'], ['mgnd', 'Kontinuitas GND throttle ke controller baik (0,2 ohm).'],
       ['csig', 'Tidak ada kontinuitas di kabel SIG: kabel putus.']],
      'Sambung ulang atau ganti kabel SIG throttle ke TH_SIG',
      'Sinyal throttle yang terbuka terbaca 0 V, di luar rentang valid, sehingga controller menolak perintah gas demi keselamatan.'),
    R(2, 'P0120', 'thr_5v_lost', 'Suplai +5V ke throttle terputus',
      'Throttle tidak merespons sama sekali. Lampu MIL menyala.',
      { th: 'open' },
      [['dtc'], ['m5vthr', '0,00 V. Tidak ada +5V di header throttle.'], ['m5vctl', '5,01 V. Rel +5V di header controller normal, jadi putusnya di kabel menuju throttle.']],
      'Sambung ulang kabel +5V dari controller ke throttle',
      'Tanpa suplai +5V, sensor throttle tidak punya tegangan acuan sehingga sinyalnya 0 V.'),
    R(3, 'P0120', 'thr_gnd_open', 'GND throttle lepas',
      'Motor menyentak atau berputar sendiri tanpa dikendalikan. Lampu MIL menyala.',
      { th: 'high' },
      [['dtc'], ['m5vthr', '5,03 V. Suplai +5V di header throttle normal.'], ['mgnd', 'Tidak ada kontinuitas GND: kabel GND throttle lepas.']],
      'Pasang kembali kabel GND throttle',
      'GND yang lepas membuat sinyal mengambang ke tegangan tinggi, terbaca sebagai gas penuh yang tidak valid.'),
    R(4, 'P0120', 'thr_pot_fail', 'Potensiometer throttle rusak',
      'Throttle tidak merespons walau kabel tampak baik. Lampu MIL menyala.',
      { th: 'open' },
      [['dtc'], ['m5vthr', '5,01 V. Suplai normal.'], ['mgnd', 'Kontinuitas GND baik.'], ['csig', 'Kontinuitas kabel SIG baik.'],
       ['pot', 'Resistansi track potensiometer tak terhingga: track putus.']],
      'Ganti modul throttle (potensiometer)',
      'Bila suplai, GND, dan kabel SIG terbukti baik, sumber masalah ada di sensornya sendiri.'),

    R(5, 'P0560', 'v5_wire_open', 'Kabel +5V controller lepas dari header',
      'Beberapa sensor tidak bekerja sekaligus. Lampu MIL menyala.',
      { v5: 'low' },
      [['dtc'], ['m5vctl', '1,3 V. Rel +5V di header controller jauh di bawah normal (4,9 sampai 5,1 V).'], ['cwire', 'Kabel +5V terlepas dari header controller.']],
      'Pasang kembali kabel +5V ke header controller',
      'Satu rel +5V melayani banyak sensor, jadi kehilangannya membuat banyak sensor gagal sekaligus.'),
    R(6, 'P0560', 'v5_short_hall', 'Kabel Hall konslet menarik +5V',
      'Beberapa sensor tidak bekerja sekaligus. Lampu MIL menyala.',
      { v5: 'low' },
      [['dtc'], ['m5vctl', '1,9 V. Rel +5V rendah padahal kabel suplai terpasang baik.'], ['unload', 'Saat konektor Hall dicabut, +5V kembali 5,0 V: ada hubung singkat di jalur Hall.']],
      'Ganti kabel atau sensor Hall yang konslet',
      'Beban yang konslet menarik rel +5V turun. Mencabut beban satu per satu menunjukkan siapa penyebabnya.'),

    R(7, 'P0A3F', 'hall_conn_lost', 'Konektor Hall terlepas',
      'Motor tidak berputar atau bergetar. Lampu MIL menyala.',
      { hall: 'lost' },
      [['dtc'], ['conhall', 'Konektor HALL terlepas dari soket.']],
      'Pasang kembali konektor HALL sampai terkunci',
      'Controller memerlukan posisi rotor dari sensor Hall untuk mengatur urutan fasa.'),
    R(8, 'P0A3F', 'hall_wire_open', 'Salah satu kabel Hall putus',
      'Motor tidak berputar atau bergetar. Lampu MIL menyala.',
      { hall: 'lost' },
      [['dtc'], ['conhall', 'Konektor terpasang baik dan terkunci.'], ['wiret', 'Kabel Hb tidak memiliki kontinuitas: putus.']],
      'Ganti atau sambung kabel Hall yang putus',
      'Satu kabel Hall yang putus sudah cukup membuat informasi posisi rotor tidak lengkap.'),

    R(9, 'P0A04', 'uvw_wrong_header', 'Kabel fasa terpasang di header motor yang berbeda',
      'Motor tidak mau berputar dan lampu MIL menyala setelah motor dipindah.',
      { uvw: 'mismatch' },
      [['dtc'], ['phv', 'U = 100, V = 500, W = 800. Tiga fasa terbaca di kelas daya berbeda.'], ['hdr', 'Satu kabel fasa terpasang di header motor lain (400W/2000W/8000W tercampur).']],
      'Pasang U, V, dan W ke satu header motor yang sama',
      'Ketiga fasa harus berasal dari motor yang sama; pembacaan yang tercampur menunjukkan kesalahan pemasangan.'),
    R(10, 'P0A04', 'uvw_phase_open', 'Satu kabel fasa lepas',
      'Motor tidak mau berputar dan lampu MIL menyala.',
      { uvw: 'phase_open' },
      [['dtc'], ['phv', 'U = 800, V = 0, W = 800. Fasa V tidak terbaca.'], ['conn', 'Kabel fasa V terlepas dari header.']],
      'Pasang kembali kabel fasa V',
      'Kehilangan satu fasa membuat motor tidak bisa berputar normal dan berisiko merusak controller.'),

    R(11, 'U0100', 'canbms_cable', 'Kabel CAN BMS terlepas',
      'Kendaraan jalan tetapi sangat lambat. Lampu MIL menyala.',
      { canBms: 'lost' },
      [['dtc'], ['conn', 'Konektor CAN BMS terlepas dari battery pack.']],
      'Pasang kembali kabel CAN BMS',
      'Tanpa data BMS, controller tidak tahu batas arus aman sehingga membatasi kecepatan (mode limp).'),
    R(12, 'U0100', 'canbms_swap', 'CAN H dan L tertukar',
      'Kendaraan jalan tetapi sangat lambat. Lampu MIL menyala setelah kabel CAN dipasang ulang.',
      { canBms: 'lost' },
      [['dtc'], ['conn', 'Konektor terpasang baik di kedua sisi.'], ['pol', 'CAN H dan CAN L tertukar di salah satu sisi.']],
      'Tukar kembali kabel CAN H dan CAN L',
      'CAN adalah pasangan diferensial. Polaritas terbalik membuat data tidak terbaca.'),

    R(13, 'U0101', 'canhu_cable', 'Kabel CAN head unit terlepas',
      'Head unit mati total tetapi motor masih bisa dikendalikan. Lampu MIL menyala.',
      { canHu: 'lost' },
      [['dtc'], ['conn', 'Konektor CAN head unit terlepas dari controller.']],
      'Pasang kembali kabel CAN head unit',
      'Head unit menerima semua data tampilan lewat CAN, jadi tanpa CAN ia tidak menampilkan apa pun.'),
    R(14, 'U0101', 'canhu_break', 'Salah satu konduktor CAN head unit putus',
      'Head unit mati total walau konektor terpasang. Lampu MIL menyala.',
      { canHu: 'lost' },
      [['dtc'], ['conn', 'Konektor terpasang baik di kedua sisi.'], ['cont', 'Konduktor CAN L tidak memiliki kontinuitas: putus di dalam kabel.']],
      'Ganti kabel CAN head unit',
      'Kabel yang tampak utuh tetap bisa putus di bagian dalam; kontinuitas harus diukur.'),

    R(15, 'P0563', 'pack_mismatch', 'Paket 96V terpasang pada BLDC 400W',
      'Kendaraan terasa sangat kencang dan lampu MIL menyala. Berhati-hatilah saat menguji.',
      { pack: 'mismatch' },
      [['dtc'], ['packv', 'Paket 96V terpasang (BAT+ di jack 96V).'], ['rate', 'BLDC terpasang 400W dengan rating maksimal 48V.']],
      'Ganti ke paket 48V yang sesuai rating BLDC',
      'Tegangan jauh di atas rating motor menaikkan putaran dan panas sehingga komponen cepat rusak.'),

    R(16, 'P0A0C', 'bat_neg_open', 'Kabel BAT- ke controller lepas',
      'Kendaraan tidak mau jalan dan lampu MIL menyala. BATT+ tampak normal.',
      { battNeg: 'open' },
      [['dtc'], ['mbat', 'BATT+ normal, BATT- terbaca 520 (seharusnya mendekati 0): jalur negatif terbuka.'], ['cneg', 'Kabel BAT- ke terminal -B controller terlepas.']],
      'Pasang kembali kabel BAT- ke terminal -B controller',
      'Jalur negatif yang terbuka mengangkat potensial BATT- sehingga dianggap kesalahan baterai.'),

    R(17, 'P0571', 'brk_stuck', 'Saklar rem macet',
      'Motor tidak mau menarik walau throttle dibuka penuh.',
      { brk: 'stuck' },
      [['dtc'], ['sw', 'Saat saklar rem dilepas, sinyal BRK kembali normal: saklar macet dalam kondisi aktif.']],
      'Ganti saklar rem',
      'Sinyal rem yang selalu aktif memotong output motor demi keselamatan.'),
    R(18, 'P0571', 'brk_short', 'Kabel BRK menempel ke GND',
      'Motor tidak mau menarik walau throttle dibuka penuh.',
      { brk: 'stuck' },
      [['dtc'], ['sw', 'Saklar dilepas, sinyal BRK tetap aktif: bukan saklarnya.'], ['wire', 'Isolasi kabel BRK terkelupas dan menempel ke GND.']],
      'Perbaiki isolasi atau ganti kabel BRK',
      'Hubung singkat ke GND meniru sinyal rem aktif walau tuas tidak ditekan.'),

    R(19, 'B1001', 'std_stuck', 'Saklar standar samping macet',
      'Motor tidak mau jalan dan indikator Park menyala padahal standar sudah dilipat.',
      { std: 'stuck' },
      [['dtc'], ['mech', 'Standar sudah terlipat sempurna.'], ['sw', 'Saat saklar standar dilepas, sinyal STND normal: saklar macet.']],
      'Ganti atau bersihkan saklar standar samping',
      'Interlock standar samping mencegah kendaraan jalan; saklar yang macet menipu sistem.'),

    R(20, 'B0500', 'chg_plug_mismatch', 'Plug charger tidak cocok dengan port',
      'Charger menolak mengisi dan indikator ERROR menyala.',
      { charger: 'mismatch' },
      [['dtc'], ['plug', 'Plug FAST dimasukkan ke port SLOW (tidak cocok).']],
      'Pasang plug yang sesuai dengan port charging pada paket',
      'Plug dan port yang tidak sesuai terbaca sebagai kondisi error oleh pendeteksi charger.'),
  ];
  const ROOT_BY_ID = {}; ROOTS.forEach(r => { ROOT_BY_ID[r.id] = r; });

  // ---------------------------------------------------------------- util
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function checkLabel(fam, id) { return id === 'dtc' ? COMMON_CHECK.dtc.label : fam.checks[id].label; }

  // ---------------------------------------------------------------- langkah quiz & kunci jawaban
  // Mengembalikan daftar langkah. option: {label, ok, fb, res}. res=null + dyn:'dtc' berarti hasil dibuat dashboard.
  function buildSteps(rootId, seed) {
    const r = ROOT_BY_ID[rootId], fam = FAMILIES[r.dtc];
    const rnd = mulberry32((seed >>> 0) * 131 + rootId * 17 + 5);
    const steps = [], done = [];

    r.path.forEach((p, i) => {
      const cid = p[0], res = p[1] || null;
      const correct = { label: checkLabel(fam, cid), ok: true, res, dyn: cid === 'dtc' ? 'dtc' : null };
      const famPool = Object.keys(fam.checks).filter(k => k !== cid && done.indexOf(k) < 0)
        .map(k => ({ label: fam.checks[k].label, ok: false, fb: 'Pemeriksaan ini valid, tetapi belum waktunya: ' + fam.checks[k].why }));
      const glob = GLOBAL_WRONG.map(g => ({ label: g.label, ok: false, fb: g.why }));
      const wrong = shuffle(famPool, rnd).slice(0, 2);
      const fill = shuffle(glob, rnd);
      while (wrong.length < 3) wrong.push(fill.shift());
      steps.push({ kind: 'check', q: i === 0 ? 'Gejala sudah dilaporkan. Apa langkah pertama yang Anda lakukan?' : 'Langkah pemeriksaan berikutnya?', options: shuffle([correct].concat(wrong), rnd) });
      done.push(cid);
    });

    // simpulkan akar masalah
    const sibs = ROOTS.filter(x => x.dtc === r.dtc);
    const cOpts = sibs.map(x => ({ label: x.title, ok: x.id === r.id, fb: 'Hasil ukur di log tidak mendukung kesimpulan ini. Bandingkan lagi hasil tiap langkah.' }));
    const gc = shuffle(GLOBAL_CAUSE, rnd);
    while (cOpts.length < 4) { const g = gc.shift(); cOpts.push({ label: g.label, ok: false, fb: g.fb }); }
    steps.push({ kind: 'conclude', q: 'Berdasarkan hasil pengukuran, apa akar masalahnya?', options: shuffle(cOpts, rnd) });

    // tindakan perbaikan
    const rOpts = sibs.map(x => ({ label: x.repair, ok: x.id === r.id, fb: 'Tindakan ini tidak sesuai dengan akar masalah yang Anda buktikan.' }));
    const gr = shuffle(GLOBAL_REPAIR, rnd);
    while (rOpts.length < 4) { const g = gr.shift(); rOpts.push({ label: g.label, ok: false, fb: g.fb }); }
    steps.push({ kind: 'repair', q: 'Apa tindakan perbaikan yang tepat?', options: shuffle(rOpts, rnd) });
    return steps;
  }

  function answerKey(rootId) {
    const r = ROOT_BY_ID[rootId], fam = FAMILIES[r.dtc];
    return {
      id: r.id, dtc: r.dtc, dtcName: fam.name, title: r.title, symptom: r.symptom, repair: r.repair, learn: r.learn,
      inject: r.inject, mil: fam.mil, impact: fam.impact, rule: fam.rule,
      path: r.path.map(p => ({ check: checkLabel(fam, p[0]), result: p[1] || 'Kode dan freeze-frame menampilkan ' + r.dtc + ' (' + fam.name + ') beserta kondisi saat terjadi.' })),
    };
  }
  function briefing(rootId) {
    const r = ROOT_BY_ID[rootId];
    return r.symptom + ' Nyalakan ignition untuk memulai pemeriksaan.';
  }

  // ---------------------------------------------------------------- kode skenario & hasil
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford (tanpa I, L, O, U)
  const KEY = [0x5A, 0xC3, 0x17, 0x9E, 0x2B, 0x71, 0xD4, 0x08, 0x66, 0xB9, 0x3C, 0xE1, 0x4F, 0xA2];
  const obf = (bytes) => bytes.map((b, i) => (b ^ KEY[i % KEY.length]) & 255);
  function toB32(bytes) {
    let bits = 0, val = 0, out = '';
    bytes.forEach(b => { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; });
    if (bits > 0) out += B32[(val << (5 - bits)) & 31];
    return out;
  }
  function fromB32(s) {
    let bits = 0, val = 0; const out = [];
    for (const ch of s) {
      const v = B32.indexOf(ch); if (v < 0) return null;
      val = (val << 5) | v; bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; val &= (1 << bits) - 1; }
    }
    return out;
  }
  const sum = (a) => { let s = 7; a.forEach(b => { s = (s * 31 + b) & 255; }); return s; };
  function group(s) { return s.replace(/(.{5})/g, '$1-').replace(/-$/, ''); }
  function clean(s, prefix) {
    s = String(s || '').toUpperCase().replace(/[\s_]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (s.indexOf(prefix) === 0) s = s.slice(prefix.length);
    return s.replace(/-/g, '');
  }

  // cfg = {faults:[id,...], seed:0..65535, time: menit (0 = tanpa batas)}
  function encodeScenario(cfg) {
    const f = (cfg.faults || []).slice(0, 3);
    const seed = (cfg.seed || 0) & 0xFFFF, time = Math.max(0, Math.min(255, cfg.time || 0));
    const b = [1, f.length, time, seed >> 8, seed & 255].concat(f);
    b.push(sum(b));
    return 'EV1-' + group(toB32(obf(b)));
  }
  function decodeScenario(code) {
    const raw = fromB32(clean(code, 'EV1'));
    if (!raw || raw.length < 6) return null;
    const b = obf(raw);
    if (b[0] !== 1) return null;
    const n = b[1]; if (n < 1 || n > 3 || b.length < 6 + n) return null;
    const body = b.slice(0, 5 + n);
    if (b[5 + n] !== sum(body)) return null;
    const faults = b.slice(5, 5 + n);
    if (faults.some(id => !ROOT_BY_ID[id])) return null;
    return { faults, time: b[2], seed: (b[3] << 8) | b[4] };
  }
  // res = {faults, seed, score, wrong, time (detik), status: 1 selesai | 2 waktu habis | 3 menyerah}
  function encodeResult(res) {
    const f = (res.faults || []).slice(0, 3), seed = (res.seed || 0) & 0xFFFF;
    const t = Math.max(0, Math.min(65535, Math.round(res.time || 0)));
    const b = [1, f.length, seed >> 8, seed & 255].concat(f, [Math.max(0, Math.min(100, res.score)), Math.min(255, res.wrong || 0), t >> 8, t & 255, res.status || 1]);
    b.push(sum(b));
    return 'RS1-' + group(toB32(obf(b)));
  }
  function decodeResult(code) {
    const raw = fromB32(clean(code, 'RS1'));
    if (!raw || raw.length < 11) return null;
    const b = obf(raw);
    if (b[0] !== 1) return null;
    const n = b[1]; if (n < 1 || n > 3) return null;
    const len = 4 + n + 5;
    if (b.length < len + 1 || b[len] !== sum(b.slice(0, len))) return null;
    const faults = b.slice(4, 4 + n);
    if (faults.some(id => !ROOT_BY_ID[id])) return null;
    const o = 4 + n;
    return { faults, seed: (b[2] << 8) | b[3], score: b[o], wrong: b[o + 1], time: (b[o + 2] << 8) | b[o + 3], status: b[o + 4] };
  }
  const STATUS_LABEL = { 1: 'Selesai', 2: 'Waktu habis', 3: 'Menyerah' };

  // ---------------------------------------------------------------- skenario acak
  // n = 1..3 (jumlah error berlapis), dipilih dari keluarga DTC yang berbeda
  function randomScenario(n, rnd, opts) {
    rnd = rnd || Math.random; opts = opts || {};
    const pool = ROOTS.filter(r => !opts.only || opts.only.indexOf(r.dtc) >= 0);
    const fams = shuffle(Array.from(new Set(pool.map(r => r.dtc))), rnd).slice(0, Math.max(1, Math.min(3, n)));
    const faults = fams.map(f => { const c = pool.filter(r => r.dtc === f); return c[Math.floor(rnd() * c.length)].id; });
    return { faults, seed: Math.floor(rnd() * 65536), time: opts.time || 0 };
  }

  root.DTC_KATALOG = {
    FAMILIES, ROOTS, ROOT_BY_ID, COMMON_CHECK, GLOBAL_WRONG, STATUS_LABEL,
    buildSteps, answerKey, briefing,
    encodeScenario, decodeScenario, encodeResult, decodeResult, randomScenario,
    mulberry32, shuffle,
  };
})(typeof window !== 'undefined' ? window : globalThis);
