/* =====================================================================
   TEMA.JS: satu-satunya berkas desain.
   Ubah di sini, Beranda dan semua modul ikut berubah.

   CARA CEPAT
   1. Ganti TEMA_AKTIF di bawah (fasa, magenta, kertas, laboratorium, senja).
   2. Timpa sebagian nilai lewat KUSTOM, misalnya ganti bentuk kursor saja.
   3. Coba tanpa mengedit: tambahkan ?tema=magenta di akhir alamat halaman.
   ===================================================================== */

const TEMA_AKTIF = 'fasa';

/* Timpa nilai tema aktif. Contoh (hapus tanda // untuk memakai):
   const KUSTOM = { kursor:'petir', latar:'partikel', warna:{ v:'#00FFAA' } };       */


//const KUSTOM = {};

const KUSTOM = {kursor:'petir'};
/* ---------------------------------------------------------------------
   PILIHAN NILAI
   kursor : cincin | bidik | petir | jejak | bawaan
   latar  : gelombang | partikel | grid | tidak ada
   kecepatan : 0.5 (pelan) sampai 2 (cepat)     kekuatan : 0 (samar) sampai 1 (tegas)
   warna  : u, v, w = tiga warna utama (v dipakai sebagai warna aksen/tombol utama)
   --------------------------------------------------------------------- */
const URL_FONT_SORA = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Sora:wght@400;500;600&display=swap';
const URL_FONT_MONO = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap';

const TEMA = {
  fasa: { nama:'Tiga Fasa', gelap:true,
    warna:{ ink:'#060A12', panel:'#0C1220', line:'#1B2740', text:'#E6ECF5', dim:'#8593AA', u:'#FFC857', v:'#3DDC97', w:'#4DA3FF', alert:'#FF6B8B' },
    font:{ disp:"'Chakra Petch'", body:"'Sora'", url:URL_FONT_SORA },
    kursor:'cincin', latar:'gelombang', kecepatan:1, kekuatan:.4 },

  magenta: { nama:'Magenta Neon', gelap:true,
    warna:{ ink:'#0B0614', panel:'#140B24', line:'#2C1A4A', text:'#F3E9FF', dim:'#9C86BD', u:'#FFB703', v:'#FF3DCB', w:'#7C5CFF', alert:'#FF5C5C' },
    font:{ disp:"'Chakra Petch'", body:"'Sora'", url:URL_FONT_SORA },
    kursor:'bidik', latar:'grid', kecepatan:1, kekuatan:.5 },

  kertas: { nama:'Kertas Terang', gelap:false,
    warna:{ ink:'#F5F6F8', panel:'#FFFFFF', line:'#D8DEE7', text:'#121A27', dim:'#586577', u:'#B77A00', v:'#0B8F63', w:'#1F6FEB', alert:'#D6336C' },
    font:{ disp:"'Chakra Petch'", body:"'Sora'", url:URL_FONT_SORA },
    kursor:'cincin', latar:'partikel', kecepatan:.8, kekuatan:.35 },

  laboratorium: { nama:'Laboratorium', gelap:true,
    warna:{ ink:'#030D08', panel:'#07170F', line:'#12361F', text:'#D8FFE6', dim:'#6FA586', u:'#B6FF3D', v:'#39FF88', w:'#2FE0D0', alert:'#FF5C5C' },
    font:{ disp:"'IBM Plex Mono'", body:"'IBM Plex Mono'", url:URL_FONT_MONO },
    kursor:'jejak', latar:'partikel', kecepatan:1, kekuatan:.45 },

  senja: { nama:'Senja', gelap:true,
    warna:{ ink:'#130A07', panel:'#1E110B', line:'#3A2417', text:'#FFEFE3', dim:'#B79380', u:'#FF9F43', v:'#FFC857', w:'#FF6B6B', alert:'#FF4D6D' },
    font:{ disp:"'Chakra Petch'", body:"'Sora'", url:URL_FONT_SORA },
    kursor:'petir', latar:'gelombang', kecepatan:.9, kekuatan:.4 }
};

/* ================= MESIN TEMA (biasanya tidak perlu diubah) ================= */
(function () {
  const q = new URLSearchParams(location.search).get('tema');
  const dasar = TEMA[q] || TEMA[TEMA_AKTIF] || TEMA.fasa;
  const T = Object.assign({}, dasar, KUSTOM);
  T.warna = Object.assign({}, dasar.warna, KUSTOM.warna);
  T.font = Object.assign({}, dasar.font, KUSTOM.font);
  const REDUCE = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const root = document.documentElement;

  // warna dan font
  Object.entries(T.warna).forEach(([k, v]) => root.style.setProperty('--' + k, v));
  root.style.setProperty('--disp', T.font.disp + ",system-ui,sans-serif");
  root.style.setProperty('--body', T.font.body + ",system-ui,sans-serif");
  root.style.colorScheme = T.gelap ? 'dark' : 'light';
  if (T.font.url) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = T.font.url; document.head.appendChild(l); }

  // gaya kursor dan latar
  const st = document.createElement('style');
  st.textContent = `
  html.tk-on,html.tk-on *{cursor:none!important}
  html.tk-on input{cursor:text!important}
  .tk-e{position:fixed;left:0;top:0;z-index:9999;pointer-events:none}
  .tk-i{display:block;transition:transform .18s,background .2s,border-color .2s,stroke .2s}
  .tk-dot{width:7px;height:7px;border-radius:50%;background:var(--v)}
  .tk-ring{width:36px;height:36px;border-radius:50%;border:1.5px solid var(--v)}
  .tk-hot .tk-ring{transform:scale(1.7);background:color-mix(in srgb,var(--v) 12%,transparent);border-color:var(--u)}
  .tk-down .tk-ring{transform:scale(.7)}
  .tk-svg{width:40px;height:40px;fill:none;stroke:var(--v);stroke-width:1.6;filter:drop-shadow(0 0 5px var(--v))}
  .tk-hot .tk-svg{transform:rotate(45deg) scale(1.25);stroke:var(--u)}
  .tk-down .tk-svg{transform:scale(.8)}
  .tk-bolt{width:26px;height:26px;fill:var(--u);stroke:none;filter:drop-shadow(0 0 6px var(--u))}
  .tk-hot .tk-bolt{transform:scale(1.35) rotate(-14deg);fill:var(--v)}
  .tk-down .tk-bolt{transform:scale(.8)}
  #tk-bg{position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
  #tk-trail{position:fixed;inset:0;width:100%;height:100%;z-index:9998;pointer-events:none}`;
  document.head.appendChild(st);

  let mx = innerWidth / 2, my = innerHeight / 2;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });

  function mulai() {
    // ---------- KURSOR ----------
    if (T.kursor !== 'bawaan' && matchMedia('(pointer:fine)').matches && !REDUCE) {
      const bentuk = {
        cincin: [['<span class="tk-i tk-dot"></span>', 1], ['<span class="tk-i tk-ring"></span>', .16]],
        bidik:  [['<svg class="tk-i tk-svg" viewBox="-20 -20 40 40"><circle r="11"/><path d="M-19 0H-5M5 0H19M0-19V-5M0 5V19"/></svg>', .3]],
        petir:  [['<svg class="tk-i tk-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>', .35]],
        jejak:  [['<span class="tk-i tk-dot"></span>', 1]]
      }[T.kursor] || [];
      const els = bentuk.map(([html, lag]) => {
        const e = document.createElement('div'); e.className = 'tk-e'; e.innerHTML = html;
        document.body.appendChild(e); return { e, lag, x: mx, y: my };
      });
      root.classList.add('tk-on');
      const tr = T.kursor === 'jejak' ? document.createElement('canvas') : null, pts = [];
      let tc; if (tr) { tr.id = 'tk-trail'; document.body.appendChild(tr); tc = tr.getContext('2d'); }
      document.addEventListener('pointerover', e => root.classList.toggle('tk-hot', !!e.target.closest('a,button,input,select,textarea,[role=button]')));
      addEventListener('pointerdown', () => root.classList.add('tk-down'));
      addEventListener('pointerup', () => root.classList.remove('tk-down'));
      (function loop() {
        els.forEach(o => { o.x += (mx - o.x) * o.lag; o.y += (my - o.y) * o.lag; o.e.style.transform = `translate(${o.x}px,${o.y}px) translate(-50%,-50%)`; });
        if (tc) {
          tr.width = innerWidth; tr.height = innerHeight;
          pts.push({ x: mx, y: my, a: 1 });
          for (let i = pts.length - 1; i >= 0; i--) {
            const p = pts[i]; p.a -= .035;
            if (p.a <= 0) { pts.splice(i, 1); continue; }
            tc.globalAlpha = p.a; tc.fillStyle = i % 2 ? T.warna.v : T.warna.u;
            tc.beginPath(); tc.arc(p.x, p.y, 1 + p.a * 4, 0, 6.283); tc.fill();
          }
        }
        requestAnimationFrame(loop);
      })();
    }

    // ---------- LATAR ----------
    if (T.latar === 'tidak ada') return;
    const cv = document.createElement('canvas'); cv.id = 'tk-bg'; document.body.prepend(cv);
    const ctx = cv.getContext('2d'), C = [T.warna.u, T.warna.v, T.warna.w], K = T.kekuatan, S = T.kecepatan;
    let W, H, t = 0, sp = 1, am = .5, rev = REDUCE ? 1 : 0, P = [];
    function ukuran() {
      const d = Math.min(2, devicePixelRatio || 1);
      cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      W = innerWidth; H = innerHeight;
      P = Array.from({ length: Math.min(80, Math.round(W * H / 18000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5 }));
    }
    ukuran(); addEventListener('resize', ukuran);

    const gambar = {
      gelombang() { // tiga fasa: kursor ke kanan = lebih cepat, ke atas = lebih besar
        sp += ((.6 + mx / W * 3.2) - sp) * .05; am += ((.35 + (1 - my / H) * .65) - am) * .05;
        if (!REDUCE) t += .012 * sp * S;
        rev = Math.min(1, rev + .012); const lim = W * (1 - Math.pow(1 - rev, 3)), base = H * .72;
        C.forEach((c, i) => {
          ctx.beginPath();
          for (let x = 0; x <= lim; x += 4) {
            const y = base + Math.sin(x * .009 + t - i * 2.0944) * H * .12 * am * (.6 + .4 * Math.sin(x * .002 + i));
            x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.globalAlpha = K; ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.stroke();
        });
      },
      partikel() { // titik yang saling terhubung dan mengejar kursor
        ctx.fillStyle = T.warna.v;
        P.forEach((p, i) => {
          if (!REDUCE) { p.x += p.vx * S; p.y += p.vy * S; }
          if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
          ctx.globalAlpha = K; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.283); ctx.fill();
          for (let j = i + 1; j < P.length; j++) {
            const d = Math.hypot(p.x - P[j].x, p.y - P[j].y);
            if (d < 120) { ctx.globalAlpha = K * (1 - d / 120) * .7; ctx.strokeStyle = T.warna.w; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(P[j].x, P[j].y); ctx.stroke(); }
          }
          const dm = Math.hypot(p.x - mx, p.y - my);
          if (dm < 170) { ctx.globalAlpha = K * (1 - dm / 170); ctx.strokeStyle = T.warna.u; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my); ctx.stroke(); }
        });
      },
      grid() { // kisi tipis yang menyala di sekitar kursor
        const g = 52, garis = () => { ctx.beginPath(); for (let x = 0; x <= W; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 0; y <= H; y += g) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); };
        ctx.lineWidth = 1; ctx.strokeStyle = T.warna.line; ctx.globalAlpha = .7; garis();
        ctx.save(); ctx.beginPath(); ctx.arc(mx, my, 220, 0, 6.283); ctx.clip();
        ctx.strokeStyle = T.warna.v; ctx.globalAlpha = K * .8; garis(); ctx.restore();
      }
    }[T.latar] || (() => {});

    (function frame() {
      ctx.clearRect(0, 0, W, H); ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.lineWidth = 1;
      gambar(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (!REDUCE) requestAnimationFrame(frame);
    })();
  }

  if (document.body) mulai(); else document.addEventListener('DOMContentLoaded', mulai);
})();
