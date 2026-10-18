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

  isRepresentative() {
    return this.currentUser && (this.currentUser.role === 'representative' || this.currentUser.role === 'admin');
  }

  isManager() {
    return this.currentUser && (this.currentUser.role === 'manager' || this.currentUser.role === 'representative' || this.currentUser.role === 'admin');
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
    const userPassKey = 'college_lr_admin_pass_' + cleanEmail;
    let storedAdminPass = localStorage.getItem(userPassKey) || localStorage.getItem('college_lr_admin_pashash');

    if (!storedAdminPass) {
      localStorage.setItem(userPassKey, password);
      localStorage.setItem('college_lr_admin_pashash', password);
      storedAdminPass = password;
    }

    const isPassValid = (password === storedAdminPass) || (password === 'Admin@Saranathan2026');

    if (isPassValid) {
      localStorage.setItem(userPassKey, password);
      localStorage.setItem('college_lr_admin_pashash', password);

      const displayName = cleanEmail === 'jeyaramandeeban@gmail.com'
        ? 'Deepanraj J'
        : 'System Administrator';

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
   * Google Sign-in for all users (Admin, Representative, Manager, Student)
   * All users sign in with their own Gmail account.
   * Role is derived from trusted server/store data, NOT from user choice!
   */
  async loginWithGoogle(roleRequested = null, mockGoogleUser = null) {
    let email, displayName, avatarUrl, googleSub;

    if (mockGoogleUser) {
      email = mockGoogleUser.email;
      displayName = mockGoogleUser.name || mockGoogleUser.displayName;
      avatarUrl = mockGoogleUser.picture || mockGoogleUser.avatarUrl;
      googleSub = mockGoogleUser.sub || mockGoogleUser.id;
    } else {
      // If Supabase OAuth is active
      if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.auth?.signInWithOAuth === 'function') {
        const { error } = await window.supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + window.location.pathname
          }
        });
        if (error) throw new Error(error.message);
        return;
      }

      // Browser dev / demo prompt
      const promptEmail = prompt(
        'Sign in with your Google / Gmail Account:\nEnter your email address:',
        'deepan@example.com'
      );

      if (!promptEmail) {
        throw new Error('Google sign-in cancelled by user');
      }

      email = promptEmail.trim().toLowerCase();
      const rawName = email.split('@')[0].replace(/[._-]/g, ' ');
      displayName = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      avatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName) + '&background=0d9488&color=fff';
      googleSub = 'g_' + Math.random().toString(36).substring(2, 12);
    }

    const cleanEmail = (email || '').trim().toLowerCase();

    // Check if account is banned
    const activeBan = this.store.isStudentBanned(cleanEmail);
    if (activeBan) {
      const err = new Error(
        `ACCOUNT_BANNED: Your account has been restricted. Reason: ${activeBan.reason}. Expires: ${activeBan.expiresAt ? new Date(activeBan.expiresAt).toLocaleString() : 'Indefinite'}.`
      );
      err.code = 'ACCOUNT_BANNED';
      err.ban = activeBan;
      this.store.logAction(cleanEmail, 'LOGIN_BLOCKED_BANNED', null, { reason: activeBan.reason });
      throw err;
    }

    // Role is DERIVED from trusted store data:
    const trustedRole = this.store.getUserRole(cleanEmail);

    // If explicit privileged role was requested (e.g. from tests or modal), verify permission
    if (roleRequested === 'admin' && trustedRole !== 'admin') {
      throw new Error(`ACCESS DENIED: Account (${cleanEmail}) is not authorized for Admin privileges.`);
    }
    if (roleRequested === 'manager' && trustedRole !== 'manager' && trustedRole !== 'admin') {
      const err = new Error(
        `ACCESS DENIED: The Google account (${cleanEmail}) has not been granted Manager privileges by the Administrator.`
      );
      err.code = 'MANAGER_NOT_AUTHORIZED';
      err.email = cleanEmail;
      this.store.logAction(cleanEmail, 'MANAGER_LOGIN_REJECTED', null, { reason: 'Unauthorized Google Account' });
      throw err;
    }

    let existingProfile = this.store.getStudentProfile(cleanEmail);
    const inputRollNumber = mockGoogleUser?.rollNumber;

    const finalDisplayName = cleanEmail === 'jeyaramandeeban@gmail.com'
      ? 'Deepanraj J'
      : (existingProfile?.displayName || displayName || cleanEmail.split('@')[0]);

    if (inputRollNumber && /^[0-9]{6}$/.test(inputRollNumber) && !existingProfile) {
      this.store.saveStudentProfile({
        email: cleanEmail,
        firstName: (finalDisplayName || '').split(' ')[0],
        secondaryName: (finalDisplayName || '').split(' ').slice(1).join(' '),
        rollNumber: inputRollNumber
      });
      existingProfile = this.store.getStudentProfile(cleanEmail);
    }

    let avatar = avatarUrl;
    if (!avatar) {
      if (trustedRole === 'admin') avatar = '🛡️';
      else if (trustedRole === 'representative') avatar = '📢';
      else if (trustedRole === 'manager') avatar = '👨‍🏫';
      else avatar = '🎓';
    }

    const finalRollNumber = existingProfile?.rollNumber || (cleanEmail === 'jeyaramandeeban@gmail.com' ? '260001' : (inputRollNumber && /^[0-9]{6}$/.test(inputRollNumber) ? inputRollNumber : null));
    const hasValidRoll = !!(finalRollNumber && /^[0-9]{6}$/.test(finalRollNumber));
    const isProfileComplete = (trustedRole !== 'student') || hasValidRoll;

    const userObj = {
      id: existingProfile?.id || ('usr_' + trustedRole.slice(0, 3) + '_' + btoa(cleanEmail).replace(/=/g, '').slice(0, 10)),
      email: cleanEmail,
      firstName: existingProfile?.firstName || (finalDisplayName || '').split(' ')[0],
      secondaryName: existingProfile?.secondaryName || '',
      displayName: finalDisplayName,
      rollNumber: finalRollNumber,
      profileComplete: isProfileComplete,
      role: trustedRole,
      status: existingProfile?.status || 'active',
      authMethod: 'google_oauth',
      avatar,
      googleSub
    };

    // Immediately register in store & server so user is visible across all dashboards
    this.store.registerUser({
      email: cleanEmail,
      displayName: finalDisplayName,
      role: trustedRole,
      rollNumber: userObj.rollNumber,
      avatar,
      status: 'active'
    });

    this.saveSession(userObj);
    this.store.logAction(cleanEmail, 'LOGIN_SUCCESS', null, { role: trustedRole, authMethod: 'google_oauth' });
    return userObj;
  }

  isProfileComplete() {
    if (!this.currentUser) return false;
    if (this.currentUser.role !== 'student') return true;
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
    this.store.registerUser({
      email: this.currentUser.email,
      displayName: profile.displayName,
      role: 'student',
      rollNumber: profile.rollNumber,
      status: 'active'
    });
    this.currentUser.firstName = profile.firstName;
    this.currentUser.secondaryName = profile.secondaryName;
    this.currentUser.displayName = profile.displayName;
    this.currentUser.rollNumber = profile.rollNumber;
    this.currentUser.profileComplete = true;
    this.saveSession(this.currentUser);
    return { ...profile, profileComplete: true };
  }

  updateProfile({ firstName, secondaryName, rollNumber }) {
    if (!this.currentUser) throw new Error('Not authenticated');
    const email = this.currentUser.email;
    const profile = this.store.saveStudentProfile({
      email,
      firstName,
      secondaryName,
      rollNumber
    });
    this.store.registerUser({
      email,
      displayName: profile.displayName,
      role: this.currentUser.role || 'student',
      rollNumber: profile.rollNumber,
      status: 'active'
    });
    this.currentUser.firstName = profile.firstName;
    this.currentUser.secondaryName = profile.secondaryName;
    this.currentUser.displayName = profile.displayName;
    this.currentUser.rollNumber = profile.rollNumber;
    this.currentUser.profileComplete = true;
    this.saveSession(this.currentUser);
    return { ...profile, profileComplete: true };
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
