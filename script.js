// תצורת Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDAktpDrlseX7iAVUg0sDrZNLjbu37U6QA",
    authDomain: "plugab-10731.firebaseapp.com",
    databaseURL: "https://plugab-10731-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "plugab-10731",
    storageBucket: "plugab-10731.firebasestorage.app",
    messagingSenderId: "812896087311",
    appId: "1:812896087311:web:312963fa112f947400227a",
    measurementId: "G-N0KGBYSDGX"
};

// אתחול Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// מצב כניסה למערכת
let isLoggedIn = false;

// משתנה גלובלי לשמירת הדוחות
let reports = {};

// משתנה גלובלי לשמירת החיילים החסרים והסיבות שלהם
let absentSoldiers = {};

// קוד גישה מיוחד להרשמה - רק מי שיודע אותו יכול להירשם
const SPECIAL_ACCESS_CODE = "plugab2025";

// סיבות היעדרות אפשריות
const ABSENCE_REASONS = ["בבית", "גימלים", "משוחרר משמפ"];

// רשימת החיילים במחלקות
const soldiers = {
    "מחלקה 1": ["אביב לוי", "אבנר לוי", "איגור חביבובלין", "אמיר בלוך", "אסף אופיר", "הלל בנאמו", "חביב דדון", "לוי יצחק דובאוו", "לירון פוריאן", "פבל אבירם", "עדן מור"],
    "מחלקה 2": ["אליהו ברקלי", "אוהד מאיר", "אלכסנדר ליטבין", "אסיף יו סבאג", "דביר יעקב", "דניאל זוקובסקי", "חן בן צבי", "ערן יופה", "רפאל אביטבול", "תומר צביון", "עליסיה טרשצנקו"],
    "מחלקה 3": ["דניאל יונתן", "אביבה קללאו", "אופיר מזרחי", "דקל חן", "ולדיסלב שבצ'נקו", "ליז קוקישווילי", "מאור גבאי", "נועם גזית", "עידן מלול", "רקפת זיו", "שיר דקלו"],
    "מפלג": ["אלי מור", "אליאור אמסלם", "ג'סי שלו", "הגר שוקר", "מיקי ביתן", "עומר אנטמן", "עמית שחר", "רועי דנינו", "רן בן טוב", "שקד קסלר", "ג'קי מוקמל", "איתי מלטבשי"],
    "מסופחים": ["אופיר אלזרט","הגר אלון","שושנה מולר","מנחם קורל ג׳קי","יובל שלום","שחר בלוך"]
};

// בדיקת סטטוס התחברות בעת טעינת הדף
auth.onAuthStateChanged(function(user) {
    if (user) {
        // המשתמש מחובר למערכת
        isLoggedIn = true;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('main-container').style.display = 'block';
        
        // קבלת מידע המשתמש (שם פרטי ושם משפחה) מהדאטאבייס
        database.ref('users/' + user.uid).once('value')
            .then(snapshot => {
                const userData = snapshot.val() || {};
                const firstName = userData.firstName || '';
                const lastName = userData.lastName || '';
                
                if (firstName && lastName) {
                    document.getElementById('user-fullname').textContent = firstName + ' ' + lastName;
                } else {
                    document.getElementById('user-fullname').textContent = user.email;
                }
            })
            .catch(error => {
                console.error("שגיאה בקבלת מידע המשתמש:", error);
                document.getElementById('user-fullname').textContent = user.email;
            });
        
        // אתחול החלון המודאלי
        initModal();
        
        // טעינת המידע לאחר כניסה מוצלחת
        loadData(); 
    } else {
        // המשתמש לא מחובר
        isLoggedIn = false;
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('main-container').style.display = 'none';
    }
});

// פונקציית אתחול החלון המודאלי
function initModal() {
    const modal = document.getElementById('absence-reason-modal');
    const closeModal = document.getElementsByClassName('close-modal')[0];
    const saveBtn = document.getElementById('save-reason-btn');
    
    // סגירת החלון בלחיצה על X
    closeModal.onclick = function() {
        modal.style.display = "none";
    };
    
    // סגירת החלון בלחיצה מחוץ לו
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
    
    // שמירת סיבת ההיעדרות
    saveBtn.onclick = function() {
        const soldierName = document.getElementById('current-soldier-name').textContent;
        const reasonRadios = document.getElementsByName('absence-reason');
        let selectedReason = "בבית"; // ברירת מחדל
        
        for (let i = 0; i < reasonRadios.length; i++) {
            if (reasonRadios[i].checked) {
                selectedReason = reasonRadios[i].value;
                break;
            }
        }
        
        // שמירת הסיבה באובייקט החיילים החסרים
        absentSoldiers[soldierName] = selectedReason;
        
        // עדכון תצוגת החיילים החסרים
        updateSelectedSoldiers();
        
        // סגירת החלון
        modal.style.display = "none";
    };
}

// פונקציות התחברות והרשמה
function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    if (!email || !password) {
        errorElement.textContent = 'אנא מלא את כל השדות';
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // כניסה מוצלחת
            isLoggedIn = true;
            errorElement.textContent = '';
        })
        .catch((error) => {
            // שגיאה בכניסה
            isLoggedIn = false;
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorElement.textContent = 'אימייל או סיסמה שגויים';
            } else {
                errorElement.textContent = 'שגיאה בכניסה: ' + error.message;
            }
        });
}

function register() {
    const firstName = document.getElementById('reg-firstname').value;
    const lastName = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;
    const accessCode = document.getElementById('reg-access-code').value;
    const errorElement = document.getElementById('register-error');
    
    if (!firstName || !lastName || !email || !password || !passwordConfirm || !accessCode) {
        errorElement.textContent = 'אנא מלא את כל השדות';
        return;
    }
    
    if (password !== passwordConfirm) {
        errorElement.textContent = 'הסיסמאות אינן תואמות';
        return;
    }
    
    if (accessCode !== SPECIAL_ACCESS_CODE) {
        errorElement.textContent = 'קוד הגישה שגוי';
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // הרשמה מוצלחת
            
            // שמירת פרטי המשתמש (שם פרטי ושם משפחה) בדאטאבייס
            const userId = userCredential.user.uid;
            database.ref('users/' + userId).set({
                firstName: firstName,
                lastName: lastName,
                email: email
            })
            .then(() => {
                errorElement.textContent = '';
                showLoginForm();
                alert('ההרשמה הושלמה בהצלחה! אנא התחבר למערכת.');
            })
            .catch((error) => {
                console.error("שגיאה בשמירת פרטי המשתמש:", error);
            });
        })
        .catch((error) => {
            // שגיאה בהרשמה
            if (error.code === 'auth/email-already-in-use') {
                errorElement.textContent = 'חשבון עם אימייל זה כבר קיים';
            } else if (error.code === 'auth/weak-password') {
                errorElement.textContent = 'הסיסמה חלשה מדי (מינימום 6 תווים)';
            } else {
                errorElement.textContent = 'שגיאה בהרשמה: ' + error.message;
            }
        });
}

function logout() {
    auth.signOut()
        .then(() => {
            // יציאה מוצלחת
            isLoggedIn = false;
        })
        .catch((error) => {
            // שגיאה ביציאה
            console.error("שגיאה בהתנתקות:", error);
        });
}

function forgotPassword() {
    const email = document.getElementById('email').value;
    const errorElement = document.getElementById('login-error');
    
    if (!email) {
        errorElement.textContent = 'אנא הכנס אימייל לשחזור סיסמה';
        return;
    }
    
    auth.sendPasswordResetEmail(email)
        .then(() => {
            // נשלח אימייל לשחזור סיסמה
            errorElement.textContent = '';
            alert('הוראות לאיפוס סיסמה נשלחו לאימייל שלך');
        })
        .catch((error) => {
            // שגיאה בשליחת אימייל
            if (error.code === 'auth/user-not-found') {
                errorElement.textContent = 'לא נמצא חשבון עם אימייל זה';
            } else {
                errorElement.textContent = 'שגיאה בשליחת הוראות איפוס: ' + error.message;
            }
        });
}

function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

// טעינת הנתונים
function loadData() {
    // עדכון התאריך הנוכחי
    updateDateWithToday();
    
    // איפוס אובייקט החיילים החסרים
    absentSoldiers = {};
    
    // קודם בדוק אם יש נתונים באחסון המקומי במקרה של אין אינטרנט
    const localReports = JSON.parse(localStorage.getItem('attendanceReports')) || {};
    
    // טעינת דוחות מ-Firebase
    database.ref('reports').once('value')
        .then(snapshot => {
            // שמירת הנתונים מ-Firebase
            reports = snapshot.val() || {};
            
            // אם אין נתונים ב-Firebase אבל יש באחסון המקומי, השתמש בהם
            if (Object.keys(reports).length === 0 && Object.keys(localReports).length > 0) {
                reports = localReports;
                // שמירת הנתונים המקומיים בענן
                database.ref('reports').set(reports);
            }
            
            // שמירת עותק באחסון המקומי
            localStorage.setItem('attendanceReports', JSON.stringify(reports));
            
            // הצגת הדוחות והסטטיסטיקות
            renderReportList();
            updateGlobalStats();
        })
        .catch(error => {
            console.error("שגיאה בטעינת נתונים מ-Firebase:", error);
            
            // במקרה של שגיאה, השתמש בנתונים מקומיים אם יש
            reports = localReports;
            renderReportList();
            updateGlobalStats();
            
            // הודעה למשתמש
            if (Object.keys(reports).length > 0) {
                alert("לא ניתן להתחבר לשרת - משתמש בנתונים מקומיים");
            }
        });
}

function updateDateWithToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const defaultDate = `${year}-${month}-${day}`;
    
    if (!document.getElementById('date').value) {
        document.getElementById('date').value = defaultDate;
    }
}

function switchTab(tabName) {
    // בדיקה אם המשתמש מחובר
    if (!isLoggedIn) {
        alert("עליך להתחבר למערכת כדי לבצע פעולה זו");
        return;
    }
    
    // הסרת המחלקה 'active' מכל כפתורי הלשונית
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // הסרת המחלקה 'active' מכל תוכן הלשונית
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // הפעלת הכפתור והלשונית שנבחרו
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // רענון הדוחות וסטטיסטיקות אם הלשונית היא דוחות או טופס
    if (tabName === 'reports') {
        renderReportList();
    } else if (tabName === 'form') {
        updateGlobalStats();
    }
}

function confirmUnitChange() {
    // בדיקה אם המשתמש מחובר
    if (!isLoggedIn) {
        alert("עליך להתחבר למערכת כדי לבצע פעולה זו");
        document.getElementById('unit').value = document.getElementById('unit').dataset.prevValue || "";
        return;
    }
    
    if (Object.keys(absentSoldiers).length > 0) {
        if (confirm("שינוי מחלקה ימחק את הבחירה הנוכחית. האם להמשיך?")) {
            // איפוס אובייקט החיילים החסרים
            absentSoldiers = {};
            updateSoldiers();
        } else {
            // שחזור המחלקה הקודמת
            const prevUnit = document.getElementById('unit').dataset.prevValue || "";
            document.getElementById('unit').value = prevUnit;
            return;
        }
    } else {
        updateSoldiers();
    }
    
    // שמירת המחלקה הנוכחית לשימוש עתידי
    document.getElementById('unit').dataset.prevValue = document.getElementById('unit').value;
}

function updateSoldiers() {
    const selectedUnit = document.getElementById("unit").value;
    const soldiersDiv = document.getElementById("soldiers");
    soldiersDiv.innerHTML = "";
    
    if (selectedUnit) {
        soldiers[selectedUnit].sort().forEach(soldier => {
            const label = document.createElement("label");
            label.innerText = soldier;
            label.classList.add("soldier-item");
            
            // אם החייל כבר נמצא ברשימת החסרים, סמן אותו
            if (absentSoldiers[soldier]) {
                label.classList.add("selected");
            }
            
            label.onclick = function() {
                if (label.classList.contains("selected")) {
                    // אם החייל כבר נבחר, בטל את הבחירה
                    label.classList.remove("selected");
                    delete absentSoldiers[soldier];
                    updateSelectedSoldiers();
                } else {
                    // אם החייל לא נבחר, פתח את החלון לבחירת סיבה
                    label.classList.add("selected");
                    openReasonModal(soldier);
                }
            };
            soldiersDiv.appendChild(label);
        });
    }
    
    // עדכון רשימת החיילים החסרים
    updateSelectedSoldiers();
}

// פתיחת חלון מודאלי לבחירת סיבת היעדרות
function openReasonModal(soldierName) {
    const modal = document.getElementById('absence-reason-modal');
    document.getElementById('current-soldier-name').textContent = soldierName;
    
    // איפוס בחירת רדיו לברירת מחדל (בבית)
    const reasonRadios = document.getElementsByName('absence-reason');
    reasonRadios[0].checked = true;
    
    // אם כבר יש סיבה שמורה לחייל זה, בחר אותה
    if (absentSoldiers[soldierName]) {
        const savedReason = absentSoldiers[soldierName];
        for (let i = 0; i < reasonRadios.length; i++) {
            if (reasonRadios[i].value === savedReason) {
                reasonRadios[i].checked = true;
                break;
            }
        }
    }
    
    modal.style.display = "block";
}

function updateSelectedSoldiers() {
    const selectedSoldiersDiv = document.getElementById("selected-soldiers");
    const absentCountSpan = document.getElementById("absent-count");
    
    const absentSoldierNames = Object.keys(absentSoldiers);
    
    if (absentSoldierNames.length) {
        selectedSoldiersDiv.innerHTML = "";
        
        absentSoldierNames.forEach(soldier => {
            const reason = absentSoldiers[soldier];
            const badge = document.createElement("div");
            badge.classList.add("soldier-badge");
            
            // יצירת תג עם שם החייל וסיבת ההיעדרות
            badge.innerHTML = `
                <span class="badge-name">${soldier}</span>
                <span class="badge-reason">${reason}</span>
                <span class="badge-remove" onclick="removeSoldier('${soldier}')">&times;</span>
            `;
            
            selectedSoldiersDiv.appendChild(badge);
        });
    } else {
        selectedSoldiersDiv.innerHTML = "<em>אין חיילים חסרים</em>";
    }
    
    absentCountSpan.innerText = absentSoldierNames.length;
}

// הסרת חייל מרשימת החסרים
function removeSoldier(soldierName) {
    // הסר מהאובייקט
    delete absentSoldiers[soldierName];
    
    // עדכן את התצוגה של החיילים ברשימה
    const labels = document.querySelectorAll(".soldier-list label");
    labels.forEach(label => {
        if (label.innerText === soldierName) {
            label.classList.remove("selected");
        }
    });
    
    // עדכן את התצוגה של החיילים שנבחרו
    updateSelectedSoldiers();
}

function filterSoldiers() {
    const searchTerm = document.getElementById("search").value.toLowerCase();
    const soldierLabels = document.querySelectorAll(".soldier-list label");
    
    soldierLabels.forEach(label => {
        if (label.innerText.toLowerCase().includes(searchTerm)) {
            label.style.display = "block";
        } else {
            label.style.display = "none";
        }
    });
}

function filterReports() {
    const searchTerm = document.getElementById("report-search").value.toLowerCase();
    const reportCards = document.querySelectorAll(".report-card");
    
    reportCards.forEach(card => {
        if (card.innerText.toLowerCase().includes(searchTerm)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

function checkExistingReport(date, time, unit) {
    // בדיקה אם קיים כבר דוח לאותו תאריך, שעה ומחלקה
    const reportId = `${date}_${time}_${unit}`.replace(/[\s:]/g, '_');
    
    return reports[reportId] !== undefined;
}

function submitForm() {
    // בדיקה אם המשתמש מחובר
    if (!isLoggedIn) {
        alert("עליך להתחבר למערכת כדי לשלוח דיווח");
        return;
    }
    
    const selectedUnit = document.getElementById("unit").value;
    const selectedDate = document.getElementById("date").value;
    const selectedTime = document.getElementById("time").value;
    
    if (!selectedUnit || !selectedDate || !selectedTime) {
        alert("אנא מלא את כל השדות לפני שליחת הדיווח.");
        return;
    }
    
    // בדיקה אם קיים כבר דוח עם אותו תאריך, שעה ומחלקה
    if (checkExistingReport(selectedDate, selectedTime, selectedUnit)) {
        if (!confirm("כבר קיים דוח לתאריך, שעה ומחלקה אלו. האם ברצונך לעדכן את הדוח הקיים?")) {
            return;
        }
    }
    
    // יצירת מזהה ייחודי לדוח
    const reportId = `${selectedDate}_${selectedTime}_${selectedUnit}`.replace(/[\s:]/g, '_');
    
    // יצירת דוח עם חותמת זמן
    const reportTimestamp = new Date().toISOString();
    
    // יצירת מבנה נתונים עבור החיילים החסרים והסיבות שלהם
    const absentData = [];
    for (const [soldier, reason] of Object.entries(absentSoldiers)) {
        absentData.push({
            name: soldier,
            reason: reason
        });
    }
    
    // קבלת פרטי המשתמש הנוכחי
    database.ref('users/' + auth.currentUser.uid).once('value')
        .then(snapshot => {
            const userData = snapshot.val() || {};
            const firstName = userData.firstName || '';
            const lastName = userData.lastName || '';
            const fullName = firstName && lastName ? `${firstName} ${lastName}` : auth.currentUser.email;
            
            // יצירת אובייקט הדוח
            const reportData = { 
                date: selectedDate, 
                time: selectedTime, 
                unit: selectedUnit, 
                absent: absentData,
                timestamp: reportTimestamp,
                createdBy: fullName
            };
            
            // עדכון המשתנה הגלובלי
            reports[reportId] = reportData;
            
            // ניסיון לשמור ב-Firebase
            database.ref('reports/' + reportId).set(reportData)
                .then(() => {
                    // שמירת הדוחות לאחסון מקומי כגיבוי
                    localStorage.setItem('attendanceReports', JSON.stringify(reports));
                    
                    alert("הדיווח נשלח בהצלחה!");
                    
                    // ניקוי הטופס
                    document.querySelectorAll(".soldier-list label.selected").forEach(label => {
                        label.classList.remove("selected");
                    });
                    
                    // איפוס אובייקט החיילים החסרים
                    absentSoldiers = {};
                    updateSelectedSoldiers();
                    
                    // עדכון הסטטיסטיקות
                    updateGlobalStats();
                    
                    // מעבר ללשונית הדוחות
                    switchTab('reports');
                })
                .catch(error => {
                    console.error("שגיאה בשמירת נתונים ב-Firebase:", error);
                    
                    // שמירת הדוחות לאחסון מקומי בכל מקרה
                    localStorage.setItem('attendanceReports', JSON.stringify(reports));
                    
                    alert("הדיווח נשמר באופן מקומי, אך התרחשה שגיאה בשמירה בענן: " + error.message);
                    
                    // עדכון הסטטיסטיקות
                    updateGlobalStats();
                    
                    // מעבר ללשונית הדוחות
                    switchTab('reports');
                });
        })
        .catch(error => {
            console.error("שגיאה בקבלת מידע המשתמש:", error);
            
            // במקרה של שגיאה משתמשים באימייל כברירת מחדל
            const reportData = { 
                date: selectedDate, 
                time: selectedTime, 
                unit: selectedUnit, 
                absent: absentData,
                timestamp: reportTimestamp,
                createdBy: auth.currentUser.email
            };
            
            // עדכון המשתנה הגלובלי
            reports[reportId] = reportData;
            
            // ניסיון לשמור ב-Firebase
            database.ref('reports/' + reportId).set(reportData);
            
            // שמירת הדוחות לאחסון מקומי כגיבוי
            localStorage.setItem('attendanceReports', JSON.stringify(reports));
                    
            alert("הדיווח נשלח בהצלחה!");
            
            // ניקוי הטופס
            document.querySelectorAll(".soldier-list label.selected").forEach(label => {
                label.classList.remove("selected");
            });
            
            // איפוס אובייקט החיילים החסרים
            absentSoldiers = {};
            updateSelectedSoldiers();
            
            // עדכון הסטטיסטיקות
            updateGlobalStats();
            
            // מעבר ללשונית הדוחות
            switchTab('reports');
        });
}

function deleteReport(reportId) {
    // בדיקה אם המשתמש מחובר
    if (!isLoggedIn) {
        alert("עליך להתחבר למערכת כדי למחוק דיווח");
        return;
    }
    
    const password = prompt("הכנס סיסמת מחיקה:");
    if (password !== "eadmin") {
        alert("סיסמה שגויה!");
        return;
    }
    
    if (confirm("האם אתה בטוח שברצונך למחוק דוח זה?")) {
        // מחיקה מהמשתנה הגלובלי
        delete reports[reportId];
        
        // ניסיון למחוק מ-Firebase
        database.ref('reports/' + reportId).remove()
            .then(() => {
                // עדכון האחסון המקומי
                localStorage.setItem('attendanceReports', JSON.stringify(reports));
                renderReportList();
                updateGlobalStats();
                alert("הדוח נמחק בהצלחה!");
            })
            .catch(error => {
                console.error("שגיאה במחיקת נתונים מ-Firebase:", error);
                
                // עדכון האחסון המקומי בכל מקרה
                localStorage.setItem('attendanceReports', JSON.stringify(reports));
                renderReportList();
                updateGlobalStats();
                
                alert("הדוח נמחק מהמכשיר, אך התרחשה שגיאה במחיקה מהענן: " + error.message);
            });
    }
}

function renderReportList() {
    const reportListDiv = document.getElementById("report-list");
    reportListDiv.innerHTML = "";
    
    if (Object.keys(reports).length === 0) {
        reportListDiv.innerHTML = "<p>אין דוחות זמינים.</p>";
        return;
    }
    
    // מיון הדוחות לפי תאריך וזמן (החדש ביותר תחילה)
    const sortedReports = Object.entries(reports).sort((a, b) => {
        const dateA = new Date(`${a[1].date}T${a[1].time}`);
        const dateB = new Date(`${b[1].date}T${b[1].time}`);
        return dateB - dateA;
    });
    
    sortedReports.forEach(([reportId, data]) => {
        const reportCard = document.createElement("div");
        reportCard.classList.add("report-card");
        
        // המרת תאריך לפורמט עברי
        const dateObj = new Date(data.date);
        const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
        
        let createdByText = "";
        if (data.createdBy) {
            createdByText = `<small>נוצר ע"י: ${data.createdBy}</small>`;
        }
        
        reportCard.innerHTML = `
            <h3>${data.unit} - ${formattedDate} ${data.time}</h3>
            <p><strong>מספר חיילים חסרים:</strong> ${data.absent ? data.absent.length : 0}</p>
            ${createdByText}
        `;
        
        // בדיקה אם יש חיילים חסרים ובאיזה פורמט (מערך רגיל או מבנה נתונים מורחב)
        if (data.absent && data.absent.length > 0) {
            // בדיקה אם המבנה החדש (עם סיבות)
            if (typeof data.absent[0] === 'object' && data.absent[0].hasOwnProperty('name')) {
                reportCard.innerHTML += `<div class="absent-soldiers-list">`;
                
                // מיון לפי סיבת היעדרות
                const groupedByReason = {};
                data.absent.forEach(item => {
                    if (!groupedByReason[item.reason]) {
                        groupedByReason[item.reason] = [];
                    }
                    groupedByReason[item.reason].push(item.name);
                });
                
                // הצגת החיילים לפי סיבה
                for (const [reason, soldiers] of Object.entries(groupedByReason)) {
                    reportCard.innerHTML += `
                        <div class="reason-group">
                            <strong>${reason}:</strong> ${soldiers.join(", ")}
                        </div>
                    `;
                }
                
                reportCard.innerHTML += `</div>`;
            } else {
                // תמיכה במבנה הישן (ללא סיבות)
                reportCard.innerHTML += `<p><strong>חיילים חסרים:</strong> ${data.absent.join(", ")}</p>`;
            }
        } else {
            reportCard.innerHTML += `<p><strong>חיילים חסרים:</strong> אין חיילים חסרים</p>`;
        }
        
        // כפתור מחיקה
        const deleteButton = document.createElement("button");
        deleteButton.innerText = "מחק דוח";
        deleteButton.style.backgroundColor = "#dc3545";
        deleteButton.onclick = function() {
            deleteReport(reportId);
        };
        reportCard.appendChild(deleteButton);
        
        reportListDiv.appendChild(reportCard);
    });
}

function updateGlobalStats() {
    const statsDiv = document.getElementById("total-stats");
    
    // איסוף הנתונים
    let totalReports = Object.keys(reports).length;
    let totalAbsent = 0;
    let absentByUnit = {};
    let absentByReason = {
        "בבית": 0,
        "גימלים": 0,
        "משוחרר משמפ": 0
    };
    let mostRecentDate = "";
    
    // חישוב סטטיסטיקות
    for (const unit of Object.keys(soldiers)) {
        absentByUnit[unit] = 0;
    }
    
    // מיון הדוחות לפי תאריך וזמן (החדש ביותר תחילה)
    const sortedReports = Object.entries(reports).sort((a, b) => {
        const dateA = new Date(`${a[1].date}T${a[1].time}`);
        const dateB = new Date(`${b[1].date}T${b[1].time}`);
        return dateB - dateA;
    });
    
    if (sortedReports.length > 0) {
        const latestReport = sortedReports[0][1];
        const dateObj = new Date(latestReport.date);
        mostRecentDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
    }
    
    // חישוב סך כל החיילים החסרים וחלוקה לפי סיבות
    for (const report of Object.values(reports)) {
        if (report.absent) {
            // בדיקה אם המבנה החדש (עם סיבות)
            if (report.absent.length > 0 && typeof report.absent[0] === 'object' && report.absent[0].hasOwnProperty('name')) {
                totalAbsent += report.absent.length;
                
                if (report.unit in absentByUnit) {
                    absentByUnit[report.unit] += report.absent.length;
                }
                
                // ספירת היעדרויות לפי סיבה
                report.absent.forEach(item => {
                    if (item.reason in absentByReason) {
                        absentByReason[item.reason]++;
                    }
                });
            } else {
                // תמיכה במבנה הישן
                totalAbsent += report.absent.length;
                
                if (report.unit in absentByUnit) {
                    absentByUnit[report.unit] += report.absent.length;
                }
            }
        }
    }
    
    // הצגת הסטטיסטיקות
    statsDiv.innerHTML = `
        <p><strong>סך הכל דוחות:</strong> ${totalReports}</p>
        <p><strong>סך הכל חיילים חסרים:</strong> ${totalAbsent}</p>
    `;
    
    if (mostRecentDate) {
        statsDiv.innerHTML += `<p><strong>תאריך דיווח אחרון:</strong> ${mostRecentDate}</p>`;
    }
    
    statsDiv.innerHTML += `<p><strong>חסרים לפי מחלקה:</strong></p>`;
    
    for (const [unit, count] of Object.entries(absentByUnit)) {
        if (count > 0) {
            statsDiv.innerHTML += `<p>${unit}: ${count}</p>`;
        }
    }
    
    // הוספת סטטיסטיקות לפי סיבה
    statsDiv.innerHTML += `<p><strong>חסרים לפי סיבה:</strong></p>`;
    
    let hasReasonStats = false;
    for (const [reason, count] of Object.entries(absentByReason)) {
        if (count > 0) {
            statsDiv.innerHTML += `<p>${reason}: ${count}</p>`;
            hasReasonStats = true;
        }
    }
    
    if (!hasReasonStats) {
        statsDiv.innerHTML += `<p><em>אין נתונים</em></p>`;
    }
}

// פונקציות גיבוי ושחזור
function backupData() {
    // בדיקה אם המשתמש מחובר
    if (!isLoggedIn) {
        alert("עליך להתחבר למערכת כדי ליצור גיבוי");
        return;
    }
    
    const dataStr = JSON.stringify(reports);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `attendance_backup_${new Date().toLocaleDateString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    alert("גיבוי הנתונים הושלם בהצלחה!");
}

function restoreData() {
    // בדיקה אם המשתמש מחובר
    if (!isLoggedIn) {
        alert("עליך להתחבר למערכת כדי לשחזר גיבוי");
        return;
    }
    
    if (!confirm("פעולה זו תחליף את כל הנתונים הקיימים במערכת. האם להמשיך?")) {
        return;
    }
    
    const password = prompt("הכנס סיסמת שחזור:");
    if (password !== "eadmin") {
        alert("סיסמה שגויה!");
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = readerEvent => {
            try {
                const content = readerEvent.target.result;
                const importedReports = JSON.parse(content);
                
                // בדיקת תקינות הנתונים
                let isValidData = true;
                for (const key in importedReports) {
                    const report = importedReports[key];
                    if (!report.date || !report.time || !report.unit) {
                        isValidData = false;
                        break;
                    }
                }
                
                if (!isValidData) {
                    alert("הקובץ אינו בפורמט תקין של גיבוי דוחות נוכחות.");
                    return;
                }
                
                // עדכון המשתנה הגלובלי
                reports = importedReports;
                
                // שמירה ב-Firebase
                database.ref('reports').set(reports)
                    .then(() => {
                        // שמירה מקומית
                        localStorage.setItem('attendanceReports', content);
                        renderReportList();
                        updateGlobalStats();
                        alert('נתונים שוחזרו בהצלחה!');
                    })
                    .catch(error => {
                        console.error("שגיאה בשמירת נתונים מיובאים ב-Firebase:", error);
                        
                        // שמירה מקומית בכל מקרה
                        localStorage.setItem('attendanceReports', content);
                        renderReportList();
                        updateGlobalStats();
                        
                        alert('הנתונים שוחזרו למכשיר, אך התרחשה שגיאה בשמירה בענן: ' + error.message);
                    });
                    
            } catch (error) {
                alert('שגיאה בשחזור הנתונים: ' + error.message);
            }
        };
        
        reader.readAsText(file, 'UTF-8');
    };
    
    input.click();
}

function exportToExcel() {
    // בדיקה אם המשתמש מחובר
    if (!isLoggedIn) {
        alert("עליך להתחבר למערכת כדי לייצא נתונים");
        return;
    }
    
    // בדיקת אם ישנן דוחות לייצוא
    if (Object.keys(reports).length === 0) {
        alert("אין דוחות לייצוא.");
        return;
    }
    
    try {
        // יצירת HTML עם פונט Arial
        let htmlContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="he">
            <head>
                <meta charset="UTF-8">
                <title>דוח נוכחות</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        direction: rtl;
                        text-align: right;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-bottom: 20px;
                        font-family: Arial, sans-serif;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        font-family: Arial, sans-serif;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    h1, h2, h3 {
                        font-family: Arial, sans-serif;
                    }
                    .report-header {
                        margin-top: 20px;
                        margin-bottom: 10px;
                        font-weight: bold;
                        font-size: 16px;
                    }
                    .subtitle {
                        margin-bottom: 15px;
                        color: #555;
                    }
                </style>
            </head>
            <body>
                <h1>דוח נוכחות</h1>
        `;
        
        // מיון הדוחות לפי תאריך (מהחדש לישן)
        const sortedReports = Object.values(reports).sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateB - dateA;
        });
        
        // יצירת אובייקט לאיסוף נתונים על חיילים חסרים
        const allAbsentSoldiers = {};
        
        // מעבר על כל הדוחות ויצירת הנתונים
        sortedReports.forEach(report => {
            const dateObj = new Date(report.date);
            const formattedDate = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.${dateObj.getFullYear()}`;
            
            // הוספת כותרת לדוח
            htmlContent += `
                <div class="report-header">דוח נוכחות - ${formattedDate} ${report.time}</div>
                <div class="subtitle">מחלקה: ${report.unit}</div>
            `;
            
            // רשימת חיילים חסרים
            if (report.absent && report.absent.length > 0) {
                htmlContent += `
                    <h3>חיילים חסרים:</h3>
                    <table>
                        <tr>
                            <th>שם החייל</th>
                            <th>סיבת היעדרות</th>
                        </tr>
                `;
                
                // בדיקה אם מבנה חדש (עם סיבות)
                if (typeof report.absent[0] === 'object' && report.absent[0].hasOwnProperty('name')) {
                    report.absent.forEach(item => {
                        // תיקון הטקסט "משוחרר" ל"משוחרר משמפ"
                        let reason = item.reason || "לא צוין";
                        if (reason === "משוחרר") {
                            reason = "משוחרר משמפ";
                        }
                        
                        // הוספה לסיכום הכללי
                        if (!allAbsentSoldiers[item.name]) {
                            allAbsentSoldiers[item.name] = {
                                unit: report.unit,
                                reasons: {}
                            };
                        }
                        
                        if (!allAbsentSoldiers[item.name].reasons[reason]) {
                            allAbsentSoldiers[item.name].reasons[reason] = 0;
                        }
                        allAbsentSoldiers[item.name].reasons[reason]++;
                        
                        // הוספה ל-HTML
                        htmlContent += `
                            <tr>
                                <td>${item.name}</td>
                                <td>${reason}</td>
                            </tr>
                        `;
                    });
                } else {
                    // תמיכה במבנה ישן
                    report.absent.forEach(name => {
                        const reason = "לא צוין";
                        
                        // הוספה לסיכום הכללי
                        if (!allAbsentSoldiers[name]) {
                            allAbsentSoldiers[name] = {
                                unit: report.unit,
                                reasons: { "לא צוין": 0 }
                            };
                        }
                        allAbsentSoldiers[name].reasons["לא צוין"]++;
                        
                        // הוספה ל-HTML
                        htmlContent += `
                            <tr>
                                <td>${name}</td>
                                <td>${reason}</td>
                            </tr>
                        `;
                    });
                }
                
                htmlContent += `</table>`;
            } else {
                htmlContent += `<p>אין חיילים חסרים</p>`;
            }
            
            htmlContent += `<hr>`;
        });
        
        // הוספת סיכום כללי
        htmlContent += `
            <h2>סיכום נוכחות כללי</h2>
            
            <h3>חיילים חסרים - סיכום</h3>
        `;
        
        if (Object.keys(allAbsentSoldiers).length === 0) {
            htmlContent += `<p>אין חיילים חסרים בתקופה זו</p>`;
        } else {
            htmlContent += `
                <table>
                    <tr>
                        <th>שם החייל</th>
                        <th>מחלקה</th>
                        <th>סיבות היעדרות</th>
                    </tr>
            `;
            
            // מיון החיילים לפי שם
            const sortedAbsentSoldiers = Object.keys(allAbsentSoldiers).sort();
            
            sortedAbsentSoldiers.forEach(soldierName => {
                const soldierData = allAbsentSoldiers[soldierName];
                const reasonsText = Object.entries(soldierData.reasons)
                    .map(([reason, count]) => {
                        // תיקון הטקסט "משוחרר" ל"משוחרר משמפ"
                        if (reason === "משוחרר") {
                            reason = "משוחרר משמפ";
                        }
                        // הסרת מספר הפעמים כפי שביקש המשתמש
                        return reason;
                    })
                    .join(', ');
                    
                htmlContent += `
                    <tr>
                        <td>${soldierName}</td>
                        <td>${soldierData.unit}</td>
                        <td>${reasonsText}</td>
                    </tr>
                `;
            });
            
            htmlContent += `</table>`;
        }
        
        // מידע על כל המחלקות
        const units = ["מחלקה 1", "מחלקה 2", "מחלקה 3", "מפלג", "מסופחים"];
        
        units.forEach(unit => {
            htmlContent += `
                <h3>מחלקה: ${unit}</h3>
            `;
            
            // רשימת כל החיילים במחלקה
            const unitSoldiers = soldiers[unit] || [];
            if (unitSoldiers.length === 0) {
                htmlContent += `<p>אין חיילים רשומים במחלקה זו</p>`;
            } else {
                htmlContent += `
                    <table>
                        <tr>
                            <th>שם החייל</th>
                            <th>סטטוס</th>
                        </tr>
                `;
                
                unitSoldiers.sort().forEach(soldier => {
                    let status = "נוכח";
                    
                    // בדיקה אם החייל מופיע ברשימת החסרים
                    if (allAbsentSoldiers[soldier]) {
                        const reasonsText = Object.entries(allAbsentSoldiers[soldier].reasons)
                            .map(([reason, count]) => {
                                // תיקון הטקסט "משוחרר" ל"משוחרר משמפ"
                                if (reason === "משוחרר") {
                                    reason = "משוחרר משמפ";
                                }
                                // הסרת מספר הפעמים כפי שביקש המשתמש
                                return reason;
                            })
                            .join(', ');
                        status = reasonsText;
                    }
                    
                    htmlContent += `
                        <tr>
                            <td>${soldier}</td>
                            <td>${status}</td>
                        </tr>
                    `;
                });
                
                htmlContent += `</table>`;
            }
        });
        
        // סגירת תגי ה-HTML
        htmlContent += `
            </body>
            </html>
        `;
        
        // יצירת שם קובץ תקין
        const today = new Date();
        const formattedDate = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
        const fileName = `דוח_נוכחות_${formattedDate}.html`;
        
        // יצירת Blob עם תוכן HTML
        const blob = new Blob([htmlContent], { 
            type: 'text/html;charset=utf-8' 
        });
        
        // יצירת URL לקובץ
        const url = URL.createObjectURL(blob);
        
        // יצירת קישור להורדה ולחיצה עליו
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log("קובץ HTML נוצר בהצלחה");
        alert("דוח נוצר בפורמט HTML עם פונט Arial. אפשר לפתוח אותו ישירות בדפדפן או באקסל.");
    } catch (error) {
        console.error("שגיאה בייצוא ל-HTML:", error);
        alert("אירעה שגיאה בייצוא לקובץ. אנא נסה שנית.");
    }
}

// פונקציית עזר להכנת טקסט לפורמט CSV
function escapeCSV(text) {
    if (text === null || text === undefined) {
        return '';
    }
    // מטפל במחרוזות עם פסיקים או ציטוטים
    const textStr = String(text);
    return textStr.replace(/"/g, '""');
}