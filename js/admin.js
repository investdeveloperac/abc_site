import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIGURATION GUIDE
// ==========================================
// Replace this placeholder configuration with the one from your Firebase Console.
// Make sure it matches the config in js/auth.js!
const firebaseConfig = {
  apiKey: "AIzaSyARImX7Uh8cPNDPbaAbemAI0Wyb_7GsgwA",
  authDomain: "frominvest-ag-portal.firebaseapp.com",
  projectId: "frominvest-ag-portal",
  storageBucket: "frominvest-ag-portal.firebasestorage.app",
  messagingSenderId: "743145142462",
  appId: "1:743145142462:web:488dc651c601d9cc0b86ef",
  measurementId: "G-VX4WM17W9Z"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Secondary Firebase Auth instance for user creation to avoid logging out admin
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

// Default Administrator Email Address
const ADMIN_EMAIL = "info@frominvest-ag.com";

let allUsers = [];
let selectedUserId = null;
let editingInvIndex = null;
let unsubscribeSelected = null;

const formatCurrency = (val) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
};

document.addEventListener('DOMContentLoaded', () => {

  const overlay = document.getElementById('authOverlay');

  // ==========================================
  // ---- 1. SECURITY AUTHORIZATION CHECK ----
  // ==========================================
  onAuthStateChanged(auth, async (user) => {
    if (user && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      // User is authorized admin
      overlay.style.display = 'none';
      loadUsers();
    } else {
      // Unauthorized user or guest
      const title = overlay.querySelector('h2');
      const desc = overlay.querySelector('p');
      if (title) title.textContent = "Zugriff verweigert";
      if (desc) desc.textContent = "Sie haben keine Administratorrechte für dieses Portal. Weiterleitung...";
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2500);
    }
  });

  // ==========================================
  // ---- 2. LOAD DIRECTORY OF USERS ----
  // ==========================================
  const loadUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      allUsers = [];
      querySnapshot.forEach((docSnap) => {
        allUsers.push({ id: docSnap.id, ...docSnap.data() });
      });
      renderUserList();
    } catch (error) {
      alert("Fehler beim Laden der Benutzerdaten: " + error.message);
    }
  };

  const renderUserList = () => {
    const container = document.getElementById('userListContainer');
    container.innerHTML = '';

    if (allUsers.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">Keine registrierten Kunden gefunden.</div>';
      return;
    }

    allUsers.forEach(u => {
      const fullName = (u.firstName && u.lastName) ? `${u.firstName} ${u.lastName}` : 'Unvollständiges Profil';
      const div = document.createElement('div');
      div.className = 'admin-user-item';
      div.innerHTML = `
        <div class="admin-user-name">${fullName}</div>
        <div class="admin-user-email">${u.email}</div>
      `;
      div.addEventListener('click', () => {
        document.querySelectorAll('.admin-user-item').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        selectUser(u.id);
      });
      container.appendChild(div);
    });
  };

  // ==========================================
  // ---- 3. SELECT AND LISTEN TO A USER ----
  // ==========================================
  const selectUser = (uid) => {
    selectedUserId = uid;
    editingInvIndex = null;

    // Reset add investment form and labels
    const addForm = document.getElementById('adminAddInvForm');
    if (addForm) {
      addForm.reset();
      addForm.previousElementSibling.textContent = 'Neue Anlage hinzufügen';
    }
    const submitBtn = document.getElementById('btnSubmitInv');
    if (submitBtn) {
      submitBtn.textContent = 'Anlage dem Kunden hinzufügen';
    }
    const cancelBtn = document.getElementById('btnCancelEditInv');
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }

    document.getElementById('emptyMain').style.display = 'none';
    document.getElementById('adminMain').style.display = 'block';
    document.getElementById('createUserPanel').style.display = 'none';

    if (unsubscribeSelected) {
      unsubscribeSelected();
    }

    // Bind Firestore listener to select user profile document
    unsubscribeSelected = onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        populateForms(uid, userData);
        renderPortfolio(userData.portfolio || []);
      }
    });
  };

  const populateForms = (uid, data) => {
    const fullName = (data.firstName && data.lastName) ? `${data.firstName} ${data.lastName}` : 'Kunde';
    document.getElementById('selUserName').textContent = fullName;
    document.getElementById('selUserId').textContent = uid;

    document.getElementById('editFirstName').value = data.firstName || '';
    document.getElementById('editLastName').value = data.lastName || '';
    document.getElementById('editBirthDate').value = data.birthDate || '';
    document.getElementById('editEmail').value = data.email || '';
    document.getElementById('editPhone').value = data.phone || '';
  };

  // Render portfolio details
  const renderPortfolio = (portfolio) => {
    const list = document.getElementById('adminPortfolioList');
    list.innerHTML = '';

    if (portfolio.length === 0) {
      list.innerHTML = '<div class="admin-portfolio-item" style="color: #64748b; justify-content: center;">Keine aktiven Anlagen hinterlegt.</div>';
      return;
    }

    portfolio.forEach((item, index) => {
      const amountNum = parseFloat(item.amount) || 0;
      const div = document.createElement('div');
      div.className = 'admin-portfolio-item';
      div.innerHTML = `
        <div>
          <strong>${item.bank || 'Bank'}</strong> - ${item.type || 'Festgeld'}<br>
          <small style="color: #64748b; font-size: 13px;">
            ${formatCurrency(amountNum)} @ ${item.yield || 0}% p.a. (${item.months || 0} Monate)
          </small><br>
          <small style="color: #94a3b8; font-size: 11px;">
            ${item.contractNo ? `Vertrag: ${item.contractNo} | ` : ''}Start: ${item.startDate || '—'} | Ende: ${item.endDate || '—'}${item.coOwners ? ` | Mitinhaber: ${item.coOwners}` : ''}${item.refIban ? ` | Ref: ${item.refBank || '—'} (${item.refIban})` : ''} | <strong style="color: ${item.status === 'inaktiv' ? '#ef4444' : '#10b981'}; text-transform: uppercase;">${item.status === 'inaktiv' ? 'INAKTIV' : 'AKTIV'}</strong>
          </small>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="btn-admin edit-btn" data-index="${index}" style="background: #002e6c;">Bearbeiten</button>
          <button class="btn-admin danger delete-btn" data-index="${index}">Löschen</button>
        </div>
      `;
      list.appendChild(div);
    });

    // Wire Edit actions
    list.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        const item = portfolio[idx];
        if (!item) return;

        editingInvIndex = idx;

        // Change Title & Button label
        const formContainer = document.getElementById('adminAddInvForm');
        if (formContainer) {
          formContainer.previousElementSibling.textContent = 'Anlage bearbeiten';
          document.getElementById('btnSubmitInv').textContent = 'Anlage aktualisieren';
          document.getElementById('btnCancelEditInv').style.display = 'inline-block';
          
          // Scroll to form smoothly
          formContainer.scrollIntoView({ behavior: 'smooth' });
        }

        // Populate fields
        document.getElementById('invBank').value = item.bank || '';
        document.getElementById('invType').value = item.type || '';
        document.getElementById('invAmount').value = item.amount || '';
        document.getElementById('invYield').value = item.yield || '';
        document.getElementById('invStart').value = item.startDate || '';
        document.getElementById('invEnd').value = item.endDate || '';
        document.getElementById('invMonths').value = item.months || '';
        document.getElementById('invCoOwners').value = item.coOwners || '';
        document.getElementById('invRefBank').value = item.refBank || '';
        document.getElementById('invRefIban').value = item.refIban || '';
        document.getElementById('invContractNo').value = item.contractNo || '';
        document.getElementById('invStatus').value = item.status || 'aktiv';
      });
    });

    // Wire Delete actions
    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = e.target.getAttribute('data-index');
        if (confirm("Möchten Sie diese Anlage wirklich dauerhaft aus dem Portfolio löschen?")) {
          portfolio.splice(idx, 1);
          try {
            await setDoc(doc(db, "users", selectedUserId), { portfolio: portfolio }, { merge: true });
          } catch (error) {
            alert("Fehler beim Löschen der Anlage: " + error.message);
          }
        }
      });
    });
  };

  // ==========================================
  // ---- 4. PROFILE MODIFICATIONS ----
  // ==========================================
  const adminProfileForm = document.getElementById('adminProfileForm');
  if (adminProfileForm) {
    adminProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedUserId) return;

      const fName = document.getElementById('editFirstName').value.trim();
      const lName = document.getElementById('editLastName').value.trim();
      const bDate = document.getElementById('editBirthDate').value;
      const phone = document.getElementById('editPhone').value.trim();
      const saveMsg = document.getElementById('profSaveMsg');

      try {
        await setDoc(doc(db, "users", selectedUserId), {
          firstName: fName,
          lastName: lName,
          birthDate: bDate,
          phone: phone
        }, { merge: true });

        saveMsg.textContent = "Erfolgreich gespeichert!";
        setTimeout(() => { saveMsg.textContent = ""; }, 3000);
      } catch (error) {
        alert("Fehler beim Speichern: " + error.message);
      }
    });
  }

  // ==========================================
  // ---- 5. ADD INVESTMENT TO USER ----
  // ==========================================
  const adminAddInvForm = document.getElementById('adminAddInvForm');
  if (adminAddInvForm) {
    adminAddInvForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedUserId) return;

      // Get user document directly to retrieve the latest portfolio array
      const userRef = doc(db, "users", selectedUserId);
      let currentPortfolio = [];
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          currentPortfolio = userSnap.data().portfolio || [];
        }
      } catch (err) {
        console.error("Error reading user portfolio:", err);
      }

      const newInv = {
        bank: document.getElementById('invBank').value.trim(),
        type: document.getElementById('invType').value.trim(),
        amount: document.getElementById('invAmount').value.trim(),
        yield: document.getElementById('invYield').value.trim(),
        startDate: document.getElementById('invStart').value,
        endDate: document.getElementById('invEnd').value,
        months: document.getElementById('invMonths').value.trim(),
        coOwners: document.getElementById('invCoOwners').value.trim(),
        refBank: document.getElementById('invRefBank').value.trim(),
        refIban: document.getElementById('invRefIban').value.trim(),
        contractNo: document.getElementById('invContractNo').value.trim(),
        status: document.getElementById('invStatus').value
      };

      const isEditing = editingInvIndex !== null;
      if (isEditing) {
        currentPortfolio[editingInvIndex] = newInv;
      } else {
        currentPortfolio.push(newInv);
      }

      try {
        await setDoc(userRef, { portfolio: currentPortfolio }, { merge: true });
        adminAddInvForm.reset();
        
        if (isEditing) {
          editingInvIndex = null;
          adminAddInvForm.previousElementSibling.textContent = 'Neue Anlage hinzufügen';
          document.getElementById('btnSubmitInv').textContent = 'Anlage dem Kunden hinzufügen';
          document.getElementById('btnCancelEditInv').style.display = 'none';
          alert("Anlage wurde erfolgreich aktualisiert!");
        } else {
          alert("Anlage wurde erfolgreich hinzugefügt!");
        }
      } catch (error) {
        alert("Fehler beim Speichern: " + error.message);
      }
    });
  }

  const btnCancelEditInv = document.getElementById('btnCancelEditInv');
  if (btnCancelEditInv) {
    btnCancelEditInv.addEventListener('click', () => {
      editingInvIndex = null;
      if (adminAddInvForm) {
        adminAddInvForm.reset();
        adminAddInvForm.previousElementSibling.textContent = 'Neue Anlage hinzufügen';
      }
      const submitBtn = document.getElementById('btnSubmitInv');
      if (submitBtn) {
        submitBtn.textContent = 'Anlage dem Kunden hinzufügen';
      }
      btnCancelEditInv.style.display = 'none';
    });
  }

  // ==========================================
  // ---- 6. PASSWORD RESET LINK SENDER ----
  // ==========================================
  const btnResetPassword = document.getElementById('btnResetPassword');
  if (btnResetPassword) {
    btnResetPassword.addEventListener('click', async () => {
      if (!selectedUserId) return;
      const email = document.getElementById('editEmail').value;
      const resetMsg = document.getElementById('resetMsg');

      if (confirm(`Möchten Sie wirklich eine E-Mail zum Zurücksetzen des Passworts an ${email} senden?`)) {
        try {
          await sendPasswordResetEmail(auth, email);
          resetMsg.style.color = "green";
          resetMsg.textContent = "E-Mail erfolgreich gesendet!";
        } catch (error) {
          resetMsg.style.color = "red";
          resetMsg.textContent = "Fehler: " + error.message;
        }
        setTimeout(() => { resetMsg.textContent = ""; }, 4000);
      }
    });
  }

  const btnImpersonateUser = document.getElementById('btnImpersonateUser');
  if (btnImpersonateUser) {
    btnImpersonateUser.addEventListener('click', () => {
      if (!selectedUserId) return;
      sessionStorage.setItem('impersonateUid', selectedUserId);
      sessionStorage.setItem('otpVerified', 'true');
      window.location.href = 'dashboard.html';
    });
  }

  // ==========================================
  // ---- 6.5. CREATE USER FLOW ----
  // ==========================================
  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const btnCreateUserView = document.getElementById('btnCreateUserView');
  const createUserPanel = document.getElementById('createUserPanel');
  const adminMain = document.getElementById('adminMain');
  const emptyMain = document.getElementById('emptyMain');
  const adminCreateUserForm = document.getElementById('adminCreateUserForm');
  const btnGeneratePassword = document.getElementById('btnGeneratePassword');
  const btnCancelCreateUser = document.getElementById('btnCancelCreateUser');
  const createErrorMsg = document.getElementById('createErrorMsg');
  const createSuccessMsg = document.getElementById('createSuccessMsg');

  const showCreateError = (msg) => {
    createErrorMsg.textContent = msg;
    createErrorMsg.style.display = 'block';
    createSuccessMsg.style.display = 'none';
  };

  const showCreateSuccess = (msg) => {
    createSuccessMsg.textContent = msg;
    createSuccessMsg.style.display = 'block';
    createErrorMsg.style.display = 'none';
  };

  if (btnCreateUserView) {
    btnCreateUserView.addEventListener('click', () => {
      // Deselect user list active state
      document.querySelectorAll('.admin-user-item').forEach(el => el.classList.remove('active'));
      selectedUserId = null;
      if (unsubscribeSelected) {
        unsubscribeSelected();
        unsubscribeSelected = null;
      }

      // Toggle views
      emptyMain.style.display = 'none';
      adminMain.style.display = 'none';
      createUserPanel.style.display = 'block';

      // Reset form
      if (adminCreateUserForm) {
        adminCreateUserForm.reset();
      }
      createErrorMsg.style.display = 'none';
      createSuccessMsg.style.display = 'none';
    });
  }

  if (btnGeneratePassword) {
    btnGeneratePassword.addEventListener('click', () => {
      const passField = document.getElementById('createPassword');
      if (passField) {
        const generated = generateRandomPassword();
        passField.value = generated;
      }
    });
  }

  if (btnCancelCreateUser) {
    btnCancelCreateUser.addEventListener('click', () => {
      createUserPanel.style.display = 'none';
      emptyMain.style.display = 'flex';
      if (adminCreateUserForm) {
        adminCreateUserForm.reset();
      }
    });
  }

  if (adminCreateUserForm) {
    adminCreateUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = document.getElementById('createFirstName').value.trim();
      const lastName = document.getElementById('createLastName').value.trim();
      const birthDate = document.getElementById('createBirthDate').value;
      const email = document.getElementById('createEmail').value.trim();
      const phone = document.getElementById('createPhone').value.trim();
      const password = document.getElementById('createPassword').value.trim();
      const btn = document.getElementById('btnSubmitCreateUser');

      btn.disabled = true;
      btn.textContent = "Erstellt...";
      createErrorMsg.style.display = 'none';
      createSuccessMsg.style.display = 'none';

      try {
        // Register in secondary auth
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const user = userCredential.user;

        // Write user profile to Firestore
        await setDoc(doc(db, "users", user.uid), {
          firstName: firstName,
          lastName: lastName,
          birthDate: birthDate,
          email: email,
          phone: phone,
          portfolio: []
        });

        // Sign out of secondary auth session to clean up
        await signOut(secondaryAuth);

        showCreateSuccess(`Konto erfolgreich erstellt für ${firstName} ${lastName}!`);
        adminCreateUserForm.reset();

        // Reload user list in sidebar
        await loadUsers();

        setTimeout(() => {
          createUserPanel.style.display = 'none';
          emptyMain.style.display = 'flex';
        }, 3000);

      } catch (error) {
        showCreateError("Fehler beim Erstellen des Benutzers: " + error.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Kunden registrieren";
      }
    });
  }

  // ==========================================
  // ---- 7. LOGOUT ----
  // ==========================================
  document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
      window.location.href = 'index.html';
    });
  });

});
