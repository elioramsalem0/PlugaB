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
const ABSENCE_REASONS = ["בבית", "גימלים", "יום אחרון לשמפ", "משוחרר משמפ"];

// רשימת החיילים במחלקות
const soldiers = {
    "מחלקה 1": ["גיא פרל","אבנר לוי", "איגור חביבובלין", "אמיר דו בלוך", "אסף אופיר", "הלל בנאמו", "חביב דדון", "לוי יצחק דובאוו", "לירון פוריאן", "פבל אבירם", "עדן מור"],
    "מחלקה 2": ["אופיר אלזרט","מנחם קרול ג׳קי","שושנה מולר","אליהו ברקלי", "אוהד מאיר", "אלכסנדר ליטבין", "אסיף יו סבאג", "דביר יעקב", "דניאל זוקובסקי", "חן בן צבי", "ערן יופה", "רפאל אביטבול", "תומר צביון", "עליסיה טרשצנקו"],
    "מחלקה 3": ["הגר אלון","יובל שלום","דניאל יונתן", "אביבה קללאו", "אופיר מזרחי", "דקל חן", "מאור גבאי", "נועם גזית", "רקפת זיו", "שיר דקלו"],
    "מפלג": ["אליאור אמסלם", "ג'סי שלו", "הגר שוקר", "מיקי ביתן", "עומר אנטמן", "עמית שחר", "רועי דנינו", "רן בן טוב", "שקד קסלר", "ג'קי מוקמל", "איתי מלטבשי"],
    "חמליסטים": ["אלי מור","אביב לוי","ולדיסלב שבצ׳נקו","ליז קיקושווילי","עידן מלול"]
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
    const modal = document.getElementById("absence-reason-modal");
    const closeBtn = document.querySelector(".close-modal");
    const saveBtn = document.getElementById("save-reason-btn");
    const customReasonContainer = document.getElementById("custom-reason-container");
    const reasonRadios = document.querySelectorAll('input[name="absence-reason"]');
    
    // סגירת המודל באמצעות כפתור הסגירה
    closeBtn.addEventListener("click", function() {
        modal.style.display = "none";
    });
    
    // סגירת המודל בלחיצה מחוץ לתוכן
    window.addEventListener("click", function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });
    
    // טיפול בבחירת סיבה מותאמת אישית
    reasonRadios.forEach(radio => {
        radio.addEventListener("change", function() {
            if (this.value === "אחר") {
                customReasonContainer.style.display = "block";
            } else {
                customReasonContainer.style.display = "none";
            }
        });
    });
    
    // שמירת הסיבה שנבחרה
    saveBtn.addEventListener("click", function() {
        const soldierName = document.getElementById("current-soldier-name").textContent;
        let reasonValue = document.querySelector('input[name="absence-reason"]:checked').value;
        
        // אם נבחר "אחר", השתמש בערך שהוזן
        if (reasonValue === "אחר") {
            const customReason = document.getElementById("custom-reason").value.trim();
            if (customReason) {
                reasonValue = customReason;
            } else {
                alert("אנא הזן סיבה מותאמת אישית");
                return;
            }
        }
        
        // שמירת החייל ברשימת החסרים
        if (!absentSoldiers[soldierName]) {
            absentSoldiers[soldierName] = reasonValue;
        } else {
            absentSoldiers[soldierName] = reasonValue;
        }
        
        // עדכון תצוגת החיילים הנבחרים
        updateSelectedSoldiers();
        
        // איפוס שדה הסיבה המותאמת אישית
        document.getElementById("custom-reason").value = "";
        customReasonContainer.style.display = "none";
        
        // סגירת המודל
        modal.style.display = "none";
    });
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
        
        // מזהה הדוח הקיים
        const existingReportId = `${selectedDate}_${selectedTime}_${selectedUnit}`.replace(/[\s:]/g, '_');
        const existingReport = reports[existingReportId];
        
        // עדכון דוח קיים במקום להחליף אותו לחלוטין
        const currentUserRef = database.ref('users/' + auth.currentUser.uid);
        currentUserRef.once('value')
            .then(snapshot => {
                const userData = snapshot.val() || {};
                const firstName = userData.firstName || '';
                const lastName = userData.lastName || '';
                const fullName = firstName && lastName ? `${firstName} ${lastName}` : auth.currentUser.email;
                
                // יצירת מבנה נתונים עבור החיילים החסרים החדשים
                const updatedAbsentData = [...existingReport.absent || []];
                
                // מיפוי החיילים הקיימים לפי שם
                const existingAbsentMap = {};
                updatedAbsentData.forEach((soldier, index) => {
                    if (typeof soldier === 'object' && soldier.hasOwnProperty('name')) {
                        existingAbsentMap[soldier.name] = index;
                    } else if (typeof soldier === 'string') {
                        existingAbsentMap[soldier] = index;
                    }
                });
                
                // הוספת או עדכון חיילים חסרים
                for (const [soldier, reason] of Object.entries(absentSoldiers)) {
                    if (existingAbsentMap.hasOwnProperty(soldier)) {
                        // עדכון סיבת היעדרות של חייל קיים
                        const index = existingAbsentMap[soldier];
                        if (typeof updatedAbsentData[index] === 'object') {
                            updatedAbsentData[index].reason = reason;
                        } else {
                            // המרת רשומה ישנה לפורמט החדש
                            updatedAbsentData[index] = {
                                name: soldier,
                                reason: reason
                            };
                        }
                    } else {
                        // הוספת חייל חדש
                        updatedAbsentData.push({
                            name: soldier,
                            reason: reason
                        });
                    }
                }
                
                // עדכון חותמת זמן העדכון
                const updatedTimestamp = new Date().toISOString();
                
                // עדכון אובייקט הדוח
                const updatedReportData = { 
                    ...existingReport,
                    absent: updatedAbsentData,
                    lastUpdated: updatedTimestamp,
                    updatedBy: fullName
                };
                
                // עדכון המשתנה הגלובלי
                reports[existingReportId] = updatedReportData;
                
                // ניסיון לשמור ב-Firebase
                database.ref('reports/' + existingReportId).set(updatedReportData)
                    .then(() => {
                        // שמירת הדוחות לאחסון מקומי כגיבוי
                        localStorage.setItem('attendanceReports', JSON.stringify(reports));
                        
                        alert("הדיווח עודכן בהצלחה!");
                        
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
                        
                        // עדכון רשימת הדוחות
                        renderReportList();
                    })
                    .catch(error => {
                        console.error("שגיאה בשמירת נתונים ב-Firebase:", error);
                        alert("אירעה שגיאה בעדכון הדיווח: " + error.message);
                    });
            })
            .catch(error => {
                console.error("שגיאה בקבלת מידע המשתמש:", error);
                alert("אירעה שגיאה בקבלת פרטי המשתמש: " + error.message);
            });
            
        return;
    }
    
    // המשך הפעולה הרגילה עבור דוח חדש
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
                    renderReportList();
                    updateGlobalStats();
                    
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
        
        let updatedByText = "";
        if (data.updatedBy && data.lastUpdated) {
            const updateDate = new Date(data.lastUpdated);
            const formattedUpdateDate = `${updateDate.getDate()}/${updateDate.getMonth() + 1}/${updateDate.getFullYear()} ${updateDate.getHours()}:${String(updateDate.getMinutes()).padStart(2, '0')}`;
            updatedByText = `<small class="update-info">עודכן לאחרונה ע"י: ${data.updatedBy} (${formattedUpdateDate})</small>`;
        }
        
        reportCard.innerHTML = `
            <h3>${data.unit} - ${formattedDate} ${data.time}</h3>
            <p><strong>מספר חיילים חסרים:</strong> ${data.absent ? data.absent.length : 0}</p>
            ${createdByText}
            ${updatedByText}
        `;
        
        // בדיקה אם יש חיילים חסרים ובאיזה פורמט (מערך רגיל או מבנה נתונים מורחב)
        if (data.absent && data.absent.length > 0) {
            // בדיקה אם המבנה החדש (עם סיבות)
            if (typeof data.absent[0] === 'object' && data.absent[0].hasOwnProperty('name')) {
                const absentListDiv = document.createElement('div');
                absentListDiv.classList.add("absent-soldiers-list");
                
                // מיון לפי סיבת היעדרות
                const groupedByReason = {};
                data.absent.forEach(item => {
                    if (!groupedByReason[item.reason]) {
                        groupedByReason[item.reason] = [];
                    }
                    groupedByReason[item.reason].push(item);
                });
                
                // הצגת החיילים לפי סיבה
                for (const [reason, soldiers] of Object.entries(groupedByReason)) {
                    const reasonGroup = document.createElement('div');
                    reasonGroup.classList.add("reason-group");
                    reasonGroup.innerHTML = `<strong>${reason}:</strong> `;
                    
                    soldiers.forEach((soldierItem, index) => {
                        const soldierSpan = document.createElement('span');
                        soldierSpan.classList.add('soldier-with-actions');
                        
                        // טקסט החייל עם אפשרויות עריכה ומחיקה
                        soldierSpan.innerHTML = `
                            <span class="soldier-name">${soldierItem.name}</span>
                            <span class="soldier-actions">
                                <button class="edit-soldier-btn" title="ערוך סטטוס">✏️</button>
                                <button class="delete-soldier-btn" title="הסר מהדיווח">❌</button>
                            </span>
                        `;
                        
                        // טיפול באירוע לחיצה על כפתור המחיקה
                        const deleteBtn = soldierSpan.querySelector('.delete-soldier-btn');
                        deleteBtn.addEventListener('click', function() {
                            if (confirm(`האם אתה בטוח שברצונך להסיר את ${soldierItem.name} מהדיווח?`)) {
                                removeSoldierFromReport(reportId, soldierItem.name);
                            }
                        });
                        
                        // טיפול באירוע לחיצה על כפתור העריכה
                        const editBtn = soldierSpan.querySelector('.edit-soldier-btn');
                        editBtn.addEventListener('click', function() {
                            editSoldierStatus(reportId, soldierItem.name, soldierItem.reason);
                        });
                        
                        reasonGroup.appendChild(soldierSpan);
                        
                        // הוספת פסיק בין החיילים, למעט האחרון
                        if (index < soldiers.length - 1) {
                            reasonGroup.appendChild(document.createTextNode(', '));
                        }
                    });
                    
                    absentListDiv.appendChild(reasonGroup);
                }
                
                reportCard.appendChild(absentListDiv);
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

// פונקציה להסרת חייל מדוח קיים
function removeSoldierFromReport(reportId, soldierName) {
    if (!reports[reportId]) {
        alert("הדוח לא נמצא.");
        return;
    }
    
    const report = reports[reportId];
    
    if (!report.absent || report.absent.length === 0) {
        alert("אין חיילים חסרים בדוח זה.");
        return;
    }
    
    // חיפוש החייל במערך החסרים
    const updatedAbsent = report.absent.filter(item => {
        if (typeof item === 'object' && item.hasOwnProperty('name')) {
            return item.name !== soldierName;
        }
        return item !== soldierName;
    });
    
    // עדכון המשתנה הגלובלי
    report.absent = updatedAbsent;
    
    // מידע על המשתמש שביצע את השינוי
    const fullName = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : "משתמש לא מזוהה";
    
    // עדכון חותמת זמן עדכון
    report.lastUpdated = new Date().toISOString();
    report.updatedBy = fullName;
    
    // עדכון הדוח בפיירבייס
    database.ref('reports/' + reportId).set(report)
        .then(() => {
            // שמירת הדוחות לאחסון מקומי כגיבוי
            localStorage.setItem('attendanceReports', JSON.stringify(reports));
            alert(`${soldierName} הוסר בהצלחה מהדיווח.`);
            renderReportList();
        })
        .catch(error => {
            console.error("שגיאה בעדכון הדוח:", error);
            alert("אירעה שגיאה בהסרת החייל מהדיווח: " + error.message);
        });
}

// פונקציה לעריכת סטטוס חייל
function editSoldierStatus(reportId, soldierName, currentReason) {
    // פתיחת חלון מודאלי לבחירת סיבת היעדרות
    const modal = document.getElementById("absence-reason-modal");
    const currentSoldierNameEl = document.getElementById("current-soldier-name");
    
    if (!modal || !currentSoldierNameEl) {
        alert("שגיאה בטעינת חלון העריכה");
        return;
    }
    
    // מילוי שם החייל בחלון המודאלי
    currentSoldierNameEl.textContent = soldierName;
    
    // בחירת הסיבה הנוכחית במודל
    const reasonOptions = document.getElementsByName("absence-reason");
    let customReasonInput = document.getElementById("custom-reason");
    let customReasonContainer = document.getElementById("custom-reason-container");
    
    // ברירת מחדל - ללא בחירה
    let reasonSelected = false;
    
    // בדיקת הסיבה הנוכחית והגדרתה בטופס
    for (const option of reasonOptions) {
        if (option.value === currentReason) {
            option.checked = true;
            reasonSelected = true;
            
            // הצגת הטקסט המותאם אישית אם נבחרה האפשרות 'אחר'
            if (option.value === "אחר" && customReasonContainer) {
                customReasonContainer.style.display = "block";
                
                if (customReasonInput) {
                    customReasonInput.value = currentReason === "אחר" ? "" : currentReason;
                }
            }
            
            break;
        }
    }
    
    // אם לא נמצאה התאמה, זוהי סיבה מותאמת אישית
    if (!reasonSelected && reasonOptions.length > 0) {
        // בחירת האפשרות 'אחר'
        for (const option of reasonOptions) {
            if (option.value === "אחר") {
                option.checked = true;
                
                if (customReasonContainer) {
                    customReasonContainer.style.display = "block";
                }
                
                if (customReasonInput) {
                    customReasonInput.value = currentReason;
                }
                
                break;
            }
        }
    }
    
    // אירוע לחיצה על כפתור שמירה
    const saveButton = document.getElementById("save-reason-btn");
    if (saveButton) {
        // הסרת אירועים קודמים אם קיימים
        const newSaveButton = saveButton.cloneNode(true);
        saveButton.parentNode.replaceChild(newSaveButton, saveButton);
        
        newSaveButton.addEventListener("click", function() {
            // קבלת הסיבה שנבחרה
            let selectedReason = "";
            for (const option of reasonOptions) {
                if (option.checked) {
                    selectedReason = option.value;
                    break;
                }
            }
            
            // אם נבחר 'אחר', בדיקה אם הוזן טקסט
            if (selectedReason === "אחר" && customReasonInput && customReasonInput.value.trim() !== "") {
                selectedReason = customReasonInput.value.trim();
            }
            
            // עדכון הסטטוס בדוח
            updateSoldierStatus(reportId, soldierName, selectedReason);
            
            // סגירת המודאל
            modal.style.display = "none";
        });
    }
    
    // הצגת החלון המודאלי
    modal.style.display = "block";
    
    // סגירת המודאל בלחיצה על X
    const closeButton = modal.querySelector(".close-modal");
    if (closeButton) {
        closeButton.onclick = function() {
            modal.style.display = "none";
        };
    }
    
    // סגירת המודאל בלחיצה מחוץ לחלון
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
}

// פונקציה לעדכון סטטוס חייל
function updateSoldierStatus(reportId, soldierName, newReason) {
    if (!reports[reportId]) {
        alert("הדוח לא נמצא.");
        return;
    }
    
    const report = reports[reportId];
    
    if (!report.absent || report.absent.length === 0) {
        alert("אין חיילים חסרים בדוח זה.");
        return;
    }
    
    // עדכון סיבת ההיעדרות
    let updated = false;
    
    for (let i = 0; i < report.absent.length; i++) {
        const item = report.absent[i];
        
        if ((typeof item === 'object' && item.name === soldierName) || 
            (typeof item === 'string' && item === soldierName)) {
            
            // עדכון או המרה למבנה החדש
            if (typeof item === 'object') {
                report.absent[i].reason = newReason;
            } else {
                report.absent[i] = {
                    name: soldierName,
                    reason: newReason
                };
            }
            
            updated = true;
            break;
        }
    }
    
    if (!updated) {
        alert(`לא נמצא החייל ${soldierName} בדוח.`);
        return;
    }
    
    // מידע על המשתמש שביצע את השינוי
    const fullName = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : "משתמש לא מזוהה";
    
    // עדכון חותמת זמן עדכון
    report.lastUpdated = new Date().toISOString();
    report.updatedBy = fullName;
    
    // עדכון הדוח בפיירבייס
    database.ref('reports/' + reportId).set(report)
        .then(() => {
            // שמירת הדוחות לאחסון מקומי כגיבוי
            localStorage.setItem('attendanceReports', JSON.stringify(reports));
            alert(`הסטטוס של ${soldierName} עודכן בהצלחה ל-${newReason}.`);
            renderReportList();
        })
        .catch(error => {
            console.error("שגיאה בעדכון הדוח:", error);
            alert("אירעה שגיאה בעדכון סטטוס החייל: " + error.message);
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
        "יום אחרון לשמפ": 0,
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
        // הודעה למשתמש שהייצוא מתבצע
        alert("מכין דוח לייצוא, הקובץ יורד בקרוב...");
        
        // ארגון הדוחות לפי תאריכים
        const reportsByDate = {};
        
        // מיון הדוחות לפי תאריך
        Object.values(reports).forEach(report => {
            if (!reportsByDate[report.date]) {
                reportsByDate[report.date] = [];
            }
            reportsByDate[report.date].push(report);
        });
        
        // מיון התאריכים מהחדש לישן
        const sortedDates = Object.keys(reportsByDate).sort().reverse();
        
        // יצירת שם קובץ
        const today = new Date();
        const formattedToday = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
        const fileName = `דוח_נוכחות_${formattedToday}.xls`;
        
        // יצירת תוכן ה-XML עבור הקובץ
        let xlsContent = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>מערכת דיווח נוכחות</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <OfficeDocumentSettings xmlns="urn:schemas-microsoft-com:office:office">
  <AllowPNG/>
 </OfficeDocumentSettings>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <WindowHeight>9000</WindowHeight>
  <WindowWidth>13860</WindowWidth>
  <WindowTopX>0</WindowTopX>
  <WindowTopY>0</WindowTopY>
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom" ss:Horizontal="Right"/>
   <Borders/>
   <Font ss:FontName="Arial" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="s62">
   <Alignment ss:Horizontal="Center" ss:Vertical="Bottom"/>
   <Font ss:FontName="Arial" x:Family="Swiss" ss:Size="14" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="s63">
   <Alignment ss:Horizontal="Right" ss:Vertical="Bottom"/>
   <Font ss:FontName="Arial" x:Family="Swiss" ss:Size="12" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="s64">
   <Alignment ss:Horizontal="Right" ss:Vertical="Bottom"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="s65">
   <Alignment ss:Horizontal="Right" ss:Vertical="Bottom"/>
   <Font ss:FontName="Arial" x:Family="Swiss" ss:Size="12" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="s66">
   <Alignment ss:Horizontal="Right" ss:Vertical="Bottom"/>
   <Font ss:FontName="Arial" x:Family="Swiss" ss:Size="12" ss:Color="#000000"/>
   <Interior ss:Color="#E6E6E6" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>`;
        
        // הוספת הגיליונות לקובץ
        sortedDates.forEach((date, index) => {
            const dateObj = new Date(date);
            const formattedDate = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.${dateObj.getFullYear()}`;
            const dailyReports = reportsByDate[date];
            
            // לכל תאריך נוסיף גיליון נפרד
            xlsContent += `
 <Worksheet ss:Name="דוח ${formattedDate}">
  <Table ss:ExpandedColumnCount="10" ss:ExpandedRowCount="1000" x:FullColumns="1" x:FullRows="1" ss:DefaultColumnWidth="70" ss:DefaultRowHeight="15">
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Row ss:Height="30">
    <Cell ss:StyleID="s62" ss:MergeAcross="9"><Data ss:Type="String">דוח נוכחות - ${formattedDate}</Data></Cell>
   </Row>
   <Row ss:Height="5">
    <Cell ss:MergeAcross="9"><Data ss:Type="String"></Data></Cell>
   </Row>`;
            
            // אובייקט לאיסוף נתונים על חיילים חסרים ביום זה
            const dailyAbsentSoldiers = {};
            
            // הוספת הדוחות של היום הנוכחי
            let currentRow = 3; // התחלנו מ-3 בגלל הכותרת וההפרדה
            
            dailyReports.forEach(report => {
                // כותרת לדוח
                xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s65" ss:MergeAcross="9"><Data ss:Type="String">שעה: ${report.time} - מחלקה: ${report.unit}</Data></Cell>
   </Row>`;
                currentRow++;
                
                // כותרות הטבלה
                xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s63"><Data ss:Type="String">שם החייל</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String">סיבת היעדרות</Data></Cell>
   </Row>`;
                currentRow++;
                
                // רשימת חיילים חסרים
                if (report.absent && report.absent.length > 0) {
                    // בדיקה אם מבנה חדש (עם סיבות)
                    if (typeof report.absent[0] === 'object' && report.absent[0].hasOwnProperty('name')) {
                        report.absent.forEach(item => {
                            // תיקון הטקסט "משוחרר" ל"משוחרר משמפ"
                            let reason = item.reason || "לא צוין";
                            if (reason === "משוחרר") {
                                reason = "משוחרר משמפ";
                            }
                            
                            // הוספת החייל לרשימת החסרים היומית
                            if (!dailyAbsentSoldiers[item.name]) {
                                dailyAbsentSoldiers[item.name] = {
                                    unit: report.unit,
                                    reasons: []
                                };
                            }
                            
                            if (!dailyAbsentSoldiers[item.name].reasons.includes(reason)) {
                                dailyAbsentSoldiers[item.name].reasons.push(reason);
                            }
                            
                            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s64"><Data ss:Type="String">${item.name}</Data></Cell>
    <Cell ss:StyleID="s64"><Data ss:Type="String">${reason}</Data></Cell>
   </Row>`;
                            currentRow++;
                        });
                    } else {
                        // תמיכה במבנה ישן
                        report.absent.forEach(name => {
                            const reason = "לא צוין";
                            
                            // הוספת החייל לרשימת החסרים היומית
                            if (!dailyAbsentSoldiers[name]) {
                                dailyAbsentSoldiers[name] = {
                                    unit: report.unit,
                                    reasons: ["לא צוין"]
                                };
                            }
                            
                            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s64"><Data ss:Type="String">${name}</Data></Cell>
    <Cell ss:StyleID="s64"><Data ss:Type="String">${reason}</Data></Cell>
   </Row>`;
                            currentRow++;
                        });
                    }
                } else {
                    xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:MergeAcross="1" ss:StyleID="s64"><Data ss:Type="String">אין חיילים חסרים</Data></Cell>
   </Row>`;
                    currentRow++;
                }
                
                // רווח בין הדוחות
                xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:MergeAcross="9"><Data ss:Type="String"></Data></Cell>
   </Row>`;
                currentRow++;
            });
            
            // הוספת סיכום יומי
            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s65" ss:MergeAcross="9"><Data ss:Type="String">סיכום יומי - ${formattedDate}</Data></Cell>
   </Row>`;
            currentRow++;
            
            if (Object.keys(dailyAbsentSoldiers).length === 0) {
                xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:MergeAcross="2" ss:StyleID="s64"><Data ss:Type="String">אין חיילים חסרים ביום זה</Data></Cell>
   </Row>`;
                currentRow++;
            } else {
                // כותרות הטבלה
                xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s63"><Data ss:Type="String">שם החייל</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String">מחלקה</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String">סיבות היעדרות</Data></Cell>
   </Row>`;
                currentRow++;
                
                // מיון החיילים לפי שם
                const sortedAbsentSoldiers = Object.keys(dailyAbsentSoldiers).sort();
                
                sortedAbsentSoldiers.forEach(soldierName => {
                    const soldierData = dailyAbsentSoldiers[soldierName];
                    const reasonsText = soldierData.reasons.join(', ');
                    
                    xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s64"><Data ss:Type="String">${soldierName}</Data></Cell>
    <Cell ss:StyleID="s64"><Data ss:Type="String">${soldierData.unit}</Data></Cell>
    <Cell ss:StyleID="s64"><Data ss:Type="String">${reasonsText}</Data></Cell>
   </Row>`;
                    currentRow++;
                });
            }
            
            // רווח אחרי הסיכום
            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:MergeAcross="9"><Data ss:Type="String"></Data></Cell>
   </Row>`;
            currentRow++;
            
            // מידע על כל המחלקות ביום הנוכחי
            const units = ["מחלקה 1", "מחלקה 2", "מחלקה 3", "מפלג", "חמליסטים"];
            
            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s65" ss:MergeAcross="9"><Data ss:Type="String">פירוט מצבה יומית</Data></Cell>
   </Row>`;
            currentRow++;
            
            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s63"><Data ss:Type="String">מחלקה</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String">נוכחים</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String">חסרים</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String">סה"כ</Data></Cell>
   </Row>`;
            currentRow++;
            
            let totalPresent = 0;
            let totalAbsent = 0;
            let totalSoldiers = 0;
            
            units.forEach(unit => {
                // חיילים ביחידה
                const unitSoldiers = soldiers[unit] || [];
                const unitSoldiersCount = unitSoldiers.length;
                
                // מספר החיילים החסרים ביחידה
                let absentCount = 0;
                Object.keys(dailyAbsentSoldiers).forEach(name => {
                    if (dailyAbsentSoldiers[name].unit === unit) {
                        absentCount++;
                    }
                });
                
                // מספר החיילים הנוכחים
                const presentCount = unitSoldiersCount - absentCount;
                
                // הוספת נתונים לסיכום הכללי
                totalPresent += presentCount;
                totalAbsent += absentCount;
                totalSoldiers += unitSoldiersCount;
                
                xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s64"><Data ss:Type="String">${unit}</Data></Cell>
    <Cell ss:StyleID="s64"><Data ss:Type="Number">${presentCount}</Data></Cell>
    <Cell ss:StyleID="s64"><Data ss:Type="Number">${absentCount}</Data></Cell>
    <Cell ss:StyleID="s64"><Data ss:Type="Number">${unitSoldiersCount}</Data></Cell>
   </Row>`;
                currentRow++;
            });
            
            // סיכום כללי
            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s66"><Data ss:Type="String">סה"כ</Data></Cell>
    <Cell ss:StyleID="s66"><Data ss:Type="Number">${totalPresent}</Data></Cell>
    <Cell ss:StyleID="s66"><Data ss:Type="Number">${totalAbsent}</Data></Cell>
    <Cell ss:StyleID="s66"><Data ss:Type="Number">${totalSoldiers}</Data></Cell>
   </Row>`;
            currentRow++;
            
            // רווח אחרי הסיכום
            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:MergeAcross="9"><Data ss:Type="String"></Data></Cell>
   </Row>`;
            currentRow++;
            
            // תצוגת סטטוס של כל החיילים
            xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s65" ss:MergeAcross="9"><Data ss:Type="String">רשימת סטטוס חיילים ליום ${formattedDate}</Data></Cell>
   </Row>`;
            currentRow++;
            
            units.forEach(unit => {
                // כותרת מחלקה
                xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s65" ss:MergeAcross="1"><Data ss:Type="String">מחלקה: ${unit}</Data></Cell>
   </Row>`;
                currentRow++;
                
                // רשימת כל החיילים במחלקה
                const unitSoldiers = soldiers[unit] || [];
                if (unitSoldiers.length === 0) {
                    xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:MergeAcross="1" ss:StyleID="s64"><Data ss:Type="String">אין חיילים רשומים במחלקה זו</Data></Cell>
   </Row>`;
                    currentRow++;
                } else {
                    // כותרות הטבלה
                    xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s63"><Data ss:Type="String">שם החייל</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String">סטטוס</Data></Cell>
   </Row>`;
                    currentRow++;
                    
                    unitSoldiers.sort().forEach(soldier => {
                        let status = "נוכח";
                        
                        // בדיקה אם החייל מופיע ברשימת החסרים
                        if (dailyAbsentSoldiers[soldier]) {
                            status = dailyAbsentSoldiers[soldier].reasons.join(', ');
                        }
                        
                        xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:StyleID="s64"><Data ss:Type="String">${soldier}</Data></Cell>
    <Cell ss:StyleID="s64"><Data ss:Type="String">${status}</Data></Cell>
   </Row>`;
                        currentRow++;
                    });
                }
                
                // רווח בין המחלקות
                xlsContent += `
   <Row ss:Index="${currentRow}">
    <Cell ss:MergeAcross="9"><Data ss:Type="String"></Data></Cell>
   </Row>`;
                currentRow++;
            });
            
            // סיום הגיליון
            xlsContent += `
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
    <PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/>
   </PageSetup>
   <Unsynced/>
   <Print>
    <ValidPrinterInfo/>
    <PaperSizeIndex>9</PaperSizeIndex>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <Selected/>
   <Panes>
    <Pane>
     <Number>3</Number>
     <ActiveRow>1</ActiveRow>
     <ActiveCol>1</ActiveCol>
    </Pane>
   </Panes>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
   <x:PageLayoutZoom>0</x:PageLayoutZoom>
   <x:Print>True</x:Print>
  </WorksheetOptions>
 </Worksheet>`;
        });
        
        // סגירת קובץ ה-XML
        xlsContent += `
</Workbook>`;
        
        // יצירת Blob והורדה
        const blob = new Blob([xlsContent], { 
            type: 'application/vnd.ms-excel;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log("קובץ Excel נוצר בהצלחה");
    } catch (error) {
        console.error("שגיאה בייצוא לאקסל:", error);
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
