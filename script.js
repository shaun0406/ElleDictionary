import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase instances and user ID
let db;
let auth;
let currentUserId = null;
let isAuthReady = false;
let editingEntry = null; // To store the entry being edited

// DOM elements
const wordInput = document.getElementById('word');
const meaningInput = document.getElementById('meaning');
const addUpdateBtn = document.getElementById('addUpdateBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const dictionaryEntriesList = document.getElementById('dictionaryEntriesList');
const noEntriesMessage = document.getElementById('noEntriesMessage');
const userIdDisplay = document.getElementById('userIdDisplay');
const userIdValue = document.getElementById('userIdValue');

// Modal elements
const customModal = document.getElementById('customModal');
const modalMessage = document.getElementById('modalMessage');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
let confirmActionCallback = null;

// --- Custom Modal Functions ---
function showCustomModal(message, showConfirmButton = false, onConfirm = null) {
    modalMessage.textContent = message;
    if (showConfirmButton) {
        modalConfirmBtn.classList.remove('hidden');
        modalCloseBtn.textContent = 'Cancel';
        confirmActionCallback = onConfirm;
    } else {
        modalConfirmBtn.classList.add('hidden');
        modalCloseBtn.textContent = 'OK';
        confirmActionCallback = null;
    }
    customModal.classList.remove('hidden');
}

function hideCustomModal() {
    customModal.classList.add('hidden');
    modalMessage.textContent = '';
    modalConfirmBtn.classList.add('hidden');
    modalCloseBtn.textContent = 'OK';
    confirmActionCallback = null;
}

modalCloseBtn.addEventListener('click', hideCustomModal);
modalConfirmBtn.addEventListener('click', () => {
    if (confirmActionCallback) {
        confirmActionCallback();
    }
    hideCustomModal();
});

// --- Firebase Initialization and Authentication ---
async function initializeFirebase() {
    try {
        // Your web app's Firebase configuration (provided by the user)
        const firebaseConfig = {
            apiKey: "AIzaSyCaCTJe7SN5eM8zOLTZt4E8VR0nggz5aOI",
            authDomain: "edict-571bf.firebaseapp.com",
            projectId: "edict-571bf",
            storageBucket: "edict-571bf.firebasestorage.app",
            messagingSenderId: "462139852346",
            appId: "1:462139852346:web:cee6b6d00d6beac3f35703",
            measurementId: "G-GKWT6NC52T" // Measurement ID is optional and not used in this app's logic
        };

        // Use projectId for the collection path as it matches the {appId} in security rules
        const projectIdForCollection = firebaseConfig.projectId;
        const initialAuthToken = null; // This is for the Canvas environment, not needed for GitHub Pages deployment

        // Initialize Firebase app
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Listen for authentication state changes
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                // Sign in anonymously if no user is authenticated
                try {
                    // For GitHub Pages, you typically sign in anonymously here.
                    // The initialAuthToken is specific to the Canvas environment.
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Error signing in:", error);
                    showCustomModal(`Error signing in: ${error.message}`); // Keep this error message
                }
            }
            currentUserId = auth.currentUser?.uid || crypto.randomUUID(); // Set user ID
            userIdValue.textContent = currentUserId;
            userIdDisplay.classList.remove('hidden');
            isAuthReady = true; // Mark authentication as ready
            setupRealtimeListener(projectIdForCollection); // Pass projectId for collection
        });
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showCustomModal(`Error initializing Firebase: ${error.message}`); // Keep this error message
    }
}

// --- Real-time Data Listener ---
function setupRealtimeListener(projectIdForCollection) { // Accept projectId as a parameter
    if (db && currentUserId && isAuthReady) {
        // Use the actual projectId for the collection path
        const dictionaryCollectionRef = collection(db, `artifacts/${projectIdForCollection}/public/data/dictionary`);
        const q = query(dictionaryCollectionRef, orderBy('timestamp', 'desc'));

        onSnapshot(q, (snapshot) => {
            const entries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderDictionaryEntries(entries);
        }, (error) => {
            console.error("Error fetching dictionary entries:", error);
            showCustomModal(`Error fetching dictionary entries: ${error.message}`); // Keep this error message
        });
    }
}

// --- Render Dictionary Entries ---
function renderDictionaryEntries(entries) {
    dictionaryEntriesList.innerHTML = ''; // Clear existing entries
    if (entries.length === 0) {
        noEntriesMessage.classList.remove('hidden');
        dictionaryEntriesList.appendChild(noEntriesMessage);
    } else {
        noEntriesMessage.classList.add('hidden');
        entries.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'bg-gray-50 p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition duration-200';
            entryDiv.innerHTML = `
                <h3 class="text-xl font-semibold text-indigo-700 mb-2">${entry.word}</h3>
                <p class="text-gray-800 mb-4">${entry.meaning}</p>
                <div class="flex justify-end space-x-3">
                    <button class="edit-btn px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200 flex items-center" data-id="${entry.id}">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        Edit
                    </button>
                    <button class="delete-btn px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200 flex items-center" data-id="${entry.id}">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        Delete
                    </button>
                </div>
            `;
            dictionaryEntriesList.appendChild(entryDiv);
        });

        // Add event listeners to the new buttons
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const id = event.currentTarget.dataset.id;
                // Find the entry from the currently rendered list (or fetch if not available)
                const entryToEdit = entries.find(e => e.id === id);
                if (entryToEdit) {
                    handleEditEntry(entryToEdit);
                }
            });
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const id = event.currentTarget.dataset.id;
                confirmDelete(id);
            });
        });
    }
}

// --- Add/Update Entry Functionality ---
addUpdateBtn.addEventListener('click', async () => {
    const word = wordInput.value.trim();
    const meaning = meaningInput.value.trim();

    if (!word || !meaning) {
        showCustomModal('Word and Meaning cannot be empty.'); // Keep this validation message
        return;
    }

    if (!db) {
        showCustomModal('Database not initialized. Please try again.'); // Keep this error message
        return;
    }

    try {
        // Use the actual projectId for the collection path
        const dictionaryCollectionRef = collection(db, `artifacts/${firebaseConfig.projectId}/public/data/dictionary`);
        if (editingEntry) {
            // Update existing entry
            const entryDocRef = doc(db, `artifacts/${firebaseConfig.projectId}/public/data/dictionary`, editingEntry.id);
            await updateDoc(entryDocRef, {
                word: word,
                meaning: meaning,
                timestamp: new Date(), // Update timestamp on edit
            });
            // Removed: showCustomModal('Entry updated successfully!');
        } else {
            // Add new entry
            await addDoc(dictionaryCollectionRef, {
                word: word,
                meaning: meaning,
                timestamp: new Date(),
                userId: currentUserId, // Store the user ID who added the entry
            });
            // Removed: showCustomModal('Entry added successfully!');
        }
        wordInput.value = '';
        meaningInput.value = '';
        editingEntry = null; // Clear editing state
        formTitle.textContent = 'Add New Dictionary Entry';
        addUpdateBtn.textContent = 'Add Entry';
        cancelEditBtn.classList.add('hidden');
    } catch (error) {
        console.error("Error adding/updating document:", error);
        showCustomModal(`Error adding/updating entry: ${error.message}`); // Keep this error message
    }
});

// --- Edit Entry Functionality ---
function handleEditEntry(entry) {
    editingEntry = entry;
    wordInput.value = entry.word;
    meaningInput.value = entry.meaning;
    formTitle.textContent = 'Edit Dictionary Entry';
    addUpdateBtn.textContent = 'Update Entry';
    cancelEditBtn.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to show form
}

cancelEditBtn.addEventListener('click', () => {
    editingEntry = null;
    wordInput.value = '';
    meaningInput.value = '';
    formTitle.textContent = 'Add New Dictionary Entry';
    addUpdateBtn.textContent = 'Add Entry';
    cancelEditBtn.classList.add('hidden');
});

// --- Delete Entry Functionality ---
function confirmDelete(id) {
    showCustomModal('Are you sure you want to delete this entry?', true, async () => {
        try {
            if (!db) {
                showCustomModal('Database not initialized. Please try again.'); // Keep this error message
                return;
            }
            // Use the actual projectId for the collection path
            await deleteDoc(doc(db, `artifacts/${firebaseConfig.projectId}/public/data/dictionary`, id));
            // Removed: showCustomModal('Entry deleted successfully!');
        } catch (error) {
                console.error("Error deleting document:", error);
                showCustomModal(`Error deleting entry: ${error.message}`); // Keep this error message
        }
    });
}

// Initialize Firebase when the window loads
window.onload = initializeFirebase;

// Define firebaseConfig globally so it can be accessed by other functions
const firebaseConfig = {
    apiKey: "AIzaSyCaCTJe7SN5eM8zOLTZt4E8VR0nggz5aOI",
    authDomain: "edict-571bf.firebaseapp.com",
    projectId: "edict-571bf",
    storageBucket: "edict-571bf.firebasestorage.app",
    messagingSenderId: "462139852346",
    appId: "1:462139852346:web:cee6b6d00d6beac3f35703",
    measurementId: "G-GKWT6NC52T"
};
