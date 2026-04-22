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
// 👆👆👆 =========================== 👆👆👆

// ตรวจสอบเบื้องต้นว่ามีการใส่ Config หรือยัง
if(firebaseConfig.apiKey === "YOUR_API_KEY") {
    alert("ระบบตรวจพบว่ายังไม่ได้ใส่ Firebase Config ในไฟล์ app.js ข้อมูลจึงไม่แสดงครับ");
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === 1. ระบบวาดแผนผัง (ทำงานทันที) ===
function generateMapHTML() {
    const centerBlocks = [4, 4, 6, 6, 6, 4, 4];
    const edgeBlocks = [4, 4, 4, 4, 4, 4, 4, 4];

    function createBoothCol(prefix, blocks, startNum) {
        let html = '';
        let currentNum = startNum;
        blocks.forEach(blockSize => {
            html += `<div class="booth-group-v">`;
            for (let i = 0; i < blockSize; i++) {
                let n = currentNum < 10 ? `0${currentNum}` : currentNum;
                html += `<div class="booth" id="map-${prefix}${n}">${n}<div class="status-dot"></div></div>`;
                currentNum--;
            }
            html += `</div>`;
        });
        return html;
    }

    let mapHTML = `<div class="row-top"><div class="letter">A</div>`;
    let aNum = 1;
    for(let group=0; group<8; group++) {
        if(group === 4) mapHTML += `<div style="width: 25px;"></div>`;
        mapHTML += `<div class="booth-group-h">`;
        for(let i=0; i<4; i++) {
            let n = aNum < 10 ? `0${aNum}` : aNum;
            mapHTML += `<div class="booth" id="map-A${n}">${n}<div class="status-dot"></div></div>`;
            aNum++;
        }
        mapHTML += `</div>`;
    }
    mapHTML += `<div class="letter">A</div></div><div class="main-floor">`;
    mapHTML += `<div class="col-single-wrapper"><div class="letter">B</div>${createBoothCol('B', edgeBlocks, 32)}<div class="letter">B</div></div>`;

    const pairedLetters = [['C','D'], ['E','F'], ['G','H'], ['I','J'], ['K','L'], ['M','N']];
    pairedLetters.forEach(pair => {
        let blockHTML = '';
        let cNum = 34;
        centerBlocks.forEach(blockSize => {
            blockHTML += `<div class="pair-group"><div class="booth-group-v">`;
            for(let i=0; i<blockSize; i++) {
                let n = (cNum - i < 10) ? `0${cNum - i}` : cNum - i;
                blockHTML += `<div class="booth" id="map-${pair[0]}${n}">${n}<div class="status-dot"></div></div>`;
            }
            blockHTML += `</div><div class="booth-group-v">`;
            for(let i=0; i<blockSize; i++) {
                let n = (cNum - i < 10) ? `0${cNum - i}` : cNum - i;
                blockHTML += `<div class="booth" id="map-${pair[1]}${n}">${n}<div class="status-dot"></div></div>`;
            }
            blockHTML += `</div></div>`;
            cNum -= blockSize;
        });
        mapHTML += `<div class="col-pair-wrapper"><div class="letter-pair"><span>${pair[0]}</span><span>${pair[1]}</span></div>${blockHTML}<div class="letter-pair"><span>${pair[0]}</span><span>${pair[1]}</span></div></div>`;
    });
    mapHTML += `<div class="col-single-wrapper"><div class="letter">O</div>${createBoothCol('O', edgeBlocks, 32)}<div class="letter">O</div></div></div>`;

    document.getElementById('grid-container').innerHTML = mapHTML;
}

generateMapHTML(); // วาดแผนผังก่อนเลย

// === 2. โลจิกสลับแท็บ ===
const tabs = { map: document.getElementById('tabMap'), search: document.getElementById('tabSearch'), register: document.getElementById('tabRegister') };
const views = { map: document.getElementById('viewMap'), search: document.getElementById('viewSearch'), register: document.getElementById('viewRegister') };

function switchTab(target) {
    Object.values(tabs).forEach(t => t.classList.remove('active'));
    Object.values(views).forEach(v => v.classList.remove('active'));
    tabs[target].classList.add('active');
    views[target].classList.add('active');
}
tabs.map.addEventListener('click', () => switchTab('map'));
tabs.search.addEventListener('click', () => switchTab('search'));
tabs.register.addEventListener('click', () => switchTab('register'));

let allBooths = [];
let currentFilter = 'all';

// ฟังก์ชันจัดฟอร์แมตเลขบูธให้เป็นมาตรฐาน (เช่น "a 1" -> "A01")
function formatBoothNumber(raw) {
    if (!raw) return "";
    let clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, ''); // ลบช่องว่างและอักขระพิเศษ
    // ถ้าพิมพ์มาแค่ 2 ตัวอักษร เช่น A1 ให้เติม 0 ตรงกลางเป็น A01
    if (clean.length === 2) {
        clean = clean[0] + '0' + clean[1];
    }
    return clean;
}

// === 3. อัปเดตแผนผังและรายการบูธ ===
function updateMapDots() {
    // ล้างจุดเก่าและคืนสีตัวอักษรเดิมก่อน
    document.querySelectorAll('.status-dot').forEach(dot => {
        dot.style.display = 'none';
        dot.className = 'status-dot'; 
    });
    document.querySelectorAll('.booth').forEach(cell => { cell.style.color = ""; });

    allBooths.forEach(booth => {
        const bNo = formatBoothNumber(booth.booth_no);
        const boothCell = document.getElementById(`map-${bNo}`);
        
        if (boothCell) {
            const dot = boothCell.querySelector('.status-dot');
            dot.style.display = 'block';
            if (booth.tag === 'เบงจันทร์') dot.classList.add('dot-bengchan');
            else if (booth.tag === 'สิบศิลป์') dot.classList.add('dot-sipsil');
            else dot.classList.add('dot-other');
            
            boothCell.style.color = "transparent"; // ซ่อนตัวเลข
        }
    });
}

function renderBoothList() {
    const list = document.getElementById('boothList');
    list.innerHTML = '';
    const term = document.getElementById('searchInput').value.toLowerCase();

    const filtered = allBooths.filter(b => {
        const matchText = b.circle_name.toLowerCase().includes(term) || b.booth_no.toLowerCase().includes(term);
        const matchTag = currentFilter === 'all' || b.tag === currentFilter;
        return matchText && matchTag;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p class="loading-text">ไม่พบข้อมูลบูธที่ค้นหา หรือยังไม่มีคนลงทะเบียน</p>';
        return;
    }

    filtered.forEach(b => {
        list.innerHTML += `
            <div class="booth-card">
                <div class="card-header">
                    <span class="booth-no">${formatBoothNumber(b.booth_no)}</span>
                    <span class="tag ${b.tag}">${b.tag}</span>
                </div>
                <h3>${b.circle_name}</h3>
                <p>${b.description}</p>
            </div>
        `;
    });
}

// === 4. ดึงข้อมูลจาก Firebase ===
console.log("กำลังเชื่อมต่อฐานข้อมูล...");
onSnapshot(collection(db, "booths"), (snapshot) => {
    allBooths = [];
    snapshot.forEach((doc) => {
        allBooths.push({ id: doc.id, ...doc.data() });
    });
    console.log("ดึงข้อมูลสำเร็จ! พบ:", allBooths.length, "บูธ");
    renderBoothList();
    updateMapDots();
}, (error) => {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
    document.getElementById('boothList').innerHTML = '<p class="loading-text" style="color:red;">❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบ Firebase Config หรือ Rules</p>';
});

// === 5. บันทึกข้อมูล ===
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.querySelector('.submit-btn');
    btn.textContent = "กำลังบันทึก...";
    btn.disabled = true;

    try {
        const rawBooth = document.getElementById('regBooth').value;
        const formattedBooth = formatBoothNumber(rawBooth);

        await addDoc(collection(db, "booths"), {
            booth_no: formattedBooth, // เซฟแบบจัดฟอร์แมตแล้วลง Database
            circle_name: document.getElementById('regCircle').value,
            tag: document.getElementById('regTag').value,
            description: document.getElementById('regDesc').value,
            timestamp: serverTimestamp()
        });
        
        alert('ลงทะเบียนบูธสำเร็จ!');
        e.target.reset();
        switchTab('map'); 
    } catch (error) {
        console.error("Error Saving:", error);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
        btn.textContent = "บันทึกข้อมูล";
        btn.disabled = false;
    }
});

// ค้นหาและฟิลเตอร์
document.getElementById('searchInput').addEventListener('input', renderBoothList);
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
        renderBoothList();
    });
});
