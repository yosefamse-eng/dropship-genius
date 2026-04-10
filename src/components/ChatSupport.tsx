import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Loader2, User as UserIcon, Headset } from 'lucide-react';
import { db, auth, FirestoreOperationType, handleFirestoreError } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc } from 'firebase/firestore';

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
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.CREATE, chatPath);
    } finally {
      setLoading(false);
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
            className="absolute bottom-20 right-0 w-[350px] md:w-[400px] h-[500px] bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Headset className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold">Soporte en Vivo</h3>
                  <p className="text-xs text-indigo-100">Estamos aquí para ayudarte</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="bg-indigo-50 p-4 rounded-full mb-4">
                    <MessageCircle className="w-8 h-8 text-indigo-600" />
                  </div>
                  <p className="text-slate-500 text-sm">¡Hola! ¿En qué podemos ayudarte hoy? Escribe tu mensaje abajo.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                      msg.isAdmin 
                      ? 'bg-white text-slate-700 border border-slate-100 shadow-sm rounded-tl-none' 
                      : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 rounded-tr-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input 
                type="text"
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button 
                type="submit"
                disabled={loading || !message.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white p-2 rounded-xl transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-2xl shadow-xl transition-all flex items-center gap-2 group ${
          isOpen ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white hover:scale-105'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && <span className="font-bold text-sm pr-2">Chat de Soporte</span>}
      </button>
    </div>
  );
}
