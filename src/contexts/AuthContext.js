'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { USER_ROLES } from '@/types';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUser(user);
          // ดึงข้อมูล profile จาก Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // ถ้าไม่มี role ให้สร้างใหม่
            if (!userData.role) {
              const updatedProfile = {
                ...userData,
                role: USER_ROLES.ADMIN,
                name: userData.name || 'Admin System'
              };
              await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
              setUserProfile(updatedProfile);
            } else {
              // แปลง Firestore timestamps เป็น Date objects
              const profile = {
                ...userData,
                createdAt: userData.createdAt?.toDate?.() || new Date(),
                lastLogin: userData.lastLogin?.toDate?.() || new Date(),
                lastActivity: userData.lastActivity ? new Date(userData.lastActivity) : new Date()
              };
              setUserProfile(profile);
            }
          } else {
            console.log('No user profile found, creating default profile');
            // ถ้าไม่มีข้อมูล profile ให้สร้างใหม่
            const now = new Date();
            // กำหนด role ตาม email
            let defaultRole = USER_ROLES.RESEARCHER;
            if (user.email === 'admin@mekong.com') {
              defaultRole = USER_ROLES.ADMIN;
            }
            
            const defaultProfile = {
              uid: user.uid,
              email: user.email,
              role: defaultRole,
              name: user.email === 'admin@mekong.com' ? 'Admin System' : 'User',
              phone: '',
              village: '',
              district: '',
              province: '',
              isActive: true,
              createdAt: now,
              lastLogin: now,
              lastActivity: now.toISOString()
            };
            await setDoc(doc(db, 'users', user.uid), defaultProfile);
            setUserProfile(defaultProfile);
          }
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // อัพเดท lastLogin
      if (result.user) {
        await setDoc(doc(db, 'users', result.user.uid), {
          lastLogin: new Date()
        }, { merge: true });
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const createUser = async (email, password, profileData) => {
    try {
      setError(null);
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // สร้าง profile ใน Firestore
      const now = new Date();
      const userProfile = {
        uid: result.user.uid,
        email: result.user.email,
        ...profileData,
        createdAt: now,
        lastLogin: now
      };
      
      await setDoc(doc(db, 'users', result.user.uid), userProfile);
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (requiredRole) => {
    if (!userProfile) return false;
    
    // Admin มีสิทธิ์ทุกอย่าง
    if (userProfile.role === USER_ROLES.ADMIN) return true;
    
    // ตรวจสอบ role ที่เจาะจง
    return userProfile.role === requiredRole;
  };

  const hasAnyRole = (roles) => {
    if (!userProfile) return false;
    
    // Admin มีสิทธิ์ทุกอย่าง
    if (userProfile.role === USER_ROLES.ADMIN) return true;
    
    // ตรวจสอบว่ามี role ใดใน array หรือไม่
    return roles.includes(userProfile.role);
  };

  const value = {
    user,
    userProfile,
    loading,
    error,
    login,
    logout,
    createUser,
    hasRole,
    hasAnyRole,
    isAuthenticated: !!user,
    isAdmin: userProfile?.role === USER_ROLES.ADMIN,
    isResearcher: userProfile?.role === USER_ROLES.RESEARCHER,
    isGovernment: userProfile?.role === USER_ROLES.GOVERNMENT,
    isCommunityManager: userProfile?.role === USER_ROLES.COMMUNITY_MANAGER,
    isFisher: userProfile?.role === USER_ROLES.FISHER
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};