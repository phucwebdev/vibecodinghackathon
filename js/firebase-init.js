/* Khởi tạo Firebase 1 lần, dùng chung cho auth.js và firebase.js (module được nạp 1 lần duy nhất).
   Config web Firebase là thông tin công khai, không phải khóa bí mật. Đã bỏ Analytics. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyBESVfS2Bj9oHQlDdaJ9Zx8ZCWYoRFS2CM',
  authDomain: 'vibecoding-c4196.firebaseapp.com',
  projectId: 'vibecoding-c4196',
  storageBucket: 'vibecoding-c4196.firebasestorage.app',
  messagingSenderId: '218982239073',
  appId: '1:218982239073:web:369159662702d2aada1320'
};

export const app = initializeApp(firebaseConfig);
