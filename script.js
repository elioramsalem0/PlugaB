// Firebase Configuration
const config = {
    apiKey: "AIzaSyDAktpDrlseX7iAVUg0sDrZNLjbu37U6QA",
    authDomain: "plugab-10731.firebaseapp.com",
    databaseURL: "https://plugab-10731-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "plugab-10731",
    storageBucket: "plugab-10731.appId",
    messagingSenderId: "812896087311",
    appId: "1:812896087311:web:312963fa112f947400227a"
};

// Core Application State
const app = {
    state: {
        isLoggedIn: false,
        reports: {},
        user: null
    },
    
    // Firebase Initialization
    init() {
        firebase.initializeApp(config);
        this.db = firebase.database();
        this.auth = firebase.auth();
        this.setupAuthListener();
    },
    
    // Authentication Listener
    setupAuthListener() {
        this.auth.onAuthStateChanged(user => {
            this.state.isLoggedIn = !!user;
            this.state.user = user;
            
            // Toggle UI Visibility
            const loginContainer = document.getElementById('login-container');
            const mainContainer = document.getElementById('main-container');
            
            if (user) {
                loginContainer.style.display = 'none';
                mainContainer.style.display = 'block';
                this.loadUserProfile(user);
            } else {
                loginContainer.style.display = 'block';
                mainContainer.style.display = 'none';
            }
        });
    },
    
    // Load User Profile
    loadUserProfile(user) {
        this.db.ref(`users/${user.uid}`).once('value')
            .then(snapshot => {
                const userData = snapshot.val() || {};
                const fullName = userData.firstName && userData.lastName 
                    ? `${userData.firstName} ${userData.lastName}` 
                    : user.email;
                
                document.getElementById('user-fullname').textContent = fullName;
            })
            .catch(console.error);
    },
    
    // Authentication Methods
    auth: {
        login(email, password) {
            return firebase.auth().signInWithEmailAndPassword(email, password);
        },
        
        register(email, password, firstName, lastName, accessCode) {
            // Validate access code
            if (accessCode !== 'plugab2025') {
                throw new Error('קוד גישה שגוי');
            }
            
            return firebase.auth().createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const userId = userCredential.user.uid;
                    return firebase.database().ref(`users/${userId}`).set({
                        firstName,
                        lastName,
                        email
                    });
                });
        },
        
        logout() {
            return firebase.auth().signOut();
        },
        
        resetPassword(email) {
            return firebase.auth().sendPasswordResetEmail(email);
        }
    },
    
    // Soldiers Data
    soldiers: {
        "מחלקה 1": ["אביב לוי", "אבנר לוי", "איגור חביבובלין", "אמיר בלוך", "אסף אופיר", "הלל בנאמו", "חביב דדון", "לוי יצחק דובאוו", "לירון פוריאן", "פבל אבירם", "עדן מור"],
        "מחלקה 2": ["אליהו ברקלי", "אוהד מאיר", "אלכסנדר ליטבין", "אסיף יו סבאג", "ג'קי מוקמל", "דביר יעקב", "דניאל זוקובסקי", "חן בן צבי", "ערן יופה", "רפאל אביטבול", "תומר צביון", "עליסיה טרשצנקו"],
        "מחלקה 3": ["דניאל יונתן", "אביבה קללאו", "אופיר מזרחי", "איתי מלטבשי", "דקל חן", "ולדיסלב שבצ'נקו", "ליז קוקישווילי", "מאור גבאי", "נועם גזית", "עידן מלול", "רקפת זיו", "שיר דקלו"],
        "מפלג": ["אלי מור", "אליאור אמסלם", "ג'סי שלו", "הגר שוקר", "מיקי ביתן", "עומר אנטמן", "עמית שחר", "רועי דנינו", "רן בן טוב", "שקד קסלר"]
    },
    
    // Render Soldiers List
    renderSoldiers(unit) {
        const soldiersDiv = document.getElementById("soldiers");
        soldiersDiv.innerHTML = '';
        
        if (!unit) return;
        
        this.soldiers[unit].sort().forEach(soldier => {
            const soldierEl = document.createElement('div');
            soldierEl.innerHTML = `
                <label>
                    <input type="checkbox" value="${soldier}">
                    ${soldier}
                    <select>
                        <option value="">סטטוס</option>
                        <option value="בית">בית</option>
                        <option value="גמ״ל">גמ״ל</option>
                        <option value="אחר">אחר</option>
                    </select>
                </label>
            `;
            soldiersDiv.appendChild(soldierEl);
        });
    },
    
    // Submit Attendance Report
    submitReport() {
        const unit = document.getElementById('unit').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        
        const absentSoldiers = Array.from(
            document.querySelectorAll('#soldiers input[type="checkbox"]:checked')
        ).map(checkbox => {
            const label = checkbox.closest('label');
            const status = label.querySelector('select').value;
            return {
                name: checkbox.value,
                status: status
            };
        });
        
        const reportId = `${date}_${time}_${unit}`.replace(/[\s:]/g, '_');
        
        const reportData = {
            date,
            time,
            unit,
            absent: absentSoldiers,
            timestamp: new Date().toISOString(),
            createdBy: this.state.user.email
        };
        
        // Save to Firebase
        this.db.ref(`reports/${reportId}`).set(reportData)
            .then(() => {
                alert('דיווח נשלח בהצלחה');
                this.state.reports[reportId] = reportData;
                localStorage.setItem('reports', JSON.stringify(this.state.reports));
            })
            .catch(error => {
                console.error('שגיאה בשמירת דוח:', error);
                alert('שגיאה בשמירת הדוח');
            });
    },
    
    // Event Listeners
    bindEvents() {
        // Login Form
        document.getElementById('login-button').addEventListener('click', () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            this.auth.login(email, password).catch(error => {
                alert(error.message);
            });
        });
        
        // Register Form
        document.getElementById('register-button').addEventListener('click', () => {
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const firstName = document.getElementById('reg-firstname').value;
            const lastName = document.getElementById('reg-lastname').value;
            const accessCode = document.getElementById('reg-access-code').value;
            
            this.auth.register(email, password, firstName, lastName, accessCode)
                .then(() => alert('נרשמת בהצלחה'))
                .catch(error => alert(error.message));
        });
        
        // Unit Selection
        document.getElementById('unit').addEventListener('change', (e) => {
            this.renderSoldiers(e.target.value);
        });
        
        // Submit Report
        document.getElementById('submit-report').addEventListener('click', () => {
            this.submitReport();
        });
    },
    
    // Initialize Application
    start() {
        this.init();
        this.bindEvents();
    }
};

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => app.start());