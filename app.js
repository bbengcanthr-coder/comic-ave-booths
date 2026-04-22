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

// === 1. ระบบวาดแผนผัง (Map Generation) ===
function generateMapHTML() {
    const centerBlocks = [4, 4, 6, 6, 6, 4, 4];
    const edgeBlocks = [4, 4, 4, 4, 4, 4, 4, 4];

    function createBoothCol(prefix, blocks, startNum, isZeroPadded = true) {
        let html = '';
        let currentNum = startNum;
        blocks.forEach(blockSize => {
            html += `<div class="booth-group-v">`;
            for (let i = 0; i < blockSize; i++) {
                let displayNum = isZeroPadded && currentNum < 10 ? `0${currentNum}` : currentNum;
                let boothId = `${prefix}${displayNum}`;
                html += `<div class="booth" id="map-${boothId}">${displayNum}<div class="status-dot"></div></div>`;
                currentNum--;
            }
            html += `</div>`;
        });
        return html;
    }

    let mapHTML = '';
    
    // Row A
    mapHTML += `<div class="row-top"><div class="letter">A</div>`;
    let aNum = 1;
    for(let group=0; group<8; group++) {
        if(group === 4) mapHTML += `<div style="width: 25px;"></div>`;
        mapHTML += `<div class="booth-group-h">`;
        for(let i=0; i<4; i++) {
            let displayNum = aNum < 10 ? `0${aNum}` : aNum;
            let boothId = `A${displayNum}`;
            mapHTML += `<div class="booth" id="map-${boothId}">${displayNum}<div class="status-dot"></div></div>`;
            aNum++;
        }
        mapHTML += `</div>`;
    }
    mapHTML += `<div class="letter">A</div></div>`;

    // Main Floor
    mapHTML += `<div class="main-floor">`;
    mapHTML += `<div class="col-single-wrapper"><div class="letter">B</div>${createBoothCol('B', edgeBlocks, 32)}<div class="letter">B</div></div>`;

    const pairedLetters = [['C','D'], ['E','F'], ['G','H'], ['I','J'], ['K','L'], ['M','N']];
    pairedLetters.forEach(pair => {
        let blockHTML = '';
        let cNum = 34;
        centerBlocks.forEach(blockSize => {
            blockHTML += `<div class="pair-group">`;
            blockHTML += `<div class="booth-group-v">`;
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

    mapHTML += `<div class="col-single-wrapper"><div class="letter">O</div>${createBoothCol('O', edgeBlocks, 32)}<div class="letter">O</div></div>`;
    mapHTML += `</div>`;

    document.getElementById('grid-container').innerHTML = mapHTML;
}

// === 2. โลจิกการจัดการ UI และ ข้อมูล ===
const tabs = {
    map: document.getElementById('tabMap'),
    search: document.getElementById('tabSearch'),
    register: document.getElementById('tabRegister')
};
const views = {
    map: document.getElementById('viewMap'),
    search: document.getElementById('viewSearch'),
    register: document.getElementById('viewRegister')
};

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

// อัปเดตจุดสีบนแผนผัง
function updateMapDots() {
    // ล้างจุดเก่าทั้งหมดก่อน
    document.querySelectorAll('.status-dot').forEach(dot => {
        dot.style.display = 'none';
        dot.className = 'status-dot'; // reset class
    });

    // วาดจุดใหม่ตามข้อมูล
    allBooths.forEach(booth => {
        const boothCell = document.getElementById(`map-${booth.booth_no}`);
        if (boothCell) {
            const dot = boothCell.querySelector('.status-dot');
            dot.style.display = 'block';
            if (booth.tag === 'เบงจันทร์') dot.classList.add('dot-bengchan');
            else if (booth.tag === 'สิบศิลป์') dot.classList.add('dot-sipsil');
            else dot.classList.add('dot-other');
            
            // ทำให้เลขจางลงเพื่อให้จุดสีเด่นขึ้น
            boothCell.style.color = "transparent"; 
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
        list.innerHTML = '<p style="text-align:center; color:#718096; padding:20px;">ไม่พบข้อมูลบูธที่ค้นหา</p>';
        return;
    }

    filtered.forEach(b => {
        list.innerHTML += `
            <div class="booth-card">
                <div class="card-header">
                    <span class="booth-no">${b.booth_no}</span>
                    <span class="tag ${b.tag}">${b.tag}</span>
                </div>
                <h3>${b.circle_name}</h3>
                <p>${b.description}</p>
            </div>
        `;
    });
}

// --- การทำงานกับ Firebase ---
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.querySelector('.submit-btn');
    btn.textContent = "กำลังบันทึก...";
    btn.disabled = true;

    try {
        let rawBooth = document.getElementById('regBooth').value.toUpperCase().replace(/\s/g, '');
        // จัดรูปแบบเลขบูธให้ตรงกับ ID (เช่น A1 -> A01)
        if (rawBooth.length === 2) {
            rawBooth = rawBooth[0] + '0' + rawBooth[1];
        }

        await addDoc(collection(db, "booths"), {
            booth_no: rawBooth,
            circle_name: document.getElementById('regCircle').value,
            tag: document.getElementById('regTag').value,
            description: document.getElementById('regDesc').value,
            timestamp: serverTimestamp()
        });
        
        alert('ลงทะเบียนบูธสำเร็จ!');
        e.target.reset();
        switchTab('map'); // กลับไปหน้าแผนผังเพื่อดูจุดที่เพิ่งขึ้น
    } catch (error) {
        console.error("Error:", error);
        alert('เกิดข้อผิดพลาด');
    } finally {
        btn.textContent = "บันทึกข้อมูล";
        btn.disabled = false;
    }
});

// ฟังการเปลี่ยนแปลงข้อมูล (Real-time)
onSnapshot(collection(db, "booths"), (snapshot) => {
    allBooths = [];
    snapshot.forEach((doc) => {
        allBooths.push({ id: doc.id, ...doc.data() });
    });
    renderBoothList();
    updateMapDots();
});

// Event Listeners ค้นหาและฟิลเตอร์
document.getElementById('searchInput').addEventListener('input', renderBoothList);
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
        renderBoothList();
    });
});

// สร้างแผนผังตอนโหลดเว็บ
generateMapHTML();
