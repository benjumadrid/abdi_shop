import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { getProducts, subscribeToStoreUpdates } from '../../services/api';
import { processCustomerQuery, getQuickSuggestions } from '../../services/ai/abdiAiEngine';
import OrderModal from '../common/OrderModal';

export default function AbdiAI() {
  const { language, isAmharic } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [products, setProducts] = useState([]);
  const [conversationContext, setConversationContext] = useState({});

  // In-Chat Quick Order (1-Click Checkout) state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalProduct, setOrderModalProduct] = useState(null);

  // Voice Speech-to-Text state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── 1. Fetch & Keep Products State Fresh ──
  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      try {
        const res = await getProducts({ forceFresh: true });
        const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (mounted && items.length > 0) {
          setProducts(items);
        }
      } catch (err) {
        console.warn('Abdi AI: could not load initial products:', err);
      }
    }

    loadProducts();

    const unsubscribe = subscribeToStoreUpdates(() => {
      if (mounted) {
        loadProducts();
      }
    });

    const handleOrderSaved = (e) => {
      if (mounted && e?.detail && !e.detail.removed) {
        setConversationContext((prev) => ({
          ...prev,
          activeOrder: e.detail,
          subject: 'order'
        }));
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('abdi_order_saved', handleOrderSaved);
    }

    return () => {
      mounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('abdi_order_saved', handleOrderSaved);
      }
    };
  }, []);

  // ── 1.5. Web Speech API (Voice Input) & Quick Order Setup ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        setSpeechSupported(true);
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = false;
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
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = language === 'am' ? 'am-ET' : 'en-US';
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Could not start speech recognition:', err);
      }
    }
  };

  const handleQuickOrder = (product) => {
    if (!product) return;
    setIsOpen(false);
    setOrderModalProduct(product);
    setIsOrderModalOpen(true);
  };

  // ── 2. Initialize Greeting Message According to Language ──
  const getInitialGreeting = useCallback((lang) => {
    if (lang === 'am') {
      return {
        id: 'initial-greeting',
        sender: 'bot',
        text: 'ሰላም! እኔ **Abdi AI** ነኝ 👋\nስለ ምርቶች፣ ትዕዛዞች፣ ክፍያዎች እና የአብዲ ኦንላይን ሾፒንግ ማንኛውም ጥያቄ ላይ ልረዳዎት እችላለሁ። ዛሬ በምን ልርዳዎት?',
        timestamp: new Date()
      };
    }
    return {
      id: 'initial-greeting',
      sender: 'bot',
      text: "Hi! I'm **Abdi AI** 👋\nI can help you with products, orders, payments, and anything about shopping with Abdi. How can I assist you today?",
      timestamp: new Date()
    };
  }, []);

  // Sync greeting when language changes if conversation hasn't started yet
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0 || (prev.length === 1 && prev[0].id === 'initial-greeting')) {
        return [getInitialGreeting(language)];
      }
      return prev;
    });
  }, [language, getInitialGreeting]);

  // ── 3. Auto Scroll to Bottom on New Messages ──
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom('auto');
    }
  }, [isOpen, messages, isTyping]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // ── 4. Send & Process Message ──
  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isTyping) return;

    setHasInteracted(true);
    setInputValue('');

    // User Message
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Natural typing delay for realistic AI feel (350ms)
    await new Promise((resolve) => setTimeout(resolve, 350));

    try {
      const response = await processCustomerQuery({
        query,
        currentLanguage: language,
        products,
        conversationContext
      });

      if (response.context) {
        setConversationContext(response.context);
      }

      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: response.text,
        action: response.action || null,
        productCard: response.productCard || null,
        productCards: response.productCards || null,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Abdi AI error processing query:', err);
      const fallbackMsg = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: isAmharic
          ? 'ይቅርታ፣ ጥያቄዎን ለማስተናገድ አልቻልኩም። እባክዎ ጥያቄዎን በድጋሚ ይሞክሩ።'
          : 'I apologize, something unexpected occurred. Please ask your question again.',
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── 5. Clear Conversation ──
  const handleClearChat = () => {
    setMessages([getInitialGreeting(language)]);
    setConversationContext({});
  };

  // ── 6. Handle Action Buttons (Scroll or Navigate) ──
  const handleActionClick = (action) => {
    if (!action) return;

    // Immediately close the AI chat panel so the customer sees the navigated destination
    setIsOpen(false);

    if (action.type === 'SCROLL_SECTION') {
      const targetId = action.targetId === 'products' ? 'featured-products' : action.targetId;
      if (location.pathname !== '/') {
        navigate(`/#${targetId}`);
      } else {
        setTimeout(() => {
          const el = document.getElementById(targetId) || document.getElementById(action.targetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
      }
    } else if (action.type === 'VIEW_PRODUCT') {
      navigate(`/products/${action.productId}`);
    }
  };

  // ── 7. Render Text with Simple Markdown (Bold, Lists, Quotes) ──
  const renderFormattedText = (text) => {
    if (!text) return null;

    const lines = text.split('\n');

    return (
      <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed break-words">
        {lines.map((line, lIdx) => {
          if (!line.trim()) return <div key={lIdx} className="h-1" />;

          // Blockquote (for manager explanation)
          if (line.startsWith('>')) {
            const quoteContent = line.replace(/^>\s*/, '');
            return (
              <blockquote
                key={lIdx}
                className="pl-3 py-1 my-1 border-l-2 border-rose-400 bg-rose-50/70 rounded-r-lg text-rose-900 font-semibold italic text-xs"
              >
                {quoteContent}
              </blockquote>
            );
          }

          // Bullet points
          if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
            const content = line.replace(/^[\s•-]+/, '').trim();
            return (
              <div key={lIdx} className="flex items-start gap-1.5 pl-1">
                <span className="text-brand-600 font-bold shrink-0">•</span>
                <span>{renderInlineFormatting(content)}</span>
              </div>
            );
          }

          // Numbered items (e.g. "1. ")
          const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
          if (numberedMatch) {
            return (
              <div key={lIdx} className="flex items-start gap-1.5 pl-1">
                <span className="font-bold text-brand-700 shrink-0">{numberedMatch[1]}.</span>
                <span>{renderInlineFormatting(numberedMatch[2])}</span>
              </div>
            );
          }

          return <p key={lIdx}>{renderInlineFormatting(line)}</p>;
        })}
      </div>
    );
  };

  // Inline bold **word** replacement
  const renderInlineFormatting = (line) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-extrabold text-ink-950">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // ── 8. Render Interactive Product Mini-Card (1-Click Checkout) ──
  const renderProductCard = (prod, isMulti = false) => {
    if (!prod) return null;
    const name = isAmharic && prod.name_am ? prod.name_am : prod.name_en;
    const price = `${Number(prod.price || 0).toLocaleString()} ETB`;
    const isAvailable = prod.is_available !== false;
    const imageUrl =
      prod.image_url ||
      (Array.isArray(prod.media) && prod.media.find((m) => m.is_primary)?.url) ||
      (Array.isArray(prod.media) && prod.media[0]?.url) ||
      null;

    return (
      <div
        key={prod.id || name}
        className={`bg-white rounded-2xl border border-surface-200 shadow-2xs overflow-hidden transition hover:border-brand-300 hover:shadow-xs ${
          isMulti ? 'w-[195px] shrink-0' : 'w-full mt-2.5'
        }`}
      >
        {/* Thumbnail image */}
        <div className="relative h-24 bg-surface-100 overflow-hidden flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-3xl text-surface-400">🛍️</span>
          )}
          <span
            className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs ${
              isAvailable
                ? 'bg-emerald-600/95 text-white'
                : 'bg-rose-600/95 text-white'
            }`}
          >
            {isAvailable ? (isAmharic ? 'በክምችት አለ' : 'In Stock') : (isAmharic ? 'አልቋል' : 'Out of Stock')}
          </span>
        </div>

        {/* Info & CTA */}
        <div className="p-2.5">
          <h4 className="text-xs font-bold text-ink-900 line-clamp-1" title={name}>
            {name}
          </h4>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className="text-xs sm:text-[13px] font-black text-brand-700">{price}</span>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            {isAvailable ? (
              <button
                type="button"
                onClick={() => handleQuickOrder(prod)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
              >
                <span>🛍️</span>
                <span>{isAmharic ? 'አሁን እዘዝ' : 'Order Now'}</span>
              </button>
            ) : (
              <div
                className="flex-1 py-1.5 px-2 rounded-lg bg-surface-100 border border-surface-200 text-rose-600 text-[11px] font-bold flex items-center justify-center gap-1 cursor-not-allowed select-none"
                title={isAmharic ? 'ይህ እቃ ለጊዜው አልቋል' : 'This product is currently out of stock'}
              >
                <span>⚠️</span>
                <span>{isAmharic ? 'ለጊዜው አልቋል' : 'Out of Stock'}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate(`/products/${prod.id}`);
              }}
              title={isAmharic ? 'ዝርዝር' : 'Details'}
              className="py-1.5 px-2 rounded-lg bg-surface-100 hover:bg-surface-200 text-ink-700 text-[11px] font-semibold transition cursor-pointer"
            >
              ℹ️
            </button>
          </div>
        </div>
      </div>
    );
  };

  const suggestions = getQuickSuggestions(language);

  return (
    <>
      {/* ── FLOATING LAUNCHER BUTTON (Bottom-Right) ── */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2.5">
          {/* Subtle Welcoming Tooltip (Visible until clicked) */}
          {!hasInteracted && (
            <div
              onClick={() => setIsOpen(true)}
              className="hidden sm:flex items-center gap-1.5 bg-white text-ink-800 text-xs font-bold py-1.5 px-3 rounded-full shadow-card border border-surface-200/90 cursor-pointer animate-bounce select-none"
            >
              <span>👋</span>
              <span>{isAmharic ? 'ጥያቄ አለዎት? Abdi AI ይርዳዎት' : 'Need help? Ask Abdi AI'}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open Abdi AI Assistant"
            className="group relative flex items-center gap-2.5 px-4 py-3 sm:px-4.5 sm:py-3.5 rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 hover:from-brand-700 hover:to-emerald-700 text-white shadow-float transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            {/* Pulsing indicator dot */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-200" />
            </span>

            {/* Spark Icon */}
            <svg className="w-5 h-5 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>

            <span className="font-extrabold text-sm tracking-tight">Abdi AI</span>
          </button>
        </div>
      )}

      {/* ── EXPANDABLE CHAT PANEL ── */}
      {isOpen && (
        <div
          className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-40 w-[calc(100vw-1.5rem)] max-w-sm sm:max-w-md h-[580px] max-h-[85vh] bg-white rounded-3xl shadow-float border border-surface-200/90 flex flex-col overflow-hidden animate-scale-in"
          role="dialog"
          aria-label="Abdi AI Help Assistant"
        >
          {/* ── Header ── */}
          <div className="px-4 py-3.5 sm:px-5 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-600 text-white flex items-center justify-between shadow-xs select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-lg shadow-2xs">
                ✨
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-sm tracking-tight text-white">Abdi AI</h3>
                  <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-white/20 text-white/90">
                    {language.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-brand-100 font-medium mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>{isAmharic ? 'በመስመር ላይ • የገበያ ረዳት' : 'Online • Help & Shopping'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Clear chat history */}
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  title={isAmharic ? 'ውይይት አጥራ' : 'Clear conversation'}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              {/* Close/Minimize button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title={isAmharic ? 'ዝጋ' : 'Close'}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Message Thread ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Bot Avatar */}
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-emerald-500 text-white flex items-center justify-center text-xs shrink-0 shadow-2xs mt-0.5">
                    🤖
                  </div>
                )}

                <div className={`max-w-[85%] rounded-2xl p-3 sm:p-3.5 shadow-2xs ${
                  msg.sender === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-xs'
                    : 'bg-white text-ink-900 border border-surface-200/80 rounded-tl-xs'
                }`}>
                  {msg.sender === 'bot' ? (
                    <>
                      {renderFormattedText(msg.text)}

                      {/* Single Product Card */}
                      {msg.productCard && renderProductCard(msg.productCard, false)}

                      {/* Multiple Product Cards (Horizontal Carousel) */}
                      {Array.isArray(msg.productCards) && msg.productCards.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-surface-100">
                          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                            {msg.productCards.map((p) => renderProductCard(p, true))}
                          </div>
                        </div>
                      )}

                      {/* Interactive Action Button */}
                      {msg.action && (
                        <div className="mt-2.5 pt-2 border-t border-surface-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleActionClick(msg.action)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-800 text-xs font-bold border border-brand-200 transition cursor-pointer"
                          >
                            <span>{msg.action.label}</span>
                            <span>→</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  <span className={`block text-[9px] mt-1 font-mono text-right ${
                    msg.sender === 'user' ? 'text-brand-200' : 'text-ink-400'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-emerald-500 text-white flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  🤖
                </div>
                <div className="bg-white border border-surface-200 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Quick Suggestions Pills ── */}
          <div className="px-3.5 py-2 bg-white border-t border-surface-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {suggestions.map((item, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => handleSendMessage(item.query)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 border border-surface-200 text-ink-700 transition cursor-pointer shrink-0 shadow-2xs"
              >
                {item.text}
              </button>
            ))}
          </div>

          {/* ── Input Form ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-surface-200/80 flex items-center gap-2 shrink-0 relative"
          >
            {/* Voice Listening Visual Indicator Banner */}
            {isListening && (
              <div className="absolute -top-7 left-3 right-3 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center justify-between shadow-xs animate-pulse">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  <span>{isAmharic ? 'እያዳመጥኩ ነው... በድምጽዎ ይናገሩ 🎙️' : 'Listening... speak now 🎙️'}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleListening}
                  className="text-rose-600 hover:text-rose-800 text-xs font-black cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isListening ? (isAmharic ? 'እያዳመጥኩ ነው...' : 'Listening...') : (isAmharic ? 'የፈለጉትን እዚህ ይጠይቁ...' : 'Ask Abdi AI anything...')}
              disabled={isTyping}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-xs sm:text-sm text-ink-900 outline-none focus:border-brand-600 focus:bg-white transition shadow-2xs disabled:opacity-60"
            />

            {/* Voice Dictation Button (Microphone) */}
            {speechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? (isAmharic ? 'ማዳመጥ አቁም' : 'Stop Listening') : (isAmharic ? 'በድምጽ ይናገሩ' : 'Voice Input')}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 shadow-2xs ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400'
                    : 'bg-surface-100 hover:bg-surface-200 text-ink-700 border border-surface-300'
                }`}
              >
                {isListening ? (
                  <span className="w-3.5 h-3.5 rounded-full bg-white animate-ping" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            )}

            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              aria-label="Send message"
              className="w-10 h-10 rounded-xl bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* ── Direct 1-Click Order Modal ── */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        product={orderModalProduct}
      />
    </>
  );
}
