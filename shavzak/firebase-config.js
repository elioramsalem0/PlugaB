// Firebase configuration and initialization
const firebaseConfig = {
    apiKey: "AIzaSyDuGNrqg6A5Kp4d_qV_1Vyvts4RG_RXKVU",
    authDomain: "shavtzak-86489.firebaseapp.com",
    projectId: "shavtzak-86489",
    storageBucket: "shavtzak-86489.firebasestorage.app",
    messagingSenderId: "1026873064816",
    appId: "1:1026873064816:web:b9d3dc0249bf01a1a1a3b5",
    measurementId: "G-1F9MX5QR99"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time
            console.warn('Persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the features required for persistence
            console.warn('Persistence not supported in this browser');
        }
    });

// Collection references
const soldiersRef = db.collection('soldiers');
const assignmentsRef = db.collection('assignments');
const tasksRef = db.collection('tasks');
const templatesRef = db.collection('templates');

// Check auth state
let currentUser = null;
let isAdmin = false;

// Auth state change listener
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // Check if user is admin
        db.collection('admins').doc(user.uid).get()
            .then(doc => {
                isAdmin = doc.exists;
                if (isAdmin) {
                    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
                }
            })
            .catch(error => {
                console.error("Error checking admin status:", error);
            });
        
        // Update UI for logged in user
        document.getElementById('login-btn').innerHTML = '<i class="fas fa-sign-out-alt"></i>';
    } else {
        currentUser = null;
        isAdmin = false;
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        
        // Update UI for logged out user
        document.getElementById('login-btn').innerHTML = '<i class="fas fa-user"></i>';
    }
});

// Helper functions for Firebase operations

// Soldiers
async function getAllSoldiers() {
    try {
        const snapshot = await soldiersRef.orderBy('name').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting soldiers:", error);
        return [];
    }
}

async function addSoldier(soldierData) {
    try {
        const docRef = await soldiersRef.add({
            ...soldierData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding soldier:", error);
        throw error;
    }
}

async function updateSoldier(soldierId, soldierData) {
    try {
        await soldiersRef.doc(soldierId).update({
            ...soldierData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error updating soldier:", error);
        throw error;
    }
}

async function deleteSoldier(soldierId) {
    try {
        // First check if soldier has assignments
        const assignments = await assignmentsRef.where('soldierId', '==', soldierId).get();
        if (!assignments.empty) {
            throw new Error("Cannot delete soldier with existing assignments");
        }
        
        await soldiersRef.doc(soldierId).delete();
        return true;
    } catch (error) {
        console.error("Error deleting soldier:", error);
        throw error;
    }
}

// Assignments
async function getAssignmentsForDateRange(startDate, endDate) {
    try {
        // Convert string dates to Date objects for Firestore query
        let startDateObj = startDate;
        let endDateObj = endDate;
        
        if (typeof startDate === 'string') {
            startDateObj = new Date(startDate);
            console.log('Converted startDate string to Date object:', startDate, '->', startDateObj);
        }
        
        if (typeof endDate === 'string') {
            endDateObj = new Date(endDate);
            console.log('Converted endDate string to Date object:', endDate, '->', endDateObj);
        }
        
        console.log('Querying Firebase with date range:', startDateObj, 'to', endDateObj);
        
        const snapshot = await assignmentsRef
            .where('date', '>=', startDateObj)
            .where('date', '<=', endDateObj)
            .get();
        
        console.log(`Firebase query returned ${snapshot.docs.length} assignments`);
        
        // Convert Firebase date objects to ISO strings for consistent handling
        return snapshot.docs.map(doc => {
            const data = doc.data();
            // Convert Firebase Timestamp to ISO string if it exists
            if (data.date && typeof data.date.toDate === 'function') {
                data.date = data.date.toDate().toISOString().split('T')[0];
            } else if (data.date instanceof Date) {
                data.date = data.date.toISOString().split('T')[0];
            }
            return {
                id: doc.id,
                ...data
            };
        });
    } catch (error) {
        console.error("Error getting assignments:", error);
        console.error("Query parameters were:", { startDate, endDate });
        return [];
    }
}

async function getAssignmentsForSoldier(soldierId) {
    try {
        const snapshot = await assignmentsRef
            .where('soldierId', '==', soldierId)
            .orderBy('date')
            .get();
        
        // Convert Firebase date objects to ISO strings for consistent handling
        return snapshot.docs.map(doc => {
            const data = doc.data();
            // Convert Firebase Timestamp to ISO string if it exists
            if (data.date && typeof data.date.toDate === 'function') {
                data.date = data.date.toDate().toISOString().split('T')[0];
            } else if (data.date instanceof Date) {
                data.date = data.date.toISOString().split('T')[0];
            }
            return {
                id: doc.id,
                ...data
            };
        });
    } catch (error) {
        console.error("Error getting soldier assignments:", error);
        return [];
    }
}

async function addAssignment(assignmentData) {
    try {
        // Convert date string to Firestore timestamp if it's a string
        if (typeof assignmentData.date === 'string') {
            assignmentData.date = new Date(assignmentData.date);
        }
        
        // For backward compatibility - if there's a soldierId and no soldierIds
        if (assignmentData.soldierId && !assignmentData.soldierIds) {
            assignmentData.soldierIds = [assignmentData.soldierId];
            delete assignmentData.soldierId;
        }
        
        const docRef = await assignmentsRef.add({
            ...assignmentData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser ? currentUser.uid : 'anonymous'
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding assignment:", error);
        throw error;
    }
}

async function updateAssignment(assignmentId, assignmentData) {
    try {
        // Validate assignment ID
        if (!assignmentId || assignmentId === 'undefined' || assignmentId.trim() === '') {
            console.error("Invalid assignment ID:", assignmentId);
            throw new Error("Invalid assignment ID");
        }
        
        console.log("Updating assignment with ID:", assignmentId);
        
        // Convert date string to Firestore timestamp if it's a string
        if (typeof assignmentData.date === 'string') {
            assignmentData.date = new Date(assignmentData.date);
        }
        
        // For backward compatibility - if there's a soldierId and no soldierIds
        if (assignmentData.soldierId && !assignmentData.soldierIds) {
            assignmentData.soldierIds = [assignmentData.soldierId];
            delete assignmentData.soldierId;
        }
        
        await assignmentsRef.doc(assignmentId).update({
            ...assignmentData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser ? currentUser.uid : 'anonymous'
        });
        return true;
    } catch (error) {
        console.error("Error updating assignment:", error);
        throw error;
    }
}

async function deleteAssignment(assignmentId) {
    try {
        await assignmentsRef.doc(assignmentId).delete();
        return true;
    } catch (error) {
        console.error("Error deleting assignment:", error);
        throw error;
    }
}

// Templates
async function saveTemplate(name, assignments) {
    try {
        const templateData = {
            name,
            assignments,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser ? currentUser.uid : 'anonymous'
        };
        
        const docRef = await templatesRef.add(templateData);
        return docRef.id;
    } catch (error) {
        console.error("Error saving template:", error);
        throw error;
    }
}

async function getTemplates() {
    try {
        const snapshot = await templatesRef.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting templates:", error);
        return [];
    }
}

async function applyTemplate(templateId, targetDate) {
    try {
        const templateDoc = await templatesRef.doc(templateId).get();
        if (!templateDoc.exists) {
            throw new Error("Template not found");
        }
        
        const templateData = templateDoc.data();
        const assignments = templateData.assignments;
        
        // Calculate day offset from template to target date
        const targetDateObj = new Date(targetDate);
        
        // Batch write for better performance
        const batch = db.batch();
        
        assignments.forEach(assignment => {
            const assignmentDate = new Date(assignment.date);
            const daysDiff = Math.round((assignmentDate - assignments[0].date) / (24 * 60 * 60 * 1000));
            
            // Calculate new date
            const newDate = new Date(targetDateObj);
            newDate.setDate(targetDateObj.getDate() + daysDiff);
            
            // Create new assignment document
            const newAssignmentRef = assignmentsRef.doc();
            batch.set(newAssignmentRef, {
                ...assignment,
                date: newDate,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: currentUser ? currentUser.uid : 'anonymous'
            });
        });
        
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error applying template:", error);
        throw error;
    }
}

// Export Firebase services to global window object
window.firebaseService = {
    auth,
    db,
    getAllSoldiers,
    addSoldier,
    updateSoldier,
    deleteSoldier,
    getAssignmentsForDateRange,
    getAssignmentsForSoldier,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    saveTemplate,
    getTemplates,
    applyTemplate
};
