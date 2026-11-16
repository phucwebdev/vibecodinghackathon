/* =========================================================
   ĐỒNG BỘ FIREBASE (tùy chọn) – Firestore
   Bật: CONFIG.firebase.enabled = true + bỏ comment <script type="module" src="js/firebase.js"> trong index.html
   Dữ liệu vẫn lưu localStorage trước → mất mạng/Firebase lỗi app vẫn chạy.
   ========================================================= */
import { app } from './firebase-init.js';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const cfg = window.CONFIG && window.CONFIG.firebase;
if (cfg && cfg.enabled) {
  try {
    const db = getFirestore(app);
    const col = collection(db, cfg.collection);
    const clean = (x) => JSON.parse(JSON.stringify(x));   // Firestore không nhận undefined

    window.Remote = {
      load: async () => (await getDocs(col)).docs.map((d) => d.data()),
      upsert: (item) => setDoc(doc(col, item.id), clean(item)),
      remove: (id) => deleteDoc(doc(col, id)),
      replaceAll: async (items) => {
        const old = await getDocs(col);
        const batch = writeBatch(db);                     // tối đa 500 thao tác/lần – đủ cho dữ liệu thi
        old.docs.forEach((d) => batch.delete(d.ref));
        items.forEach((x) => batch.set(doc(col, x.id), clean(x)));
        return batch.commit();
      }
    };

    const start = () => window.Remote.load()
      .then((list) => { if (list.length) window.App.data.loadRemote(list); else window.Remote.replaceAll(window.App.data.all()); })
      .catch(() => window.UI && UI.toast('Đang dùng dữ liệu trên máy này (chưa kết nối được máy chủ).', 'info'));

    /* Module chạy sau các script defer → App đã sẵn sàng */
    if (window.App && window.App.router) start();
    else window.addEventListener('load', start);
  } catch (e) {
    console.warn('Firebase chưa khởi tạo được, dùng dữ liệu cục bộ.', e);
  }
}
