// מידע מרכזי
let soldiers = [];
let tasks = [];
let assignments = [];
let currentWeek = new Date();
let searchTerm = '';
let editingSoldierId = null;
let userRole = 'viewer'; // מתחיל כצופה
let isAuthenticated = false;

// אובייקט עבור המשבצת הנוכחית לשיבוץ מהיר
let currentQuickAdd = {
    taskId: null,
    date: null
};

// אתחול האפליקציה
function initApp() {
    // אתחול הנתונים ישירות, ללא מסך התחברות בהתחלה
    initData();
    
    // הוספת Event Listeners לטופס ההתחברות אם יצטרכו אותו בעתיד
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

// פונקציה לטיפול בהתחברות למצב מנהל
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // בדיקת פרטי התחברות
    if (username.toLowerCase() === 'gili.dor' && password === 'gilidadmin') {
        // התחברות הצליחה
        userRole = 'admin';
        document.getElementById('loginScreen').classList.add('hidden');
        
        // עדכון הכפתור
        const roleText = document.getElementById('roleText');
        roleText.textContent = 'מנהל';
        
        // רינדור מחדש
        renderSoldiers();
        renderCalendar();
        
        // הצגת הודעת אישור
        showNotification('עברת למצב מנהל', 'success');
    } else {
        // התחברות נכשלה
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = 'שם משתמש או סיסמה שגויים';
        errorDiv.classList.remove('hidden');
        
        // ריקון שדה הסיסמה
        document.getElementById('password').value = '';
    }
}

// אתחול הנתונים
function initData() {
    console.log("מאתחל נתונים...");
    
    // טעינת נתונים מ-localStorage אם קיימים
    const savedSoldiers = localStorage.getItem('soldiers');
    const savedTasks = localStorage.getItem('tasks');
    const savedAssignments = localStorage.getItem('assignments');
    
    soldiers = savedSoldiers ? JSON.parse(savedSoldiers) : generateRandomSoldiers();
    console.log("נטענו", soldiers.length, "חיילים");
    
    tasks = savedTasks ? JSON.parse(savedTasks) : [
        { id: 1, name: 'פנ"פ צפון' },
        { id: 2, name: 'צפון דואלי' },
        { id: 3, name: 'פלמחים' },
        { id: 4, name: 'חצרים' },
        { id: 5, name: '500' },
        { id: 6, name: '600' }
    ];
    
    assignments = savedAssignments ? JSON.parse(savedAssignments) : [];
    
    // הגדרת השבוע הנוכחי לחמישי הקרוב
    currentWeek = getNextThursday();
    
    // שמירת הנתונים ב-localStorage
    saveData();
    
    // רינדור המידע לממשק
    renderAll();
    
    // הוספת האזנה לאירועים
    setupEventListeners();
    
    // הגדרת אפשרות שינוי גודל רשימת החיילים
    setupResizable();
}

// הוספת האזנה לאירועים
function setupEventListeners() {
    // לחצנים ראשיים
    document.getElementById('addSoldierBtn').addEventListener('click', handleAddSoldier);
    document.getElementById('toggleRole').addEventListener('click', toggleRole);
    document.getElementById('toggleReport').addEventListener('click', toggleReport);
    document.getElementById('prevWeek').addEventListener('click', subtractWeek);
    document.getElementById('nextWeek').addEventListener('click', addWeek);
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);
    
    // חיפוש
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        renderSoldiers();
    });
    
    // הוספה מהירה דיאלוג
    document.getElementById('closeQuickAdd').addEventListener('click', closeQuickAddDialog);
    document.getElementById('quickAddCancel').addEventListener('click', closeQuickAddDialog);
    document.getElementById('quickAddConfirm').addEventListener('click', confirmQuickAdd);
    document.querySelector('.dialog-overlay').addEventListener('click', closeQuickAddDialog);
}

// הגדרת אפשרות שינוי גודל רשימת החיילים
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

// שמירת כל הנתונים ב-localStorage
function saveData() {
    localStorage.setItem('soldiers', JSON.stringify(soldiers));
    localStorage.setItem('tasks', JSON.stringify(tasks));
    localStorage.setItem('assignments', JSON.stringify(assignments));
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

// רינדור של כל המידע בממשק
function renderAll() {
    renderCalendar();
    renderSoldiers();
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
        
        th.innerHTML = `
            ${dayName}
            <div class="text-sm">${formatDate(day)}</div>
        `;
        
        daysRow.appendChild(th);
    });
    
    // עדכון טווח התאריכים
    dateRangeElement.textContent = `${formatDate(daysOfWeek[0])} - ${formatDate(daysOfWeek[6])}`;
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
        taskCell.textContent = task.name;
        tr.appendChild(taskCell);
        
        // תאים לכל יום
        daysOfWeek.forEach(day => {
            const dateStr = formatDateISO(day);
            const assignment = assignments.find(
                a => a.taskId === task.id && a.date === dateStr
            );
            
            const td = document.createElement('td');
            td.className = 'task-cell border';
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
}

// פונקציה לפתיחת דיאלוג הוספה מהירה
function showQuickAddDialog(taskId, taskName, dateStr, dateObj) {
    // שמירת המידע הנוכחי
    currentQuickAdd.taskId = taskId;
    currentQuickAdd.date = dateStr;
    
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

// אישור הוספה מהירה של חיילים
function confirmQuickAdd() {
    const selectedSoldiers = Array.from(document.querySelectorAll('#availableSoldiers input[type="checkbox"]:checked'))
        .map(cb => parseInt(cb.value));
    
    if (selectedSoldiers.length === 0) {
        showNotification('לא נבחרו חיילים', 'error');
        return;
    }
    
    // חיפוש אם כבר קיים שיבוץ למשימה זו בתאריך זה
    const existingAssignmentIndex = assignments.findIndex(
        a => a.taskId === currentQuickAdd.taskId && a.date === currentQuickAdd.date
    );
    
    if (existingAssignmentIndex >= 0) {
        // עדכון שיבוץ קיים - הוספת חיילים שלא משובצים כבר
        const updatedAssignment = assignments[existingAssignmentIndex];
        const newSoldiers = selectedSoldiers.filter(id => !updatedAssignment.soldierIds.includes(id));
        
        if (newSoldiers.length > 0) {
            updatedAssignment.soldierIds = [...updatedAssignment.soldierIds, ...newSoldiers];
            showNotification(`נוספו ${newSoldiers.length} חיילים למשימה`, 'success');
        } else {
            showNotification('כל החיילים שנבחרו כבר משובצים למשימה זו', 'info');
        }
    } else {
        // יצירת שיבוץ חדש
        assignments.push({
            id: Date.now(),
            taskId: currentQuickAdd.taskId,
            date: currentQuickAdd.date,
            soldierIds: selectedSoldiers
        });
        
        showNotification(`נוספו ${selectedSoldiers.length} חיילים למשימה`, 'success');
    }
    
    // שמירה ורינדור מחדש
    saveData();
    renderCalendar();
    
    // סגירת הדיאלוג
    closeQuickAddDialog();
}

// סגירת דיאלוג הוספה מהירה
function closeQuickAddDialog() {
    document.getElementById('quickAddDialog').classList.add('hidden');
}

// פונקציה לטיפול בהורדת חייל במשימה
function handleDrop(e) {
    e.preventDefault();
    
    if (userRole !== 'admin') return; // רק מנהל יכול לשבץ
    
    const soldierId = parseInt(e.dataTransfer.getData('soldierId'));
    const taskId = parseInt(this.dataset.taskId);
    const dateStr = this.dataset.date;
    
    // אפקט ויזואלי
    this.classList.remove('bg-blue-50');
    
    // בדיקה אם החייל כבר משובץ ליום זה
    if (hasConflict(soldierId, dateStr)) {
        showNotification('שים לב: החייל כבר משובץ למשימה אחרת ביום זה!', 'error');
        return;
    }
    
    // חיפוש אם כבר קיים שיבוץ למשימה זו בתאריך זה
    const existingAssignmentIndex = assignments.findIndex(
        a => a.taskId === taskId && a.date === dateStr
    );
    
    if (existingAssignmentIndex >= 0) {
        // עדכון שיבוץ קיים
        if (!assignments[existingAssignmentIndex].soldierIds.includes(soldierId)) {
            assignments[existingAssignmentIndex].soldierIds.push(soldierId);
            showNotification('החייל שובץ בהצלחה!', 'success');
        }
    } else {
        // יצירת שיבוץ חדש
        assignments.push({
            id: Date.now(),
            taskId,
            date: dateStr,
            soldierIds: [soldierId]
        });
        showNotification('החייל שובץ בהצלחה!', 'success');
    }
    
    // שמירה ורינדור מחדש
    saveData();
    renderCalendar();
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

// פונקציה למניעת התנהגות ברירת מחדל בגרירה והוספת הדגשה
function handleDragOver(e) {
    e.preventDefault();
    this.classList.add('bg-blue-50');
}

// פונקציה לסיום הגרירה והסרת ההדגשה
function handleDragLeave(e) {
    this.classList.remove('bg-blue-50');
}

// פונקציה לבדיקה אם יש התנגשות (חייל משובץ ליום זה)
function hasConflict(soldierId, dateStr) {
    return assignments.some(assignment => 
        assignment.date === dateStr && 
        assignment.soldierIds.includes(soldierId)
    );
}

// פונקציה להסרת חייל ממשימה
function handleRemoveSoldierFromTask(assignmentId, soldierId) {
    // חיפוש השיבוץ לפי מזהה
    const assignmentIndex = assignments.findIndex(a => a.id === assignmentId);
    
    if (assignmentIndex >= 0) {
        // הסרת החייל מהשיבוץ
        assignments[assignmentIndex].soldierIds = assignments[assignmentIndex].soldierIds.filter(id => id !== soldierId);
        
        // אם השיבוץ ריק, מסירים אותו לגמרי
        if (assignments[assignmentIndex].soldierIds.length === 0) {
            assignments.splice(assignmentIndex, 1);
        }
        
        showNotification('החייל הוסר מהמשימה', 'info');
        saveData();
        renderCalendar();
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

// פונקציה להוספת חייל חדש
function handleAddSoldier() {
    const firstNameInput = document.getElementById('newFirstName');
    const lastNameInput = document.getElementById('newLastName');
    const roleSelect = document.getElementById('newRole');
    
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const role = roleSelect.value;
    
    if (firstName && lastName) {
        const newSoldier = {
            id: Date.now(),
            firstName,
            lastName,
            role
        };
        
        soldiers.push(newSoldier);
        
        // איפוס השדות
        firstNameInput.value = '';
        lastNameInput.value = '';
        roleSelect.value = 'doctor';
        
        showNotification('החייל נוסף בהצלחה!', 'success');
        saveData();
        renderSoldiers();
    } else {
        showNotification('נא למלא את כל השדות', 'error');
    }
}

// פונקציה למעבר למצב עריכת חייל
function handleEditSoldier(soldierId) {
    editingSoldierId = soldierId;
    renderSoldiers();
}

// פונקציה לשמירת חייל אחרי עריכה
function handleSaveEdit(soldierId) {
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
    
    if (firstName && lastName) {
        const soldierIndex = soldiers.findIndex(s => s.id === soldierId);
        if (soldierIndex >= 0) {
            soldiers[soldierIndex] = {
                ...soldiers[soldierIndex],
                firstName,
                lastName,
                role
            };
            
            editingSoldierId = null;
            showNotification('פרטי החייל עודכנו בהצלחה!', 'success');
            saveData();
            renderSoldiers();
            renderCalendar(); // לעדכון צבעי התאים
        }
    } else {
        showNotification('נא למלא את כל השדות', 'error');
    }
}

// פונקציה למחיקת חייל
function handleDeleteSoldier(soldierId) {
    if (confirm('האם אתה בטוח שברצונך למחוק חייל זה?')) {
        soldiers = soldiers.filter(s => s.id !== soldierId);
        
        // מחיקת החייל מכל המשימות
        assignments.forEach(assignment => {
            assignment.soldierIds = assignment.soldierIds.filter(id => id !== soldierId);
        });
        
        // מחיקת משימות ריקות
        assignments = assignments.filter(a => a.soldierIds.length > 0);
        
        showNotification('החייל נמחק בהצלחה', 'success');
        saveData();
        renderSoldiers();
        renderCalendar();
    }
}

// פונקציה להצגת דוח
function toggleReport() {
    const reportView = document.getElementById('reportView');
    const schedulerView = document.getElementById('schedulerView');
    const toggleReportBtn = document.getElementById('toggleReport');
    
    const showingReport = reportView.classList.contains('hidden');
    
    if (showingReport) {
        // הצג דוח
        reportView.classList.remove('hidden');
        schedulerView.classList.add('hidden');
        toggleReportBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
            חזרה ללוח
        `;
        
        renderReport();
    } else {
        // הצג לוח
        reportView.classList.add('hidden');
        schedulerView.classList.remove('hidden');
        toggleReportBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <path d="M14 2v6h6"></path>
                <path d="M16 13H8"></path>
                <path d="M16 17H8"></path>
                <path d="M10 9H8"></path>
            </svg>
            הצג דוח
        `;
    }
}

// רינדור הדוח
function renderReport() {
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = '';
    
    // יצירת דוח לכל חייל
    soldiers.forEach(soldier => {
        const soldierAssignments = assignments.filter(a => 
            a.soldierIds.includes(soldier.id)
        ).map(a => {
            const task = tasks.find(t => t.id === a.taskId);
            return {
                date: a.date,
                taskName: task ? task.name : 'משימה לא ידועה'
            };
        });
        
        const reportItem = document.createElement('div');
        reportItem.className = 'report-item p-4';
        
        const roleLabel = 
            soldier.role === 'doctor' ? 'רופא' : 
            soldier.role === 'paramedic' ? 'פראמדיק' : 
            soldier.role === 'trainee' ? 'חניך' : 'חונך';
        
        reportItem.innerHTML = `
            <div class="font-bold text-lg ${soldier.role}">
                ${soldier.firstName} ${soldier.lastName} - ${roleLabel}
            </div>
            <div class="text-sm text-gray-600 mb-2">
                סה"כ משימות: ${soldierAssignments.length}
            </div>
        `;
        
        if (soldierAssignments.length > 0) {
            const assignmentsList = document.createElement('ul');
            assignmentsList.className = 'space-y-1';
            
            // מיון המשימות לפי תאריך
            const sortedAssignments = [...soldierAssignments].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            
            sortedAssignments.forEach(assignment => {
                const li = document.createElement('li');
                li.className = 'text-sm';
                li.textContent = `${formatDateHebrew(assignment.date)}: ${assignment.taskName}`;
                assignmentsList.appendChild(li);
            });
            
            reportItem.appendChild(assignmentsList);
        } else {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'text-sm text-gray-400';
            emptyMsg.textContent = 'אין משימות';
            reportItem.appendChild(emptyMsg);
        }
        
        reportContent.appendChild(reportItem);
    });
}

// פונקציה לייצוא הדוח לאקסל
function exportToExcel() {
    // יצירת מערך נתונים לייצוא
    const exportData = [];
    
    // כותרות
    exportData.push(['שם חייל', 'תפקיד', 'תאריך', 'משימה']);
    
    // יצירת שורה עבור כל שיבוץ לכל חייל
    soldiers.forEach(soldier => {
        const roleLabel = 
            soldier.role === 'doctor' ? 'רופא' : 
            soldier.role === 'paramedic' ? 'פראמדיק' : 
            soldier.role === 'trainee' ? 'חניך' : 'חונך';
        
        const soldierName = `${soldier.firstName} ${soldier.lastName}`;
        
        const soldierAssignments = assignments.filter(a => 
            a.soldierIds.includes(soldier.id)
        ).map(a => {
            const task = tasks.find(t => t.id === a.taskId);
            return {
                date: a.date,
                taskName: task ? task.name : 'משימה לא ידועה'
            };
        });
        
        if (soldierAssignments.length > 0) {
            // מיון המשימות לפי תאריך
            const sortedAssignments = [...soldierAssignments].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            
            sortedAssignments.forEach(assignment => {
                exportData.push([
                    soldierName,
                    roleLabel,
                    formatDateHebrew(assignment.date),
                    assignment.taskName
                ]);
            });
        } else {
            // גם חיילים ללא משימות
            exportData.push([
                soldierName,
                roleLabel,
                '',
                'אין משימות'
            ]);
        }
    });
    
    // יצירת Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    
    // הגדרת כיוון RTL עבור גיליון הנתונים
    if (!ws['!cols']) ws['!cols'] = [];
    ws['!cols'].push({ wch: 20 }); // רוחב עמודת שם
    ws['!cols'].push({ wch: 15 }); // רוחב עמודת תפקיד
    ws['!cols'].push({ wch: 15 }); // רוחב עמודת תאריך
    ws['!cols'].push({ wch: 25 }); // רוחב עמודת משימה
    
    // הגדרת סגנון RTL
    if (!ws['!protect']) ws['!protect'] = {};
    ws['!protect'].formatCells = false;
    
    // הוספת הגיליון ל-Workbook
    XLSX.utils.book_append_sheet(wb, ws, "דוח משימות");
    
    // ייצוא הקובץ
    XLSX.writeFile(wb, "דוח_משימות_חיילים.xlsx");
    
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
function toggleRole() {
    if (userRole === 'admin') {
        userRole = 'viewer';
        showNotification('עברת למצב צפייה', 'info');
    } else {
        // בקשת הזדהות
        const loginPrompt = prompt("הכנס סיסמה למצב מנהל:");
        if (loginPrompt === 'gilidadmin') {
            userRole = 'admin';
            showNotification('עברת למצב מנהל', 'success');
        } else if (loginPrompt !== null) { // רק אם המשתמש לחץ על OK ולא על Cancel
            showNotification('סיסמה שגויה', 'error');
        }
    }
    
    // עדכון הכפתור
    const roleText = document.getElementById('roleText');
    roleText.textContent = userRole === 'admin' ? 'מנהל' : 'צופה';
    
    // רינדור מחדש
    renderSoldiers();
    renderCalendar();
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

// פורמט תאריך ISO: YYYY-MM-DD
function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// פורמט תאריך בעברית
function formatDateHebrew(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL');
}

function generateRandomSoldiers() {
  return [
    {id: 1, firstName: "אביב", lastName: "בן צבי", role: "doctor"},
    {id: 2, firstName: "איתמר", lastName: "מחול", role: "doctor"},
    {id: 3, firstName: "גוני", lastName: "סוסן", role: "doctor"},
    {id: 4, firstName: "דוד", lastName: "ולאמן", role: "doctor"},
    {id: 5, firstName: "איציק", lastName: "סיני", role: "doctor"},
    {id: 6, firstName: "לנגר", lastName: "ישעיה", role: "doctor"},
    {id: 7, firstName: "רוני", lastName: "הבר", role: "doctor"},
    {id: 8, firstName: "סמי", lastName: "גנדלר", role: "doctor"},
    {id: 9, firstName: "שלום", lastName: "רייך", role: "doctor"},
    {id: 10, firstName: "שעיה", lastName: "לנגר", role: "doctor"},
    {id: 11, firstName: "לוקס", lastName: "ליסנדרו", role: "doctor"},
    {id: 12, firstName: "שחר", lastName: "שפירא", role: "doctor"},
    {id: 13, firstName: "רועי", lastName: "גלאם", role: "doctor"},
    {id: 14, firstName: "אייל", lastName: "רומם", role: "doctor"},
    {id: 15, firstName: "איתי", lastName: "זמורה", role: "doctor"},
    {id: 16, firstName: "אליעד", lastName: "אבירם", role: "doctor"},
    {id: 17, firstName: "אלכס", lastName: "גפטלר", role: "doctor"},
    {id: 18, firstName: "אלמוג", lastName: "בן יעקוב", role: "doctor"},
    {id: 19, firstName: "מתן", lastName: "", role: "doctor"},
    {id: 20, firstName: "אנדרי", lastName: "נבו", role: "doctor"},
    {id: 21, firstName: "אנטולי", lastName: "לייצין", role: "doctor"},
    {id: 22, firstName: "אפלבאום", lastName: "איציק", role: "doctor"},
    {id: 23, firstName: "אריה", lastName: "סורקרסקי", role: "doctor"},
    {id: 24, firstName: "אשר", lastName: "גולן", role: "doctor"},
    {id: 25, firstName: "ברלינר", lastName: "אליחי", role: "doctor"},
    {id: 26, firstName: "ברק", lastName: "חממי", role: "doctor"},
    {id: 27, firstName: "יובל", lastName: "רווה", role: "doctor"},
    {id: 28, firstName: "אלי", lastName: "בכור", role: "doctor"},
    {id: 29, firstName: "דניאל", lastName: "ברנוולד", role: "doctor"},
    {id: 30, firstName: "הוכמן", lastName: "יובל", role: "doctor"},
    {id: 31, firstName: "זכר", lastName: "שפירא", role: "doctor"},
    {id: 32, firstName: "ג'סי", lastName: "הופניהמיר", role: "doctor"},
    {id: 33, firstName: "חיים", lastName: "גרינברג", role: "doctor"},
    {id: 34, firstName: "חיליק", lastName: "חיוון", role: "doctor"},
    {id: 35, firstName: "יוחאי", lastName: "רביב", role: "doctor"},
    {id: 36, firstName: "ישראל", lastName: "קוזניץ", role: "doctor"},
    {id: 37, firstName: "ליאור", lastName: "רייכל", role: "doctor"},
    {id: 38, firstName: "מיכאל", lastName: "קוגן", role: "doctor"},
    {id: 39, firstName: "מלקין", lastName: "", role: "doctor"},
    {id: 40, firstName: "משה", lastName: "רוחם", role: "doctor"},
    {id: 41, firstName: "ניתאי", lastName: "", role: "doctor"},
    {id: 42, firstName: "סרגיי", lastName: "דומציק", role: "doctor"},
    {id: 43, firstName: "עמית", lastName: "להבי", role: "doctor"},
    {id: 44, firstName: "ערן", lastName: "דנון", role: "doctor"},
    {id: 45, firstName: "רוני", lastName: "חכים", role: "doctor"},
    {id: 46, firstName: "יונתן", lastName: "נבו", role: "doctor"},
    {id: 47, firstName: "רעות", lastName: "שביט", role: "doctor"},
    {id: 48, firstName: "אלון", lastName: "גלזברג", role: "doctor"},
    {id: 49, firstName: "אריאל", lastName: "גינזבורג", role: "doctor"},
    {id: 50, firstName: "הופמן", lastName: "יואב", role: "doctor"},
    {id: 51, firstName: "גיא", lastName: "ברשדסקי", role: "doctor"},
    {id: 52, firstName: "יעקוב", lastName: "ויינשטיין", role: "doctor"},

    {id: 53, firstName: "אבי", lastName: "פוקס", role: "mentor"},
    {id: 54, firstName: "אהוד", lastName: "פז", role: "mentor"},
    {id: 55, firstName: "אייל", lastName: "רז", role: "mentor"},
    {id: 56, firstName: "איתי", lastName: "גבאי", role: "mentor"},
    {id: 57, firstName: "אלכס", lastName: "זלוטניק", role: "mentor"},
    {id: 58, firstName: "אסף", lastName: "ניני", role: "mentor"},
    {id: 59, firstName: "ברוך", lastName: "בצופין", role: "mentor"},
    {id: 60, firstName: "ברק", lastName: "לויט", role: "mentor"},
    {id: 61, firstName: "ג'יי", lastName: "וולגלרנטר", role: "mentor"},
    {id: 62, firstName: "גיורא", lastName: "וייזר", role: "mentor"},
    {id: 63, firstName: "גל", lastName: "פחיס", role: "mentor"},
    {id: 64, firstName: "דני", lastName: "אפשטיין", role: "mentor"},
    {id: 65, firstName: "דני", lastName: "קינג", role: "mentor"},
    {id: 66, firstName: "יבגני", lastName: "ברוטפין", role: "mentor"},
    {id: 67, firstName: "יונתן", lastName: "לורבר", role: "mentor"},
    {id: 68, firstName: "ניר", lastName: "סמואל", role: "mentor"},
    {id: 69, firstName: "סער", lastName: "", role: "mentor"},
    {id: 70, firstName: "עידו", lastName: "בן צבי", role: "mentor"},
    {id: 71, firstName: "רגינה", lastName: "", role: "mentor"},
    {id: 72, firstName: "ארי", lastName: "ליפסקי", role: "mentor"},
    {id: 73, firstName: "ליאור", lastName: "שגב", role: "mentor"},
    {id: 74, firstName: "ברוך", lastName: "ברזון", role: "mentor"},

    {id: 76, firstName: "אביתר", lastName: "כהן", role: "paramedic"},
    {id: 77, firstName: "אודי", lastName: "אדרי", role: "paramedic"},
    {id: 78, firstName: "אופיר", lastName: "שוורץ", role: "paramedic"},
    {id: 79, firstName: "אחיה", lastName: "ליפשטיין", role: "paramedic"},
    {id: 80, firstName: "אייל", lastName: "גרשי", role: "paramedic"},
    {id: 81, firstName: "אילן", lastName: "שולמן", role: "paramedic"},
    {id: 82, firstName: "איתי", lastName: "אברהם", role: "paramedic"},
    {id: 83, firstName: "אלישיב", lastName: "אמיתי", role: "paramedic"},
    {id: 84, firstName: "בני", lastName: "חכימיאן", role: "paramedic"},
    {id: 85, firstName: "גיא", lastName: "מלמד", role: "paramedic"},
    {id: 86, firstName: "גיל", lastName: "הירשהורן", role: "paramedic"},
    {id: 87, firstName: "גילי", lastName: "דור", role: "paramedic"},
    {id: 88, firstName: "דויד", lastName: "אפלבאום", role: "paramedic"},
    {id: 89, firstName: "דניאל", lastName: "פירסט", role: "paramedic"},
    {id: 90, firstName: "וולדר", lastName: "מאיר", role: "paramedic"},
    {id: 91, firstName: "יובל", lastName: "לנגרמן", role: "paramedic"},
    {id: 92, firstName: "יוני", lastName: "כהן", role: "paramedic"},
    {id: 93, firstName: "יוסי", lastName: "חכימיאן", role: "paramedic"},
    {id: 94, firstName: "יוסף", lastName: "צבי", role: "paramedic"},
    {id: 95, firstName: "יניב", lastName: "שגיא", role: "paramedic"},
    {id: 96, firstName: "לבנון", lastName: "עילי", role: "paramedic"},
    {id: 97, firstName: "מיכאל", lastName: "אבו", role: "paramedic"},
    {id: 98, firstName: "מעיין", lastName: "לובלין", role: "paramedic"},
    {id: 99, firstName: "נדר", lastName: "", role: "paramedic"},
    {id: 100, firstName: "נועם", lastName: "איגרה", role: "paramedic"},
    {id: 101, firstName: "נועם", lastName: "אילוז", role: "paramedic"},
    {id: 102, firstName: "ניצן", lastName: "הברקורן", role: "paramedic"},
    {id: 103, firstName: "צור", lastName: "אדמון", role: "paramedic"},
    {id: 104, firstName: "צלח", lastName: "", role: "paramedic"},
    {id: 105, firstName: "קובי", lastName: "מור", role: "paramedic"},
    {id: 106, firstName: "קוטלר", lastName: "", role: "paramedic"},
    {id: 107, firstName: "קיטרו", lastName: "יוסי", role: "paramedic"},
    {id: 108, firstName: "קיסו", lastName: "", role: "paramedic"},
    {id: 109, firstName: "רז", lastName: "הברהם", role: "paramedic"},
    {id: 110, firstName: "שי", lastName: "לאופר", role: "paramedic"},
    {id: 111, firstName: "תום", lastName: "פסלר", role: "paramedic"},
    {id: 112, firstName: "שי", lastName: "לוי", role: "paramedic"},
    {id: 113, firstName: "פל", lastName: "", role: "paramedic"},
    {id: 114, firstName: "שני", lastName: "", role: "paramedic"},
    {id: 115, firstName: "אורן", lastName: "יעקובוסקי", role: "paramedic"},
    {id: 116, firstName: "אסתרסון", lastName: "עקיבא", role: "paramedic"},
    {id: 117, firstName: "יהונתן", lastName: "נבו", role: "paramedic"},

    {id: 118, firstName: "אדם", lastName: "לוסטיג", role: "trainee"},
    {id: 119, firstName: "עמית", lastName: "בנדי", role: "trainee"},
    {id: 120, firstName: "אייל", lastName: "היימן", role: "trainee"},
    {id: 121, firstName: "אלון", lastName: "רביב", role: "trainee"},
    {id: 122, firstName: "אליחי", lastName: "חביב", role: "trainee"},
    {id: 123, firstName: "אמנון", lastName: "וגמיסטר", role: "trainee"},
    {id: 124, firstName: "ארגמן", lastName: "נתן", role: "trainee"},
    {id: 125, firstName: "גיא", lastName: "אביטל", role: "trainee"},
    {id: 126, firstName: "גל", lastName: "פוריס", role: "trainee"},
    {id: 127, firstName: "וייס", lastName: "יותם", role: "trainee"},
    {id: 128, firstName: "יונתן", lastName: "מורג", role: "trainee"},
    {id: 129, firstName: "יניב", lastName: "רינגל", role: "trainee"},
    {id: 130, firstName: "מור", lastName: "ריטבלט", role: "trainee"},
    {id: 131, firstName: "נעם", lastName: "זרובסקי", role: "trainee"},
    {id: 132, firstName: "נעם", lastName: "כהן", role: "trainee"},
    {id: 133, firstName: "שינה", lastName: "מאיה", role: "trainee"},
    {id: 134, firstName: "שירה", lastName: "דורות", role: "trainee"},
  ];
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