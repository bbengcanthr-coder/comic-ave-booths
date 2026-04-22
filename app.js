import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDi2LFUxjpZnbN6Nrl4Vay711Paz4Ud_Ag",
  authDomain: "comic-ave-db.firebaseapp.com",
  projectId: "comic-ave-db",
  storageBucket: "comic-ave-db.firebasestorage.app",
  messagingSenderId: "878775129696",
  appId: "1:878775129696:web:b40685a1161a1e97a11505",
  measurementId: "G-JSC8CL14JP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- State การจัดการข้อมูล ---
let allBooths = [];
let allTrades = [];
let filters = { day: 'all', tag: 'all', text: '' };

// --- 1. ระบบวาดแผนผัง ---
function generateMap() {
    const centerBlocks = [4, 4, 6, 6, 6, 4, 4];
    const edgeBlocks = [4, 4, 4, 4, 4, 4, 4, 4];

    function createCol(prefix, blocks, start) {
        let html = ''; let num = start;
        blocks.forEach(b => {
            html += `<div class="booth-group-v">`;
            for(let i=0; i<b; i++){
                let n = num < 10 ? `0${num}` : num;
                html += `<div class="booth" id="map-${prefix}${n}">${n}<div class="status-dot"></div></div>`;
                num--;
            }
            html += `</div>`;
        });
        return html;
    }

    let html = `<div class="row-top"><div class="letter">A</div>`;
    let aNum = 1;
    for(let g=0; g<8; g++){
        if(g===4) html += `<div style="width: 25px;"></div>`;
        html += `<div class="booth-group-h">`;
        for(let i=0; i<4; i++){ let n = aNum < 10 ? `0${aNum}` : aNum; html += `<div class="booth" id="map-A${n}">${n}<div class="status-dot"></div></div>`; aNum++; }
        html += `</div>`;
    }
    html += `<div class="letter">A</div></div><div class="main-floor">`;
    html += `<div class="col-wrapper"><div class="letter">B</div>${createCol('B', edgeBlocks, 32)}<div class="letter">B</div></div>`;

    const pairs = [['C','D'], ['E','F'], ['G','H'], ['I','J'], ['K','L'], ['M','N']];
    pairs.forEach(p => {
        let blockHtml = ''; let cNum = 34;
        centerBlocks.forEach(b => {
            blockHtml += `<div class="pair-group"><div class="booth-group-v">`;
            for(let i=0; i<b; i++){ let n = (cNum-i<10)?`0${cNum-i}`:cNum-i; blockHtml += `<div class="booth" id="map-${p[0]}${n}">${n}<div class="status-dot"></div></div>`; }
            blockHtml += `</div><div class="booth-group-v">`;
            for(let i=0; i<b; i++){ let n = (cNum-i<10)?`0${cNum-i}`:cNum-i; blockHtml += `<div class="booth" id="map-${p[1]}${n}">${n}<div class="status-dot"></div></div>`; }
            blockHtml += `</div></div>`;
            cNum -= b;
        });
        html += `<div class="col-wrapper"><div class="letter-pair"><span>${p[0]}</span><span>${p[1]}</span></div>${blockHtml}<div class="letter-pair"><span>${p[0]}</span><span>${p[1]}</span></div></div>`;
    });
    html += `<div class="col-wrapper"><div class="letter">O</div>${createCol('O', edgeBlocks, 32)}<div class="letter">O</div></div></div>`;
    document.getElementById('mapContainer').innerHTML = html;
}
generateMap();

// --- 2. การควบคุม UI และแท็บ ---
const tabBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view-section');
const globalFilters = document.getElementById('globalFilters');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        tabBtns.forEach(t => t.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(target).classList.add('active');
        
        // ตัวกรองส่วนกลางซ่อนเวลาอยู่หน้าลงทะเบียน หรือหน้าเทรด (เพราะหน้าเทรดไม่ได้อิงเลขบูธ)
        if(target === 'viewRegister' || target === 'viewTrade') {
            globalFilters.style.display = 'none';
        } else {
            globalFilters.style.display = 'flex';
        }
    });
});

// UI สำหรับเปิด-ปิดฟอร์มเทรดการ์ด
document.getElementById('btnOpenTradeForm').addEventListener('click', () => {
    document.getElementById('tradeFormContainer').classList.remove('hidden');
    document.getElementById('btnOpenTradeForm').style.display = 'none';
});
document.getElementById('btnCloseTradeForm').addEventListener('click', () => {
    document.getElementById('tradeFormContainer').classList.add('hidden');
    document.getElementById('btnOpenTradeForm').style.display = 'block';
});

// --- 3. ฟังก์ชันอรรถประโยชน์ ---
function extractBooths(raw) {
    if (!raw) return [];
    let cleanText = raw.toUpperCase(); let booths = []; let currentLetter = '';
    const regex = /([A-Z]?)[^A-Z0-9]*(\d{1,2})/g; let match;
    while ((match = regex.exec(cleanText)) !== null) {
        let letter = match[1]; let num = match[2];
        if (letter) currentLetter = letter; 
        else if (!currentLetter) continue;
        if (num.length === 1) num = '0' + num;
        booths.push(currentLetter + num);
    }
    return booths.length > 0 ? booths : [cleanText.replace(/[^A-Z0-9]/g, '')];
}

function getDayLabel(dayValue) {
    if(dayValue === 'day1') return '30 พ.ค.';
    if(dayValue === 'day2') return '31 พ.ค.';
    return '30-31 พ.ค.';
}

function getDotClass(tag) {
    if(tag === 'เบงจันทร์') return 'dot-blue';
    if(tag === 'สิบศิลป์') return 'dot-red';
    return 'dot-orange';
}

// ฟังก์ชันบีบอัดรูปภาพด้วย HTML5 Canvas (ลดขนาดไฟล์ก่อนเซฟลงฐานข้อมูล)
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            // บังคับความกว้างสูงสุด 500px เพื่อไม่ให้ไฟล์ใหญ่เกินไป
            const MAX_WIDTH = 500;
            const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // แปลงเป็น Base64 (JPEG quality 0.7)
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// --- 4. การแสดงผล UI ---
function updateBoothUI() {
    document.querySelectorAll('.status-dot').forEach(d => { d.style.display = 'none'; d.className = 'status-dot'; });
    document.querySelectorAll('.booth').forEach(b => b.style.color = "");
    const list = document.getElementById('boothList'); list.innerHTML = ''; let count = 0;

    allBooths.forEach(b => {
        const matchText = b.circle_name.toLowerCase().includes(filters.text) || b.booth_no.toLowerCase().includes(filters.text);
        const matchTag = filters.tag === 'all' || b.tag === filters.tag;
        const matchDay = filters.day === 'all' || b.days === 'both' || b.days === filters.day;
        
        if (matchText && matchTag && matchDay) {
            count++;
            const boothArray = extractBooths(b.booth_no);
            list.innerHTML += `
                <div class="booth-card">
                    <div class="card-top"><span class="b-no">${boothArray.join(', ')}</span><span class="b-day">📅 ${getDayLabel(b.days)}</span></div>
                    <h3 class="card-title">${b.circle_name}</h3>
                    <p class="card-desc">${b.description}</p>
                    <span class="b-tag"><span class="dot ${getDotClass(b.tag)}"></span> ${b.tag}</span>
                </div>
            `;
            boothArray.forEach(bNo => {
                const cell = document.getElementById(`map-${bNo}`);
                if(cell) {
                    const dot = cell.querySelector('.status-dot');
                    dot.style.display = 'block'; dot.classList.add(getDotClass(b.tag)); cell.style.color = "transparent";
                }
            });
        }
    });
    if (count === 0) list.innerHTML = '<div class="empty-state">ไม่พบข้อมูลบูธที่ค้นหา</div>';
}

function updateTradeUI() {
    const list = document.getElementById('tradeList');
    list.innerHTML = '';
    
    if (allTrades.length === 0) {
        list.innerHTML = '<div class="empty-state">ยังไม่มีคนลงหาเทรดการ์ด เป็นคนแรกเลยสิ!</div>';
        return;
    }

    allTrades.forEach(t => {
        list.innerHTML += `
            <div class="trade-card">
                <img src="${t.image_base64}" alt="Card Image" class="trade-img">
                <div class="trade-info">
                    <div class="card-top">
                        <span class="b-tag" style="margin-bottom: 5px;"><span class="dot ${getDotClass(t.tag)}"></span> ${t.tag}</span>
                        <span class="b-day">📅 ${getDayLabel(t.days)}</span>
                    </div>
                    <h3 class="trade-oc">OC: ${t.oc_name}</h3>
                    <p class="card-desc" style="margin-top: 8px;">${t.note}</p>
                </div>
            </div>
        `;
    });
}

// --- 5. ดึงข้อมูลจาก Firebase ---
onSnapshot(collection(db, "booths"), (snapshot) => {
    allBooths = [];
    snapshot.forEach((doc) => {
        let data = doc.data(); if(!data.days) data.days = 'both';
        allBooths.push({ id: doc.id, ...data });
    });
    updateBoothUI();
});

// ดึงข้อมูลการ์ดเทรด (เรียงจากใหม่ไปเก่า ถ้า Rules ของ Firebase อนุญาต)
onSnapshot(query(collection(db, "trades")), (snapshot) => {
    allTrades = [];
    snapshot.forEach((doc) => {
        allTrades.push({ id: doc.id, ...doc.data() });
    });
    // สลับอันที่เพิ่งลงขึ้นมาด้านบน
    allTrades.reverse();
    updateTradeUI();
});

// --- 6. Event Listeners ---
document.getElementById('searchInput').addEventListener('input', (e) => { filters.text = e.target.value.toLowerCase(); updateBoothUI(); });
document.getElementById('dayFilter').addEventListener('change', (e) => { filters.day = e.target.value; updateBoothUI(); });
document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
        const targetBtn = e.target.closest('.tag-btn'); targetBtn.classList.add('active');
        filters.tag = targetBtn.getAttribute('data-tag'); updateBoothUI();
    });
});

// บันทึกข้อมูลบูธ
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('.btn-submit'); btn.textContent = "กำลังบันทึก..."; btn.disabled = true;
    try {
        await addDoc(collection(db, "booths"), {
            days: document.getElementById('regDays').value, booth_no: document.getElementById('regBooth').value.toUpperCase(),
            tag: document.getElementById('regTag').value, circle_name: document.getElementById('regCircle').value,
            description: document.getElementById('regDesc').value, timestamp: serverTimestamp()
        });
        alert('บันทึกข้อมูลบูธเรียบร้อย!'); e.target.reset(); document.querySelector('[data-target="viewMap"]').click(); 
    } catch (error) { console.error(error); alert('เกิดข้อผิดพลาด'); } finally { btn.textContent = "บันทึกข้อมูลบูธ"; btn.disabled = false; }
});

// บันทึกข้อมูลเทรดการ์ด
document.getElementById('tradeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit'); 
    btn.textContent = "กำลังอัปโหลด..."; btn.disabled = true;

    const fileInput = document.getElementById('tradeImg');
    const file = fileInput.files[0];

    if (file) {
        // นำรูปไปบีบอัดก่อนส่งขึ้นฐานข้อมูล
        compressImage(file, async (compressedBase64) => {
            try {
                await addDoc(collection(db, "trades"), {
                    image_base64: compressedBase64,
                    oc_name: document.getElementById('tradeOc').value,
                    tag: document.getElementById('tradeTag').value,
                    days: document.getElementById('tradeDay').value,
                    note: document.getElementById('tradeNote').value,
                    timestamp: serverTimestamp()
                });
                alert('โพสต์การ์ดของคุณเรียบร้อยแล้ว!'); 
                e.target.reset();
                document.getElementById('btnCloseTradeForm').click(); // ปิดฟอร์ม
            } catch (error) {
                console.error(error); alert('เกิดข้อผิดพลาดในการอัปโหลด');
            } finally {
                btn.textContent = "โพสต์หาคนเทรด"; btn.disabled = false;
            }
        });
    }
});
