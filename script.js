const container = document.querySelector('.container');
const noBtn = document.getElementById('no');
const yesBtn = document.getElementById('yes');
const question = document.getElementById('question');
const buttonsDiv = document.getElementById('buttons');
const result = document.getElementById('result');

// Ayarlar (daha kaçıcı / daha güvenilir davranış)
const THRESHOLD = 170; // fare yaklaştığında harekete geçen mesafe (px)
const PUSH_FACTOR = 1.4; // kaçma gücü
const MIN_DISTANCE = 100; // fare ile buton merkezi arasında izin verilen minimum uzaklık (px)
const RANDOMNESS = 0.18; // harekete az miktarda rastgelelik (0..1)
const LERP = 0.22; // animasyon yumuşatma faktörü
const STUCK_FRAMES = 7; // fare butona yapışmış sayılınca zorunlu kaçma tetiklenir

// Helper: clamp
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Animasyon hedefleri ve mevcut değerler
let parentRect = null;
let btnRect = null;
let targetLeft = 0;
let targetTop = 0;
let currentLeft = 0;
let currentTop = 0;
let animating = false;

// Yapışma tespiti
let lastMouseX = null;
let lastMouseY = null;
let stuckCounter = 0;

function ensureRects() {
  parentRect = buttonsDiv.getBoundingClientRect();
  btnRect = noBtn.getBoundingClientRect();
}

function setTarget(left, top) {
  targetLeft = left;
  targetTop = top;
  if (!animating) {
    animating = true;
    requestAnimationFrame(stepAnimation);
  }
}

function stepAnimation() {
  // Lerp current -> target
  currentLeft += (targetLeft - currentLeft) * LERP;
  currentTop += (targetTop - currentTop) * LERP;
  noBtn.style.left = `${currentLeft}px`;
  noBtn.style.top = `${currentTop}px`;

  // Eğer çok yakınsa doğrudan hedefe atla (performans + tam konum)
  if (Math.abs(currentLeft - targetLeft) < 0.5 && Math.abs(currentTop - targetTop) < 0.5) {
    noBtn.style.left = `${targetLeft}px`;
    noBtn.style.top = `${targetTop}px`;
    currentLeft = targetLeft;
    currentTop = targetTop;
    animating = false;
    return;
  }

  requestAnimationFrame(stepAnimation);
}

// Kalpleri patlatan fonksiyon
function popHearts(count = 20) {
  // Patlama ekranın tam ortasından gelsin (viewport center)
  ensureRects();
  const containerRect = container.getBoundingClientRect();
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;

  // Convert viewport center to container-local coordinates
  const centerX = viewportCenterX - containerRect.left;
  const centerY = viewportCenterY - containerRect.top;

  for (let i = 0; i < count; i++) {
    const heart = document.createElement('span');
    heart.className = 'pop-heart';
    heart.textContent = '❤️';

    // Rastgele açı ve mesafe (daha doğal dağılım)
    const angle = Math.random() * Math.PI * 2;
    // Daha geniş yayılma: container boyutuna göre dinamik mesafe
    const maxDim = Math.max(containerRect.width, containerRect.height);
    const distance = Math.min(maxDim * 0.95, 220 + Math.random() * (maxDim * 1.1));
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    // Başlangıç konumu (tam ortada, container içinde)
    const left = clamp(centerX - 14, 0, containerRect.width - 28);
    const top = clamp(centerY - 14, 0, containerRect.height - 28);
    heart.style.left = `${left}px`;
    heart.style.top = `${top}px`;

    // CSS değişkenleri ile hedef çeviri ve rotasyon ver
    heart.style.setProperty('--tx', `${tx}px`);
    heart.style.setProperty('--ty', `${ty}px`);
    const rot = Math.floor(Math.random() * 80 - 40);
    heart.style.setProperty('--rot', `${rot}deg`);

    // Süreyi biraz uzatıp çeşitlendirelim
    const dur = 900 + Math.random() * 1200;
    heart.style.animationDuration = `${dur}ms`;

    container.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}

function forceRelocateFar(mouseX, mouseY) {
  // Butonu fareden en uzak köşeye taşı
  const maxX = Math.max(0, parentRect.width - btnRect.width);
  const maxY = Math.max(0, parentRect.height - btnRect.height);
  const corners = [ [0,0], [maxX,0], [0,maxY], [maxX,maxY] ];
  let best = corners[0];
  let bestDist = -1;
  for (const c of corners) {
    const cx = c[0] + btnRect.width / 2;
    const cy = c[1] + btnRect.height / 2;
    const d = Math.hypot(cx - mouseX, cy - mouseY);
    if (d > bestDist) { bestDist = d; best = c; }
  }
  // Küçük rastgele içerme
  const padX = 20 + Math.random() * 40;
  const padY = 10 + Math.random() * 30;
  const finalLeft = clamp(best[0] + (best[0] === 0 ? padX : -padX), 0, maxX);
  const finalTop = clamp(best[1] + (best[1] === 0 ? padY : -padY), 0, maxY);
  setTarget(finalLeft, finalTop);
  stuckCounter = 0;
}

// Fare hareketinde hedef hesaplama
container.addEventListener('mousemove', (e) => {
  ensureRects();
  const mouseX = e.clientX - parentRect.left;
  const mouseY = e.clientY - parentRect.top;

  // Buton merkezi
  const centerX = (currentLeft || (btnRect.left - parentRect.left)) + btnRect.width / 2;
  const centerY = (currentTop || (btnRect.top - parentRect.top)) + btnRect.height / 2;

  const dx = centerX - mouseX;
  const dy = centerY - mouseY;
  const dist = Math.hypot(dx, dy);

  if (dist < THRESHOLD) {
    // moveIntensity
    let moveDistance = (THRESHOLD - dist) * PUSH_FACTOR;
    moveDistance = moveDistance * (1 + (Math.random() * RANDOMNESS));
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    let newCenterX = centerX + nx * moveDistance;
    let newCenterY = centerY + ny * moveDistance;

    // Eğer yeni mesafe MIN_DISTANCE'den küçükse, fareden MIN_DISTANCE uzak olacak şekilde ayarla
    const candDx = newCenterX - mouseX;
    const candDy = newCenterY - mouseY;
    const candDist = Math.hypot(candDx, candDy);
    if (candDist < MIN_DISTANCE) {
      newCenterX = mouseX + nx * MIN_DISTANCE;
      newCenterY = mouseY + ny * MIN_DISTANCE;
    }

    const maxX = Math.max(0, parentRect.width - btnRect.width);
    const maxY = Math.max(0, parentRect.height - btnRect.height);
    const newLeft = clamp(newCenterX - btnRect.width / 2, 0, maxX);
    const newTop = clamp(newCenterY - btnRect.height / 2, 0, maxY);

    setTarget(newLeft, newTop);
  }

  // Yapışma tespiti: fare az hareket ediyor ve çok yakınsa
  if (lastMouseX !== null) {
    const mouseMoveDist = Math.hypot(mouseX - lastMouseX, mouseY - lastMouseY);
    if (dist < MIN_DISTANCE && mouseMoveDist < 4) {
      stuckCounter += 1;
    } else {
      stuckCounter = 0;
    }
    if (stuckCounter > STUCK_FRAMES) {
      forceRelocateFar(mouseX, mouseY);
    }
  }

  lastMouseX = mouseX;
  lastMouseY = mouseY;
});

noBtn.addEventListener('click', (e) => {
  // Kısa, kontrollü geri sıçrama: hedefi biraz daha uzağa taşı
  ensureRects();
  const currentBtnLeft = btnRect.left - parentRect.left;
  const currentBtnTop = btnRect.top - parentRect.top;
  const maxX = Math.max(0, parentRect.width - btnRect.width);
  const maxY = Math.max(0, parentRect.height - btnRect.height);
  const newLeft = clamp(currentBtnLeft + (Math.random() > 0.5 ? 80 : -80), 0, maxX);
  const newTop = clamp(currentBtnTop + (Math.random() > 0.5 ? 60 : -60), 0, maxY);
  setTarget(newLeft, newTop);
});

yesBtn.addEventListener('click', () => {
  // Yeni istenen metin
  question.textContent = 'Ben de seni çoookkkk seviyorummmmmm';
  // Butonları gizle
  buttonsDiv.classList.add('hidden');
  // Alttaki teşekkür yazısını gösterme/hide
  result.classList.add('hidden');

  // Baştaki kalbi biraz büyüt ve kısa bir animasyon uygula
  const heartEl = document.querySelector('.heart');
  if (heartEl) {
    heartEl.classList.add('enlarge');
    setTimeout(() => heartEl.classList.remove('enlarge'), 1200);
  }

  // Kalpleri patlat (korunan efekt)
  popHearts(60);
});

// Başlangıç: pozisyonları ayarla
window.addEventListener('load', () => {
  ensureRects();
  // Başlangıç pozisyonlarını current ve target olarak uygula
  const computed = getComputedStyle(noBtn);
  const leftPx = parseFloat(computed.left) || 260;
  const topPx = parseFloat(computed.top) || 40;
  currentLeft = leftPx;
  currentTop = topPx;
  targetLeft = leftPx;
  targetTop = topPx;
  noBtn.style.left = `${leftPx}px`;
  noBtn.style.top = `${topPx}px`;
  // container için current ölçümleri
  parentRect = buttonsDiv.getBoundingClientRect();
  btnRect = noBtn.getBoundingClientRect();
});

// Pencere yeniden boyutlandığında rect güncelle
window.addEventListener('resize', () => { ensureRects(); });
