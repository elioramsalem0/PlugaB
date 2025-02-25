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

// משתנים לסטטוס חיילים
let currentSoldierStatuses = {};
let currentSoldierForStatus = "";

// קוד גישה מיוחד להרשמה - רק מי שיודע אותו יכול להירשם
const SPECIAL_ACCESS_CODE = "plugab2025";

// רשימת החיילים במחלקות
const soldiers = {
    "מחלקה 1": ["אביב לוי", "אבנר לוי", "איגור חביבובלין", "אמיר בלוך", "אסף אופיר", "הלל בנאמו", "חביב דדון", "לוי יצחק דובאוו", "לירון פוריאן", "פבל אבירם", "עדן מור"],
    "מחלקה 2": ["אליהו ברקלי", "אוהד מאיר", "אלכסנדר ליטבין", "אסיף יו סבאג", "ג'קי מוקמל", "דביר יעקב", "דניאל זוקובסקי", "חן בן צבי", "ערן יופה", "רפאל אביטבול", "תומר צביון", "עליסיה טרשצנקו"],
    "מחלקה 3": ["דניאל יונתן", "אביבה קללאו", "אופיר מזרחי", "איתי מלטבשי", "דקל חן", "ולדיסלב שבצ'נקו", "ליז קוקישווילי", "מאור גבאי", "נועם גזית", "עידן מלול", "רקפת זיו", "שיר דקלו"],
    "מפלג": ["אלי מור", "אליאור אמסלם", "ג'סי שלו", "הגר שוקר", "מיקי ביתן", "עומר אנטמן", "עמית שחר", "רועי דנינו", "רן בן טוב", "שקד קסלר"]
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
        
        loadData(); // טעינת המידע לאחר כניסה מוצלחת
    } else {
        // המשתמש לא מחובר
        isLoggedIn = false;
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('main-container').style.display = 'none';
    }
});

// האזנה לשינויים בבחירת הסטטוס
document.getElementById('status-select').addEventListener('change', function() {
    const otherContainer = document.getElementById('other-status-container');
    if (this.value === 'אחר') {
        otherContainer.style.display = 'block';
        document.getElementById('other-status').focus();
    } else {
        otherContainer.style.display = 'none';
    }
});
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
function confirmUnitChange() {
    // בדיקה אם המשתמש מחובר
    if (!isLoggedIn) {
        alert("עליך להתחבר למערכת כדי לבצע פעולה זו");
        document.getElementById('unit').value = document.getElementById('unit').dataset.prevValue || "";
        return;
    }
    
    const selectedLabels = document.querySelectorAll('.soldier-list label.selected');
    
    if (selectedLabels.length > 0) {
        if (confirm("שינוי מחלקה ימחק את הבחירה הנוכחית. האם להמשיך?")) {
            updateSoldiers();
            currentSoldierStatuses = {}; // איפוס סטטוסים בשינוי מחלקה
            updateSoldierStatusList();
        } else {
            // שחזור המחלקה הקודמת
            const prevUnit = document.getElementById('unit').dataset.prevValue || "";
            document.getElementById('unit').value = prevUnit;
            return;
        }
    } else {
        updateSoldiers();
        currentSoldierStatuses = {}; // איפוס סטטוסים בשינוי מחלקה
        updateSoldierStatusList();
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
            label.onclick = function() {
                label.classList.toggle("selected");
                
                if (label.classList.contains("selected")) {
                    // אם החייל נבחר כנעדר, פתח דיאלוג לבחירת סטטוס
                    showStatusDialog(soldier);
                } else {
                    // אם החייל כבר לא נעדר, מחק את הסטטוס שלו
                    delete currentSoldierStatuses[soldier];
                    updateSoldierStatusList();
                }
                
                updateSelectedSoldiers();
            };
            soldiersDiv.appendChild(label);
        });
    }
    
    // ניקוי רשימת החיילים שנבחרו
    updateSelectedSoldiers();
}

function updateSelectedSoldiers() {
    const selectedSoldiers = Array.from(document.querySelectorAll(".soldier-list label.selected")).map(label => label.innerText);
    const selectedSoldiersDiv = document.getElementById("selected-soldiers");
    const absentCountSpan = document.getElementById("absent-count");
    
    selectedSoldiersDiv.innerHTML = "";
    
    if (selectedSoldiers.length) {
        selectedSoldiers.forEach(soldier => {
            const badge = document.createElement("span");
            badge.classList.add("badge");
            badge.innerText = soldier;
            selectedSoldiersDiv.appendChild(badge);
        });
    } else {
        selectedSoldiersDiv.innerHTML = "<em>אין חיילים נעדרים</em>";
    }
    
    absentCountSpan.innerText = selectedSoldiers.length;
    
    // הצג/הסתר את אזור הסטטוס בהתאם למספר החיילים הנעדרים
    document.getElementById('status-area').style.display = selectedSoldiers.length > 0 ? 'block' : 'none';
}

// פונקציות לטיפול בסטטוס חיילים
function showStatusDialog(soldierName) {
    currentSoldierForStatus = soldierName;
    
    // הגדר את שם החייל בדיאלוג
    document.getElementById('soldier-name').textContent = soldierName;
    
    // קבע את ערך ברירת המחדל של הסטטוס אם כבר יש לחייל סטטוס
    const statusSelect = document.getElementById('status-select');
    const otherStatusInput = document.getElementById('other-status');
    const otherStatusContainer = document.getElementById('other-status-container');
    
    if (currentSoldierStatuses[soldierName]) {
        const currentStatus = currentSoldierStatuses[soldierName];
        // בדוק אם הסטטוס הוא אחד מהערכים הקבועים
        if (['בבית', 'גימלים'].includes(currentStatus)) {
            statusSelect.value = currentStatus;
            otherStatusContainer.style.display = 'none';
        } else {
            statusSelect.value = 'אחר';
            otherStatusInput.value = currentStatus;
            otherStatusContainer.style.display = 'block';
        }
    } else {
        // אפס את הערכים אם אין סטטוס קיים
        statusSelect.value = 'בבית';
        otherStatusInput.value = '';
        otherStatusContainer.style.display = 'none';
    }
    
    // הצג את הדיאלוג
    const dialog = document.getElementById('status-dialog');
    dialog.style.display = 'flex';
}

function closeStatusDialog() {
    document.getElementById('status-dialog').style.display = 'none';
}

function saveStatus() {
    const statusSelect = document.getElementById('status-select');
    let selectedStatus = statusSelect.value;
    
    // אם נבחר "אחר", קח את הערך מהשדה הנוסף
    if (selectedStatus === 'אחר') {
        const otherStatusValue = document.getElementById('other-status').value.trim();
        if (otherStatusValue) {
            selectedStatus = otherStatusValue;
        }
    }
    
    // שמור את הסטטוס
    currentSoldierStatuses[currentSoldierForStatus] = selectedStatus;
    
    // עדכן את רשימת הסטטוסים בממשק
    updateSoldierStatusList();
    
    // סגור את הדיאלוג
    closeStatusDialog();
}

function updateSoldierStatusList() {
    const statusListContainer = document.getElementById('soldier-status-list');
    statusListContainer.innerHTML = '';
    
    // קבל את החיילים הנעדרים
    const selectedSoldiers = Array.from(document.querySelectorAll(".soldier-list label.selected")).map(label => label.innerText);
    
    if (selectedSoldiers.length === 0) {
        statusListContainer.innerHTML = '<div class="status-empty">אין חיילים נעדרים</div>';
        return;
    }
    
    // יצירת פריט עבור כל חייל נעדר
    selectedSoldiers.forEach(soldier => {
        const statusItem = document.createElement('div');
        statusItem.className = 'status-item';
        
        const soldierNameSpan = document.createElement('span');
        soldierNameSpan.textContent = soldier;
        
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge';
        
        // קבע את הסטטוס וסוג התג בהתאם לסטטוס
        const status = currentSoldierStatuses[soldier] || 'לא צוין';
        statusBadge.textContent = status;
        
        if (status === 'בבית') {
            statusBadge.classList.add('home');
        } else if (status === 'גימלים') {
            statusBadge.classList.add('medical');
        } else if (status !== 'לא צוין') {
            statusBadge.classList.add('other');
        }
        
        // כפתור לשינוי סטטוס
        const changeStatus = document.createElement('span');
        changeStatus.className = 'status-change';
        changeStatus.textContent = 'שנה';
        changeStatus.onclick = function() {
            showStatusDialog(soldier);
        };
        
        statusItem.appendChild(soldierNameSpan);
        statusItem.appendChild(statusBadge);
        statusItem.appendChild(changeStatus);
        
        statusListContainer.appendChild(statusItem);
    });
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
    
    const password = prompt("הכנס סיסמת עריכה:");
    if (password !== "eadmin") {
        alert("סיסמה שגויה!");
        return;
    }
    
    const selectedUnit = document.getElementById("unit").value;
    const selectedDate = document.getElementById("date").value;
    const selectedTime = document.getElementById("time").value;
    const absentSoldiers = Array.from(document.querySelectorAll(".soldier-list label.selected")).map(label => label.innerText);
    
    if (!selectedUnit || !selectedDate || !selectedTime) {
        alert("אנא מלא את כל השדות לפני שליחת הדיווח.");
        return;
    }
    
    // יצירת מזהה ייחודי לדוח
    const editReportId = document.getElementById('edit-report-id').value;
    const reportId = editReportId || `${selectedDate}_${selectedTime}_${selectedUnit}`.replace(/[\s:]/g, '_');
    
    // אם לא במצב עריכה, בדוק אם קיים כבר דוח זהה
    if (!editReportId && checkExistingReport(selectedDate, selectedTime, selectedUnit)) {
        if (!confirm("כבר קיים דוח לתאריך, שעה ומחלקה אלו. האם ברצונך לעדכן את הדוח הקיים?")) {
            return;
        }
    }
    
    // יצירת דוח עם חותמת זמן
    const reportTimestamp = new Date().toISOString();
    
    // קבלת פרטי המשתמש הנוכחי
    database.ref('users/' + auth.currentUser.uid).once('value')
        .then(snapshot => {
            const userData = snapshot.val() || {};
            const firstName = userData.firstName || '';
            const lastName = userData.lastName || '';
            const fullName = firstName && lastName ? `${firstName} ${lastName}` : auth.currentUser.email;
            
            // מידע על סטטוס החיילים
            const soldierStatusInfo = {};
            absentSoldiers.forEach(soldier => {
                soldierStatusInfo[soldier] = currentSoldierStatuses[soldier] || 'לא צוין';
            });
            
// יצירת אובייקט הדוח
const reportData = { 
    date: selectedDate, 
    time: selectedTime, 
    unit: selectedUnit, 
    absent: absentSoldiers,
    soldierStatus: soldierStatusInfo,
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
        
        let successMessage = "הדיווח נשלח בהצלחה!";
        if (editReportId) {
            successMessage = "הדיווח עודכן בהצלחה!";
            // איפוס מצב עריכה
            cancelEdit();
        }
        
        alert(successMessage);
        
        // ניקוי הטופס אם לא במצב עריכה
        if (!editReportId) {
            document.querySelectorAll(".soldier-list label.selected").forEach(label => {
                label.classList.remove("selected");
            });
            updateSelectedSoldiers();
            currentSoldierStatuses = {};
            updateSoldierStatusList();
        }
        
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
const soldierStatusInfo = {};
absentSoldiers.forEach(soldier => {
    soldierStatusInfo[soldier] = currentSoldierStatuses[soldier] || 'לא צוין';
});

const reportData = { 
    date: selectedDate, 
    time: selectedTime, 
    unit: selectedUnit, 
    absent: absentSoldiers,
    soldierStatus: soldierStatusInfo,
    timestamp: reportTimestamp,
    createdBy: auth.currentUser.email
};

// עדכון המשתנה הגלובלי
reports[reportId] = reportData;

// ניסיון לשמור ב-Firebase
database.ref('reports/' + reportId).set(reportData);

// שמירת הדוחות לאחסון מקומי כגיבוי
localStorage.setItem('attendanceReports', JSON.stringify(reports));
        
let successMessage = "הדיווח נשלח בהצלחה!";
if (editReportId) {
    successMessage = "הדיווח עודכן בהצלחה!";
    // איפוס מצב עריכה
    cancelEdit();
}

alert(successMessage);

// ניקוי הטופס אם לא במצב עריכה
if (!editReportId) {
    document.querySelectorAll(".soldier-list label.selected").forEach(label => {
        label.classList.remove("selected");
    });
    updateSelectedSoldiers();
    currentSoldierStatuses = {};
    updateSoldierStatusList();
}

// עדכון הסטטיסטיקות
updateGlobalStats();

// מעבר ללשונית הדוחות
switchTab('reports');
});
}

function editReport(reportId) {
// בדיקה אם המשתמש מחובר
if (!isLoggedIn) {
alert("עליך להתחבר למערכת כדי לערוך דיווח");
return;
}

const password = prompt("הכנס סיסמת עריכה:");
if (password !== "eadmin") {
alert("סיסמה שגויה!");
return;
}

// קבלת הדיווח הקיים
const report = reports[reportId];
if (!report) {
alert("הדיווח לא נמצא!");
return;
}

// מעבר ללשונית הטופס
switchTab('form');

// הגדרת מצב עריכה
document.getElementById('edit-report-id').value = reportId;
document.getElementById('submit-button').innerText = "עדכן דיווח";
document.getElementById('cancel-edit-button').style.display = "block";

// מילוי הטופס בנתונים הקיימים
document.getElementById('unit').value = report.unit;
document.getElementById('date').value = report.date;
document.getElementById('time').value = report.time;

// טעינת החיילים מהמחלקה
updateSoldiers();

// סימון החיילים הנעדרים
const soldierLabels = document.querySelectorAll(".soldier-list label");
soldierLabels.forEach(label => {
if (report.absent.includes(label.innerText)) {
label.classList.add("selected");
}
});

// טעינת הסטטוסים אם יש
currentSoldierStatuses = {};
if (report.soldierStatus) {
currentSoldierStatuses = {...report.soldierStatus};
} else {
// במקרה שאין סטטוסים בדיווח הקיים (דיווחים ישנים)
report.absent.forEach(soldier => {
currentSoldierStatuses[soldier] = 'לא צוין';
});
}

// עדכון הממשק
updateSelectedSoldiers();
updateSoldierStatusList();
}

function cancelEdit() {
// ניקוי מצב עריכה
document.getElementById('edit-report-id').value = '';
document.getElementById('submit-button').innerText = "שלח דיווח";
document.getElementById('cancel-edit-button').style.display = "none";

// איפוס הטופס
document.getElementById('unit').value = '';
document.querySelectorAll(".soldier-list label.selected").forEach(label => {
label.classList.remove("selected");
});
updateSelectedSoldiers();

// איפוס סטטוסים
currentSoldierStatuses = {};
updateSoldierStatusList();

// עדכון החיילים
document.getElementById('soldiers').innerHTML = '';
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
            <p><strong>מספר חיילים נעדרים:</strong> ${data.absent.length}</p>
            ${createdByText}
        `;
        
        if (data.absent.length) {
            // הצגת החיילים הנעדרים עם הסטטוס שלהם
            const absentList = document.createElement('div');
            absentList.className = 'absent-list';
            absentList.innerHTML = '<p><strong>חיילים נעדרים:</strong></p>';
            
            data.absent.forEach(soldier => {
                let status = 'לא צוין';
                if (data.soldierStatus && data.soldierStatus[soldier]) {
                    status = data.soldierStatus[soldier];
                }
                
                const soldierItem = document.createElement('div');
                soldierItem.className = 'absent-item';
                
                let statusClass = '';
                if (status === 'בבית') statusClass = 'home';
                else if (status === 'גימלים') statusClass = 'medical';
                else if (status !== 'לא צוין') statusClass = 'other';
                
                soldierItem.innerHTML = `
                    <span>${soldier}</span>
                    <span class="status-badge ${statusClass}">${status}</span>
                `;
                
                absentList.appendChild(soldierItem);
            });
            
            reportCard.appendChild(absentList);
        } else {
            reportCard.innerHTML += `<p><strong>חיילים נעדרים:</strong> אין חיילים נעדרים</p>`;
        }
        
        // כפתורי פעולה
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'report-actions';
        
        // כפתור עריכה
        const editButton = document.createElement('button');
        editButton.innerText = "ערוך דוח";
        editButton.className = 'edit-button';
        editButton.onclick = function() {
            editReport(reportId);
        };
        actionsDiv.appendChild(editButton);
        
        // כפתור מחיקה
        const deleteButton = document.createElement('button');
        deleteButton.innerText = "מחק דוח";
        deleteButton.className = 'delete-button';
        deleteButton.onclick = function() {
            deleteReport(reportId);
        };
        actionsDiv.appendChild(deleteButton);
        
        reportCard.appendChild(actionsDiv);
        reportListDiv.appendChild(reportCard);
    });
}

function updateGlobalStats() {
    const statsDiv = document.getElementById("total-stats");
    
    // איסוף הנתונים
    let totalReports = Object.keys(reports).length;
    let totalAbsent = 0;
    let absentByUnit = {};
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
    
    // חישוב סך כל החיילים הנעדרים
    for (const report of Object.values(reports)) {
        totalAbsent += report.absent.length;
        
        if (report.unit in absentByUnit) {
            absentByUnit[report.unit] += report.absent.length;
        }
    }
    
    // הצגת הסטטיסטיקות
    statsDiv.innerHTML = `
        <p><strong>סך הכל דוחות:</strong> ${totalReports}</p>
        <p><strong>סך הכל חיילים נעדרים:</strong> ${totalAbsent}</p>
    `;
    
    if (mostRecentDate) {
        statsDiv.innerHTML += `<p><strong>תאריך דיווח אחרון:</strong> ${mostRecentDate}</p>`;
    }
    
    statsDiv.innerHTML += `<p><strong>נעדרים לפי מחלקה:</strong></p>`;
    
    for (const [unit, count] of Object.entries(absentByUnit)) {
        if (count > 0) {
            statsDiv.innerHTML += `<p>${unit}: ${count}</p>`;
        }
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
                    if (!report.date || !report.time || !report.unit || !Array.isArray(report.absent)) {
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
                        localStorage.setItem('attendanceReports', JSON.stringify(reports));
                        renderReportList();
                        updateGlobalStats();
                        alert('נתונים שוחזרו בהצלחה!');
                    })
                    .catch(error => {
                        console.error("שגיאה בשמירת נתונים מיובאים ב-Firebase:", error);
                        
                        // שמירה מקומית בכל מקרה
                        localStorage.setItem('attendanceReports', JSON.stringify(reports));
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
    
    // יצירת אובייקט הטבלה שיהפוך ל-HTML
    let tableHTML = '<table border="1">';
    tableHTML += '<tr><th>תאריך ושעה</th><th>מחלקה 1</th><th>מחלקה 2</th><th>מחלקה 3</th><th>מפלג</th></tr>';
    
    // מיון דוחות לפי תאריך
    const sortedReports = Object.values(reports).sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateB - dateA;
    });
    
    // מציאת התאריכים הייחודיים במבנה שרשור
    const uniqueDates = [];
    sortedReports.forEach(report => {
        const dateObj = new Date(report.date);
        const formattedDate = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.${dateObj.getFullYear()}`;
        const dateTimeKey = `${formattedDate} ${report.time}`;
        if (!uniqueDates.includes(dateTimeKey)) {
            uniqueDates.push(dateTimeKey);
        }
    });
    
    // בניית שורות הדוח
    uniqueDates.forEach(dateTime => {
        tableHTML += '<tr>';
        tableHTML += `<td>${dateTime}</td>`;
        
        // עבור כל מחלקה, מצא את החיילים הנעדרים בתאריך זה
        ["מחלקה 1", "מחלקה 2", "מחלקה 3", "מפלג"].forEach(unitName => {
            const unitReports = sortedReports.filter(report => {
                const dateObj = new Date(report.date);
                const formattedDate = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.${dateObj.getFullYear()}`;
                const reportDateTime = `${formattedDate} ${report.time}`;
                return reportDateTime === dateTime && report.unit === unitName;
            });
            
            tableHTML += '<td>';
            
            // אם יש דיווח למחלקה זו בתאריך הזה, הוסף את החיילים עם הסטטוס שלהם
            if (unitReports.length > 0 && unitReports[0].absent.length > 0) {
                unitReports[0].absent.forEach(soldier => {
                    let status = 'לא צוין';
                    if (unitReports[0].soldierStatus && unitReports[0].soldierStatus[soldier]) {
                        status = unitReports[0].soldierStatus[soldier];
                    }
                    tableHTML += `${soldier} (${status})<br>`;
                });
            }
            
            tableHTML += '</td>';
        });
        
        tableHTML += '</tr>';
    });
    
    tableHTML += '</table>';
    
    // יצירת Blob עם HTML שאקסל יכול לפתוח
    const blob = new Blob(['\ufeff', tableHTML], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    
    // יצירת URL לקובץ
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `דוח_נוכחות_${new Date().toLocaleDateString()}.xls`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}