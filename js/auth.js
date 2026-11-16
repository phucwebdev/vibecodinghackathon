/* =========================================================
   ĐĂNG NHẬP – Firebase Authentication (email/mật khẩu + Google)
   Cung cấp window.Auth cho trang đăng nhập; báo trạng thái qua App.auth.setUser().
   Nếu file này không tải được (mất mạng, mở bằng file://) → app tự chuyển sang
   chế độ "Dùng thử" sau vài giây, không bao giờ trắng màn hình.
   ========================================================= */
import { app } from './firebase-init.js';
import {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const App = window.App;

if (App && App.auth && App.auth.enabled) {
  const auth = getAuth(app);
  auth.languageCode = 'vi';                        // email đặt lại mật khẩu bằng tiếng Việt
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  const google = new GoogleAuthProvider();
  google.setCustomParameters({ prompt: 'select_account' });

  window.Auth = {
    signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
    signUp: async (email, pw, name) => {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      if (name) {
        await updateProfile(cred.user, { displayName: name });
        App.auth.setUser(auth.currentUser);       // cập nhật tên ngay trên giao diện
      }
      return cred;
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    signInGoogle: async () => {
      try {
        return await signInWithPopup(auth, google);
      } catch (err) {
        /* Điện thoại hay chặn popup → chuyển hẳn sang trang Google rồi quay lại */
        if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) {
          await signInWithRedirect(auth, google);
          const e = new Error('redirecting'); e.code = 'auth/redirecting'; throw e;
        }
        throw err;
      }
    },
    signOut: () => signOut(auth)
  };

  getRedirectResult(auth).catch((err) => window.UI && UI.toast(App.authError(err), 'error'));
  onAuthStateChanged(auth, (user) => App.auth.setUser(user));
}
