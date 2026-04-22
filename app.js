import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let filters = { day: 'all', tag: 'all', text: '' };

// --- 1. ระบบวาดแผนผัง (ปรับให้เป๊ะขึ้น) ---
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
        for(let i=0; i<4; i++){
            let n = aNum < 10 ? `0${aNum}` : aNum;
            html += `<div class="booth" id="map-A${n}">${n}<div class="status-dot"></div></div>`;
            aNum++;
        }
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
        
        // ซ่อนตัวกรองถ้าอยู่หน้าลงทะเบียน
        globalFilters.style.display = target === 'viewRegister' ? 'none' : 'flex';
    });
});

// --- 3. ฟอร์แมตและเรนเดอร์ข้อมูล ---
function formatBooth(raw) {
    if(!raw) return "";
    let c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length === 2 ? c[0] + '0' + c[1] : c;
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

function checkMatch(booth) {
    // กรองข้อความค้นหา
    const matchText = booth.circle_name.toLowerCase().includes(filters.text) || booth.booth_no.toLowerCase().includes(filters.text);
    // กรองแท็กคอมมู
    const matchTag = filters.tag === 'all' || booth.tag === filters.tag;
    // กรองวันจัดแสดง (ตรรกะ: ถ้าเลือกทุกวัน ให้ผ่าน / ถ้าเลือกวันใดวันหนึ่ง บูธต้องเป็น both หรือตรงกับวันที่เลือก)
    const matchDay = filters.day === 'all' || booth.days === 'both' || booth.days === filters.day;
    
    return matchText && matchTag && matchDay;
}

function updateUI() {
    // รีเซ็ตจุดบนแผนผัง
    document.querySelectorAll('.status-dot').forEach(d => { d.style.display = 'none'; d.className = 'status-dot'; });
    document.querySelectorAll('.booth').forEach(b => b.style.color = "");

    const list = document.getElementById('boothList');
    list.innerHTML = '';
    let count = 0;

    allBooths.forEach(b => {
        if (checkMatch(b)) {
            count++;
            
            // อัปเดตรายการ
            list.innerHTML += `
                <div class="booth-card">
                    <div class="card-top">
                        <span class="b-no">${formatBooth(b.booth_no)}</span>
                        <span class="b-day">📅 ${getDayLabel(b.days)}</span>
                    </div>
                    <h3 class="card-title">${b.circle_name}</h3>
                    <p class="card-desc">${b.description}</p>
                    <span class="b-tag"><span class="dot ${getDotClass(b.tag)}"></span> ${b.tag}</span>
                </div>
            `;

            // อัปเดตแผนผัง
            const cell = document.getElementById(`map-${formatBooth(b.booth_no)}`);
            if(cell) {
                const dot = cell.querySelector('.status-dot');
                dot.style.display = 'block';
                dot.classList.add(getDotClass(b.tag));
                cell.style.color = "transparent";
            }
        }
    });

    if (count === 0) list.innerHTML = '<div class="empty-state">ไม่พบข้อมูลบูธที่ค้นหา หรือยังไม่มีคนลงทะเบียนครับ</div>';
}

// --- 4. ดึงข้อมูลจาก Firebase ---
onSnapshot(collection(db, "booths"), (snapshot) => {
    allBooths = [];
    snapshot.forEach((doc) => {
        // รองรับข้อมูลเก่าที่อาจจะไม่มีฟิลด์ days (ตั้งค่าเริ่มต้นเป็น both)
        let data = doc.data();
        if(!data.days) data.days = 'both';
        allBooths.push({ id: doc.id, ...data });
    });
    updateUI();
});

// --- 5. จัดการ Event การกรอง ---
document.getElementById('searchInput').addEventListener('input', (e) => { filters.text = e.target.value.toLowerCase(); updateUI(); });
document.getElementById('dayFilter').addEventListener('change', (e) => { filters.day = e.target.value; updateUI(); });
document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
        const targetBtn = e.target.closest('.tag-btn');
        targetBtn.classList.add('active');
        filters.tag = targetBtn.getAttribute('data-tag');
        updateUI();
    });
});

// --- 6. บันทึกข้อมูล ---
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.querySelector('.btn-submit');
    btn.textContent = "กำลังบันทึก..."; btn.disabled = true;

    try {
        await addDoc(collection(db, "booths"), {
            days: document.getElementById('regDays').value, // เก็บข้อมูลวันที่เพิ่ม
            booth_no: formatBooth(document.getElementById('regBooth').value),
            tag: document.getElementById('regTag').value,
            circle_name: document.getElementById('regCircle').value,
            description: document.getElementById('regDesc').value,
            timestamp: serverTimestamp()
        });
        
        alert('บันทึกข้อมูลเรียบร้อยแล้วครับ!');
        e.target.reset();
        document.querySelector('[data-target="viewMap"]').click(); 
    } catch (error) {
        console.error(error); alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่ครับ');
    } finally {
        btn.textContent = "บันทึกข้อมูล"; btn.disabled = false;
    }
});
