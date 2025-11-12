
document.addEventListener("DOMContentLoaded", () => {
    const successMessage = localStorage.getItem("successMessage");

    if (successMessage) {
        // Create the banner element
        const banner = document.createElement('div');
        banner.textContent = successMessage;
        
     
        banner.style.backgroundColor = '#4CAF50';
        banner.style.color = 'white';
        banner.style.padding = '16px 20px';
        banner.style.textAlign = 'center';
        banner.style.position = 'fixed';
        banner.style.top = '0';
        banner.style.left = '0';
        banner.style.width = '100%';
        banner.style.zIndex = '200';
        banner.style.fontSize = '1.1rem';

       
        document.body.prepend(banner);

        setTimeout(() => {
            banner.style.transition = 'opacity 0.5s ease';
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 500);
        }, 3000);

      
        localStorage.removeItem("successMessage");
    }
});



window.addEventListener("firebase-ready", () => {
    // This message should appear in your console
    console.log("main.js: Firebase is Ready. Checking auth state.");

    const auth = window.firebaseAuth;
    const onAuthStateChanged = window.onAuthStateChanged;
    const signInAnonymously = window.signInAnonymously;
    const signInWithCustomToken = window.signInWithCustomToken;
    const initialAuthToken = window.__initial_auth_token;

    
    const handleAuth = async () => {
        if (!auth) return;
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else if (!auth.currentUser) {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("main.js: Auth check failed:", error);
        }
    };
    handleAuth();

    
    onAuthStateChanged(auth, (user) => {
        const loginLink = document.getElementById("login-link");
        
        if (!loginLink) {
             
            console.error("main.js: Could not find element with id 'login-link'");
            return;
        }

        if (user && !user.isAnonymous) {
           
            console.log("main.js: User is LOGGED IN. Changing link to Profile.");
            
            loginLink.textContent = "Logout"; 
            loginLink.href = "profile.html"; 
            loginLink.classList.remove("active");
            loginLink.onclick = null; 

        } else {
            
            console.log("main.js: User is LOGGED OUT. Setting link to Login/Signup.");

            loginLink.textContent = "Login/Signup";
            loginLink.href = "login.html";
        }
    });
});