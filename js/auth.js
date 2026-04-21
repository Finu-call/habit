// auth.js - Handles Firebase Authentication on index.html
import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('toggle-signup');
    const errorMsg = document.getElementById('auth-error-msg');
    const submitBtnText = document.getElementById('submit-btn-text');
    const titleSpan = document.getElementById('auth-subtitle');

    let isLoginMode = true;

    // Listen for Auth state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is logged in, redirect to dashboard
            window.location.href = 'dashboard.html';
        }
    });

    // Toggle between Login & Sign Up
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        
        errorMsg.classList.add('hidden');
        emailInput.value = '';
        passwordInput.value = '';

        if (isLoginMode) {
            submitBtnText.textContent = 'Sign In';
            toggleBtn.parentElement.innerHTML = `Don't have an account? <a href="#" id="toggle-signup" class="accent-link">Create one now</a>`;
            titleSpan.textContent = "Welcome back. Let's crush those goals.";
        } else {
            submitBtnText.textContent = 'Create Account';
            toggleBtn.parentElement.innerHTML = `Already have an account? <a href="#" id="toggle-signup" class="accent-link">Sign In here</a>`;
            titleSpan.textContent = "Your new journey starts today.";
        }
        
        // Reattach dynamically created listener
        document.getElementById('toggle-signup').addEventListener('click', toggleBtn.click.bind(toggleBtn));
    });

    // Handle Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showError('Please fill in all fields.');
            return;
        }

        submitBtnText.textContent = 'Loading...';
        errorMsg.classList.add('hidden');

        try {
            if (isLoginMode) {
                // Firebase Login
                await signInWithEmailAndPassword(auth, email, password);
                // onAuthStateChanged will redirect
            } else {
                // Firebase Sign Up
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Initialize user database structure
                await set(ref(db, 'users/' + user.uid), {
                    habits: [],
                    records: {}
                });
                
                // onAuthStateChanged will redirect
            }
        } catch (error) {
            let msg = error.message;
            if (error.code === 'auth/invalid-credential') msg = "Invalid email or password";
            if (error.code === 'auth/email-already-in-use') msg = "Account already exists";
            if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters";
            
            showError(msg);
            submitBtnText.textContent = isLoginMode ? 'Sign In' : 'Create Account';
        }
    });

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    }
});
