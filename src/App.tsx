/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Version: 1.1.1
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Search, TrendingUp, DollarSign, Target, Rocket, Loader2, Sparkles, ShoppingBag, CheckCircle2, LogIn, LogOut, User as UserIcon, History, X, Clock, Share2, Copy, Check, Bell, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { getProductRecommendations, getCompetitiveAnalysis } from './services/geminiService';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User, handleFirestoreError, FirestoreOperationType, sendEmailVerification, reload, getMessagingInstance, getToken, onMessage } from './firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc, serverTimestamp, collection, addDoc, query, orderBy, limit } from 'firebase/firestore';

const ChatSupport = lazy(() => import('./components/ChatSupport'));

// Memoized Markdown component to prevent unnecessary re-renders
const MemoizedMarkdown = React.memo(({ content }: { content: string }) => (
  <div className="prose prose-slate max-w-none 
    prose-headings:text-indigo-700 prose-headings:font-bold
    prose-p:text-slate-700 prose-li:text-slate-700">
    <Markdown>{content}</Markdown>
  </div>
));
MemoizedMarkdown.displayName = 'MemoizedMarkdown';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const isConnectionError = this.state.error?.toString().includes('Indexed Database') || 
                               this.state.error?.toString().includes('Connection to');
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-red-600">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {isConnectionError ? 'Error de Conexión' : 'Algo salió mal'}
            </h2>
            <p className="text-slate-600 mb-6">
              {isConnectionError 
                ? 'Se ha perdido la conexión con la base de datos local. Esto suele ocurrir por restricciones del navegador.' 
                : 'Hubo un error inesperado. Por favor, intenta recargar la página.'}
            </p>
            {this.state.error && (
              <div className="bg-slate-50 p-3 rounded-lg text-left mb-6 overflow-auto max-h-32">
                <code className="text-xs text-red-500">{this.state.error.toString()}</code>
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all"
            >
              Recargar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

declare global {
  interface Window {
    paypal?: any;
  }
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ credits: number, isPro: boolean } | null>(null);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [verificationSent, setVerificationSent] = useState(false);
  const [niche, setNiche] = useState('');
  const [budget, setBudget] = useState('bajo');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [competitiveResult, setCompetitiveResult] = useState<string | null>(null);
  const [analyzingCompetitors, setAnalyzingCompetitors] = useState(false);
  const [productToAnalyze, setProductToAnalyze] = useState('');
  const [targetRegion, setTargetRegion] = useState('Global');
  const [feedbackStatus, setFeedbackStatus] = useState<{[key: string]: 'up' | 'down' | null}>({});
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  
  // Performance: Result Caching
  const [recommendationCache, setRecommendationCache] = useState<Record<string, string>>({});
  const [analysisCache, setAnalysisCache] = useState<Record<string, string>>({});

  const isProAccount = userData?.isPro || 
    user?.email === 'yosefamse@gmail.com' || 
    user?.email === 'amselemyosef@gmail.com';

  const [showPricing, setShowPricing] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [localCredits, setLocalCredits] = useState<number>(parseInt(localStorage.getItem('localCredits') || '20'));
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState(42);

  const DAILY_LIMIT = 5;
  const today = new Date().toISOString().split('T')[0];

  const startAdTimer = (callback: () => void) => {
    setShowAdModal(true);
    setAdCountdown(5);
    const timer = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Store the callback to be called when the user clicks "Continue"
    // We'll use a ref or just rely on the modal button's existing logic
  };

  // Live Activity Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUsers(prev => {
        const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const newValue = prev + change;
        return newValue < 10 ? 10 : newValue > 150 ? 150 : newValue;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Push Notifications Setup
  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | undefined;

    const setupNotifications = async () => {
      if (!('Notification' in window)) {
        console.warn("This browser does not support desktop notification");
        return;
      }

      const messaging = await getMessagingInstance();
      if (!messaging) return;

      const vapidKey = import.meta.env.VITE_VAPID_KEY;
      if (!vapidKey) {
        console.warn("VITE_VAPID_KEY is missing. Push notifications registration skipped.");
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, {
            vapidKey: vapidKey
          });
          
          if (token) {
            setFcmToken(token);
            // Save token to user profile
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { fcmToken: token });
          }
        }
      } catch (error) {
        console.error("Error setting up push notifications:", error);
      }

      unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received in foreground: ', payload);
        // You could show a custom toast here
        if (payload.notification) {
          alert(`${payload.notification.title}: ${payload.notification.body}`);
        }
      });
    };

    setupNotifications();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Check for low credits and notify via backend
  useEffect(() => {
    if (user && userData && fcmToken) {
      if (userData.credits < 50) {
        fetch('/api/notifications/check-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            credits: userData.credits,
            token: fcmToken
          })
        }).catch(err => console.error("Error checking credits:", err));
      }
    }
  }, [user, userData, fcmToken]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsEmailVerified(currentUser.emailVerified);
        
        if (!currentUser.emailVerified && !verificationSent) {
          try {
            await sendEmailVerification(currentUser);
            setVerificationSent(true);
          } catch (error) {
            console.error("Error sending verification email:", error);
          }
        }

        // Create user doc if it doesn't exist
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          const isAdmin = currentUser.email === 'yosefamse@gmail.com' || 
                          currentUser.email === 'amselemyosef@gmail.com';

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              credits: isAdmin ? 999999 : 200,
              isPro: isAdmin,
              role: isAdmin ? 'admin' : 'user',
              notificationsEnabled: false,
              notificationFrequency: 'weekly',
              createdAt: serverTimestamp()
            });
          }
        } catch (error) {
          handleFirestoreError(error, FirestoreOperationType.WRITE, `users/${currentUser.uid}`);
        }
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time User Data Listener
  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data() as any);
      } else {
        // If doc doesn't exist yet, it's being created by the auth listener
        setUserData({ credits: 200, isPro: false });
      }
    }, (error) => {
      handleFirestoreError(error, FirestoreOperationType.GET, `users/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user]);

  // Search History Listener
  useEffect(() => {
    if (!user) {
      setSearchHistory([]);
      return;
    }
    const searchesRef = collection(db, 'users', user.uid, 'searches');
    const q = query(searchesRef, orderBy('timestamp', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSearchHistory(history);
    }, (error) => {
      handleFirestoreError(error, FirestoreOperationType.GET, `users/${user.uid}/searches`);
    });
    return () => unsubscribe();
  }, [user]);

  // PayPal SDK Loader
  useEffect(() => {
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
    if (!clientId || clientId === "YOUR_PAYPAL_CLIENT_ID") {
      console.warn("PayPal Client ID is missing or using placeholder. PayPal buttons will not load.");
      return;
    }

    const scriptId = 'paypal-sdk-script';
    if (document.getElementById(scriptId)) {
      setPaypalLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.addEventListener('load', () => setPaypalLoaded(true));
    document.body.appendChild(script);

    // Initialize local credits if not present
    if (!localStorage.getItem('localCredits')) {
      localStorage.setItem('localCredits', '20');
    }
  }, []);

  // PayPal Buttons Renderer
  useEffect(() => {
    if (paypalLoaded && showPricing && window.paypal && user) {
      const renderButtons = (containerId: string, amount: string) => {
        const container = document.getElementById(containerId);
        if (container && container.innerHTML === "") {
          window.paypal.Buttons({
            createOrder: (data: any, actions: any) => {
              return actions.order.create({
                purchase_units: [{
                  amount: { value: amount },
                  payee: { email_address: 'Yosefamse@gmail.com' }
                }]
              });
            },
            onApprove: async (data: any, actions: any) => {
              try {
                const details = await actions.order.capture();
                const userRef = doc(db, 'users', user.uid);
                
                if (amount === '1.99') {
                  // Micro-transaction: 200 credits
                  await updateDoc(userRef, {
                    credits: (userData?.credits || 0) + 200
                  });
                  alert("¡Gracias! Se han añadido 200 créditos a tu cuenta.");
                } else {
                  // Subscription: Pro status
                  await updateDoc(userRef, {
                    isPro: true,
                    credits: 9999
                  });
                  alert("¡Felicidades! Ahora eres usuario PRO.");
                }
                
                setShowPricing(false);
              } catch (error) {
                handleFirestoreError(error, FirestoreOperationType.UPDATE, `users/${user.uid}`);
              }
            }
          }).render(`#${containerId}`);
        }
      };

      renderButtons('paypal-button-credits', '1.99');
      renderButtons('paypal-button-monthly', '9.99');
      renderButtons('paypal-button-yearly', '79.00');
    }
  }, [paypalLoaded, showPricing, showAdModal, user, userData]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Error logging in:", error);
      alert(`Error al iniciar sesión: ${error.message || error}`);
    }
  };

  const handleGuestLogin = () => {
    const guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
    const guestUser = {
      uid: guestId,
      displayName: 'Invitado',
      email: 'invitado@dropshipgenius.com',
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
      isGuest: true
    };
    setUser(guestUser as any);
    setUserData({
      uid: guestId,
      credits: 100,
      isPro: false,
      role: 'user',
      isGuest: true
    } as any);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche) return;

    setLoading(true);
    setResult(null);
    setCompetitiveResult(null);
    setProductToAnalyze('');
    
    if (!user) {
      if (localCredits < 20) {
        handleLogin();
        return;
      }
      
      // Check local daily limit
      const localLastDate = localStorage.getItem('localLastSearchDate');
      const localCount = parseInt(localStorage.getItem('localDailySearchCount') || '0');
      
      if (localLastDate === today && localCount >= DAILY_LIMIT) {
        setShowLimitModal(true);
        return;
      }

      // Always show ads for non-logged users
      startAdTimer(performSearch);
      return;
    } else if (userData && !isProAccount) {
      // Check daily limit for logged users
      const userLastDate = (userData as any).lastSearchDate;
      const userCount = (userData as any).dailySearchCount || 0;

      if (userLastDate === today && userCount >= DAILY_LIMIT) {
        setShowLimitModal(true);
        return;
      }

      if (userData.credits < 20) {
        setShowPricing(true);
        return;
      }
    }

    // Interstitial Ad for non-PRO users
    if (!isProAccount) {
      startAdTimer(performSearch);
      return;
    }

    performSearch();
  };

  const performSearch = async () => {
    const cacheKey = `${niche}-${budget}`;
    if (recommendationCache[cacheKey]) {
      setResult(recommendationCache[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setResult(null);
    const recommendations = await getProductRecommendations(niche, budget);
    setResult(recommendations);
    
    // Update cache
    setRecommendationCache(prev => ({ ...prev, [cacheKey]: recommendations }));

    if (user && !(user as any).isGuest) {
      const userRef = doc(db, 'users', user.uid);
      const searchesRef = collection(db, 'users', user.uid, 'searches');
      
      try {
        // Save search to history
        await addDoc(searchesRef, {
          niche,
          budget,
          result: recommendations,
          timestamp: serverTimestamp()
        });

        // Decrement credits and increment daily count if not pro
        if (!isProAccount) {
          const currentCount = (userData as any)?.lastSearchDate === today ? ((userData as any)?.dailySearchCount || 0) : 0;
          await updateDoc(userRef, {
            credits: Math.max(0, (userData?.credits || 0) - 20),
            dailySearchCount: currentCount + 1,
            lastSearchDate: today
          });
        }
      } catch (error) {
        handleFirestoreError(error, FirestoreOperationType.WRITE, `users/${user.uid}/searches`);
      }
    } else if ((user as any)?.isGuest) {
      // Guest credits logic
      setUserData(prev => ({
        ...prev!,
        credits: Math.max(0, (prev?.credits || 0) - 20)
      }));
    } else {
      // Decrement local credits and increment local daily count
      const currentLocalCredits = parseInt(localStorage.getItem('localCredits') || '20');
      const newLocalCredits = Math.max(0, currentLocalCredits - 20);
      localStorage.setItem('localCredits', newLocalCredits.toString());
      setLocalCredits(newLocalCredits);

      const localLastDate = localStorage.getItem('localLastSearchDate');
      const localCount = localLastDate === today ? parseInt(localStorage.getItem('localDailySearchCount') || '0') : 0;
      localStorage.setItem('localDailySearchCount', (localCount + 1).toString());
      localStorage.setItem('localLastSearchDate', today);
    }
    setLoading(false);
  };

  const handleShare = async () => {
    if (!result) return;

    const shareData = {
      title: 'DropshipGenius AI - Producto Ganador',
      text: `He encontrado un producto ganador para el nicho "${niche}" usando DropshipGenius IA. ¡Mira el análisis!`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n\n${result}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Error copying to clipboard:', err);
      }
    }
  };

  const handleCompetitiveAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToAnalyze) return;

    const cacheKey = `${productToAnalyze}-${targetRegion}`;
    if (analysisCache[cacheKey]) {
      setCompetitiveResult(analysisCache[cacheKey]);
      setTimeout(() => {
        const element = document.getElementById('competitive-analysis-result');
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    setAnalyzingCompetitors(true);
    setCompetitiveResult(null);

    try {
      const analysis = await getCompetitiveAnalysis(productToAnalyze, targetRegion);
      setCompetitiveResult(analysis);
      setAnalysisCache(prev => ({ ...prev, [cacheKey]: analysis }));
      
      // Scroll to analysis
      setTimeout(() => {
        const element = document.getElementById('competitive-analysis-result');
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error("Error in competitive analysis:", error);
    } finally {
      setAnalyzingCompetitors(false);
    }
  };

  const handleRateResult = async (id: string, rating: 'up' | 'down') => {
    if (!user) {
      handleLogin();
      return;
    }

    setFeedbackStatus(prev => ({ ...prev, [id]: rating }));

    try {
      const feedbackRef = collection(db, 'feedback');
      await addDoc(feedbackRef, {
        userId: user.uid,
        resultId: id,
        rating,
        niche,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving rating:", error);
    }
  };

  const handleSubmitDetailedFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText || !user) return;

    setSubmittingFeedback(true);
    try {
      const feedbackRef = collection(db, 'detailed_feedback');
      await addDoc(feedbackRef, {
        userId: user.uid,
        text: feedbackText,
        context: { niche, budget, productToAnalyze, targetRegion },
        timestamp: serverTimestamp()
      });
      alert("¡Gracias por tus comentarios! Nos ayudan a mejorar.");
      setFeedbackText('');
      setShowFeedbackModal(false);
    } catch (error) {
      console.error("Error saving detailed feedback:", error);
      alert("Hubo un error al enviar tus comentarios. Inténtalo de nuevo.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleReRunSearch = (item: any) => {
    setNiche(item.niche);
    setBudget(item.budget);
    setResult(item.result);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckVerification = async () => {
    if (auth.currentUser) {
      await reload(auth.currentUser);
      setIsEmailVerified(auth.currentUser.emailVerified);
      if (auth.currentUser.emailVerified) {
        alert("¡Correo verificado con éxito!");
      } else {
        alert("El correo aún no ha sido verificado. Por favor, revisa tu bandeja de entrada.");
      }
    }
  };

  const handleResendVerification = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        alert("Se ha enviado un nuevo correo de verificación.");
      } catch (error) {
        alert("Error al enviar el correo. Inténtalo de nuevo más tarde.");
      }
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    if (!user || (user as any).isGuest) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      if (enabled) {
        // Trigger permission request if enabling
        if ('Notification' in window && Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert("Para recibir notificaciones, debes permitir los permisos en tu navegador.");
            return;
          }
        }
      }
      await updateDoc(userRef, {
        notificationsEnabled: enabled
      });
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  };

  const handleUpdateFrequency = async (frequency: string) => {
    if (!user || (user as any).isGuest) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        notificationFrequency: frequency
      });
    } catch (error) {
      console.error("Error updating notification frequency:", error);
    }
  };

  const niches = [
    "Hogar y Cocina", "Belleza y Cuidado Personal", "Mascotas", 
    "Fitness y Salud", "Gadgets Tecnológicos", "Moda y Accesorios",
    "Juguetes y Bebés", "Deportes y Aire Libre", "Automotriz", 
    "Joyería", "Papelería y Oficina", "Herramientas y Bricolaje",
    "Viajes y Equipaje", "Libros y Educación", "Arte y Manualidades"
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-200/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-100/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-100/20 rounded-full blur-[100px]" />
      </div>

      {/* Floating 3D-like elements */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-40 left-[10%] opacity-20"
        >
          <ShoppingBag className="w-16 h-16 text-brand-600" />
        </motion.div>
        <motion.div 
          animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-60 right-[15%] opacity-20"
        >
          <TrendingUp className="w-20 h-20 text-emerald-500" />
        </motion.div>
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-40 left-[20%] opacity-10"
        >
          <Sparkles className="w-24 h-24 text-brand-400" />
        </motion.div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">DropshipGenius</span>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  title="Configuración de notificaciones"
                >
                  <Bell className={`w-5 h-5 ${(userData as any)?.notificationsEnabled ? 'text-indigo-600 fill-indigo-100' : ''}`} />
                </button>
                <button 
                  onClick={() => setShowHistory(true)}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all relative"
                  title="Historial de búsquedas"
                >
                  <History className="w-5 h-5" />
                  {searchHistory.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white" />
                  )}
                </button>
              </div>
            )}
            {user ? (
              <>
                <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${isProAccount ? 'bg-green-50 border-green-200' : 'bg-slate-100 border-slate-200'}`}>
                  {isProAccount ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-bold text-green-600">Plan PRO Activo</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-600">{userData?.credits ?? 0} Créditos</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-1 pr-3 rounded-full border border-slate-200">
                  <img 
                    src={user.photoURL || ''} 
                    alt={user.displayName || ''} 
                    className="w-8 h-8 rounded-full border border-slate-200" 
                    loading="lazy"
                  />
                  <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.displayName?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="p-1 hover:text-red-600 transition-colors">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleLogin}
                  className="flex flex-col items-center bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-2xl transition-all shadow-xl shadow-brand-100 group"
                >
                  <div className="flex items-center gap-2 font-black text-sm uppercase tracking-widest">
                    <LogIn className="w-4 h-4" />
                    Iniciar Sesión
                  </div>
                  <span className="text-[10px] opacity-80 font-bold group-hover:opacity-100">+200 Créditos Gratis</span>
                </button>
              </div>
            )}
            {user && !userData?.isPro && (
              <button 
                onClick={() => setShowPricing(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-100"
              >
                Mejorar a PRO
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Search History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHistory(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-xl font-bold text-slate-800">Historial</h2>
                  </div>
                  <button 
                    onClick={() => setShowHistory(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {searchHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500">No tienes búsquedas recientes.</p>
                    </div>
                  ) : (
                    searchHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleReRunSearch(item)}
                        className="w-full text-left p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                            {item.budget.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleDateString() : 'Reciente'}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors line-clamp-1">
                          {item.niche}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">
                          {item.result.substring(0, 100)}...
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Interstitial Ad Modal */}
        <AnimatePresence>
          {showAdModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-2xl" />
                
                <div className="relative text-center">
                  <div className="bg-amber-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-8 h-8 text-amber-600" />
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Preparando tu Análisis</h2>
                  <p className="text-slate-500 mb-8">
                    Nuestra IA está procesando los datos del mercado para encontrarte los mejores productos. Este proceso toma unos segundos.
                  </p>

                  <div className="bg-indigo-50/50 rounded-3xl p-8 mb-8 flex flex-col items-center justify-center border border-indigo-100">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                    <p className="text-indigo-900 font-bold">Analizando tendencias...</p>
                    <p className="text-xs text-indigo-600 mt-2">Suscríbete a PRO para saltar esta espera</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      disabled={adCountdown > 0}
                      onClick={() => {
                        setShowAdModal(false);
                        performSearch();
                      }}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      {adCountdown > 0 ? (
                        <>Esperando ({adCountdown}s)...</>
                      ) : (
                        <>Continuar al Análisis <Rocket className="w-5 h-5" /></>
                      )}
                    </button>
                    
                    <button 
                      onClick={() => {
                        setShowAdModal(false);
                        setShowPricing(true);
                      }}
                      className="text-indigo-600 text-sm font-bold hover:underline"
                    >
                      Eliminar anuncios con el Plan PRO →
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Limit Reached Modal */}
        <AnimatePresence>
          {showLimitModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
              onClick={() => setShowLimitModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full shadow-2xl relative overflow-hidden text-center"
                onClick={e => e.stopPropagation()}
              >
                <div className="bg-red-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-8 h-8 text-red-600" />
                </div>
                
                <h2 className="text-2xl font-black text-slate-900 mb-2">Límite Diario Alcanzado</h2>
                <p className="text-slate-500 mb-8">
                  Has alcanzado tu límite de {DAILY_LIMIT} búsquedas diarias gratuitas. Vuelve mañana o mejora a PRO para búsquedas ilimitadas.
                </p>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setShowLimitModal(false);
                      setShowPricing(true);
                    }}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    Mejorar a PRO <Sparkles className="w-5 h-5" />
                  </button>
                  
                  <button 
                    onClick={() => setShowLimitModal(false)}
                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
                  >
                    Entendido, volveré mañana
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pricing Modal */}
        <AnimatePresence>
          {showPricing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowPricing(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-100"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center mb-8">
                  <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Desbloquea el Potencial Pro</h2>
                  <p className="text-slate-500">Escala tu negocio de dropshipping con análisis ilimitados.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="border-2 border-slate-100 p-6 rounded-2xl hover:border-indigo-200 transition-all bg-slate-50/50">
                    <h3 className="font-bold text-lg mb-1">Pack Básico</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-extrabold text-slate-900">$1.99</span>
                      <span className="text-slate-500 text-sm">/pago único</span>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600 mb-6">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        200 Créditos Extra
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        10 Búsquedas IA
                      </li>
                    </ul>
                    <div id="paypal-button-credits" className="min-h-[45px]"></div>
                  </div>

                  <div className="border-2 border-slate-100 p-6 rounded-2xl hover:border-indigo-200 transition-all">
                    <h3 className="font-bold text-lg mb-1">Plan Mensual</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-extrabold text-slate-900">$9.99</span>
                      <span className="text-slate-500 text-sm">/mes</span>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600 mb-6">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Búsquedas Ilimitadas
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Proveedores VIP
                      </li>
                    </ul>
                    <div id="paypal-button-monthly" className="min-h-[45px]"></div>
                  </div>

                  <div className="border-2 border-indigo-600 p-6 rounded-2xl relative bg-indigo-50/30">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Mejor Valor
                    </div>
                    <h3 className="font-bold text-lg mb-1">Plan Anual</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-extrabold text-slate-900">$79</span>
                      <span className="text-slate-500 text-sm">/año</span>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600 mb-6">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Todo lo de Mensual
                      </li>
                      <li className="flex items-center gap-2 font-bold text-indigo-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Ahorra 35%
                      </li>
                    </ul>
                    <div id="paypal-button-yearly" className="min-h-[45px]"></div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowPricing(false)}
                  className="mt-8 text-slate-400 text-sm hover:text-slate-600 transition-colors w-full text-center"
                >
                  Continuar con versión gratuita
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <div className="text-center mb-16 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-8 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>IMPULSADO POR GOOGLE GEMINI AI</span>
          </motion.div>

          {user && !isEmailVerified && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-amber-50 border border-amber-200 p-6 rounded-3xl text-amber-800 flex flex-col md:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="bg-amber-100 p-2 rounded-xl">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold">Verifica tu correo electrónico</p>
                  <p className="text-sm opacity-90">Debes verificar tu correo para usar el buscador de productos.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleCheckVerification}
                  className="bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-700 transition-all"
                >
                  Ya lo verifiqué
                </button>
                <button 
                  onClick={handleResendVerification}
                  className="bg-white text-amber-600 border border-amber-200 text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-50 transition-all"
                >
                  Reenviar correo
                </button>
              </div>
            </motion.div>
          )}

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-[1.1]"
          >
            Encuentra tu próximo <br />
            <span className="text-gradient">Producto Ganador</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Analizamos miles de tendencias globales en tiempo real para recomendarte productos con alto margen y baja competencia.
          </motion.p>

          {/* Live Activity Ticker */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-4 text-xs font-bold text-slate-400 mb-12"
          >
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <img key={i} src={`https://picsum.photos/seed/user${i}/32/32`} className="w-6 h-6 rounded-full border-2 border-white" referrerPolicy="no-referrer" />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeUsers} personas buscando productos ahora mismo</span>
            </div>
          </motion.div>
        </div>

        {/* Search Form */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/70 backdrop-blur-2xl p-10 rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(79,70,229,0.2)] border border-white/50 mb-20 relative z-10 group"
        >
          <form onSubmit={handleSearch} className="relative z-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-800 ml-2 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  Nicho de Mercado
                </label>
                <div className="relative group/input">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within/input:text-brand-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Ej: Accesorios para gatos, Cocina saludable..."
                    className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all shadow-sm"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-800 ml-2 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Presupuesto Diario
                </label>
                <div className="relative group/input">
                  <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within/input:text-emerald-500 transition-colors" />
                  <select 
                    className="w-full pl-14 pr-10 py-5 bg-white border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  >
                    <option value="bajo">Bajo ($10 - $30)</option>
                    <option value="medio">Medio ($30 - $100)</option>
                    <option value="alto">Alto ($100+)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {niches.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNiche(n)}
                  className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                    niche === n 
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' 
                    : 'bg-white text-slate-500 hover:bg-brand-50 hover:text-brand-600 border border-slate-100'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <button 
              type="submit" 
              disabled={loading || !niche || (user !== null && !isEmailVerified)}
              className="w-full py-6 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-black text-lg rounded-[1.5rem] transition-all shadow-xl shadow-brand-200 hover:shadow-brand-300 hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 group/btn overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Analizando Tendencias...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 group-hover/btn:rotate-12 transition-transform" />
                  <span>{user ? (isEmailVerified ? 'Descubrir Productos Ganadores' : 'Verifica tu correo para continuar') : `Probar Gratis (${localCredits / 20} Búsquedas)`}</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {result && (
            <div className="space-y-12 relative z-10">
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                className="relative bg-white rounded-[3rem] p-8 md:p-16 shadow-[0_32px_64px_-16px_rgba(79,70,229,0.15)] border border-indigo-50 overflow-hidden"
              >
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/40 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-50/40 rounded-full -ml-48 -mb-48 blur-3xl pointer-events-none" />

                <div className="relative flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8 pb-10 border-b border-slate-100">
                  <div className="flex items-center gap-6">
                    <div className="bg-gradient-to-br from-brand-500 to-indigo-700 p-4 rounded-[1.5rem] shadow-xl shadow-brand-100">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-[10px] font-black uppercase tracking-widest border border-brand-100">
                          {niche}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                          PRESUPUESTO {budget}
                        </span>
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                        Informe Estratégico
                      </h2>
                    </div>
                  </div>
                  <button 
                    onClick={handleShare}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-slate-200 hover:shadow-indigo-200 group"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        ¡Copiado!
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Compartir Éxito
                      </>
                    )}
                  </button>
                </div>
                
                <div className="relative prose prose-slate max-w-none 
                  prose-headings:text-indigo-600 prose-headings:font-black prose-headings:tracking-tight
                  prose-strong:text-slate-900 prose-strong:font-bold
                  prose-p:text-slate-600 prose-p:leading-relaxed prose-p:text-lg
                  prose-li:text-slate-600 prose-li:text-lg
                  prose-img:rounded-3xl prose-img:shadow-lg
                  prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50/50 prose-blockquote:p-4 prose-blockquote:rounded-r-2xl prose-blockquote:italic">
                  <MemoizedMarkdown content={result} />
                </div>

                {/* Feedback Buttons */}
                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-500">¿Te fue útil este análisis?</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRateResult('main_result', 'up')}
                        className={`p-2 rounded-xl border transition-all ${feedbackStatus['main_result'] === 'up' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-emerald-500'}`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleRateResult('main_result', 'down')}
                        className={`p-2 rounded-xl border transition-all ${feedbackStatus['main_result'] === 'down' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-red-500'}`}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowFeedbackModal(true)}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
                  >
                    Sugerir mejoras
                  </button>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <DollarSign className="w-8 h-8 text-indigo-600 mb-4" />
                    <h3 className="font-bold mb-2">Rentabilidad</h3>
                    <p className="text-sm text-slate-600">Productos con márgenes superiores al 30% tras gastos de envío.</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <Target className="w-8 h-8 text-indigo-600 mb-4" />
                    <h3 className="font-bold mb-2">Segmentación</h3>
                    <p className="text-sm text-slate-600">Nichos específicos con baja competencia y alta demanda.</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <Rocket className="w-8 h-8 text-indigo-600 mb-4" />
                    <h3 className="font-bold mb-2">Escalabilidad</h3>
                    <p className="text-sm text-slate-600">Estrategias probadas para pasar de 0 a 100 ventas diarias.</p>
                  </div>
                </div>

                {!isProAccount && (
                  <div className="mt-12 p-8 bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-200">
                    <div className="flex items-center gap-4 text-left">
                      <div className="bg-white/20 p-3 rounded-2xl">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">¿Quieres más resultados?</h4>
                        <p className="text-sm opacity-80">El Plan PRO te da acceso ilimitado y proveedores VIP.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowPricing(true)}
                      className="bg-white text-indigo-600 font-bold px-6 py-3 rounded-2xl hover:bg-indigo-50 transition-all whitespace-nowrap"
                    >
                      Mejorar a PRO ahora
                    </button>
                  </div>
                )}

                {/* Competitive Analysis Tool */}
                <div className="mt-16 pt-16 border-t border-slate-100">
                  <div className="bg-slate-900 rounded-[2rem] p-8 md:p-12 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-indigo-500 p-2 rounded-xl">
                          <Target className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold">Análisis de Competencia Profundo</h3>
                      </div>
                      
                      <p className="text-slate-300 mb-8 max-w-2xl">
                        Elige uno de los productos recomendados arriba, selecciona tu mercado objetivo y obtén un desglose detallado de precios, palabras clave (cola larga), volumen de búsqueda, intención del usuario, creativos publicitarios y costos.
                      </p>

                      <form onSubmit={handleCompetitiveAnalysis} className="flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-1 relative group/input">
                            <ShoppingBag className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within/input:text-brand-400 transition-colors" />
                            <input 
                              type="text" 
                              placeholder="Nombre del producto..."
                              className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] pl-14 pr-6 py-5 text-white placeholder:text-slate-500 outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                              value={productToAnalyze}
                              onChange={(e) => setProductToAnalyze(e.target.value)}
                            />
                          </div>
                          <div className="relative group/input">
                            <Target className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within/input:text-brand-400 transition-colors" />
                            <select 
                              className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] pl-14 pr-12 py-5 text-white outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition-all appearance-none cursor-pointer"
                              value={targetRegion}
                              onChange={(e) => setTargetRegion(e.target.value)}
                            >
                              <option value="Global" className="bg-slate-900">Mercado Global</option>
                              <option value="EE.UU." className="bg-slate-900">Estados Unidos</option>
                              <option value="España" className="bg-slate-900">España</option>
                              <option value="México" className="bg-slate-900">México</option>
                              <option value="Colombia" className="bg-slate-900">Colombia</option>
                              <option value="Chile" className="bg-slate-900">Chile</option>
                              <option value="Europa" className="bg-slate-900">Europa (General)</option>
                              <option value="Latinoamérica" className="bg-slate-900">Latinoamérica (General)</option>
                            </select>
                          </div>
                        </div>
                        <button 
                          type="submit"
                          disabled={analyzingCompetitors || !productToAnalyze}
                          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-800 text-white font-black text-lg py-6 rounded-[1.5rem] transition-all shadow-xl shadow-brand-900/20 flex items-center justify-center gap-3 overflow-hidden relative group/btn"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                          {analyzingCompetitors ? (
                            <>
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span>Generando Informe Estratégico...</span>
                            </>
                          ) : (
                            <>
                              <TrendingUp className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />
                              <span>Analizar Competencia y Costos</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Competitive Analysis Result */}
                  <AnimatePresence>
                    {competitiveResult && (
                      <motion.div 
                        id="competitive-analysis-result"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-12 bg-white rounded-[3rem] p-8 md:p-16 border border-brand-100 shadow-2xl shadow-brand-100/20 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                        
                        <div className="relative z-10 flex items-center gap-4 mb-10">
                          <div className="bg-brand-600 p-3 rounded-2xl shadow-lg shadow-brand-200">
                            <TrendingUp className="w-6 h-6 text-white" />
                          </div>
                          <h4 className="text-2xl font-black text-slate-900 tracking-tight">Análisis de Mercado: {productToAnalyze}</h4>
                        </div>
                        
                        <div className="prose prose-slate max-w-none 
                          prose-headings:text-indigo-700 prose-headings:font-bold
                          prose-p:text-slate-700 prose-li:text-slate-700">
                          <MemoizedMarkdown content={competitiveResult} />
                        </div>

                        {/* Feedback for Competitive Analysis */}
                        <div className="mt-8 pt-6 border-t border-indigo-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-indigo-600/60">¿Análisis preciso?</span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleRateResult('comp_analysis', 'up')}
                                className={`p-2 rounded-xl border transition-all ${feedbackStatus['comp_analysis'] === 'up' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white/50 border-indigo-200 text-indigo-400 hover:text-emerald-500'}`}
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleRateResult('comp_analysis', 'down')}
                                className={`p-2 rounded-xl border transition-all ${feedbackStatus['comp_analysis'] === 'down' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white/50 border-indigo-200 text-indigo-400 hover:text-red-500'}`}
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          <button 
                            onClick={() => setShowFeedbackModal(true)}
                            className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            Reportar error
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Features Bento Grid */}
        {!result && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="md:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 text-white overflow-hidden relative group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -mr-32 -mt-32 transition-all group-hover:bg-indigo-600/30" />
              <div className="relative z-10">
                <div className="bg-indigo-500/20 p-3 rounded-2xl w-fit mb-6">
                  <TrendingUp className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-3xl font-black mb-4">Análisis de Tendencias Real-Time</h3>
                <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                  No adivines qué vender. Nuestra IA escanea TikTok, Amazon y AliExpress para encontrar lo que está explotando ahora mismo.
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50"
            >
              <div className="bg-emerald-100 p-3 rounded-2xl w-fit mb-6">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">Márgenes Optimizados</h3>
              <p className="text-slate-500 leading-relaxed">
                Calculamos el ROI potencial y te sugerimos el precio de venta ideal para maximizar tus beneficios.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-indigo-50 rounded-[2.5rem] p-10 border border-indigo-100"
            >
              <div className="bg-indigo-600 p-3 rounded-2xl w-fit mb-6">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">Público Objetivo</h3>
              <p className="text-slate-700 leading-relaxed">
                Recibe una segmentación detallada para tus campañas de Facebook y TikTok Ads.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="md:col-span-2 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row items-center gap-10"
            >
              <div className="flex-1">
                <div className="bg-brand-100 p-3 rounded-2xl w-fit mb-6">
                  <Bell className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4">Alertas de Nicho</h3>
                <p className="text-slate-500 text-lg leading-relaxed">
                  Suscríbete y recibe notificaciones push cuando detectemos una nueva oportunidad en tu nicho favorito.
                </p>
              </div>
              <div className="w-full md:w-64 h-40 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-center p-6 text-center">
                <p className="text-xs text-slate-400 font-medium italic">"Recibí una alerta de un gadget de cocina y escalé a $2k/día en una semana."</p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Testimonials Section */}
        {!result && !loading && (
          <div className="mb-32 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-slate-900 mb-4">Lo que dicen los <span className="text-brand-600">Genios</span></h2>
              <p className="text-slate-500">Cientos de emprendedores ya están escalando sus tiendas.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  name: "Carlos R.",
                  role: "Dropshipper 7-figuras",
                  text: "DropshipGenius me ahorra horas de investigación. El primer producto que analicé me generó $500 en ventas el primer día.",
                  avatar: "https://picsum.photos/seed/carlos/100/100"
                },
                {
                  name: "Elena M.",
                  role: "E-commerce Manager",
                  text: "La precisión de la IA para detectar tendencias en TikTok es increíble. Es como tener un equipo de analistas trabajando 24/7.",
                  avatar: "https://picsum.photos/seed/elena/100/100"
                },
                {
                  name: "Javier S.",
                  role: "Emprendedor Digital",
                  text: "El análisis de competencia y costos es lo que marca la diferencia. Ahora sé exactamente cuánto puedo gastar en ads.",
                  avatar: "https://picsum.photos/seed/javier/100/100"
                }
              ].map((t, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 relative"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full border-2 border-brand-100" referrerPolicy="no-referrer" />
                    <div>
                      <p className="font-black text-slate-900 leading-none">{t.name}</p>
                      <p className="text-xs text-brand-600 font-bold mt-1">{t.role}</p>
                    </div>
                  </div>
                  <p className="text-slate-600 italic leading-relaxed">"{t.text}"</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Trust Bar */}
        {!result && !loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center items-center gap-8 md:gap-16 mb-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-700"
          >
            <div className="flex items-center gap-2 font-black text-slate-400">
              <ShoppingBag className="w-5 h-5" />
              <span className="tracking-tighter">SHOPIFY</span>
            </div>
            <div className="flex items-center gap-2 font-black text-slate-400">
              <TrendingUp className="w-5 h-5" />
              <span className="tracking-tighter">TIKTOK ADS</span>
            </div>
            <div className="flex items-center gap-2 font-black text-slate-400">
              <Rocket className="w-5 h-5" />
              <span className="tracking-tighter">ALIEXPRESS</span>
            </div>
            <div className="flex items-center gap-2 font-black text-slate-400">
              <Target className="w-5 h-5" />
              <span className="tracking-tighter">FACEBOOK</span>
            </div>
          </motion.div>
        )}

        {/* Empty State / Tips */}
        {!result && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
              <h3 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                ¿Qué es un producto ganador?
              </h3>
              <ul className="space-y-3 text-indigo-800/80">
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold">•</span>
                  Resuelve un problema cotidiano o ahorra tiempo.
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold">•</span>
                  Tiene un "Efecto Wow" visual para anuncios.
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold">•</span>
                  No es fácil de encontrar en tiendas físicas locales.
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold">•</span>
                  Permite un margen de beneficio saludable.
                </li>
              </ul>
            </div>
            <div className="bg-slate-900 p-8 rounded-3xl text-white">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-indigo-400" />
                Consejo Pro
              </h3>
              <p className="text-slate-300 leading-relaxed">
                "No te enamores del producto, enamórate del proceso. Prueba 3-5 productos a la vez con presupuestos pequeños en TikTok Ads para encontrar el que realmente escala."
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold">DG</div>
                <div>
                  <p className="font-bold text-sm">Equipo DropshipGenius</p>
                  <p className="text-xs text-slate-400">Expertos en E-commerce</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 mb-4">Preguntas Frecuentes</h2>
            <p className="text-slate-500">Todo lo que necesitas saber sobre DropshipGenius IA.</p>
          </div>
          
          <div className="space-y-4">
            {[
              {
                q: "¿Cómo funciona la IA de DropshipGenius?",
                a: "Analizamos tendencias globales, datos de redes sociales y marketplaces en tiempo real usando modelos avanzados de Google (Gemini) para identificar productos con alta demanda y baja competencia."
              },
              {
                q: "¿Qué criterios se usan para seleccionar los productos?",
                a: "Evaluamos el potencial de margen de beneficio, la facilidad de envío, la saturación del mercado y la 'viralidad' visual del producto para asegurar que sea apto para anuncios en TikTok o Facebook."
              },
              {
                q: "¿Cuáles son los beneficios del Plan PRO?",
                a: "El Plan PRO ofrece búsquedas ilimitadas, acceso a proveedores VIP con mejores precios, análisis de competencia profundos y soporte prioritario. Además, eliminas los anuncios y las esperas de 5 segundos."
              },
              {
                q: "¿Cómo funcionan los créditos?",
                a: "Cada búsqueda exitosa consume 20 créditos. Al registrarte, recibes un bono de 200 créditos gratis. Si te quedas sin créditos, puedes comprar packs o suscribirte al Plan PRO para acceso ilimitado."
              }
            ].map((faq, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
              >
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  {faq.q}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed ml-4">
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
        {/* Settings Modal */}
        <AnimatePresence>
          {showSettingsModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
              >
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200">
                  <Bell className="w-6 h-6 text-white" />
                </div>

                <h2 className="text-2xl font-black text-slate-900 mb-2">Notificaciones Push</h2>
                <p className="text-slate-500 mb-8">Recibe alertas sobre nuevas tendencias de nicho detectadas por nuestra IA.</p>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-800">Activar Notificaciones</p>
                      <p className="text-xs text-slate-500">Alertas en tiempo real</p>
                    </div>
                    <button 
                      onClick={() => handleToggleNotifications(!(userData as any)?.notificationsEnabled)}
                      className={`w-12 h-6 rounded-full transition-all relative ${ (userData as any)?.notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300' }`}
                    >
                      <motion.div 
                        animate={{ x: (userData as any)?.notificationsEnabled ? 24 : 4 }}
                        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  {(userData as any)?.notificationsEnabled && (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-slate-700 px-1">Frecuencia de Alertas</p>
                      <div className="grid grid-cols-3 gap-2">
                        {['daily', 'weekly', 'monthly'].map((freq) => (
                          <button
                            key={freq}
                            onClick={() => handleUpdateFrequency(freq)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all capitalize ${
                              (userData as any)?.notificationFrequency === freq 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {freq === 'daily' ? 'Diario' : freq === 'weekly' ? 'Semanal' : 'Mensual'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all mt-4"
                  >
                    Guardar y Cerrar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback Modal */}
        <AnimatePresence>
          {showFeedbackModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden"
              >
                <button 
                  onClick={() => setShowFeedbackModal(false)}
                  className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>

                <h2 className="text-2xl font-black text-slate-900 mb-2">Tu opinión nos ayuda a crecer</h2>
                <p className="text-slate-500 mb-8">¿Cómo podemos mejorar nuestras recomendaciones o análisis? Tu feedback va directo a nuestro equipo de desarrollo.</p>

                <form onSubmit={handleSubmitDetailedFeedback} className="space-y-6">
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[150px] outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 placeholder:text-slate-400"
                    placeholder="Escribe aquí tus sugerencias, errores encontrados o ideas..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    required
                  />
                  <button 
                    type="submit"
                    disabled={submittingFeedback || !feedbackText}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    {submittingFeedback ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-5 h-5" />
                        Enviar Comentarios
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-white border-t border-slate-200 py-16 mt-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
            <div className="flex items-center gap-2">
              <div className="bg-brand-600 p-2 rounded-xl">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tighter">DropshipGenius <span className="text-brand-600">IA</span></span>
            </div>
            {!user && (
              <button 
                onClick={handleGuestLogin}
                className="text-slate-400 hover:text-brand-600 font-bold text-xs uppercase tracking-widest transition-all"
              >
                Acceder como Invitado
              </button>
            )}
          </div>
          <div className="text-center border-t border-slate-100 pt-8">
            <p className="text-slate-500 text-sm">
              © 2026 DropshipGenius AI. Impulsado por Google Gemini.
            </p>
            <p className="text-slate-400 text-xs mt-2">
              Los datos proporcionados son estimaciones basadas en tendencias de mercado actuales.
            </p>
            <div className="text-[10px] text-slate-300 font-mono mt-4">
              v1.1.2-premium-ux
            </div>
          </div>
        </div>
      </footer>

      <Suspense fallback={<div className="fixed bottom-6 right-6 w-12 h-12 bg-slate-200 animate-pulse rounded-2xl" />}>
        <ChatSupport />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
