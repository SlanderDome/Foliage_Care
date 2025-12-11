// --- 1. TAB SWITCHING LOGIC ---
// This runs immediately when the page loads.
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM Loaded. Initializing tabs.");
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate old tab and form
            const oldActiveButton = document.querySelector('.tab-button.active');
            if (oldActiveButton) oldActiveButton.classList.remove('active');
            
            const oldActiveForm = document.querySelector('.form.active');
            if (oldActiveForm) oldActiveForm.classList.remove('active');

            // Activate new tab and form
            button.classList.add('active');
            const target = button.dataset.target;
            const targetForm = document.querySelector(target);
            if (targetForm) targetForm.classList.add('active');
        });
    });
});


// --- 2. FIREBASE AUTH LOGIC ---
// This waits for the Firebase SDK to be fully loaded and ready.
window.addEventListener("firebase-ready", () => {
    console.log("Firebase is Ready. Initializing auth forms.");

    const loginForm = document.querySelector("#login");
    const signupForm = document.querySelector("#signup");
    
    // --- NEW: Get the Google Button ---
    const googleLoginButton = document.getElementById("google-login-button");
    // --- END NEW ---

    // Get the auth functions from the window object (set in login.html)
    const auth = window.firebaseAuth;
    const createUser = window.createUserWithEmailAndPassword;
    const signIn = window.signInWithEmailAndPassword;
    const onAuthStateChanged = window.onAuthStateChanged;
    const signInAnonymously = window.signInAnonymously;
    const signInWithCustomToken = window.signInWithCustomToken;
    const initialAuthToken = window.__initial_auth_token;

    // --- NEW: Get Google Functions ---
    const GoogleAuthProvider = window.GoogleAuthProvider;
    const signInWithPopup = window.signInWithPopup;
    // --- END NEW ---


    // Sign in the user (this happens in the background)
    const handleAuth = async () => {
        if (!auth) {
            console.error("Firebase Auth not initialized.");
            return;
        }

        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Signed in with custom token.");
            } else {
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
            }
        } catch (error) {
            console.error("Anonymous sign-in failed:", error);
        }

        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("User is signed in:", user.uid);
            } else {
                console.log("User is signed out.");
            }
        });
    };
    
    // Call the auth handler
    handleAuth();


    // --- 3. SIGNUP FORM SUBMISSION ---
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        
        const email = signupForm.querySelector('input[type="email"]').value;
        const password = signupForm.querySelector('input[type="password"]').value;

        if (!email || !password) {
            alert("Please fill out all fields.");
            return;
        }
        if (typeof createUser !== 'function') {
             console.error("Signup Error: createUser function not found on window object.");
             alert("Signup Failed: Page is still loading. Please try again in a moment.");
             return;
        }

        try {
            const userCredential = await createUser(auth, email, password);
            console.log("Signup Successful!", userCredential.user);

            localStorage.setItem("successMessage", "Account Created & Successfully Logged In");
            window.location.href = "index.html";

        } catch (error) {
            console.error("Signup Error:", error);
            alert(`Signup Failed: ${error.message}`);
        }
    });

    // --- 4. LOGIN FORM SUBMISSION ---
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = loginForm.querySelector('input[type="password"]').value;

        if (!email || !password) {
            alert("Please enter email and password.");
            return;
        }
        if (typeof signIn !== 'function') {
             console.error("Login Error: signIn function not found on window object.");
             alert("Login Failed: Page is still loading. Please try again in a moment.");
             return;
        }

        try {
            const userCredential = await signIn(auth, email, password);
            console.log("Login Successful!", userCredential.user);

            localStorage.setItem("successMessage", "Successfully Logged In");
            window.location.href = "index.html";

        } catch (error) {
            console.error("Login Error:", error);
            let errorMessage = "Login Failed. Please check your credentials.";
            if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
                errorMessage = "Invalid email or password.";
            }
            alert(errorMessage);
        }
    });
    
    
    googleLoginButton.addEventListener("click", async () => {
        if (typeof GoogleAuthProvider !== 'function' || typeof signInWithPopup !== 'function') {
            alert("Auth is still loading, please wait a moment.");
            return;
        }
        
        const provider = new GoogleAuthProvider();

        try {
            const userCredential = await signInWithPopup(auth, provider);
            console.log("Google Login Successful!", userCredential.user);
            
            localStorage.setItem("successMessage", "Successfully Logged In with Google");
            window.location.href = "index.html";

        } catch (error) {
            console.error("Google Login Error:", error);
            // Handle common error where user closes pop-up
            if (error.code === 'auth/popup-closed-by-user') {
                return; // Do nothing
            }
            alert(`Google Sign-in Failed: ${error.message}`);
        }
    });
   
});