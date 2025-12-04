// ไฟล์นี้ใช้สำหรับสร้าง admin user ใน Firebase
// เรียกใช้เมื่อต้องการสร้าง admin user ครั้งแรก

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { USER_ROLES } from '@/types';

export const createAdminUser = async () => {
  try {
    // สร้าง admin user
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      'admin@mekong.com', 
      'admin123'
    );
    
    const user = userCredential.user;
    
    // สร้าง profile ใน Firestore
    await setDoc(doc(db, 'webUsers', user.uid), {
      uid: user.uid,
      email: user.email,
      role: USER_ROLES.ADMIN,
      firstName: 'Admin',
      lastName: 'Mekong',
      organization: 'Mekong Fish Dashboard',
      createdAt: new Date(),
      lastLogin: new Date(),
      isActive: true
    });

    console.log('Admin user created successfully');
    return user;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
};

export const createResearcherUser = async () => {
  try {
    // สร้าง researcher user
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      'researcher@mekong.com', 
      'research123'
    );
    
    const user = userCredential.user;
    
    // สร้าง profile ใน Firestore
    await setDoc(doc(db, 'webUsers', user.uid), {
      uid: user.uid,
      email: user.email,
      role: USER_ROLES.RESEARCHER,
      firstName: 'นักวิจัย',
      lastName: 'แม่น้ำโขง',
      organization: 'สถาบันวิจัยประมง',
      createdAt: new Date(),
      lastLogin: new Date(),
      isActive: true
    });

    console.log('Researcher user created successfully');
    return user;
  } catch (error) {
    console.error('Error creating researcher user:', error);
    throw error;
  }
};