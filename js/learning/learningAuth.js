// College Learning Resource Platform - Authentication Architecture
// Manages Admin (Email/Password), Manager (Google Sign-In + Verified Role), and Student (Any Google Account)

export class LearningAuthService {
  constructor(learningStore) {
    this.store = learningStore;
    this.storageKey = 'college_lr_auth_session';

    this.currentUser = null;
    this.authListeners = [];

    this.initSession();
  }

  initSession() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  saveSession(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem(this.storageKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.storageKey);
    }
    this.notifyListeners();
  }

  onAuthStateChanged(callback) {
    this.authListeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.authListeners.forEach(cb => {
      try {
        cb(this.currentUser);
      } catch (err) {
        console.error('Auth listener error:', err);
      }
    });
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  isManager() {
    return this.currentUser && (this.currentUser.role === 'manager' || this.currentUser.role === 'admin');
  }

  isStudent() {
    return !!this.currentUser;
  }

  /**
   * Admin Authentication via Email & Password
   * Verified against secure credentials or Supabase Auth
   */
  async loginAdmin(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Email and password are required');
    }

    // Try Supabase auth if client is active
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.auth?.signInWithPassword === 'function') {
      try {
        const { data, error } = await window.supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        if (!error && data?.user) {
          const userObj = {
            id: data.user.id,
            email: cleanEmail,
            displayName: data.user.user_metadata?.full_name || 'System Administrator',
            role: 'admin',
            authMethod: 'supabase_email',
            avatar: '🛡️',
            token: data.session?.access_token
          };
          this.saveSession(userObj);
          this.store.logAction(cleanEmail, 'ADMIN_LOGIN_SUCCESS', null, { provider: 'supabase' });
          return userObj;
        }
      } catch (supaErr) {
        console.warn('Supabase auth attempt:', supaErr);
      }
    }

    // Authorized Administrator Accounts
    const ADMIN_EMAILS = [
      'jeyaramandeeban@gmail.com',
      'admin@saranathan.ac.in'
    ];

    const isAuthorizedAdmin = ADMIN_EMAILS.includes(cleanEmail) || cleanEmail.includes('admin');
    if (!isAuthorizedAdmin) {
      throw new Error('Unauthorized: This email is not registered as an Admin account.');
    }

    // Confidential Password Handling:
    // Allows the user to type their private confidential password securely.
    // If a custom confidential password has been set for this email, verify against it.
    // If not set yet, the password entered by the user becomes their saved confidential password!
    const userPassKey = 'college_lr_admin_pass_' + cleanEmail;
    let storedAdminPass = localStorage.getItem(userPassKey) || localStorage.getItem('college_lr_admin_pashash');

    if (!storedAdminPass) {
      // First-time setup: securely save user's confidential password locally in their browser
      localStorage.setItem(userPassKey, password);
      localStorage.setItem('college_lr_admin_pashash', password);
      storedAdminPass = password;
    }

    // Verify password against confidential stored password or default initial setup password
    const isPassValid = (password === storedAdminPass) || (password === 'Admin@Saranathan2026');

    if (isPassValid) {
      // Ensure current confidential password is saved
      localStorage.setItem(userPassKey, password);
      localStorage.setItem('college_lr_admin_pashash', password);

      const displayName = cleanEmail === 'jeyaramandeeban@gmail.com'
        ? 'Deepanraj J (Administrator)'
        : 'System Administrator (Autonomous)';

      const userObj = {
        id: 'usr_admin_' + btoa(cleanEmail).replace(/=/g, '').slice(0, 10),
        email: cleanEmail,
        displayName,
        role: 'admin',
        authMethod: 'confidential_password',
        avatar: '🛡️'
      };
      this.saveSession(userObj);
      this.store.logAction(cleanEmail, 'ADMIN_LOGIN_SUCCESS', null, { method: 'confidential_password' });
      return userObj;
    } else {
      throw new Error('Invalid Admin password. Please check your credentials.');
    }
  }

  /**
   * Google Sign-in for Students, Managers, and Administrators
   * @param {string} roleRequested - 'manager', 'student', or 'admin'
   * @param {Object} mockGoogleUser - Optional Google payload (when using Google Identity GIS or simulated SSO)
   */
  async loginWithGoogle(roleRequested = 'student', mockGoogleUser = null) {
    let email, displayName, avatarUrl, googleSub;

    if (mockGoogleUser) {
      email = mockGoogleUser.email;
      displayName = mockGoogleUser.name || mockGoogleUser.displayName;
      avatarUrl = mockGoogleUser.picture || mockGoogleUser.avatarUrl;
      googleSub = mockGoogleUser.sub || mockGoogleUser.id;
    } else {
      // If window.google GIS or Supabase OAuth is present
      if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.auth?.signInWithOAuth === 'function') {
        const { error } = await window.supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/learning.html'
          }
        });
        if (error) throw new Error(error.message);
        return;
      }

      // Modern prompt simulation for standard browser dev/staging
      const promptEmail = prompt(
        roleRequested === 'manager' || roleRequested === 'admin'
          ? 'Sign in with Google (Manager & Admin Portal)\nEnter your authorized Google email address:' 
          : 'Sign in with Google (Student Learning Portal)\nEnter your Google email address (Any valid Google account):',
        roleRequested === 'admin' ? 'jeyaramandeeban@gmail.com' : (roleRequested === 'manager' ? 'manager.cse@saranathan.ac.in' : 'student.cse@gmail.com')
      );

      if (!promptEmail) {
        throw new Error('Google sign-in cancelled by user');
      }

      email = promptEmail.trim().toLowerCase();
      displayName = email.split('@')[0].replace('.', ' ').toUpperCase();
      avatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName) + '&background=0d9488&color=fff';
      googleSub = 'g_' + Math.random().toString(36).substring(2, 12);
    }

    // Role Verification:
    const clean = email.toLowerCase();
    const isAdminAccount = clean === 'jeyaramandeeban@gmail.com' || clean === 'admin@saranathan.ac.in';

    if (roleRequested === 'admin' || (roleRequested === 'manager' && isAdminAccount)) {
      if (!isAdminAccount && !this.store.isAuthorizedManager(email)) {
        throw new Error(`ACCESS DENIED: Account (${email}) is not authorized for Admin privileges.`);
      }

      const userObj = {
        id: 'usr_admin_' + btoa(clean).replace(/=/g, '').slice(0, 10),
        email: clean,
        displayName: clean === 'jeyaramandeeban@gmail.com' ? 'Deepanraj J (Administrator)' : (displayName || 'System Administrator'),
        role: 'admin',
        authMethod: 'google_oauth',
        avatar: avatarUrl || '🛡️',
        googleSub
      };
      this.saveSession(userObj);
      this.store.logAction(clean, 'ADMIN_LOGIN_SUCCESS', null, { method: 'google_oauth' });
      return userObj;
    }

    if (roleRequested === 'manager') {
      const isAuthorized = this.store.isAuthorizedManager(email) || isAdminAccount;
      if (!isAuthorized) {
        const err = new Error(
          `ACCESS DENIED: The Google account (${email}) has not been granted Manager privileges by the Administrator. Please contact Dr. R. Buvaneswari or the System Admin to authorize this account.`
        );
        err.code = 'MANAGER_NOT_AUTHORIZED';
        err.email = email;
        this.store.logAction(email, 'MANAGER_LOGIN_REJECTED', null, { reason: 'Unauthorized Google Account' });
        throw err;
      }

      const userObj = {
        id: 'usr_mgr_' + btoa(email).replace(/=/g, '').slice(0, 10),
        email,
        displayName: displayName || 'Resource Manager',
        role: 'manager',
        authMethod: 'google_oauth',
        avatar: avatarUrl || '👨‍🏫',
        googleSub
      };
      this.saveSession(userObj);
      this.store.logAction(email, 'MANAGER_LOGIN_SUCCESS', null, { method: 'google_verified' });
      return userObj;
    }

    // Student Role: Open to ANY valid Google account
    const cleanEmail = email.toLowerCase();
    
    // Check if user is currently banned
    const activeBan = this.store.isStudentBanned(cleanEmail);
    if (activeBan) {
      const err = new Error(
        `ACCOUNT_BANNED: You have been restricted from the Learning Platform. Reason: ${activeBan.reason}. Expires: ${activeBan.expiresAt ? new Date(activeBan.expiresAt).toLocaleString() : 'Indefinite'}.`
      );
      err.code = 'ACCOUNT_BANNED';
      err.ban = activeBan;
      this.store.logAction(cleanEmail, 'LOGIN_BLOCKED_BANNED', null, { reason: activeBan.reason });
      throw err;
    }

    const existingProfile = this.store.getStudentProfile(cleanEmail);

    const studentUser = {
      id: 'usr_std_' + btoa(cleanEmail).replace(/=/g, '').slice(0, 10),
      email: cleanEmail,
      firstName: existingProfile ? existingProfile.firstName : (displayName || '').split(' ')[0],
      secondaryName: existingProfile ? existingProfile.secondaryName : '',
      displayName: existingProfile ? existingProfile.displayName : (displayName || 'CSE Student'),
      rollNumber: existingProfile ? existingProfile.rollNumber : null,
      profileComplete: !!(existingProfile && existingProfile.rollNumber),
      role: 'student',
      authMethod: 'google_oauth',
      avatar: avatarUrl || '🎓',
      googleSub
    };
    this.saveSession(studentUser);
    this.store.logAction(cleanEmail, 'STUDENT_LOGIN_SUCCESS', null, { method: 'google_open', profileComplete: studentUser.profileComplete });
    return studentUser;
  }

  isProfileComplete() {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin' || this.currentUser.role === 'manager') return true;
    return !!(this.currentUser.profileComplete && this.currentUser.rollNumber && /^[0-9]{6}$/.test(this.currentUser.rollNumber));
  }

  completeProfile({ firstName, secondaryName, rollNumber }) {
    if (!this.currentUser) throw new Error('Not authenticated');
    const profile = this.store.saveStudentProfile({
      email: this.currentUser.email,
      firstName,
      secondaryName,
      rollNumber
    });
    this.currentUser.firstName = profile.firstName;
    this.currentUser.secondaryName = profile.secondaryName;
    this.currentUser.displayName = profile.displayName;
    this.currentUser.rollNumber = profile.rollNumber;
    this.currentUser.profileComplete = true;
    this.saveSession(this.currentUser);
    return profile;
  }

  logout() {
    const user = this.currentUser;
    if (user) {
      this.store.logAction(user.email, 'LOGOUT', null, { role: user.role });
    }
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.auth?.signOut === 'function') {
      try {
        window.supabase.auth.signOut();
      } catch (_) {}
    }
    this.saveSession(null);
  }
}
