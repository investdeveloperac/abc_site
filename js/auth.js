import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIGURATION GUIDE
// ==========================================
// Replace this placeholder configuration with the one from your Firebase Console.
// Go to: Firebase Console > Project Settings > General > Your Apps (Web App)
const firebaseConfig = {
  apiKey: "AIzaSyARImX7Uh8cPNDPbaAbemAI0Wyb_7GsgwA",
  authDomain: "frominvest-ag-portal.firebaseapp.com",
  projectId: "frominvest-ag-portal",
  storageBucket: "frominvest-ag-portal.firebasestorage.app",
  messagingSenderId: "743145142462",
  appId: "1:743145142462:web:488dc651c601d9cc0b86ef",
  measurementId: "G-VX4WM17W9Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// CONFIGURATION AND CONSTANTS
// ==========================================
const ADMIN_EMAIL = "info@frominvest-ag.com";

// EMAILJS CREDENTIALS (OPTION 1)
// Fill these if you want to use EmailJS (has limited free quota).
const EMAILJS_PUBLIC_KEY = "Ga4jjMvGWJq5brXSD";
const EMAILJS_SERVICE_ID = "service_sqs4c9i";
const EMAILJS_TEMPLATE_ID = "template_y1u58tp";

// CUSTOM PHP MAILER API (OPTION 2 - RECOMMENDED & UNLIMITED)
// Set this to your PHP script URL hosted on your PHP hosting.
// Example: "https://yourdomain.com/send_otp.php"
const PHP_MAILER_URL = "https://mail.frominvest-ag.com/send_otp.php";
const PHP_MAILER_SECRET = "FromInvestAGSecret2026";

// Initialize EmailJS if public key is provided
if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

// Currency formatting utility
const formatCurrency = (val) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
};

// Date formatting utility
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Bank name to workspace logo image mappings
const bankLogos = {
  'deutsche bank': 'images/Deutsche_Bank.png',
  'commerzbank': 'images/CommerzBank.png',
  'sparkasse': 'images/sparkasse.png',
  'naspa sparkasse': 'images/sparkasse.png',
  'naspa': 'images/sparkasse.png',
  'postbank': 'images/Postbank.png',
  'ing': 'images/ING.png',
  'ing diba': 'images/ING.png',
  'dkb': 'images/DKB.png',
  'santander': 'images/Santander.png',
  'ubs': 'images/UBS_Logo.png'
};

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // ---- 1. AUTHENTICATION PAGES (login.html) ----
  // ==========================================
  const authContainer = document.querySelector('.auth-container');
  if (authContainer) {
    const errorMsg = document.getElementById('authError');
    const successMsg = document.getElementById('authSuccess');

    let otpSent = false;
    let isSendingOtp = false;
    let otpTimerInterval = null;

    // Check url params for error=otp
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'otp') {
      setTimeout(() => {
        showError("Bitte loggen Sie sich ein, um Ihren Verifizierungscode zu erhalten.");
      }, 100);
    }

    // Check if user is already logged in & handle transitions
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
        const isOtpVerified = isLocalhost || (sessionStorage.getItem('otpVerified') === 'true');

        if (isAdmin || isOtpVerified) {
          window.location.href = 'dashboard.html';
        } else {
          // Logged in but OTP not verified. Show OTP page.
          showOtpScreen(user);
        }
      }
    });

    const showError = (msg) => {
      errorMsg.textContent = msg;
      errorMsg.style.display = 'block';
      successMsg.style.display = 'none';
    };

    const showSuccess = (msg) => {
      successMsg.textContent = msg;
      successMsg.style.display = 'block';
      errorMsg.style.display = 'none';
    };

    const startOtpTimer = () => {
      const timerEl = document.getElementById('otpTimer');
      const resendLink = document.getElementById('resendOtpLink');
      if (!timerEl || !resendLink) return;

      resendLink.style.pointerEvents = 'none';
      resendLink.style.opacity = '0.5';

      let timeLeft = 60;
      timerEl.textContent = `(in ${timeLeft}s)`;

      if (otpTimerInterval) clearInterval(otpTimerInterval);
      otpTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(otpTimerInterval);
          timerEl.textContent = '';
          resendLink.style.pointerEvents = 'auto';
          resendLink.style.opacity = '1';
        } else {
          timerEl.textContent = `(in ${timeLeft}s)`;
        }
      }, 1000);
    };

    const sendOtpCode = async (user) => {
      if (isSendingOtp) return;
      isSendingOtp = true;

      showSuccess("Ein 6-stelliger Verifizierungscode wird an Ihre E-Mail gesendet...");

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 5 * 60 * 1000; // 5 minutes validity

      const userRef = doc(db, "users", user.uid);
      try {
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const fullName = (userData.firstName && userData.lastName) ? `${userData.firstName} ${userData.lastName}` : 'Kunde';

        // Save code to DB
        await setDoc(userRef, {
          otpCode: otpCode,
          otpExpires: expires
        }, { merge: true });

        // Trigger delivery
        if (PHP_MAILER_URL && PHP_MAILER_URL !== "https://yourdomain.com/send_otp.php") {
          // Send via PHP Mailer (Option 2 - Custom Hosting)
          const response = await fetch(PHP_MAILER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              email: user.email,
              name: fullName,
              code: otpCode,
              secret: PHP_MAILER_SECRET
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || "Server Mailer API Fehler");
          }

          showSuccess("Der Verifizierungscode wurde per E-Mail gesendet.");
        } else if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID) {
          // Send via EmailJS (Option 1)
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
              to_email: user.email,
              user_name: fullName,
              otp_code: otpCode
            }
          );
          showSuccess("Der Verifizierungscode wurde per E-Mail gesendet.");
        } else {
          // Development/Fallback
          console.log(`[DEV MODE] OTP Code for ${user.email} is: ${otpCode}`);
          showSuccess(`[TEST-MODUS] Code an ${user.email} gesendet. Code: ${otpCode}`);
          alert(`[TEST-MODUS] Ihr Verifizierungscode lautet: ${otpCode}\n\n(Bitte tragen Sie Ihre PHP Mailer URL oder EmailJS-Daten oben in js/auth.js.)`);
        }

        startOtpTimer();
      } catch (err) {
        showError("Fehler beim Senden des Codes: " + err.message);
      } finally {
        isSendingOtp = false;
      }
    };

    const showOtpScreen = (user) => {
      const tabs = document.querySelector('.auth-tabs');
      if (tabs) tabs.style.display = 'none';

      const loginSec = document.getElementById('loginSection');
      if (loginSec) loginSec.classList.remove('active');

      const registerSec = document.getElementById('registerSection');
      if (registerSec) registerSec.classList.remove('active');

      const otpSec = document.getElementById('otpSection');
      if (otpSec) otpSec.classList.add('active');

      const otpSentEmail = document.getElementById('otpSentEmail');
      if (otpSentEmail) otpSentEmail.textContent = user.email;

      if (!otpSent) {
        otpSent = true;
        sendOtpCode(user);
      }
    };

    // Resend Code Click
    const resendOtpLink = document.getElementById('resendOtpLink');
    if (resendOtpLink) {
      resendOtpLink.addEventListener('click', (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (user) {
          sendOtpCode(user);
        }
      });
    }

    // Cancel OTP (Logout)
    const cancelOtpLink = document.getElementById('cancelOtpLink');
    if (cancelOtpLink) {
      cancelOtpLink.addEventListener('click', async (e) => {
        e.preventDefault();
        otpSent = false;
        if (otpTimerInterval) clearInterval(otpTimerInterval);

        await signOut(auth);

        const tabs = document.querySelector('.auth-tabs');
        if (tabs) tabs.style.display = 'flex';

        const otpSec = document.getElementById('otpSection');
        if (otpSec) otpSec.classList.remove('active');

        const loginSec = document.getElementById('loginSection');
        if (loginSec) loginSec.classList.add('active');

        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
      });
    }

    // OTP Code verification Submit
    const otpForm = document.getElementById('otpForm');
    if (otpForm) {
      otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('otpCode').value.trim();
        const btn = document.getElementById('otpBtn');

        btn.textContent = "Überprüft...";
        btn.disabled = true;
        errorMsg.style.display = 'none';

        const user = auth.currentUser;
        if (!user) {
          showError("Sitzung abgelaufen. Bitte laden Sie die Seite neu.");
          btn.textContent = "Code verifizieren";
          btn.disabled = false;
          return;
        }

        const userRef = doc(db, "users", user.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const storedCode = userData.otpCode;
            const expires = userData.otpExpires;

            if (storedCode && storedCode === codeInput) {
              if (Date.now() < expires) {
                sessionStorage.setItem('otpVerified', 'true');
                showSuccess("Erfolgreich verifiziert! Weiterleitung...");
                setTimeout(() => {
                  window.location.href = 'dashboard.html';
                }, 1000);
              } else {
                showError("Der Verifizierungscode ist abgelaufen. Bitte fordern Sie einen neuen an.");
                btn.textContent = "Code verifizieren";
                btn.disabled = false;
              }
            } else {
              showError("Der eingegebene Code ist falsch.");
              btn.textContent = "Code verifizieren";
              btn.disabled = false;
            }
          } else {
            showError("Benutzerdaten nicht gefunden.");
            btn.textContent = "Code verifizieren";
            btn.disabled = false;
          }
        } catch (err) {
          showError("Verifizierungsfehler: " + err.message);
          btn.textContent = "Code verifizieren";
          btn.disabled = false;
        }
      });
    }

    // Forgot Password Link
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) {
          showError("Bitte geben Sie zuerst Ihre E-Mail-Adresse in das Feld ein, um das Passwort zurückzusetzen.");
          return;
        }
        try {
          await sendPasswordResetEmail(auth, email);
          showSuccess("Ein Link zum Zurücksetzen des Passworts wurde an Ihre E-Mail-Adresse gesendet.");
        } catch (error) {
          showError("Fehler beim Senden des Links: " + error.message);
        }
      });
    }

    // Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value.trim();
        const btn = document.getElementById('loginBtn');

        btn.textContent = "Verbindet...";
        btn.disabled = true;
        errorMsg.style.display = 'none';

        try {
          await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
          showError("Die E-Mail-Adresse oder das Passwort ist ungültig.");
          btn.textContent = "Einloggen";
          btn.disabled = false;
        }
      });
    }

    // Register Form Submit
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const firstName = document.getElementById('regFirstName').value.trim();
        const lastName = document.getElementById('regLastName').value.trim();
        const birthDate = document.getElementById('regBirthDate').value;
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const pass = document.getElementById('regPassword').value.trim();
        const btn = document.getElementById('registerBtn');

        btn.textContent = "Konto wird erstellt...";
        btn.disabled = true;
        errorMsg.style.display = 'none';

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
          const user = userCredential.user;

          // Create document in Firestore
          await setDoc(doc(db, "users", user.uid), {
            firstName: firstName,
            lastName: lastName,
            birthDate: birthDate,
            email: email,
            phone: phone,
            portfolio: []
          });

          // Allow direct access after registration
          sessionStorage.setItem('otpVerified', 'true');

          showSuccess("Registrierung erfolgreich! Weiterleitung...");
        } catch (error) {
          showError("Fehler bei der Registrierung: " + error.message);
          btn.textContent = "Jetzt Registrieren";
          btn.disabled = false;
        }
      });
    }
  }

  // ==========================================
  // ---- 2. CUSTOMER DASHBOARD (dashboard.html) ----
  // ==========================================
  const dashboardWrapper = document.querySelector('.dashboard-wrapper');
  if (dashboardWrapper) {
    let currentDocRef = null;
    let currentUserData = {};

    // Authentication Guard & Firestore Listener
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = 'login.html';
      } else {
        // OTP Validation Guard
        const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
        const isOtpVerified = isLocalhost || (sessionStorage.getItem('otpVerified') === 'true');

        // Check if impersonation is active
        const impersonateUid = sessionStorage.getItem('impersonateUid');
        const isImpersonating = !!(impersonateUid && isAdmin);

        // Show/hide impersonation banner
        const impersonateBanner = document.getElementById('impersonateBanner');
        if (impersonateBanner) {
          impersonateBanner.style.display = isImpersonating ? 'block' : 'none';
        }

        // Exit impersonation button listener
        const btnExitImpersonate = document.getElementById('btnExitImpersonate');
        if (btnExitImpersonate) {
          btnExitImpersonate.onclick = () => {
            sessionStorage.removeItem('impersonateUid');
            window.location.href = 'admin.html';
          };
        }

        // Show/hide Verwaltung tab based on admin status
        const adminTab = document.getElementById('adminVerwaltungTab');
        if (adminTab) {
          adminTab.style.display = (isAdmin && !isImpersonating) ? 'flex' : 'none';
        }

        if (!isAdmin && !isOtpVerified) {
          signOut(auth).then(() => {
            window.location.href = 'login.html?error=otp';
          });
          return;
        }

        const targetUid = isImpersonating ? impersonateUid : user.uid;
        currentDocRef = doc(db, "users", targetUid);

        // Listen for realtime data updates
        onSnapshot(currentDocRef, (docSnap) => {
          if (docSnap.exists()) {
            currentUserData = docSnap.data();
            renderDashboard(currentUserData);
          } else {
            // Setup default profile fields if Firestore document is missing
            setDoc(currentDocRef, {
              firstName: '',
              lastName: '',
              birthDate: '',
              email: user.email,
              phone: '',
              portfolio: []
            });
          }
        });
      }
    });

    // Render elements dynamically
    const renderDashboard = (data) => {
      // Top User name display
      const fullName = (data.firstName && data.lastName) ? `${data.firstName} ${data.lastName}` : (data.email || 'Kunde');

      const displayUsernameEl = document.getElementById('displayUsername');
      if (displayUsernameEl) displayUsernameEl.textContent = fullName;

      const sidebarUserNameEl = document.getElementById('sidebarUserName');
      if (sidebarUserNameEl) sidebarUserNameEl.textContent = fullName.toLowerCase();

      const sidebarUserEmailEl = document.getElementById('sidebarUserEmail');
      if (sidebarUserEmailEl) sidebarUserEmailEl.textContent = data.email || '';

      // Tab 1: Meine Konten - Personal Data Box
      const pFirstNameEl = document.getElementById('pFirstName');
      if (pFirstNameEl) pFirstNameEl.textContent = data.firstName || '—';

      const pLastNameEl = document.getElementById('pLastName');
      if (pLastNameEl) pLastNameEl.textContent = data.lastName || '—';

      const pBirthDateEl = document.getElementById('pBirthDate');
      if (pBirthDateEl) pBirthDateEl.textContent = formatDate(data.birthDate);

      const pEmailEl = document.getElementById('pEmail');
      if (pEmailEl) pEmailEl.textContent = data.email || '—';

      // Tab 2: Einstellungen - Profile Update Inputs
      const editFirstNameEl = document.getElementById('editFirstName');
      if (editFirstNameEl) editFirstNameEl.value = data.firstName || '';

      const editLastNameEl = document.getElementById('editLastName');
      if (editLastNameEl) editLastNameEl.value = data.lastName || '';

      const editBirthDateEl = document.getElementById('editBirthDate');
      if (editBirthDateEl) editBirthDateEl.value = data.birthDate || '';

      const editPhoneEl = document.getElementById('editPhone');
      if (editPhoneEl) editPhoneEl.value = data.phone || '';

      // Tab 1: Render Investment Cards
      const portfolio = data.portfolio || [];
      const container = document.getElementById('portfolioContainer');
      container.innerHTML = '';

      const premiumStatsCard = document.getElementById('premiumStatsCard');
      if (portfolio.length === 0) {
        if (premiumStatsCard) premiumStatsCard.style.display = 'none';
        container.innerHTML = `
          <div class="empty-portfolio">
            <div class="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="empty-text">Noch keine Anlagen vorhanden.</div>
            <p style="color: #64748b; font-size: 14px;">Bitte wenden Sie sich an Ihren Anlageberater, um neue Festgeld-Konten freizuschalten.</p>
          </div>
        `;
      } else {
        if (premiumStatsCard) premiumStatsCard.style.display = 'block';
        let totalCapital = 0;
        let totalYield = 0;
        portfolio.forEach((item, index) => {
          const amountNum = parseFloat(item.amount) || 0;
          const yieldNum = parseFloat(item.yield) || 0;
          const monthsNum = parseInt(item.months) || 0;
          const earnedTotal = amountNum * Math.pow(1 + (yieldNum / 100 / 12), monthsNum) - amountNum;
          totalCapital += amountNum;
          totalYield += earnedTotal;

          const bankNameLower = (item.bank || '').toLowerCase().trim();
          let bankIconHTML = `
            <div class="bank-icon-box">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          `;

          if (bankLogos[bankNameLower]) {
            bankIconHTML = `
              <div class="bank-icon-box" style="background: white; border: 1px solid #e2e8f0; overflow: hidden; padding: 4px;">
                <img src="${bankLogos[bankNameLower]}" alt="${item.bank}" style="width: 100%; height: 100%; object-fit: contain;">
              </div>
            `;
          }

          let refAccountHTML = '';
          if (item.refIban) {
            const refBankNameLower = (item.refBank || '').toLowerCase().trim();
            let refBankIconHTML = `
              <div class="bank-icon-box" style="width: 24px; height: 24px; border-radius: 6px; font-size: 12px; margin-right: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 12px; height: 12px;">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            `;

            if (bankLogos[refBankNameLower]) {
              refBankIconHTML = `
                <div class="bank-icon-box" style="background: white; border: 1px solid #e2e8f0; overflow: hidden; padding: 2px; width: 24px; height: 24px; border-radius: 6px; margin-right: 0;">
                  <img src="${bankLogos[refBankNameLower]}" alt="${item.refBank}" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
              `;
            }

            refAccountHTML = `
              <div style="border-top: 1px dashed #e2e8f0; padding-top: 12px; margin-top: 12px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Referenzkonto</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  ${refBankIconHTML}
                  <div style="text-align: right;">
                    <span style="font-size: 13px; font-weight: 700; color: #334155; display: block; line-height: 1.2;">${item.refBank}</span>
                    <span style="font-size: 11px; font-weight: 600; color: #64748b; font-family: monospace; line-height: 1.2;">${item.refIban}</span>
                  </div>
                </div>
              </div>
            `;
          }

          const card = document.createElement('div');
          card.className = 'investment-card';
          card.innerHTML = `
            <div class="card-header-row">
              <div class="bank-info">
                ${bankIconHTML}
                <div class="bank-name-wrap">
                  <span class="bank-label">BANK</span>
                  <span class="bank-name">${item.bank || 'Unbekannte Bank'}</span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <span class="status-badge">Aktiv</span>
                <span style="font-size: 11px; font-weight: 700; color: #94a3b8; font-family: monospace;">${item.contractNo || (user.uid.substring(0, 8).toUpperCase() + '-' + index)}</span>
              </div>
            </div>
            
            <div class="card-grid">
              <div class="grid-item">
                <div class="grid-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div class="grid-text-wrap">
                  <span class="grid-label">Anlagesumme</span>
                  <span class="grid-value">${formatCurrency(amountNum)}</span>
                </div>
              </div>
              
              <div class="grid-item">
                <div class="grid-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="grid-text-wrap">
                  <span class="grid-label">Zinssatz</span>
                  <span class="grid-value">${yieldNum}% p.a.</span>
                </div>
              </div>

              <div class="grid-item">
                <div class="grid-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="grid-text-wrap">
                  <span class="grid-label">Beginn</span>
                  <span class="grid-value">${formatDate(item.startDate)}</span>
                </div>
              </div>

              <div class="grid-item">
                <div class="grid-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="grid-text-wrap">
                  <span class="grid-label">Ende</span>
                  <span class="grid-value">${formatDate(item.endDate)}</span>
                </div>
              </div>

              <div class="grid-item">
                <div class="grid-icon-box green">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div class="grid-text-wrap">
                  <span class="grid-label">Zinsertrag (gesamt)</span>
                  <span class="grid-value" style="color: var(--success-text);">${formatCurrency(earnedTotal)}</span>
                </div>
              </div>

              <div class="grid-item">
                <div class="grid-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18v3" />
                  </svg>
                </div>
                <div class="grid-text-wrap">
                  <span class="grid-label">Zinsausschüttung</span>
                  <span class="grid-value">Ende der Laufzeit</span>
                </div>
              </div>
            </div>

            ${refAccountHTML}

            <div class="card-footer-row">
              <span>Inhaber: ${data.firstName || ''} ${data.lastName || ''}${item.coOwners ? ', ' + item.coOwners : ''}</span>
              <span style="color: var(--primary-color); font-weight: bold;">Details & Vertrag →</span>
            </div>
          `;

          // Clicking card redirects to certificate overview
          card.addEventListener('click', () => {
            window.location.href = `detail.html?id=${index}`;
          });

          container.appendChild(card);
        });

        // Update statistics cards
        const statTotalCapital = document.getElementById('statTotalCapital');
        const statTotalYield = document.getElementById('statTotalYield');
        const statTotalBalance = document.getElementById('statTotalBalance');
        const statReturnRate = document.getElementById('statReturnRate');
        
        const ratioBarCapital = document.getElementById('ratioBarCapital');
        const ratioBarYield = document.getElementById('ratioBarYield');
        const ratioPercentCapital = document.getElementById('ratioPercentCapital');
        const ratioPercentYield = document.getElementById('ratioPercentYield');

        const totalMaturity = totalCapital + totalYield;

        if (statTotalCapital) statTotalCapital.textContent = formatCurrency(totalCapital);
        if (statTotalYield) statTotalYield.textContent = '+ ' + formatCurrency(totalYield);
        if (statTotalBalance) statTotalBalance.textContent = formatCurrency(totalMaturity);
        
        if (statReturnRate && totalCapital > 0) {
          const returnRate = (totalYield / totalCapital) * 100;
          statReturnRate.textContent = returnRate.toFixed(2).replace('.', ',') + '%';
        }

        if (totalMaturity > 0) {
          const capPercent = (totalCapital / totalMaturity) * 100;
          const yldPercent = (totalYield / totalMaturity) * 100;

          if (ratioBarCapital) ratioBarCapital.style.width = capPercent + '%';
          if (ratioBarYield) ratioBarYield.style.width = yldPercent + '%';
          
          if (ratioPercentCapital) ratioPercentCapital.textContent = capPercent.toFixed(1).replace('.', ',') + '%';
          if (ratioPercentYield) ratioPercentYield.textContent = yldPercent.toFixed(1).replace('.', ',') + '%';
        }
      }
    };

    // Tab Switching Logic
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const tabPanels = document.querySelectorAll('.tab-panel');

    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetTab = item.getAttribute('data-tab');

        if (targetTab === 'verwaltung') {
          // Redirect to admin panel
          window.location.href = 'admin.html';
          return;
        }

        menuItems.forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        tabPanels.forEach(panel => {
          if (panel.id === `${targetTab}Panel`) {
            panel.classList.add('active');
          } else {
            panel.classList.remove('active');
          }
        });
      });
    });

    // Profile Settings Form Update
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sfName = document.getElementById('editFirstName').value.trim();
        const slName = document.getElementById('editLastName').value.trim();
        const sbDate = document.getElementById('editBirthDate').value;
        const sPhone = document.getElementById('editPhone').value.trim();
        const msg = document.getElementById('settingsMsg');

        if (currentDocRef) {
          try {
            await setDoc(currentDocRef, {
              firstName: sfName,
              lastName: slName,
              birthDate: sbDate,
              phone: sPhone
            }, { merge: true });

            msg.textContent = 'Profil wurde erfolgreich aktualisiert.';
            msg.className = 'success-msg';
            msg.style.display = 'block';
            setTimeout(() => { msg.style.display = 'none'; }, 4000);
          } catch (error) {
            msg.textContent = 'Fehler beim Speichern: ' + error.message;
            msg.className = 'error-msg';
            msg.style.display = 'block';
          }
        }
      });
    }

    // Password Update Form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('newPassword').value.trim();
        const user = auth.currentUser;
        const msg = document.getElementById('passwordMsg');

        if (user) {
          try {
            await updatePassword(user, newPass);
            msg.textContent = 'Passwort wurde erfolgreich geändert.';
            msg.className = 'success-msg';
            msg.style.display = 'block';
            passwordForm.reset();
            setTimeout(() => { msg.style.display = 'none'; }, 4000);
          } catch (error) {
            msg.textContent = 'Sicherheitsfehler: Bitte melden Sie sich erneut an, um das Passwort zu ändern.';
            msg.className = 'error-msg';
            msg.style.display = 'block';
          }
        }
      });
    }

    // Logout Trigger
    document.getElementById('logoutBtn').addEventListener('click', () => {
      sessionStorage.removeItem('otpVerified');
      signOut(auth).then(() => { window.location.href = 'index.html'; });
    });
  }

});
