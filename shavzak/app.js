// Main application script
document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    let currentDate = new Date();
    let soldiers = [];
    let assignments = [];
    let holidays = [];
    let activeFilters = {
        taskTypes: ['shag', 'patrol', 'carmelA', 'carmelB', 'shaz', 'commander'],
        soldierId: ''
    };

    // Task type configurations
    const taskTypes = {
        shag: { 
            name: 'ש"ג',
            color: 'var(--shag-color)',
            displayMode: 'regular'
        },
        patrol: { 
            name: 'סיור', 
            color: 'var(--patrol-color)', 
            displayMode: 'regular'
        },
        carmelA: { 
            name: 'כרמל א\'', 
            color: 'var(--carmelA-color)', 
            displayMode: 'regular'
        },
        carmelB: { 
            name: 'כרמל ב\'', 
            color: 'var(--carmelB-color)', 
            displayMode: 'regular' 
        },
        shaz: { 
            name: 'ש"ז', 
            color: 'var(--shaz-color)', 
            displayMode: 'hours'
        },
        commander: { 
            name: 'מפקד גזרה', 
            color: 'var(--commander-color)', 
            displayMode: 'regular'
        }
    };

    // Shift configurations
    const shifts = {
        morning: { name: 'בוקר', timeRange: '06:00-14:00' },
        afternoon: { name: 'צהריים', timeRange: '14:00-22:00' },
        night: { name: 'לילה', timeRange: '22:00-06:00' }
    };

    // Cache DOM elements
    const calendarContainer = document.getElementById('calendar-container');
    const calendarTitle = document.getElementById('calendar-title');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const todayBtn = document.getElementById('today-btn');
    const viewBtns = document.querySelectorAll('.view-btn');
    const loginBtn = document.getElementById('login-btn');
    const adminBtn = document.getElementById('admin-btn');
    const filterBtn = document.getElementById('filter-btn');
    const navBtns = document.querySelectorAll('.nav-btn');
    
    // בדיקה שהכפתורים אכן קיימים
    console.log('prevBtn:', prevBtn);
    console.log('nextBtn:', nextBtn);
    console.log('todayBtn:', todayBtn);
    
    // Modals
    const loginModal = document.getElementById('login-modal');
    const assignmentModal = document.getElementById('assignment-modal');
    const filterModal = document.getElementById('filter-modal');
    const adminModal = document.getElementById('admin-modal');
    const soldierModal = document.getElementById('soldier-modal');
    const soldiersListModal = document.getElementById('soldiers-list-modal');

    // Forms
    const loginForm = document.getElementById('login-form');
    const assignmentForm = document.getElementById('assignment-form');
    const filterForm = document.getElementById('filter-form');
    const soldierForm = document.getElementById('soldier-form');
    const taskSettingsForm = document.getElementById('task-settings-form');
    
    // בדיקת טפסים
    console.log('taskSettingsForm:', taskSettingsForm);
    console.log('saveTaskSettingsBtn:', document.getElementById('save-task-settings-btn'));
    
    // Field elements
    const taskTypeSelect = document.getElementById('task-type');
    const shiftGroup = document.getElementById('shift-group');
    const shiftTypeSelect = document.getElementById('shift-type');
    const hoursGroup = document.getElementById('hours-group');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const soldierSelect = document.getElementById('soldier-select');
    const soldierSearch = document.getElementById('soldier-search');
    const selectedSoldiersList = document.getElementById('selected-soldiers-list');
    const deleteAssignmentBtn = document.getElementById('delete-assignment');
    
    // Admin elements
    const adminTabs = document.querySelectorAll('.admin-tab');
    const adminTabContents = document.querySelectorAll('.admin-tab-content');
    const addSoldierBtn = document.getElementById('add-soldier-btn');
    const soldiersList = document.getElementById('soldiers-list');
    const deleteSoldierBtn = document.getElementById('delete-soldier');
    
    // Initialize app
    initApp();

    // Initialize application
    async function initApp() {
        // הסתר את התוכן העיקרי עד להתחברות
        const mainContent = document.querySelector('main');
        const bottomNav = document.querySelector('.bottom-nav');
        
        // הסתר תחילה את תוכן האפליקציה
        mainContent.style.display = 'none';
        bottomNav.style.display = 'none';
        
        // בדוק אם המשתמש מחובר
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                // המשתמש מחובר - טען את האפליקציה
                console.log('User is logged in:', user.email);
                
                // הצג את התוכן העיקרי
                mainContent.style.display = 'block';
                bottomNav.style.display = 'flex';
                
                // טען נתונים ואתחל את האפליקציה
                await loadSoldiers();
                loadTaskSettings();
                addEventListeners();
                updateView();
                
                // סגור את מודל ההתחברות אם הוא פתוח
                loginModal.style.display = 'none';
                
                // עדכן את סטטוס ההתחברות והחזר את כפתור הסגירה
                const loginStatus = document.getElementById('login-status');
                if (loginStatus) loginStatus.textContent = '';
                
                const closeBtn = loginModal.querySelector('.close');
                if (closeBtn) closeBtn.style.display = 'block';
                
                // עדכן את כפתור ההתחברות להראות מצב מחובר
                if (loginBtn) {
                    loginBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
                }
                
                // בדוק אם במצב לא מקוון
                if (!navigator.onLine) {
                    showOfflineIndicator();
                }
            } else {
                // המשתמש לא מחובר - הצג מסך התחברות
                console.log('User is not logged in');
                
                // הצג את כפתור ההתחברות במצב לא מחובר
                if (loginBtn) {
                    loginBtn.innerHTML = '<i class="fas fa-user"></i>';
                }
                
                // הסתר את התוכן העיקרי
                mainContent.style.display = 'none';
                bottomNav.style.display = 'none';
                
                showAuthScreen();
            }
        });
        
        // האזן לשינויים במצב חיבור לרשת
        window.addEventListener('online', hideOfflineIndicator);
        window.addEventListener('offline', showOfflineIndicator);
    }
    
    // הצג מסך התחברות
    function showAuthScreen() {
        // הסתר את התוכן העיקרי
        const mainContent = document.querySelector('main');
        const bottomNav = document.querySelector('.bottom-nav');
        mainContent.style.display = 'none';
        bottomNav.style.display = 'none';
        
        // הצג את מסך ההתחברות
        showModal(loginModal);
        
        // עדכן את משתנה הסגירה כך שלא ניתן יהיה לסגור את המודל ללא התחברות
        const closeBtn = loginModal.querySelector('.close');
        closeBtn.style.display = 'none';
        
        // בדוק שטופס ההתחברות מחובר כראוי
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            // הסר מאזיני אירועים קודמים אם קיימים
            loginForm.removeEventListener('submit', handleLogin);
            
            // הוסף מאזין אירוע חדש
            loginForm.addEventListener('submit', handleLogin);
            
            console.log('טופס ההתחברות חובר מחדש לפונקציית handleLogin');
        } else {
            console.error('לא נמצא טופס התחברות!');
        }
    }

    // Add event listeners
    function addEventListeners() {
        // Navigation
        prevBtn.addEventListener('click', navigatePrev);
        nextBtn.addEventListener('click', navigateNext);
        todayBtn.addEventListener('click', navigateToday);
        
        // View selection
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentView = btn.dataset.view;
                
                // Update active button
                viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update view
                updateView();
            });
        });
        
        // Add event listener to task type select
        taskTypeSelect.addEventListener('change', () => {
            toggleTaskFields(taskTypeSelect.value);
        });
        
        // אירוע לסינון לפי מחלקה
        const departmentFilter = document.getElementById('department-filter');
        if (departmentFilter) {
            departmentFilter.addEventListener('change', () => {
                populateSoldierSelect(); // עדכון רשימת החיילים לפי המחלקה שנבחרה
            });
        }
        
        // אירוע לחיפוש חיילים
        soldierSearch.addEventListener('input', () => {
            const searchText = soldierSearch.value.trim().toLowerCase();
            
            Array.from(soldierSelect.options).forEach(option => {
                const soldierName = option.text.toLowerCase();
                if (soldierName.includes(searchText)) {
                    option.style.display = '';
                } else {
                    option.style.display = 'none';
                }
            });
        });
        
        // Bottom navigation
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                // Update active button
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Handle tab change
                handleTabChange(tab);
            });
        });
        
        // Login button
        loginBtn.addEventListener('click', () => {
            if (firebase.auth().currentUser) {
                // Log out
                firebase.auth().signOut().then(() => {
                    console.log('התנתקות בוצעה בהצלחה');
                }).catch((error) => {
                    console.error('שגיאה בהתנתקות:', error);
                });
            } else {
                // Show login modal
                showModal(loginModal);
            }
        });
        
        // Admin button
        adminBtn.addEventListener('click', () => {
            showModal(adminModal);
            
            // Set active tab to soldiers
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector('.admin-tab[data-tab="soldiers"]').classList.add('active');
            
            // Show soldiers tab content, hide others
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('soldiers-tab').classList.add('active');
            
            // Refresh soldiers list
            populateSoldiersList();
        });
        
        // Filter button
        filterBtn.addEventListener('click', () => {
            showModal(filterModal);
        });
        
        // Enhanced soldier selection with click toggling
        soldierSelect.addEventListener('mousedown', function(event) {
            event.preventDefault();
            
            const target = event.target;
            if (target.tagName === 'OPTION') {
                // Toggle selection state
                target.selected = !target.selected;
                
                // Update the selected soldiers list
                updateSelectedSoldiersList();
            }
        });
        
        // Login form
        loginForm.addEventListener('submit', handleLogin);
        
        // Assignment form
        assignmentForm.addEventListener('submit', handleAssignmentSubmit);
        
        // Task type select
        taskTypeSelect.addEventListener('change', () => {
            const taskType = taskTypeSelect.value;
            toggleTaskFields(taskType);
        });
        
        // Soldier search
        soldierSearch.addEventListener('input', () => {
            const searchValue = soldierSearch.value.toLowerCase();
            const options = soldierSelect.options;
            
            for (let i = 0; i < options.length; i++) {
                const soldier = options[i].text.toLowerCase();
                if (soldier.includes(searchValue)) {
                    options[i].style.display = '';
                } else {
                    options[i].style.display = 'none';
                }
            }
        });
        
        // Filter form
        filterForm.addEventListener('submit', handleFilterSubmit);
        
        // Admin tabs
        adminTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                // Update active tab
                adminTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show tab content
                adminTabContents.forEach(content => {
                    if (content.id === tabName + '-tab') {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });
            });
        });
        
        // Add soldier button
        addSoldierBtn.addEventListener('click', () => {
            resetSoldierForm();
            showModal(soldierModal);
        });
        
        // Soldier form
        soldierForm.addEventListener('submit', handleSoldierSubmit);
        
        // Task settings form
        if (taskSettingsForm) {
            console.log('Adding event listener to task settings form');
            taskSettingsForm.addEventListener('submit', function(event) {
                console.log('Task settings form submit event triggered');
                handleTaskSettingsSubmit(event);
            });
            
            // הוסף גם האזנה לכפתור עצמו
            const saveTaskSettingsBtn = document.getElementById('save-task-settings-btn');
            if (saveTaskSettingsBtn) {
                saveTaskSettingsBtn.addEventListener('click', function(event) {
                    console.log('Save task settings button clicked');
                    // הכפתור כבר בתוך הטופס, אז הוא יפעיל את אירוע הsubmit של הטופס
                });
            }
        } else {
            console.error('Task settings form not found!');
        }
        
        // Delete assignment button
        deleteAssignmentBtn.addEventListener('click', handleDeleteAssignment);
        
        // Delete soldier button
        deleteSoldierBtn.addEventListener('click', handleDeleteSoldier);
        
        // Close modals when clicking on close button or outside the modal
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                closeBtn.closest('.modal').style.display = 'none';
            });
        });
        
        window.addEventListener('click', (event) => {
            document.querySelectorAll('.modal').forEach(modal => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Soldier select
        soldierSelect.addEventListener('change', updateSelectedSoldiersList);
    }

    // Handle tab change
    function handleTabChange(tab) {
        if (tab === 'calendar') {
            // Show calendar
            document.querySelector('main').style.display = 'block';
            document.querySelector('header').style.display = 'flex';
        } else if (tab === 'soldiers') {
            // Navigate to admin modal with soldiers tab
            console.log('Admin soldiers tab');
            
            // Show admin modal
            showModal(adminModal);
            
            // Set active tab to soldiers
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector('.admin-tab[data-tab="soldiers"]').classList.add('active');
            
            // Show soldiers tab content, hide others
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('soldiers-tab').classList.add('active');
            
            // Refresh soldiers list
            populateSoldiersList();
        } else if (tab === 'soldiers-list') {
            // Show soldiers list modal
            console.log('Soldiers list tab');
            
            // Show soldiers list modal
            showModal(soldiersListModal);
            
            // Populate soldiers table
            populateSoldiersTable();
        } else if (tab === 'admin') {
            // Show admin modal
            showModal(adminModal);
            
            // Add test data button (for development purposes)
            const adminActions = document.getElementById('admin-actions');
            if (adminActions) {
                // בדוק אם כפתור הבדיקה כבר קיים
                if (!document.getElementById('create-test-data-btn')) {
                    const createTestDataBtn = document.createElement('button');
                    createTestDataBtn.id = 'create-test-data-btn';
                    createTestDataBtn.className = 'btn primary-btn';
                    createTestDataBtn.innerHTML = 'צור שיבוצים אמיתיים לבדיקה (יישמרו בפיירבייס)';
                    createTestDataBtn.addEventListener('click', createRealTestAssignments);
                    adminActions.appendChild(createTestDataBtn);
                }
            }
        }
    }

    // Handle login form submission
    async function handleLogin(event) {
        event.preventDefault(); // וודא שזה עוצר את רענון הדף
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginStatus = document.getElementById('login-status');
        
        loginStatus.textContent = 'מתחבר...';
        
        try {
            console.log('מנסה להתחבר עם:', email);
            // שימוש במתודת התחברות של Firebase
            await firebase.auth().signInWithEmailAndPassword(email, password);
            
            // אין צורך לעשות את שאר הפעולות כאן - הם יקרו באופן אוטומטי בעת זיהוי המשתמש
            loginStatus.textContent = 'התחברות הצליחה!';
            
        } catch (error) {
            console.error('שגיאת התחברות:', error);
            loginStatus.textContent = 'התחברות נכשלה: ' + error.message;
        }
    }

    // Handle assignment form submission
    async function handleAssignmentSubmit(event) {
        event.preventDefault();
        
        console.log('Assignment form submitted');
        
        // Get form values
        const assignmentId = document.getElementById('assignment-id').value;
        console.log('Form assignment ID:', assignmentId);
        
        const dateStr = document.getElementById('assignment-date').value;
        const taskType = document.getElementById('task-type').value;
        const shiftType = document.getElementById('shift-type').value;
        const startTime = document.getElementById('start-time').value;
        const endTime = document.getElementById('end-time').value;
        const selectedSoldiers = Array.from(document.getElementById('soldier-select').selectedOptions).map(option => option.value);
        const notes = document.getElementById('notes').value;
        
        // בדיקת תקינות הקלט
        if (!dateStr) {
            alert('נא לבחור תאריך');
            return;
        }
        
        if (!taskType) {
            alert('נא לבחור סוג משימה');
            return;
        }
        
        if (selectedSoldiers.length === 0) {
            alert('נא לבחור לפחות חייל אחד');
            return;
        }
        
        console.log('Form values:', {
            assignmentId,
            dateStr,
            taskType,
            shiftType,
            startTime,
            endTime,
            selectedSoldiers,
            notes
        });
        
        // חיפוש שיבוצים קיימים לאותו תאריך
        const dateAssignments = assignments.filter(a => normalizeDateString(a.date) === normalizeDateString(dateStr));
        console.log('Existing assignments for this date:', dateAssignments);
        
        // מערך הודעות אזהרה
        const warnings = [];
        
        // בדיקה האם החיילים שנבחרו כבר משובצים באותו היום
        const soldiersWithExistingAssignments = [];
        for (const soldierId of selectedSoldiers) {
            const soldierAssignments = dateAssignments.filter(a => 
                (a.soldierIds && a.soldierIds.includes(soldierId)) || 
                (a.soldierId === soldierId)
            );
            
            if (soldierAssignments.length > 0) {
                const soldierName = soldiers.find(s => s.id === soldierId)?.name || soldierId;
                soldiersWithExistingAssignments.push({
                    soldierId,
                    soldierName,
                    assignments: soldierAssignments
                });
            }
        }
        
        if (soldiersWithExistingAssignments.length > 0) {
            for (const soldierData of soldiersWithExistingAssignments) {
                warnings.push(`החייל ${soldierData.soldierName} משובץ למשימה בהמשך היום`);
            }
        }
        
        // בדיקה אם כבר קיים שיבוץ לאותה משימה באותו זמן
        // (אותו סוג משימה, אותו תאריך, אותה משמרת או שעות)
        let existingAssignment = null;
        
        // פונקציה להשוואת זמנים בין שיבוצים
        const hasSameTime = (a1, a2) => {
            // אם משימה מסוג משמרות
            if (taskTypes[taskType].displayMode === 'shifts') {
                return a1.shiftType === a2.shiftType;
            } 
            // אם משימה מסוג שעות
            else if (taskTypes[taskType].displayMode === 'hours') {
                return a1.startTime === a2.startTime && a1.endTime === a2.endTime;
            }
            // אם משימה מסוג רגיל - אין צורך בהשוואה נוספת
            return true;
        };

        // בניית אובייקט לצורך השוואה
        const newAssignmentForComparison = {
            taskType,
            shiftType,
            startTime,
            endTime
        };
        
        // חיפוש שיבוץ קיים מתאים
        existingAssignment = dateAssignments.find(a => 
            a.taskType === taskType && 
            hasSameTime(a, newAssignmentForComparison) &&
            // אם זה לא העריכה של אותו שיבוץ
            (assignmentId === "" || a.id !== assignmentId)
        );
        
        // בדיקה האם החיילים שנבחרו כבר משובצים לאותה משימה
        if (existingAssignment) {
            const existingSoldierIds = existingAssignment.soldierIds || 
                                     (existingAssignment.soldierId ? [existingAssignment.soldierId] : []);
            
            const alreadyAssignedSoldiers = selectedSoldiers.filter(id => existingSoldierIds.includes(id));
            
            if (alreadyAssignedSoldiers.length > 0) {
                const soldierNames = alreadyAssignedSoldiers.map(id => 
                    soldiers.find(s => s.id === id)?.name || id
                );
                
                warnings.push(`החייל${soldierNames.length > 1 ? 'ים' : ''} ${soldierNames.join(', ')} כבר משובץ למשימה הזאת`);
            }
        }
        
        // הצגת אזהרות אם יש כאלה
        if (warnings.length > 0) {
            const proceed = confirm(warnings.join('\n\n') + '\n\nהאם להמשיך?');
            if (!proceed) {
                return;
            }
        }
        
        // Create assignment data
        const assignmentData = {
            date: normalizeDateString(dateStr),
            taskType,
            soldierIds: selectedSoldiers,
            notes
        };
        
        // Add shift or time if applicable
        if (taskTypes[taskType].displayMode === 'shifts') {
            assignmentData.shiftType = shiftType;
        } else if (taskTypes[taskType].displayMode === 'hours') {
            assignmentData.startTime = startTime;
            assignmentData.endTime = endTime;
        }
        
        // If it's an edit of an existing assignment with a valid ID
        if (assignmentId && assignmentId.trim() !== '' && assignmentId !== 'undefined') {
            try {
                // Update existing assignment
                console.log('Updating assignment with ID:', assignmentId);
                await window.firebaseService.updateAssignment(assignmentId, assignmentData);
                console.log('Assignment updated successfully');
                
                // Close modal
                assignmentModal.style.display = 'none';
                
                // Refresh view
                await updateView();
            } catch (error) {
                console.error('Error saving assignment:', error);
                alert('שגיאה: ' + error.message);
            }
        } 
        // אם זו הוספה חדשה, בדוק אם צריך להוסיף לשיבוץ קיים במקום ליצור חדש
        else if (existingAssignment) {
            try {
                // הוסף את החיילים לשיבוץ הקיים
                const existingSoldierIds = existingAssignment.soldierIds || 
                                         (existingAssignment.soldierId ? [existingAssignment.soldierId] : []);
                
                // מזג את רשימות החיילים והסר כפילויות
                const mergedSoldierIds = [...new Set([...existingSoldierIds, ...selectedSoldiers])];
                
                // עדכן את השיבוץ הקיים עם החיילים החדשים
                const updatedAssignmentData = {
                    ...existingAssignment,
                    soldierIds: mergedSoldierIds,
                    notes: notes || existingAssignment.notes // שמור על ההערות הקיימות אם לא הוכנסו חדשות
                };
                
                // מחק שדות מיותרים
                delete updatedAssignmentData.soldierId; // הסר את ה-soldierId הישן אם קיים
                
                console.log('Adding soldiers to existing assignment with ID:', existingAssignment.id);
                await window.firebaseService.updateAssignment(existingAssignment.id, updatedAssignmentData);
                console.log('Existing assignment updated successfully');
                
                // Close modal
                assignmentModal.style.display = 'none';
                
                // Refresh view
                await updateView();
            } catch (error) {
                console.error('Error updating existing assignment:', error);
                alert('שגיאה: ' + error.message);
            }
        } else {
            try {
                // Add new assignment
                console.log('Adding new assignment to Firebase:', assignmentData);
                const newAssignmentId = await window.firebaseService.addAssignment(assignmentData);
                console.log('Assignment added successfully with ID:', newAssignmentId);
                
                // Close modal
                assignmentModal.style.display = 'none';
                
                // Refresh view
                await updateView();
            } catch (error) {
                console.error('Error saving assignment:', error);
                alert('שגיאה: ' + error.message);
            }
        }
    }

    // Handle filter form submission
    function handleFilterSubmit(event) {
        event.preventDefault();
        
        // Get selected task types
        const taskCheckboxes = document.querySelectorAll('input[name="task-filter"]:checked');
        const selectedTaskTypes = Array.from(taskCheckboxes).map(cb => cb.value);
        
        // Get selected soldier
        const soldierId = document.getElementById('soldier-filter').value;
        
        // Update filters
        activeFilters.taskTypes = selectedTaskTypes;
        activeFilters.soldierId = soldierId;
        
        // Close modal
        filterModal.style.display = 'none';
        
        // Refresh view
        updateView();
    }

    // Handle soldier form submission
    async function handleSoldierSubmit(event) {
        event.preventDefault();
        
        // Get form values
        const soldierId = document.getElementById('soldier-id').value;
        const name = document.getElementById('soldier-name').value;
        const idNumber = document.getElementById('soldier-id-number').value;
        const phone = document.getElementById('soldier-phone').value;
        const department = document.getElementById('soldier-department').value;
        
        // Get tags
        const tagCheckboxes = document.querySelectorAll('input[name="soldier-tag"]:checked');
        const tags = Array.from(tagCheckboxes).map(cb => cb.value);
        
        // Create soldier data
        const soldierData = {
            name,
            idNumber,
            phone,
            department,
            tags
        };
        
        try {
            if (soldierId) {
                // Update existing soldier
                await window.firebaseService.updateSoldier(soldierId, soldierData);
            } else {
                // Add new soldier
                await window.firebaseService.addSoldier(soldierData);
            }
            
            // Close modal
            soldierModal.style.display = 'none';
            
            // Refresh soldiers
            await loadSoldiers();
            
            // Refresh view
            updateView();
        } catch (error) {
            alert('שגיאה: ' + error.message);
        }
    }

    // Handle task settings form submission
    async function handleTaskSettingsSubmit(event) {
        event.preventDefault();
        
        console.log('Task settings form submitted');
        
        // Get form values
        const settings = {
            taskTypes: {
                shag: {
                    color: document.getElementById('shag-color').value,
                    displayMode: document.querySelector('input[name="shag-display"]:checked').value
                },
                patrol: {
                    color: document.getElementById('patrol-color').value,
                    displayMode: document.querySelector('input[name="patrol-display"]:checked').value
                },
                carmelA: {
                    color: document.getElementById('carmelA-color').value,
                    displayMode: document.querySelector('input[name="carmelA-display"]:checked').value
                },
                carmelB: {
                    color: document.getElementById('carmelB-color').value,
                    displayMode: document.querySelector('input[name="carmelB-display"]:checked').value
                },
                shaz: {
                    color: document.getElementById('shaz-color').value,
                    displayMode: document.querySelector('input[name="shaz-display"]:checked').value
                },
                commander: {
                    color: document.getElementById('commander-color').value,
                    displayMode: document.querySelector('input[name="commander-display"]:checked').value
                }
            }
        };
        
        console.log('Saving task settings:', settings);
        
        try {
            // Save settings to localStorage for now (could be moved to Firebase later)
            localStorage.setItem('taskSettings', JSON.stringify(settings));
            console.log('Settings saved to localStorage successfully');
            
            // Update CSS variables for colors
            document.documentElement.style.setProperty('--shag-color', settings.taskTypes.shag.color);
            document.documentElement.style.setProperty('--patrol-color', settings.taskTypes.patrol.color);
            document.documentElement.style.setProperty('--carmelA-color', settings.taskTypes.carmelA.color);
            document.documentElement.style.setProperty('--carmelB-color', settings.taskTypes.carmelB.color);
            document.documentElement.style.setProperty('--shaz-color', settings.taskTypes.shaz.color);
            document.documentElement.style.setProperty('--commander-color', settings.taskTypes.commander.color);
            
            // Update task type configurations
            if (settings.taskTypes.shag) {
                taskTypes.shag.color = settings.taskTypes.shag.color;
                taskTypes.shag.displayMode = settings.taskTypes.shag.displayMode;
            }
            
            if (settings.taskTypes.patrol) {
                taskTypes.patrol.color = settings.taskTypes.patrol.color;
                taskTypes.patrol.displayMode = settings.taskTypes.patrol.displayMode;
            }
            
            if (settings.taskTypes.carmelA) {
                taskTypes.carmelA.color = settings.taskTypes.carmelA.color;
                taskTypes.carmelA.displayMode = settings.taskTypes.carmelA.displayMode;
            }
            
            if (settings.taskTypes.carmelB) {
                taskTypes.carmelB.color = settings.taskTypes.carmelB.color;
                taskTypes.carmelB.displayMode = settings.taskTypes.carmelB.displayMode;
            }
            
            if (settings.taskTypes.shaz) {
                taskTypes.shaz.color = settings.taskTypes.shaz.color;
                taskTypes.shaz.displayMode = settings.taskTypes.shaz.displayMode;
            }
            
            if (settings.taskTypes.commander) {
                taskTypes.commander.color = settings.taskTypes.commander.color;
                taskTypes.commander.displayMode = settings.taskTypes.commander.displayMode;
            }
            
            // Show success message
            alert('הגדרות המשימות נשמרו בהצלחה');
            
            // Close the admin modal
            adminModal.style.display = 'none';
            
            // סגירת הטאב של המשימות והמעבר לטאב חיילים
            const soldiersTab = document.querySelector('.admin-tab[data-tab="soldiers"]');
            if (soldiersTab) {
                soldiersTab.click();
            }
            
            // Refresh view to apply changes
            updateView();
        } catch (error) {
            console.error('Error saving task settings:', error);
            alert('שגיאה בשמירת ההגדרות: ' + error.message);
        }
    }

    // Handle delete assignment
    async function handleDeleteAssignment() {
        if (confirm('האם אתה בטוח שברצונך למחוק את המשימה?')) {
            const assignmentId = document.getElementById('assignment-id').value;
            
            console.log('Attempting to delete assignment with ID:', assignmentId);
            
            if (!assignmentId) {
                alert('שגיאה: מזהה המשימה חסר');
                return;
            }
            
            // נבדוק האם השיבוץ קיים במערך השיבוצים הנוכחי
            const assignmentExists = assignments.some(a => a.id === assignmentId);
            console.log('Assignment exists in current array:', assignmentExists);
            
            if (assignmentId.startsWith('sample-')) {
                alert('לא ניתן למחוק שיבוצי דוגמה זמניים. אלו אינם שיבוצים אמיתיים בפיירבייס.');
                assignmentModal.style.display = 'none';
                return;
            }
            
            try {
                console.log('Calling Firebase deleteAssignment...');
                await window.firebaseService.deleteAssignment(assignmentId);
                console.log('Assignment successfully deleted from Firebase');
                
                // Close modal
                assignmentModal.style.display = 'none';
                
                // Refresh view
                await updateView();
            } catch (error) {
                console.error('Error deleting assignment:', error);
                alert('שגיאה: ' + error.message);
            }
        }
    }

    // Handle delete soldier
    async function handleDeleteSoldier() {
        if (confirm('האם אתה בטוח שברצונך למחוק את החייל? פעולה זו תמחק גם את כל המשימות של החייל.')) {
            const soldierId = document.getElementById('soldier-id').value;
            
            try {
                await window.firebaseService.deleteSoldier(soldierId);
                
                // Close modal
                soldierModal.style.display = 'none';
                
                // Refresh soldiers
                await loadSoldiers();
                
                // Refresh view
                updateView();
            } catch (error) {
                alert('שגיאה: ' + error.message);
            }
        }
    }

    // Load soldiers from Firebase
    async function loadSoldiers() {
        try {
            soldiers = await window.firebaseService.getAllSoldiers();
            
            // Populate soldier select in assignment form
            populateSoldierSelect();
            
            // Populate soldier filter in filter form
            populateSoldierFilter();
            
            // Populate soldiers list in admin
            populateSoldiersList();
        } catch (error) {
            console.error('Error loading soldiers:', error);
        }
    }

    // Populate soldier select
    function populateSoldierSelect() {
        soldierSelect.innerHTML = '';
        
        // אם יש סינון מחלקה פעיל
        const departmentFilter = document.getElementById('department-filter');
        const selectedDepartment = departmentFilter ? departmentFilter.value : '';
        
        console.log('Filtering soldiers by department:', selectedDepartment);
        
        soldiers.forEach(soldier => {
            // דילוג על חיילים שלא במחלקה הנבחרת (אם יש סינון פעיל)
            if (selectedDepartment && soldier.department) {
                // המרה של הערך שהגיע מהמסד לערך שמתאים לסינון
                let deptValue = soldier.department.toString();
                
                // מיפוי ערכים מהמאגר לערכי הסינון
                if (deptValue === 'unit1') deptValue = '1';
                if (deptValue === 'unit2') deptValue = '2';
                if (deptValue === 'unit3') deptValue = '3';
                if (deptValue === 'hamal') deptValue = 'chamal';
                
                if (deptValue !== selectedDepartment) {
                    console.log('Skipping soldier', soldier.name, 'with department', soldier.department, '≠', selectedDepartment);
                    return;
                }
            }
            
            const option = document.createElement('option');
            option.value = soldier.id;
            option.textContent = soldier.name;
            
            // הוספת מחלקה כמחלקה (אם קיימת)
            if (soldier.department) {
                // המרת המחלקה למחרוזת CSS תקינה
                let deptClass = '';
                const deptStr = soldier.department.toString();
                
                if (['1', '2', '3'].includes(deptStr)) {
                    deptClass = 'dept-' + deptStr;
                } else if (deptStr === 'chamal' || deptStr === 'hamal') {
                    deptClass = 'chamal';
                } else if (deptStr === 'maflag') {
                    deptClass = 'maflag';
                } else if (deptStr === 'unit1') {
                    deptClass = 'dept-1';
                } else if (deptStr === 'unit2') {
                    deptClass = 'dept-2';
                } else if (deptStr === 'unit3') {
                    deptClass = 'dept-3';
                }
                
                if (deptClass) {
                    option.classList.add(deptClass);
                    // שמירת המחלקה כמאפיין נוסף לשימוש מאוחר יותר
                    option.dataset.department = soldier.department;
                }
            }
            
            soldierSelect.appendChild(option);
        });
        
        console.log('Populated soldier select with', soldierSelect.options.length, 'soldiers');
    }

    // Populate soldier filter
    function populateSoldierFilter() {
        const soldierFilter = document.getElementById('soldier-filter');
        soldierFilter.innerHTML = '<option value="">הכל</option>';
        
        soldiers.forEach(soldier => {
            const option = document.createElement('option');
            option.value = soldier.id;
            option.textContent = soldier.name;
            soldierFilter.appendChild(option);
        });
    }

    // Populate soldiers list
    function populateSoldiersList() {
        const soldiersList = document.getElementById('soldiers-list');
        soldiersList.innerHTML = '';
        
        // Group soldiers by department
        const soldiersByDepartment = {};
        
        // Initialize department groups
        const departmentNames = {
            'maflag': 'מפל"ג',
            'hamal': 'חמ"ל',
            'unit1': 'מחלקה 1',
            'unit2': 'מחלקה 2',
            'unit3': 'מחלקה 3',
            '': 'ללא מחלקה'
        };
        
        Object.keys(departmentNames).forEach(dept => {
            soldiersByDepartment[dept] = [];
        });
        
        // Add soldiers to their respective departments
        soldiers.forEach(soldier => {
            const dept = soldier.department || '';
            if (!soldiersByDepartment[dept]) {
                soldiersByDepartment[dept] = [];
            }
            soldiersByDepartment[dept].push(soldier);
        });
        
        // Create departments and add soldiers
        Object.keys(departmentNames).forEach(dept => {
            if (soldiersByDepartment[dept].length > 0) {
                // Create department header
                const deptHeader = document.createElement('div');
                deptHeader.className = 'department-header';
                deptHeader.textContent = departmentNames[dept];
                soldiersList.appendChild(deptHeader);
                
                // Add soldiers in this department
                soldiersByDepartment[dept].forEach(soldier => {
                    const listItem = document.createElement('div');
                    listItem.className = 'list-item';
                    
                    const soldierInfo = document.createElement('div');
                    soldierInfo.className = 'list-item-info';
                    
                    // Format tags for display
                    const tagLabels = {
                        'officer': 'קצין',
                        'sergeant': 'מ"כ',
                        'corporal': 'סמל',
                        'warrior': 'לוחם',
                        'medic': 'חובש',
                        'engineer': 'מהנדס',
                        'driver': 'נהג',
                        'comm': 'קשר'
                    };
                    
                    // Create tags string
                    let tagsString = '';
                    if (soldier.tags && soldier.tags.length > 0) {
                        const tagNames = soldier.tags.map(tag => tagLabels[tag] || tag);
                        tagsString = ` (${tagNames.join(', ')})`;
                    }
                    
                    soldierInfo.innerHTML = `<strong>${soldier.name}</strong>${tagsString}`;
                    
                    const soldierActions = document.createElement('div');
                    soldierActions.className = 'list-item-actions';
                    
                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn';
                    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                    editBtn.addEventListener('click', () => {
                        editSoldier(soldier);
                    });
                    
                    soldierActions.appendChild(editBtn);
                    listItem.appendChild(soldierInfo);
                    listItem.appendChild(soldierActions);
                    soldiersList.appendChild(listItem);
                });
            }
        });
    }

    // Edit soldier
    function editSoldier(soldier) {
        console.log('Editing soldier:', soldier);
        
        // Set form values
        document.getElementById('soldier-id').value = soldier.id;
        document.getElementById('soldier-name').value = soldier.name || '';
        document.getElementById('soldier-id-number').value = soldier.idNumber || '';
        document.getElementById('soldier-phone').value = soldier.phone || '';
        document.getElementById('soldier-department').value = soldier.department || '';
        
        // Check tags
        document.querySelectorAll('input[name="soldier-tag"]').forEach(cb => {
            if (soldier.tags && soldier.tags.includes(cb.value)) {
                cb.checked = true;
            } else {
                cb.checked = false;
            }
        });
        
        // Show delete button
        document.getElementById('delete-soldier').style.display = 'block';
        
        // Update modal title
        document.getElementById('soldier-modal-title').textContent = 'ערוך פרטי חייל';
        
        // Hide soldiers list modal if open
        hideModal(soldiersListModal);
        
        // Show soldier modal
        showModal(soldierModal);
    }

    // Reset soldier form
    function resetSoldierForm() {
        document.getElementById('soldier-id').value = '';
        document.getElementById('soldier-name').value = '';
        document.getElementById('soldier-id-number').value = '';
        document.getElementById('soldier-phone').value = '';
        document.getElementById('soldier-department').value = '';
        
        // Uncheck tags
        document.querySelectorAll('input[name="soldier-tag"]').forEach(cb => {
            cb.checked = false;
        });
        
        // Hide delete button
        document.getElementById('delete-soldier').style.display = 'none';
        
        // Update modal title
        document.getElementById('soldier-modal-title').textContent = 'הוסף חייל';
    }

    // Show assignment modal
    function showAssignmentModal(date, assignment = null) {
        console.log('showAssignmentModal called with date:', date, 'and assignment:', assignment);
        
        // Set form values
        document.getElementById('assignment-date').value = normalizeDateString(date);
        
        // Check if assignment has a valid ID before setting it
        if (assignment && assignment.id) {
            console.log('Setting assignment ID in form:', assignment.id);
            document.getElementById('assignment-id').value = assignment.id;
        } else {
            console.log('No assignment ID available, setting empty string');
            document.getElementById('assignment-id').value = '';
        }
        
        document.getElementById('task-type').value = assignment ? assignment.taskType : '';
        document.getElementById('shift-type').value = assignment && assignment.shiftType ? assignment.shiftType : 'morning';
        document.getElementById('start-time').value = assignment && assignment.startTime ? assignment.startTime : '';
        document.getElementById('end-time').value = assignment && assignment.endTime ? assignment.endTime : '';
        
        // Clear previous soldier selections
        Array.from(soldierSelect.options).forEach(option => {
            option.selected = false;
        });
        
        // Set selected soldiers
        if (assignment) {
            if (assignment.soldierIds && Array.isArray(assignment.soldierIds)) {
                // For assignments with multiple soldiers
                assignment.soldierIds.forEach(soldierId => {
                    const option = soldierSelect.querySelector(`option[value="${soldierId}"]`);
                    if (option) {
                        option.selected = true;
                    }
                });
            } else if (assignment.soldierId) {
                // For backward compatibility with older assignments
                const option = soldierSelect.querySelector(`option[value="${assignment.soldierId}"]`);
                if (option) {
                    option.selected = true;
                }
            }
        }
        
        // Update selected soldiers list with a short delay to ensure DOM updates
        setTimeout(() => {
            updateSelectedSoldiersList();
            console.log('Delayed update of selected soldiers list completed');
        }, 100);
        
        document.getElementById('notes').value = assignment && assignment.notes ? assignment.notes : '';
        
        // הסתרת כל תיבות הסימון של משמרות השעות מראש
        resetTimeSlotSelections();
        
        // עדכון תיבות הסימון המתאימות אם יש נתונים קיימים
        if (assignment && assignment.startTime && assignment.endTime) {
            const timeSlotValue = `${assignment.startTime}-${assignment.endTime}`;
            
            // בדוק את סוג החיתוך המתאים על פי משך הזמן
            const startHour = parseInt(assignment.startTime.split(':')[0]);
            const endHour = parseInt(assignment.endTime.split(':')[0]);
            const duration = (endHour < startHour ? endHour + 24 : endHour) - startHour;
            
            let intervalType;
            if (duration % 8 === 0) {
                intervalType = '8';
            } else if (duration % 4 === 0) {
                intervalType = '4';
            } else if (duration % 2 === 0) {
                intervalType = '2';
            } else {
                // אם אין התאמה מדויקת, השאר את הזמנים המדויקים
                intervalType = null;
            }
            
            if (intervalType) {
                // סמן את אפשרות החיתוך המתאימה
                const intervalRadio = document.querySelector(`input[name="hour-interval"][value="${intervalType}"]`);
                if (intervalRadio) {
                    intervalRadio.checked = true;
                    
                    // הצג את תיבות הסימון המתאימות לסוג החיתוך
                    showTimeSlotsByInterval(intervalType);
                    
                    // סמן את תיבת הסימון המתאימה אם קיימת
                    const timeSlotCheckbox = document.querySelector(`input[name="time-slot"][value="${timeSlotValue}"]`);
                    if (timeSlotCheckbox) {
                        timeSlotCheckbox.checked = true;
                    }
                }
            }
        }
        
        // Toggle fields based on task type
        toggleTaskFields(assignment ? assignment.taskType : '');
        
        // Show/hide delete button
        deleteAssignmentBtn.style.display = assignment ? 'block' : 'none';
        
        // Update modal title
        document.getElementById('assignment-modal-title').textContent = assignment ? 'ערוך משימה' : 'הוסף משימה';
        
        // Show modal
        showModal(assignmentModal);
    }

    // Reset time slot selections
    function resetTimeSlotSelections() {
        // איפוס כל תיבות הסימון של משמרות השעות
        document.querySelectorAll('input[name="time-slot"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // איפוס כל אפשרויות החיתוך
        document.querySelectorAll('input[name="hour-interval"]').forEach(radio => {
            radio.checked = false;
        });
        
        // הסתרת כל תיבות החיתוך
        document.querySelectorAll('.time-slots').forEach(container => {
            container.style.display = 'none';
        });
    }

    // Toggle task fields based on task type
    function toggleTaskFields(taskType) {
        if (!taskType) {
            shiftGroup.style.display = 'none';
            hoursGroup.style.display = 'none';
            return;
        }
        
        const task = taskTypes[taskType];
        
        if (task.displayMode === 'shifts') {
            shiftGroup.style.display = 'block';
            hoursGroup.style.display = 'none';
        } else if (task.displayMode === 'hours') {
            shiftGroup.style.display = 'none';
            hoursGroup.style.display = 'block';
            
            // הוספת מאזיני אירועים לאפשרויות שעתיות
            setupTimeIntervals();
        } else {
            shiftGroup.style.display = 'none';
            hoursGroup.style.display = 'none';
        }
    }

    // Setup time intervals
    function setupTimeIntervals() {
        // הסרת מאזיני אירועים קודמים
        const timeSlotCheckboxes = document.querySelectorAll('input[name="time-slot"]');
        timeSlotCheckboxes.forEach(checkbox => {
            checkbox.removeEventListener('change', handleTimeSlotChange);
            checkbox.addEventListener('change', handleTimeSlotChange);
        });
        
        // מאזיני אירועים לאפשרויות חיתוך
        const intervalRadios = document.querySelectorAll('input[name="hour-interval"]');
        intervalRadios.forEach(radio => {
            radio.removeEventListener('change', handleIntervalChange);
            radio.addEventListener('change', handleIntervalChange);
        });
    }

    // Handle time slot change
    function handleTimeSlotChange(event) {
        // Uncheck all other checkboxes in all time slot groups
        document.querySelectorAll('input[name="time-slot"]').forEach(checkbox => {
            if (checkbox !== event.target) {
                checkbox.checked = false;
            }
        });
        
        if (event.target.checked) {
            const timeRange = event.target.value.split('-');
            document.getElementById('start-time').value = timeRange[0];
            document.getElementById('end-time').value = timeRange[1];
        }
    }

    // Handle interval change
    function handleIntervalChange(event) {
        const hours = event.target.value;
        showTimeSlotsByInterval(hours);
    }

    // Show time slots by interval
    function showTimeSlotsByInterval(hours) {
        // הסתרת כל קבוצות תיבות הסימון
        document.querySelectorAll('.time-slots').forEach(container => {
            container.style.display = 'none';
        });
        
        // הצגת קבוצת תיבות הסימון המתאימה
        const timeSlots = document.querySelector(`.time-slots-${hours}h`);
        if (timeSlots) {
            timeSlots.style.display = 'grid';
        }
    }

    // Immediately set initial display states
    document.addEventListener('DOMContentLoaded', () => {
        const timeSlots2h = document.querySelector('.time-slots-2h');
        const timeSlots4h = document.querySelector('.time-slots-4h');
        const timeSlots8h = document.querySelector('.time-slots-8h');
        
        if (timeSlots2h && timeSlots4h && timeSlots8h) {
            timeSlots2h.style.display = 'none';
            timeSlots4h.style.display = 'none';
            timeSlots8h.style.display = 'none';
        }
    });

    // Show modal
    function showModal(modal) {
        modal.style.display = 'block';
    }
    
    // Hide modal
    function hideModal(modal) {
        modal.style.display = 'none';
    }

    // Navigate to previous period
    function navigatePrev() {
        // תמיד בתצוגה יומית - עבור ליום הקודם
        currentDate.setDate(currentDate.getDate() - 1);
        updateView();
    }

    // Navigate to next period
    function navigateNext() {
        // תמיד בתצוגה יומית - עבור ליום הבא
        currentDate.setDate(currentDate.getDate() + 1);
        updateView();
    }

    // Navigate to today
    function navigateToday() {
        console.log('Navigating to today');
        
        // Set current date to today
        currentDate = new Date();
        
        // Update view
        updateView();
    }

    // Update view
    async function updateView() {
        // Update calendar title
        updateCalendarTitle();
        
        // Load assignments for the current view
        await loadAssignments();
        
        // Load Jewish holidays
        await loadHolidays();
        
        // Render day view only
        renderDayView();
    }

    // Update calendar title
    function updateCalendarTitle() {
        // תמיד בתצוגה יומית
        document.getElementById('calendar-title').textContent = formatDate(currentDate);
    }

    // Load assignments for the current view
    async function loadAssignments() {
        try {
            // Always load assignments for the current day only, regardless of view
            const startDate = new Date(currentDate);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(currentDate);
            endDate.setHours(23, 59, 59, 999);
            
            // Format dates for Firestore
            const startDateStr = normalizeDateString(startDate);
            const endDateStr = normalizeDateString(endDate);
            
            console.log(`DEBUG: Loading assignments for today only: ${startDateStr}`);
            console.log('DEBUG: Start date object:', startDate);
            console.log('DEBUG: End date object:', endDate);
            
            // Load assignments from Firebase
            console.log('DEBUG: Calling Firebase getAssignmentsForDateRange...');
            assignments = await window.firebaseService.getAssignmentsForDateRange(startDateStr, endDateStr);
            
            console.log('DEBUG: Got assignments from Firebase, count:', assignments.length);
            if (assignments.length > 0) {
                console.log('DEBUG: Sample assignment from Firebase:', 
                            JSON.stringify(assignments[0], null, 2));
            }
            
            // Normalize assignment dates - חשוב ביותר!
            assignments = assignments.map(assignment => {
                console.log(`DEBUG: Normalizing date for assignment ${assignment.id}, before:`, assignment.date);
                const normalizedDate = normalizeDateString(assignment.date);
                console.log('DEBUG: After normalization:', normalizedDate);
                
                if (!assignment.id) {
                    console.error('WARNING: Assignment missing ID:', assignment);
                }
                
                return {
                    ...assignment,
                    date: normalizedDate
                };
            });
            
            // Debug check for IDs
            assignments.forEach(assignment => {
                if (!assignment.id) {
                    console.error('WARNING: Assignment missing ID after normalization:', assignment);
                }
            });
            
            console.log(`Loaded ${assignments.length} assignments from Firebase`);
            
            // Debug: log all assignments
            if (assignments.length > 0) {
                console.log('Assignments:', assignments);
            } else {
                console.log('No assignments found for the selected period');
                // מבטל את היצירה של משימות לדוגמה
                // createSampleAssignments(startDate, endDate);
            }
            
            // Apply filters
            assignments = assignments.filter(assignment => {
                // Filter by task type
                if (!activeFilters.taskTypes.includes(assignment.taskType)) {
                    return false;
                }
                
                // Filter by soldier
                if (activeFilters.soldierId && assignment.soldierId !== activeFilters.soldierId) {
                    return false;
                }
                
                return true;
            });
        } catch (error) {
            console.error('Error loading assignments:', error);
            console.error('Stack trace:', error.stack);
            // מבטל את היצירה של משימות לדוגמה
            // createSampleAssignments();
            
            // מציג התראה במקרה של שגיאה
            alert('שגיאה בטעינת המשימות: ' + error.message);
            assignments = [];
        }
    }
    
    // Helper function to create sample assignments for testing
    function createSampleAssignments(startDate, endDate) {
        if (!startDate) startDate = new Date();
        if (!endDate) {
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
        }
        
        console.log('*** יוצר שיבוצים לדוגמה לצורכי בדיקה בלבד - אלה אינם נשמרים בפיירבייס ***');
        console.log('*** To save real assignments, use the "Add Assignment" button ***');
        
        // Only add sample assignments if there are soldiers
        if (soldiers.length === 0) {
            console.log('No soldiers available for sample assignments');
            return;
        }
        
        // Create sample assignments for each day in the range
        const testDate = new Date(startDate);
        while (testDate <= endDate) {
            // Create a few assignments for this day
            const dateStr = normalizeDateString(testDate);
            console.log(`Creating sample assignments for date: ${dateStr}`);
            
            // Create a morning shift
            assignments.push({
                id: `sample-shag-morning-${dateStr}`, // הוספת "sample" למזהה להבהרה
                date: dateStr,
                taskType: 'shag',
                shiftType: 'morning',
                soldierId: soldiers[0].id,
                notes: 'דוגמה בלבד - לא נשמר בפיירבייס'
            });
            
            // Create an afternoon shift
            if (soldiers.length > 1) {
                assignments.push({
                    id: `sample-patrol-afternoon-${dateStr}`, // הוספת "sample" למזהה להבהרה
                    date: dateStr,
                    taskType: 'patrol',
                    shiftType: 'afternoon',
                    soldierId: soldiers[1].id,
                    notes: 'דוגמה בלבד - לא נשמר בפיירבייס'
                });
            }
            
            // Create a regular task
            if (soldiers.length > 2) {
                assignments.push({
                    id: `sample-commander-${dateStr}`, // הוספת "sample" למזהה להבהרה
                    date: dateStr,
                    taskType: 'commander',
                    soldierId: soldiers[2].id,
                    notes: 'דוגמה בלבד - לא נשמר בפיירבייס'
                });
            }
            
            // Move to next day
            testDate.setDate(testDate.getDate() + 1);
        }
        
        console.log(`Created ${assignments.length} sample assignments (NOT saved to Firebase)`);
    }

    // Render day view
    function renderDayView() {
        calendarContainer.innerHTML = '';
        
        const dayView = document.createElement('div');
        dayView.className = 'day-view';
        
        // Debug info
        console.log('Rendering day view for date:', formatDate(currentDate));
        
        // הסינון של המשימות ליום הנוכחי
        const currentDateString = normalizeDateString(currentDate);
        console.log('Current date string (normalized):', currentDateString);
        
        const dayAssignments = assignments.filter(assignment => {
            const assignmentDateNormalized = normalizeDateString(assignment.date);
            console.log("Comparing dates:", assignmentDateNormalized, currentDateString);
            return assignmentDateNormalized === currentDateString;
        });
        
        console.log('Assignments for this day:', dayAssignments.length);
        
        // Day header with export button
        const headerContainer = document.createElement('div');
        headerContainer.className = 'day-header-container';
        headerContainer.style.display = 'flex';
        headerContainer.style.justifyContent = 'space-between';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.marginBottom = '15px';
        
        // Day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.style.margin = '0';
        dayHeader.style.flex = '1';
        dayHeader.textContent = formatDate(currentDate);
        
        // Add holiday information if available
        const holidaysForToday = holidays.filter(holiday => {
            const holidayDate = new Date(holiday.date);
            return normalizeDateString(holidayDate) === currentDateString;
        });
        
        if (holidaysForToday.length > 0) {
            const holidayInfo = document.createElement('div');
            holidayInfo.className = 'holiday-info';
            holidayInfo.textContent = holidaysForToday.map(h => h.title).join(', ');
            dayHeader.appendChild(holidayInfo);
        }
        
        // Export button
        const exportButton = document.createElement('button');
        exportButton.className = 'btn export-btn';
        exportButton.innerHTML = '<i class="fas fa-camera"></i> צלם שבצ"ק';
        exportButton.style.marginRight = '10px';
        exportButton.addEventListener('click', () => {
            exportDayViewAsImage();
        });
        
        headerContainer.appendChild(dayHeader);
        headerContainer.appendChild(exportButton);
        
        dayView.appendChild(headerContainer);
        
        // Group assignments by task type
        const groupedAssignments = {};
        
        // Initialize all task types (even those without assignments)
        Object.keys(taskTypes).forEach(taskType => {
            groupedAssignments[taskType] = {
                taskType: taskType,
                soldiers: [],
                shifts: [],
                timeRanges: [],
                notes: [],
                originalAssignments: []
            };
        });
        
        // Add assignments to their respective groups
        dayAssignments.forEach(assignment => {
            const key = assignment.taskType;
            
            // Debug for IDs
            if (!assignment.id) {
                console.error('Assignment in dayAssignments missing ID:', assignment);
            }
            
            // Handle both old (soldierId) and new (soldierIds) formats
            if (assignment.soldierIds && Array.isArray(assignment.soldierIds)) {
                assignment.soldierIds.forEach(soldierId => {
                    const soldier = findSoldierById(soldierId);
                    if (soldier && !groupedAssignments[key].soldiers.some(s => s.id === soldier.id)) {
                        groupedAssignments[key].soldiers.push(soldier);
                    }
                });
            } else if (assignment.soldierId) {
                const soldier = findSoldierById(assignment.soldierId);
                if (soldier && !groupedAssignments[key].soldiers.some(s => s.id === soldier.id)) {
                    groupedAssignments[key].soldiers.push(soldier);
                }
            }
            
            // Add shift information if it exists and not already included
            if (assignment.shiftType) {
                const shiftInfo = `${shifts[assignment.shiftType].name} (${shifts[assignment.shiftType].timeRange})`;
                if (!groupedAssignments[key].shifts.includes(shiftInfo)) {
                    groupedAssignments[key].shifts.push(shiftInfo);
                }
            }
            
            // Add time range information if it exists and not already included
            if (assignment.startTime && assignment.endTime) {
                const timeRange = `${assignment.startTime}-${assignment.endTime}`;
                if (!groupedAssignments[key].timeRanges.includes(timeRange)) {
                    groupedAssignments[key].timeRanges.push(timeRange);
                }
            }
            
            // Add notes if they exist and are not already included
            if (assignment.notes && assignment.notes.trim() !== '') {
                if (!groupedAssignments[key].notes.includes(assignment.notes)) {
                    groupedAssignments[key].notes.push(assignment.notes);
                }
            }
            
            // Store original assignment for click handling
            groupedAssignments[key].originalAssignments.push(assignment);
        });
        
        // Sort task types alphabetically by display name
        const sortedGroups = Object.values(groupedAssignments).sort((a, b) => {
            const nameA = taskTypes[a.taskType].name;
            const nameB = taskTypes[b.taskType].name;
            return nameA.localeCompare(nameB);
        });
        
        // Create tasks list container with ID for export
        const tasksListContainer = document.createElement('div');
        tasksListContainer.className = 'tasks-list-container';
        tasksListContainer.id = 'tasks-container-for-export';
        
        // Render all task groups in horizontal layout
        sortedGroups.forEach(group => {
            // Skip tasks that are filtered out
            if (!activeFilters.taskTypes.includes(group.taskType)) {
                return;
            }
            
            const taskType = taskTypes[group.taskType];
            
            const taskItem = document.createElement('div');
            taskItem.className = 'day-task-item';
            
            // Task name header
            const taskHeader = document.createElement('div');
            taskHeader.className = 'day-task-header';
            taskHeader.textContent = taskType.name;
            taskHeader.style.backgroundColor = taskType.color;
            
            taskItem.appendChild(taskHeader);
            
            // Task assigned soldiers
            const assignedSoldiersContainer = document.createElement('div');
            assignedSoldiersContainer.className = 'assigned-soldiers-container';
            
            // Get all assignments for this task
            const taskAssignments = group.originalAssignments;
            
            if (taskAssignments.length > 0) {
                // Group assignments by shift or time range
                const groupedByTime = {};
                
                // Helper function to convert time string to minutes for sorting
                const timeToMinutes = (timeStr) => {
                    if (timeStr === "כללי") return Number.MAX_SAFE_INTEGER; // כללי תמיד בסוף
                    
                    // Check if this is a shift description format like "בוקר (06:00-14:00)"
                    const shiftMatch = timeStr.match(/\((\d{2}):(\d{2})-(\d{2}):(\d{2})\)/);
                    if (shiftMatch) {
                        const startHour = parseInt(shiftMatch[1]);
                        const startMinute = parseInt(shiftMatch[2]);
                        return startHour * 60 + startMinute;
                    }
                    
                    // Check if this is a time range format like "08:00-10:00"
                    const timeRangeMatch = timeStr.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
                    if (timeRangeMatch) {
                        const startHour = parseInt(timeRangeMatch[1]);
                        const startMinute = parseInt(timeRangeMatch[2]);
                        return startHour * 60 + startMinute;
                    }
                    
                    return Number.MAX_SAFE_INTEGER; // אם לא ברור, שים בסוף
                };
                
                // Group by shifts first
                group.shifts.forEach(shift => {
                    groupedByTime[shift] = [];
                });
                
                // Then add time ranges
                group.timeRanges.forEach(timeRange => {
                    groupedByTime[timeRange] = [];
                });
                
                // If no specific time, use "כללי" (general)
                if (Object.keys(groupedByTime).length === 0) {
                    groupedByTime["כללי"] = [];
                }
                
                // Add soldiers to their respective time groups
                taskAssignments.forEach(assignment => {
                    let timeKey = "כללי";
                    
                    if (assignment.shiftType) {
                        timeKey = `${shifts[assignment.shiftType].name} (${shifts[assignment.shiftType].timeRange})`;
                    } else if (assignment.startTime && assignment.endTime) {
                        timeKey = `${assignment.startTime}-${assignment.endTime}`;
                    }
                    
                    // Find assigned soldiers for this assignment
                    if (assignment.soldierIds && Array.isArray(assignment.soldierIds)) {
                        assignment.soldierIds.forEach(soldierId => {
                            const soldier = findSoldierById(soldierId);
                            if (soldier) {
                                // Check if soldier already exists in this time group
                                const exists = groupedByTime[timeKey].some(s => s.id === soldier.id);
                                if (!exists) {
                                    groupedByTime[timeKey].push(soldier);
                                }
                            }
                        });
                    } else if (assignment.soldierId) {
                        const soldier = findSoldierById(assignment.soldierId);
                        if (soldier) {
                            // Check if soldier already exists in this time group
                            const exists = groupedByTime[timeKey].some(s => s.id === soldier.id);
                            if (!exists) {
                                groupedByTime[timeKey].push(soldier);
                            }
                        }
                    }
                });
                
                // Sort the time keys from earliest to latest
                const sortedTimeKeys = Object.keys(groupedByTime).sort((a, b) => {
                    return timeToMinutes(a) - timeToMinutes(b);
                });
                
                // Render each time group in sorted order
                sortedTimeKeys.forEach(timeKey => {
                    const soldiers = groupedByTime[timeKey];
                    
                    if (soldiers.length > 0) {
                        const timeGroup = document.createElement('div');
                        timeGroup.className = 'time-group';
                        
                        // Time header
                        const timeHeader = document.createElement('div');
                        timeHeader.className = 'time-header';
                        timeHeader.textContent = timeKey;
                        timeGroup.appendChild(timeHeader);
                        
                        // Soldiers in this time group
                        const soldierList = document.createElement('div');
                        soldierList.className = 'soldier-list';
                        
                        // Add all soldiers in this time group individually with department styling
                        soldiers.forEach((soldier, index) => {
                            const soldierSpan = document.createElement('span');
                            soldierSpan.textContent = soldier.name;
                            
                            // Apply department styling if soldier has a department
                            if (soldier.department) {
                                const deptClass = getSoldierDepartmentClass(soldier);
                                if (deptClass) {
                                    soldierSpan.className = deptClass;
                                }
                            }
                            
                            soldierList.appendChild(soldierSpan);
                            
                            // Add comma separator if not the last soldier
                            if (index < soldiers.length - 1) {
                                soldierList.appendChild(document.createTextNode(', '));
                            }
                        });
                        
                        timeGroup.appendChild(soldierList);
                        
                        // Make the whole time group clickable to edit assignments
                        timeGroup.addEventListener('click', () => {
                            // Find any assignment that matches this time group
                            let matchingAssignment = null;
                            for (const assignment of taskAssignments) {
                                let assignmentTimeKey = "כללי";
                                if (assignment.shiftType) {
                                    assignmentTimeKey = `${shifts[assignment.shiftType].name} (${shifts[assignment.shiftType].timeRange})`;
                                } else if (assignment.startTime && assignment.endTime) {
                                    assignmentTimeKey = `${assignment.startTime}-${assignment.endTime}`;
                                }
                                
                                if (assignmentTimeKey === timeKey) {
                                    matchingAssignment = assignment;
                                    break;
                                }
                            }
                            
                            if (matchingAssignment) {
                                // Make sure assignment has an ID before showing the modal
                                if (!matchingAssignment.id) {
                                    console.error('Assignment is missing ID:', matchingAssignment);
                                    alert('שגיאה: המשימה חסרה מזהה. לא ניתן לערוך.');
                                    return;
                                }
                                console.log('Editing assignment with ID:', matchingAssignment.id);
                                showAssignmentModal(currentDate, matchingAssignment);
                            }
                        });
                        
                        assignedSoldiersContainer.appendChild(timeGroup);
                    }
                });
                
            } else {
                // No assigned soldiers
                const noSoldiersMsg = document.createElement('div');
                noSoldiersMsg.className = 'no-soldiers-msg';
                noSoldiersMsg.textContent = 'לא שובצו לוחמים למשימה זאת';
                assignedSoldiersContainer.appendChild(noSoldiersMsg);
            }
            
            taskItem.appendChild(assignedSoldiersContainer);
            
            // Add a button to add a new assignment for this task type
            const addTaskAssignmentBtn = document.createElement('button');
            addTaskAssignmentBtn.className = 'btn secondary-btn add-task-assignment-btn';
            addTaskAssignmentBtn.innerHTML = '<i class="fas fa-plus"></i> הוסף שיבוץ';
            addTaskAssignmentBtn.addEventListener('click', () => {
                const newAssignment = { taskType: group.taskType };
                showAssignmentModal(currentDate, newAssignment);
            });
            
            taskItem.appendChild(addTaskAssignmentBtn);
            tasksListContainer.appendChild(taskItem);
        });
        
        dayView.appendChild(tasksListContainer);
        
        
        
        calendarContainer.appendChild(dayView);
    }
    
    // Export day view as image
    async function exportDayViewAsImage() {
        // הוספת הספרייה html2canvas אם היא לא קיימת
        if (typeof html2canvas === 'undefined') {
            console.log('Loading html2canvas library...');
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            document.head.appendChild(script);
            
            // המתן לטעינת הספרייה
            await new Promise((resolve) => {
                script.onload = resolve;
            });
        }
        
        try {
            // הצג הודעת טעינה
            const loadingMsg = document.createElement('div');
            loadingMsg.textContent = 'מייצר תמונה...';
            loadingMsg.style.position = 'fixed';
            loadingMsg.style.top = '50%';
            loadingMsg.style.left = '50%';
            loadingMsg.style.transform = 'translate(-50%, -50%)';
            loadingMsg.style.background = 'rgba(0,0,0,0.7)';
            loadingMsg.style.color = 'white';
            loadingMsg.style.padding = '20px';
            loadingMsg.style.borderRadius = '10px';
            loadingMsg.style.zIndex = '10000';
            document.body.appendChild(loadingMsg);
            
            // יצירת תמונה מהאלמנט
            const element = document.getElementById('tasks-container-for-export');
            const canvas = await html2canvas(element, {
                backgroundColor: '#f9f9f9',
                scale: 2, // איכות תמונה טובה יותר
                useCORS: true,
                logging: false
            });
            
            // הסתר הודעת טעינה
            document.body.removeChild(loadingMsg);
            
            // המרה ל-URL של תמונה
            const imageData = canvas.toDataURL('image/png');
            
            // יצירת אלמנט a לשמירת התמונה
            const downloadLink = document.createElement('a');
            downloadLink.href = imageData;
            downloadLink.download = `שבצק-${formatDate(currentDate).replace(/\//g, '-')}.png`;
            
            // הוספת האלמנט והלחיצה עליו
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
        } catch (error) {
            console.error('Error creating image:', error);
            alert('שגיאה בייצוא התמונה: ' + error.message);
        }
    }

    // Helper function to find soldier by ID
    function findSoldierById(soldierId) {
        if (!soldierId) return null;
        
        // Check in the soldiers array
        const soldier = soldiers.find(s => s.id === soldierId);
        if (soldier) return soldier;
        
        // If soldier not found, return a placeholder
        console.warn(`Soldier with ID ${soldierId} not found`);
        return { name: 'חייל לא ידוע' };
    }

    // Show offline indicator
    function showOfflineIndicator() {
        const offlineBadge = document.createElement('div');
        offlineBadge.className = 'offline-badge';
        offlineBadge.id = 'offline-badge';
        offlineBadge.textContent = 'מצב לא מקוון';
        document.body.appendChild(offlineBadge);
    }

    // Hide offline indicator
    function hideOfflineIndicator() {
        const offlineBadge = document.getElementById('offline-badge');
        if (offlineBadge) {
            offlineBadge.remove();
        }
    }

    // Helper functions
    function formatDate(date) {
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return date.toLocaleDateString('he-IL', options);
    }

    function formatDateForFirestore(date) {
        return date.toISOString().split('T')[0];
    }

    function isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    // Load task settings from localStorage
    function loadTaskSettings() {
        try {
            const savedSettings = localStorage.getItem('taskSettings');
            
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                // Apply saved settings to the task types
                if (settings.taskTypes) {
                    // Update color inputs and CSS variables
                    if (settings.taskTypes.shag) {
                        const shagColorInput = document.getElementById('shag-color');
                        if (shagColorInput) {
                            shagColorInput.value = settings.taskTypes.shag.color;
                        }
                        document.documentElement.style.setProperty('--shag-color', settings.taskTypes.shag.color);
                        taskTypes.shag.color = settings.taskTypes.shag.color;
                        
                        // עדכון מצב הסימון לפי הערך השמור
                        const shagDisplayMode = settings.taskTypes.shag.displayMode;
                        const shagDisplayInput = document.querySelector(`input[name="shag-display"][value="${shagDisplayMode}"]`);
                        if (shagDisplayInput) {
                            shagDisplayInput.checked = true;
                        }
                        taskTypes.shag.displayMode = shagDisplayMode;
                    }
                    
                    if (settings.taskTypes.patrol) {
                        const patrolColorInput = document.getElementById('patrol-color');
                        if (patrolColorInput) {
                            patrolColorInput.value = settings.taskTypes.patrol.color;
                        }
                        document.documentElement.style.setProperty('--patrol-color', settings.taskTypes.patrol.color);
                        taskTypes.patrol.color = settings.taskTypes.patrol.color;
                        
                        // עדכון מצב הסימון לפי הערך השמור
                        const patrolDisplayMode = settings.taskTypes.patrol.displayMode;
                        const patrolDisplayInput = document.querySelector(`input[name="patrol-display"][value="${patrolDisplayMode}"]`);
                        if (patrolDisplayInput) {
                            patrolDisplayInput.checked = true;
                        }
                        taskTypes.patrol.displayMode = patrolDisplayMode;
                    }
                    
                    if (settings.taskTypes.carmelA) {
                        const carmelAColorInput = document.getElementById('carmelA-color');
                        if (carmelAColorInput) {
                            carmelAColorInput.value = settings.taskTypes.carmelA.color;
                        }
                        document.documentElement.style.setProperty('--carmelA-color', settings.taskTypes.carmelA.color);
                        taskTypes.carmelA.color = settings.taskTypes.carmelA.color;
                        
                        // עדכון מצב הסימון לפי הערך השמור
                        const carmelADisplayMode = settings.taskTypes.carmelA.displayMode;
                        const carmelADisplayInput = document.querySelector(`input[name="carmelA-display"][value="${carmelADisplayMode}"]`);
                        if (carmelADisplayInput) {
                            carmelADisplayInput.checked = true;
                        }
                        taskTypes.carmelA.displayMode = carmelADisplayMode;
                    }
                    
                    if (settings.taskTypes.carmelB) {
                        const carmelBColorInput = document.getElementById('carmelB-color');
                        if (carmelBColorInput) {
                            carmelBColorInput.value = settings.taskTypes.carmelB.color;
                        }
                        document.documentElement.style.setProperty('--carmelB-color', settings.taskTypes.carmelB.color);
                        taskTypes.carmelB.color = settings.taskTypes.carmelB.color;
                        
                        // עדכון מצב הסימון לפי הערך השמור
                        const carmelBDisplayMode = settings.taskTypes.carmelB.displayMode;
                        const carmelBDisplayInput = document.querySelector(`input[name="carmelB-display"][value="${carmelBDisplayMode}"]`);
                        if (carmelBDisplayInput) {
                            carmelBDisplayInput.checked = true;
                        }
                        taskTypes.carmelB.displayMode = carmelBDisplayMode;
                    }
                    
                    if (settings.taskTypes.shaz) {
                        const shazColorInput = document.getElementById('shaz-color');
                        if (shazColorInput) {
                            shazColorInput.value = settings.taskTypes.shaz.color;
                        }
                        document.documentElement.style.setProperty('--shaz-color', settings.taskTypes.shaz.color);
                        taskTypes.shaz.color = settings.taskTypes.shaz.color;
                        
                        // עדכון מצב הסימון לפי הערך השמור
                        const shazDisplayMode = settings.taskTypes.shaz.displayMode;
                        const shazDisplayInput = document.querySelector(`input[name="shaz-display"][value="${shazDisplayMode}"]`);
                        if (shazDisplayInput) {
                            shazDisplayInput.checked = true;
                        }
                        taskTypes.shaz.displayMode = shazDisplayMode;
                    }
                    
                    if (settings.taskTypes.commander) {
                        const commanderColorInput = document.getElementById('commander-color');
                        if (commanderColorInput) {
                            commanderColorInput.value = settings.taskTypes.commander.color;
                        }
                        document.documentElement.style.setProperty('--commander-color', settings.taskTypes.commander.color);
                        taskTypes.commander.color = settings.taskTypes.commander.color;
                        
                        // עדכון מצב הסימון לפי הערך השמור
                        const commanderDisplayMode = settings.taskTypes.commander.displayMode;
                        const commanderDisplayInput = document.querySelector(`input[name="commander-display"][value="${commanderDisplayMode}"]`);
                        if (commanderDisplayInput) {
                            commanderDisplayInput.checked = true;
                        }
                        taskTypes.commander.displayMode = commanderDisplayMode;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading task settings:', error);
        }
    }

    // Load Jewish holidays
    async function loadHolidays() {
        try {
            // Get the date range for holidays - always use day view
            const startDate = new Date(currentDate);
            const endDate = new Date(currentDate);
            
            // Format date range for API
            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth() + 1;
            const endYear = endDate.getFullYear();
            const endMonth = endDate.getMonth() + 1;
            
            // Load holidays from Hebcal API
            const apiUrl = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${startYear}&month=${startMonth}&i=off&maj=on`;
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (data && data.items) {
                holidays = data.items.filter(item => item.category === 'holiday');
            }
        } catch (error) {
            console.error('Error loading holidays:', error);
            holidays = [];
        }
    }

    // פונקציית עזר להמרת תאריכים לפורמט אחיד (לטיפול בבעיית השוואת תאריכים)
    function normalizeDateString(dateStr) {
        if (!dateStr) return '';
        
        // אם זה כבר string בפורמט YYYY-MM-DD, נחזיר אותו כמו שהוא
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        
        // אם זה אובייקט Date, נמיר אותו למחרוזת YYYY-MM-DD
        if (dateStr instanceof Date) {
            // במקום toISOString שעובר ל-UTC, נשתמש בגישה ישירה לשנה, חודש ויום
            const year = dateStr.getFullYear();
            const month = String(dateStr.getMonth() + 1).padStart(2, '0'); // חודשים מתחילים מ-0
            const day = String(dateStr.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // אם זה string בפורמט אחר, ננסה להמיר אותו ל-Date ואז למחרוזת YYYY-MM-DD
        try {
            const date = new Date(dateStr);
            // שימוש באותה שיטה כמו למעלה במקום toISOString
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('Error normalizing date string:', error, dateStr);
            return '';
        }
    }

    // פונקציה ליצירת דוגמאות אמיתיות בפיירבייס
    async function createRealTestAssignments() {
        if (!confirm('האם אתה בטוח שברצונך ליצור שיבוצים אמיתיים לבדיקה? הם יישמרו בפיירבייס.')) {
            return;
        }
        
        console.log('Creating real test assignments in Firebase');
        
        try {
            // וודא שיש חיילים
            if (soldiers.length === 0) {
                alert('אין חיילים זמינים ליצירת שיבוצים. נא להוסיף חיילים קודם.');
                return;
            }
            
            // יצירת טווח תאריכים - מהיום עד שבוע קדימה
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 7);
            
            console.log('DEBUG: Creating test assignments from', 
                        normalizeDateString(startDate), 'to', 
                        normalizeDateString(endDate));
            console.log('DEBUG: Using soldiers:', soldiers.map(s => `${s.id}: ${s.name}`));
            
            // ספירת שיבוצים שנוצרו
            let assignmentsCreated = 0;
            
            // יצירת שיבוצים לכל יום בטווח
            const testDate = new Date(startDate);
            while (testDate <= endDate) {
                const dateStr = normalizeDateString(testDate);
                console.log(`Creating real test assignments for date: ${dateStr}`);
                
                // יצירת משמרת בוקר
                if (soldiers.length > 0) {
                    const morningData = {
                        date: dateStr,
                        taskType: 'shag',
                        shiftType: 'morning',
                        soldierId: soldiers[0].id,
                        notes: 'שיבוץ בדיקה אמיתי - משמרת בוקר'
                    };
                    console.log('DEBUG: Creating morning assignment:', JSON.stringify(morningData));
                    const morningId = await window.firebaseService.addAssignment(morningData);
                    console.log('DEBUG: Created with ID:', morningId);
                    assignmentsCreated++;
                }
                
                // יצירת משמרת צהריים
                if (soldiers.length > 1) {
                    const afternoonData = {
                        date: dateStr,
                        taskType: 'patrol',
                        shiftType: 'afternoon',
                        soldierId: soldiers[1].id,
                        notes: 'שיבוץ בדיקה אמיתי - משמרת צהריים'
                    };
                    console.log('DEBUG: Creating afternoon assignment:', JSON.stringify(afternoonData));
                    const afternoonId = await window.firebaseService.addAssignment(afternoonData);
                    console.log('DEBUG: Created with ID:', afternoonId);
                    assignmentsCreated++;
                }
                
                // יצירת משימה רגילה
                if (soldiers.length > 2) {
                    const regularData = {
                        date: dateStr,
                        taskType: 'commander',
                        soldierId: soldiers[2].id,
                        notes: 'שיבוץ בדיקה אמיתי - משימה רגילה'
                    };
                    console.log('DEBUG: Creating regular assignment:', JSON.stringify(regularData));
                    const regularId = await window.firebaseService.addAssignment(regularData);
                    console.log('DEBUG: Created with ID:', regularId);
                    assignmentsCreated++;
                }
                
                // מעבר ליום הבא
                testDate.setDate(testDate.getDate() + 1);
            }
            
            console.log(`Created ${assignmentsCreated} real test assignments in Firebase`);
            alert(`נוצרו ${assignmentsCreated} שיבוצים אמיתיים בפיירבייס לצורכי בדיקה`);
            
            // רענון התצוגה
            await updateView();
        } catch (error) {
            console.error('Error creating test assignments:', error);
            console.error('Stack trace:', error.stack);
            alert('שגיאה ביצירת שיבוצי בדיקה: ' + error.message);
        }
    }

    // Generate a unique ID for new assignments
    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Update the selected soldiers list
    function updateSelectedSoldiersList() {
        const selectedOptions = Array.from(soldierSelect.selectedOptions);
        
        console.log('Updating selected soldiers list:', selectedOptions.length, 'selected soldiers');
        
        if (selectedOptions.length === 0) {
            selectedSoldiersList.innerHTML = '<div class="no-selection">לא נבחרו חיילים</div>';
            return;
        }
        
        selectedSoldiersList.innerHTML = '';
        
        selectedOptions.forEach(option => {
            const chip = document.createElement('div');
            chip.className = 'soldier-chip';
            
            // הוספת מחלקה כמחלקה לצ'יפ (אם קיימת)
            if (option.dataset.department) {
                let deptClass = '';
                const dept = option.dataset.department.toString();
                
                if (['1', '2', '3'].includes(dept)) {
                    deptClass = 'dept-' + dept;
                } else if (dept === 'chamal' || dept === 'hamal') {
                    deptClass = 'chamal';
                } else if (dept === 'maflag') {
                    deptClass = 'maflag';
                } else if (dept === 'unit1') {
                    deptClass = 'dept-1';
                } else if (dept === 'unit2') {
                    deptClass = 'dept-2';
                } else if (dept === 'unit3') {
                    deptClass = 'dept-3';
                }
                
                if (deptClass) {
                    chip.classList.add(deptClass);
                    console.log('Added class to chip:', deptClass);
                }
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = option.text;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-soldier-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                option.selected = false;
                updateSelectedSoldiersList();
            });
            
            chip.appendChild(nameSpan);
            chip.appendChild(removeBtn);
            selectedSoldiersList.appendChild(chip);
        });
        
        // וידוא שהרשימה מוצגת בצורה נכונה
        console.log('Updated soldiers list. Is visible:', 
            getComputedStyle(selectedSoldiersList).display !== 'none', 
            'Parent visible:', getComputedStyle(selectedSoldiersList.parentElement).display !== 'none');
    }
    
    // Populate the soldiers table with all soldiers
    function populateSoldiersTable() {
        const tableBody = document.getElementById('soldiers-table-body');
        const searchInput = document.getElementById('soldiers-search-input');
        const departmentFilter = document.getElementById('soldiers-department-filter');
        
        // Clear the table first
        tableBody.innerHTML = '';
        
        // Function to filter soldiers based on search and department
        function filterSoldiers() {
            const searchTerm = searchInput.value.toLowerCase();
            const departmentValue = departmentFilter.value;
            
            tableBody.innerHTML = '';
            
            // Map for translating department keys to display names
            const departmentNames = {
                'maflag': 'מפל"ג',
                'hamal': 'חמ"ל',
                'unit1': 'מחלקה 1',
                'unit2': 'מחלקה 2',
                'unit3': 'מחלקה 3'
            };
            
            // Map for translating tag keys to display names
            const tagLabels = {
                'officer': 'קצין',
                'sergeant': 'מ"כ',
                'corporal': 'סמל',
                'warrior': 'לוחם',
                'medic': 'חובש',
                'engineer': 'מהנדס',
                'driver': 'נהג',
                'comm': 'קשר'
            };
            
            soldiers
                .filter(soldier => {
                    // Filter by department if selected
                    if (departmentValue && soldier.department !== departmentValue) {
                        return false;
                    }
                    
                    // Filter by search term
                    if (searchTerm) {
                        const nameMatch = soldier.name && soldier.name.toLowerCase().includes(searchTerm);
                        const idMatch = soldier.idNumber && soldier.idNumber.toLowerCase().includes(searchTerm);
                        return nameMatch || idMatch;
                    }
                    
                    return true;
                })
                .forEach(soldier => {
                    const row = document.createElement('tr');
                    
                    // Name cell
                    const nameCell = document.createElement('td');
                    nameCell.textContent = soldier.name || '';
                    row.appendChild(nameCell);
                    
                    // ID number cell
                    const idNumberCell = document.createElement('td');
                    idNumberCell.textContent = soldier.idNumber || '';
                    row.appendChild(idNumberCell);
                    
                    // Phone cell
                    const phoneCell = document.createElement('td');
                    phoneCell.textContent = soldier.phone || '';
                    row.appendChild(phoneCell);
                    
                    // Department cell
                    const departmentCell = document.createElement('td');
                    departmentCell.textContent = soldier.department ? (departmentNames[soldier.department] || soldier.department) : '';
                    row.appendChild(departmentCell);
                    
                    // Tags cell
                    const tagsCell = document.createElement('td');
                    const tagsList = document.createElement('div');
                    tagsList.className = 'tag-list';
                    
                    if (soldier.tags && Array.isArray(soldier.tags)) {
                        soldier.tags.forEach(tag => {
                            const tagElement = document.createElement('span');
                            tagElement.className = 'tag';
                            tagElement.textContent = tagLabels[tag] || tag;
                            tagsList.appendChild(tagElement);
                        });
                    }
                    
                    tagsCell.appendChild(tagsList);
                    row.appendChild(tagsCell);
                    
                    // Actions cell
                    const actionsCell = document.createElement('td');
                    actionsCell.className = 'actions';
                    
                    const editBtn = document.createElement('button');
                    editBtn.className = 'action-btn edit';
                    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                    editBtn.addEventListener('click', () => {
                        editSoldier(soldier);
                    });
                    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'action-btn delete';
                    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    deleteBtn.addEventListener('click', async () => {
                        if (confirm(`האם אתה בטוח שברצונך למחוק את החייל ${soldier.name}?`)) {
                            document.getElementById('soldier-id').value = soldier.id;
                            await handleDeleteSoldier();
                            filterSoldiers(); // Refresh the table
                        }
                    });
                    
                    actionsCell.appendChild(editBtn);
                    actionsCell.appendChild(deleteBtn);
                    row.appendChild(actionsCell);
                    
                    tableBody.appendChild(row);
                });
                
            // Display a message if no soldiers found
            if (tableBody.children.length === 0) {
                const emptyRow = document.createElement('tr');
                const emptyCell = document.createElement('td');
                emptyCell.colSpan = 6;
                emptyCell.textContent = 'לא נמצאו חיילים';
                emptyCell.style.textAlign = 'center';
                emptyCell.style.padding = '20px';
                emptyRow.appendChild(emptyCell);
                tableBody.appendChild(emptyRow);
            }
        }
        
        // Initial population
        filterSoldiers();
        
        // Add event listeners for search and filter
        searchInput.addEventListener('input', filterSoldiers);
        departmentFilter.addEventListener('change', filterSoldiers);
    }

    // Helper to get department CSS class for a soldier
    function getSoldierDepartmentClass(soldier) {
        if (!soldier || !soldier.department) return '';
        
        let deptClass = '';
        const dept = soldier.department.toString();
        
        if (['1', '2', '3'].includes(dept)) {
            deptClass = 'soldier-dept-' + dept;
        } else if (dept === 'chamal' || dept === 'hamal') {
            deptClass = 'soldier-chamal';
        } else if (dept === 'maflag') {
            deptClass = 'soldier-maflag';
        } else if (dept === 'unit1') {
            deptClass = 'soldier-dept-1';
        } else if (dept === 'unit2') {
            deptClass = 'soldier-dept-2';
        } else if (dept === 'unit3') {
            deptClass = 'soldier-dept-3';
        }
        
        console.log('getSoldierDepartmentClass', soldier.department, '→', deptClass);
        return deptClass;
    }
});
