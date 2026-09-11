// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEuoFhLTprPCaqxYQ5Sj4gAIL5rF-TeKI",
  authDomain: "pai-sapp.firebaseapp.com",
  projectId: "pai-sapp",
  storageBucket: "pai-sapp.firebasestorage.app",
  messagingSenderId: "1027870933703",
  appId: "1:1027870933703:web:64d3e9b40a9e3fcd86b4e2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Firestore reference
const db = firebase.firestore();

// Helper functions
async function getTableInfo(qrCode) {
  try {
    const snapshot = await db.collection('tables').where('qr_code', '==', qrCode).get();
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

async function getMenuItems(category = null) {
  try {
    let query = db.collection('menu');
    if (category) query = query.where('category', '==', category);
    const snapshot = await query.orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

async function createOrder(tableId) {
  try {
    const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const ref = await db.collection('orders').add({
      order_id: orderId,
      table_id: tableId,
      status: 'pending',
      total: 0,
      payment_status: 'unpaid',
      device_id: localStorage.getItem('device_id') || '',
      created_at: new Date(),
      items: []
    });
    return { id: ref.id, order_id: orderId };
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

async function addOrderItem(orderId, menuItemId, quantity, notes) {
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const menuRef = db.collection('menu').doc(menuItemId);

    const menuDoc = await menuRef.get();
    if (!menuDoc.exists) return false;

    const menuItem = menuDoc.data();
    const item = {
      menu_item_id: menuItemId,
      quantity: quantity,
      unit_price: menuItem.price,
      notes: notes,
      prepared: false
    };

    await orderRef.update({
      items: firebase.firestore.FieldValue.arrayUnion(item),
      total: firebase.firestore.FieldValue.increment(menuItem.price * quantity)
    });

    return true;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await db.collection('orders').doc(orderId).update({
      status: status,
      updated_at: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

async function getAdminOrders() {
  try {
    const snapshot = await db.collection('orders')
      .where('status', 'in', ['pending', 'confirmed', 'preparing', 'ready'])
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}
