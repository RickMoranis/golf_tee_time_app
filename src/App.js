import React, { useState, useEffect } from 'react';
// We need to import the firebase libraries we'll be using
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// --- Helper function to make dates and times look nice ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { weekday: 'short', month: 'long', day: 'numeric' };
    const date = new Date(dateString + 'T00:00:00'); // Ensure date is parsed correctly without timezone issues
    return date.toLocaleDateString(undefined, options);
};

const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHours = h % 12 === 0 ? 12 : h % 12;
    const formattedMinutes = m < 10 ? '0' + m : m;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
};

// --- Modal Component for Adding New Tee Times ---
// This is the pop-up form that appears when you click the '+' button.
const AddTeeTimeModal = ({ isOpen, onClose, onAddTeeTime, courses, db, appId, auth }) => {
    // State for the form inputs
    const [selectedCourse, setSelectedCourse] = useState('');
    const [newCourse, setNewCourse] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [spots, setSpots] = useState(4);
    const [error, setError] = useState('');

    // Don't render the modal if it's not supposed to be open
    if (!isOpen) return null;
    
    // Function to handle the form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        const courseName = selectedCourse === 'add_new' ? newCourse.trim() : selectedCourse;

        // Basic form validation
        if (!courseName || !date || !time || !spots) {
            setError('Please fill out all fields.');
            return;
        }
        if (new Date(date) < new Date(new Date().toDateString())) {
            setError('Cannot book a tee time in the past.');
            return;
        }
        setError('');

        // If the user is adding a new course, save it to the 'courses' collection first
        if (selectedCourse === 'add_new') {
            try {
                const coursesCollectionPath = `/artifacts/${appId}/public/data/courses`;
                const q = query(collection(db, coursesCollectionPath), where("name", "==", courseName));
                const querySnapshot = await getDocs(q);
                // Only add the course if it doesn't already exist
                if (querySnapshot.empty) {
                     await addDoc(collection(db, coursesCollectionPath), {
                        name: courseName,
                        addedBy: auth.currentUser.uid, // Keep track of who added it
                        createdAt: serverTimestamp()
                    });
                }
            } catch (err) {
                console.error("Error adding new course:", err);
                setError("Could not save the new course. Please try again.");
                return;
            }
        }
        
        // Pass the new tee time data back to the main App component to be saved
        onAddTeeTime({ course: courseName, date, time, totalSpots: Number(spots) });
        onClose(); // Close the modal
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4 text-green-700">Post a New Tee Time</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Course Selection Dropdown */}
                    <div>
                        <label htmlFor="course-select" className="block text-sm font-medium text-gray-700">Golf Course</label>
                        <select id="course-select" value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500" required>
                            <option value="" disabled>Select a course</option>
                            {courses.map(course => <option key={course.id} value={course.name}>{course.name}</option>)}
                            <option value="add_new">-- Add a New Course --</option>
                        </select>
                    </div>

                    {/* This input only appears if 'Add a New Course' is selected */}
                    {selectedCourse === 'add_new' && (
                        <div>
                             <label htmlFor="new-course" className="block text-sm font-medium text-gray-700">New Course Name</label>
                             <input type="text" id="new-course" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" placeholder="e.g., Augusta National" required />
                        </div>
                    )}
                    
                    {/* Other form fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                           <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div>
                           <label htmlFor="time" className="block text-sm font-medium text-gray-700">Time</label>
                           <input type="time" id="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="spots" className="block text-sm font-medium text-gray-700">Total Players in Group</label>
                        <select id="spots" value={spots} onChange={(e) => setSpots(Number(e.target.value))} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm">
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                        </select>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                       <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancel</button>
                       <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">Post Tee Time</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- The Main App Component ---
// This is the component that gets rendered into the 'root' div.
export default function App() {
    // State for Firebase services, user info, and application data
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [teeTimes, setTeeTimes] = useState([]);
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // --- IMPORTANT: Firebase Configuration ---
    // These variables will be provided by the environment (Railway or Canvas)
    const appId = (typeof process !== 'undefined' && process.env.REACT_APP_APP_ID) || (typeof __app_id !== 'undefined' ? __app_id : 'golf-coordinator-default');
    const firebaseConfigString = (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_CONFIG) || (typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

    // --- Effect for Firebase Initialization and Authentication ---
    // This runs only once when the component first loads.
    useEffect(() => {
        try {
            const firebaseConfig = JSON.parse(firebaseConfigString);
            if (Object.keys(firebaseConfig).length === 0) {
                 setError("Firebase config is missing. App cannot start.");
                 setIsLoading(false); return;
            }
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // This listener checks if a user is signed in
            onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // If no user, sign them in anonymously
                    try {
                        const initialToken = (typeof process !== 'undefined' && process.env.REACT_APP_INITIAL_AUTH_TOKEN) || (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null);
                        if (initialToken) await signInWithCustomToken(firebaseAuth, initialToken);
                        else await signInAnonymously(firebaseAuth);
                    } catch (authError) {
                        console.error("Authentication failed:", authError);
                        setError("Could not connect to the service.");
                    }
                }
                setIsAuthReady(true);
            });
        } catch (e) {
            console.error("Firebase initialization failed:", e);
            setError("Failed to initialize. Check Firebase config.");
            setIsLoading(false);
        }
    }, [firebaseConfigString]); // Only re-run if the config string changes

    // --- Effect for Firestore Real-time Listeners ---
    // This sets up the real-time connection to our database.
    useEffect(() => {
        // Don't run until Firebase is ready
        if (!isAuthReady || !db) return;
        setIsLoading(true);

        // Listener for Tee Times
        const teeTimesCollectionPath = `/artifacts/${appId}/public/data/tee_times`;
        const unsubscribeTeeTimes = onSnapshot(collection(db, teeTimesCollectionPath), (querySnapshot) => {
            const timesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            timesData.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
            setTeeTimes(timesData);
            if(isLoading) setIsLoading(false);
        });

        // Listener for Golf Courses
        const coursesCollectionPath = `/artifacts/${appId}/public/data/courses`;
        const unsubscribeCourses = onSnapshot(collection(db, coursesCollectionPath), (querySnapshot) => {
            const coursesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            coursesData.sort((a, b) => a.name.localeCompare(b.name)); // Sort courses alphabetically
            setCourses(coursesData);
        });

        // Cleanup function: This is important to prevent memory leaks
        return () => {
            unsubscribeTeeTimes();
            unsubscribeCourses();
        };
    }, [isAuthReady, db, appId, isLoading]); // Re-run if auth, db, or appID change


    // --- Functions to handle user actions ---
    const handleAddTeeTime = async (teeTimeData) => {
        if (!db || !userId) { setError('Database not ready.'); return; }
        try {
            const teeTimesCollectionPath = `/artifacts/${appId}/public/data/tee_times`;
            await addDoc(collection(db, teeTimesCollectionPath), {
                ...teeTimeData,
                players: [userId], // The creator is automatically the first player
                creatorId: userId,
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            console.error("Error adding document: ", err);
        }
    };

    const handleClaimSpot = async (teeTimeId) => {
        if (!db || !userId) return;
        try {
            const teeTimeRef = doc(db, `/artifacts/${appId}/public/data/tee_times`, teeTimeId);
            // arrayUnion adds an element to an array but only if it's not already present
            await updateDoc(teeTimeRef, { players: arrayUnion(userId) });
        } catch (err) {
            console.error("Error claiming spot: ", err);
        }
    };
    
    // --- The JSX that defines what the component looks like ---
    return (
        <div className="bg-gray-100 min-h-screen font-sans text-gray-800">
            <header className="bg-white shadow-md sticky top-0 z-10">
                <div className="container mx-auto p-4 text-center">
                    <h1 className="text-3xl font-bold text-green-800">Tee Times</h1>
                     {userId && <p className="text-xs text-gray-500 mt-1 truncate">Your ID: {userId}</p>}
                </div>
            </header>

            <main className="container mx-auto p-4 pb-24"> {/* Padding bottom for the '+' button */}
                {isLoading && <p className="text-center text-gray-600 mt-8">Loading...</p>}
                {error && <p className="text-center text-red-500 mt-8">{error}</p>}
                
                {!isLoading && !error && teeTimes.length === 0 && (
                    <div className="text-center p-8 mt-8 bg-white rounded-xl shadow-md">
                        <p className="text-gray-600">No tee times posted yet.</p>
                        <p className="text-gray-500 text-sm mt-2">Tap the '+' button to add one!</p>
                    </div>
                )}

                {/* Map over the tee times and create a card for each one */}
                <div className="space-y-4">
                    {teeTimes.map(teeTime => {
                        const availableSpots = teeTime.totalSpots - (teeTime.players?.length || 0);
                        const isFull = availableSpots <= 0;
                        const hasJoined = userId && teeTime.players?.includes(userId);
                        const isPast = new Date(`${teeTime.date}T${teeTime.time}`) < new Date();

                        return (
                            <div key={teeTime.id} className={`bg-white rounded-xl shadow-lg border border-gray-200 p-4 transition-all ${isPast ? 'opacity-60 bg-gray-50' : ''}`}>
                                {/* Card content */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold text-green-800">{teeTime.course}</h3>
                                        <p className="text-gray-600">{formatDate(teeTime.date)} at <span className="font-semibold">{formatTime(teeTime.time)}</span></p>
                                    </div>
                                    <div className={`text-center flex-shrink-0 ml-2 px-3 py-1 rounded-full font-bold text-sm ${isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                       {isFull ? "Full" : `${availableSpots} Left`}
                                    </div>
                                </div>
                                <div className="mt-4 text-sm">
                                    <h4 className="font-semibold mb-1">Players ({teeTime.players?.length || 0}/{teeTime.totalSpots}):</h4>
                                    <div className="space-y-1 text-gray-700">
                                         {teeTime.players?.map((player, index) => (
                                            <div key={index} className="flex items-center">
                                               <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{player.substring(0, 12)}...</span>
                                               {player === userId && <span className="ml-2 text-green-600 font-bold text-xs">(You)</span>}
                                            </div>
                                         ))}
                                    </div>
                                </div>
                                {/* Claim Spot Button */}
                                {!isPast && (
                                  <div className="mt-4 pt-4 border-t border-gray-100">
                                      <button 
                                          onClick={() => handleClaimSpot(teeTime.id)} 
                                          disabled={isFull || hasJoined}
                                          className={`w-full font-bold py-2.5 px-6 rounded-lg transition-transform transform ${isFull || hasJoined ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'}`}
                                      >
                                          {hasJoined ? 'You\'re In!' : 'Claim Spot'}
                                      </button>
                                  </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* The floating '+' button */}
            <button onClick={() => setIsModalOpen(true)} className="fixed bottom-6 right-6 bg-green-600 text-white rounded-full p-4 shadow-xl hover:bg-green-700 focus:outline-none z-20" aria-label="Add new tee time">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </button>
            
            {/* The Modal component itself */}
            <AddTeeTimeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAddTeeTime={handleAddTeeTime}
                courses={courses}
                db={db}
                appId={appId}
                auth={auth}
            />
        </div>
    );
}
