// ── Kesme: çarpışma, talaş kaldırma, alt adım denetimi, kılavuz, kesme yükü, döner tabla dönüşü, eksen hareketi
// Tool silindirinin dairesi ile (x0..x1, y0..y1) dikdörtgeni arası mesafe
function rectDist(x, y, x0, x1, y0, y1) {
  const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1);
  return Math.hypot(dx, dy);
}
const FIXTURES = [];                       // bağlamaya göre syncFixtures doldurur
function fixtureHit(x, y, tip, T) {
  const r = T.d / 2, rh = holderR(T);
  if (ROT.on) toLv(x, y);
  for (const f of FIXTURES) {
    const px = f.rot ? LX : x, py = f.rot ? LY : y;                // dönen bağlama parçanın koordinatında
    const d = f.c ? Math.max(0, Math.hypot(px - f.c[0], py - f.c[1]) - f.c[2]) : rectDist(px, py, ...f.b);
    if ((tip < f.top && d < r) || (tip + T.stick < f.top && d < rh)) return 'Takım ' + f.n + ' çarptı!';
  }
  return null;
}
function interfere(x, y, tip, T) {
  if (FIX === 'div') return VX.work(x, y, tip, T, true);
  if (ROT.on) { toLv(x, y); x = LX; y = LY; }
  const r = T.d / 2;
  const out = { over:0, maxH:-1, shank:false, holder:false, any:false };
  if (tip >= PH) return out;
  const i0 = Math.max(0, Math.floor((x - r) / C)), i1 = Math.min(NX - 1, Math.ceil((x + r) / C));
  const j0 = Math.max(0, Math.floor((y - r) / C)), j1 = Math.min(NY - 1, Math.ceil((y + r) / C));
  const r2 = r * r;
  for (let j = j0; j <= j1; j++) {
    const dy = j * C - y;
    for (let i = i0; i <= i1; i++) {
      const dx = i * C - x, d2 = dx * dx + dy * dy;
      if (d2 > r2 + 1e-6) continue;          // kayan nokta payı: tam ızgaraya oturan kenar hücresi kesilir
      const h = H[j * NX + i];
      if (h > out.maxH) out.maxH = h;
      const ov = h - profile(T, Math.sqrt(d2), tip);
      if (ov > out.over) out.over = ov;
    }
  }
  out.any = out.over > 0.002;
  if (out.any && out.maxH - tip > T.flute + 0.3) out.shank = true;
  if (tip + T.stick < PH) {
    const rh = holderR(T), rh2 = rh * rh;
    const a0 = Math.max(0, Math.floor((x - rh) / C)), a1 = Math.min(NX - 1, Math.ceil((x + rh) / C));
    const b0 = Math.max(0, Math.floor((y - rh) / C)), b1 = Math.min(NY - 1, Math.ceil((y + rh) / C));
    for (let j = b0; j <= b1 && !out.holder; j++) for (let i = a0; i <= a1; i++) {
      const dx = i * C - x, dy = j * C - y;
      if (dx * dx + dy * dy <= rh2 && H[j * NX + i] > tip + T.stick + 0.3) { out.holder = true; break; }
    }
  }
  return out;
}
function applyCut(x, y, tip, T, mx = 1, my = 0, mk = null) {
  if (FIX === 'div') return VX.work(x, y, tip, T, false).vol;
  if (ROT.on) { toLv(x, y); x = LX; y = LY; }                      // mx, my zaten parçaya göre hareket yönü
  const r = T.d / 2, r2 = r * r, rb = r + C + 0.02, rb2 = rb * rb, ml = Math.hypot(mx, my) || 1;
  const i0 = Math.max(0, Math.floor((x - rb) / C)), i1 = Math.min(NX - 1, Math.ceil((x + rb) / C));
  const j0 = Math.max(0, Math.floor((y - rb) / C)), j1 = Math.min(NY - 1, Math.ceil((y + rb) / C));
  let vol = 0;
  for (let j = j0; j <= j1; j++) {
    const dy = j * C - y;
    for (let i = i0; i <= i1; i++) {
      const dx = i * C - x, d2 = dx * dx + dy * dy, k = j * NX + i;
      if (d2 > r2 + 1e-6) {                  // kayan nokta payı: tam ızgaraya oturan kenar hücresi kesilir
        if (d2 < rb2 && H[k] > tip + 0.05) { const e = Math.sqrt(d2) - r; if (e < EDGE[k]) EDGE[k] = e; }   // takım kenarı bu hücreye ne kadar yaklaştı
        continue;
      }
      const p = Math.max(0, profile(T, Math.sqrt(d2), tip));
      if (H[k] > p) {
        if (p <= 0.02) throughDirty = true;
        vol += H[k] - p; H[k] = p; CUT[k] = S.tool + 1;
        if (mk) { const o = k * 4; MK1[o] = x; MK1[o+1] = y; MK1[o+2] = mx / ml; MK1[o+3] = my / ml; MK2[o] = mk.f; MK2[o+1] = r; MK2[o+2] = mk.ra; MK2[o+3] = mk.chat; TINTC[k] = mk.tint; }
      }
    }
  }
  if (vol > 0) markDirty(i0, i1, j0, j1);
  return vol * C * C;
}

function crash(msg) {
  const ct = tipZ(), cr = tool().d / 2;
  burst('spark', 150, 0, ct + 2, 0, 750 + cr * 20, 650, 0.8);
  burst('debris', 26, 0, ct + 3, 0, 260, 420, 2.6);
  burst('smoke', 10, 0, ct + 4, 0, 40, 60, 1.8);
  if (S.job && !S.job.done) S.job.stats.breaks++;
  S.alarm = true; S.spindle = false; S.broken = true;
  CR.lost(S.tool);
  stopMotion();
  buildToolVisual();
  $('alarmMsg').textContent = msg;
  $('alarm').hidden = false;
  crashSound();
  log(msg, 'bad');
  updateSpindleUI(); updateToolUI();
}
function stopMotion() { S.pend.x = S.pend.y = S.pend.z = 0; S.wheel.x = S.wheel.y = S.wheel.z = 0; S.autoX = 0; if (typeof updateAutoUI === 'function') updateAutoUI(); pressed.forEach(p => p.t0 = Infinity); }

function loadRatio(T, feedNow, horiz) {
  if (T.type === 'edge' || T.type === 'tap' || isTaster(T) || S.rpm <= 0) return 0;
  if (isDrill(T)) return (feedNow / S.rpm) / (T.fr * mat.ff);
  const fz = feedNow / (S.rpm * T.z);
  return horiz ? fz / (T.fz * mat.ff) : fz / (T.fz * mat.ff * 0.5);
}

// Bir alt adımı dener; geçerliyse true döner
function tryStep(nx, ny, nn, dtStep) {
  const T = tool(), tip = nn - T.len;
  let mdx = nx - S.px, mdy = ny - S.py;                            // parçaya göre hareket
  if (ROT.on) { toLv(S.px, S.py, ROT.a0); const ax = LX, ay = LY; toLv(nx, ny); mdx = LX - ax; mdy = LY - ay; }
  else if (FIX === 'div' && ROT.turning) { const a = VX.local(S.px, S.py, tip, ROT.a0), b = VX.local(nx, ny, tip, ROT.a); mdx = Math.hypot(b[1] - a[1], b[2] - a[2]); mdy = 0; }
  const horiz = Math.hypot(mdx, mdy), down = nn < S.nose;
  const fh = fixtureHit(nx, ny, T.type === 'dial' ? tip - 2 : tip, T);
  if (fh) { crash(fh); return false; }
  if (T.type === 'dial') return DT.step(nx, ny, nn, T);
  const it = interfere(nx, ny, tip, T);
  if (S.loose && it.any) { warnOnce('loose', 'Parça bağlı değil, tabladan kopmuş. Yeni ham parça bağlayın.', 'bad'); return false; }
  if (T.type === 'tap') return tapStep(nx, ny, nn, T, it, horiz);
  if (isDrill(T) && S.peck.active && !it.any && tip > S.peck.top + 0.3) S.peck.active = false;
  if (!it.any) {
    // Izgara hücresine girmeyen küçük adımlar da kesme yolunun parçası; ancak ~1 mm temassız ilerleyince pencere sıfırlanır
    const W = S.win;
    if (W.vol > 0) {
      W.h += horiz; W.v += Math.abs(nn - S.nose); W.idle += Math.hypot(horiz, nn - S.nose);
      if (W.idle > 1) S.win = { vol:0, h:0, v:0, ap:0, idle:0 };
    }
    return true;
  }
  if (it.holder) { crash('Takım tutucu parçaya çarptı! Takım boyu bu derinlik için yetersiz.'); return false; }
  if (S.broken) { warnOnce('broken', 'Takım kırık; kesme yapılamaz. Takım dolabından yenisini takın.', 'bad'); return false; }
  if (isProbe(T)) {
    if (S.spindle) { crash('3B taster dönerken parçaya değdi: stylus kırıldı. Taster yalnızca mil DURURKEN kullanılır.'); return false; }
    if (S.feedNow > 1500) { crash('Taster hızlı harekette parçaya çarptı: stylus kırıldı. Parçaya yavaş yaklaşın ya da döngüleri kullanın.'); return false; }
    PR.touch(nx, ny, nn); return false;
  }
  if (T.type === 'edge') {
    if (!S.spindle) warnOnce('edgeoff', 'Kenar bulucu mil dönmeden çalışmaz (≈1000 dev/dk önerilir).');
    else if (!horiz || down) warnOnce('edgedown', 'Kenar bulucuyla yüzeye dalınmaz; parçaya yandan yaklaşın.');
    else {
      const ax = Math.abs(nx - S.px) >= Math.abs(ny - S.py) ? 'X' : 'Y';
      const v = ax === 'X' ? S.px - S.zx : S.py - S.zy;
      const before = lastWarn.edge;
      warnOnce('edge', `Kenar bulundu: ${ax} = ${fmt(v)}. Takım merkezi kenardan 5.000 mm uzakta; "Ata" ile ${ax}=${nx > S.px || ny > S.py ? '-5' : '+5'} girin.`, 'ok', 1500);
      if (lastWarn.edge !== before) beep(1900);
    }
    return false;
  }
  if (!S.spindle) {
    if (S.feedNow > 2000) { crash('Mil dururken takım hızlı harekette parçaya çarptı!'); return false; }
    warnOnce('touch', 'Takım parçaya değdi. Mil dönmediği için hareket durdu; kesmek için mili çalıştırın.');
    return false;
  }
  if (S.dir < 0) { warnOnce('rev', 'Mil GERİ dönüyor: freze ağızları bu yönde kesmez, takım sürtüyor. Mili İLERİ alın.'); return false; }
  if (it.shank) { crash(`Kesme boyu aşıldı: ${T.no} takımının ağız boyu ${T.flute} mm, şaft parçaya sürttü.`); return false; }
  if (isDrill(T) && horiz > 0.0005 && it.over > 0.3) { crash('Matkap yanal yüke dayanamadı ve kırıldı. Matkapla yalnızca Z ekseninde ilerleyin.'); return false; }
  if (T.type === 'face' && !horiz && down && it.over > 1.5) { crash('Alın frezesiyle dalma yapılmaz; kesici uçlar kırıldı. Yandan girerek kesin.'); return false; }

  if (isDrill(T) && it.over > 0.04) {
    {
      const lim = S.coolant ? 2.0 : 1.5;
      if (S.rpm > recRpm(T) * lim && it.over > 0.3) { crash(`Devir çok yüksek: HSS matkabın ucu yandı. Önerilen ${recRpm(T)} dev/dk.`); return false; }
      if (!S.peck.active) {
        S.peck.active = true; S.peck.top = it.maxH;
        if (ROT.on) toLv(nx, ny);
        const ci = Math.round((ROT.on ? LX : nx) / C), cj = Math.round((ROT.on ? LY : ny) / C);
        if (T.type === 'drill' && ci >= 0 && ci < NX && cj >= 0 && cj < NY && !CUT[cj * NX + ci] && Math.abs(H[cj*NX+ci] - PH) < 0.01)
          warnOnce('spot', 'Matkap düz yüzeyde kayabilir; önce T6 punta matkabıyla merkez açın.', 'warn', 8000);
      }
      const depth = S.peck.top - tip;
      if (T.type === 'drill') {
        if (depth > 7 * T.d) { crash('Talaş kanallara sıkıştı ve matkap kırıldı. Derin delikte gagalayarak (geri çekip talaş boşaltarak) delin.'); return false; }
        if (depth > 4.5 * T.d) warnOnce('peck', `Delik derinliği ${depth.toFixed(1)} mm (${(depth / T.d).toFixed(1)}×D). Matkabı geri çekip talaşı boşaltın.`);
      }
    }
  }
  // kesme hızı oranı, devir başına ilerleme ve yüzey: Ra ≈ fz²/(8·0.8) (aşınma, yığıntı ağız, tırlama, erime bozar)
  const md = toolMods(T);
  const rpmE = Math.max(1, S.rpmEff || S.rpm), vcNow = Math.PI * T.d * rpmE / 1000, vr = vcNow / Math.max(1, T.vc * mat.vcf);
  const fRev = S.feedNow / rpmE, fz = fRev / Math.max(1, T.z), wr = S.wear[S.tool];
  const melt = mat.melt && !S.coolant && vr > 1.2;
  let ra = (T.type === 'face' ? 0.6 : 1) * Math.max(0.2, fz * fz / 0.0064 + 0.25) * (1 + wr * 6) * (mat.bue && vr < 0.3 ? 2.5 : 1) * (1 + S.chatNow * 4) * (melt ? 3 : 1) * md.ra;
  const heatIdx = mat.tint ? vr * (0.55 + fz / 0.06) * (S.coolant ? 0.45 : 1) : 0;
  const mk = (T.type === 'face' || T.type === 'end') ? { f:Math.max(0.02, fRev), ra, chat:S.chatNow, tint:clamp((heatIdx - 0.9) * 1.2, 0, 1) } : { f:0, ra, chat:S.chatNow, tint:0 };
  const vol = applyCut(nx, ny, tip, T, mdx, mdy, mk);
  if (vol <= 0) return true;
  kickChips(nx, ny, T.d / 2, tip);
  if (melt) { S.rubT = performance.now(); warnOnce('melt', `${mat.short} eriyor: kesme hızı bu plastik için fazla. Devri düşürün ya da soğutma sıvısı açın.`); }
  const stepLen = Math.hypot(horiz, Math.abs(nn - S.nose));
  const tCut = stepLen / Math.max(1, S.feedNow / 60);   // bu alt adımın gerçek kesme süresi (s)
  S.removed += vol; S.cutTime += tCut; S.cutAcc += vol; S.lastCut = performance.now();
  S.lastVc = vcNow; S.lastRa = ra;
  // takım aşınması (Taylor): kesme hızının ~2.5. kuvvetiyle hızlanır; ısı: kesme enerjisinin bir kısmı parçaya geçer
  S.wear[S.tool] += 0.3 / 900 * mat.wearK * Math.pow(Math.max(vr, 0.2), 2.5) * tCut * (S.coolant && !mat.dry ? 0.8 : 1) * (isDrill(T) ? 1.5 : 1) * md.wear;
  if (S.wear[S.tool] > 0.3) warnOnce('wear', `Takım köreldi (VB ${S.wear[S.tool].toFixed(2)} mm): yüzey bozuluyor, yük artıyor. Takım panelinden takımı yenileyin.`, 'warn', 8000);
  S.temp += vol * mat.kc * 1e-3 * 0.45 / Math.max(50, S.heatCap);
  const form = chipForm(T, S.lastChip || 1, fRev, vr);
  S.chipForm = form; S.chipT = performance.now();
  if (form === 'thin') warnOnce('chipThin', 'Talaş çok ince ve uzun: takım sürtüyor. Diş başına ilerlemeyi artırın (önerilen ilerlemeyi uygulayın).', 'warn', 9000);
  if (form === 'gum') warnOnce('chipGum', 'Naylon talaşı kırılmaz ve takıma dolanır; arada durup talaşı alın.', 'warn', 9000);
  chipsFor(nx, ny, isDrill(T) ? it.maxH + 0.5 : Math.max(tip, 0) + 1 + Math.random() * 2, T, vol, form, heatIdx);

  // Yük değerlendirmesi: ızgara hücrelerinin anlık sıçramalarını önlemek için ~0.5 mm'lik pencerede ortalanır
  const W = S.win;
  W.vol += vol; W.h += horiz; W.v += Math.abs(nn - S.nose); W.ap = Math.max(W.ap, it.maxH - tip); W.idle = 0;
  if (W.h + W.v < 1) return true;
  const L = evalLoad(T, W);
  S.win = { vol:0, h:0, v:0, ap:0, idle:0 };
  const winT = (W.h + W.v) / Math.max(1, S.feedNow / 60);
  const kcR = Math.pow(mat.kc / 700, 0.25) * (1 + S.wear[S.tool] * 1.5);
  L.stress *= kcR * md.load;
  // ER pens ağır yükte takımı tutamayabilir: takım pensten dışarı kayar, parça resimden derin kesilir
  const hk = holderOf(T);
  if (hk && HOLDERS[hk].slip && L.stress > 1.6 && !T.slipped && Math.random() < (L.stress - 1.6) * 0.25 * HOLDERS[hk].slip) {
    const a = +(0.3 + Math.random() * 0.5).toFixed(2);
    T.slipped = a; T.len += a; T.stick += a; buildToolVisual(); updateToolUI();
    beep(500, 0.1); thud(90, 0.2, 0.2);
    log(`Takım ${HOLDERS[hk].n} tutucusundan ${a} mm dışarı kaydı! Uç artık DRO'nun gösterdiğinden derinde, parça fazla kesiliyor. Mili durdurup Tutucu satırındaki düğmeye basarak takımı yeniden bağlayın.`, 'bad');
  }
  S.lastChip = L.chip; S.lastStress = L.stress;
  if ((ROT.on || FIX === 'div') && !ROT.lock && !ROT.turning && L.stress > 0.8) {
    ROT.a += (L.stress - 0.8) * 0.05 * (Math.random() < 0.5 ? -1 : 1); ROT.a0 = ROT.a;
    warnOnce('rotlock', 'Döner tabla kilitsiz: parça kesme yükü altında döndü! Öteleme kesmesinden önce kilit kolunu sıkın.', 'warn', 6000);
  }
  // mil gücü: kc · talaş debisi; 1000 dev/dk altında sabit tork, aşırı yükte devir düşer, çok aşırıda mil boğulur
  const Pc = mat.kc * (W.vol / Math.max(1e-3, winT)) * 1e-6, Pav = P_MAX * Math.min(1, S.rpm / 1000);
  S.power = Pc / Pav;
  if (FIX === 'vac' && VAC.check(Pc, vcNow)) return false;
  if (S.power > 1.5) { crash(`Mil boğuldu: kesme ${Pc.toFixed(1)} kW istiyor, motor bu devirde ${Pav.toFixed(1)} kW verebiliyor. Talaş derinliğini ya da ilerlemeyi azaltın.`); return false; }
  if (S.power > 1) warnOnce('power', `Mil zorlanıyor: güç %${Math.round(S.power * 100)}, devir düşüyor.`, 'warn', 5000);
  // tırlama: uzun ve ince takımda (çıkıntı/çap) ve ağır kesmede başlar; devre göre loblar halinde kararlı bölgeler var
  const LD = T.stick / T.d, lobe = 0.45 + 0.55 * Math.pow(Math.abs(Math.sin(Math.PI * ((S.rpm / 730) % 1))), 0.6);
  const ci = isDrill(T) ? 0 : L.stress * Math.pow(LD / 3, 1.6) * Math.pow(mat.kc / 700, 0.3) * md.chat / (2.2 * lobe);
  S.chatNow = clamp(ci - 1, 0, 1);
  if (S.chatNow > 0.05) warnOnce('chat', `Tırlama: takım ${LD.toFixed(1)}×D çıkıntılı ve yük ağır. Kesme derinliğini azaltın ya da devri biraz değiştirin; yüzeyde dalga oluşuyor.`, 'warn', 6000);
  if (L.chip > 8 * md.tough || L.stress > 6 * md.tough) {
    crash(`Ani aşırı yük: talaş kalınlığı ${L.chip.toFixed(1)}×, takım yükü ${L.stress.toFixed(1)}×. Takım kırıldı. Devri artırın, ilerlemeyi ya da kesme derinliğini düşürün.`);
    return false;
  }
  if (L.stress > 1.5) S.damage += (L.stress - 1.5) * 0.35 * winT / md.tough;
  if (L.chip > 2.5) S.damage += (L.chip - 2.5) * 0.12 * winT / md.tough;
  // çok ağızlı takımda talaş cebi dar: yumuşak malzemede tam kanalda talaş sıkışır
  if (T.z >= 4 && (S.mat === 'al' || mat.melt) && L.ae > 0.9 && W.ap > 0.5 * T.d && T.type !== 'face') {
    S.damage += 0.5 * winT / md.tough;
    warnOnce('clog', `${T.z} ağızlı takımda talaş cebi dar: ${mat.short} talaşı kanallara sıkışıyor. Kanal açarken 2–3 ağızlı takım kullanın ya da derinliği azaltın.`, 'warn', 8000);
  }
  if (S.damage >= 1) { crash('Takım uzun süre aşırı yük altında kaldı ve kırıldı. Talaş derinliğini ya da ilerlemeyi azaltın.'); return false; }
  if (L.stress > 1.2 || L.chip > 2) warnOnce('load', `Takım zorlanıyor: yük ${L.stress.toFixed(1)}×, talaş ${L.chip.toFixed(1)}×. İlerlemeyi düşürün ya da paso derinliğini azaltın.`);
  else if (L.chip < 0.12 && L.eng > 0.05 && (S.rubT = performance.now())) warnOnce('rub', 'Talaş çok ince: takım kesmek yerine sürtüyor ve ısınıyor. İlerlemeyi artırın ya da devri düşürün.');
  return true;
}

// Kılavuz: yalnızca Z'de, delinmiş deliğe girer. Kavrayınca kovanı mil sürer (her turda bir adım);
// çıkarmak için mil GERİ çalıştırılır. Delik küçük, deliksiz, kör delik dibi, yüksek devir ya da yanal hareket kılavuzu kırar.
function holeRadius(x, y, tip) {           // merkezden dışa doğru tarama: ilk dolu hücreye kadar olan yarıçap
  if (ROT.on) { toLv(x, y); x = LX; y = LY; }
  let best = 99;
  for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let r = 0;
    for (; r < 20; r += C) {
      const i = Math.round((x + ux * r) / C), j = Math.round((y + uy * r) / C);
      if (i < 0 || j < 0 || i >= NX || j >= NY) break;
      if (H[j * NX + i] > tip) break;
    }
    best = Math.min(best, r);
  }
  return best;
}
function tapStep(nx, ny, nn, T, it, horiz) {
  const tip = nn - T.len, down = nn < S.nose;
  if (FIX === 'div' && it.any) { warnOnce('divtap', 'Divizördeki parçada kılavuz çekme henüz yok.', 'warn'); return false; }
  if (ROT.on) toLv(nx, ny);
  const lx = ROT.on ? LX : nx, ly = ROT.on ? LY : ny;
  if (!it.any) {
    if (S.tap && !down) { S.tap = null; log(`${T.name} delikten çıktı. Dişler açıldı.`, 'ok'); thud(160, 0.1, 0.08); }
    return true;
  }
  if (S.tap) {
    if (horiz > 0.001) { crash('Kılavuz delikteyken tabla oynatıldı; kılavuz kırıldı. Kılavuz yalnızca Z ekseninde çalışır.'); return false; }
    if (down) {
      const ci = Math.round(lx / C), cj = Math.round(ly / C);
      const bottom = ci >= 0 && cj >= 0 && ci < NX && cj < NY ? H[cj * NX + ci] : 0;
      if (tip < bottom + 0.6 && bottom > 0.05) { crash('Kılavuz kör delik dibine dayandı ve kırıldı. Diş boyunu delik derinliğinden kısa tutun; zamanında mili GERİ alın.'); return false; }
    }
    const i0 = Math.max(0, Math.floor((lx - T.d / 2) / C)), i1 = Math.min(NX - 1, Math.ceil((lx + T.d / 2) / C));
    const j0 = Math.max(0, Math.floor((ly - T.d / 2) / C)), j1 = Math.min(NY - 1, Math.ceil((ly + T.d / 2) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dd = Math.hypot(i * C - lx, j * C - ly);
      if (dd <= T.d / 2 + C && dd >= T.drill / 2 - C) TAPC[j * NX + i] = 1;
    }
    markDirty(i0, i1, j0, j1);
    return true;
  }
  // ilk temas
  if (!S.spindle) { warnOnce('touch', 'Kılavuz deliğe değdi. Mil İLERİ dönerken kılavuz kendini çeker; mili çalıştırın.'); return false; }
  if (S.dir < 0) { warnOnce('tapRev', 'Mil GERİ dönüyor: kılavuz bu yönde deliğe girmez. Mili İLERİ alın.'); return false; }
  if (horiz > 0.001) { crash('Kılavuz yandan parçaya dayandı ve kırıldı. Kılavuzu deliğin tam üstüne getirip yalnızca Z ile indirin.'); return false; }
  const rh = holeRadius(nx, ny, tip);
  if (rh < 0.6) { crash(`Kılavuz deliksiz yüzeye dayandı ve kırıldı. Önce Ø${T.drill} matkapla delin.`); return false; }
  if (rh < T.drill / 2 - 0.6) { crash(`Delik küçük: kılavuz sıkıştı ve kırıldı. ${T.name} için kılavuz matkabı Ø${T.drill}.`); return false; }
  if (rh > T.d / 2 - 0.3) { warnOnce('tapBig', `Delik ${T.name} için çok büyük; diş tutmaz.`, 'warn', 6000); return true; }
  if (S.rpm > T.rpm * 1.6) { crash(`Devir çok yüksek: kılavuz ısındı ve kırıldı. ${T.name} için ${T.rpm} dev/dk civarı yeter.`); return false; }
  if (mat.tint && !S.coolant) {
    if (mat.chip === 'string') { crash('Paslanmazda yağsız kılavuz çekilmez: kılavuz sarıp kırıldı. Soğutma sıvısını açın.'); return false; }
    warnOnce('tapDry', 'Çelikte yağsız kılavuz çekiyorsunuz; kılavuz zorlanır. Soğutma sıvısını açın.', 'warn', 8000);
  }
  S.tap = { p:T.p };
  log(`${T.name} kavradı: kovanı mil sürüyor (her turda ${T.p} mm). Çıkarmak için mili GERİ çalıştırın.`, 'ok');
  return true;
}

// chip: talaş kalınlığı / önerilen (radyal incelme dahil), eng: kavrama alanı / nominal, stress: takıma binen yük oranı
function evalLoad(T, W) {
  const D = T.d, r = D / 2, n = Math.max(1, S.rpmEff || S.rpm);
  if (isDrill(T)) {
    const A = W.vol / (W.h + W.v);
    const eng = clamp(A / (Math.PI * r * r), 0, 1);
    const chip = (S.feedNow / n) / (T.fr * mat.ff);
    return { chip, eng, stress: chip * (0.25 + 0.75 * eng) };
  }
  const path = W.h + W.v;
  if (W.h >= W.v) {
    const A = W.vol / path;                                 // kesit alanı = ap × ae
    const ap = clamp(W.ap, 0.05, T.flute);
    const x = clamp(A / ap / D, 0, 1);                      // ae / D
    const thin = x >= 0.5 ? 1 : 2 * Math.sqrt(x * (1 - x)); // radyal talaş incelmesi
    const chip = (S.feedNow / (n * T.z)) * thin / (T.fz * mat.ff);
    const nom = T.type === 'face' ? D * 0.7 * 3 : D * D * 0.5;  // referans: D/2 derinlikte kanal
    const eng = A / nom;
    return { chip, eng, stress: chip * Math.min(eng, 3), ae:x };
  }
  const A = W.vol / path;
  const eng = clamp(A / (Math.PI * r * r), 0, 1);
  const chip = (S.feedNow / (n * T.z)) / (T.fz * mat.ff * 0.5);
  return { chip, eng, stress: chip * eng };
}

/* ---------------- Hareket ---------------- */
const pressed = new Map(); // id -> {ax, dir, t0}
const HOLD_MS = 280;
function press(id, ax, dir) {
  initAudio();
  if (pressed.has(id)) return;
  pressed.set(id, { ax, dir, t0: performance.now() });
  if (S.alarm || S.changing) return;
  S.pend[ax] += dir * S.step;
}
function release(id) { pressed.delete(id); }
function heldDir(ax) {
  const now = performance.now(); let d = 0;
  pressed.forEach(p => { if (p.ax === ax && now - p.t0 > HOLD_MS) d += p.dir; });
  return clamp(d, -1, 1);
}
// Tabla dönüşü: takımdaki çevresel hız ilerlemeye eşit (en çok 30°/s); her alt adım bir kesme adımı gibi denenir
function rotStep(dt) {
  if (ROT.lock) { ROT.pend = ROT.hold = 0; warnOnce('rotlocked', 'Döner tabla kilitli: döndürmek için kilidi açın.', 'warn'); return; }
  const R = FIX === 'div' ? Math.max(3, Math.hypot(S.py - DIVY, tipZ() - DIVZ)) : Math.max(5, Math.hypot(S.px - ROT.cx, S.py - ROT.cy));
  const w = Math.min(30, (rapid() ? RAPID : S.feed) / 60 / R * 180 / Math.PI) * S.sim;
  if (ROT.hold) ROT.pend = ROT.hold * w * dt;
  const dA = clamp(ROT.pend, -w * dt, w * dt);
  if (!dA) return;
  const n = Math.max(1, Math.ceil(Math.abs(dA) * Math.PI / 180 * R / 0.25));
  ROT.turning = true;
  S.feedNow = Math.max(S.feedNow, Math.abs(dA) / dt * Math.PI / 180 * R * 60);
  for (let k = 0; k < n; k++) {
    ROT.a = ROT.a0 + dA / n;
    if (!tryStep(S.px, S.py, S.nose, dt / n)) { ROT.a = ROT.a0; ROT.pend = ROT.hold = 0; break; }
    ROT.a0 = ROT.a; ROT.pend -= dA / n;
  }
  ROT.turning = false;
  if (Math.abs(ROT.pend) < 1e-6) ROT.pend = 0;
  S.lastMove = performance.now();
}
function motion(dt) {
  S.cutAcc = 0;
  if (S.alarm) return;
  if (S.changing) {
    const c = S.changing;
    if (S.nose < LIM.n1 - 0.01) S.nose = Math.min(LIM.n1, S.nose + RAPID / 60 * 2 * dt);
    else {
      c.t += dt;
      if (c.t > 0.8) {
        const old = tool();
        unslip(old);
        S.tool = c.to; S.broken = false; S.changing = null; S.peck.active = false; S.spotHint = false;
        S.damage = 0; S.lastStress = 0; S.lastChip = 0; S.win = { vol:0, h:0, v:0, ap:0, idle:0 };
        buildToolVisual(); updateToolUI(); updateRec();
        const dl = tool().len - old.len;
        log(`${tool().no} takıldı: ${tool().name} Ø${tool().d}. Takım boyu ${dl >= 0 ? '+' : ''}${dl} mm farklı; Z'yi yeniden sıfırlayın.`, 'ok');
      }
    }
    return;
  }
  const budget = (rapid() ? RAPID : S.feed) / 60 * S.sim * dt;
  const wb = 6000 / 60 * dt;          // el çarkı en fazla 6000 mm/dk'ya kadar takip eder
  const m = { x:0, y:0, z:0 }, wm = { x:0, y:0, z:0 };
  let jog = false, wd = 0;
  for (const ax of ['x', 'y', 'z']) {
    const h = heldDir(ax);
    if (h) { m[ax] = h * budget; S.pend[ax] = 0; jog = true; }
    else if (Math.abs(S.pend[ax]) > 1e-7) { m[ax] = clamp(S.pend[ax], -budget, budget); jog = true; }
    if (Math.abs(S.wheel[ax]) > 1e-7) {
      // Çentikler ani sıçrama yerine yumuşak takip edilir (gerçek çark gibi sürekli hareket)
      let w = S.wheel[ax] * (1 - Math.exp(-dt * 9));
      if (Math.abs(S.wheel[ax] - w) < 0.002) w = S.wheel[ax];
      wm[ax] = clamp(w, -wb, wb); m[ax] += wm[ax]; wd = Math.max(wd, Math.abs(wm[ax]));
    }
  }
  if (S.tap) {                        // kılavuz kavradı: kovanı mil sürer, tabla ve el kumandası devre dışı
    m.x = m.y = wm.x = wm.y = wm.z = 0; S.pend.x = S.pend.y = S.pend.z = 0; S.wheel.x = S.wheel.y = S.wheel.z = 0;
    m.z = S.spindle ? -S.dir * S.tap.p * Math.max(1, S.rpmEff || S.rpm) / 60 * S.sim * dt : 0; jog = false;
  } else if (S.autoX) { m.x += S.autoX * S.feed / 60 * S.sim * dt; jog = true; }
  // Kesme hesabında kullanılan gerçek ilerleme: kol/tuş ilerlemesi veya el çarkının dönüş hızı
  S.feedNow = Math.max(jog ? (rapid() ? RAPID : S.feed) : 0, wd / dt * 60);
  if ((ROT.on || FIX === 'div') && (ROT.pend || ROT.hold) && !S.tap) rotStep(dt);
  if (!m.x && !m.y && !m.z) return;
  const len = Math.max(Math.abs(m.x), Math.abs(m.y), Math.abs(m.z));
  const n = Math.max(1, Math.ceil(len / 0.25));
  let done = 0, blocked = false;
  for (let k = 0; k < n; k++) {
    const tx = S.px + m.x / n, ty = S.py + m.y / n, tn = S.nose + m.z / n;
    const nx = clamp(tx, LIM.x0, LIM.x1), ny = clamp(ty, LIM.y0, LIM.y1), nn = clamp(tn, LIM.n0, LIM.n1);
    if (nx !== tx || ny !== ty || nn !== tn) {
      warnOnce('lim', 'Eksen hareket sınırına ulaşıldı.');
      if (nx !== tx) { m.x = wm.x = 0; S.pend.x = S.wheel.x = 0; if (S.autoX) { S.autoX = 0; updateAutoUI(); } }
      if (ny !== ty) { m.y = wm.y = 0; S.pend.y = S.wheel.y = 0; }
      if (nn !== tn) { m.z = wm.z = 0; S.pend.z = S.wheel.z = 0; }
    }
    if (nx === S.px && ny === S.py && nn === S.nose) break;
    if (!tryStep(nx, ny, nn, dt / n)) { blocked = true; break; }
    S.px = nx; S.py = ny; S.nose = nn; done++;
  }
  if (done) { S.lastMove = performance.now(); S.curFeed += (S.feedNow - S.curFeed) * 0.3; }
  if (blocked) { S.pend.x = S.pend.y = S.pend.z = 0; S.wheel.x = S.wheel.y = S.wheel.z = 0; if (S.autoX) { S.autoX = 0; updateAutoUI(); } return; }
  for (const ax of ['x', 'y', 'z']) {
    if (!heldDir(ax) && S.pend[ax]) {
      S.pend[ax] -= (m[ax] - wm[ax]) * done / n;
      if (Math.abs(S.pend[ax]) < 1e-6) S.pend[ax] = 0;
    }
    if (S.wheel[ax]) {
      S.wheel[ax] -= wm[ax] * done / n;
      if (Math.abs(S.wheel[ax]) < 1e-6) S.wheel[ax] = 0;
    }
  }
}

/* ---------------- Arayüz ---------------- */
