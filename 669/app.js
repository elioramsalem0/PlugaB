// יבוא ספריות Firebase
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  enableIndexedDbPersistence,
  db,
  auth,
  addDoc,
  serverTimestamp,
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from "./firebase-config.js";

// מידע מרכזי - ניהול מצב האפליקציה
let soldiers = [];
let tasks = [];
let assignments = [];
let currentWeek = new Date();
let searchTerm = '';
let editingSoldierId = null;
let userRole = 'viewer'; // מתחיל כצופה
let isAuthenticated = false;
let unsubscribeSoldiers = null;
let unsubscribeTasks = null;
let unsubscribeAssignments = null;
let currentUser = null;
let appInitialized = false; // דגל לסימון אם האפליקציה אותחלה בהצלחה


// אובייקט עבור המשבצת הנוכחית לשיבוץ מהיר
let currentQuickAdd = {
taskId: null,
date: null,
selectedSoldiers: []
};

// -------------------------------------
// פונקציות אתחול ותשתית
// -------------------------------------

// פונקציה לאתחול האפליקציה (גרסה ישנה)
function initAppLegacy() {
  console.log("מאתחל אפליקציה (גרסה ישנה)...");
  
  // הוספת סגנונות להתראות ודיאלוגים
  addNotificationStyles();
  addDialogStyles();
  
  // וידוא שכל הדיאלוגים קיימים
  ensureDialogsExist();
  
  // הגדרת אפשרות שינוי גודל רשימת החיילים
  setupResizable();
  
  // הגדרת מאזינים לאירועים
  setupEventListeners();
  setupAuthEventListeners();
  
  // התאמה למובייל
  adjustForMobile();
  
  // בדיקה אם יש מצב שמור ב-localStorage
  if (currentUser) {
    const savedViewMode = localStorage.getItem('userViewMode');
    if (savedViewMode) {
      console.log("נמצא מצב שמור באחסון המקומי בעת אתחול:", savedViewMode);
      // נעדכן את המצב רק אם המשתמש הוא מנהל (ייבדק ב-checkIfAdmin)
    }
  }
  
  // עדכון כפתורים לפי מצב התחברות
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const toggleRoleBtn = document.getElementById('toggleRole');
  
  // כברירת מחדל, מציג רק את כפתור ההתחברות
  if (loginBtn) loginBtn.classList.remove('hidden');
  if (logoutBtn) logoutBtn.classList.add('hidden');
  if (toggleRoleBtn) toggleRoleBtn.classList.add('hidden');
  
  // מאזין לשינויים בסטטוס ההתחברות
  onAuthStateChanged(auth, handleAuthStateChanged);
  
  // סימון שהאפליקציה אותחלה
  appInitialized = true;
  console.log("אתחול אפליקציה (גרסה ישנה) הושלם");
  
  // עדכון כפתור הוספת משימה
  updateAddTaskButton();
}

// הצגת מסך התחברות
function showLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) {
    loginScreen.classList.remove('hidden');
  } else {
    console.warn("לא נמצא אלמנט loginScreen");
  }
}

// הסתרת מסך התחברות
function hideLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) {
    loginScreen.classList.add('hidden');
  } else {
    console.warn("לא נמצא אלמנט loginScreen");
  }
}

// פונקציה להגדרת מאזין לשגיאות גלובליות
function setupErrorHandling() {
// מאזין לשגיאות לא מטופלות
window.addEventListener('error', function(event) {
  console.error('שגיאה לא מטופלת:', event.error);
  showNotification('אירעה שגיאה לא מטופלת: ' + (event.error?.message || 'שגיאה לא ידועה'), 'error');
});

// מאזין להבטחות שנכשלו ולא טופלו
window.addEventListener('unhandledrejection', function(event) {
  console.error('הבטחה שנכשלה ולא טופלה:', event.reason);
  showNotification('אירעה שגיאה בפעולה אסינכרונית: ' + (event.reason?.message || 'שגיאה לא ידועה'), 'error');
});
}
// עדכון ממשק למנהלים
function updateInterfaceForAdmin() {
  // הוספה רק אם המשתמש הוא מנהל
  if (userRole === 'admin') {
    addAdminButton();
  }
}

// הוספת כפתור ניהול משתמשים לתפריט
function addAdminButton() {
  const userInfo = document.getElementById('userInfo');
  
  if (userInfo && userRole === 'admin') {
    // בדיקה אם הכפתור כבר קיים
    if (!document.getElementById('adminMgmtBtn')) {
      const adminButton = document.createElement('button');
      adminButton.id = 'adminMgmtBtn';
      adminButton.className = 'button button-accent';
      adminButton.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        ניהול משתמשים
      `;
      
      adminButton.addEventListener('click', showAdminManagementDialog);
      userInfo.insertBefore(adminButton, userInfo.firstChild);
    }
  }
}

// פונקציה להצגת דיאלוג ניהול משתמשים
function showAdminManagementDialog() {
  if (userRole !== 'admin') {
    showNotification('רק מנהל יכול לנהל משתמשים', 'error');
    return;
  }
  
  // בדיקה אם הדיאלוג כבר קיים
  let dialog = document.getElementById('adminManagementDialog');
  
  if (!dialog) {
    // יצירת דיאלוג חדש
    dialog = document.createElement('div');
    dialog.id = 'adminManagementDialog';
    dialog.className = 'dialog-container';
    dialog.innerHTML = `
      <div class="dialog">
        <div class="dialog-header">
          <h3>ניהול משתמשים</h3>
          <button id="closeAdminDialog" class="close-button">×</button>
        </div>
        <div class="dialog-content">
          <div class="mb-4">
            <h4 class="font-bold mb-2">הוספת מנהל חדש</h4>
            <div class="flex gap-2">
              <input 
                type="email" 
                id="newAdminEmail" 
                placeholder="הזן כתובת אימייל" 
                class="rounded border px-2 py-1 flex-grow"
              />
              <button id="addAdminBtn" class="button button-green">
                הוסף מנהל
              </button>
            </div>
          </div>
          
          <div class="mt-4">
            <h4 class="font-bold mb-2">רשימת משתמשים</h4>
            <div id="usersList" class="border rounded p-2 max-h-60 overflow-y-auto">
              <div class="text-center text-gray-400 py-4">טוען משתמשים...</div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button id="adminDialogCancel" class="button button-gray">סגור</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // הוספת מאזינים לאירועים
    document.getElementById('closeAdminDialog').addEventListener('click', closeAdminManagementDialog);
    document.getElementById('adminDialogCancel').addEventListener('click', closeAdminManagementDialog);
    document.getElementById('addAdminBtn').addEventListener('click', handleAddAdmin);
    
    // טעינת רשימת משתמשים
    loadUsersList();
  }
  
  // הצגת הדיאלוג
  dialog.classList.remove('hidden');
}

// פונקציה לסגירת דיאלוג ניהול משתמשים
function closeAdminManagementDialog() {
  const dialog = document.getElementById('adminManagementDialog');
  if (dialog) {
    dialog.classList.add('hidden');
  }
}

// פונקציה לטעינת רשימת משתמשים
async function loadUsersList() {
  if (userRole !== 'admin') return;
  
  const usersList = document.getElementById('usersList');
  if (!usersList) return;
  
  usersList.innerHTML = '<div class="text-center text-gray-400 py-4">טוען משתמשים...</div>';
  
  try {
    const usersRef = collection(db, "users");
    const querySnapshot = await getDocs(usersRef);
    
    if (querySnapshot.empty) {
      usersList.innerHTML = '<div class="text-center text-gray-400 py-4">אין משתמשים</div>';
      return;
    }
    
    usersList.innerHTML = '';
    
    querySnapshot.forEach(doc => {
      const userData = doc.data();
      const userItem = document.createElement('div');
      userItem.className = 'user-item p-2 border-b flex justify-between items-center';
      
      const roleLabel = userData.role === 'admin' ? 
        '<span class="text-green-600 font-bold">מנהל</span>' : 
        '<span class="text-gray-600">צופה</span>';
      
      userItem.innerHTML = `
        <div>
          <div>${userData.email || 'אין אימייל'}</div>
          <div class="text-sm">${roleLabel}</div>
        </div>
      `;
      
      usersList.appendChild(userItem);
    });
    
  } catch (error) {
    console.error("שגיאה בטעינת רשימת משתמשים:", error);
    usersList.innerHTML = '<div class="text-center text-red-500 py-4">אירעה שגיאה בטעינת המשתמשים</div>';
  }
}

// פונקציה להוספת מנהל חדש
async function handleAddAdmin() {
  if (userRole !== 'admin') {
    showNotification('רק מנהל יכול להוסיף מנהלים', 'error');
    return;
  }
  
  const emailInput = document.getElementById('newAdminEmail');
  const email = emailInput.value.trim();
  
  if (!email) {
    showNotification('נא להזין כתובת אימייל', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showNotification('כתובת האימייל אינה תקינה', 'error');
    return;
  }
  
  try {
    const result = await promoteToAdmin(email);
    
    if (result) {
      emailInput.value = '';
      loadUsersList(); // טעינה מחדש של רשימת המשתמשים
    }
  } catch (error) {
    console.error("שגיאה בהוספת מנהל:", error);
    showNotification('אירעה שגיאה בהוספת המנהל', 'error');
  }
}

// פונקציה לבדיקת תקינות אימייל
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
// -------------------------------------
// פונקציות אימות (Authentication)
// -------------------------------------

// פונקציה לטיפול בשינוי מצב ההתחברות
function handleAuthStateChanged(user) {
  console.log("שינוי מצב ההתחברות:", user ? `מחובר: ${user.uid}` : "לא מחובר");

  // הגדרת אלמנטי ממשק
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const toggleRoleBtn = document.getElementById('toggleRole');
  const userEmailElement = document.getElementById('userEmail');

  // בדיקה אם האלמנטים קיימים
  if (!loginBtn || !logoutBtn) {
    console.error("אלמנטי כפתורי התחברות/התנתקות חסרים!");
    return;
  }

  // ראשית, הסתרת כפתור התנתקות כברירת מחדל
  loginBtn.classList.remove('hidden');
  loginBtn.style.display = 'flex';
  
  logoutBtn.classList.add('hidden');
  logoutBtn.style.display = 'none';
  
  if (toggleRoleBtn) {
    toggleRoleBtn.classList.add('hidden');
    toggleRoleBtn.style.display = 'none';
  }

  if (user) {
    // משתמש מחובר
    currentUser = user;
    isAuthenticated = true;
    
    // הסתרת כפתור התחברות והצגת כפתור התנתקות
    loginBtn.classList.add('hidden');
    loginBtn.style.display = 'none';
    
    logoutBtn.classList.remove('hidden');
    logoutBtn.style.display = 'flex';
    
    // בדיקה אם המשתמש הוא מנהל
    checkIfAdmin(user)
      .then(isAdmin => {
        // שים לב: userRole כבר הוגדר כ'viewer' בפונקציית checkIfAdmin
        console.log("תפקיד המשתמש:", userRole, "הרשאת מנהל:", isAdmin);
        
        // הצגת כפתור החלפת תפקיד למנהלים
        if (toggleRoleBtn) {
          if (isAdmin) {
            toggleRoleBtn.classList.remove('hidden');
            toggleRoleBtn.style.display = 'flex';
          }
        }
        
        // עדכון הממשק לפי התפקיד - כבר נקרא בתוך checkIfAdmin
      })
      .catch(error => {
        console.error("שגיאה בבדיקת הרשאות:", error);
        showNotification('אירעה שגיאה בבדיקת הרשאות המשתמש', 'error');
      });
    
    // הסתרת מסך ההתחברות אם הוא פתוח
    hideLoginScreen();
    
    // הצגת פרטי המשתמש
    if (userEmailElement) userEmailElement.textContent = user.email || 'משתמש מחובר';
    
    // טעינת נתונים מ-Firestore
    loadDataFromFirestore();
  } 
  else {
    // משתמש לא מחובר - הצגת מסך התחברות
    console.log("אין משתמש מחובר - מציג מסך התחברות");
    currentUser = null;
    isAuthenticated = false;
    userRole = 'viewer';
    
    // עדכון הממשק למצב צפייה
    updateInterfaceForRole();
    
    if (userEmailElement) userEmailElement.textContent = 'לא מחובר';
    
    // הסרת מאזינים קיימים
    loadDataFromFirestore();
    
    
    // איפוס נתונים
    soldiers = [];
    tasks = [];
    assignments = [];
  }
}

// פונקציה לבדיקה אם המשתמש הוא מנהל
async function checkIfAdmin(user) {
try {
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);
  
  let isAdmin = false;
  
  if (userDoc.exists() && userDoc.data().role === 'admin') {
    isAdmin = true;
    
    // אם המשתמש הוא מנהל, נבדוק אם יש מצב שמור ב-localStorage
    const savedViewMode = localStorage.getItem('userViewMode');
    if (savedViewMode) {
      userRole = savedViewMode; // מגדיר את המצב הנשמר
      console.log("נטען מצב צפייה מהאחסון המקומי:", userRole);
    } else {
      // אם אין מצב שמור, נתחיל במצב צפייה
      userRole = 'viewer';
    }
  } else {
    // משתמש שאינו מנהל תמיד יהיה במצב צפייה
    userRole = 'viewer';
    
    // אם אין מסמך למשתמש, יצירת אחד עם תפקיד ברירת מחדל
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        email: user.email,
        role: 'viewer',
        createdAt: serverTimestamp()
      });
    }
  }
  
  console.log("checkIfAdmin: תפקיד המשתמש נקבע ל-", userRole);
  
  // עדכון הממשק לפי התפקיד החדש
  updateInterfaceForRole();
  
  return isAdmin;
} catch (error) {
  console.error("שגיאה בבדיקת הרשאות מנהל:", error);
  showNotification('אירעה שגיאה בבדיקת הרשאות המשתמש', 'error');
  return false;
}
}

// פונקציה לעדכון הממשק לפי תפקיד המשתמש
function updateInterfaceForRole() {
  console.log("מעדכן ממשק לפי תפקיד:", userRole);
  
  // עדכון כפתור החלפת תפקיד
  const toggleRoleBtn = document.getElementById('toggleRole');
  if (toggleRoleBtn) {
    toggleRoleBtn.className = userRole === 'admin' ? 
      'button button-accent' : 'button button-gray';
    
    const roleTextElement = document.getElementById('roleText');
    if (roleTextElement) {
      roleTextElement.textContent = userRole === 'admin' ? 'מצב עריכה' : 'מצב צפייה';
    }
  }
  
  // עדכון טופס הוספת חיילים
  const addSoldierForm = document.getElementById('addSoldierForm');
  if (addSoldierForm) {
    addSoldierForm.style.display = userRole === 'admin' ? 'flex' : 'none';
  }
  
  // עדכון כפתור הוספת משימה
  updateAddTaskButton();
  
  // רינדור מחדש של כל הממשק
  refreshInterface();
}

// פונקציה לרינדור מחדש של כל הממשק
function refreshInterface() {
  console.log("מבצע רינדור מחדש של כל הממשק, מצב עריכה:", userRole);
  
  // רינדור מחדש של רשימת החיילים
  renderSoldiers();
  
  // רינדור מחדש של לוח השנה
  renderCalendar();
  
  // הגדרה מחדש של אירועי גרירה
  setTimeout(() => {
    setupDragAndDrop();
    
    // עדכון מאפיין draggable לכל כרטיסי החיילים
    const soldierCards = document.querySelectorAll('.soldier-card');
    soldierCards.forEach(card => {
      card.draggable = userRole === 'admin';
    });
    
    console.log("הוגדרו מחדש אירועי גרירה לאחר רינדור מחדש של הממשק");
  }, 100);
}

// פונקציה לטיפול בהתחברות
async function handleLogin(e) {
e.preventDefault();

const username = document.getElementById('username').value;
const password = document.getElementById('password').value;
const errorDiv = document.getElementById('loginError');

try {
  await signInWithEmailAndPassword(auth, username, password);
  errorDiv.classList.add('hidden');
} catch (error) {
  console.error("שגיאת התחברות:", error);
  errorDiv.textContent = getFirebaseErrorMessage(error.code);
  errorDiv.classList.remove('hidden');
}
}


// פונקציה להתנתקות
async function handleLogout() {
  try {
    await signOut(auth);
    
    // מחיקת המצב השמור בעת התנתקות
    localStorage.removeItem('userViewMode');
    
    // איפוס נתונים
    soldiers = [];
    tasks = [];
    assignments = [];
    
    // עדכון כפתורים
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const toggleRoleBtn = document.getElementById('toggleRole');
    
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (toggleRoleBtn) toggleRoleBtn.classList.add('hidden');
    
    // הצגת מסך התחברות
    showLoginScreen();
    
    showNotification('התנתקת בהצלחה', 'info');
  } catch (error) {
    console.error("שגיאת התנתקות:", error);
    showNotification('אירעה שגיאה בהתנתקות', 'error');
  }
}


// פונקציה משופרת לשיבוץ חיילים ליום מסוים
async function assignSoldiersToDay(taskId, dateStr, soldierIds) {
  console.log("מתחיל שיבוץ חיילים:", {
    taskId: taskId,
    dateStr: dateStr,
    soldierIds: soldierIds
  });
  
  // וידוא שהפרמטרים תקינים
  if (!taskId || !dateStr || !soldierIds || !Array.isArray(soldierIds) || soldierIds.length === 0) {
    console.error("שגיאה: פרמטרים חסרים או לא תקינים לשיבוץ", {
      taskId: taskId,
      dateStr: dateStr,
      soldierIds: soldierIds
    });
    return { success: false, addedCount: 0, error: "פרמטרים לא תקינים" };
  }
  
  try {
    // נרמול המזהים
    const normalizedTaskId = normalizeId(taskId);
    const normalizedSoldierIds = normalizeIds(soldierIds);
    
    // וידוא שיש חיילים לשיבוץ אחרי הנרמול
    if (normalizedSoldierIds.length === 0) {
      console.error("שגיאה: אין חיילים תקינים לשיבוץ");
      return { success: false, addedCount: 0, error: "אין חיילים תקינים לשיבוץ" };
    }
    
    // חיפוש שיבוץ קיים - עם וידוא שלא יסתמך על עיצוב אובייקט האוסף
    const existingAssignment = assignments.find(a => 
      normalizeId(a.taskId) === normalizedTaskId && a.date === dateStr
    );
    
    if (existingAssignment) {
      // עדכון שיבוץ קיים - הוספת חיילים שלא משובצים כבר
      const existingSoldierIds = existingAssignment.soldierIds || [];
      const normalizedExistingSoldierIds = normalizeIds(existingSoldierIds);
      
      // מניעת שיבוץ כפול וחיפוש התנגשויות
      const newSoldiers = normalizedSoldierIds.filter(id => 
        !normalizedExistingSoldierIds.includes(id) && !hasConflict(id, dateStr)
      );
      
      console.log("חיילים חדשים להוספה:", newSoldiers);
      
      if (newSoldiers.length > 0) {
        try {
          // עדכון המסמך בפיירסטור
          const assignmentRef = doc(db, "assignments", existingAssignment.id);
          const updatedSoldierIds = [...normalizedExistingSoldierIds, ...newSoldiers];
          
          await updateDoc(assignmentRef, {
            soldierIds: updatedSoldierIds,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser ? normalizeId(currentUser.uid) : 'anonymous'
          });
          
          console.log("שיבוץ עודכן עם חיילים:", updatedSoldierIds);
          
          // עדכון המערך המקומי במקביל
          const index = assignments.findIndex(a => a.id === existingAssignment.id);
          if (index !== -1) {
            assignments[index] = {
              ...existingAssignment,
              soldierIds: updatedSoldierIds
            };
          }
          
          return { success: true, addedCount: newSoldiers.length };
        } catch (error) {
          console.error("שגיאה בעדכון שיבוץ:", error);
          return { success: false, addedCount: 0, error: error.message };
        }
      } else {
        return { success: true, addedCount: 0 };
      }
    } else {
      // יצירת שיבוץ חדש - בדיקת חיילים זמינים
      const availableSoldiers = normalizedSoldierIds.filter(id => !hasConflict(id, dateStr));
      
      console.log("חיילים זמינים לשיבוץ חדש:", availableSoldiers);
      
      if (availableSoldiers.length > 0) {
        try {
          // וידוא שהמשתמש מחובר
          if (!currentUser) {
            console.error("שגיאה: אין משתמש מחובר");
            return { success: false, addedCount: 0, error: "נדרשת התחברות למערכת" };
          }
          
          // הוספת מסמך חדש לפיירסטור
          const docRef = await addDoc(collection(db, "assignments"), {
            taskId: normalizedTaskId,
            date: dateStr,
            soldierIds: availableSoldiers,
            createdAt: serverTimestamp(),
            createdBy: normalizeId(currentUser.uid)
          });
          
          console.log("נוצר שיבוץ חדש עם ID:", docRef.id);
          
          // הוספת השיבוץ החדש למערך המקומי - יש מעקב אחר הוספה בזמן אמת
          // עם זאת, נעשה גם עדכון מקומי מיידי למקרה שהאזנה לפיירסטור איטית
          const newAssignment = {
            id: normalizeId(docRef.id),
            taskId: normalizedTaskId,
            date: dateStr,
            soldierIds: availableSoldiers
          };
          
          assignments.push(newAssignment);
          
          return { success: true, addedCount: availableSoldiers.length };
        } catch (error) {
          console.error("שגיאה ביצירת שיבוץ חדש:", error);
          return { success: false, addedCount: 0, error: error.message };
        }
      } else {
        return { success: true, addedCount: 0 };
      }
    }
  } catch (error) {
    console.error("שגיאה כללית בתהליך השיבוץ:", error);
    return { success: false, addedCount: 0, error: error.message };
  }
}

// פונקציה משופרת לבדיקת התנגשויות (חייל משובץ ליום זה)
function hasConflict(soldierId, dateStr) {
  // בדיקה שה-ID תקין
  if (!soldierId) {
    console.warn("נקרא hasConflict עם ID לא תקין:", soldierId);
    return false;
  }
  
  // בדיקה שהתאריך תקין
  if (!dateStr) {
    console.warn("נקרא hasConflict עם תאריך לא תקין:", dateStr);
    return false;
  }
  
  // נרמול ה-ID
  const normalizedId = normalizeId(soldierId);
  
  // בדיקת כל השיבוצים בתאריך הנתון
  return assignments.some(assignment => 
    assignment.date === dateStr && 
    assignment.soldierIds && 
    Array.isArray(assignment.soldierIds) &&
    assignment.soldierIds.some(id => normalizeId(id) === normalizedId)
  );
}

// פונקציה משופרת להסרת חייל ממשימה
async function handleRemoveSoldierFromTask(assignmentId, soldierId) {
  if (userRole !== 'admin') {
    showNotification('רק מנהל יכול להסיר חיילים ממשימה', 'error');
    return;
  }

  try {
    const normalizedAssignmentId = normalizeId(assignmentId);
    const normalizedSoldierId = normalizeId(soldierId);
    
    const assignmentRef = doc(db, "assignments", normalizedAssignmentId);
    
    // קבלת השיבוץ העדכני
    const assignmentDoc = await getDoc(assignmentRef);
    
    if (assignmentDoc.exists()) {
      const assignmentData = assignmentDoc.data();
      
      // וידוא שיש מערך חיילים
      if (!assignmentData.soldierIds || !Array.isArray(assignmentData.soldierIds)) {
        console.error("מערך חיילים חסר או לא תקין בשיבוץ:", normalizedAssignmentId);
        return;
      }
      
      // נרמול כל מערך החיילים והסרת החייל המבוקש
      const soldierIds = normalizeIds(assignmentData.soldierIds);
      const updatedSoldierIds = soldierIds.filter(id => id !== normalizedSoldierId);
      
      if (updatedSoldierIds.length === 0) {
        // אם השיבוץ ריק, נמחק אותו לגמרי
        await deleteDoc(assignmentRef);
        
        // עדכון המערך המקומי - הסרת השיבוץ
        const index = assignments.findIndex(a => normalizeId(a.id) === normalizedAssignmentId);
        if (index !== -1) {
          assignments.splice(index, 1);
        }
        
        console.log("נמחק שיבוץ ריק:", normalizedAssignmentId);
      } else {
        // עדכון השיבוץ עם רשימת החיילים המעודכנת
        await updateDoc(assignmentRef, {
          soldierIds: updatedSoldierIds,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser ? normalizeId(currentUser.uid) : 'anonymous'
        });
        
        // עדכון המערך המקומי
        const index = assignments.findIndex(a => normalizeId(a.id) === normalizedAssignmentId);
        if (index !== -1) {
          assignments[index].soldierIds = updatedSoldierIds;
        }
        
        console.log("הוסר חייל משיבוץ:", normalizedSoldierId);
      }
      
      // רינדור מחדש של הלוח
      renderCalendar();
      
      showNotification('החייל הוסר מהמשימה', 'info');
    } else {
      console.error("לא נמצא שיבוץ עם ID:", normalizedAssignmentId);
      showNotification('לא נמצא שיבוץ להסרת החייל', 'error');
    }
  } catch (error) {
    console.error("שגיאה בהסרת חייל ממשימה:", error);
    showNotification('אירעה שגיאה בהסרת החייל מהמשימה', 'error');
  }
}


// -------------------------------------
// פונקציות ניהול חיילים
// -------------------------------------

// רינדור של רשימת החיילים
function renderSoldiers() {
console.log("מרנדר רשימת חיילים...");
try {
  const soldiersListElement = document.getElementById('soldiersList');
  if (!soldiersListElement) {
    console.error("לא נמצא אלמנט soldiersList");
    return;
  }
  
  soldiersListElement.innerHTML = '';
  
  // סינון החיילים לפי חיפוש
  const filteredSoldiers = soldiers.filter(soldier => 
    `${soldier.firstName} ${soldier.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  console.log(`מציג ${filteredSoldiers.length} חיילים (מתוך ${soldiers.length} סה"כ)`);
  console.log("מצב משתמש נוכחי בעת רינדור חיילים:", userRole);
  
  // קבוצות לפי תפקיד
  const roleGroups = {
    doctor: { label: 'רופאים', soldiers: [] },
    paramedic: { label: 'פראמדיקים', soldiers: [] },
    trainee: { label: 'חניכים', soldiers: [] },
    mentor: { label: 'חונכים', soldiers: [] }
  };
  
  // מיון החיילים לקבוצות
  filteredSoldiers.forEach(soldier => {
    if (roleGroups[soldier.role]) {
      roleGroups[soldier.role].soldiers.push(soldier);
    }
  });
  
  // יצירת הקבוצות ברשימה
  Object.keys(roleGroups).forEach(role => {
    const group = roleGroups[role];
    if (group.soldiers.length === 0) return;
    
    // כותרת הקבוצה
    const groupTitle = document.createElement('div');
    groupTitle.className = `font-bold mb-2 ${role}`;
    groupTitle.textContent = group.label;
    soldiersListElement.appendChild(groupTitle);
    
    // יצירת מיכל לכרטיסיות החיילים
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'flex flex-wrap gap-2 mb-4';
    
    // יצירת כרטיסיות החיילים
    group.soldiers.forEach(soldier => {
      if (editingSoldierId === soldier.id) {
        // תצוגת עריכה
        const editCard = document.createElement('div');
        editCard.className = 'soldier-editing';
        
        editCard.innerHTML = `
          <div class="flex gap-1">
            <input
              type="text"
              id="editFirstName-${soldier.id}"
              value="${soldier.firstName}"
              class="rounded border px-2 py-1 text-sm w-24"
            />
            <input
              type="text"
              id="editLastName-${soldier.id}"
              value="${soldier.lastName}"
              class="rounded border px-2 py-1 text-sm w-24"
            />
            <select
              id="editRole-${soldier.id}"
              class="rounded border px-2 py-1 text-sm"
            >
              <option value="doctor" ${soldier.role === 'doctor' ? 'selected' : ''}>רופא</option>
              <option value="paramedic" ${soldier.role === 'paramedic' ? 'selected' : ''}>פראמדיק</option>
              <option value="trainee" ${soldier.role === 'trainee' ? 'selected' : ''}>חניך</option>
              <option value="mentor" ${soldier.role === 'mentor' ? 'selected' : ''}>חונך</option>
            </select>
          </div>
          <div class="flex justify-end mt-1">
            <button id="saveEdit-${soldier.id}" class="button button-green text-xs">
              <svg class="icon-sm" viewBox="0 0 24 24">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
              </svg>
              שמור
            </button>
          </div>
        `;
        
        cardsContainer.appendChild(editCard);
        
        // הוספת event listener לשמירה
        setTimeout(() => {
          const saveBtn = document.getElementById(`saveEdit-${soldier.id}`);
          if (saveBtn) {
            saveBtn.addEventListener('click', () => {
              handleSaveEdit(soldier.id);
            });
          }
        }, 0);
      } else {
        // תצוגה רגילה
        const card = document.createElement('div');
        card.className = `soldier-card ${soldier.role}`;
        
        // וידוא שמאפיין draggable מוגדר נכון לפי תפקיד המשתמש
        card.draggable = userRole === 'admin';
        card.id = `soldier-${soldier.id}`;
        
        // הוספת אייקונים לעריכה ומחיקה רק במצב עריכה
        card.innerHTML = `
          ${soldier.firstName} ${soldier.lastName}
          ${userRole === 'admin' ? `
            <div class="flex gap-1 mt-1">
              <button class="icon-button edit-btn" data-soldier-id="${soldier.id}">
                <svg class="icon-sm" viewBox="0 0 24 24">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                </svg>
              </button>
              <button class="icon-button delete-btn delete-icon" data-soldier-id="${soldier.id}">
                <svg class="icon-sm" viewBox="0 0 24 24">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                </svg>
              </button>
            </div>
          ` : ''}
        `;
        
        cardsContainer.appendChild(card);
        
        // הוספת event listeners לגרירה רק במצב עריכה
        if (userRole === 'admin') {
          // הוספת מאזיני אירועים לגרירה
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('soldierId', soldier.id);
            // הוספת אפקט ויזואלי
            setTimeout(() => {
              card.classList.add('dragging');
            }, 0);
          });
          
          card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
          });

          // תמיכה במגע למובייל
          setupMobileDragTouch(card, soldier.id);

          // הוספת event listeners לעריכה ומחיקה
          setTimeout(() => {
            const editBtn = card.querySelector('.edit-btn');
            const deleteBtn = card.querySelector('.delete-btn');
            
            if (editBtn) {
              editBtn.addEventListener('click', () => {
                handleEditSoldier(soldier.id);
              });
            }
            
            if (deleteBtn) {
              deleteBtn.addEventListener('click', () => {
                handleDeleteSoldier(soldier.id);
              });
            }
          }, 0);
        }
      }
    });
    
    soldiersListElement.appendChild(cardsContainer);
  });
  
  // אם אין חיילים שתואמים לחיפוש
  if (filteredSoldiers.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'text-center text-gray-400 py-4';
    emptyMsg.textContent = 'לא נמצאו חיילים';
    soldiersListElement.appendChild(emptyMsg);
  }
  
  // הצגת או הסתרת טופס ההוספה לפי הרשאה
  const addSoldierForm = document.getElementById('addSoldierForm');
  if (addSoldierForm) {
    addSoldierForm.style.display = userRole === 'admin' ? 'flex' : 'none';
  }
  
  console.log("רינדור רשימת חיילים הושלם, מצב עריכה:", userRole);
} catch (error) {
  console.error("שגיאה ברינדור רשימת חיילים:", error);
  showNotification('אירעה שגיאה בהצגת רשימת החיילים', 'error');
}
}

// פונקציה להוספת חייל חדש
async function handleAddSoldier() {
if (userRole !== 'admin') {
  showNotification('רק מנהל יכול להוסיף חיילים', 'error');
  return;
}

const firstNameInput = document.getElementById('newFirstName');
const lastNameInput = document.getElementById('newLastName');
const roleSelect = document.getElementById('newRole');

const firstName = firstNameInput.value.trim();
const lastName = lastNameInput.value.trim();
const role = roleSelect.value;

if (firstName) {
  try {
    // הוספת החייל החדש
    await addDoc(collection(db, "soldiers"), {
      firstName,
      lastName,
      role,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    
    // איפוס השדות
    firstNameInput.value = '';
    lastNameInput.value = '';
    roleSelect.value = 'doctor';
    
    showNotification('החייל נוסף בהצלחה!', 'success');
  } catch (error) {
    console.error("שגיאה בהוספת חייל:", error);
    showNotification('אירעה שגיאה בהוספת החייל', 'error');
  }
} else {
  showNotification('נא למלא לפחות שם פרטי', 'error');
}
}

// פונקציה למעבר למצב עריכת חייל
function handleEditSoldier(soldierId) {
if (userRole !== 'admin') {
  showNotification('רק מנהל יכול לערוך חיילים', 'error');
  return;
}

editingSoldierId = soldierId;
renderSoldiers();
}

// פונקציה לשמירת חייל אחרי עריכה
async function handleSaveEdit(soldierId) {
if (userRole !== 'admin') {
  showNotification('רק מנהל יכול לערוך חיילים', 'error');
  return;
}

const firstNameInput = document.getElementById(`editFirstName-${soldierId}`);
const lastNameInput = document.getElementById(`editLastName-${soldierId}`);
const roleSelect = document.getElementById(`editRole-${soldierId}`);

if (!firstNameInput || !lastNameInput || !roleSelect) {
  console.error("לא נמצאו שדות העריכה");
  return;
}

const firstName = firstNameInput.value.trim();
const lastName = lastNameInput.value.trim();
const role = roleSelect.value;

if (firstName) {
  try {
    // וידוא שה-ID הוא מחרוזת
    const normalizedId = normalizeId(soldierId);
    const soldierRef = doc(db, "soldiers", normalizedId);
    
    await updateDoc(soldierRef, {
      firstName,
      lastName,
      role,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    });
    
    editingSoldierId = null;
    renderSoldiers(); // רינדור מחדש של רשימת החיילים
    showNotification('פרטי החייל עודכנו בהצלחה!', 'success');
    
  } catch (error) {
    console.error("שגיאה בעדכון חייל:", error);
    showNotification('אירעה שגיאה בעדכון פרטי החייל', 'error');
  }
} else {
  showNotification('נא למלא לפחות שם פרטי', 'error');
}
}

// פונקציה למחיקת חייל
async function handleDeleteSoldier(soldierId) {
if (userRole !== 'admin') {
  showNotification('רק מנהל יכול למחוק חיילים', 'error');
  return;
}

if (confirm('האם אתה בטוח שברצונך למחוק חייל זה?')) {
  try {
    // מחיקת החייל
    await deleteDoc(doc(db, "soldiers", soldierId));
    
    // עדכון כל השיבוצים שכוללים את החייל
    for (const assignment of assignments) {
      if (assignment.soldierIds.includes(soldierId)) {
        const assignmentRef = doc(db, "assignments", assignment.id);
        const updatedSoldierIds = assignment.soldierIds.filter(id => id !== soldierId);
        
        if (updatedSoldierIds.length === 0) {
          // אם השיבוץ ריק, נמחק אותו לגמרי
          await deleteDoc(assignmentRef);
        } else {
          // עדכון השיבוץ עם רשימת החיילים המעודכנת
          await updateDoc(assignmentRef, {
            soldierIds: updatedSoldierIds,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
          });
        }
      }
    }
    
    showNotification('החייל נמחק בהצלחה', 'success');
  } catch (error) {
    console.error("שגיאה במחיקת חייל:", error);
    showNotification('אירעה שגיאה במחיקת החייל', 'error');
  }
}
}

// -------------------------------------
// פונקציות תמיכה במגע למובייל
// -------------------------------------

// הגדרת משתנים ופונקציות לגרירה במובייל
let mobileDraggedSoldierId = null;
let mobileDragElement = null;

// פונקציה להגדרת גרירה במגע למובייל
function setupMobileDragTouch(element, soldierId) {
  // בדיקה שהפרמטרים תקינים
  if (!element || !soldierId) {
    console.error("פרמטרים חסרים לפונקציית setupMobileDragTouch");
    return;
  }
  
  // המרת מזהה החייל למחרוזת
  const normalizedId = normalizeId(soldierId);
  
  // משתנים לניהול המצב
  let touchStartX = 0;
  let touchStartY = 0;
  let touchTimeStart = 0;
  let isDragging = false;
  let longTouchTimer = null;
  
  // יצירת אינדיקטור גרירה אם לא קיים
  if (!document.getElementById('mobileDragIndicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'mobileDragIndicator';
    indicator.className = 'mobile-drag-indicator';
    indicator.textContent = 'גורר חייל...';
    document.body.appendChild(indicator);
  }
  
  // מאזין לאירוע התחלת מגע
  element.addEventListener('touchstart', function(e) {
    // שמירת מיקום התחלתי
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchTimeStart = Date.now();
    
    // איפוס דגלים
    isDragging = false;
    
    // הגדרת טיימר לזיהוי לחיצה ארוכה
    longTouchTimer = setTimeout(() => {
      // במידה והלחיצה ארוכה מספיק, נסמן התחלת גרירה
      if (!isDragging) {
        startMobileDrag(normalizedId, element);
      }
    }, 500); // זיהוי לחיצה ארוכה אחרי חצי שנייה
  }, { passive: false });
  
  // מאזין לאירוע תזוזת מגע
  element.addEventListener('touchmove', function(e) {
    // אם התחילה גרירה
    if (mobileDraggedSoldierId !== null) {
      // מניעת גלילת העמוד
      e.preventDefault();
      
      // סימון שישנה גרירה פעילה
      isDragging = true;
      
      // עדכון מיקום אינדיקטור הגרירה
      updateDragIndicator(e.touches[0].clientX, e.touches[0].clientY);
      
      // בדיקה אם נמצאים מעל תא
      highlightTargetCell(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  
  // מאזין לאירוע סיום מגע
  element.addEventListener('touchend', function(e) {
    // ביטול הטיימר ללחיצה ארוכה
    if (longTouchTimer) {
      clearTimeout(longTouchTimer);
      longTouchTimer = null;
    }
    
    // אם הייתה גרירה פעילה
    if (mobileDraggedSoldierId !== null && isDragging) {
      // בדיקה אם השחרור היה מעל תא
      const targetCell = findTargetCell(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      
      if (targetCell && userRole === 'admin') {
        // שיבוץ החייל לתא
        processMobileDrop(targetCell);
      }
      
      // ניקוי מצב הגרירה
      endMobileDrag();
    }
    
    // איפוס דגלים
    isDragging = false;
  }, { passive: false });
  
  // מאזין לביטול אירוע מגע
  element.addEventListener('touchcancel', function() {
    // ביטול הטיימר ללחיצה ארוכה
    if (longTouchTimer) {
      clearTimeout(longTouchTimer);
      longTouchTimer = null;
    }
    
    // ניקוי מצב הגרירה
    endMobileDrag();
    
    // איפוס דגלים
    isDragging = false;
  }, { passive: false });
}

// פונקציה להתחלת גרירה במובייל
function startMobileDrag(soldierId, element) {
  console.log("מתחיל גרירה במובייל:", soldierId);
  
  // שמירת מזהה החייל הנגרר
  mobileDraggedSoldierId = soldierId;
  
  // הוספת סגנון חזותי לאלמנט הנגרר
  element.classList.add('dragging');
  
  // הצגת אינדיקטור הגרירה
  const indicator = document.getElementById('mobileDragIndicator');
  if (indicator) {
    // עדכון טקסט האינדיקטור עם שם החייל
    const soldierName = getSoldierName(soldierId);
    indicator.textContent = `גורר: ${soldierName}`;
    
    // הצגת האינדיקטור
    indicator.classList.add('visible');
  }
  
  // הודעה למשתמש
  navigator.vibrate?.(50); // רטט קצר אם נתמך בדפדפן
}

// פונקציה לעדכון מיקום אינדיקטור הגרירה
function updateDragIndicator(x, y) {
  const indicator = document.getElementById('mobileDragIndicator');
  if (indicator) {
    indicator.style.top = (y - 30) + 'px';
    indicator.style.left = (x - 50) + 'px';
  }
}

// פונקציה להדגשת תא יעד
function highlightTargetCell(x, y) {
  // איפוס הדגשות קודמות
  document.querySelectorAll('.task-cell').forEach(cell => {
    cell.classList.remove('bg-blue-50');
  });
  
  // חיפוש התא שנמצא תחת מיקום המגע
  const targetCell = findTargetCell(x, y);
  
  // הדגשת התא אם נמצא
  if (targetCell) {
    targetCell.classList.add('bg-blue-50');
  }
}

// פונקציה למציאת תא יעד
function findTargetCell(x, y) {
  let targetCell = null;
  
  document.querySelectorAll('.task-cell').forEach(cell => {
    const rect = cell.getBoundingClientRect();
    if (
      x >= rect.left && 
      x <= rect.right && 
      y >= rect.top && 
      y <= rect.bottom
    ) {
      targetCell = cell;
    }
  });
  
  return targetCell;
}

// פונקציה לעיבוד שחרור גרירה במובייל
function processMobileDrop(targetCell) {
  if (!targetCell || !mobileDraggedSoldierId) return;
  
  // קבלת נתוני התא
  const taskId = targetCell.dataset.taskId;
  const dateStr = targetCell.dataset.date;
  
  if (!taskId || !dateStr) {
    console.error("נתוני התא חסרים:", targetCell);
    return;
  }
  
  // שמירת המידע הנוכחי עבור הדיאלוג
  currentQuickAdd.taskId = taskId;
  currentQuickAdd.date = dateStr;
  currentQuickAdd.selectedSoldiers = [mobileDraggedSoldierId];
  
  console.log("שחרור גרירה במובייל:", {
    taskId: taskId,
    date: dateStr,
    soldierId: mobileDraggedSoldierId
  });
  
  // פתיחת דיאלוג בחירת סוג השיבוץ
  document.getElementById('assignmentTypeDialog')?.classList.remove('hidden');
  document.getElementById('assignmentTypeDialog').style.display = 'flex';
}

// פונקציה לסיום גרירה במובייל
function endMobileDrag() {
  // איפוס הדגשות תאים
  document.querySelectorAll('.task-cell').forEach(cell => {
    cell.classList.remove('bg-blue-50');
  });
  
  // הסרת סגנון גרירה מהאלמנט המקורי
  const draggedElement = document.getElementById(`soldier-${mobileDraggedSoldierId}`);
  if (draggedElement) {
    draggedElement.classList.remove('dragging');
  }
  
  // הסתרת אינדיקטור הגרירה
  const indicator = document.getElementById('mobileDragIndicator');
  if (indicator) {
    indicator.classList.remove('visible');
  }
  
  // איפוס מזהה החייל הנגרר
  mobileDraggedSoldierId = null;
}



// פונקציה להתאמת פריסת הממשק למובייל
function adjustMobileLayout() {
  // התאמת גודל פונט וכפתורים
  if (window.innerWidth < 480) {
    document.documentElement.style.fontSize = '14px';
    
    // הקטנת רווחים בטבלה
    document.querySelectorAll('th, td').forEach(cell => {
      cell.style.padding = '0.25rem';
    });
    
    // התאמת כפתורים
    document.querySelectorAll('.button').forEach(button => {
      button.classList.add('button-sm');
    });
  }
  
  // בדיקה אם המסך צר במיוחד ומעבר לתצוגה מצומצמת
  if (window.innerWidth < 360) {
    document.querySelectorAll('.calendar-header').forEach(header => {
      header.style.flexDirection = 'column';
      header.style.gap = '0.5rem';
    });
  }
}

// פונקציה להגדרת מאזינים למגע במובייל
function setupMobileTouchHandlers() {
  // מניעת זום לא רצוי
  document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
      // מניעת מולטי-טאץ' בזמן גרירה
      if (mobileDraggedSoldierId !== null) {
        e.preventDefault();
      }
    }
  }, { passive: false });
  
  // טיפול בשגיאות מגע
  document.addEventListener('touchcancel', function() {
    // ניקוי מצב הגרירה במקרה של ביטול מגע
    if (mobileDraggedSoldierId !== null) {
      endMobileDrag();
    }
  });
}



// פונקציה המגיבה לשינויי גודל מסך
function handleResize() {
  // התאמות לגודל המסך הנוכחי
  adjustMobileLayout();
  
  // רינדור מחדש של לוח השנה עם התאמות גודל תאים
  renderCalendar();
}

// הוספת מאזין לשינוי גודל חלון
window.addEventListener('resize', function() {
  // דחיית פעולות כבדות בעת שינוי גודל
  if (this.resizeTimer) clearTimeout(this.resizeTimer);
  this.resizeTimer = setTimeout(handleResize, 300);
});

// -------------------------------------
// פונקציות דוחות
// לוגיקה לתפריט נפתח של דוחות
document.addEventListener('DOMContentLoaded', () => {
  const reportsDropdownBtn = document.getElementById('reportsDropdownBtn');
  const reportsDropdown = document.getElementById('reportsDropdown');

  // פתיחה וסגירה של התפריט הנפתח
  reportsDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      reportsDropdown.classList.toggle('hidden');
  });

  // סגירת התפריט בלחיצה מחוץ לתפריט
  document.addEventListener('click', (e) => {
      if (!reportsDropdown.contains(e.target) && !reportsDropdownBtn.contains(e.target)) {
          reportsDropdown.classList.add('hidden');
      }
  });

  // מניעת סגירת התפריט בלחיצה על פריט בתפריט
  reportsDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
  });
});
// -------------------------------------
// יש להוסיף אחרי toggleReportView כדי לקרוא לפונקציית הדיבוג
function toggleReportView(reportType) {
  const reportView = document.getElementById('reportView');
  const semiAnnualReportView = document.getElementById('semiAnnualReportView');
  const weeklySummaryView = document.getElementById('weeklySummaryView');
  const schedulerView = document.getElementById('schedulerView');
  
  // הסתרת כל התצוגות
  reportView.classList.add('hidden');
  semiAnnualReportView.classList.add('hidden');
  weeklySummaryView.classList.add('hidden');
  schedulerView.classList.add('hidden');
  
  // טעינת מאגר שמות החיילים הגלובלי לפני הפקת כל דוח
  loadSoldierNamesMap();
  console.log("מאגר שמות החיילים נטען בהצלחה לפני הפקת הדוח");
  
  // הפעלת פונקציית דיבוג לבדיקת מאגר השמות
  testReportSoldiers();
  
  if (reportType === 'regular') {
    // הפעלת בדיקה אבחונית לפני הצגת הדוח
    debugSoldiersAndAssignments();
    
    // תצוגת דוח יומי
    reportView.classList.remove('hidden');
    renderReport();
  } else if (reportType === 'semiAnnual') {
    // תצוגת דוח חצי שנתי
    semiAnnualReportView.classList.remove('hidden');
    renderSemiAnnualReport();
  } else if (reportType === 'weekly') {
    // תצוגת סיכום שבועי
    weeklySummaryView.classList.remove('hidden');
    renderWeeklySummary();
  } else {
    // חזרה ללוח
    schedulerView.classList.remove('hidden');
  }
  
  // עדכון כל הכפתורים
  updateReportButtons(reportType);
}
// פונקציה לעדכון כפתורי הדוחות
function updateReportButtons(currentView) {
  const toggleReportBtn = document.getElementById('toggleReport');
  const toggleSemiAnnualBtn = document.getElementById('toggleSemiAnnualReport');
  const toggleWeeklySummaryBtn = document.getElementById('toggleWeeklySummary');
  
  // איפוס כל הכפתורים לתצוגה רגילה
  toggleReportBtn.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <path d="M14 2v6h6"></path>
      <path d="M16 13H8"></path>
      <path d="M16 17H8"></path>
      <path d="M10 9H8"></path>
    </svg>
    <span>דוח יומי</span>
  `;
  
  toggleWeeklySummaryBtn.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <path d="M14 2v6h6"></path>
      <path d="M16 13H8"></path>
      <path d="M16 17H8"></path>
      <path d="M10 9H8"></path>
    </svg>
    <span>דוח שבועי</span>
  `;

  toggleSemiAnnualBtn.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <path d="M14 2v6h6"></path>
      <path d="M16 13H8"></path>
      <path d="M16 17H8"></path>
      <path d="M10 9H8"></path>
    </svg>
    <span>דוח חצי שנתי</span>
  `;
}
// פונקציה עזר משופרת לנרמול IDs והתאמה לחיילים
function createNormalizedSoldiersMap() {
    const soldiersMap = {};
    soldiers.forEach(soldier => {
        soldiersMap[soldier.id] = soldier; // שמור את החייל כולו ולא רק את השם
    });
    return soldiersMap; // החזר אובייקט רגיל
}


// הטמעה ישירה של פתרון הדוחות - להחלפה מלאה של הפונקציות הקיימות

// פונקציה לרינדור דוח יומי - חדש לגמרי
// פונקציה משופרת לרינדור דוח יומי
function renderReport() {
  console.log("מפיק דוח יומי משופר...");
  
  // בדיקה בסיסית שיש נתונים
  if (!tasks || !tasks.length) {
    console.warn("אין משימות במערכת להצגה בדוח");
  }
  
  if (!assignments || !assignments.length) {
    console.warn("אין שיבוצים במערכת להצגה בדוח");
  }
  
  const reportContent = document.getElementById('reportContent');
  if (!reportContent) {
    console.error("לא נמצא אלמנט reportContent");
    return;
  }
  
  // איפוס תוכן הדוח
  reportContent.innerHTML = '';
  
  // וידוא שמאגר השמות טעון
  loadSoldierNamesMap();
  
  // כותרת הדוח
  const reportTitle = document.createElement('h3');
  reportTitle.className = 'text-xl font-bold mb-4 text-center';
  reportTitle.textContent = 'דוח יומי לפעילות חיילים';
  reportContent.appendChild(reportTitle);
  
  // תאריך הדוח
  const today = new Date();
  const todayISOString = formatDateISO(today);
  const dateDisplay = document.createElement('div');
  dateDisplay.className = 'text-lg font-medium mb-6 text-center';
  dateDisplay.textContent = formatDateHebrew(todayISOString);
  reportContent.appendChild(dateDisplay);
  
  // חיפוש שיבוצים של היום
  const todayAssignments = assignments.filter(a => a.date === todayISOString);
  
  console.log(`נמצאו ${todayAssignments.length} שיבוצים להיום`);
  
  if (todayAssignments.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-center py-4 bg-gray-50 rounded-lg';
    emptyMessage.textContent = 'אין שיבוצים להיום';
    reportContent.appendChild(emptyMessage);
    return;
  }
  
  // מיכל לשני חלקי הדוח
  const reportContainer = document.createElement('div');
  reportContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';
  
  // חלק 1: טבלת שיבוצים לפי משימות
  const tasksSection = createTasksSection(todayAssignments);
  
  // חלק 2: סיכום חיילים משובצים
  const soldiersSection = createSoldiersSection(todayAssignments);
  
  // הוספת שני החלקים למיכל
  reportContainer.appendChild(tasksSection);
  reportContainer.appendChild(soldiersSection);
  
  // הוספת המיכל לדוח
  reportContent.appendChild(reportContainer);
  
  console.log("הדוח היומי הופק בהצלחה");
}

// פונקציה ליצירת חלק המשימות בדוח
function createTasksSection(todayAssignments) {
  const tasksSection = document.createElement('div');
  tasksSection.className = 'bg-white p-4 rounded-lg shadow';
  
  const tasksSectionTitle = document.createElement('h4');
  tasksSectionTitle.className = 'text-lg font-bold mb-4';
  tasksSectionTitle.textContent = 'שיבוצים לפי משימות';
  tasksSection.appendChild(tasksSectionTitle);
  
  // יצירת טבלת משימות
  const table = document.createElement('table');
  table.className = 'w-full border-collapse';
  
  // כותרות טבלה
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const taskHeader = document.createElement('th');
  taskHeader.className = 'border p-2 bg-gray-100 w-1/3';
  taskHeader.textContent = 'משימה';
  headerRow.appendChild(taskHeader);
  
  const soldiersHeader = document.createElement('th');
  soldiersHeader.className = 'border p-2 bg-gray-100';
  soldiersHeader.textContent = 'חיילים משובצים';
  headerRow.appendChild(soldiersHeader);
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // גוף הטבלה
  const tbody = document.createElement('tbody');
  const assignedSoldiers = new Map(); // מפה לשמירת כל החיילים המשובצים
  
  // מיון המשימות לפי שם
  const sortedTasks = [...tasks].sort((a, b) => a.name.localeCompare(b.name));
  
  // מעבר על כל המשימות
  sortedTasks.forEach(task => {
    const row = document.createElement('tr');
    
    // תא שם המשימה
    const nameCell = document.createElement('td');
    nameCell.className = 'border p-2 font-bold bg-gray-50';
    nameCell.textContent = task.name;
    row.appendChild(nameCell);
    
    // תא שיבוץ
    const cell = document.createElement('td');
    cell.className = 'border p-2';
    
    // חיפוש השיבוץ המתאים - עם בדיקת מזהים מנורמלים
    const assignment = todayAssignments.find(a => normalizeId(a.taskId) === normalizeId(task.id));
    
    if (assignment && assignment.soldierIds && assignment.soldierIds.length > 0) {
      const names = [];
      
      // מיון החיילים לפי תפקיד
      const sortedSoldierIds = [...assignment.soldierIds].sort((idA, idB) => {
        const soldierA = getSoldierById(idA);
        const soldierB = getSoldierById(idB);
        
        if (!soldierA || !soldierB) return 0;
        
        const roleOrder = { doctor: 1, paramedic: 2, mentor: 3, trainee: 4 };
        const roleA = roleOrder[soldierA.role] || 5;
        const roleB = roleOrder[soldierB.role] || 5;
        
        if (roleA !== roleB) return roleA - roleB;
        
        return (soldierA.firstName || '').localeCompare(soldierB.firstName || '');
      });
      
      // הצגת החיילים בטבלה
      sortedSoldierIds.forEach(soldierId => {
        const soldier = getSoldierById(soldierId);
        
        if (soldier) {
          const fullName = `${soldier.firstName || ''} ${soldier.lastName || ''}`.trim();
          const role = soldier.role || '';
          
          if (fullName) {
            names.push(`<span class="${role}">${fullName}</span>`);
            
            // הוספה למפת החיילים המשובצים
            if (!assignedSoldiers.has(normalizeId(soldierId))) {
              assignedSoldiers.set(normalizeId(soldierId), { 
                name: fullName, 
                role: role, 
                tasks: [task.name] 
              });
            } else {
              // הוספת המשימה הנוכחית לרשימת המשימות של החייל
              assignedSoldiers.get(normalizeId(soldierId)).tasks.push(task.name);
            }
          }
        }
      });
      
      if (names.length > 0) {
        cell.innerHTML = names.join(', ');
      } else {
        cell.innerHTML = '<span class="text-gray-300">-</span>';
      }
    } else {
      cell.innerHTML = '<span class="text-gray-300">-</span>';
    }
    
    row.appendChild(cell);
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  tasksSection.appendChild(table);
  
  return tasksSection;
}

// פונקציה ליצירת חלק החיילים בדוח
function createSoldiersSection(todayAssignments) {
  const soldiersSection = document.createElement('div');
  soldiersSection.className = 'bg-white p-4 rounded-lg shadow';
  
  const soldiersSectionTitle = document.createElement('h4');
  soldiersSectionTitle.className = 'text-lg font-bold mb-4';
  soldiersSectionTitle.textContent = 'סיכום חיילים משובצים היום';
  soldiersSection.appendChild(soldiersSectionTitle);
  
  // איסוף כל החיילים המשובצים
  const assignedSoldiers = new Map();
  
  // מעבר על כל השיבוצים והחיילים בהם
  todayAssignments.forEach(assignment => {
    if (!assignment.soldierIds || !Array.isArray(assignment.soldierIds)) {
      return;
    }
    
    const taskObj = tasks.find(t => normalizeId(t.id) === normalizeId(assignment.taskId));
    const taskName = taskObj ? taskObj.name : 'משימה לא ידועה';
    
    assignment.soldierIds.forEach(soldierId => {
      const normalizedId = normalizeId(soldierId);
      const soldier = getSoldierById(normalizedId);
      
      if (soldier) {
        const fullName = `${soldier.firstName || ''} ${soldier.lastName || ''}`.trim();
        const role = soldier.role || '';
        
        if (!assignedSoldiers.has(normalizedId)) {
          assignedSoldiers.set(normalizedId, {
            name: fullName,
            role: role,
            tasks: [taskName]
          });
        } else {
          // הוספת המשימה הנוכחית אם היא לא קיימת כבר
          const existingData = assignedSoldiers.get(normalizedId);
          if (!existingData.tasks.includes(taskName)) {
            existingData.tasks.push(taskName);
          }
        }
      }
    });
  });
  
  // בדיקה אם יש חיילים משובצים
  if (assignedSoldiers.size > 0) {
    // מיון החיילים לפי תפקיד
    const roleGroups = {
      doctor: { label: 'רופאים', soldiers: [] },
      paramedic: { label: 'פראמדיקים', soldiers: [] },
      trainee: { label: 'חניכים', soldiers: [] },
      mentor: { label: 'חונכים', soldiers: [] },
      other: { label: 'אחר', soldiers: [] }
    };
    
    // מיון החיילים לקבוצות
    assignedSoldiers.forEach((data, id) => {
      const targetGroup = roleGroups[data.role] || roleGroups.other;
      targetGroup.soldiers.push({
        name: data.name,
        tasks: data.tasks
      });
    });
    
    // יצירת רשימות לפי תפקיד
    Object.entries(roleGroups).forEach(([role, group]) => {
      if (group.soldiers.length > 0) {
        const roleTitle = document.createElement('div');
        roleTitle.className = `font-bold mt-4 mb-2 ${role}`;
        roleTitle.textContent = group.label;
        soldiersSection.appendChild(roleTitle);
        
        // מיון חיילים לפי שם
        group.soldiers.sort((a, b) => a.name.localeCompare(b.name));
        
        const soldiersList = document.createElement('div');
        soldiersList.className = 'space-y-2';
        
        group.soldiers.forEach(soldier => {
          const soldierItem = document.createElement('div');
          soldierItem.className = 'bg-gray-50 p-2 rounded';
          soldierItem.innerHTML = `
            <span class="font-medium">${soldier.name}</span>
            <div class="text-sm text-gray-600 mt-1">משימות: ${soldier.tasks.join(', ')}</div>
          `;
          soldiersList.appendChild(soldierItem);
        });
        
        soldiersSection.appendChild(soldiersList);
      }
    });
  } else {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-gray-500 text-center py-4';
    emptyMessage.textContent = 'אין חיילים משובצים להיום';
    soldiersSection.appendChild(emptyMessage);
  }
  
  return soldiersSection;
}

// פונקציה משופרת לייצוא הדוח הרגיל לאקסל
function exportToExcel() {
  console.log("מייצא דוח לאקסל...");
  
  try {
    // וידוא שספריית XLSX קיימת
    if (typeof XLSX === 'undefined') {
      console.error("ספריית XLSX לא נטענה!");
      showNotification('לא ניתן לייצא לאקסל - הספרייה הנדרשת חסרה', 'error');
      return;
    }
    
    // וידוא שיש נתונים לייצוא
    if (!tasks || !tasks.length) {
      showNotification('אין משימות במערכת לייצוא', 'warning');
      return;
    }
    
    if (!assignments || !assignments.length) {
      showNotification('אין שיבוצים במערכת לייצוא', 'warning');
      return;
    }
    
    // רענון מאגר השמות
    loadSoldierNamesMap();
    
    // קבלת רשימת תאריכים ייחודיים ומיונם
    const uniqueDates = [...new Set(assignments.map(a => a.date))].sort();
    
    // הכנת נתונים לייצוא
    const exportData = [];
    
    // כותרות - שורה ראשונה
    const headers = ['משימה'];
    uniqueDates.forEach(dateStr => {
      headers.push(formatDateHebrew(dateStr));
    });
    exportData.push(headers);
    
    // נתונים לפי משימות
    tasks.forEach(task => {
      const row = [task.name];
      
      uniqueDates.forEach(dateStr => {
        // חיפוש שיבוץ למשימה בתאריך
        const assignment = assignments.find(a => 
          normalizeId(a.taskId) === normalizeId(task.id) && a.date === dateStr
        );
        
        if (assignment && assignment.soldierIds && assignment.soldierIds.length > 0) {
          // איסוף שמות החיילים
          const soldierNames = assignment.soldierIds
            .map(soldierId => getSoldierName(soldierId))
            .filter(name => name !== 'שם לא זמין')
            .join(', ');
          
          row.push(soldierNames || '');
        } else {
          row.push('');
        }
      });
      
      exportData.push(row);
    });
    
    // יצירת Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    
    // הגדרת כיוון RTL והגדרות עיצוב
    ws['!cols'] = [
      { wch: 20 }, // רוחב עמודת משימה
      ...uniqueDates.map(() => ({ wch: 30 })) // רוחב עמודות תאריכים
    ];
    
    // הוספת הגיליון ל-Workbook
    XLSX.utils.book_append_sheet(wb, ws, "דוח משימות");
    
    // ייצוא הקובץ
    try {
      XLSX.writeFile(wb, "דוח_משימות.xlsx");
      showNotification('הדוח יוצא בהצלחה', 'success');
    } catch (error) {
      console.error("שגיאה בכתיבת קובץ אקסל:", error);
      showNotification('אירעה שגיאה בייצוא הקובץ: ' + error.message, 'error');
    }
  } catch (error) {
    console.error("שגיאה בייצוא לאקסל:", error);
    showNotification('אירעה שגיאה בייצוא הדוח: ' + error.message, 'error');
  }
}
// אפשר להוסיף פונקציה שתתבצע מיד אחרי הטענת נתוני החיילים משרת ה-Firestore
function afterSoldiersDataLoaded() {
  console.log("פונקציית התראה - נתוני החיילים נטענו");
  
  // טעינת מאגר השמות הגלובלי
  loadSoldierNamesMap();
  console.log("מאגר שמות החיילים הגלובלי נטען");
  
  // תזמון רענון תקופתי של המאגר
  setInterval(() => {
    loadSoldierNamesMap();
    console.log("מאגר שמות החיילים התעדכן תקופתית");
  }, 60000); // רענון כל דקה
}

// פונקציה לדיבוג אינטראקטיבית לבדיקת שליפת שמות
function testNameRetrieval(soldierId) {
  console.log("בדיקת שליפת שם עבור ID:", soldierId);
  
  // 1. בדיקה מהמאגר הגלובלי
  console.log("שליפה ממאגר גלובלי:", soldierNamesMap[soldierId]);
  console.log("שליפה ממאגר גלובלי כמחרוזת:", soldierNamesMap[String(soldierId)]);
  
  // 2. בדיקה באמצעות חיפוש ישיר
  const directSoldier = soldiers.find(s => String(s.id) === String(soldierId));
  console.log("חיפוש ישיר במערך החיילים:", directSoldier);
  
  // 3. בדיקה באמצעות הפונקציה המשופרת
  console.log("שליפה באמצעות פונקציית getSoldierName:", getSoldierName(soldierId));
  
  return "בדיקת השליפה הושלמה - ראה פלט בקונסולה";
}

// פונקציה לבדיקת מצב השיבוצים
function checkAssignmentsStatus() {
  console.log("בדיקת מצב השיבוצים:");
  
  if (!assignments || assignments.length === 0) {
    console.log("אין שיבוצים במערכת!");
    return "אין שיבוצים";
  }
  
  console.log(`יש ${assignments.length} שיבוצים במערכת`);
  
  // מבנה של השיבוץ הראשון לדוגמה
  const sampleAssignment = assignments[0];
  console.log("מבנה שיבוץ לדוגמה:", sampleAssignment);
  
  // בדיקת סוגי המזהים
  if (sampleAssignment.soldierIds && sampleAssignment.soldierIds.length > 0) {
    const types = sampleAssignment.soldierIds.map(id => typeof id);
    console.log("סוגי מזהים בשיבוץ:", types);
    
    // נסיון למצוא את החיילים
    sampleAssignment.soldierIds.forEach(id => {
      const soldierName = getSoldierName(id);
      console.log(`חייל עם ID ${id} (${typeof id}): ${soldierName}`);
    });
  }
}

// פונקציה לשיפור נתוני השיבוצים שכבר קיימים במערכת
function enhanceAssignmentsData() {
  console.log("משפר נתוני שיבוצים...");
  
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    console.log("אין שיבוצים לשפר");
    return;
  }
  
  // ודא שמאגר שמות החיילים טעון
  loadSoldierNamesMap();
  
  // מעבר על כל השיבוצים
  let modifiedCount = 0;
  
  assignments.forEach(assignment => {
    if (assignment && assignment.soldierIds && Array.isArray(assignment.soldierIds)) {
      // המרת כל מזהי החיילים למחרוזות (למניעת בעיות השוואה)
      assignment.soldierIds = assignment.soldierIds.map(id => String(id));
      
      // אפשרות להוסיף מידע נוסף לשיבוץ (שמות החיילים למשל)
      // בדרך כלל המליץ לא לשמור מידע כפול, אבל במקרה הזה זה יכול לחסוך בעיות תאימות
      if (!assignment.soldierNames) {
        assignment.soldierNames = {};
        
        assignment.soldierIds.forEach(id => {
          const name = getSoldierName(id);
          if (name && name !== 'שם לא זמין') {
            assignment.soldierNames[id] = name;
          }
        });
        
        modifiedCount++;
      }
    }
  });
  
  console.log(`שופרו ${modifiedCount} שיבוצים`);
  return assignments;
}

// פונקציה המיועדת להיקרא בעת טעינת נתוני הדף
function initializeReports() {
  console.log("מאתחל מערכת דוחות...");
  
  // הגדרת מאזין לאירוע שינוי בתצוגת הדוחות
  const toggleReportBtn = document.getElementById('toggleReport');
  const toggleSemiAnnualBtn = document.getElementById('toggleSemiAnnualReport');
  const toggleWeeklySummaryBtn = document.getElementById('toggleWeeklySummary');
  
  if (toggleReportBtn) {
    toggleReportBtn.addEventListener('click', () => {
      // רענון מאגר שמות החיילים לפני הצגת הדוח
      loadSoldierNamesMap();
      toggleReportView('regular');
    });
  }
  
  if (toggleSemiAnnualBtn) {
    toggleSemiAnnualBtn.addEventListener('click', () => {
      // רענון מאגר שמות החיילים לפני הצגת הדוח
      loadSoldierNamesMap();
      toggleReportView('semiAnnual');
    });
  }
  
  if (toggleWeeklySummaryBtn) {
    toggleWeeklySummaryBtn.addEventListener('click', () => {
      // רענון מאגר שמות החיילים לפני הצגת הדוח
      loadSoldierNamesMap();
      toggleReportView('weekly');
    });
  }
}
// פונקציה לרינדור דוח שבועי - חדש לגמרי
function renderWeeklySummary() {
  console.log("מפיק דוח שבועי משופר...");
  const reportContent = document.getElementById('weeklySummaryContent');
  if (!reportContent) {
    console.error("לא נמצא אלמנט weeklySummaryContent");
    return;
  }
  
  reportContent.innerHTML = '';
  
  // טעינה מחדש של מאגר השמות לפני הרינדור
  loadSoldierNamesMap();
  
  // כותרת הדוח
  const reportTitle = document.createElement('h3');
  reportTitle.className = 'text-xl font-bold mb-4 text-center';
  reportTitle.textContent = 'סיכום שבועי לפי משימות';
  reportContent.appendChild(reportTitle);
  
  // תאריכי השבוע - מתחיל מיום חמישי
  const today = new Date(currentWeek);
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  // מחשב את ההפרש לתחילת השבוע (יום חמישי)
  const diff = dayOfWeek >= 4 ? dayOfWeek - 4 : dayOfWeek + 3;
  startOfWeek.setDate(today.getDate() - diff);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  const subtitle = document.createElement('div');
  subtitle.className = 'text-lg font-medium mb-6 text-center';
  subtitle.textContent = `${formatDateHebrew(formatDateISO(startOfWeek))} - ${formatDateHebrew(formatDateISO(endOfWeek))}`;
  reportContent.appendChild(subtitle);
  
  // איסוף כל התאריכים בשבוע - מתחיל מיום חמישי
  const weekDates = [];
  const weekDayNames = ['חמישי', 'שישי', 'שבת', 'ראשון', 'שני', 'שלישי', 'רביעי'];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    weekDates.push({
      date: formatDateISO(date),
      dayName: weekDayNames[i]
    });
  }
  
  // סינון השיבוצים לשבוע הנוכחי
  const weeklyAssignments = assignments.filter(a => weekDates.map(d => d.date).includes(a.date));
  
  if (weeklyAssignments.length === 0) {
    reportContent.innerHTML += '<div class="text-center py-4">אין שיבוצים לשבוע הנוכחי</div>';
    return;
  }
  
  // יצירת מפת חיילים
  const soldiersMap = new Map();
  if (soldiers && Array.isArray(soldiers)) {
    soldiers.forEach(soldier => {
      if (soldier && soldier.id) {
        soldiersMap.set(String(soldier.id), soldier);
      }
    });
  }
  
  // יצירת טבלה
  const table = document.createElement('table');
  table.className = 'w-full border-collapse mb-8';
  
  // כותרות
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // תא משימה
  const taskHeader = document.createElement('th');
  taskHeader.className = 'border p-2 bg-gray-100';
  taskHeader.textContent = 'משימה';
  headerRow.appendChild(taskHeader);
  
  // תאי ימים
  weekDates.forEach(({ dayName, date }) => {
    const th = document.createElement('th');
    th.className = 'border p-2 bg-gray-100';
    th.innerHTML = `${dayName}<br><span class="text-sm">${formatDateHebrew(date)}</span>`;
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // גוף הטבלה
  const tbody = document.createElement('tbody');
  
  // מעבר על כל המשימות
  tasks.forEach(task => {
    const row = document.createElement('tr');
    
    // תא שם המשימה
    const taskCell = document.createElement('td');
    taskCell.className = 'border p-2 font-bold bg-gray-50';
    taskCell.textContent = task.name;
    row.appendChild(taskCell);
    
    // תאים לכל יום
    weekDates.forEach(({ date }) => {
      const cell = document.createElement('td');
      cell.className = 'border p-2';
      
      // מציאת השיבוץ ליום זה
      const dayAssignment = weeklyAssignments.find(a => a.date === date && String(a.taskId) === String(task.id));
      
      if (dayAssignment && dayAssignment.soldierIds && dayAssignment.soldierIds.length > 0) {
        const uniqueSoldiers = new Set();
        dayAssignment.soldierIds.forEach(soldierId => {
          const soldier = soldiersMap.get(String(soldierId));
          if (soldier) {
            uniqueSoldiers.add(`${soldier.firstName} ${soldier.lastName}`);
          }
        });
        
        if (uniqueSoldiers.size > 0) {
          cell.textContent = Array.from(uniqueSoldiers).join(', ');
        } else {
          cell.innerHTML = '<span class="text-gray-300">-</span>';
        }
      } else {
        cell.innerHTML = '<span class="text-gray-300">-</span>';
      }
      
      row.appendChild(cell);
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  reportContent.appendChild(table);
  
}



// פונקציה לבדיקת דיאגנוסטיקה - להפעלה בקונסולה
function debugReports() {
  console.log("=== בדיקת דיאגנוסטיקה לדוחות ===");
  console.log("מספר חיילים:", soldiers.length);
  console.log("מספר שיבוצים:", assignments.length);
  
  // בדיקת מבנה החיילים
  if (soldiers.length > 0) {
    console.log("דוגמה לחייל:", soldiers[0]);
    console.log("סוג ID של חייל:", typeof soldiers[0].id);
  }
  
  // בדיקת מבנה השיבוצים
  if (assignments.length > 0) {
    console.log("דוגמה לשיבוץ:", assignments[0]);
    
    // בדיקת מערך החיילים בשיבוץ
    const assignment = assignments[0];
    if (assignment.soldierIds && assignment.soldierIds.length > 0) {
      console.log("מערך soldierIds:", assignment.soldierIds);
      console.log("סוג של ID הראשון:", typeof assignment.soldierIds[0]);
      
      // נסה למצוא את החייל הראשון
      const soldierId = assignment.soldierIds[0];
      console.log(`חיפוש חייל עם ID ${soldierId} (${typeof soldierId})`);
      
      // חיפוש ישיר
      const directSoldier = soldiers.find(s => s.id === soldierId);
      console.log("חייל נמצא בחיפוש ישיר:", directSoldier ? "כן" : "לא");
      
      // חיפוש אחרי נרמול
      const stringId = String(soldierId);
      const normalizedSoldier = soldiers.find(s => String(s.id) === stringId);
      console.log("חייל נמצא אחרי נרמול:", normalizedSoldier ? "כן" : "לא");
      
      // שימוש במפה
      const soldiersMap = createNormalizedSoldiersMap();
      const mappedSoldier = soldiersMap.get(soldierId) || soldiersMap.get(String(soldierId));
      console.log("חייל נמצא במפה:", mappedSoldier ? "כן" : "לא");
      
      // בדיקת פונקציית getSoldierName
      const soldierName = getSoldierName(soldierId);
      console.log(`שם החייל מפונקציית getSoldierName: "${soldierName}"`);
    }
  }
  
  console.log("=== סיום בדיקת דיאגנוסטיקה ===");
  return "בדיקת דיאגנוסטיקה הושלמה. בדוק את הקונסולה לתוצאות.";
}

// פונקציה עזר אבחונית עם מידע מורחב יותר
function debugSoldiersAndAssignments() {
  console.log("=== מידע אבחוני על חיילים ושיבוצים ===");
  
  // בדיקה של מערך החיילים
  console.log(`סה"כ ${soldiers.length} חיילים במערכת`);
  if (soldiers.length > 0) {
    // הדפסת 3 הראשונים כדוגמה
    console.log("דוגמאות חיילים:", soldiers.slice(0, 3).map(s => ({
      id: s.id,
      typeOfId: typeof s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role
    })));
  }
  
  // בדיקה של מערך השיבוצים
  console.log(`סה"כ ${assignments.length} שיבוצים במערכת`);
  if (assignments.length > 0) {
    // הדפסת 3 הראשונים כדוגמה
    console.log("דוגמאות שיבוצים:", assignments.slice(0, 3).map(a => ({
      id: a.id,
      taskId: a.taskId,
      date: a.date,
      soldierIds: a.soldierIds,
      typesOfSoldierIds: a.soldierIds ? a.soldierIds.map(id => typeof id) : []
    })));
  }
  
  // בדיקת מפת חיילים מנורמלת
  const normalizedMap = createNormalizedSoldiersMap();
  console.log(`מפת חיילים מנורמלת מכילה ${Object.keys(normalizedMap).length} רשומות`);
  
  // בדיקת התאמה בין שיבוצים לחיילים
  if (assignments.length > 0 && soldiers.length > 0) {
    let totalSoldierIds = 0;
    let foundSoldiers = 0;
    let missingSoldiers = 0;
    
    assignments.forEach(assignment => {
      if (assignment.soldierIds && Array.isArray(assignment.soldierIds)) {
        assignment.soldierIds.forEach(soldierId => {
          totalSoldierIds++;
          
          // בדיקה אם החייל נמצא במפה המנורמלת - שימוש בגישה ישירה לאובייקט
          const soldier = normalizedMap[soldierId] || normalizedMap[String(soldierId)];
          
          if (soldier) {
            foundSoldiers++;
          } else {
            missingSoldiers++;
            console.warn(`חייל עם ID ${soldierId} (${typeof soldierId}) לא נמצא!`);
          }
        });
      }
    });
    
    console.log(`סה"כ נבדקו ${totalSoldierIds} מזהי חיילים בשיבוצים`);
    console.log(`נמצאו ${foundSoldiers} חיילים (${(foundSoldiers/totalSoldierIds*100).toFixed(1)}%)`);
    console.log(`חסרים ${missingSoldiers} חיילים (${(missingSoldiers/totalSoldierIds*100).toFixed(1)}%)`);
    
    // הצגת דוגמה לשיבוץ ובדיקת החיילים בו
    const sampleAssignment = assignments[0];
    if (sampleAssignment && sampleAssignment.soldierIds && sampleAssignment.soldierIds.length > 0) {
      console.log("בדיקת החיילים בשיבוץ לדוגמה:");
      sampleAssignment.soldierIds.forEach(soldierId => {
        const soldierName = getSoldierName(soldierId, normalizedMap);
        console.log(`- חייל ID=${soldierId} (${typeof soldierId}): ${soldierName || 'לא נמצא'}`);
      });
    }
  }
  
  console.log("=== סיום מידע אבחוני ===");
}


// פונקציה לייצוא הדוח החצי שנתי לאקסל
// פונקציה לייצוא הדוח החצי שנתי לאקסל - עם תיקון ותוספת ספירת ימים
// פונקציה לרינדור דוח חצי שנתי - התייחסות לחודשים מלאים
function renderSemiAnnualReport() {
  console.log("מפיק דוח חצי שנתי עם טווח תאריכים ורשימת חיילים");

  const reportContent = document.getElementById('semiAnnualReportContent');
  if (!reportContent) {
    console.error("לא נמצא אלמנט semiAnnualReportContent");
    return;
  }
  reportContent.innerHTML = '';

  // עדכון מאגר שמות החיילים
  loadSoldierNamesMap();

  // חישוב 6 חודשים מלאים (כולל חודש נוכחי)
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-11
  const currentYear = today.getFullYear();
  const months = [];
  for (let i = 0; i < 6; i++) {
    let monthIndex = currentMonth - i;
    let year = currentYear;
    if (monthIndex < 0) {
      monthIndex += 12;
      year -= 1;
    }
    months.push({
      month: monthIndex,
      year: year,
      key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    });
  }

  // לסדר את החודשים בסדר עולה כדי לחשב את טווח התאריכים
  const sortedMonths = months.slice().sort((a, b) => {
    if (a.year === b.year) return a.month - b.month;
    return a.year - b.year;
  });

  // התאריך ההתחלתי הוא היום הראשון של החודש הראשון
  const startMonthObj = sortedMonths[0];
  const startDate = new Date(startMonthObj.year, startMonthObj.month, 1);
  // התאריך הסופי הוא היום האחרון של החודש האחרון
  const endMonthObj = sortedMonths[sortedMonths.length - 1];
  const endDate = new Date(endMonthObj.year, endMonthObj.month + 1, 0);

  // עיצוב תאריכים (באזור הזמן העברי)
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const startDateStr = startDate.toLocaleDateString('he-IL', options);
  const endDateStr = endDate.toLocaleDateString('he-IL', options);

  // כותרת הדוח עם טווח התאריכים
  const reportTitle = document.createElement('h3');
  reportTitle.className = 'text-xl font-bold mb-2 text-center';
  reportTitle.textContent = 'דוח חצי שנתי';
  reportContent.appendChild(reportTitle);

  const dateRangeInfo = document.createElement('div');
  dateRangeInfo.className = 'text-center text-sm mb-4';
  dateRangeInfo.textContent = `טווח התאריכים: ${startDateStr} - ${endDateStr}`;
  reportContent.appendChild(dateRangeInfo);

  // בניית מערך מפתחות החודשים הזמינים (לסינון השיבוצים)
  const allowedMonthKeys = new Set(months.map(m => m.key));

  // יצירת מפה של חיילים עם סט תאריכים (לספירת ימי השיבוץ הייחודיים)
  const soldierTotals = {};
  const soldiersObj = {};
  soldiers.forEach(soldier => {
    if (soldier && soldier.id) {
      soldiersObj[soldier.id] = soldier;
      soldiersObj[String(soldier.id)] = soldier;
    }
  });

  // מעבר על כל השיבוצים ובדיקה אם הם נופלים בטווח ה-6 חודשים
  assignments.forEach(assignment => {
    if (!assignment.date) return;
    try {
      const assignmentDate = new Date(assignment.date);
      const monthKey = `${assignmentDate.getFullYear()}-${String(assignmentDate.getMonth() + 1).padStart(2, '0')}`;
      if (allowedMonthKeys.has(monthKey)) {
        if (assignment.soldierIds && Array.isArray(assignment.soldierIds)) {
          assignment.soldierIds.forEach(soldierId => {
            if (!soldierId) return;
            const soldierKey = String(soldierId);
            const soldier = soldiersObj[soldierId] || soldiersObj[soldierKey];
            if (soldier) {
              if (!soldierTotals[soldierKey]) {
                soldierTotals[soldierKey] = {
                  name: `${soldier.firstName || ''} ${soldier.lastName || ''}`.trim(),
                  dates: new Set()
                };
              }
              // הוספת התאריך לסט של הימים בהם החייל שובץ
              soldierTotals[soldierKey].dates.add(assignment.date);
            }
          });
        }
      }
    } catch (e) {
      console.error("שגיאה בעיבוד שיבוץ:", assignment, e);
    }
  });

  // יצירת רשימת חיילים עם מספר הימים בהם שובצו
  const soldierListContainer = document.createElement('div');
  soldierListContainer.className = 'mt-4';

  const soldierListTitle = document.createElement('h4');
  soldierListTitle.className = 'text-lg font-bold mb-2';
  soldierListTitle.textContent = 'רשימת חיילים עם סך ימי השיבוץ';
  soldierListContainer.appendChild(soldierListTitle);

  // יצירת טבלה להצגת הנתונים
  const table = document.createElement('table');
  table.className = 'w-full text-right border-collapse';

  // כותרת הטבלה
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['שם', 'ימי שיבוץ'].forEach(headerText => {
    const th = document.createElement('th');
    th.className = 'border px-2 py-1';
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // גוף הטבלה
  const tbody = document.createElement('tbody');
  // המרת הנתונים למערך ומיון לפי שם
  const soldierTotalsArray = Object.values(soldierTotals).sort((a, b) => a.name.localeCompare(b.name));
  soldierTotalsArray.forEach(soldierEntry => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.className = 'border px-2 py-1';
    nameTd.textContent = soldierEntry.name;
    tr.appendChild(nameTd);

    const daysTd = document.createElement('td');
    daysTd.className = 'border px-2 py-1';
    daysTd.textContent = soldierEntry.dates.size;
    tr.appendChild(daysTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  soldierListContainer.appendChild(table);
  reportContent.appendChild(soldierListContainer);

  console.log("דוח חצי שנתי עם טווח תאריכים ורשימת חיילים הופק בהצלחה");
}


// פונקציה לייצוא הדוח החצי שנתי לאקסל - מותאם לחודשים מלאים
function exportSemiAnnualToExcel() {
  console.log("מייצא דוח חצי שנתי לאקסל - לפי חודשים מלאים...");
  
  // חישוב טווח זמן של 6 חודשים מלאים
  const today = new Date();
  // חישוב החודש הנוכחי
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // ניצור מערך של 6 חודשים שלמים אחורה
  const months = [];
  for (let i = 0; i < 6; i++) {
    let monthIndex = currentMonth - i;
    let year = currentYear;
    
    // טיפול במעבר שנה
    if (monthIndex < 0) {
      monthIndex += 12;
      year -= 1;
    }
    
    months.push({
      month: monthIndex,
      year: year,
      key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    });
  }
  
  console.log("מייצר אקסל עבור החודשים:", months.map(m => m.key));
  
  // יצירת מפה של חיילים (כאובייקט רגיל)
  const soldiersObj = {};
  soldiers.forEach(soldier => {
    if (soldier && soldier.id) {
      soldiersObj[soldier.id] = soldier;
      soldiersObj[String(soldier.id)] = soldier;
    }
  });
  
  // ארגון נתונים לפי חודשים
  const monthlyData = {};
  const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  
  // אתחול מבנה נתונים לכל חודש
  months.forEach(monthInfo => {
    monthlyData[monthInfo.key] = {
      name: `${hebrewMonths[monthInfo.month]} ${monthInfo.year}`,
      assignments: {},
      totalAssignments: 0
    };
  });
  
  // סינון והוספת כל השיבוצים בטווח ששת החודשים האחרונים
  assignments.forEach(assignment => {
    if (!assignment.date || !assignment.taskId) return;
    
    try {
      const assignmentDate = new Date(assignment.date);
      const monthKey = `${assignmentDate.getFullYear()}-${String(assignmentDate.getMonth() + 1).padStart(2, '0')}`;
      
      // בדיקה אם החודש נמצא בטווח 6 החודשים שלנו
      if (monthlyData[monthKey]) {
        const monthData = monthlyData[monthKey];
        const taskId = String(assignment.taskId);
        
        // וידוא שיש מיפוי למשימה זו
        if (!monthData.assignments[taskId]) {
          monthData.assignments[taskId] = {
            taskName: '',
            soldiers: {}
          };
          
          // חיפוש שם המשימה
          const taskObj = tasks.find(t => String(t.id) === taskId);
          if (taskObj) {
            monthData.assignments[taskId].taskName = taskObj.name;
          }
        }
        
        // עדכון מונה השיבוצים
        monthData.totalAssignments++;
        
        // הוספת החיילים המשובצים
        if (assignment.soldierIds && Array.isArray(assignment.soldierIds)) {
          assignment.soldierIds.forEach(soldierId => {
            if (!soldierId) return;
            
            const soldierKey = String(soldierId);
            const soldier = soldiersObj[soldierId] || soldiersObj[soldierKey];
            
            if (soldier) {
              if (!monthData.assignments[taskId].soldiers[soldierKey]) {
                // הוספת החייל לראשונה
                monthData.assignments[taskId].soldiers[soldierKey] = {
                  name: `${soldier.firstName || ''} ${soldier.lastName || ''}`.trim(),
                  role: soldier.role || 'אחר',
                  dates: new Set()
                };
              }
              
              // הוספת התאריך לסט התאריכים של החייל
              monthData.assignments[taskId].soldiers[soldierKey].dates.add(assignment.date);
            }
          });
        }
      }
    } catch (e) {
      console.error("שגיאה בעיבוד שיבוץ:", assignment, e);
    }
  });
  
  // בדיקה אם יש נתונים כלשהם
  const hasData = Object.values(monthlyData).some(month => 
    Object.values(month.assignments).some(task => 
      Object.keys(task.soldiers || {}).length > 0
    )
  );
  
  if (!hasData) {
    showNotification('אין נתונים זמינים לייצוא דוח חצי שנתי', 'error');
    return;
  }
  
  // יצירת הנתונים לייצוא לאקסל - גיליון עבור כל חודש
  const wb = XLSX.utils.book_new();
  
  // מיון החודשים בסדר הפוך (מהחדש לישן)
  const sortedMonths = months.map(m => m.key);
  
  console.log("יוצר גיליונות לחודשים:", sortedMonths);
  
  // הכנת גיליון לכל חודש
  let sheetsAdded = 0;
  
  sortedMonths.forEach(monthKey => {
    const monthData = monthlyData[monthKey];
    
    console.log(`מכין נתונים לחודש: ${monthData.name}`);
    
    // ספירת משימות עם שיבוצים
    const tasksWithAssignmentsCount = Object.values(monthData.assignments).filter(task => 
      Object.keys(task.soldiers || {}).length > 0
    ).length;
    
    // אם אין שיבוצים בחודש זה, דלג
    if (tasksWithAssignmentsCount === 0) {
      console.log(`דילוג על חודש ${monthData.name} - אין שיבוצים`);
      return;
    }
    
    // מערך הנתונים לגיליון
    const sheetData = [];
    
    // כותרות
    sheetData.push(['משימה', 'חיילים משובצים']);
    
    // מיון משימות לפי שם (א-ת)
    const sortedTaskIds = Object.keys(monthData.assignments).sort((a, b) => {
      const taskA = monthData.assignments[a];
      const taskB = monthData.assignments[b];
      return (taskA.taskName || '').localeCompare(taskB.taskName || '');
    });
    
    // מעבר על כל המשימות ממוינות
    sortedTaskIds.forEach(taskId => {
      const taskData = monthData.assignments[taskId];
      
      // נדלג על משימות ללא שיבוצים
      if (!taskData.soldiers || Object.keys(taskData.soldiers).length === 0) {
        return;
      }
      
      // ארגון חיילים לפי תפקיד
      const soldiersByRole = {};
      
      Object.values(taskData.soldiers).forEach(soldier => {
        const role = soldier.role || 'אחר';
        
        if (!soldiersByRole[role]) {
          soldiersByRole[role] = [];
        }
        
        soldiersByRole[role].push({
          name: soldier.name,
          daysCount: soldier.dates.size
        });
      });
      
      // יצירת טקסט של החיילים המשובצים
      let soldiersText = '';
      
      // סדר תפקידים קבוע: רופאים, פראמדיקים, חונכים, חניכים, אחר
      const roleOrder = ['doctor', 'paramedic', 'mentor', 'trainee', 'אחר'];
      
      roleOrder.forEach(role => {
        if (!soldiersByRole[role] || soldiersByRole[role].length === 0) {
          return;
        }
        
        const roleLabel = role === 'doctor' ? 'רופאים: ' :
                        role === 'paramedic' ? 'פראמדיקים: ' :
                        role === 'trainee' ? 'חניכים: ' :
                        role === 'mentor' ? 'חונכים: ' : 'אחר: ';
        
        // מיון חיילים לפי שם א-ת
        const sortedSoldiers = soldiersByRole[role].sort((a, b) => a.name.localeCompare(b.name));
        
        // הוספת שמות החיילים עם מספר הימים
        const soldierNames = sortedSoldiers.map(soldier => 
          `${soldier.name} (${soldier.daysCount} ימים)`
        ).join(', ');
        
        soldiersText += `${roleLabel}${soldierNames}\n`;
      });
      
      // הוספת שורה לגיליון
      sheetData.push([taskData.taskName || `משימה ${taskId}`, soldiersText.trim()]);
    });
    
    // יצירת גיליון רק אם יש נתונים
    if (sheetData.length > 1) {
      try {
        console.log(`יוצר גיליון לחודש ${monthData.name} עם ${sheetData.length - 1} שורות`);
        
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        
        // הגדרת רוחב עמודות
        ws['!cols'] = [
          { wch: 30 }, // רוחב עמודת משימה
          { wch: 60 }  // רוחב עמודת חיילים
        ];
        
        // הוספת הגיליון לחוברת העבודה
        XLSX.utils.book_append_sheet(wb, ws, monthData.name);
        sheetsAdded++;
        
      } catch (error) {
        console.error(`שגיאה ביצירת גיליון עבור חודש ${monthData.name}:`, error);
      }
    } else {
      console.log(`דילוג על חודש ${monthData.name} - אין נתונים`);
    }
  });
  
  // בדיקה אם יש גיליונות בחוברת העבודה
  if (sheetsAdded > 0) {
    try {
      // ייצוא הקובץ
      XLSX.writeFile(wb, "דוח_חצי_שנתי.xlsx");
      showNotification(`הדוח יוצא בהצלחה לאקסל עם ${sheetsAdded} חודשים`, 'success');
    } catch (error) {
      console.error("שגיאה בייצוא קובץ אקסל:", error);
      showNotification('אירעה שגיאה בייצוא הקובץ: ' + error.message, 'error');
    }
  } else {
    showNotification('אין מספיק נתונים לייצוא הדוח', 'warning');
  }
}
// פונקציה לייצוא הסיכום השבועי לאקסל
function exportWeeklySummaryToExcel() {
  // יצירת מפה מנורמלת של חיילים
  const soldiersMap = createNormalizedSoldiersMap();

  // קבלת ימי השבוע הנוכחי
  const daysOfWeek = getDaysOfWeek();
  const startDate = daysOfWeek[0];
  const endDate = daysOfWeek[6];
  
  // קבלת שיבוצים רק לשבוע הנוכחי
  const weeklyAssignments = assignments.filter(a => {
    const assignmentDate = new Date(a.date);
    return assignmentDate >= startDate && assignmentDate <= endDate;
  });
  
  if (weeklyAssignments.length === 0) {
    showNotification('אין שיבוצים לשבוע הנוכחי', 'error');
    return;
  }
  
  // הכנת נתונים לייצוא
  const exportData = [];
  
  // כותרות - שורה ראשונה
  const headers = ['משימה'];
  daysOfWeek.forEach(day => {
    const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][day.getDay()];
    headers.push(`${dayName} ${formatDateHebrew(day)}`);
  });
  exportData.push(headers);
  
  // נתונים לפי משימות
  tasks.forEach(task => {
    // בדיקה אם יש שיבוצים למשימה זו בשבוע הנוכחי
    const hasAssignments = weeklyAssignments.some(a => a.taskId === task.id);
    
    // אם אין שיבוצים, דלג על המשימה
    if (!hasAssignments) return;
    
    const row = [task.name];
    
    // הוספת תאים לכל יום
    daysOfWeek.forEach(day => {
      const dateStr = formatDateISO(day);
      
      // חיפוש השיבוץ הרלוונטי
      const assignment = weeklyAssignments.find(a => a.taskId === task.id && a.date === dateStr);
      
      if (assignment && assignment.soldierIds && assignment.soldierIds.length > 0) {
        // הצגת שמות החיילים המשובצים
        const soldierNames = assignment.soldierIds
          .map(soldierId => getSoldierName(soldierId, soldiersMap))
          .filter(name => name.trim() !== '')
          .join(', ');
        
        row.push(soldierNames || '');
      } else {
        row.push('');
      }
    });
    
    exportData.push(row);
  });
  
  // יצירת Workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(exportData);
  
  // הגדרת כיוון RTL עבור גיליון הנתונים
  if (!ws['!cols']) ws['!cols'] = [];
  ws['!cols'].push({ wch: 20 }); // רוחב עמודת משימה
  
  // רוחב עמודות ימים
  for (let i = 0; i < daysOfWeek.length; i++) {
    ws['!cols'].push({ wch: 30 });
  }
  
  // הוספת הגיליון ל-Workbook
  XLSX.utils.book_append_sheet(wb, ws, "סיכום שבועי");
  
  // ייצוא הקובץ
  XLSX.writeFile(wb, "סיכום_שבועי.xlsx");
  
  showNotification('הדוח יוצא בהצלחה', 'success');
}
// פונקציה למעבר שבוע אחד קדימה
function addWeek() {
  const newDate = new Date(currentWeek);
  newDate.setDate(newDate.getDate() - 7); // עברנו את החצים אז גם ההגיון התהפך
  currentWeek = newDate;
  renderCalendar();
}

// פונקציה למעבר שבוע אחד אחורה
function subtractWeek() {
  const newDate = new Date(currentWeek);
  newDate.setDate(newDate.getDate() + 7); // עברנו את החצים אז גם ההגיון התהפך
  currentWeek = newDate;
  renderCalendar();
}

// פונקציה להחלפת תפקיד (מנהל/צופה)
async function toggleRole() {
  if (!isAuthenticated) {
    showNotification('עליך להתחבר כדי לשנות הרשאות', 'error');
    return;
  }

  try {
    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      if (userDoc.data().role === 'admin') {
        // החלפה בין מצב צפייה למצב עריכה עבור מנהל
        if (userRole === 'admin') {
          // מעבר למצב צפייה
          userRole = 'viewer';
          // שמירת המצב ב-localStorage
          localStorage.setItem('userViewMode', 'viewer');
          showNotification('עברת למצב צפייה', 'info');
        } else {
          // מעבר למצב עריכה
          userRole = 'admin';
          // שמירת המצב ב-localStorage
          localStorage.setItem('userViewMode', 'admin');
          showNotification('עברת למצב עריכה', 'success');
        }
      } else {
        showNotification('אין לך הרשאות מנהל', 'error');
        return;
      }
    } else {
      showNotification('לא נמצא מידע על המשתמש', 'error');
      return;
    }
    
    // עדכון הממשק לפי התפקיד החדש
    updateInterfaceForRole();
    
  } catch (error) {
    console.error("שגיאה בהחלפת מצב:", error);
    showNotification('אירעה שגיאה בהחלפת המצב', 'error');
  }
}

// פונקציה לעדכון כפתור הוספת משימה
function updateAddTaskButton() {
  const addTaskBtn = document.getElementById('addTaskBtn');
  if (addTaskBtn) {
    // הסרת הכפתור בכל מקרה - גם עבור מנהלים
    addTaskBtn.innerHTML = '';
    addTaskBtn.style.display = 'none';
  }
}

// הוספת סגנונות CSS לאנימציות התראות
function addNotificationStyles() {
  // בדיקה אם הסגנונות כבר קיימים
  if (document.querySelector('style#notification-styles')) {
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'notification-styles';
  styleElement.textContent = `
    @keyframes slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    .notification .icon {
      width: 24px;
      height: 24px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }
  `;
  document.head.appendChild(styleElement);
  console.log("סגנונות התראות נוספו בהצלחה");
}

// פונקציות עזר
function getDaysOfWeek() {
  const days = [];
  const startDate = new Date(currentWeek);
  
  // וידוא שמתחילים מיום חמישי (4 = Thursday במספור JavaScript)
  while (startDate.getDay() !== 4) {
    startDate.setDate(startDate.getDate() - 1);
  }
  
  // יצירת מערך של 7 ימים החל מיום חמישי
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    days.push(date);
  }
  
  return days;
}

// פורמט תאריך לתצוגה: DD/MM
function formatDate(date) {
  if (!isValidDate(date)) {
    console.error('תאריך לא תקין:', date);
    return 'תאריך שגוי';
  }
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

// פורמט תאריך לתצוגה עם שנה: DD/MM/YYYY
function formatDateWithYear(date) {
  if (!isValidDate(date)) {
    console.error('תאריך לא תקין:', date);
    return 'תאריך שגוי';
  }
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// פורמט תאריך ל-ISO: YYYY-MM-DD
function formatDateISO(date) {
  // ודא שהתאריך תקין
  if (!date) return '';
  
  // אם התאריך כבר מחרוזת בפורמט ISO, נחזיר אותו כמו שהוא
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    console.log(`תאריך כבר בפורמט ISO: ${date}`);
    return date;
  }
  
  // המרה לאובייקט Date אם זה מחרוזת בפורמט אחר
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  // בדיקה שהיא הצליחה לייצר תאריך תקין
  if (!(date instanceof Date) || isNaN(date)) {
    console.error("שגיאה בהמרת תאריך:", date);
    return '';
  }
  
  // פורמט ל-ISO בסגנון YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const formattedDate = `${year}-${month}-${day}`;
  return formattedDate;
}

// המרת תאריך ISO למחרוזת בעברית
function formatDateHebrew(dateStr) {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  if (!isValidDate(date)) {
    console.error('תאריך לא תקין:', dateStr);
    return 'תאריך שגוי';
  }
  
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ב${monthName} ${year}`;
}

// פונקציה לבדיקה אם תאריך הוא חג
function isHoliday(date) {
  if (!isValidDate(date)) {
    console.error('תאריך לא תקין:', date);
    return null;
  }
  
  // בדיקת חגים - לא כולל שבתות
  const holidays = getIsraeliHolidays(date.getFullYear());
  const holiday = holidays.find(h => isSameDay(date, h.date));
  
  return holiday ? holiday.name : null;
}

// פונקציה לקבלת רשימת חגי ישראל לשנה מסוימת
function getIsraeliHolidays(year) {
  // רשימות מוגדרות מראש של חגים לשנים 2025-2026
  const holidaysByYear = {
 
    // חגים לשנת 2025 - על פי המידע המדויק שסופק
    2025: [
      // המשך חנוכה מדצמבר 2024
      { name: 'חנוכה', date: new Date(2025, 0, 1) },
      { name: 'חנוכה', date: new Date(2025, 0, 2) },
      
      // עשרה בטבת
      { name: 'עשרה בטבת', date: new Date(2025, 0, 9) },
      
      // ט"ו בשבט
      { name: 'ט"ו בשבט', date: new Date(2025, 1, 14) },
      
      // תענית אסתר
      { name: 'תענית אסתר', date: new Date(2025, 2, 13) },
      // פורים
      { name: 'פורים', date: new Date(2025, 2, 14) },
      // שושן פורים
      { name: 'שושן פורים', date: new Date(2025, 2, 16) },
      
      // פסח
      { name: 'ערב פסח', date: new Date(2025, 3, 12) },
      { name: 'פסח', date: new Date(2025, 3, 13) },
      { name: 'חול המועד פסח', date: new Date(2025, 3, 14) },
      { name: 'חול המועד פסח', date: new Date(2025, 3, 15) },
      { name: 'חול המועד פסח', date: new Date(2025, 3, 16) },
      { name: 'חול המועד פסח', date: new Date(2025, 3, 17) },
      { name: 'ערב שביעי של פסח', date: new Date(2025, 3, 18) },
      { name: 'שביעי של פסח', date: new Date(2025, 3, 19) },
      
      // יום השואה
      { name: 'יום השואה', date: new Date(2025, 3, 28) },
      
      // יום הזיכרון
      { name: 'יום הזיכרון', date: new Date(2025, 4, 6) },
      
      // יום העצמאות
      { name: 'יום העצמאות', date: new Date(2025, 4, 7) },
      
      // ל"ג בעומר
      { name: 'ל"ג בעומר', date: new Date(2025, 4, 18) },
      
      // יום ירושלים
      { name: 'יום ירושלים', date: new Date(2025, 4, 28) },
      
      // שבועות
      { name: 'ערב שבועות', date: new Date(2025, 5, 1) },
      { name: 'שבועות', date: new Date(2025, 5, 2) },
      
      // צום י"ז בתמוז
      { name: 'צום י"ז בתמוז', date: new Date(2025, 6, 15) },
      
      // תשעה באב
      { name: 'תשעה באב', date: new Date(2025, 7, 5) },
      
      // ראש השנה
      { name: 'ערב ראש השנה', date: new Date(2025, 8, 22) },
      { name: 'ראש השנה', date: new Date(2025, 8, 23) },
      { name: 'ראש השנה', date: new Date(2025, 8, 24) },
      
      // צום גדליה
      { name: 'צום גדליה', date: new Date(2025, 8, 25) },
      
      // יום כיפור
      { name: 'ערב יום כיפור', date: new Date(2025, 9, 1) },
      { name: 'יום כיפור', date: new Date(2025, 9, 2) },
      
      // סוכות
      { name: 'ערב סוכות', date: new Date(2025, 9, 6) },
      { name: 'סוכות', date: new Date(2025, 9, 7) },
      { name: 'חול המועד סוכות', date: new Date(2025, 9, 8) },
      { name: 'חול המועד סוכות', date: new Date(2025, 9, 9) },
      { name: 'חול המועד סוכות', date: new Date(2025, 9, 10) },
      { name: 'חול המועד סוכות', date: new Date(2025, 9, 11) },
      { name: 'חול המועד סוכות', date: new Date(2025, 9, 12) },
      { name: 'הושענא רבה', date: new Date(2025, 9, 13) },
      { name: 'שמיני עצרת ושמחת תורה', date: new Date(2025, 9, 14) },
      
      // חנוכה
      { name: 'חנוכה', date: new Date(2025, 11, 15) },
      { name: 'חנוכה', date: new Date(2025, 11, 16) },
      { name: 'חנוכה', date: new Date(2025, 11, 17) },
      { name: 'חנוכה', date: new Date(2025, 11, 18) },
      { name: 'חנוכה', date: new Date(2025, 11, 19) },
      { name: 'חנוכה', date: new Date(2025, 11, 20) },
      { name: 'חנוכה', date: new Date(2025, 11, 21) },
      { name: 'חנוכה', date: new Date(2025, 11, 22) }
    ],
    
    // חגים לשנת 2026 - על פי המידע המדויק שסופק
    2026: [
      // עשרה בטבת  
      { name: 'עשרה בטבת', date: new Date(2026, 0, 6) },
      
      // ט"ו בשבט
      { name: 'ט"ו בשבט', date: new Date(2026, 1, 3) },
      
      // תענית אסתר
      { name: 'תענית אסתר', date: new Date(2026, 2, 2) },
      // פורים
      { name: 'פורים', date: new Date(2026, 2, 3) },
      // שושן פורים
      { name: 'שושן פורים', date: new Date(2026, 2, 4) },
      
      // פסח
      { name: 'ערב פסח', date: new Date(2026, 3, 1) },
      { name: 'פסח', date: new Date(2026, 3, 2) },
      { name: 'חול המועד פסח', date: new Date(2026, 3, 3) },
      { name: 'חול המועד פסח', date: new Date(2026, 3, 4) },
      { name: 'חול המועד פסח', date: new Date(2026, 3, 5) },
      { name: 'חול המועד פסח', date: new Date(2026, 3, 6) },
      { name: 'חול המועד פסח', date: new Date(2026, 3, 7) },
      { name: 'ערב שביעי של פסח', date: new Date(2026, 3, 8) },
      { name: 'שביעי של פסח', date: new Date(2026, 3, 9) },
      
      // יום השואה
      { name: 'יום השואה', date: new Date(2026, 3, 16) },
      
      // יום הזיכרון
      { name: 'יום הזיכרון', date: new Date(2026, 3, 22) },
      
      // יום העצמאות
      { name: 'יום העצמאות', date: new Date(2026, 3, 23) },
      
      // ל"ג בעומר
      { name: 'ל"ג בעומר', date: new Date(2026, 4, 7) },
      
      // יום ירושלים
      { name: 'יום ירושלים', date: new Date(2026, 4, 17) },
      
      // שבועות
      { name: 'ערב שבועות', date: new Date(2026, 4, 21) },
      { name: 'שבועות', date: new Date(2026, 4, 22) },
      
      // צום י"ז בתמוז
      { name: 'צום י"ז בתמוז', date: new Date(2026, 6, 5) },
      
      // תשעה באב
      { name: 'תשעה באב', date: new Date(2026, 6, 26) },
      
      // ראש השנה
      { name: 'ערב ראש השנה', date: new Date(2026, 8, 11) },
      { name: 'ראש השנה', date: new Date(2026, 8, 12) },
      { name: 'ראש השנה', date: new Date(2026, 8, 13) },
      
      // צום גדליה
      { name: 'צום גדליה', date: new Date(2026, 8, 14) },
      
      // יום כיפור
      { name: 'ערב יום כיפור', date: new Date(2026, 8, 20) },
      { name: 'יום כיפור', date: new Date(2026, 8, 21) },
      
      // סוכות
      { name: 'ערב סוכות', date: new Date(2026, 8, 25) },
      { name: 'סוכות', date: new Date(2026, 8, 26) },
      { name: 'חול המועד סוכות', date: new Date(2026, 8, 27) },
      { name: 'חול המועד סוכות', date: new Date(2026, 8, 28) },
      { name: 'חול המועד סוכות', date: new Date(2026, 8, 29) },
      { name: 'חול המועד סוכות', date: new Date(2026, 9, 1) },
      { name: 'הושענא רבה', date: new Date(2026, 9, 2) },
      { name: 'שמיני עצרת ושמחת תורה', date: new Date(2026, 9, 3) },
      
      // חנוכה
      { name: 'חנוכה', date: new Date(2026, 11, 4) },
      { name: 'חנוכה', date: new Date(2026, 11, 5) },
      { name: 'חנוכה', date: new Date(2026, 11, 6) },
      { name: 'חנוכה', date: new Date(2026, 11, 7) },
      { name: 'חנוכה', date: new Date(2026, 11, 8) },
      { name: 'חנוכה', date: new Date(2026, 11, 9) },
      { name: 'חנוכה', date: new Date(2026, 11, 10) },
      { name: 'חנוכה', date: new Date(2026, 11, 11) }
    ]
  };

  // מחזיר את החגים לשנה המבוקשת, או רשימה ריקה אם אין נתונים לשנה זו
  return holidaysByYear[year] || [];
}

// פונקציית עזר להמרת תאריך עברי לגרגוריאני
function hebrewToGregorian(year, month, day) {
  // המרה פשוטה - יש להחליף בספריה מתאימה
  const date = new Date(year, month - 1, day);
  return date;
}

// פונקציית עזר להוספת ימים לתאריך
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// בדיקת תקינות תאריך
function isValidDate(date) {
  // בדיקה שהערך הוא אובייקט תאריך תקין
  if (!(date instanceof Date) || isNaN(date)) {
    return false;
  }
  
  // בדיקה שהתאריך הוא בטווח סביר
  const now = new Date();
  const minDate = new Date(now.getFullYear() - 1, 0, 1); // שנה אחורה
  const maxDate = new Date(now.getFullYear() + 1, 11, 31); // שנה קדימה
  
  return date >= minDate && date <= maxDate;
}

// בדיקה אם שני תאריכים הם אותו יום
function isSameDay(date1, date2) {
  if (!isValidDate(date1) || !isValidDate(date2)) {
    return false;
  }
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// התאמת ממשק למובייל
function adjustForMobile() {
  if (isMobileDevice()) {
    document.body.classList.add('mobile-device');
  }
}

// בדיקה אם מתבצעת גישה ממכשיר מובייל
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
// פונקציה לתצוגת התראות
function showNotification(message, type = 'info') {
  // יצירת אלמנט ההתראה
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.padding = '15px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '1000';
  notification.style.minWidth = '300px';
  notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  notification.style.animation = 'slide-in 0.3s ease-out forwards';
  notification.style.direction = 'rtl';
  notification.style.textAlign = 'right';
  notification.style.fontWeight = 'bold';
  
  // צבע רקע לפי סוג ההתראה
  if (type === 'error') {
    notification.style.backgroundColor = '#dc2626';
    notification.style.color = 'white';
    notification.style.borderRight = '5px solid #991b1b';
  } else if (type === 'success') {
    notification.style.backgroundColor = '#16a34a';
    notification.style.color = 'white';
    notification.style.borderRight = '5px solid #166534';
  } else if (type === 'warning') {
    notification.style.backgroundColor = '#f59e0b';
    notification.style.color = 'white';
    notification.style.borderRight = '5px solid #b45309';
  } else {
    notification.style.backgroundColor = '#2563eb';
    notification.style.color = 'white';
    notification.style.borderRight = '5px solid #1e40af';
  }
  
  // הוספת אייקון לפי סוג ההתראה
  const icon = type === 'error' ? 
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' : 
    type === 'success' ? 
    '<svg class="icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' :
    type === 'warning' ?
    '<svg class="icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' :
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><polyline points="12 16 12.01 16"></polyline></svg>';
  
  notification.innerHTML = `
    <div class="notification-content" style="display: flex; align-items: center;">
      <div style="margin-left: 12px; width: 24px; height: 24px; flex-shrink: 0;">
        ${icon}
      </div>
      <span>${message}</span>
    </div>
  `;
  
  // הוספת כפתור סגירה
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '5px';
  closeButton.style.left = '5px';
  closeButton.style.background = 'transparent';
  closeButton.style.border = 'none';
  closeButton.style.color = 'white';
  closeButton.style.fontSize = '20px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.width = '24px';
  closeButton.style.height = '24px';
  closeButton.style.display = 'flex';
  closeButton.style.alignItems = 'center';
  closeButton.style.justifyContent = 'center';
  closeButton.style.borderRadius = '50%';
  
  closeButton.addEventListener('click', () => {
    notification.style.animation = 'fade-out 0.3s ease-out forwards';
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  notification.appendChild(closeButton);
  
  // הוספת ההתראה לעמוד
  document.body.appendChild(notification);
  
  // הסרת ההתראה אחרי 5 שניות
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.style.animation = 'fade-out 0.5s ease-out forwards';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.remove();
        }
      }, 500);
    }
  }, 5000);
}


// פונקציה למעבר לשבוע הנוכחי
function goToCurrentWeek() {
  currentWeek = new Date(); // מעדכן לתאריך הנוכחי
  renderCalendar();
}

// פונקציה להוספת דיאלוגים חסרים לדף
function ensureDialogsExist() {
  console.log("בודק קיום דיאלוגים נדרשים...");
  
  // הוספת סגנונות לדיאלוגים
  addDialogStyles();
  
  // וידוא שכל הדיאלוגים מוסתרים בטעינת הדף
  const allDialogs = document.querySelectorAll('.dialog-container');
  allDialogs.forEach(dialog => {
    if (!dialog.classList.contains('hidden')) {
      console.log(`מסתיר דיאלוג ${dialog.id} שהיה גלוי`);
      dialog.classList.add('hidden');
      dialog.style.display = 'none';
    }
  });
  
  // בדיקה והוספת דיאלוג הוספת משימה
  if (!document.getElementById('addTaskDialog')) {
    console.log("יוצר דיאלוג הוספת משימה");
    const addTaskDialog = document.createElement('div');
    addTaskDialog.id = 'addTaskDialog';
    addTaskDialog.className = 'dialog-container hidden';
    addTaskDialog.style.display = 'none'; // תיקון: הוספת סגנון display
    addTaskDialog.innerHTML = `
      <div class="dialog">
        <div class="dialog-header">
          <h3>הוספת משימה חדשה</h3>
          <button id="closeAddTaskDialog" class="close-button">×</button>
        </div>
        <div class="dialog-content">
          <div class="form-group">
            <label for="newTaskName">שם המשימה:</label>
            <input type="text" id="newTaskName" class="form-control" placeholder="הזן שם משימה">
          </div>
        </div>
        <div class="dialog-footer">
          <button id="addTaskCancel" class="button button-gray">ביטול</button>
          <button id="addTaskConfirm" class="button button-green">הוסף משימה</button>
        </div>
      </div>
    `;
    document.body.appendChild(addTaskDialog);
    
    // הוספת מאזיני אירועים
    document.getElementById('closeAddTaskDialog').addEventListener('click', closeAddTaskDialog);
    document.getElementById('addTaskCancel').addEventListener('click', closeAddTaskDialog);
    document.getElementById('addTaskConfirm').addEventListener('click', confirmAddTask);
  }
  
  // בדיקה והוספת דיאלוג הוספה מהירה
  if (!document.getElementById('quickAddDialog')) {
    console.log("יוצר דיאלוג הוספה מהירה");
    const quickAddDialog = document.createElement('div');
    quickAddDialog.id = 'quickAddDialog';
    quickAddDialog.className = 'dialog-container hidden';
    quickAddDialog.style.display = 'none'; // תיקון: הוספת סגנון display
    quickAddDialog.innerHTML = `
      <div class="dialog">
        <div class="dialog-header">
          <h3>הוספת חיילים למשימה</h3>
          <button id="closeQuickAdd" class="close-button">×</button>
        </div>
        <div class="dialog-content">
          <div class="mb-4">
            <div class="font-bold">משימה: <span id="quickAddTaskName"></span></div>
            <div>תאריך: <span id="quickAddDate"></span></div>
          </div>
          <div class="mb-4">
            <h4 class="font-bold mb-2">בחר חיילים:</h4>
            <div id="availableSoldiers" class="max-h-60 overflow-y-auto">
              <div class="text-center text-gray-400 py-4">טוען חיילים זמינים...</div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button id="quickAddCancel" class="button button-gray">ביטול</button>
          <button id="quickAddConfirm" class="button button-green">המשך</button>
        </div>
      </div>
    `;
    document.body.appendChild(quickAddDialog);
    
    // הוספת מאזיני אירועים
    document.getElementById('closeQuickAdd').addEventListener('click', closeQuickAddDialog);
    document.getElementById('quickAddCancel').addEventListener('click', closeQuickAddDialog);
    document.getElementById('quickAddConfirm').addEventListener('click', prepareQuickAdd);
  }
  
  // בדיקה והוספת דיאלוג בחירת סוג שיבוץ
  if (!document.getElementById('assignmentTypeDialog')) {
    console.log("יוצר דיאלוג בחירת סוג שיבוץ");
    const assignmentTypeDialog = document.createElement('div');
    assignmentTypeDialog.id = 'assignmentTypeDialog';
    assignmentTypeDialog.className = 'dialog-container hidden';
    assignmentTypeDialog.style.display = 'none'; // תיקון: הוספת סגנון display
    assignmentTypeDialog.innerHTML = `

      <div class="dialog">
        <div class="dialog-header">
          <h3>בחירת סוג שיבוץ</h3>
          <button id="closeAssignmentTypeDialog" class="close-button">×</button>
        </div>
        <div class="dialog-content">
          <div class="text-center mb-4">
            <p>האם לשבץ את החיילים ליום אחד או לכל השבוע?</p>
          </div>
          <div class="flex justify-center gap-4">
            <button id="assignSingleDay" class="button button-blue">
              <svg class="icon" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              שיבוץ ליום אחד
            </button>
            <button id="assignFullWeek" class="button button-accent">
              <svg class="icon" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
                <line x1="9" y1="18" x2="15" y2="18"></line>
              </svg>
              שיבוץ לכל השבוע
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(assignmentTypeDialog);
    
    // הוספת מאזיני אירועים
    document.getElementById('closeAssignmentTypeDialog').addEventListener('click', closeAssignmentTypeDialog);
    document.getElementById('assignSingleDay').addEventListener('click', () => confirmQuickAdd(false));
    document.getElementById('assignFullWeek').addEventListener('click', () => confirmQuickAdd(true));
  }
  
  console.log("וידוא קיום דיאלוגים הושלם");
}

// פונקציה להוספת סגנונות CSS לדיאלוגים
function addDialogStyles() {
  // בדיקה אם הסגנונות כבר קיימים
  if (document.querySelector('style#dialog-styles')) {
    return;
  }
  
  console.log("מוסיף סגנונות CSS לדיאלוגים");
  const styleElement = document.createElement('style');
  styleElement.id = 'dialog-styles';
  styleElement.textContent = `
    /* סגנונות נוספים שלא הועברו ל-g_styles.css */
    .dialog {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      z-index: 1001;
      position: relative;
    }
    
    .button {
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
    }
    
    .button-green {
      background-color: #10b981;
      color: white;
    }
    
    .button-blue {
      background-color: #3b82f6;
      color: white;
    }
    
    .button-accent {
      background-color: #8b5cf6;
      color: white;
    }
    
    .button-gray {
      background-color: #6b7280;
      color: white;
    }
    
    .icon {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      margin-right: 8px;
    }
    
    .mb-4 {
      margin-bottom: 16px;
    }
    
    .mb-2 {
      margin-bottom: 8px;
    }
    
    .font-bold {
      font-weight: bold;
    }
    
    .text-center {
      text-align: center;
    }
    
    .flex {
      display: flex;
    }
    
    .justify-center {
      justify-content: center;
    }
    
    .gap-4 {
      gap: 16px;
    }
    
    .max-h-60 {
      max-height: 240px;
    }
    
    .overflow-y-auto {
      overflow-y: auto;
    }
  `;
  document.head.appendChild(styleElement);
}

// עדכון פונקציית אתחול האפליקציה
document.addEventListener('DOMContentLoaded', () => {
  console.log("המסמך נטען - מאתחל אפליקציה");
  
  // הוספת סגנונות להתראות
  addNotificationStyles();
  
  // וידוא שכל הדיאלוגים קיימים
  ensureDialogsExist();
  
  // התאמה למובייל
  adjustForMobile();
  
  // אתחול האפליקציה
  try {
    initAppLegacy();
    console.log("אתחול האפליקציה הושלם בהצלחה");
  } catch (error) {
    console.error("שגיאה באתחול האפליקציה:", error);
    showNotification('אירעה שגיאה באתחול האפליקציה: ' + error.message, 'error');
  }
  
  // בדיקה אם האפליקציה אותחלה בהצלחה אחרי 10 שניות
  setTimeout(() => {
    if (!appInitialized) {
      console.error("האפליקציה לא אותחלה בהצלחה אחרי 10 שניות");
      showNotification('האפליקציה לא אותחלה בהצלחה. נסה לרענן את הדף.', 'error');
    }
  }, 10000);
});

// פונקציה לפתיחת דיאלוג הוספת משימה
function showAddTaskDialog() {
  console.log("מנסה לפתוח דיאלוג הוספת משימה");
  if (userRole !== 'admin') {
    showNotification('רק מנהל יכול להוסיף משימות חדשות', 'error');
    return;
  }

  // וידוא שהדיאלוג קיים
  let dialog = document.getElementById('addTaskDialog');
  if (!dialog) {
    console.log("דיאלוג הוספת משימה לא קיים - יוצר אותו");
    ensureDialogsExist();
    dialog = document.getElementById('addTaskDialog');
  }

  if (dialog) {
    // איפוס שדות הטופס
    const nameInput = document.getElementById('newTaskName');
    if (nameInput) nameInput.value = '';
    
    // הצגת הדיאלוג - תיקון: הסרת hidden ועדכון display
    dialog.classList.remove('hidden');
    dialog.style.display = 'flex';
    
    console.log("דיאלוג הוספת משימה נפתח");
  } else {
    console.error("לא ניתן למצוא או ליצור את דיאלוג הוספת משימה");
    showNotification('אירעה שגיאה בפתיחת דיאלוג הוספת משימה', 'error');
  }
}

function closeAddTaskDialog() {
  console.log("סוגר דיאלוג הוספת משימה");
  const dialog = document.getElementById('addTaskDialog');
  if (dialog) {
    dialog.classList.add('hidden');
    dialog.style.display = 'none';
  }
}

// פונקציה לאישור הוספת משימה חדשה
async function confirmAddTask() {
  if (userRole !== 'admin') {
    showNotification('רק מנהל יכול להוסיף משימות', 'error');
    return;
  }

  const taskName = document.getElementById('newTaskName').value.trim();

  if (!taskName) {
    showNotification('נא להזין שם משימה', 'error');
    return;
  }

  // בדיקה אם כבר קיימת משימה בשם זהה
  if (tasks.some(task => task.name.toLowerCase() === taskName.toLowerCase())) {
    showNotification('כבר קיימת משימה בשם זה', 'error');
    return;
  }

  try {
    // מציאת הערך הגבוה ביותר של order כדי להוסיף בסוף
    let maxOrder = 0;
    tasks.forEach(task => {
      if (task.order && task.order > maxOrder) {
        maxOrder = task.order;
      }
    });
    
    // הוספת המשימה החדשה
    await addDoc(collection(db, "tasks"), {
      name: taskName,
      order: maxOrder + 1, // הוספת שדה סדר כדי שיתווסף בסוף
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    
    showNotification('המשימה נוספה בהצלחה', 'success');
    
    // סגירת הדיאלוג
    closeAddTaskDialog();
  } catch (error) {
    console.error("שגיאה בהוספת משימה:", error);
    showNotification('אירעה שגיאה בהוספת המשימה', 'error');
  }
}

// פונקציה להגדרת מאזינים לדיאלוג הוספת משימה
function setupTaskDialogListeners() {
  console.log("מגדיר מאזיני אירועים לדיאלוג הוספת משימה");
  
  // כפתור הוספת משימה בתפריט הראשי
  const addTaskBtnMain = document.getElementById('addTaskBtn');
  if (addTaskBtnMain) {
    addTaskBtnMain.addEventListener('click', showAddTaskDialog);
  } else {
    console.warn("לא נמצא אלמנט addTaskBtn");
  }
  
  // כפתור סגירה בדיאלוג
  const closeAddTaskDialogBtn = document.getElementById('closeAddTaskDialog');
  if (closeAddTaskDialogBtn) {
    closeAddTaskDialogBtn.addEventListener('click', closeAddTaskDialog);
  } else {
    console.warn("לא נמצא אלמנט closeAddTaskDialog");
  }
  
  // כפתור ביטול בדיאלוג
  const addTaskCancelBtn = document.getElementById('addTaskCancel');
  if (addTaskCancelBtn) {
    addTaskCancelBtn.addEventListener('click', closeAddTaskDialog);
  } else {
    console.warn("לא נמצא אלמנט addTaskCancel");
  }
  
  // כפתור אישור בדיאלוג
  const addTaskConfirmBtn = document.getElementById('addTaskConfirm');
  if (addTaskConfirmBtn) {
    addTaskConfirmBtn.addEventListener('click', confirmAddTask);
  } else {
    console.warn("לא נמצא אלמנט addTaskConfirm");
  }
}

// פונקציה להגדרת מאזינים לדיאלוג הוספה מהירה
function setupQuickAddDialogListeners() {
  console.log("מגדיר מאזיני אירועים לדיאלוג הוספה מהירה");
  
  // כפתור סגירה בדיאלוג
  const closeQuickAddBtn = document.getElementById('closeQuickAdd');
  if (closeQuickAddBtn) {
    closeQuickAddBtn.addEventListener('click', closeQuickAddDialog);
  } else {
    console.warn("לא נמצא אלמנט closeQuickAdd");
  }
  
  // כפתור ביטול בדיאלוג
  const quickAddCancelBtn = document.getElementById('quickAddCancel');
  if (quickAddCancelBtn) {
    quickAddCancelBtn.addEventListener('click', closeQuickAddDialog);
  } else {
    console.warn("לא נמצא אלמנט quickAddCancel");
  }
  
  // כפתור אישור בדיאלוג
  const quickAddConfirmBtn = document.getElementById('quickAddConfirm');
  if (quickAddConfirmBtn) {
    quickAddConfirmBtn.addEventListener('click', prepareQuickAdd);
  } else {
    console.warn("לא נמצא אלמנט quickAddConfirm");
  }
  
  // כפתור סגירה בדיאלוג סוג השיבוץ
  const closeAssignmentTypeDialogBtn = document.getElementById('closeAssignmentTypeDialog');
  if (closeAssignmentTypeDialogBtn) {
    closeAssignmentTypeDialogBtn.addEventListener('click', closeAssignmentTypeDialog);
  } else {
    console.warn("לא נמצא אלמנט closeAssignmentTypeDialog");
  }
  
  // כפתור שיבוץ ליום אחד
  const assignSingleDayBtn = document.getElementById('assignSingleDay');
  if (assignSingleDayBtn) {
    assignSingleDayBtn.addEventListener('click', () => confirmQuickAdd(false));
  } else {
    console.warn("לא נמצא אלמנט assignSingleDay");
  }
  
  // כפתור שיבוץ לכל השבוע
  const assignFullWeekBtn = document.getElementById('assignFullWeek');
  if (assignFullWeekBtn) {
    assignFullWeekBtn.addEventListener('click', () => confirmQuickAdd(true));
  } else {
    console.warn("לא נמצא אלמנט assignFullWeek");
  }
}

// -------------------------------------
// פונקציות דוחות
// -------------------------------------
// רינדור של לוח השנה
function renderCalendar() {
  console.log("מתחיל רינדור לוח השנה...");

  try {
    // בדיקה שכל הנתונים הנדרשים קיימים
    if (!Array.isArray(soldiers) || !Array.isArray(tasks) || !Array.isArray(assignments)) {
      console.error("חסרים נתונים לרינדור לוח השנה");
      console.error("חיילים:", soldiers);
      console.error("משימות:", tasks);
      console.error("שיבוצים:", assignments);
      showNotification('חסרים נתונים להצגת לוח השנה', 'error');
      return;
    }

    // בדיקה שהאלמנטים הנדרשים קיימים ב-DOM
    const calendarBodyElement = document.getElementById('calendarBody');
    if (!calendarBodyElement) {
      console.error("לא נמצא אלמנט calendarBody");
      showNotification('לא נמצאו אלמנטים נדרשים להצגת לוח השנה', 'error');
      return;
    }

    console.log(`מתחיל רינדור לוח השנה עם ${soldiers.length} חיילים, ${tasks.length} משימות, ${assignments.length} שיבוצים`);

    // רינדור כותרות
    renderCalendarHeader();

    // רינדור גוף הלוח
    renderCalendarBody();

    // הוספת מאזינים לאירועי גרירה
    setupDragAndDrop();

    console.log("רינדור לוח השנה הושלם");
  } catch (error) {
    console.error("שגיאה ברינדור לוח השנה:", error);
    showNotification('אירעה שגיאה בהצגת לוח השנה: ' + error.message, 'error');
  }
  
}

// רינדור של כותרות לוח השנה
function renderCalendarHeader() {
  console.log("מרנדר כותרות לוח השנה...");
  try {
    const daysRow = document.getElementById('daysHeaderRow');
    if (!daysRow) {
      console.error("לא נמצא אלמנט daysHeaderRow");
      return;
    }
    
    const dateRangeElement = document.getElementById('dateRange');
    if (!dateRangeElement) {
      console.error("לא נמצא אלמנט dateRange");
      return;
    }
    
    const daysOfWeek = getDaysOfWeek();
    
    // ניקוי השורה למעט התא הראשון
    while (daysRow.children.length > 1) {
      daysRow.removeChild(daysRow.lastChild);
    }
    
    // הוספת תאי כותרת עבור כל יום
    daysOfWeek.forEach(day => {
      const th = document.createElement('th');
      th.className = 'p-2 border min-w-24';
      
      const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][day.getDay()];
      const dateStr = formatDateWithYear(day);
      
      // בדיקה אם היום הוא חג
      const holiday = isHoliday(day);
      let holidayClass = '';
      let holidayText = '';
      
      if (holiday) {
        holidayText = `<div class="holiday-name">${holiday}</div>`;
        holidayClass = 'holiday';
        th.classList.add('holiday');
      }
      
      // אם יום שבת, נוסיף מידע על כך לצורך סגנון אם יידרש בעתיד
      if (day.getDay() === 6) {
        th.dataset.saturday = 'true';
      }
      
      // בדיקה אם היום הוא היום הנוכחי
      const isToday = isSameDay(day, new Date());
      if (isToday) {
        th.classList.add('bg-blue-50', 'font-bold');
      }
      
      th.innerHTML = `
        <div class="day-header ${holidayClass}">
          <div class="day-name font-bold">${dayName}</div>
          <div class="text-sm">${dateStr}</div>
          ${holidayText}
        </div>
      `;
      
      daysRow.appendChild(th);
    });
    
    // עדכון טווח התאריכים
    const firstDay = daysOfWeek[0];
    const lastDay = daysOfWeek[6];
    dateRangeElement.textContent = `${formatDateWithYear(firstDay)} - ${formatDateWithYear(lastDay)}`;
    
    console.log("רינדור כותרות לוח השנה הושלם");
  } catch (error) {
    console.error("שגיאה ברינדור כותרות לוח השנה:", error);
    showNotification('אירעה שגיאה בהצגת כותרות לוח השנה', 'error');
  }
}

// רינדור של גוף לוח השנה
function renderCalendarBody() {
  console.log("מרנדר גוף לוח השנה...");
  try {
    const calendarBodyElement = document.getElementById('calendarBody');
    if (!calendarBodyElement) {
      console.error("לא נמצא אלמנט calendarBody");
      return;
    }
    
    const daysOfWeek = getDaysOfWeek();
    
    // מיון המשימות לפי שדה order (כך שמשימות עם order גבוה יהיו למטה)
    const sortedTasks = [...tasks].sort((a, b) => {
      // אם יש לשניהם שדה order, מיין לפיו
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      // אם רק לאחד יש שדה order, המשימה עם order תהיה למטה
      if (a.order !== undefined) return 1;
      if (b.order !== undefined) return -1;
      // אחרת מיין לפי סדר הא"ב הפוך (צפון יהיה לפני 500)
      return b.name.localeCompare(a.name);
    });
    
    // יצירת מפה של שיבוצים לפי תאריך ומשימה לשיפור ביצועים
    const assignmentMap = new Map();
    
    console.log("מספר השיבוצים הקיימים:", assignments.length);
    
    assignments.forEach(assignment => {
      const key = `${assignment.taskId}_${assignment.date}`;
      assignmentMap.set(key, assignment);
      console.log(`מיפוי שיבוץ: ${key} -> ${assignment.id} (${assignment.soldierIds ? assignment.soldierIds.length : 0} חיילים)`);
    });
    
    // יצירת מפה של חיילים לפי ID לשיפור ביצועים
    const soldiersMap = new Map(soldiers.map(soldier => [soldier.id, soldier]));
    
    calendarBodyElement.innerHTML = '';
    
    console.log(`מרנדר ${sortedTasks.length} משימות בלוח`);
    
    sortedTasks.forEach(task => {
      const tr = document.createElement('tr');
      tr.dataset.taskId = task.id;
      
      // תא המשימה
      const taskCell = document.createElement('td');
      taskCell.className = 'p-2 border font-medium task-name';
      
      // הוספת תוכן תא המשימה
      renderTaskCell(taskCell, task);
      tr.appendChild(taskCell);
      
      // תאים לכל יום
      daysOfWeek.forEach(day => {
        const dateStr = formatDateISO(day);
        const td = document.createElement('td');
        
        // בדיקת תקינות התאריך
        if (!isValidDate(day)) {
          console.error(`תאריך לא תקין: ${dateStr}`);
          td.className = 'task-cell border bg-red-50';
          tr.appendChild(td);
          return;
        }
        
        td.className = 'task-cell border';
        
        // בדיקה אם היום הוא חג
        if (isHoliday(day)) {
          td.classList.add('holiday-cell');
        }
        
        // בדיקה אם היום הוא היום הנוכחי
        if (isSameDay(day, new Date())) {
          td.classList.add('today-cell', 'bg-blue-50');
        }
        
        td.dataset.taskId = task.id;
        td.dataset.date = dateStr;
        
        // הוספת מאזיני אירועים
        setupCellEventListeners(td, task, dateStr, day);
        
        // בדיקת שיבוץ לתא הנוכחי
        const key = `${task.id}_${dateStr}`;
        const assignment = assignmentMap.get(key);
        
        if (assignment) {
          console.log(`נמצא שיבוץ לתא: ${key} -> ${assignment.id} (${assignment.soldierIds ? assignment.soldierIds.length : 0} חיילים)`);
          // תא עם שיבוץ
          renderAssignmentCell(td, assignment, soldiersMap);
        } else {
          // תא ריק - יצירת מיכל ריק עם גובה מינימלי
          const emptyContainer = document.createElement('div');
          emptyContainer.className = 'assignment-container min-h-[40px]';
          if (userRole === 'admin') {
            emptyContainer.innerHTML = '<span class="text-gray-300">+</span>';
          } else {
            emptyContainer.innerHTML = '<span class="text-gray-300">-</span>';
          }
          td.appendChild(emptyContainer);
        }
        
        tr.appendChild(td);
      });
      
      calendarBodyElement.appendChild(tr);
    });
    
    // הוספת שורת "הוסף משימה" למנהלים
    if (userRole === 'admin') {
      renderAddTaskRow(calendarBodyElement);
    }
    
    console.log("רינדור גוף לוח השנה הושלם");
  } catch (error) {
    console.error("שגיאה ברינדור גוף לוח השנה:", error);
    showNotification('אירעה שגיאה בהצגת גוף לוח השנה', 'error');
  }
}

// פונקציית עזר לרינדור תא משימה
function renderTaskCell(cell, task) {
  if (userRole === 'admin') {
    const taskContainer = document.createElement('div');
    taskContainer.className = 'flex justify-between items-center';
    
    const taskName = document.createElement('span');
    taskName.textContent = task.name;
    taskContainer.appendChild(taskName);
    
    const deleteIcon = document.createElement('button');
    deleteIcon.className = 'icon-button delete-icon';
    deleteIcon.innerHTML = `
      <svg class="icon-sm" viewBox="0 0 24 24">
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
      </svg>
    `;
    deleteIcon.dataset.taskId = task.id;
    deleteIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteTask(task.id);
    });
    
    taskContainer.appendChild(deleteIcon);
    cell.appendChild(taskContainer);
  } else {
    cell.textContent = task.name;
  }
}

// פונקציית עזר לרינדור תא ריק
function renderEmptyCell(cell) {
  const emptyCell = document.createElement('div');
  emptyCell.className = 'h-full w-full flex items-center justify-center opacity-20 hover:opacity-50 transition-opacity';
  emptyCell.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14"></path>
    </svg>
  `;
  cell.appendChild(emptyCell);
}
// הוסף את הקוד הזה לקונסול הדפדפן לבדיקה
function debugAssignments() {
  console.log("מספר שיבוצים:", assignments.length);
  console.log("מספר חיילים:", soldiers.length);
  
  // בדיקת השיבוצים האחרונים
  if (assignments.length > 0) {
    const lastAssignment = assignments[assignments.length - 1];
    console.log("השיבוץ האחרון:", lastAssignment);
    
    if (lastAssignment.soldierIds && lastAssignment.soldierIds.length > 0) {
      console.log("חיילים בשיבוץ האחרון:", lastAssignment.soldierIds);
      
      // בדיקה אם החיילים בשיבוץ נמצאים במערך החיילים
      lastAssignment.soldierIds.forEach(sid => {
        const foundSoldier = soldiers.find(s => s.id === sid);
        console.log(`חייל ${sid} נמצא במערך:`, foundSoldier ? "כן" : "לא");
        if (foundSoldier) {
          console.log("פרטי החייל:", foundSoldier.firstName, foundSoldier.lastName);
        }
      });
    } else {
      console.log("אין חיילים בשיבוץ האחרון!");
    }
  }
}

debugAssignments();

// פונקציה משופרת לרינדור תא שיבוץ שמציגה את כל החיילים
function renderAssignmentCell(cell, assignment) {
  console.log("מרנדר תא שיבוץ:", assignment.id);
  
  // בדיקה שהשיבוץ תקין
  if (!assignment) {
    console.error("שגיאה: התקבל שיבוץ null או undefined");
    return;
  }
  
  // יצירת מיכל לשיבוץ - שינוי מהותי: הוספת מאפיין overflow-y: auto
  const assignmentContainer = document.createElement('div');
  assignmentContainer.className = 'assignment-container';
  assignmentContainer.style.maxHeight = 'none'; // ביטול מגבלת גובה
  assignmentContainer.style.overflowY = 'visible'; // וידוא שהתוכן נראה גם אם הוא גולש
  
  // ודא שיש מערך soldierIds תקין
  if (!assignment.soldierIds || !Array.isArray(assignment.soldierIds)) {
    // רינדור מיכל ריק אם אין חיילים
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-gray-400 text-sm';
    emptyMessage.textContent = 'אין חיילים משובצים';
    assignmentContainer.appendChild(emptyMessage);
    cell.appendChild(assignmentContainer);
    return;
  }
  
  // טעינת מאגר שמות עדכני אם צריך
  if (soldierNamesMap.size === 0) {
    loadSoldierNamesMap();
  }
  
  // יצירת תגיות לכל חייל משובץ
  let tagsAdded = 0;
  
  // מיון החיילים לפי תפקיד ושם
  const sortedSoldierIds = [...assignment.soldierIds].sort((idA, idB) => {
    const soldierA = getSoldierById(idA);
    const soldierB = getSoldierById(idB);
    
    if (!soldierA || !soldierB) return 0;
    
    // קודם לפי תפקיד
    const roleOrder = { doctor: 1, paramedic: 2, mentor: 3, trainee: 4 };
    const roleA = roleOrder[soldierA.role] || 5;
    const roleB = roleOrder[soldierB.role] || 5;
    
    if (roleA !== roleB) return roleA - roleB;
    
    // אחר כך לפי שם
    return (soldierA.firstName || '').localeCompare(soldierB.firstName || '');
  });
  
  console.log(`מרנדר ${sortedSoldierIds.length} חיילים בתא`, assignment.id);
  
  // חשוב: נעבור על *כל* החיילים ללא הגבלה
  for (const soldierId of sortedSoldierIds) {
    // ניסיון למצוא את החייל
    const soldier = getSoldierById(soldierId);
    
    if (soldier) {
      // יצירת תגית חייל
      const tag = createSoldierTag(soldier, assignment.id);
      assignmentContainer.appendChild(tag);
      tagsAdded++;
    } else {
      console.warn(`לא נמצא חייל עם ID ${soldierId} בשיבוץ ${assignment.id}`);
    }
  }
  
  // אם לא נוספו תגיות, הוסף הודעה
  if (tagsAdded === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-gray-400 text-sm';
    emptyMessage.textContent = 'אין חיילים משובצים';
    assignmentContainer.appendChild(emptyMessage);
  }
  
  // הוספת המיכל לתא
  cell.appendChild(assignmentContainer);
  
  // שינוי משמעותי: במקום להגביל את גובה התא, נאפשר גדילה לפי הצורך
  adjustCellHeightImproved(cell, tagsAdded);
}

// פונקציה משופרת להתאמת גובה תא השיבוץ
function adjustCellHeightImproved(cell, numSoldiers) {
  // הסרת כל הגבלת גובה קודמת
  cell.style.minHeight = '';
  cell.style.maxHeight = '';
  cell.style.height = '';
  
  if (numSoldiers > 0) {
    // חישוב גובה דינמי לפי מספר החיילים - ללא הגבלה מקסימלית
    const baseHeight = 40; // גובה בסיסי
    const heightPerSoldier = 32; // גובה לכל חייל - הגדלנו מ-30 ל-32 לרווח נוסף
    const totalHeight = baseHeight + (numSoldiers * heightPerSoldier);
    
    // הגדרת גובה מינימלי בלבד
    cell.style.minHeight = `${totalHeight}px`;
    
    // וידוא שהתוכן נראה במלואו
    cell.style.overflow = 'visible';
  } else {
    // גובה ברירת מחדל לתא ללא חיילים
    cell.style.minHeight = '40px';
  }
}

function createSoldierTag(soldier, assignmentId) {
  const soldierTag = document.createElement('div');
  soldierTag.className = `soldier-tag ${soldier.role}`;
  
  const soldierName = document.createElement('span');
  soldierName.className = 'soldier-name';
  soldierName.textContent = `${soldier.firstName} ${soldier.lastName}`;
  
  // אם המשתמש הוא מנהל, הוסף כפתור מחיקה
  if (userRole === 'admin') {
    const deleteButton = document.createElement('button');
    deleteButton.className = 'remove-btn';
    
    // הוספת מאזין לאירוע לחיצה עם מניעת התפשטות האירוע
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleRemoveSoldierFromTask(assignmentId, soldier.id);
    });
    
    soldierTag.appendChild(deleteButton);
  }
  
  soldierTag.appendChild(soldierName);
  return soldierTag;
}

// פונקציה לעדכון הסגנון של תאי השיבוץ
function updateAssignmentCellStyles() {
  // הוספת סגנון לכל תאי השיבוץ
  const taskCells = document.querySelectorAll('.task-cell');
  taskCells.forEach(cell => {
    // ביטול הגבלת גובה
    cell.style.maxHeight = 'none';
    cell.style.overflow = 'visible';
  });
  
  // הוספת סגנון למיכלי השיבוץ
  const assignmentContainers = document.querySelectorAll('.assignment-container');
  assignmentContainers.forEach(container => {
    container.style.maxHeight = 'none';
    container.style.overflowY = 'visible';
  });
  
  console.log("סגנונות תאי השיבוץ עודכנו לתמיכה בכל החיילים");
}

// פונקציה שיש להוסיף לסוף renderCalendar
function enhanceCalendarAfterRender() {
  // עדכון סגנונות התאים לתמיכה בכל החיילים
  updateAssignmentCellStyles();
  
  console.log("שיפורים לתמיכה בכל החיילים הוספו ללוח");
}
// פונקציית עזר לבדיקת חפיפות
function checkAssignmentConflicts(assignment) {
  const conflicts = [];
  
  // בדיקה שהשיבוץ תקין
  if (!assignment || !assignment.date || !assignment.soldierIds || !Array.isArray(assignment.soldierIds)) {
    console.warn("נקרא checkAssignmentConflicts עם שיבוץ לא תקין:", assignment);
    return conflicts;
  }
  
  const dateAssignments = assignments.filter(a => 
    a.date === assignment.date && 
    a.id !== assignment.id &&
    a.soldierIds && 
    Array.isArray(a.soldierIds)
  );

  assignment.soldierIds.forEach(soldierId => {
    if (!soldierId) return; // דילוג על ID לא תקין
    
    dateAssignments.forEach(otherAssignment => {
      if (otherAssignment.soldierIds.includes(soldierId)) {
        const task = tasks.find(t => t.id === otherAssignment.taskId);
        if (task) {
          conflicts.push(task.name);
        }
      }
    });
  });

  return [...new Set(conflicts)]; // הסרת כפילות
}


// פונקציית עזר להגדרת מאזיני אירועים לתא
function setupCellEventListeners(cell, task, dateStr, day) {
  cell.addEventListener('dragover', handleDragOver);
  cell.addEventListener('dragleave', handleDragLeave);
  cell.addEventListener('drop', handleDrop);

  if (userRole === 'admin') {
    cell.addEventListener('click', () => {
      showQuickAddDialog(task.id, task.name, dateStr, day);
    });
  }
}

// פונקציית עזר לרינדור שורת הוספת משימה
function renderAddTaskRow(container) {
  const addTaskRow = document.createElement('tr');
  const addTaskCell = document.createElement('td');
  addTaskCell.className = 'p-2 border';
  addTaskCell.colSpan = 8;

  const addTaskBtn = document.createElement('button');
  addTaskBtn.id = 'addTaskBtnRow';
  addTaskBtn.className = 'button button-green w-full';
  addTaskBtn.innerHTML = `
    <svg class="icon-sm mr-2" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14"></path>
    </svg>
    הוסף משימה חדשה
  `;
  addTaskBtn.addEventListener('click', showAddTaskDialog);

  addTaskCell.appendChild(addTaskBtn);
  addTaskRow.appendChild(addTaskCell);
  container.appendChild(addTaskRow);
}

// פונקציה למחיקת משימה
async function handleDeleteTask(taskId) {
  if (userRole !== 'admin') {
    showNotification('רק מנהל יכול למחוק משימות', 'error');
    return;
  }

  if (!confirm(`האם אתה בטוח שברצונך למחוק את המשימה?`)) {
    return;
  }

  try {
    // מחיקת המשימה
    await deleteDoc(doc(db, "tasks", taskId));
    
    // מחיקת כל השיבוצים למשימה זו
    const assignmentsToDelete = assignments.filter(assignment => assignment.taskId === taskId);
    
    for (const assignment of assignmentsToDelete) {
      await deleteDoc(doc(db, "assignments", assignment.id));
    }
    
    showNotification('המשימה נמחקה בהצלחה', 'success');
  } catch (error) {
    console.error("שגיאה במחיקת משימה:", error);
    showNotification('אירעה שגיאה במחיקת המשימה', 'error');
  }
}

// פונקציה לטיפול בהורדת חייל במשימה
function handleDrop(e) {
  e.preventDefault();

  if (userRole !== 'admin') return; // רק מנהל יכול לשבץ

  const soldierId = e.dataTransfer.getData('soldierId');
  console.log("ID של החייל שנגרר:", soldierId); // הוספת לוג לבדיקה
  
  // בדיקה שהתקבל ID תקין
  if (!soldierId) {
    console.error("שגיאה: לא התקבל ID של חייל בעת גרירה");
    showNotification('שגיאה בגרירת החייל', 'error');
    return;
  }
  
  const taskId = this.dataset.taskId;
  const dateStr = this.dataset.date;

  // אפקט ויזואלי
  this.classList.remove('bg-blue-50');

  // שמירת המידע הנוכחי עבור הדיאלוג
  currentQuickAdd.taskId = taskId;
  currentQuickAdd.date = dateStr;
  currentQuickAdd.selectedSoldiers = [soldierId];
  
  console.log("פרטי השיבוץ לפני שליחה:", {
    taskId: taskId,
    date: dateStr,
    soldierId: soldierId
  });

  // פתיחת דיאלוג בחירת סוג השיבוץ
  const dialog = document.getElementById('assignmentTypeDialog');
  if (dialog) {
    dialog.classList.remove('hidden');
    dialog.style.display = 'flex';
  }
}

// פונקציה למניעת התנהגות ברירת מחדל בגרירה והוספת הדגשה
function handleDragOver(e) {
  e.preventDefault();
  this.classList.add('bg-blue-50');
}

// פונקציה לסיום הגרירה והסרת ההדגשה
function handleDragLeave(e) {
  this.classList.remove('bg-blue-50');
}

// פונקציה להגדרת אירועי גרירה ושחרור
function setupDragAndDrop() {
  console.log("מגדיר אירועי גרירה ושחרור...");

  try {
    // הגדרת אירועי גרירה לכרטיסי חיילים
    const soldierCards = document.querySelectorAll('.soldier-card');
    
    console.log(`נמצאו ${soldierCards.length} כרטיסי חיילים, מצב משתמש: ${userRole}`);
    
    // אם המשתמש אינו מנהל, אין צורך להגדיר אירועי גרירה
    if (userRole !== 'admin') {
      console.log("המשתמש אינו במצב עריכה, לא מגדיר אירועי גרירה");
      
      // וידוא שכל הכרטיסים אינם גרירים
      soldierCards.forEach(card => {
        card.draggable = false;
        
        // הסרת מאזינים קודמים אם קיימים
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
      });
      
      return;
    }
    
    // אם המשתמש הוא מנהל, נגדיר אירועי גרירה
    console.log("המשתמש במצב עריכה, מגדיר אירועי גרירה");
    
    soldierCards.forEach(card => {
      // וידוא שמאפיין draggable מוגדר נכון
      card.draggable = true;
      
      // הסרת מאזינים קודמים אם קיימים
      const newCard = card.cloneNode(true);
      card.parentNode.replaceChild(newCard, card);
      
      // הוספת מאזינים חדשים
      newCard.addEventListener('dragstart', (e) => {
        const soldierId = newCard.id.replace('soldier-', '');
        e.dataTransfer.setData('soldierId', soldierId);
        
        // אפקט ויזואלי
        setTimeout(() => {
          newCard.classList.add('dragging');
        }, 0);
      });
      
      newCard.addEventListener('dragend', () => {
        newCard.classList.remove('dragging');
      });
      
      // תמיכה במגע למובייל
      setupMobileDragTouch(newCard, newCard.id.replace('soldier-', ''));
      
      // הוספת מאזינים לכפתורי עריכה ומחיקה
      const editBtn = newCard.querySelector('.edit-btn');
      const deleteBtn = newCard.querySelector('.delete-btn');
      
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const soldierId = editBtn.dataset.soldierId;
          handleEditSoldier(soldierId);
        });
      }
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          const soldierId = deleteBtn.dataset.soldierId;
          handleDeleteSoldier(soldierId);
        });
      }
    });
    
    console.log("הגדרת אירועי גרירה ושחרור הושלמה");
  } catch (error) {
    console.error("שגיאה בהגדרת אירועי גרירה ושחרור:", error);
  }
}

// פונקציה לעדכון toggleReportView

// מאזינים לאירועים בממשק
function setupEventListeners() {
  console.log("מגדיר מאזיני אירועים...");
  try {
    // קביעת מאזינים לכל האלמנטים הדרושים
    setupLoginListeners();
    setupMainButtonsListeners();
    setupCalendarNavigationListeners();
    setupExportButtonsListeners();
    setupTaskDialogListeners();
    setupQuickAddDialogListeners();
    setupSearchListeners();
    
    console.log("הגדרת מאזיני אירועים הושלמה");
  } catch (error) {
    console.error("שגיאה בהגדרת מאזיני האירועים:", error);
    showNotification('אירעה שגיאה בהגדרת מאזיני האירועים', 'error');
  }
}

// מאזינים לאירועים הקשורים להתחברות
function setupAuthEventListeners() {
  console.log("מגדיר מאזיני אירועים להתחברות...");
  try {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', showLoginScreen);
    } else {
      console.warn("לא נמצא אלמנט loginBtn");
    }
    
    const cancelLogin = document.getElementById('cancelLogin');
    if (cancelLogin) {
      cancelLogin.addEventListener('click', hideLoginScreen);
    } else {
      console.warn("לא נמצא אלמנט cancelLogin");
    }
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    } else {
      console.warn("לא נמצא אלמנט loginForm");
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    } else {
      console.warn("לא נמצא אלמנט logoutBtn");
    }
    
    console.log("הגדרת מאזיני אירועים להתחברות הושלמה");
  } catch (error) {
    console.error("שגיאה בהגדרת מאזיני אירועים להתחברות:", error);
  }
}

// מאזינים לכפתורי התחברות
function setupLoginListeners() {
  // טופס התחברות
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  } else {
    console.warn("לא נמצא אלמנט loginForm");
  }
  

  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  } else {
    console.warn("לא נמצא אלמנט logoutBtn");
  }
}

// פונקציה להגדרת אפשרות שינוי גודל רשימת החיילים
function setupResizable() {
  const resizeHandle = document.getElementById('resizeHandle');
  const soldiersPanel = document.querySelector('.soldiers-panel');

  if (!resizeHandle || !soldiersPanel) {
    console.warn("לא נמצאו אלמנטים נדרשים להגדרת אפשרות שינוי גודל");
    return;
  }

  let startY;
  let startHeight;

  function onMouseDown(e) {
    startY = e.clientY;
    startHeight = parseInt(document.defaultView.getComputedStyle(soldiersPanel).height, 10);
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    document.body.style.cursor = 'ns-resize';
    e.preventDefault();
  }

  function onMouseMove(e) {
    // החלפת הגודל לפי כיוון הגרירה (לגרירה מעלה - הגדלת האזור)
    const newHeight = startHeight - (e.clientY - startY);
    
    // הגבלת גודל מינימלי ומקסימלי
    if (newHeight >= 120 && newHeight <= window.innerHeight * 0.7) {
      soldiersPanel.style.height = `${newHeight}px`;
    }
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
  }

  resizeHandle.addEventListener('mousedown', onMouseDown);

  // תמיכה בהתקני מגע
  resizeHandle.addEventListener('touchstart', function(e) {
    const touch = e.touches[0];
    startY = touch.clientY;
    startHeight = parseInt(document.defaultView.getComputedStyle(soldiersPanel).height, 10);
    
    resizeHandle.addEventListener('touchmove', onTouchMove);
    resizeHandle.addEventListener('touchend', onTouchEnd);
    
    e.preventDefault();
  });

  function onTouchMove(e) {
    const touch = e.touches[0];
    const newHeight = startHeight - (touch.clientY - startY);
    
    if (newHeight >= 120 && newHeight <= window.innerHeight * 0.7) {
      soldiersPanel.style.height = `${newHeight}px`;
    }
  }

  function onTouchEnd() {
    resizeHandle.removeEventListener('touchmove', onTouchMove);
    resizeHandle.removeEventListener('touchend', onTouchEnd);
  }
}

// מאזינים לניווט בלוח
function setupCalendarNavigationListeners() {
  // כפתורי ניווט בלוח
  const prevWeekBtn = document.getElementById('prevWeek');
  if (prevWeekBtn) {
    // החלפת הפונקציה מ-subtractWeek ל-addWeek
    prevWeekBtn.addEventListener('click', addWeek);
  } else {
    console.warn("לא נמצא אלמנט prevWeek");
  }

  const nextWeekBtn = document.getElementById('nextWeek');
  if (nextWeekBtn) {
    // החלפת הפונקציה מ-addWeek ל-subtractWeek
    nextWeekBtn.addEventListener('click', subtractWeek);
  } else {
    console.warn("לא נמצא אלמנט nextWeek");
  }

  const currentWeekBtn = document.getElementById('currentWeek');
  if (currentWeekBtn) {
    currentWeekBtn.addEventListener('click', goToCurrentWeek);
  } else {
    console.warn("לא נמצא אלמנט currentWeek");
  }
}

// מאזינים לכפתורי ייצוא
function setupExportButtonsListeners() {
  // כפתורי ייצוא
  const exportExcelBtn = document.getElementById('exportExcel');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', exportToExcel);
  } else {
    console.warn("לא נמצא אלמנט exportExcel");
  }

  const exportSemiAnnualExcelBtn = document.getElementById('exportSemiAnnualExcel');
  if (exportSemiAnnualExcelBtn) {
    exportSemiAnnualExcelBtn.addEventListener('click', exportSemiAnnualToExcel);
  } else {
    console.warn("לא נמצא אלמנט exportSemiAnnualExcel");
  }

  const exportWeeklySummaryExcelBtn = document.getElementById('exportWeeklySummaryExcel');
  if (exportWeeklySummaryExcelBtn) {
    exportWeeklySummaryExcelBtn.addEventListener('click', exportWeeklySummaryToExcel);
  } else {
    console.warn("לא נמצא אלמנט exportWeeklySummaryExcel");
  }
}

// מאזינים לחיפוש
function setupSearchListeners() {
  // חיפוש
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderSoldiers();
    });
  } else {
    console.warn("לא נמצא אלמנט searchInput");
  }
}

// מאזינים לכפתורים ראשיים
function setupMainButtonsListeners() {
  // לחצנים ראשיים
  const addSoldierBtn = document.getElementById('addSoldierBtn');
  if (addSoldierBtn) {
    addSoldierBtn.addEventListener('click', handleAddSoldier);
  } else {
    console.warn("לא נמצא אלמנט addSoldierBtn");
  }
  
  const toggleRoleBtn = document.getElementById('toggleRole');
  if (toggleRoleBtn) {
    toggleRoleBtn.addEventListener('click', toggleRole);
  } else {
    console.warn("לא נמצא אלמנט toggleRole");
  }
  
  const toggleReportBtn = document.getElementById('toggleReport');
  if (toggleReportBtn) {
    toggleReportBtn.addEventListener('click', () => toggleReportView('regular'));
  } else {
    console.warn("לא נמצא אלמנט toggleReport");
  }
  
  const toggleSemiAnnualReportBtn = document.getElementById('toggleSemiAnnualReport');
  if (toggleSemiAnnualReportBtn) {
    toggleSemiAnnualReportBtn.addEventListener('click', () => toggleReportView('semiAnnual'));
  } else {
    console.warn("לא נמצא אלמנט toggleSemiAnnualReport");
  }
  
  const toggleWeeklySummaryBtn = document.getElementById('toggleWeeklySummary');
  if (toggleWeeklySummaryBtn) {
    toggleWeeklySummaryBtn.addEventListener('click', () => toggleReportView('weekly'));
  } else {
    console.warn("לא נמצא אלמנט toggleWeeklySummary");
  }
  
  // כפתורי חזרה ללוח מהדוחות
  const backToCalendarBtn = document.getElementById('backToCalendarBtn');
  if (backToCalendarBtn) {
    backToCalendarBtn.addEventListener('click', () => toggleReportView('calendar'));
  } else {
    console.warn("לא נמצא אלמנט backToCalendarBtn");
  }
  
  const backToCalendarFromSemiBtn = document.getElementById('backToCalendarFromSemiBtn');
  if (backToCalendarFromSemiBtn) {
    backToCalendarFromSemiBtn.addEventListener('click', () => toggleReportView('calendar'));
  } else {
    console.warn("לא נמצא אלמנט backToCalendarFromSemiBtn");
  }
  
  const backToCalendarFromWeeklyBtn = document.getElementById('backToCalendarFromWeeklyBtn');
  if (backToCalendarFromWeeklyBtn) {
    backToCalendarFromWeeklyBtn.addEventListener('click', () => toggleReportView('calendar'));
  } else {
    console.warn("לא נמצא אלמנט backToCalendarFromWeeklyBtn");
  }
}

// פונקציה לסגירת דיאלוג הוספה מהירה
function closeQuickAddDialog() {
  console.log("סוגר דיאלוג הוספה מהירה");
  const dialog = document.getElementById('quickAddDialog');
  if (dialog) {
    dialog.classList.add('hidden');
    dialog.style.display = 'none';
  }
}

// פונקציה לסגירת דיאלוג סוג השיבוץ
function closeAssignmentTypeDialog() {
  console.log("סוגר דיאלוג בחירת סוג שיבוץ");
  const dialog = document.getElementById('assignmentTypeDialog');
  if (dialog) {
    dialog.classList.add('hidden');
    dialog.style.display = 'none';
  }
}

// פונקציה להכנת ההוספה המהירה - שלב ביניים
function prepareQuickAdd() {
  console.log("מכין הוספה מהירה");
  const checkboxes = document.querySelectorAll('#availableSoldiers input[type="checkbox"]:checked');
  
  if (!checkboxes || checkboxes.length === 0) {
    showNotification('לא נבחרו חיילים', 'error');
    return;
  }
  
  const selectedSoldiers = Array.from(checkboxes).map(cb => cb.value);
  console.log("נבחרו חיילים:", selectedSoldiers);

  // שמירת החיילים שנבחרו
  currentQuickAdd.selectedSoldiers = selectedSoldiers;

  // סגירת הדיאלוג הראשון
  closeQuickAddDialog();

  // פתיחת דיאלוג בחירת סוג השיבוץ
  let assignmentTypeDialog = document.getElementById('assignmentTypeDialog');
  if (!assignmentTypeDialog) {
    console.log("דיאלוג בחירת סוג שיבוץ לא קיים - יוצר אותו");
    ensureDialogsExist();
    assignmentTypeDialog = document.getElementById('assignmentTypeDialog');
  }
  
  if (assignmentTypeDialog) {
    assignmentTypeDialog.classList.remove('hidden');
    assignmentTypeDialog.style.display = 'flex';
    console.log("דיאלוג בחירת סוג שיבוץ נפתח");
  } else {
    console.error("לא ניתן למצוא או ליצור את דיאלוג בחירת סוג השיבוץ");
    showNotification('אירעה שגיאה בפתיחת דיאלוג בחירת סוג השיבוץ', 'error');
  }
}

// אישור הוספה מהירה של חיילים
async function confirmQuickAdd(isFullWeek) {
  if (userRole !== 'admin') {
    showNotification('רק מנהל יכול להוסיף שיבוצים', 'error');
    return;
  }

  // סגירת דיאלוג בחירת סוג השיבוץ
  closeAssignmentTypeDialog();

  // בדיקה קריטית - וידוא שיש חיילים נבחרים
  if (!currentQuickAdd.selectedSoldiers || currentQuickAdd.selectedSoldiers.length === 0) {
    console.error("שגיאה: אין חיילים נבחרים", currentQuickAdd);
    showNotification('לא נבחרו חיילים', 'error');
    return;
  }

  console.log("מבצע שיבוץ", { 
    isFullWeek, 
    taskId: currentQuickAdd.taskId, 
    date: currentQuickAdd.date, 
    soldiers: currentQuickAdd.selectedSoldiers 
  });

  try {
    if (isFullWeek) {
      // שיבוץ לכל השבוע
      const daysOfWeek = getDaysOfWeek();
      let successCount = 0;
      
      for (const day of daysOfWeek) {
        const dateStr = formatDateISO(day);
        console.log("משבץ ליום:", dateStr, "חיילים:", currentQuickAdd.selectedSoldiers);
        
        const result = await assignSoldiersToDay(
          currentQuickAdd.taskId,
          dateStr,
          currentQuickAdd.selectedSoldiers
        );
        
        if (result.success) {
          successCount += result.addedCount;
        }
      }
      
      if (successCount > 0) {
        showNotification(`שובצו ${successCount} חיילים בהצלחה לשבוע`, 'success');
        // רינדור מחדש של הלוח
        renderCalendar();
      } else {
        showNotification('לא בוצעו שיבוצים חדשים', 'info');
      }
    } else {
      // שיבוץ ליום אחד
      console.log("משבץ ליום בודד:", currentQuickAdd.date, "חיילים:", currentQuickAdd.selectedSoldiers);
      
      const result = await assignSoldiersToDay(
        currentQuickAdd.taskId,
        currentQuickAdd.date,
        currentQuickAdd.selectedSoldiers
      );
      
      if (result.success && result.addedCount > 0) {
        showNotification(`שובצו ${result.addedCount} חיילים בהצלחה`, 'success');
        // רינדור מחדש של הלוח
        renderCalendar();
      } else {
        console.error("שגיאה בשיבוץ:", result);
        showNotification('לא בוצעו שיבוצים חדשים', 'info');
      }
    }
    
    // דיאגנוסטיקה - בדיקת כל השיבוצים
    console.log("שיבוצים לאחר הפעולה:", assignments);
    
  } catch (error) {
    console.error("שגיאה בשיבוץ חיילים:", error);
    showNotification('אירעה שגיאה בשיבוץ החיילים', 'error');
  }
}

// פונקציה להצגת דיאלוג הוספה מהירה
function showQuickAddDialog(taskId, taskName, dateStr, day) {
  console.log("מנסה לפתוח דיאלוג הוספה מהירה");
  if (userRole !== 'admin') {
    showNotification('רק מנהל יכול להוסיף שיבוצים', 'error');
    return;
  }

  // שמירת המידע הנוכחי
  currentQuickAdd.taskId = taskId;
  currentQuickAdd.date = dateStr;
  currentQuickAdd.selectedSoldiers = [];

  // וידוא שהדיאלוג קיים
  let dialog = document.getElementById('quickAddDialog');
  if (!dialog) {
    console.log("דיאלוג הוספה מהירה לא קיים - יוצר אותו");
    ensureDialogsExist();
    dialog = document.getElementById('quickAddDialog');
  }

  if (dialog) {
    // עדכון כותרת הדיאלוג
    const taskNameElement = document.getElementById('quickAddTaskName');
    const dateElement = document.getElementById('quickAddDate');
    
    if (taskNameElement) taskNameElement.textContent = taskName;
    if (dateElement) dateElement.textContent = formatDateHebrew(dateStr);

    // קבלת רשימת החיילים הזמינים (שלא משובצים באותו יום)
    const availableSoldiers = soldiers.filter(soldier => !hasConflict(soldier.id, dateStr));

    // רינדור החיילים הזמינים
    const soldiersContainer = document.getElementById('availableSoldiers');
    if (soldiersContainer) {
      soldiersContainer.innerHTML = '';

      if (availableSoldiers.length === 0) {
        soldiersContainer.innerHTML = '<div class="text-center text-gray-400 py-4">אין חיילים פנויים ביום זה</div>';
      } else {
        // מיון לפי תפקיד
        const sortedSoldiers = [...availableSoldiers].sort((a, b) => {
          const roleOrder = { doctor: 1, paramedic: 2, mentor: 3, trainee: 4 };
          return roleOrder[a.role] - roleOrder[b.role] || a.firstName.localeCompare(b.firstName);
        });
        
        sortedSoldiers.forEach(soldier => {
          const checkbox = document.createElement('div');
          checkbox.className = 'soldier-checkbox';
          
          const roleLabel = 
            soldier.role === 'doctor' ? 'רופא' : 
            soldier.role === 'paramedic' ? 'פראמדיק' : 
            soldier.role === 'trainee' ? 'חניך' : 'חונך';
          
          checkbox.innerHTML = `
            <input type="checkbox" id="soldier-${soldier.id}" value="${soldier.id}">
            <label for="soldier-${soldier.id}" class="${soldier.role}">
              ${soldier.firstName} ${soldier.lastName} <span class="text-gray-500">(${roleLabel})</span>
            </label>
          `;
          
          soldiersContainer.appendChild(checkbox);
        });
      }
    }

    // הצגת הדיאלוג - תיקון: הסרת hidden ועדכון display
    dialog.classList.remove('hidden');
    dialog.style.display = 'flex';
    console.log("דיאלוג הוספה מהירה נפתח");
  } else {
    console.error("לא ניתן למצוא או ליצור את דיאלוג ההוספה המהירה");
    showNotification('אירעה שגיאה בפתיחת דיאלוג ההוספה המהירה', 'error');
  }
}
// הוסף את הקוד הזה בקונסול כדי לבדוק את הדאטה
async function checkFirebaseData() {
  console.log("בודק נתונים ב-Firebase...");
  
  try {
    // בדיקת קולקציית חיילים
    const soldiersSnapshot = await getDocs(collection(db, "soldiers"));
    console.log("חיילים ב-Firebase:", soldiersSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    
    // בדיקת קולקציית משימות
    const tasksSnapshot = await getDocs(collection(db, "tasks"));
    console.log("משימות ב-Firebase:", tasksSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    
    // בדיקת קולקציית שיבוצים
    const assignmentsSnapshot = await getDocs(collection(db, "assignments"));
    console.log("שיבוצים ב-Firebase:", assignmentsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
  } catch (error) {
    console.error("שגיאה בבדיקת נתונים:", error);
  }
}

// הפעל את הפונקציה
checkFirebaseData();
// פונקציה משופרת לטעינת נתונים מ-Firestore
async function loadDataFromFirestore() {
  console.log("מתחיל טעינת נתונים מ-Firestore...");
  
  try {
    // הסרת מאזינים קודמים אם קיימים
    removeFirestoreListeners();
    
    // המתנה לטעינת מידע המשתמש לפני המשך
    if (currentUser) {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          // אם המשתמש הוא מנהל, בדוק אם יש מצב שמור
          const savedViewMode = localStorage.getItem('userViewMode');
          if (savedViewMode) {
            userRole = savedViewMode;
            console.log("נטען מצב צפייה מהאחסון המקומי:", userRole);
          }
        }
      } catch (error) {
        console.error("שגיאה בטעינת נתוני משתמש:", error);
      }
    }
    
    // עדכון הממשק לפי המצב השמור לפני טעינת הנתונים
    updateInterfaceForRole();
    
    // הגדרת Promise לטעינת חיילים
    const loadSoldiersPromise = new Promise((resolve, reject) => {
      console.log("מגדיר מאזין לאוסף soldiers...");
      unsubscribeSoldiers = onSnapshot(
        collection(db, "soldiers"),
        (snapshot) => {
          console.log(`התקבלו ${snapshot.docs.length} חיילים מהמסד`);
          
          // נרמול כל המזהים של החיילים
          soldiers = snapshot.docs.map(doc => ({
            id: normalizeId(doc.id),
            ...doc.data()
          }));
          
          // עדכון מאגר השמות הגלובלי
          loadSoldierNamesMap();
          
          // שליחת אירוע מערכת שהחיילים נטענו
          const event = new CustomEvent('soldiersLoaded');
          document.dispatchEvent(event);
          
          resolve(soldiers);
        },
        (error) => {
          console.error("שגיאה בטעינת חיילים:", error);
          showNotification('אירעה שגיאה בטעינת נתוני החיילים: ' + error.message, 'error');
          reject(error);
        }
      );
    });
    
    // המתנה לטעינת החיילים לפני המשך
    await loadSoldiersPromise;
    
    // רינדור החיילים
    renderSoldiers();
    
    // טעינת משימות לאחר שהחיילים כבר נטענו
    loadTasks();
    
  } catch (error) {
    console.error("שגיאה בטעינת נתונים:", error);
    showNotification('אירעה שגיאה בטעינת הנתונים: ' + error.message, 'error');
  }
}

// שיפור פונקציית טעינת משימות
function loadTasks() {
  console.log("מגדיר מאזין לאוסף משימות...");
  
  return new Promise((resolve, reject) => {
    try {
      unsubscribeTasks = onSnapshot(
        collection(db, "tasks"),
        (snapshot) => {
          console.log(`התקבלו ${snapshot.docs.length} משימות מהמסד`);
          
          // נרמול מזהי המשימות
          tasks = snapshot.docs.map(doc => ({
            id: normalizeId(doc.id),
            ...doc.data()
          }));
          
          // שליחת אירוע מערכת שהמשימות נטענו
          const event = new CustomEvent('tasksLoaded');
          document.dispatchEvent(event);
          
          resolve(tasks);
          
          // טעינת שיבוצים רק לאחר טעינת המשימות
          loadAssignments();
        },
        (error) => {
          console.error("שגיאה בטעינת משימות:", error);
          showNotification('אירעה שגיאה בטעינת נתוני המשימות: ' + error.message, 'error');
          reject(error);
        }
      );
    } catch (error) {
      console.error("שגיאה בהגדרת מאזין למשימות:", error);
      reject(error);
    }
  });
}

// שיפור פונקציית טעינת שיבוצים
function loadAssignments() {
  console.log("מגדיר מאזין לאוסף שיבוצים...");
  
  return new Promise((resolve, reject) => {
    try {
      unsubscribeAssignments = onSnapshot(
        collection(db, "assignments"),
        (snapshot) => {
          console.log(`התקבלו ${snapshot.docs.length} שיבוצים מהמסד`);
          
          // נרמול כל השיבוצים
          assignments = snapshot.docs.map(doc => {
            const data = doc.data();
            return normalizeAssignment({
              id: normalizeId(doc.id),
              ...data
            });
          });
          
          // שליחת אירוע מערכת שהשיבוצים נטענו
          const event = new CustomEvent('assignmentsLoaded');
          document.dispatchEvent(event);
          
          // עדכון מאגר השמות
          loadSoldierNamesMap();
          
          // רינדור לוח השנה רק לאחר טעינת כל הנתונים
          renderCalendar();
          
          resolve(assignments);
        },
        (error) => {
          console.error("שגיאה בטעינת שיבוצים:", error);
          showNotification('אירעה שגיאה בטעינת נתוני השיבוצים: ' + error.message, 'error');
          reject(error);
        }
      );
    } catch (error) {
      console.error("שגיאה בהגדרת מאזין לשיבוצים:", error);
      reject(error);
    }
  });
}
// פונקציה לנרמול כל המזהים למחרוזות
function normalizeId(id) {
  if (id === null || id === undefined) return null;
  return String(id);
}

// פונקציה לנרמול מערך מזהים
function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.map(id => normalizeId(id)).filter(id => id !== null);
}

// פונקציה לנרמול שיבוץ
function normalizeAssignment(assignment) {
  if (!assignment) return null;
  
  const normalizedAssignment = {...assignment};
  
  // וידוא שהמזהה של המשימה הוא מחרוזת
  if (normalizedAssignment.taskId) {
    normalizedAssignment.taskId = normalizeId(normalizedAssignment.taskId);
  }
  
  // וידוא שמערך המזהים של החיילים מכיל רק מחרוזות
  if (normalizedAssignment.soldierIds) {
    normalizedAssignment.soldierIds = normalizeIds(normalizedAssignment.soldierIds);
  }
  
  return normalizedAssignment;
}
// פונקציה להסרת מאזינים של Firestore
function removeFirestoreListeners() {
  if (unsubscribeSoldiers) {
    unsubscribeSoldiers();
    unsubscribeSoldiers = null;
  }

  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }

  if (unsubscribeAssignments) {
    unsubscribeAssignments();
    unsubscribeAssignments = null;
  }
}

// מאגר גלובלי של שמות חיילים לשימוש בדוחות
// מאגר גלובלי משופר של שמות חיילים
let soldierNamesMap = new Map();

// פונקציה משופרת לטעינת מאגר שמות חיילים
function loadSoldierNamesMap() {
  console.log("טוען מאגר שמות חיילים");
  
  // איפוס המאגר
  soldierNamesMap = new Map();
  
  // בדיקה שיש חיילים
  if (!soldiers || !Array.isArray(soldiers) || soldiers.length === 0) {
    console.warn("אין חיילים במערכת או שהמערך לא תקין");
    return soldierNamesMap;
  }
  
  console.log(`מעבד ${soldiers.length} חיילים למאגר שמות`);
  
  // מעבר על כל החיילים ושמירת השמות שלהם
  soldiers.forEach(soldier => {
    if (!soldier || !soldier.id) {
      console.warn("נמצא חייל לא תקין:", soldier);
      return;
    }
    
    // יצירת השם המלא עם התחשבות בערכי null או undefined
    const firstName = soldier.firstName || '';
    const lastName = soldier.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    if (!fullName) {
      console.warn(`חייל עם ID ${soldier.id} חסר שם!`);
      return;
    }
    
    // שימוש במבנה Map במקום אובייקט רגיל
    const normalizedId = normalizeId(soldier.id);
    soldierNamesMap.set(normalizedId, {
      name: fullName,
      role: soldier.role || '',
      firstName: firstName,
      lastName: lastName
    });
  });
  
  console.log(`נטענו ${soldierNamesMap.size} שמות חיילים למאגר`);
  
  return soldierNamesMap;
}

// פונקציה משופרת לקבלת שם חייל 
function getSoldierName(soldierId) {
  if (!soldierId) return 'שם לא זמין';
  
  // המרה למחרוזת של ה-ID
  const normalizedId = normalizeId(soldierId);
  
  // חיפוש במאגר השמות
  const soldierInfo = soldierNamesMap.get(normalizedId);
  if (soldierInfo) {
    return soldierInfo.name;
  }
  
  // אם לא נמצא, חיפוש ישיר במערך החיילים
  const soldier = soldiers.find(s => normalizeId(s.id) === normalizedId);
  if (soldier) {
    const fullName = `${soldier.firstName || ''} ${soldier.lastName || ''}`.trim();
    // עדכון המאגר עם השם שמצאנו
    soldierNamesMap.set(normalizedId, {
      name: fullName,
      role: soldier.role || '',
      firstName: soldier.firstName || '',
      lastName: soldier.lastName || ''
    });
    
    return fullName;
  }
  
  return 'שם לא זמין';
}

// פונקציה משופרת להצגת שם חייל עם עיצוב HTML
function getSoldierNameSpan(soldierId) {
  if (!soldierId) return '';
  
  const normalizedId = normalizeId(soldierId);
  const soldierInfo = soldierNamesMap.get(normalizedId);
  
  if (soldierInfo) {
    return `<span class="${soldierInfo.role || ''}">${soldierInfo.name}</span>`;
  }
  
  // אם לא נמצא במאגר, חיפוש ישיר
  const soldier = soldiers.find(s => normalizeId(s.id) === normalizedId);
  if (soldier) {
    const fullName = `${soldier.firstName || ''} ${soldier.lastName || ''}`.trim();
    return `<span class="${soldier.role || ''}">${fullName}</span>`;
  }
  
  return '';
}

// פונקציה להחזרת אובייקט חייל לפי מזהה
function getSoldierById(soldierId) {
  if (!soldierId) return null;
  
  const normalizedId = normalizeId(soldierId);
  return soldiers.find(s => normalizeId(s.id) === normalizedId) || null;
}
// פונקציית דיבוג מיוחדת לבדיקת מאגר השמות
function testReportSoldiers() {
  console.log("=== בדיקת מאגר שמות החיילים ===");
  
  // בדיקה של המאגר הגלובלי
  console.log(`מאגר שמות גלובלי מכיל ${Object.keys(soldierNamesMap).length} רשומות`);
  
  // הדפסת כמה דוגמאות
  const sampleEntries = Object.entries(soldierNamesMap).slice(0, 5);
  console.log("דוגמאות מהמאגר הגלובלי:", sampleEntries);
  
  // בדיקה של מערך החיילים
  console.log(`מערך חיילים מכיל ${soldiers.length} חיילים`);
  
  // אם יש חיילים, בדוק את הראשון
  if (soldiers.length > 0) {
    const firstSoldier = soldiers[0];
    console.log("חייל ראשון:", firstSoldier);
    console.log("ID של החייל הראשון:", firstSoldier.id, "סוג:", typeof firstSoldier.id);
    
    // בדיקה אם החייל נמצא במאגר
    const nameInMap = soldierNamesMap[firstSoldier.id];
    console.log(`האם החייל ${firstSoldier.firstName} ${firstSoldier.lastName} נמצא במאגר? ${nameInMap ? 'כן' : 'לא'}`);
    
    if (!nameInMap) {
      // נסה כמחרוזת
      const nameAsString = soldierNamesMap[String(firstSoldier.id)];
      console.log(`האם החייל נמצא במאגר כמחרוזת? ${nameAsString ? 'כן' : 'לא'}`);
    }
  }
  
  // בדיקת תקינות שמות החיילים
  let missingNames = 0;
  soldiers.forEach(soldier => {
    const fullName = `${soldier.firstName || ''} ${soldier.lastName || ''}`.trim();
    if (!fullName) {
      console.warn(`חייל עם ID ${soldier.id} חסר שם!`);
      missingNames++;
    }
  });
  
  if (missingNames > 0) {
    console.warn(`יש ${missingNames} חיילים ללא שם במערכת`);
  }
  
  console.log("=== סיום בדיקת מאגר שמות החיילים ===");
}

// פונקציית דיבוג לבדיקת שיבוצים יומיים
function debugDailyAssignments() {
  console.log("=== בדיקת שיבוצים יומיים ===");
  
  const today = new Date();
  const todayISOString = formatDateISO(today);
  console.log("תאריך היום:", todayISOString);
  
  // בדיקת מערך השיבוצים
  if (!assignments || !Array.isArray(assignments)) {
    console.error("מערך השיבוצים לא תקין!");
    return;
  }
  
  console.log(`סה"כ שיבוצים במערכת: ${assignments.length}`);
  
  // מציאת שיבוצים להיום
  const todayAssignments = assignments.filter(a => {
    console.log("בודק שיבוץ:", {
      assignmentDate: a.date,
      todayDate: todayISOString,
      isMatch: a.date === todayISOString,
      assignment: a
    });
    return a.date === todayISOString;
  });
  
  console.log(`נמצאו ${todayAssignments.length} שיבוצים להיום:`, todayAssignments);
  
  // בדיקת פרטי השיבוצים
  todayAssignments.forEach((assignment, index) => {
    console.log(`\nשיבוץ ${index + 1}:`);
    console.log("מזהה משימה:", assignment.taskId);
    
    // מציאת המשימה המתאימה
    const task = tasks.find(t => t.id === assignment.taskId);
    console.log("פרטי המשימה:", task);
    
    // בדיקת החיילים המשובצים
    if (assignment.soldierIds && Array.isArray(assignment.soldierIds)) {
      console.log(`מספר חיילים משובצים: ${assignment.soldierIds.length}`);
      
      assignment.soldierIds.forEach(soldierId => {
        const soldier = soldiers.find(s => String(s.id) === String(soldierId));
        console.log("פרטי חייל:", {
          id: soldierId,
          foundSoldier: soldier,
          nameInMap: soldierNamesMap[soldierId]
        });
      });
    } else {
      console.warn("אין רשימת חיילים בשיבוץ זה!");
    }
  });
  
  console.log("=== סיום בדיקת שיבוצים יומיים ===");
}
  // קריאה לפונקציית הדיבוג
  debugDailyAssignments();
    