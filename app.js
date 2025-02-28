// יבוא ספריות Firebase
import { 
    getFirestore, 
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
    addDoc,
    serverTimestamp,
    enableIndexedDbPersistence
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
  
  import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    signInAnonymously
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
  
  // מידע מרכזי
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
  
  // אובייקט עבור המשבצת הנוכחית לשיבוץ מהיר
  let currentQuickAdd = {
    taskId: null,
    date: null,
    selectedSoldiers: []
  };
  
  // פונקציה לאתחול האפליקציה
  async function initApp() {
    console.log("מאתחל אפליקציה...");
    
    // הפעלת מצב עבודה לא מקוון (offline)
    const db = getFirestore();
    enableIndexedDbPersistence(db)
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.error("Multiple tabs open, persistence can only be enabled in one tab at a time.");
        } else if (err.code == 'unimplemented') {
          console.error("The current browser does not support all of the features required to enable persistence");
        }
      });
  
    // הגדרת מאזינים לממשק המשתמש
    setupEventListeners();
    
    // הגדרת אפשרות שינוי גודל רשימת החיילים
    setupResizable();
    
    // מאזין לשינויים בסטטוס ההתחברות
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // משתמש מחובר
        currentUser = user;
        isAuthenticated = true;
        
        if (user.isAnonymous) {
          // משתמש אנונימי - מצב צפייה בלבד
          userRole = 'viewer';
          document.getElementById('toggleRole').style.display = 'none';
        } else {
          // בדיקה האם המשתמש הוא מנהל
          checkIfAdmin(user)
            .then(isAdmin => {
              userRole = isAdmin ? 'admin' : 'viewer';
              document.getElementById('toggleRole').style.display = isAdmin ? 'flex' : 'none';
              document.getElementById('roleText').textContent = userRole === 'admin' ? 'מנהל' : 'צופה';
            });
        }
        
        // הצגת פרטי המשתמש
        document.getElementById('userEmail').textContent = user.email || 'משתמש אורח';
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('schedulerView').classList.remove('hidden');
        
        // טעינת נתונים מ-Firestore
        loadDataFromFirestore();
      } else {
        // משתמש לא מחובר
        currentUser = null;
        isAuthenticated = false;
        userRole = 'viewer';
        
        // הסרת מאזינים קיימים
        removeFirestoreListeners();
        
        // הצגת מסך התחברות
        document.getElementById('userInfo').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('schedulerView').classList.add('hidden');
      }
    });
  }
  
  // פונקציה לבדיקה אם המשתמש הוא מנהל
  async function checkIfAdmin(user) {
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists() && userDoc.data().role === 'admin') {
      return true;
    }
    
    // אם אין מסמך למשתמש, יצירת אחד עם תפקיד ברירת מחדל
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        email: user.email,
        role: 'viewer',
        createdAt: serverTimestamp()
      });
    }
    
    return false;
  }
  
  // פונקציה לטעינת נתונים מ-Firestore
  function loadDataFromFirestore() {
    const db = getFirestore();
    
    // טעינת חיילים עם מאזין לשינויים
    if (unsubscribeSoldiers) unsubscribeSoldiers();
    
    unsubscribeSoldiers = onSnapshot(collection(db, "soldiers"), (snapshot) => {
      soldiers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      renderSoldiers();
    });
    
    // טעינת משימות עם מאזין לשינויים
    if (unsubscribeTasks) unsubscribeTasks();
    
    unsubscribeTasks = onSnapshot(collection(db, "tasks"), (snapshot) => {
      tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      renderCalendar();
    });
    
    // טעינת שיבוצים עם מאזין לשינויים
    if (unsubscribeAssignments) unsubscribeAssignments();
    
    unsubscribeAssignments = onSnapshot(collection(db, "assignments"), (snapshot) => {
      assignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      renderCalendar();
    });
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
  
  // פונקציה לטיפול בהתחברות
  async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, username, password);
      errorDiv.classList.add('hidden');
      
      // הועבר לתוך onAuthStateChanged
    } catch (error) {
      console.error("שגיאת התחברות:", error);
      errorDiv.textContent = getFirebaseErrorMessage(error.code);
      errorDiv.classList.remove('hidden');
    }
  }
  
  // פונקציה לכניסה כאורח (מצב צפייה בלבד)
  async function handleGuestLogin() {
    try {
      const auth = getAuth();
      await signInAnonymously(auth);
      document.getElementById('loginError').classList.add('hidden');
    } catch (error) {
      console.error("שגיאת התחברות כאורח:", error);
      const errorDiv = document.getElementById('loginError');
      errorDiv.textContent = getFirebaseErrorMessage(error.code);
      errorDiv.classList.remove('hidden');
    }
  }
  
  // פונקציה להתנתקות
  async function handleLogout() {
    try {
      const auth = getAuth();
      await signOut(auth);
      
      soldiers = [];
      tasks = [];
      assignments = [];
      
      showNotification('התנתקת בהצלחה', 'info');
    } catch (error) {
      console.error("שגיאת התנתקות:", error);
      showNotification('אירעה שגיאה בהתנתקות', 'error');
    }
  }
  
  // פונקציה לקבלת הודעת שגיאה של Firebase בעברית
  function getFirebaseErrorMessage(errorCode) {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'כתובת האימייל אינה תקינה';
      case 'auth/user-disabled':
        return 'חשבון זה הושבת';
      case 'auth/user-not-found':
        return 'לא נמצא חשבון המשויך לאימייל זה';
      case 'auth/wrong-password':
        return 'סיסמה שגויה';
      case 'auth/too-many-requests':
        return 'יותר מדי ניסיונות כניסה. נסה שוב מאוחר יותר';
      default:
        return 'אירעה שגיאה בהתחברות';
    }
  }
  
  // הוספת האזנה לאירועים
  function setupEventListeners() {
    // טופס התחברות
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('guestLogin').addEventListener('click', handleGuestLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // לחצנים ראשיים
    document.getElementById('addSoldierBtn').addEventListener('click', handleAddSoldier);
    document.getElementById('toggleRole').addEventListener('click', toggleRole);
    document.getElementById('toggleReport').addEventListener('click', () => toggleReportView('regular'));
    document.getElementById('toggleSemiAnnualReport').addEventListener('click', () => toggleReportView('semiAnnual'));
    document.getElementById('toggleWeeklySummary').addEventListener('click', () => toggleReportView('weekly'));
    
    // כפתורי חזרה ללוח מהדוחות
    document.getElementById('backToCalendarBtn').addEventListener('click', () => toggleReportView('calendar'));
    document.getElementById('backToCalendarFromSemiBtn').addEventListener('click', () => toggleReportView('calendar'));
    document.getElementById('backToCalendarFromWeeklyBtn').addEventListener('click', () => toggleReportView('calendar'));
    
    document.getElementById('prevWeek').addEventListener('click', subtractWeek);
    document.getElementById('nextWeek').addEventListener('click', addWeek);
    document.getElementById('currentWeek').addEventListener('click', goToCurrentWeek);
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);
    document.getElementById('exportSemiAnnualExcel').addEventListener('click', exportSemiAnnualToExcel);
    document.getElementById('exportWeeklySummaryExcel').addEventListener('click', exportWeeklySummaryToExcel);
    
    // הוספת משימה חדשה
    document.getElementById('addTaskBtn').addEventListener('click', showAddTaskDialog);
    document.getElementById('closeAddTaskDialog').addEventListener('click', closeAddTaskDialog);
    document.getElementById('addTaskCancel').addEventListener('click', closeAddTaskDialog);
    document.getElementById('addTaskConfirm').addEventListener('click', confirmAddTask);
    
    // חיפוש
    document.getElementById('searchInput').addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderSoldiers();
    });
    
    // הוספה מהירה דיאלוג
    document.getElementById('closeQuickAdd').addEventListener('click', closeQuickAddDialog);
    document.getElementById('quickAddCancel').addEventListener('click', closeQuickAddDialog);
    document.getElementById('quickAddConfirm').addEventListener('click', prepareQuickAdd);
    document.querySelector('.dialog-overlay').addEventListener('click', closeQuickAddDialog);
    
    // דיאלוג בחירת סוג שיבוץ
    document.getElementById('closeAssignmentTypeDialog').addEventListener('click', closeAssignmentTypeDialog);
    document.getElementById('assignSingleDay').addEventListener('click', () => confirmQuickAdd(false));
    document.getElementById('assignFullWeek').addEventListener('click', () => confirmQuickAdd(true));
  }
  
  // פונקציה לפתיחת דיאלוג הוספת משימה
  function showAddTaskDialog() {
    if (userRole !== 'admin') {
      showNotification('רק מנהל יכול להוסיף משימות חדשות', 'error');
      return;
    }
    
    // איפוס שדות הטופס
    document.getElementById('newTaskName').value = '';
    
    // הצגת הדיאלוג
    document.getElementById('addTaskDialog').classList.remove('hidden');
  }
  
  // פונקציה לסגירת דיאלוג הוספת משימה
  function closeAddTaskDialog() {
    document.getElementById('addTaskDialog').classList.add('hidden');
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
      const db = getFirestore();
      
      // הוספת המשימה החדשה
      await addDoc(collection(db, "tasks"), {
        name: taskName,
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
  
  // פונקציה למעבר לשבוע הנוכחי
  function goToCurrentWeek() {
    currentWeek = getNextThursday();
    renderCalendar();
  }
  
  // פונקציה לסגירת דיאלוג סוג השיבוץ
  function closeAssignmentTypeDialog() {
    document.getElementById('assignmentTypeDialog').classList.add('hidden');
  }
  
  // פונקציה להגדרת אפשרות שינוי גודל רשימת החיילים
  function setupResizable() {
    const resizeHandle = document.getElementById('resizeHandle');
    const soldiersPanel = document.querySelector('.soldiers-panel');
    
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
  
  // פונקציה לחישוב תאריך יום חמישי הקרוב
  function getNextThursday() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = ראשון, 4 = חמישי
    const daysToThursday = (dayOfWeek <= 4) ? 4 - dayOfWeek : 11 - dayOfWeek;
    const thursday = new Date(today);
    thursday.setDate(today.getDate() + daysToThursday);
    thursday.setHours(0, 0, 0, 0);
    return thursday;
  }
  
  // רינדור של לוח השנה
  function renderCalendar() {
    renderCalendarHeader();
    renderCalendarBody();
  }
  
  // רינדור של כותרות לוח השנה
  function renderCalendarHeader() {
    const daysRow = document.getElementById('daysHeaderRow');
    const dateRangeElement = document.getElementById('dateRange');
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
      
      // בדיקה אם היום הוא חג
      const holiday = isHoliday(day);
      let holidayText = '';
      
      if (holiday) {
        holidayText = `<div class="holiday-name">${holiday}</div>`;
        th.classList.add('holiday');
      }
      
      th.innerHTML = `
        ${dayName}
        <div class="text-sm">${formatDateWithYear(day)}</div>
        ${holidayText}
      `;
      
      daysRow.appendChild(th);
    });
    
    // עדכון טווח התאריכים
    const firstDay = daysOfWeek[0];
    const lastDay = daysOfWeek[6];
    dateRangeElement.textContent = `${formatDateWithYear(firstDay)} - ${formatDateWithYear(lastDay)}`;
  }
  
  // רינדור של גוף לוח השנה
  function renderCalendarBody() {
    const calendarBodyElement = document.getElementById('calendarBody');
    const daysOfWeek = getDaysOfWeek();
    
    calendarBodyElement.innerHTML = '';
    
    tasks.forEach(task => {
      const tr = document.createElement('tr');
      
      // תא המשימה (שם המשימה מופיע בעמודה הראשונה)
      const taskCell = document.createElement('td');
      taskCell.className = 'p-2 border font-medium task-name';
      
      // אם המשתמש הוא מנהל, הוסף אייקון מחיקה
      if (userRole === 'admin') {
        const taskContainer = document.createElement('div');
        taskContainer.className = 'flex justify-between items-center';
        
        const taskName = document.createElement('span');
        taskName.textContent = task.name;
        taskContainer.appendChild(taskName);
        
        // אייקון מחיקה
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
        taskCell.appendChild(taskContainer);
      } else {
        // צופה רגיל רואה רק את שם המשימה
        taskCell.textContent = task.name;
      }
      
      tr.appendChild(taskCell);
      
      // תאים לכל יום
      daysOfWeek.forEach(day => {
        const dateStr = formatDateISO(day);
        const assignment = assignments.find(
          a => a.taskId === task.id && a.date === dateStr
        );
        
        const td = document.createElement('td');
        td.className = 'task-cell border';
        
        // בדיקה אם היום הוא חג
        if (isHoliday(day)) {
          td.classList.add('holiday-cell');
        }
        
        td.dataset.taskId = task.id;
        td.dataset.date = dateStr;
        
        // הוספת event listeners לגרירה
        td.addEventListener('dragover', handleDragOver);
        td.addEventListener('dragleave', handleDragLeave);
        td.addEventListener('drop', handleDrop);
        
        // הוספת event listener ללחיצה על התא להוספה מהירה
        td.addEventListener('click', () => {
          if (userRole === 'admin') {
            showQuickAddDialog(task.id, task.name, dateStr, day);
          }
        });
        
        // אם אין משימה, הוסף אייקון פלוס במצב מנהל
        if (!assignment && userRole === 'admin') {
          const emptyCell = document.createElement('div');
          emptyCell.className = 'h-full w-full flex items-center justify-center opacity-20';
          emptyCell.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          `;
          td.appendChild(emptyCell);
        }
        
        // אם יש שיבוץ, הצג אותו
        if (assignment) {
          const assignmentContainer = document.createElement('div');
          assignmentContainer.className = 'flex flex-wrap gap-1';
          
          assignment.soldierIds.forEach(soldierId => {
            const soldier = soldiers.find(s => s.id === soldierId);
            if (soldier) {
              const soldierTag = document.createElement('div');
              soldierTag.className = `soldier-tag ${soldier.role}`;
              
              // הוספת אייקון פח למחיקה
              const trashIcon = `
                <svg class="trash-icon" viewBox="0 0 24 24">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              `;
              
              soldierTag.innerHTML = `
                ${userRole === 'admin' ? trashIcon : ''}
                ${soldier.firstName} ${soldier.lastName}
              `;
              
              assignmentContainer.appendChild(soldierTag);
              
              // הוספת event listener להסרת חייל
              if (userRole === 'admin') {
                setTimeout(() => {
                  const removeBtn = soldierTag.querySelector('.trash-icon');
                  if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                      e.stopPropagation(); // מניעת הפעלת הלחיצה על התא
                      handleRemoveSoldierFromTask(assignment.id, soldierId);
                    });
                  }
                }, 0);
              }
            }
          });
          
          td.appendChild(assignmentContainer);
          
          // התאמת הגובה לפי כמות החיילים המשובצים
          const numSoldiers = assignment.soldierIds.length;
          if (numSoldiers > 1) {
            // קביעת גובה דינמי לפי כמות החיילים
            const baseHeight = 40; // גובה בסיסי
            const heightPerSoldier = 30; // גובה נוסף לכל חייל
            const totalHeight = baseHeight + (numSoldiers - 1) * heightPerSoldier;
            
            // הגבלת גובה מקסימלי
            const maxHeight = 200;
            td.style.height = `${Math.min(totalHeight, maxHeight)}px`;
          } else {
            // גובה ברירת מחדל לתא עם חייל אחד
            td.style.height = '40px';
          }
        } else {
          // גובה ברירת מחדל לתא ריק
          td.style.height = '40px';
        }
        
        tr.appendChild(td);
      });
      
      calendarBodyElement.appendChild(tr);
    });
    
    // הוספת שורה לכפתור "הוסף משימה" (רק למנהלים)
    if (userRole === 'admin') {
      const addTaskRow = document.createElement('tr');
      const addTaskCell = document.createElement('td');
      addTaskCell.className = 'p-2 border';
      
      const addTaskBtn = document.createElement('button');
      addTaskBtn.id = 'addTaskBtn';
      addTaskBtn.className = 'button button-green w-full';
      addTaskBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
        הוסף משימה
      `;
      addTaskBtn.addEventListener('click', showAddTaskDialog);
      
      addTaskCell.appendChild(addTaskBtn);
      addTaskRow.appendChild(addTaskCell);
      
      // הוספת תאים ריקים לשאר העמודות
      for (let i = 0; i < daysOfWeek.length; i++) {
        const emptyCell = document.createElement('td');
        emptyCell.className = 'border';
        addTaskRow.appendChild(emptyCell);
      }
      
      calendarBodyElement.appendChild(addTaskRow);
    }
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
      const db = getFirestore();
      
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
  
  // פונקציה לפתיחת דיאלוג הוספה מהירה
  function showQuickAddDialog(taskId, taskName, dateStr, dateObj) {
    if (userRole !== 'admin') {
      showNotification('רק מנהל יכול להוסיף שיבוצים', 'error');
      return;
    }
    
    // שמירת המידע הנוכחי
    currentQuickAdd.taskId = taskId;
    currentQuickAdd.date = dateStr;
    currentQuickAdd.selectedSoldiers = [];
    
    // עדכון כותרת הדיאלוג
    document.getElementById('quickAddTaskName').textContent = taskName;
    document.getElementById('quickAddDate').textContent = formatDateHebrew(dateStr);
    
    // קבלת רשימת החיילים הזמינים (שלא משובצים באותו יום)
    const availableSoldiers = soldiers.filter(soldier => !hasConflict(soldier.id, dateStr));
    
    // רינדור החיילים הזמינים
    const soldiersContainer = document.getElementById('availableSoldiers');
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
    
    // הצגת הדיאלוג
    document.getElementById('quickAddDialog').classList.remove('hidden');
  }
  
  // פונקציה להכנת ההוספה המהירה - שלב ביניים
  function prepareQuickAdd() {
    const selectedSoldiers = Array.from(document.querySelectorAll('#availableSoldiers input[type="checkbox"]:checked'))
      .map(cb => cb.value);
    
    if (selectedSoldiers.length === 0) {
      showNotification('לא נבחרו חיילים', 'error');
      return;
    }
    
    // שמירת החיילים שנבחרו
    currentQuickAdd.selectedSoldiers = selectedSoldiers;
    
    // סגירת הדיאלוג הראשון
    closeQuickAddDialog();
    
    // פתיחת דיאלוג בחירת סוג השיבוץ
    document.getElementById('assignmentTypeDialog').classList.remove('hidden');
  }
  
  // סגירת דיאלוג הוספה מהירה
  function closeQuickAddDialog() {
    document.getElementById('quickAddDialog').classList.add('hidden');
  }
  
  // אישור הוספה מהירה של חיילים
  async function confirmQuickAdd(isFullWeek) {
    if (userRole !== 'admin') {
      showNotification('רק מנהל יכול להוסיף שיבוצים', 'error');
      return;
    }
    
    // סגירת דיאלוג בחירת סוג השיבוץ
    closeAssignmentTypeDialog();
    
    if (currentQuickAdd.selectedSoldiers.length === 0) {
      showNotification('לא נבחרו חיילים', 'error');
      return;
    }
    
    try {
      if (isFullWeek) {
        // שיבוץ לכל השבוע
        const daysOfWeek = getDaysOfWeek();
        let successCount = 0;
        
        for (const day of daysOfWeek) {
          const dateStr = formatDateISO(day);
          
          // שיבוץ לכל יום בנפרד
          const result = await assignSoldiersToDay(currentQuickAdd.taskId, dateStr, currentQuickAdd.selectedSoldiers);
          if (result.success) {
            successCount += result.addedCount;
          }
        }
        
        if (successCount > 0) {
          showNotification(`נוספו ${successCount} שיבוצים לאורך השבוע`, 'success');
        } else {
          showNotification('לא בוצעו שיבוצים חדשים', 'info');
        }
      } else {
        // שיבוץ ליום אחד בלבד
        const result = await assignSoldiersToDay(currentQuickAdd.taskId, currentQuickAdd.date, currentQuickAdd.selectedSoldiers);
        
        if (result.success && result.addedCount > 0) {
          showNotification(`נוספו ${result.addedCount} חיילים למשימה`, 'success');
        } else if (result.success) {
          showNotification('כל החיילים שנבחרו כבר משובצים למשימה זו', 'info');
        }
      }
    } catch (error) {
      console.error("שגיאה בשיבוץ חיילים:", error);
      showNotification('אירעה שגיאה בשיבוץ החיילים', 'error');
    }
  }
  
  // פונקציה לשיבוץ חיילים ליום מסוים
  async function assignSoldiersToDay(taskId, dateStr, soldierIds) {
    const db = getFirestore();
    
    // חיפוש אם כבר קיים שיבוץ למשימה זו בתאריך זה
    const existingAssignment = assignments.find(
      a => a.taskId === taskId && a.date === dateStr
    );
    
    if (existingAssignment) {
      // עדכון שיבוץ קיים - הוספת חיילים שלא משובצים כבר
      const newSoldiers = soldierIds.filter(id => 
        !existingAssignment.soldierIds.includes(id) && !hasConflict(id, dateStr)
      );
      
      if (newSoldiers.length > 0) {
        // עדכון המסמך בפיירסטור
        const assignmentRef = doc(db, "assignments", existingAssignment.id);
        await updateDoc(assignmentRef, {
          soldierIds: [...existingAssignment.soldierIds, ...newSoldiers],
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid
        });
        
        return { success: true, addedCount: newSoldiers.length };
      } else {
        return { success: true, addedCount: 0 };
      }
    } else {
      // יצירת שיבוץ חדש
      // סינון חיילים שיש להם התנגשות ביום זה
      const availableSoldiers = soldierIds.filter(id => !hasConflict(id, dateStr));
      
      if (availableSoldiers.length > 0) {
        // הוספת מסמך חדש לפיירסטור
        await addDoc(collection(db, "assignments"), {
          taskId: taskId,
          date: dateStr,
          soldierIds: availableSoldiers,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });
        
        return { success: true, addedCount: availableSoldiers.length };
      } else {
        return { success: true, addedCount: 0 };
      }
    }
  }
  
  // פונקציה לטיפול בהורדת חייל במשימה
  function handleDrop(e) {
    e.preventDefault();
    
    if (userRole !== 'admin') return; // רק מנהל יכול לשבץ
    
    const soldierId = e.dataTransfer.getData('soldierId');
    const taskId = this.dataset.taskId;
    const dateStr = this.dataset.date;
    
    // אפקט ויזואלי
    this.classList.remove('bg-blue-50');
    
    // שמירת המידע הנוכחי עבור הדיאלוג
    currentQuickAdd.taskId = taskId;
    currentQuickAdd.date = dateStr;
    currentQuickAdd.selectedSoldiers = [soldierId];
    
    // פתיחת דיאלוג בחירת סוג השיבוץ
    document.getElementById('assignmentTypeDialog').classList.remove('hidden');
  }
  
  // פונקציה לבדיקה אם יש התנגשות (חייל משובץ ליום זה)
  function hasConflict(soldierId, dateStr) {
    return assignments.some(assignment => 
      assignment.date === dateStr && 
      assignment.soldierIds.includes(soldierId)
    );
  }
  
  // פונקציה לתצוגת התראות
  function showNotification(message, type = 'info') {
    // יצירת אלמנט ההתראה
    const notification = document.createElement('div');
    notification.className = `notification`;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 15px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '1000';
    notification.style.minWidth = '250px';
    notification.style.boxShadow = '0 3px 6px rgba(0,0,0,0.16)';
    notification.style.animation = 'slide-in 0.3s ease-out forwards';
    
    // צבע רקע לפי סוג ההתראה
    if (type === 'error') {
      notification.style.backgroundColor = '#dc2626';
      notification.style.color = 'white';
    } else if (type === 'success') {
      notification.style.backgroundColor = '#16a34a';
      notification.style.color = 'white';
    } else {
      notification.style.backgroundColor = '#2563eb';
      notification.style.color = 'white';
    }
    
    notification.innerHTML = `
      <div class="notification-content">
        ${type === 'error' ? 
          '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' : 
          type === 'success' ? 
          '<svg class="icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' :
          '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><polyline points="12 16 12.01 16"></polyline></svg>'
        }
        <span>${message}</span>
      </div>
    `;
    
    // הוספת ההתראה לעמוד
    document.body.appendChild(notification);
    
    // הסרת ההתראה אחרי 3 שניות
    setTimeout(() => {
      notification.style.animation = 'fade-out 0.5s ease-out forwards';
      setTimeout(() => {
        notification.remove();
      }, 500);
    }, 3000);
  }
  
  // פונקציה להסרת חייל ממשימה
  async function handleRemoveSoldierFromTask(assignmentId, soldierId) {
    if (userRole !== 'admin') {
      showNotification('רק מנהל יכול להסיר חיילים ממשימה', 'error');
      return;
    }
    
    try {
      const db = getFirestore();
      const assignmentRef = doc(db, "assignments", assignmentId);
      
      // קבלת השיבוץ העדכני
      const assignmentDoc = await getDoc(assignmentRef);
      
      if (assignmentDoc.exists()) {
        const assignmentData = assignmentDoc.data();
        const updatedSoldierIds = assignmentData.soldierIds.filter(id => id !== soldierId);
        
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
        
        showNotification('החייל הוסר מהמשימה', 'info');
      }
    } catch (error) {
      console.error("שגיאה בהסרת חייל ממשימה:", error);
      showNotification('אירעה שגיאה בהסרת החייל מהמשימה', 'error');
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
        const db = getFirestore();
        
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
        const db = getFirestore();
        const soldierRef = doc(db, "soldiers", soldierId);
        
        await updateDoc(soldierRef, {
          firstName,
          lastName,
          role,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid
        });
        
        editingSoldierId = null;
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
        const db = getFirestore();
        
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
  
  // רינדור של רשימת החיילים
  function renderSoldiers() {
    const soldiersListElement = document.getElementById('soldiersList');
    soldiersListElement.innerHTML = '';
    
    // סינון החיילים לפי חיפוש
    const filteredSoldiers = soldiers.filter(soldier => 
      `${soldier.firstName} ${soldier.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
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
          card.draggable = userRole === 'admin';
          card.id = `soldier-${soldier.id}`;
          
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
          
          // הוספת event listeners לגרירה
          if (userRole === 'admin') {
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
    document.getElementById('addSoldierForm').style.display = userRole === 'admin' ? 'flex' : 'none';
  }
  
  // הגדרת משתנים ופונקציות לגרירה במובייל
  let mobileDraggedSoldierId = null;
  let mobileDragElement = null;
  
  // פונקציה להגדרת גרירה במגע למובייל
  function setupMobileDragTouch(element, soldierId) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTimeStart = 0;
    let isDragging = false;
    
    element.addEventListener('touchstart', function(e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchTimeStart = Date.now();
      
      // בטלפון נצטרך להמתין קצת כדי להבדיל בין גרירה וסקרול
      setTimeout(() => {
        if (!isDragging && Date.now() - touchTimeStart > 200) {
          // התחלת גרירה
          mobileDraggedSoldierId = soldierId;
          element.classList.add('dragging');
          
          // יצירת אלמנט הנגרר
          if (!mobileDragElement) {
            mobileDragElement = document.createElement('div');
            mobileDragElement.className = 'mobile-drag-indicator';
            mobileDragElement.textContent = 'גורר חייל...';
            document.body.appendChild(mobileDragElement);
          }
        }
      }, 200);
    });
    
    element.addEventListener('touchmove', function(e) {
      if (mobileDraggedSoldierId !== null) {
        isDragging = true;
        
        // עדכון מיקום האינדיקטור
        if (mobileDragElement) {
          mobileDragElement.style.top = (e.touches[0].clientY - 30) + 'px';
          mobileDragElement.style.left = (e.touches[0].clientX - 50) + 'px';
          mobileDragElement.classList.add('visible');
        }
        
        // בדיקה אם נמצאים מעל תא בלוח
        const taskCells = document.querySelectorAll('.task-cell');
        let hoveredCell = null;
        
        taskCells.forEach(cell => {
          const rect = cell.getBoundingClientRect();
          if (
            e.touches[0].clientX >= rect.left && 
            e.touches[0].clientX <= rect.right && 
            e.touches[0].clientY >= rect.top && 
            e.touches[0].clientY <= rect.bottom
          ) {
            hoveredCell = cell;
            cell.classList.add('bg-blue-50');
          } else {
            cell.classList.remove('bg-blue-50');
          }
        });
      }
    });
    
    element.addEventListener('touchend', function(e) {
      if (mobileDraggedSoldierId !== null && isDragging) {
        // בדיקה אם נמצאים מעל תא בלוח
        const taskCells = document.querySelectorAll('.task-cell');
        let targetCell = null;
        
        const lastTouch = e.changedTouches[0];
        
        taskCells.forEach(cell => {
          const rect = cell.getBoundingClientRect();
          if (
            lastTouch.clientX >= rect.left && 
            lastTouch.clientX <= rect.right && 
            lastTouch.clientY >= rect.top && 
            lastTouch.clientY <= rect.bottom
          ) {
            targetCell = cell;
          }
          cell.classList.remove('bg-blue-50');
        });
        
        if (targetCell && userRole === 'admin') {
          // שיבוץ החייל לתא
          const taskId = targetCell.dataset.taskId;
          const dateStr = targetCell.dataset.date;
          
          // שמירת המידע הנוכחי עבור הדיאלוג
          currentQuickAdd.taskId = taskId;
          currentQuickAdd.date = dateStr;
          currentQuickAdd.selectedSoldiers = [mobileDraggedSoldierId];
          
          // פתיחת דיאלוג בחירת סוג השיבוץ
          document.getElementById('assignmentTypeDialog').classList.remove('hidden');
        }
        
        // ניקוי
        if (mobileDragElement) {
          mobileDragElement.classList.remove('visible');
          setTimeout(() => {
            if (mobileDragElement) {
              mobileDragElement.remove();
              mobileDragElement = null;
            }
          }, 300);
        }
      }
      
      element.classList.remove('dragging');
      mobileDraggedSoldierId = null;
      isDragging = false;
    });
  }
  
  // פונקציה לעדכון toggleReportView
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
    
    if (reportType === 'regular') {
      // תצוגת דוח רגיל
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
      <span>דוח רגיל</span>
    `;
    
    toggleWeeklySummaryBtn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <path d="M14 2v6h6"></path>
        <path d="M16 13H8"></path>
        <path d="M16 17H8"></path>
        <path d="M10 9H8"></path>
      </svg>
      <span>סיכום שבועי</span>
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
  
  // רינדור הדוח הרגיל בפורמט החדש
  function renderReport() {
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = '';
    
    // כותרת הדוח
    const reportTitle = document.createElement('h3');
    reportTitle.className = 'text-xl font-bold mb-4 text-center';
    reportTitle.textContent = 'דוח פעילות חיילים';
    reportContent.appendChild(reportTitle);
    
    // יצירת טבלת הדוח
    const table = document.createElement('table');
    table.className = 'w-full border-collapse';
    
    // מיון כל השיבוצים לפי תאריך
    const sortedAssignments = [...assignments].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    // קבלת רשימת תאריכים ייחודיים
    const uniqueDates = [...new Set(sortedAssignments.map(a => a.date))];
    
    // רינדור כותרת הטבלה - תאריכים
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // תא ריק בפינה השמאלית העליונה
    const cornerCell = document.createElement('th');
    cornerCell.className = 'border p-2 bg-gray-100';
    cornerCell.textContent = 'משימות / תאריכים';
    headerRow.appendChild(cornerCell);
    
    // הוספת תאי כותרת לתאריכים
    uniqueDates.forEach(dateStr => {
      const th = document.createElement('th');
      th.className = 'border p-2 bg-gray-100';
      
      const dateObj = new Date(dateStr);
      const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][dateObj.getDay()];
      
      th.innerHTML = `
        ${dayName}<br>
        <span class="text-sm">${formatDateWithYear(dateObj)}</span>
      `;
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // רינדור גוף הטבלה - משימות ושיבוצים
    const tbody = document.createElement('tbody');
    
    tasks.forEach(task => {
      const row = document.createElement('tr');
      
      // תא שם המשימה
      const taskCell = document.createElement('td');
      taskCell.className = 'border p-2 font-bold bg-gray-50';
      taskCell.textContent = task.name;
      row.appendChild(taskCell);
      
      // הוספת תאים לכל תאריך
      uniqueDates.forEach(dateStr => {
        const td = document.createElement('td');
        td.className = 'border p-2';
        
        // חיפוש השיבוץ הרלוונטי
        const assignment = assignments.find(a => a.taskId === task.id && a.date === dateStr);
        
        if (assignment) {
          // הצגת שמות החיילים המשובצים
          const soldiersList = assignment.soldierIds.map(soldierId => {
            const soldier = soldiers.find(s => s.id === soldierId);
            if (soldier) {
              return `<span class="${soldier.role}">${soldier.firstName} ${soldier.lastName}</span>`;
            }
            return '';
          }).filter(Boolean).join(', ');
          
          td.innerHTML = soldiersList;
        } else {
          td.innerHTML = '<span class="text-gray-300">-</span>';
        }
        
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    reportContent.appendChild(table);
    
    // הוספת הערה תחתונה
    const note = document.createElement('div');
    note.className = 'text-sm text-gray-500 mt-4 text-center';
    note.textContent = 'הדוח מציג את החיילים המשובצים לכל משימה לפי תאריך';
    reportContent.appendChild(note);
  }
  
  // רינדור דוח חצי שנתי בפורמט החדש
  function renderSemiAnnualReport() {
    const reportContent = document.getElementById('semiAnnualReportContent');
    reportContent.innerHTML = '';
    
    // כותרת הדוח
    const reportTitle = document.createElement('h3');
    reportTitle.className = 'text-xl font-bold mb-4 text-center';
    reportTitle.textContent = 'דוח חצי שנתי לפי משימות';
    reportContent.appendChild(reportTitle);
    
    // חישוב טווח זמן של חצי שנה (182 ימים)
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setDate(today.getDate() - 182);
    
    // קבלת כל המשימות בטווח הזמן
    const filteredAssignments = assignments.filter(a => {
      const assignmentDate = new Date(a.date);
      return assignmentDate >= sixMonthsAgo && assignmentDate <= today;
    });
    
    if (filteredAssignments.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'text-center text-gray-400 py-4';
      emptyMsg.textContent = 'אין נתונים זמינים לדוח חצי שנתי';
      reportContent.appendChild(emptyMsg);
      return;
    }
    
    // יצירת טבלת הדוח
    const table = document.createElement('table');
    table.className = 'w-full border-collapse';
    
    // מיון כל השיבוצים לפי תאריך
    const sortedAssignments = [...filteredAssignments].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    // קבלת רשימת תאריכים ייחודיים בסדר כרונולוגי
    const uniqueDates = [...new Set(sortedAssignments.map(a => a.date))].sort();
    
    // קיבוץ תאריכים לפי שבועות
    const weekGroups = {};
    
    uniqueDates.forEach(dateStr => {
      const date = new Date(dateStr);
      // קבלת יום ראשון של אותו שבוע
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - date.getDay()); // יום ראשון
      
      // יצירת מזהה לשבוע
      const weekId = formatDateISO(sunday);
      
      if (!weekGroups[weekId]) {
        // שמירת טווח התאריכים של השבוע
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6); // יום שבת
        
        weekGroups[weekId] = {
          startDate: sunday,
          endDate: saturday,
          dates: []
        };
      }
      
      // הוספת התאריך לשבוע המתאים
      if (!weekGroups[weekId].dates.includes(dateStr)) {
        weekGroups[weekId].dates.push(dateStr);
      }
    });
    
    // מיון השבועות לפי תאריך
    const sortedWeeks = Object.keys(weekGroups).sort();
    
    // רינדור כותרת הטבלה - שבועות
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // תא ריק בפינה השמאלית העליונה
    const cornerCell = document.createElement('th');
    cornerCell.className = 'border p-2 bg-gray-100';
    cornerCell.textContent = 'משימות / שבועות';
    headerRow.appendChild(cornerCell);
    
    // הוספת תאי כותרת לשבועות
    sortedWeeks.forEach(weekId => {
      const week = weekGroups[weekId];
      const th = document.createElement('th');
      th.className = 'border p-2 bg-gray-100';
      
      th.innerHTML = `
        שבוע ${formatDateHebrew(week.startDate)} - ${formatDateHebrew(week.endDate)}
      `;
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // רינדור גוף הטבלה - משימות ושיבוצים
    const tbody = document.createElement('tbody');
    
    tasks.forEach(task => {
      // בדיקה אם יש שיבוצים למשימה זו בתקופה הרלוונטית
      const hasAssignments = filteredAssignments.some(a => a.taskId === task.id);
      
      // אם אין שיבוצים, דלג על המשימה
      if (!hasAssignments) return;
      
      const row = document.createElement('tr');
      
      // תא שם המשימה
      const taskCell = document.createElement('td');
      taskCell.className = 'border p-2 font-bold bg-gray-50';
      taskCell.textContent = task.name;
      row.appendChild(taskCell);
      
      // הוספת תאים לכל שבוע
      sortedWeeks.forEach(weekId => {
        const week = weekGroups[weekId];
        const td = document.createElement('td');
        td.className = 'border p-2';
        
        // רשימת חיילים ייחודיים ששובצו למשימה זו בשבוע זה
        const soldiersList = new Set();
        
        // עבור על כל התאריכים בשבוע
        week.dates.forEach(dateStr => {
          const assignment = filteredAssignments.find(a => a.taskId === task.id && a.date === dateStr);
          
          if (assignment) {
            // הוספת שמות החיילים
            assignment.soldierIds.forEach(soldierId => {
              const soldier = soldiers.find(s => s.id === soldierId);
              if (soldier) {
                soldiersList.add(`<span class="${soldier.role}">${soldier.firstName} ${soldier.lastName}</span>`);
              }
            });
          }
        });
        
        if (soldiersList.size > 0) {
          td.innerHTML = [...soldiersList].join(', ');
        } else {
          td.innerHTML = '<span class="text-gray-300">-</span>';
        }
        
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    reportContent.appendChild(table);
    
    // הוספת הערה תחתונה
    const note = document.createElement('div');
    note.className = 'text-sm text-gray-500 mt-4 text-center';
    note.textContent = 'הדוח מציג את החיילים המשובצים לכל משימה לפי שבועות בחצי השנה האחרונה';
    reportContent.appendChild(note);
  }
  
  // רינדור סיכום שבועי בפורמט החדש
  function renderWeeklySummary() {
    const reportContent = document.getElementById('weeklySummaryContent');
    reportContent.innerHTML = '';
    
    // כותרת הדוח
    const reportTitle = document.createElement('h3');
    reportTitle.className = 'text-xl font-bold mb-4 text-center';
    reportTitle.textContent = 'סיכום שבועי לפי משימות';
    reportContent.appendChild(reportTitle);
    
    // קבלת ימי השבוע הנוכחי
    const daysOfWeek = getDaysOfWeek();
    const startDate = daysOfWeek[0];
    const endDate = daysOfWeek[6];
    
    // כותרת משנה עם טווח התאריכים
    const subtitle = document.createElement('div');
    subtitle.className = 'text-lg font-medium mb-4 text-center';
    subtitle.textContent = `שבוע: ${formatDateHebrew(startDate)} - ${formatDateHebrew(endDate)}`;
    reportContent.appendChild(subtitle);
    
    // קבלת שיבוצים רק לשבוע הנוכחי
    const weeklyAssignments = assignments.filter(a => {
      const assignmentDate = new Date(a.date);
      return assignmentDate >= startDate && assignmentDate <= endDate;
    });
    
    if (weeklyAssignments.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'text-center text-gray-400 py-4';
      emptyMsg.textContent = 'אין שיבוצים לשבוע הנוכחי';
      reportContent.appendChild(emptyMsg);
      return;
    }
    
    // יצירת טבלת הדוח
    const table = document.createElement('table');
    table.className = 'w-full border-collapse';
    
    // רינדור כותרת הטבלה - ימי השבוע
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // תא ריק בפינה השמאלית העליונה
    const cornerCell = document.createElement('th');
    cornerCell.className = 'border p-2 bg-gray-100';
    cornerCell.textContent = 'משימות / ימים';
    headerRow.appendChild(cornerCell);
    
    // הוספת תאי כותרת לימים
    daysOfWeek.forEach(day => {
      const th = document.createElement('th');
      th.className = 'border p-2 bg-gray-100';
      
      const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][day.getDay()];
      
      th.innerHTML = `
        ${dayName}<br>
        <span class="text-sm">${formatDateWithYear(day)}</span>
      `;
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // רינדור גוף הטבלה - משימות ושיבוצים
    const tbody = document.createElement('tbody');
    
    tasks.forEach(task => {
      // בדיקה אם יש שיבוצים למשימה זו בשבוע הנוכחי
      const hasAssignments = weeklyAssignments.some(a => a.taskId === task.id);
      
      // אם אין שיבוצים, דלג על המשימה
      if (!hasAssignments) return;
      
      const row = document.createElement('tr');
      
      // תא שם המשימה
      const taskCell = document.createElement('td');
      taskCell.className = 'border p-2 font-bold bg-gray-50';
      taskCell.textContent = task.name;
      row.appendChild(taskCell);
      
      // הוספת תאים לכל יום
      daysOfWeek.forEach(day => {
        const dateStr = formatDateISO(day);
        const td = document.createElement('td');
        td.className = 'border p-2';
        
        // חיפוש השיבוץ הרלוונטי
        const assignment = weeklyAssignments.find(a => a.taskId === task.id && a.date === dateStr);
        
        if (assignment) {
          // הצגת שמות החיילים המשובצים
          const soldiersList = assignment.soldierIds.map(soldierId => {
            const soldier = soldiers.find(s => s.id === soldierId);
            if (soldier) {
              return `<span class="${soldier.role}">${soldier.firstName} ${soldier.lastName}</span>`;
            }
            return '';
          }).filter(Boolean).join(', ');
          
          td.innerHTML = soldiersList;
        } else {
          td.innerHTML = '<span class="text-gray-300">-</span>';
        }
        
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    reportContent.appendChild(table);
    
    // הוספת הערה תחתונה
    const note = document.createElement('div');
    note.className = 'text-sm text-gray-500 mt-4 text-center';
    note.textContent = 'הדוח מציג את החיילים המשובצים לכל משימה לפי ימי השבוע הנוכחי';
    reportContent.appendChild(note);
  }
  
  // פונקציה לייצוא הדוח הרגיל לאקסל
  function exportToExcel() {
    // קבלת רשימת תאריכים ייחודיים
    const uniqueDates = [...new Set(assignments.map(a => a.date))].sort();
    
    // הכנת נתונים לייצוא
    const exportData = [];
    
    // כותרות - שורה ראשונה
    const headers = ['משימה'];
    uniqueDates.forEach(dateStr => {
      const date = new Date(dateStr);
      const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][date.getDay()];
      headers.push(`${dayName} ${formatDateHebrew(dateStr)}`);
    });
    exportData.push(headers);
    
    // נתונים לפי משימות
    tasks.forEach(task => {
      const row = [task.name];
      
      uniqueDates.forEach(dateStr => {
        // חיפוש שיבוץ למשימה בתאריך
        const assignment = assignments.find(a => a.taskId === task.id && a.date === dateStr);
        
        if (assignment) {
          // הכנת רשימת שמות חיילים
          const soldierNames = assignment.soldierIds.map(soldierId => {
            const soldier = soldiers.find(s => s.id === soldierId);
            return soldier ? `${soldier.firstName} ${soldier.lastName}` : '';
          }).filter(Boolean).join(', ');
          
          row.push(soldierNames);
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
    
    // רוחב עמודות תאריכים
    for (let i = 0; i < uniqueDates.length; i++) {
      ws['!cols'].push({ wch: 30 });
    }
    
    // הוספת הגיליון ל-Workbook
    XLSX.utils.book_append_sheet(wb, ws, "דוח משימות");
    
    // ייצוא הקובץ
    XLSX.writeFile(wb, "דוח_משימות.xlsx");
    
    showNotification('הדוח יוצא בהצלחה', 'success');
  }
  
  // פונקציה לייצוא הדוח החצי שנתי לאקסל
  function exportSemiAnnualToExcel() {
    // חישוב טווח זמן של חצי שנה (182 ימים)
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setDate(today.getDate() - 182);
    
    // קבלת כל המשימות בטווח הזמן
    const filteredAssignments = assignments.filter(a => {
      const assignmentDate = new Date(a.date);
      return assignmentDate >= sixMonthsAgo && assignmentDate <= today;
    });
    
    if (filteredAssignments.length === 0) {
      showNotification('אין נתונים זמינים לדוח חצי שנתי', 'error');
      return;
    }
    
    // מיון כל השיבוצים לפי תאריך
    const sortedAssignments = [...filteredAssignments].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    // קבלת רשימת תאריכים ייחודיים
    const uniqueDates = [...new Set(sortedAssignments.map(a => a.date))].sort();
    
    // קיבוץ תאריכים לפי שבועות
    const weekGroups = {};
    
    uniqueDates.forEach(dateStr => {
      const date = new Date(dateStr);
      // קבלת יום ראשון של אותו שבוע
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - date.getDay()); // יום ראשון
      
      // יצירת מזהה לשבוע
      const weekId = formatDateISO(sunday);
      
      if (!weekGroups[weekId]) {
        // שמירת טווח התאריכים של השבוע
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6); // יום שבת
        
        weekGroups[weekId] = {
          startDate: sunday,
          endDate: saturday,
          dates: []
        };
      }
      
// הוספת התאריך לשבוע המתאים
if (!weekGroups[weekId].dates.includes(dateStr)) {
    weekGroups[weekId].dates.push(dateStr);
  }
});

// מיון השבועות לפי תאריך
const sortedWeeks = Object.keys(weekGroups).sort();

// הכנת נתונים לייצוא
const exportData = [];

// כותרות - שורה ראשונה
const headers = ['משימה'];
sortedWeeks.forEach(weekId => {
  const week = weekGroups[weekId];
  headers.push(`שבוע ${formatDateHebrew(week.startDate)} - ${formatDateHebrew(week.endDate)}`);
});
exportData.push(headers);

// נתונים לפי משימות
tasks.forEach(task => {
  // בדיקה אם יש שיבוצים למשימה זו בתקופה הרלוונטית
  const hasAssignments = filteredAssignments.some(a => a.taskId === task.id);
  
  // אם אין שיבוצים, דלג על המשימה
  if (!hasAssignments) return;
  
  const row = [task.name];
  
  // הוספת תאים לכל שבוע
  sortedWeeks.forEach(weekId => {
    const week = weekGroups[weekId];
    
    // רשימת חיילים ייחודיים ששובצו למשימה זו בשבוע זה
    const soldiersList = new Set();
    
    // עבור על כל התאריכים בשבוע
    week.dates.forEach(dateStr => {
      const assignment = filteredAssignments.find(a => a.taskId === task.id && a.date === dateStr);
      
      if (assignment) {
        // הוספת שמות החיילים
        assignment.soldierIds.forEach(soldierId => {
          const soldier = soldiers.find(s => s.id === soldierId);
          if (soldier) {
            soldiersList.add(`${soldier.firstName} ${soldier.lastName}`);
          }
        });
      }
    });
    
    if (soldiersList.size > 0) {
      row.push([...soldiersList].join(', '));
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

// רוחב עמודות שבועות
for (let i = 0; i < sortedWeeks.length; i++) {
  ws['!cols'].push({ wch: 40 });
}

// הוספת הגיליון ל-Workbook
XLSX.utils.book_append_sheet(wb, ws, "דוח חצי שנתי");

// ייצוא הקובץ
XLSX.writeFile(wb, "דוח_חצי_שנתי.xlsx");

showNotification('הדוח יוצא בהצלחה', 'success');
}

// פונקציה לייצוא הסיכום השבועי לאקסל
function exportWeeklySummaryToExcel() {
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
    
    if (assignment) {
      // הצגת שמות החיילים המשובצים
      const soldiersList = assignment.soldierIds.map(soldierId => {
        const soldier = soldiers.find(s => s.id === soldierId);
        return soldier ? `${soldier.firstName} ${soldier.lastName}` : '';
      }).filter(Boolean).join(', ');
      
      row.push(soldiersList);
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
if (!isAuthenticated || currentUser.isAnonymous) {
  showNotification('עליך להתחבר עם חשבון מנהל כדי לשנות הרשאות', 'error');
  return;
}

try {
  const db = getFirestore();
  const userRef = doc(db, "users", currentUser.uid);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    if (userRole === 'admin') {
      // עבור ממנהל לצופה
      userRole = 'viewer';
      await updateDoc(userRef, { role: 'viewer' });
      showNotification('עברת למצב צפייה', 'info');
    } else {
      // בדיקה אם יש הרשאת מנהל
      if (userDoc.data().role === 'admin') {
        userRole = 'admin';
        showNotification('עברת למצב מנהל', 'success');
      } else {
        // אין הרשאת מנהל - בקשת סיסמה
        const loginPrompt = prompt("הכנס סיסמה למצב מנהל:");
        if (loginPrompt === 'gilidadmin') {
          userRole = 'admin';
          await updateDoc(userRef, { role: 'admin' });
          showNotification('עברת למצב מנהל', 'success');
        } else if (loginPrompt !== null) { // רק אם המשתמש לחץ על OK ולא על Cancel
          showNotification('סיסמה שגויה', 'error');
        }
      }
    }
  } else {
    // יצירת תיעוד משתמש חדש
    await setDoc(userRef, {
      email: currentUser.email,
      role: 'viewer',
      createdAt: serverTimestamp()
    });
    userRole = 'viewer';
  }
  
  // עדכון הכפתור
  const roleText = document.getElementById('roleText');
  roleText.textContent = userRole === 'admin' ? 'מנהל' : 'צופה';
  
  // רינדור מחדש
  renderSoldiers();
  renderCalendar();
} catch (error) {
  console.error("שגיאה בהחלפת תפקיד:", error);
  showNotification('אירעה שגיאה בהחלפת התפקיד', 'error');
}
}

// פונקציות עזר

// יצירת מערך של ימי השבוע מחמישי עד חמישי
function getDaysOfWeek() {
const days = [];
const startDate = new Date(currentWeek);

for (let i = 0; i < 7; i++) {
  const date = new Date(startDate);
  date.setDate(startDate.getDate() + i);
  days.push(date);
}

return days;
}

// פורמט תאריך לתצוגה: DD/MM
function formatDate(date) {
return `${date.getDate()}/${date.getMonth() + 1}`;
}

// פורמט תאריך לתצוגה עם שנה: DD/MM/YYYY
function formatDateWithYear(date) {
return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

// פורמט תאריך ISO: YYYY-MM-DD
function formatDateISO(date) {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
return `${year}-${month}-${day}`;
}

// פורמט תאריך בעברית
function formatDateHebrew(dateStr) {
if (dateStr instanceof Date) {
  return dateStr.toLocaleDateString('he-IL');
}

const date = new Date(dateStr);
return date.toLocaleDateString('he-IL');
}

// פונקציה לבדיקה אם תאריך הוא חג
function isHoliday(date) {
const holidays = getIsraeliHolidays(date.getFullYear());

for (const holiday of holidays) {
  if (isSameDay(date, holiday.date)) {
    return holiday.name;
  }
}

return null;
}

// פונקציה להשוואת תאריכים (יום, חודש, שנה)
function isSameDay(date1, date2) {
return date1.getDate() === date2.getDate() &&
       date1.getMonth() === date2.getMonth() &&
       date1.getFullYear() === date2.getFullYear();
}

// פונקציה לקבלת חגי ישראל
function getIsraeliHolidays(year) {
// חגים בתאריכים מעודכנים לשנת 2025
// תאריכים אלו הם קירוב טוב יותר, אך עדיין מומלץ להשתמש בחישוב מדויק לפי הלוח העברי במערכת אמיתית
const holidays = [
  // ראש השנה
  { name: 'ערב ראש השנה', date: new Date(2025, 8, 22), type: 'ערב חג' },       // 22 בספטמבר 2025
  { name: 'ראש השנה', date: new Date(2025, 8, 23), type: 'חג' },                // 23 בספטמבר 2025
  { name: 'ראש השנה (יום שני)', date: new Date(2025, 8, 24), type: 'חג' },      // 24 בספטמבר 2025
  
  // יום כיפור
  { name: 'ערב יום כיפור', date: new Date(2025, 9, 1), type: 'ערב חג' },        // 1 באוקטובר 2025
  { name: 'יום כיפור', date: new Date(2025, 9, 2), type: 'חג' },                // 2 באוקטובר 2025
  
  // סוכות
  { name: 'ערב סוכות', date: new Date(2025, 9, 6), type: 'ערב חג' },            // 6 באוקטובר 2025
  { name: 'סוכות', date: new Date(2025, 9, 7), type: 'חג' },                    // 7 באוקטובר 2025
  { name: 'חול המועד סוכות', date: new Date(2025, 9, 8), type: 'חול המועד' },    // 8 באוקטובר 2025
  { name: 'חול המועד סוכות', date: new Date(2025, 9, 9), type: 'חול המועד' },    // 9 באוקטובר 2025
  { name: 'חול המועד סוכות', date: new Date(2025, 9, 10), type: 'חול המועד' },   // 10 באוקטובר 2025
  { name: 'חול המועד סוכות', date: new Date(2025, 9, 11), type: 'חול המועד' },   // 11 באוקטובר 2025
  { name: 'חול המועד סוכות', date: new Date(2025, 9, 12), type: 'חול המועד' },   // 12 באוקטובר 2025
  { name: 'הושענה רבה', date: new Date(2025, 9, 13), type: 'חול המועד' },        // 13 באוקטובר 2025
  { name: 'שמיני עצרת / שמחת תורה', date: new Date(2025, 9, 14), type: 'חג' },   // 14 באוקטובר 2025
  
  // חנוכה
  { name: 'ערב חנוכה', date: new Date(2025, 11, 14), type: 'ערב חג' },          // 14 בדצמבר 2025
  { name: 'חנוכה - נר ראשון', date: new Date(2025, 11, 15), type: 'חג' },       // 15 בדצמבר 2025
  { name: 'חנוכה - נר שמיני', date: new Date(2025, 11, 22), type: 'חג' },       // 22 בדצמבר 2025
  
  // טו בשבט
  { name: 'טו בשבט', date: new Date(2025, 0, 14), type: 'חג' },                 // 14 בינואר 2025
  
  // פורים
  { name: 'תענית אסתר', date: new Date(2025, 2, 13), type: 'ערב חג' },          // 13 במרץ 2025
  { name: 'פורים', date: new Date(2025, 2, 14), type: 'חג' },                   // 14 במרץ 2025
  { name: 'שושן פורים', date: new Date(2025, 2, 15), type: 'חג' },              // 15 במרץ 2025
  
  // פסח
  { name: 'ערב פסח', date: new Date(2025, 3, 12), type: 'ערב חג' },             // 12 באפריל 2025
  { name: 'פסח', date: new Date(2025, 3, 13), type: 'חג' },                     // 13 באפריל 2025
  { name: 'חול המועד פסח', date: new Date(2025, 3, 14), type: 'חול המועד' },     // 14 באפריל 2025
  { name: 'חול המועד פסח', date: new Date(2025, 3, 15), type: 'חול המועד' },     // 15 באפריל 2025
  { name: 'חול המועד פסח', date: new Date(2025, 3, 16), type: 'חול המועד' },     // 16 באפריל 2025
  { name: 'חול המועד פסח', date: new Date(2025, 3, 17), type: 'חול המועד' },     // 17 באפריל 2025
  { name: 'חול המועד פסח', date: new Date(2025, 3, 18), type: 'חול המועד' },     // 18 באפריל 2025
  { name: 'שביעי של פסח', date: new Date(2025, 3, 19), type: 'חג' },            // 19 באפריל 2025
  
  // יום השואה, יום הזיכרון ויום העצמאות
  { name: 'יום השואה', date: new Date(2025, 3, 28), type: 'יום זיכרון' },        // 28 באפריל 2025
  { name: 'יום הזיכרון', date: new Date(2025, 3, 30), type: 'יום זיכרון' },       // 30 באפריל 2025
  { name: 'ערב יום העצמאות', date: new Date(2025, 3, 30), type: 'ערב חג' },      // 30 באפריל 2025 (בערב)
  { name: 'יום העצמאות', date: new Date(2025, 4, 1), type: 'חג' },               // 1 במאי 2025
  
  // ל"ג בעומר
  { name: 'ל"ג בעומר', date: new Date(2025, 4, 18), type: 'חג' },               // 18 במאי 2025
  
  // שבועות
  { name: 'ערב שבועות', date: new Date(2025, 5, 1), type: 'ערב חג' },           // 1 ביוני 2025
  { name: 'שבועות', date: new Date(2025, 5, 2), type: 'חג' },                   // 2 ביוני 2025
  
  // ימי בין המצרים
  { name: 'שבעה עשר בתמוז', date: new Date(2025, 6, 15), type: 'צום' },         // 15 ביולי 2025
  { name: 'תשעה באב', date: new Date(2025, 7, 10), type: 'צום' }                // 10 באוגוסט 2025
];

// אם הפונקציה צריכה לטפל בשנים מרובות, ניתן להתאים את התאריכים בהתאם לשנה שהתקבלה כפרמטר

return holidays;
}

// בדיקה אם מתבצעת גישה ממכשיר מובייל
function isMobileDevice() {
return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// התאמת ממשק למובייל
function adjustForMobile() {
if (isMobileDevice()) {
  document.body.classList.add('mobile-device');
}
}

// אתחול האפליקציה כאשר הדף נטען
document.addEventListener('DOMContentLoaded', () => {
console.log("המסמך נטען - מאתחל אפליקציה");

// התאמה למובייל
adjustForMobile();

// אתחול האפליקציה
initApp();
});
