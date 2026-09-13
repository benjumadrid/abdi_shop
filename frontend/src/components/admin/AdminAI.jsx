import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { subscribeToStoreUpdates } from '../../services/api';
import {
  processAdminQuery,
  fetchLiveAdminData
} from '../../services/ai/adminAiEngine';

export default function AdminAI() {
  const { isAmharic } = useLanguage();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [chatLanguage, setChatLanguage] = useState(isAmharic ? 'am' : 'en');

  // Speech Recognition (Voice Input)
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync default chat language when main language changes
  useEffect(() => {
    setChatLanguage(isAmharic ? 'am' : 'en');
  }, [isAmharic]);

  // ── 1. Fetch & Keep Admin Analytics Synchronized Without Refresh ──
  const refreshLiveAnalytics = useCallback(async () => {
    try {
      const fresh = await fetchLiveAdminData();
      if (fresh) {
        setAnalyticsData(fresh);
      }
    } catch (err) {
      console.warn('AdminAI: failed to refresh live analytics:', err);
    }
  }, []);

  useEffect(() => {
    refreshLiveAnalytics();

    // Subscribe to real-time events across tabs and windows
    const unsubscribe = subscribeToStoreUpdates(() => {
      refreshLiveAnalytics();
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [refreshLiveAnalytics]);

  // ── 2. Keyboard Shortcut (Ctrl+K / Cmd+K) to Toggle Copilot ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ── 3. Voice Input (Web Speech API) ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        setSpeechSupported(true);
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = chatLanguage === 'am' ? 'am-ET' : 'en-US';

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onerror = (err) => {
          console.warn('Speech recognition error:', err);
          setIsListening(false);
        };
        rec.onresult = (event) => {
          const transcript = event?.results?.[0]?.[0]?.transcript;
          if (transcript) {
            setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        };
        recognitionRef.current = rec;
      }
    }
  }, [chatLanguage]);

  const toggleVoiceListening = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.lang = chatLanguage === 'am' ? 'am-ET' : 'en-US';
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Could not start voice recognition:', err);
      }
    }
  };

  // ── 4. Initial Welcome Message ──
  useEffect(() => {
    if (messages.length === 0) {
      const isAm = chatLanguage === 'am';
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: isAm
            ? `👋 **ሰላም ወንድም አብዲ! የአስተዳዳሪ ረዳት AI ነኝ።**\n\nስለ ሱቁ የቀጥታ ሁኔታ ማንኛውንም ጥያቄ ይጠይቁኝ፡\n• የዛሬ ገቢ እና የሽያጭ መጠን\n• ማረጋገጫ የሚጠብቁ የቴሌብር ክፍያዎች\n• ያለቁ እቃዎች እና ክምችት\n• የዛሬ ትዕዛዞች እና የመንደር መላኪያ\n\nጥያቄዎን ከታች ይጻፉ ወይም ከፈጣን ጥያቄዎች አንዱን ይምረጡ!`
            : `👋 **Hello Brother Abdi! I am your Admin AI Copilot.**\n\nI have complete real-time awareness of the store:\n• Today's revenue & sales total (ETB)\n• Pending Telebirr payment screenshots\n• Out-of-stock items & inventory alerts\n• Today's customer orders & village deliveries\n\nAsk me anything or pick a quick question below!`,
          actions: [
            { type: 'NAVIGATE', path: '/admin/orders?date=today', label: isAm ? 'የዛሬ ገቢ' : "Today's Income" },
            { type: 'NAVIGATE', path: '/admin/payments?status=submitted', label: isAm ? 'ክፍያዎችን መርምር' : 'Pending Payments' },
            { type: 'NAVIGATE', path: '/admin/products', label: isAm ? 'ያለቁ እቃዎች' : 'Stock Alerts' }
          ],
          timestamp: new Date()
        }
      ]);
    }
  }, [chatLanguage, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // ── 5. Send Query Handler ──
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isTyping) return;

    const userMessageId = `user-${Date.now()}`;
    const newMessages = [
      ...messages,
      {
        id: userMessageId,
        sender: 'user',
        text: query,
        timestamp: new Date()
      }
    ];

    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      // Process with fresh live data directly from server
      const response = await processAdminQuery({
        query,
        currentLanguage: chatLanguage,
        liveData: analyticsData,
        bypassLiveFetch: false
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: response.text,
          actions: response.actions || [],
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      console.error('Admin AI Error:', err);
      const isAm = chatLanguage === 'am';
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: isAm
            ? 'ይቅርታ፣ መረጃውን ከሰርቨር በማምጣት ላይ ችግር አጋጥሟል። እባክዎ እንደገና ይሞክሩ።'
            : 'Sorry, I encountered an issue fetching live store data. Please try again.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionClick = (action) => {
    if (action.type === 'NAVIGATE' && action.path) {
      navigate(action.path);
    }
  };

  // Quick suggestion chips
  const quickSuggestions = chatLanguage === 'am'
    ? [
        { label: '💰 የዛሬ ገቢ?', query: 'የዛሬ ገቢ ስንት ነው' },
        { label: '📋 የቅርብ ጊዜ ትዕዛዞች?', query: 'የቅርብ ጊዜ ትዕዛዞች' },
        { label: '⚠️ ማረጋገጫ የሚጠብቁ ክፍያዎች?', query: 'ማረጋገጫ የሚጠብቁ ክፍያዎች አሉ?' },
        { label: '📦 ያለቁ እቃዎች?', query: 'ያለቁ እቃዎች የትኞቹ ናቸው' },
        { label: '✏️ እቃ እንዴት ማስተካከል/መሰረዝ?', query: 'እቃ እንዴት ማስተካከል እና መሰረዝ እችላለሁ' },
        { label: '👤 ደንበኛ መብራቱ?', query: 'ስለ ደንበኛ መብራቱ መልአኩ ንገረኝ' }
      ]
    : [
        { label: "💰 Today's Income?", query: 'today income ?' },
        { label: '📋 Recent Orders?', query: 'recent orders ?' },
        { label: '⚠️ Pending Payments?', query: 'any telebirr to verify' },
        { label: '📦 Out-of-Stock Items?', query: 'which products are out of stock' },
        { label: '✏️ How to Edit / Delete?', query: 'how to edit and delete products' },
        { label: '👤 Customer Lookup?', query: 'tell me about user mebratu melaku' }
      ];

  // Markdown rendering helper
  const renderMessageText = (text) => {
    return text.split('\n').map((line, idx) => {
      // Bold rendering
      const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return (
        <span
          key={idx}
          className="block mb-1 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    });
  };

  return (
    <>
      {/* ── FLOATING TRIGGER PILL (BOTTOM-RIGHT) ── */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-ink-950 text-white shadow-xl hover:bg-black border border-amber-500/30 transition-all duration-200 hover:scale-[1.02] cursor-pointer group"
          title="Toggle Admin AI Copilot (Ctrl+K)"
        >
          <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500 text-ink-950 font-black text-xs shadow-xs">
            <span>⚡</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-ink-950 animate-pulse" />
          </div>
          <div className="text-left">
            <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
              <span>Admin AI</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Copilot
              </span>
            </div>
            <div className="text-[10px] text-ink-400 font-medium">
              {chatLanguage === 'am' ? 'የአስተዳዳሪ ረዳት' : 'Live Store AI'} • <kbd className="font-mono text-[9px] text-amber-300">Ctrl+K</kbd>
            </div>
          </div>
        </button>
      </div>

      {/* ── EXPANDED ADMIN AI CHAT DRAWER / DIALOG ── */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[92vw] sm:w-[420px] h-[580px] max-h-[82vh] bg-white rounded-3xl shadow-float border border-surface-200 flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="h-16 px-4 sm:px-5 bg-ink-950 text-white flex items-center justify-between border-b border-surface-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-ink-950 flex items-center justify-center font-black text-sm shadow-xs">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black tracking-wide text-white">
                    Abdi Admin Copilot
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Sync
                  </span>
                </div>
                <p className="text-[10px] text-ink-400">
                  {chatLanguage === 'am' ? 'ቀጥታ የሱቅ አስተዳደር ረዳት' : 'Zero-Refresh Operations AI'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              <div className="flex rounded-lg bg-surface-900 p-0.5 border border-surface-800">
                <button
                  type="button"
                  onClick={() => setChatLanguage('en')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    chatLanguage === 'en' ? 'bg-amber-500 text-ink-950 shadow-xs' : 'text-ink-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setChatLanguage('am')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    chatLanguage === 'am' ? 'bg-amber-500 text-ink-950 shadow-xs' : 'text-ink-400 hover:text-white'
                  }`}
                >
                  አማ
                </button>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-ink-400 hover:text-white hover:bg-surface-800 transition cursor-pointer"
                title="Close (Esc)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Metrics Ribbon (Live facts preview) */}
          {analyticsData?.today && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-[11px] font-bold text-amber-950">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Today: <strong>{analyticsData.today.revenue.toLocaleString()} ETB</strong> ({analyticsData.today.orders_count} orders)</span>
              </span>
              <button
                type="button"
                onClick={refreshLiveAnalytics}
                className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                Sync Now
              </button>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-surface-50/50 text-xs">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs ${
                      isUser
                        ? 'bg-ink-950 text-white rounded-br-xs'
                        : 'bg-white text-ink-900 border border-surface-200/80 rounded-bl-xs'
                    }`}
                  >
                    <div className="text-xs leading-relaxed break-words font-medium">
                      {renderMessageText(msg.text)}
                    </div>

                    {/* Interactive Action Buttons */}
                    {Array.isArray(msg.actions) && msg.actions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-surface-100 flex flex-wrap gap-1.5">
                        {msg.actions.map((act, actIdx) => (
                          <button
                            key={actIdx}
                            type="button"
                            onClick={() => handleActionClick(act)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-ink-950 text-amber-300 hover:bg-black text-[11px] font-bold shadow-2xs border border-amber-500/30 transition-transform active:scale-95 cursor-pointer"
                          >
                            <span>{act.label}</span>
                            <span className="text-white">→</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-ink-400 mt-1 px-1">
                    {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 p-3 bg-white border border-surface-200 rounded-2xl w-24">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce delay-200" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="p-2.5 bg-white border-t border-surface-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {quickSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(item.query)}
                className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-amber-50 hover:text-amber-900 border border-surface-200/80 text-[11px] font-bold text-ink-700 transition active:scale-95 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Input Bar with Voice Support */}
          <div className="p-3 bg-white border-t border-surface-200/80 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    isListening
                      ? (chatLanguage === 'am' ? 'እያዳመጥኩ ነው... ይናገሩ' : 'Listening... Speak now')
                      : (chatLanguage === 'am' ? 'የዛሬ ገቢ፣ ክፍያዎች፣ ያለቁ እቃዎች...' : 'Ask today income, pending payments, stock...')
                  }
                  className="w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-xs font-medium text-ink-900 outline-none focus:border-amber-500 focus:bg-white transition"
                />

                {/* Voice Microphone Button */}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoiceListening}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-xs transition cursor-pointer ${
                      isListening
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'text-ink-400 hover:text-ink-800'
                    }`}
                    title={isListening ? 'Stop listening' : 'Voice search'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="p-2.5 rounded-xl bg-ink-950 text-white hover:bg-black disabled:opacity-40 transition shadow-xs cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
