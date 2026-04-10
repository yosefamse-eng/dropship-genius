import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Loader2, User as UserIcon, Headset, Sparkles } from 'lucide-react';
import { db, auth, FirestoreOperationType, handleFirestoreError } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { getSupportChatResponse } from '../services/geminiService';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
  isAdmin: boolean;
}

export default function ChatSupport() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user || !isOpen) return;

    const chatPath = `support_chats/${user.uid}/messages`;
    const q = query(collection(db, chatPath), orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, FirestoreOperationType.LIST, chatPath);
    });

    return () => unsubscribe();
  }, [user, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;

    const chatPath = `support_chats/${user.uid}/messages`;
    const textToSend = message.trim();
    setMessage('');
    setLoading(true);

    try {
      // Ensure the parent document exists
      await setDoc(doc(db, 'support_chats', user.uid), {
        lastMessage: textToSend,
        lastUpdate: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName
      }, { merge: true });

      await addDoc(collection(db, chatPath), {
        senderId: user.uid,
        text: textToSend,
        timestamp: serverTimestamp(),
        isAdmin: false
      });

      // Get AI Response
      setIsTyping(true);
      const history = messages.slice(-10).map(m => ({
        role: m.isAdmin ? 'model' : 'user',
        text: m.text
      }));

      const aiResponse = await getSupportChatResponse(textToSend, history);

      await addDoc(collection(db, chatPath), {
        senderId: 'ai_assistant',
        text: aiResponse,
        timestamp: serverTimestamp(),
        isAdmin: true
      });
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.CREATE, chatPath);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-24 right-0 w-[calc(100vw-2rem)] sm:w-[350px] md:w-[400px] h-[500px] md:h-[550px] bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(79,70,229,0.25)] border border-white/50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-brand-600 to-indigo-700 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg leading-tight">Asistente IA</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">En línea ahora</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="bg-brand-50 p-5 rounded-[2rem] mb-6 shadow-inner">
                    <Sparkles className="w-10 h-10 text-brand-600" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">¡Hola! Soy tu asistente IA experto en dropshipping. Pregúntame sobre la plataforma o cómo escalar tu negocio.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-[1.5rem] text-sm leading-relaxed ${
                      msg.isAdmin 
                      ? 'bg-white text-slate-700 border border-slate-100 shadow-sm rounded-tl-none' 
                      : 'bg-brand-600 text-white shadow-xl shadow-brand-100 rounded-tr-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-[1.5rem] rounded-tl-none border border-slate-100 shadow-sm">
                    <div className="flex gap-1.5">
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-brand-600 rounded-full" />
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-brand-600 rounded-full" />
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-brand-600 rounded-full" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-6 bg-white/50 backdrop-blur-md border-t border-slate-100 flex gap-3">
              <input 
                type="text"
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-white border border-slate-200 rounded-[1.2rem] px-5 py-3 text-sm outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button 
                type="submit"
                disabled={loading || !message.trim()}
                className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 text-white p-3.5 rounded-[1.2rem] transition-all shadow-lg shadow-brand-100 hover:shadow-brand-200"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-5 rounded-[1.5rem] shadow-2xl transition-all flex items-center gap-3 group relative overflow-hidden ${
          isOpen ? 'bg-slate-900 text-white' : 'bg-brand-600 text-white hover:scale-105 hover:shadow-brand-300'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && <span className="font-black text-xs uppercase tracking-widest pr-2">Asistente IA</span>}
      </button>
    </div>
  );
}
