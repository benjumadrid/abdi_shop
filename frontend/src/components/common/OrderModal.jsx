import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { createOrder, submitPayment, getPaymentMethods, saveMyOrder } from "../../services/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

function TelebirrLogo({ size = "md", variant = "default" }) {
  const isSm = size === "sm";
  const isPhone = variant === "phone";
  const emblemColor = isPhone ? "#FFFFFF" : "#0077C8";

  return (
    <div className={`flex ${isPhone ? "flex-col items-center text-center" : "items-center gap-1.5"} select-none`}>
      {/* Official Ethio Telecom / Telebirr Emblem matching exact reference */}
      <svg
        className={isPhone ? "w-7 h-7 drop-shadow-sm" : isSm ? "w-6 h-6 shrink-0" : "w-8 h-8 shrink-0"}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top Spire / Sail */}
        <path
          d="M51 6C51 6 52 24 45 40C50 40 70 38 88 34C75 28 62 18 51 6Z"
          fill={emblemColor}
        />
        {/* Left Wing */}
        <path
          d="M12 44C24 43 35 44 42 44C41 53 38 61 35 68C28 59 21 51 12 44Z"
          fill={emblemColor}
        />
        {/* Horizontal Upper Bridge */}
        <path
          d="M47 44H95C85 49 68 51 52 51C49 51 47 48 47 44Z"
          fill={emblemColor}
        />
        {/* Swirl Loop */}
        <path
          d="M44 46C41 58 41 72 49 82C57 91 73 91 83 81C92 71 91 55 79 48C69 42 56 46 53 55C50 63 54 70 61 72C67 74 74 70 75 64C76 58 71 54 66 55"
          fill="none"
          stroke={emblemColor}
          strokeWidth="8.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Wordmark: All in golden yellow matching user reference */}
      {isPhone ? (
        <span className="text-[10px] font-black text-[#FFD100] mt-0.5 tracking-wider italic lowercase">
          telebirr
        </span>
      ) : (
        <span
          className={`${
            isSm ? "text-base" : "text-xl"
          } font-black text-[#F59E0B] tracking-tight leading-none lowercase`}
          style={{ letterSpacing: "-0.5px" }}
        >
          telebirr
        </span>
      )}
    </div>
  );
}

function CbeLogo({ size = "md", variant = "default" }) {
  const isSm = size === "sm";
  const isPhone = variant === "phone";

  return (
    <div className={`flex ${isPhone ? "flex-col items-center text-center" : "items-center gap-2"} select-none`}>
      <img
        src="/images/cbe-logo.jpg"
        alt="Commercial Bank of Ethiopia (CBE)"
        className={`rounded-full object-cover border border-[#F5A623]/60 shadow-sm ${
          isPhone ? "w-8 h-8" : isSm ? "w-7 h-7" : "w-8 h-8"
        }`}
      />
      {isPhone ? (
        <span className="text-[10px] font-black text-[#FFD100] mt-0.5 tracking-wider italic uppercase">
          CBE
        </span>
      ) : (
        <span className="text-xs font-black text-[#6B21A8] tracking-tight leading-none uppercase">
          CBE
        </span>
      )}
    </div>
  );
}

function AbyssiniaLogo({ size = "md", variant = "default" }) {
  const isSm = size === "sm";
  const isPhone = variant === "phone";

  return (
    <div className={`flex ${isPhone ? "flex-col items-center text-center" : "items-center gap-2"} select-none`}>
      <img
        src="/images/abyssinia-logo.jpg"
        alt="Bank of Abyssinia (BoA)"
        className={`rounded-full object-cover border border-[#F59E0B]/60 shadow-sm ${
          isPhone ? "w-8 h-8" : isSm ? "w-7 h-7" : "w-8 h-8"
        }`}
      />
      {isPhone ? (
        <span className="text-[10px] font-black text-[#F59E0B] mt-0.5 tracking-wider italic">
          Abyssinia
        </span>
      ) : (
        <span className="text-xs font-black text-[#B45309] tracking-tight leading-none">
          BoA
        </span>
      )}
    </div>
  );
}

export default function OrderModal({ isOpen, onClose, product }) {
  const { isAmharic, getProductName, formatPrice, t } = useLanguage();

  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(null);
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("telebirr");
  const [customerNote, setCustomerNote] = useState("");

  // Configured Account Info (seeded with verified defaults, refreshed from backend API)
  const [telebirrAccount, setTelebirrAccount] = useState({
    account_number: "0931862253",
    account_name: "Nuru"
  });
  const [cbeAccount, setCbeAccount] = useState({
    account_number: "1000584744573",
    account_name: "Behrdin seid"
  });
  const [abyssiniaAccount, setAbyssiniaAccount] = useState({
    account_number: "251444412",
    account_name: "Abdulhafiz sani"
  });
  const [cashAdvanceAmount, setCashAdvanceAmount] = useState(200);
  const [copiedKey, setCopiedKey] = useState(null);

  // File upload state for payment proof screenshot (required for all payment methods)
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const prevIsOpenRef = useRef(false);
  const prevProductIdRef = useRef(product?.id);

  // Reset form ONLY when modal opens fresh or for a different product
  useEffect(() => {
    const isNewProduct = product?.id && product.id !== prevProductIdRef.current;
    const isOpening = isOpen && !prevIsOpenRef.current;

    if (isOpen && (isOpening || isNewProduct)) {
      prevIsOpenRef.current = true;
      prevProductIdRef.current = product?.id;
      setQuantity(1);
      setPhone("");
      setPhoneError(null);
      setErrorMsg(null);
      setPendingOrder(null);
      setConfirmedOrder(null);
      setScreenshotFile(null);
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
        setScreenshotPreview(null);
      }
      setCopiedKey(null);

      getPaymentMethods()
        .then((data) => {
          if (data && Array.isArray(data.methods)) {
            const tb = data.methods.find((m) => m.method === "telebirr");
            if (tb && tb.account_number) {
              setTelebirrAccount({
                account_number: tb.account_number,
                account_name: tb.account_name || "Nuru"
              });
            }
            const cbe = data.methods.find((m) => m.method === "cbe");
            if (cbe && cbe.account_number) {
              setCbeAccount({
                account_number: cbe.account_number,
                account_name: cbe.account_name || "Behrdin seid"
              });
            }
            const boa = data.methods.find((m) => m.method === "abyssinia");
            if (boa && boa.account_number) {
              setAbyssiniaAccount({
                account_number: boa.account_number,
                account_name: boa.account_name || "Abdulhafiz sani"
              });
            }
            const cash = data.methods.find((m) => m.method === "cash");
            if (cash && cash.advance_deposit) {
              setCashAdvanceAmount(Number(cash.advance_deposit) || 200);
            }
          }
        })
        .catch(() => {});
    } else if (!isOpen) {
      prevIsOpenRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product?.id]);

  useEffect(() => {
    return () => {
      if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    };
  }, [screenshotPreview]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !product) return null;

  const productName = getProductName(product);
  const unitPrice = parseFloat(product.price) || 0;
  const totalPrice = unitPrice * quantity;

  const imageUrl =
    product.image_url ||
    (Array.isArray(product.media) && product.media.find((m) => m.is_primary)?.url) ||
    (Array.isArray(product.media) && product.media[0]?.url) ||
    null;

  const handleCopy = (text, key = "default") => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleFileSelect = (file) => {
    setErrorMsg(null);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setErrorMsg(t("orderModal.invalidFileTypeError"));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(t("orderModal.fileTooLargeError"));
      return;
    }
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const handleRemoveScreenshot = () => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePhoneKeyDown = (e) => {
    // If user attempts to type another digit when already at 9 digits and not selecting text
    if (
      phone.length >= 9 &&
      /^[0-9]$/.test(e.key) &&
      e.target.selectionStart === e.target.selectionEnd
    ) {
      setPhoneError(
        isAmharic
          ? "የኢትዮጵያ ስልክ ቁጥር ርዝመት አይደለም፤ እባክዎ በትክክል ያረጋግጡ (9 ዲጂት መሆን አለበት)።"
          : "It's not Ethiopian number format length, check it correctly again."
      );
    }
  };

  const handlePhoneChange = (e) => {
    let raw = e.target.value;
    let val = raw.replace(/\D/g, ""); // Digits only

    // If customer entered leading 0 (e.g. 09... or 07...), automatically strip it
    if (val.startsWith("0")) {
      val = val.replace(/^0+/, "");
    }

    // If user attempted to type or paste more than 9 digits
    if (val.length > 9) {
      setPhoneError(
        isAmharic
          ? "የኢትዮጵያ ስልክ ቁጥር ርዝመት አይደለም፤ እባክዎ በትክክል ያረጋግጡ (9 ዲጂት መሆን አለበት)።"
          : "It's not Ethiopian number format length, check it correctly again."
      );
      val = val.slice(0, 9);
      setPhone(val);
      return;
    }

    setPhone(val);

    // Support both Ethio Telecom (starts with 9) and Safaricom Ethiopia (starts with 7)
    if (val.length > 0 && !val.startsWith("9") && !val.startsWith("7")) {
      setPhoneError(
        isAmharic
          ? "ስልክ ቁጥር በ 9 ወይም በ 7 መጀመር አለበት (ለምሳሌ፦ 983030998 ወይም 712345678)"
          : "Phone number must start with 9 or 7 (e.g. 983030998 or 712345678)"
      );
    } else {
      // Clear error while typing valid digits
      setPhoneError(null);
    }
  };

  const handlePhoneBlur = () => {
    if (!phone) return;
    if (!phone.startsWith("9") && !phone.startsWith("7")) {
      setPhoneError(
        isAmharic
          ? "ስልክ ቁጥር በ 9 ወይም በ 7 መጀመር አለበት (ለምሳሌ፦ 983030998 ወይም 712345678)"
          : "Phone number must start with 9 or 7 (e.g. 983030998 or 712345678)"
      );
    } else if (phone.length !== 9) {
      setPhoneError(
        isAmharic
          ? "የኢትዮጵያ ስልክ ቁጥር ርዝመት አይደለም፤ እባክዎ በትክክል ያረጋግጡ (9 ዲጂት መሆን አለበት)።"
          : "It's not Ethiopian number format length, check it correctly again."
      );
    } else {
      setPhoneError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg(isAmharic ? "እባክዎ ሙሉ ስምዎን ያስገቡ።" : "Please enter your full name.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      const msg = isAmharic ? "እባክዎ ስልክ ቁጥርዎን ያስገቡ።" : "Please enter your phone number.";
      setPhoneError(msg);
      setErrorMsg(msg);
      return;
    }
    if (!cleanPhone.startsWith("9") && !cleanPhone.startsWith("7")) {
      const msg = isAmharic
        ? "ስልክ ቁጥር በ 9 ወይም በ 7 መጀመር አለበት (ለምሳሌ፦ 983030998 ወይም 712345678)"
        : "Phone number must start with 9 or 7 (e.g. 983030998 or 712345678)";
      setPhoneError(msg);
      setErrorMsg(msg);
      return;
    }
    if (cleanPhone.length !== 9) {
      const msg = isAmharic
        ? "የኢትዮጵያ ስልክ ቁጥር ርዝመት አይደለም፤ እባክዎ በትክክል ያረጋግጡ (9 ዲጂት መሆን አለበት)።"
        : "It's not Ethiopian number format length, check it correctly again.";
      setPhoneError(msg);
      setErrorMsg(msg);
      return;
    }
    setPhoneError(null);

    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setErrorMsg(isAmharic ? "እባክዎ ከተማዎን እና የተለየ ሰፈር/መንደርዎን ያስገቡ (ለምሳሌ፦ ደሴ፣ ቧንቧ ውሃ)።" : "Please enter your delivery address (e.g. Dessie, Buanbuha).");
      return;
    }

    const lowerAddr = trimmedAddress.toLowerCase();
    const isSingleWord = !trimmedAddress.includes(',') && !trimmedAddress.includes('፣') && !trimmedAddress.includes(' ') && !trimmedAddress.includes('-');
    const isGenericCityOnly = isSingleWord || ['dessie', 'ደሴ', 'addis ababa', 'አዲስ አበባ', 'kombolcha', 'ኮምቦልቻ'].includes(lowerAddr);
    if (isGenericCityOnly) {
      setErrorMsg(
        isAmharic
          ? "እባክዎ የከተማዎን ስም ብቻ ሳይሆን የተለየ ሰፈር ወይም መንደርዎን ጭምር ይጥቀሱ (ለምሳሌ፦ ደሴ፣ ቧንቧ ውሃ)።"
          : "Please specify your village or neighborhood along with your city (e.g. Dessie, Buanbuha)."
      );
      return;
    }

    if (!screenshotFile) {
      setErrorMsg(
        paymentMethod === "cash"
          ? (isAmharic
              ? "እባክዎ የ 200 ብር ቅድመ ክፍያ ደረሰኝ ስክሪንሾት ያያይዙ።"
              : "Please attach your 200 ETB advance deposit payment receipt screenshot.")
          : (isAmharic
              ? "እባክዎ ትክክለኛውን የክፍያ ደረሰኝ ስክሪንሾት ያያይዙ (የተከፈለበት ሰዓት በግልጽ መታየት አለበት)።"
              : "Please attach the correct payment screenshot below (ensure the transaction time and details are clearly visible).")
      );
      if (fileInputRef.current) fileInputRef.current.focus();
      return;
    }

    setSubmitting(true);
    let activeOrder = pendingOrder;

    try {
      if (!activeOrder) {
        const orderPayload = {
          customer: { name: name.trim(), phone: `+251${cleanPhone}`, address: address.trim() },
          items: [{ product_id: product.id, quantity: quantity }],
          customer_note: customerNote.trim() || null
        };
        activeOrder = await createOrder(orderPayload);
        setPendingOrder(activeOrder);
      }

      // All payment methods (telebirr, cbe, abyssinia, cash advance) submit receipt proof
      const fd = new FormData();
      fd.append("order_id", activeOrder.id);
      fd.append("method", paymentMethod);
      fd.append("amount", String(activeOrder.total_amount));
      fd.append("screenshot", screenshotFile);
      const submittedPayment = await submitPayment(fd);

      const orderToSave = {
        ...activeOrder,
        active_payment: submittedPayment,
        payments: submittedPayment ? [submittedPayment] : []
      };
      saveMyOrder(orderToSave);
      setConfirmedOrder(orderToSave);
      setPendingOrder(null);
    } catch (err) {
      console.error("Order or payment submission failed:", err);
      if (activeOrder) {
        setErrorMsg(`${t("orderModal.paymentFailedDesc")} (${activeOrder.order_number}). ${err.message || ""}`);
      } else {
        setErrorMsg(err.message || (isAmharic ? "ትዕዛዝ መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።" : "Could not place order. Please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={submitting ? undefined : onClose}
      />

      {/* Modal Card - Sized wide (max-w-[800px]) to match reference design perfectly */}
      <div className="relative w-full max-w-[800px] bg-white rounded-3xl shadow-2xl overflow-hidden my-auto z-10 animate-fade-up border border-gray-100">

        {/* ── SUCCESS STATE ──────────────────────────────────── */}
        {confirmedOrder ? (
          <div className="p-7 sm:p-9 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-[#006838]/10 text-[#006838] flex items-center justify-center mx-auto border-2 border-[#006838]/20 shadow-sm">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900">
                {t("orderModal.successTitle")}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto">
                {paymentMethod === "cash" ? t("orderModal.successDescCash") : t("orderModal.successDesc")}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 text-left space-y-3 max-w-lg mx-auto">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">{t("orderModal.orderNumber")}</span>
                <span className="font-mono font-black text-[#006838] text-base">{confirmedOrder.order_number}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">{t("orderModal.productLabel")}</span>
                <span className="font-bold text-gray-900 line-clamp-1 max-w-[240px]">{productName} (x{quantity})</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">{t("orderModal.total")}</span>
                <span className="font-extrabold text-[#006838] text-base">{formatPrice(confirmedOrder.total_amount || totalPrice)}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-500 font-medium">{t("orderModal.paymentStatus")}</span>
                <span className={`inline-flex items-center gap-1.5 font-bold px-3 py-1 rounded-full text-xs ${
                  paymentMethod === "telebirr" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                  paymentMethod === "cbe" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                  paymentMethod === "abyssinia" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                  "bg-emerald-50 text-[#006838] border border-emerald-200"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    paymentMethod === "telebirr" ? "bg-blue-600" :
                    paymentMethod === "cbe" ? "bg-purple-600" :
                    paymentMethod === "abyssinia" ? "bg-amber-600" :
                    "bg-[#006838]"
                  }`} />
                  {paymentMethod === "cash" ? t("orderModal.paymentPendingCash") : t("orderModal.paymentReview")}
                </span>
              </div>
            </div>

            <div className="text-sm text-gray-500 flex items-center justify-center gap-1.5">
              <span>{t("orderModal.orCall")}</span>
              <a href={`tel:${t("footer.supportPhone").replace(/\s/g, "")}`} className="font-bold text-[#006838] hover:underline">
                {t("footer.supportPhone")}
              </a>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full max-w-md mx-auto py-3.5 rounded-xl bg-[#006838] hover:bg-[#00552e] text-white font-bold text-sm transition-all cursor-pointer shadow-sm"
            >
              {t("orderModal.done")}
            </button>
          </div>
        ) : (
          /* ── ORDER FORM ────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[92vh]">

            {/* ── HEADER ── */}
            <div className="flex items-start justify-between px-6 sm:px-8 pt-6 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#006838] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
                    {t("orderModal.title")}
                  </h2>
                  <p className="text-xs text-gray-500 font-normal mt-0.5">
                    {t("orderModal.subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer shrink-0"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="px-6 sm:px-8 pb-5 space-y-4 overflow-y-auto">

              {/* ── Product Preview & Quantity Row ── */}
              <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border border-gray-200/90 bg-white shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={productName}
                      className="w-12 h-12 rounded-xl object-cover border border-gray-100 bg-gray-50 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{productName}</h3>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <p className="text-sm sm:text-base font-black text-[#006838]">{formatPrice(totalPrice)}</p>
                      {quantity > 1 && (
                        <span className="text-[11px] text-gray-500 font-medium">
                          ({quantity} × {formatPrice(unitPrice)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quantity selector pill with max 5 limit */}
                <div className="flex flex-col items-end shrink-0">
                  <div className="flex items-center gap-3.5 px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || submitting}
                      className="text-gray-500 hover:text-gray-800 font-semibold text-base transition disabled:opacity-25 cursor-pointer leading-none"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="text-sm font-bold text-gray-900 min-w-[12px] text-center select-none">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                      disabled={quantity >= 5 || submitting}
                      className="text-gray-500 hover:text-gray-800 font-semibold text-base transition disabled:opacity-25 cursor-pointer leading-none"
                      aria-label="Increase quantity"
                      title={quantity >= 5 ? (isAmharic ? "በአንድ ትዕዛዝ ከፍተኛው ገደብ 5 እቃዎች ነው" : "Maximum limit is 5 items per order") : ""}
                    >
                      +
                    </button>
                  </div>
                  {quantity >= 5 && (
                    <span className="text-[10px] text-amber-700 font-bold mt-1">
                      {isAmharic ? "ከፍተኛው ገደብ: 5" : "Max limit: 5"}
                    </span>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-red-200 text-red-800 flex items-center justify-center font-bold text-[10px] mt-0.5">!</span>
                  <span className="flex-1">{errorMsg}</span>
                </div>
              )}

              {/* ── Full Name ── */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  {t("orderModal.fullName")} <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <svg className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <input
                    type="text"
                    required
                    disabled={submitting}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("orderModal.fullNamePlaceholder")}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-gray-200 focus:border-[#006838] focus:ring-1 focus:ring-[#006838] text-sm text-gray-900 placeholder:text-gray-400 bg-white transition outline-none shadow-2xs font-medium"
                  />
                </div>
              </div>

              {/* ── Phone Number with Ethiopian Flag, +251, No Dropdown, Clean 9-Digit Validation ── */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  {t("orderModal.phone")} <span className="text-red-500">*</span>
                </label>
                <div className="w-full">
                  <div
                    className={`w-full flex items-center rounded-xl border-2 bg-white overflow-hidden shadow-2xs transition ${
                      phoneError
                        ? "border-rose-500 ring-2 ring-rose-500/15"
                        : phone.length === 9 && phone.startsWith("9")
                        ? "border-emerald-600 ring-1 ring-emerald-600/15"
                        : "border-[#006838] focus-within:ring-2 focus-within:ring-[#006838]/20"
                    }`}
                  >
                    <div className="flex items-center pl-3.5 pr-2.5 py-2.5 select-none shrink-0 bg-gray-50/70">
                      {/* Crisp Ethiopian Flag SVG matching reference */}
                      <span className="w-6 h-4 rounded-xs overflow-hidden shadow-2xs border border-black/10 inline-flex items-center justify-center shrink-0">
                        <svg className="w-full h-full" viewBox="0 0 60 40" fill="none">
                          <rect width="60" height="13.33" fill="#078930" />
                          <rect y="13.33" width="60" height="13.33" fill="#FCDD09" />
                          <rect y="26.66" width="60" height="13.34" fill="#DA121A" />
                          <circle cx="30" cy="20" r="7.2" fill="#0F47AF" />
                          <path
                            d="M30 14.2L31.6 18.5L36.0 18.8L32.6 21.5L33.7 25.8L30 23.3L26.3 25.8L27.4 21.5L24.0 18.8L28.4 18.5Z"
                            fill="#FCDD09"
                          />
                          <line x1="30" y1="13.2" x2="30" y2="15.0" stroke="#FCDD09" strokeWidth="0.8" strokeLinecap="round" />
                          <line x1="35.0" y1="16.3" x2="33.6" y2="17.5" stroke="#FCDD09" strokeWidth="0.8" strokeLinecap="round" />
                          <line x1="33.6" y1="24.5" x2="32.4" y2="23.2" stroke="#FCDD09" strokeWidth="0.8" strokeLinecap="round" />
                          <line x1="26.4" y1="24.5" x2="27.6" y2="23.2" stroke="#FCDD09" strokeWidth="0.8" strokeLinecap="round" />
                          <line x1="25.0" y1="16.3" x2="26.4" y2="17.5" stroke="#FCDD09" strokeWidth="0.8" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span className="text-sm font-black text-gray-800 ml-2">+251</span>
                    </div>
                    <div className="h-6 w-px bg-gray-200 mx-1.5 shrink-0" />
                    <input
                      type="tel"
                      required
                      disabled={submitting}
                      value={phone}
                      onChange={handlePhoneChange}
                      onKeyDown={handlePhoneKeyDown}
                      onBlur={handlePhoneBlur}
                      placeholder="983030998"
                      className="flex-1 px-3 py-2.5 sm:py-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
                      maxLength={9}
                    />
                    {phone.length === 9 && (phone.startsWith("9") || phone.startsWith("7")) && (
                      <div className="pr-3 text-emerald-600 flex items-center shrink-0" title="Valid phone number">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {phoneError && (
                    <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1.5 animate-fade-up">
                      <span>⚠️</span>
                      <span>{phoneError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* ── Delivery Address (Standard clean border like Full Name, no badge inside) ── */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  {t("orderModal.address")} <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <svg className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input
                    type="text"
                    required
                    disabled={submitting}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t("orderModal.addressPlaceholder")}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-gray-200 focus:border-[#006838] focus:ring-1 focus:ring-[#006838] text-sm font-medium text-gray-900 placeholder:text-gray-400 bg-white transition outline-none shadow-2xs"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1.5 font-normal">
                  <span>💡</span>
                  <span>{t("orderModal.addressHint")}</span>
                </p>
              </div>

              {/* ── Payment Method ── */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-2">
                  {t("orderModal.paymentMethod")} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Telebirr Card */}
                  <div
                    onClick={() => setPaymentMethod("telebirr")}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer relative shadow-2xs ${
                      paymentMethod === "telebirr"
                        ? "border-[#006838] bg-[#f2faf5]/80 ring-1 ring-[#006838]/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <TelebirrLogo size="sm" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === "telebirr" ? "border-[#006838]" : "border-gray-300"
                      }`}>
                        {paymentMethod === "telebirr" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#006838]" />
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block">{t("orderModal.telebirr")}</span>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">{t("orderModal.telebirrSub")}</span>
                  </div>

                  {/* CBE Card */}
                  <div
                    onClick={() => setPaymentMethod("cbe")}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer relative shadow-2xs ${
                      paymentMethod === "cbe"
                        ? "border-[#6B21A8] bg-[#faf5ff] ring-1 ring-[#6B21A8]/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <CbeLogo size="sm" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === "cbe" ? "border-[#6B21A8]" : "border-gray-300"
                      }`}>
                        {paymentMethod === "cbe" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#6B21A8]" />
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block">CBE (የኢትዮጵያ ንግድ ባንክ)</span>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">{t("orderModal.cbeSub")}</span>
                  </div>

                  {/* Bank of Abyssinia Card */}
                  <div
                    onClick={() => setPaymentMethod("abyssinia")}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer relative shadow-2xs ${
                      paymentMethod === "abyssinia"
                        ? "border-[#B45309] bg-[#fffbeb] ring-1 ring-[#B45309]/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <AbyssiniaLogo size="sm" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === "abyssinia" ? "border-[#B45309]" : "border-gray-300"
                      }`}>
                        {paymentMethod === "abyssinia" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#B45309]" />
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block">Bank of Abyssinia (አቢሲኒያ)</span>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">{t("orderModal.abyssiniaSub")}</span>
                  </div>

                  {/* Cash on Delivery Card */}
                  <div
                    onClick={() => setPaymentMethod("cash")}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer relative shadow-2xs ${
                      paymentMethod === "cash"
                        ? "border-[#006838] bg-[#f2faf5]/80 ring-1 ring-[#006838]/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-6 rounded-md bg-[#006838] text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <svg className="w-5 h-3.5" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="2" width="28" height="16" rx="2" />
                            <circle cx="16" cy="10" r="3.5" />
                          </svg>
                        </div>
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-amber-300">
                          200 ETB Deposit
                        </span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        paymentMethod === "cash" ? "border-[#006838]" : "border-gray-300"
                      }`}>
                        {paymentMethod === "cash" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#006838]" />
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block">{t("orderModal.cash")}</span>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">
                      {isAmharic ? "200 ብር ቅድመ ክፍያ + ቀሪው ሲረከቡ" : "200 ETB advance deposit + remaining at door"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── 1. TELEBIRR BANNER & 3D PHONE MOCKUP ── */}
              {paymentMethod === "telebirr" && (
                <div className="bg-[#ecf5fe] border border-blue-100 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-2xs animate-fade-up">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-3 shrink-0 sm:max-w-[210px]">
                      <div className="flex items-center gap-2">
                        <TelebirrLogo size="sm" />
                        <span className="bg-[#dcfce7] text-[#15803d] border border-[#86efac] text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Official & Secure
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] text-blue-900/70 font-medium">{t("orderModal.accountName")}</p>
                        <p className="text-base font-black text-gray-900 mt-0.5">{telebirrAccount.account_name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-blue-900/70 font-medium">{t("orderModal.accountNumber")}</p>
                        <div
                          onClick={() => handleCopy(telebirrAccount.account_number, "telebirr")}
                          className="flex items-center gap-2 mt-0.5 cursor-pointer group"
                          title="Click to copy account number"
                        >
                          <span className="text-base font-black text-gray-900 group-hover:text-[#0072CE] transition tracking-wide">
                            {telebirrAccount.account_number}
                          </span>
                          {copiedKey === "telebirr" ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              ✓ {t("orderModal.copied")}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-[#0072CE] bg-blue-50/80 px-2 py-0.5 rounded-md opacity-80 group-hover:opacity-100">
                              {t("orderModal.copy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 sm:border-l sm:border-blue-200/70 sm:pl-5 space-y-2">
                      <div className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#0066b2] text-white inline-flex items-center justify-center text-[10px]">i</span>
                        <span>{t("orderModal.howToPay")}</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-blue-950">
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-[#0066b2] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                          <span className="font-medium">{t("orderModal.step1")}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-[#0066b2] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                          <span className="font-medium">
                            {isAmharic
                              ? `ትክክለኛውን የብር መጠን (${formatPrice(totalPrice)}) ከላይ ወደተጠቀሰው ቁጥር ይላኩ`
                              : `Send the exact amount (${formatPrice(totalPrice)}) to the number above`}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-[#0066b2] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                          <span className="font-medium">{t("orderModal.step3")}</span>
                        </div>
                        <div className="flex items-start gap-2 pt-0.5">
                          <span className="w-4 h-4 rounded-full bg-[#006838] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                          <span className="font-bold text-[#006838]">{t("orderModal.step4")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative shrink-0 w-28 sm:w-32 h-28 overflow-hidden flex items-center justify-end self-center">
                      <div className="w-22 sm:w-24 h-36 sm:h-40 bg-[#0a192f] rounded-[22px] p-1 shadow-2xl -rotate-[10deg] border border-blue-300/40 relative -mr-2">
                        <div className="w-full h-full bg-gradient-to-b from-[#0072CE] to-[#004f93] rounded-[18px] flex flex-col items-center justify-center p-2 relative overflow-hidden">
                          <div className="w-6 h-1.5 bg-black/50 rounded-full mb-auto mt-0.5" />
                          <div className="my-auto">
                            <TelebirrLogo size="sm" variant="phone" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 2. CBE BANNER & 3D PHONE MOCKUP ── */}
              {paymentMethod === "cbe" && (
                <div className="bg-[#fbf7ff] border border-purple-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-2xs animate-fade-up">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-3 shrink-0 sm:max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <CbeLogo size="sm" />
                        <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {isAmharic ? "ንግድ ባንክ" : "Commercial Bank"}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] text-purple-900/70 font-medium">{t("orderModal.accountName")}</p>
                        <p className="text-base font-black text-gray-900 mt-0.5">{cbeAccount.account_name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-purple-900/70 font-medium">{t("orderModal.accountNumber")}</p>
                        <div
                          onClick={() => handleCopy(cbeAccount.account_number, "cbe")}
                          className="flex items-center gap-2 mt-0.5 cursor-pointer group"
                          title="Click to copy account number"
                        >
                          <span className="text-base font-black text-gray-900 group-hover:text-purple-700 transition tracking-wide font-mono">
                            {cbeAccount.account_number}
                          </span>
                          {copiedKey === "cbe" ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              ✓ {t("orderModal.copied")}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md opacity-80 group-hover:opacity-100">
                              {t("orderModal.copy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 sm:border-l sm:border-purple-200/70 sm:pl-5 space-y-2">
                      <div className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-purple-700 text-white inline-flex items-center justify-center text-[10px]">i</span>
                        <span>{isAmharic ? "በንግድ ባንክ እንዴት መክፈል እንደሚቻል" : "How to Pay via CBE"}</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-purple-950">
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-purple-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                          <span className="font-medium">
                            {isAmharic ? "የ CBE ሞባይል ባንኪንግ ወይም CBE Birr መተግበሪያዎን ይክፈቱ" : "Open CBE Mobile Banking or CBE Birr app"}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-purple-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                          <span className="font-medium">
                            {isAmharic
                              ? `ትክክለኛውን የብር መጠን (${formatPrice(totalPrice)}) ወደ ሂሳብ ቁጥር ${cbeAccount.account_number} ይላኩ`
                              : `Transfer exact amount (${formatPrice(totalPrice)}) to account ${cbeAccount.account_number}`}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-purple-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                          <span className="font-medium">{t("orderModal.step3")}</span>
                        </div>
                        <div className="flex items-start gap-2 pt-0.5">
                          <span className="w-4 h-4 rounded-full bg-[#006838] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                          <span className="font-bold text-[#006838]">{t("orderModal.step4")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative shrink-0 w-28 sm:w-32 h-28 overflow-hidden flex items-center justify-end self-center">
                      <div className="w-22 sm:w-24 h-36 sm:h-40 bg-[#1e0828] rounded-[22px] p-1 shadow-2xl -rotate-[10deg] border border-purple-300/40 relative -mr-2">
                        <div className="w-full h-full bg-gradient-to-b from-[#5C068C] to-[#3B0358] rounded-[18px] flex flex-col items-center justify-center p-2 relative overflow-hidden text-center">
                          <div className="w-6 h-1.5 bg-black/50 rounded-full mb-auto mt-0.5" />
                          <div className="my-auto flex flex-col items-center">
                            <CbeLogo size="sm" variant="phone" />
                            <span className="text-[9px] text-[#F5A623] font-extrabold mt-1">ንግድ ባንክ</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 3. BANK OF ABYSSINIA BANNER & 3D PHONE MOCKUP ── */}
              {paymentMethod === "abyssinia" && (
                <div className="bg-[#fffdf5] border border-amber-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-2xs animate-fade-up">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-3 shrink-0 sm:max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <AbyssiniaLogo size="sm" />
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {isAmharic ? "አቢሲኒያ ባንክ" : "Bank of Abyssinia"}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] text-amber-900/70 font-medium">{t("orderModal.accountName")}</p>
                        <p className="text-base font-black text-gray-900 mt-0.5">{abyssiniaAccount.account_name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-amber-900/70 font-medium">{t("orderModal.accountNumber")}</p>
                        <div
                          onClick={() => handleCopy(abyssiniaAccount.account_number, "abyssinia")}
                          className="flex items-center gap-2 mt-0.5 cursor-pointer group"
                          title="Click to copy account number"
                        >
                          <span className="text-base font-black text-gray-900 group-hover:text-amber-700 transition tracking-wide font-mono">
                            {abyssiniaAccount.account_number}
                          </span>
                          {copiedKey === "abyssinia" ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              ✓ {t("orderModal.copied")}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md opacity-80 group-hover:opacity-100">
                              {t("orderModal.copy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 sm:border-l sm:border-amber-200/70 sm:pl-5 space-y-2">
                      <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-amber-700 text-white inline-flex items-center justify-center text-[10px]">i</span>
                        <span>{isAmharic ? "በአቢሲኒያ ባንክ እንዴት መክፈል እንደሚቻል" : "How to Pay via Bank of Abyssinia"}</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-amber-950">
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-amber-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                          <span className="font-medium">
                            {isAmharic ? "የአቢሲኒያ ሞባይል ባንኪንግ ወይም Apollo መተግበሪያዎን ይክፈቱ" : "Open Bank of Abyssinia (BoA Mobile / Apollo) app"}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-amber-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                          <span className="font-medium">
                            {isAmharic
                              ? `ትክክለኛውን የብር መጠን (${formatPrice(totalPrice)}) ወደ ሂሳብ ቁጥር ${abyssiniaAccount.account_number} ይላኩ`
                              : `Transfer exact amount (${formatPrice(totalPrice)}) to account ${abyssiniaAccount.account_number}`}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-amber-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                          <span className="font-medium">{t("orderModal.step3")}</span>
                        </div>
                        <div className="flex items-start gap-2 pt-0.5">
                          <span className="w-4 h-4 rounded-full bg-[#006838] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                          <span className="font-bold text-[#006838]">{t("orderModal.step4")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative shrink-0 w-28 sm:w-32 h-28 overflow-hidden flex items-center justify-end self-center">
                      <div className="w-22 sm:w-24 h-36 sm:h-40 bg-[#2b1b08] rounded-[22px] p-1 shadow-2xl -rotate-[10deg] border border-amber-300/40 relative -mr-2">
                        <div className="w-full h-full bg-gradient-to-b from-[#B45309] to-[#78350F] rounded-[18px] flex flex-col items-center justify-center p-2 relative overflow-hidden text-center">
                          <div className="w-6 h-1.5 bg-black/50 rounded-full mb-auto mt-0.5" />
                          <div className="my-auto flex flex-col items-center">
                            <AbyssiniaLogo size="sm" variant="phone" />
                            <span className="text-[9px] text-amber-200 font-extrabold mt-1">አቢሲኒያ</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 4. CASH ON DELIVERY BANNER (200 ETB ADVANCE DEPOSIT) ── */}
              {paymentMethod === "cash" && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-up">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 mt-0.5">🛡️</span>
                    <div>
                      <h4 className="text-sm font-black text-amber-950">
                        {t("orderModal.advanceDepositNotice")}
                      </h4>
                      <p className="text-xs text-amber-900/80 leading-relaxed mt-1">
                        {t("orderModal.advanceDepositExplanation")}
                      </p>
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-amber-200 text-center">
                    <div>
                      <span className="text-[10px] text-gray-500 block">{t("orderModal.total")}</span>
                      <span className="font-extrabold text-xs sm:text-sm text-gray-900">{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="border-x border-amber-100">
                      <span className="text-[10px] text-amber-700 font-bold block">{isAmharic ? "ቅድመ ክፍያ (አሁን)" : "Deposit (Pay Now)"}</span>
                      <span className="font-black text-xs sm:text-sm text-amber-700">{formatPrice(cashAdvanceAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 font-bold block">{isAmharic ? "ሲረከቡ የሚከፈል" : "Due on Delivery"}</span>
                      <span className="font-black text-xs sm:text-sm text-emerald-700">{formatPrice(Math.max(0, totalPrice - cashAdvanceAmount))}</span>
                    </div>
                  </div>

                  {/* 3 Quick Copy Account Options for the 200 ETB Deposit */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-800">{t("orderModal.payDepositTo")}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Telebirr */}
                      <div
                        onClick={() => handleCopy(telebirrAccount.account_number, "deposit_tb")}
                        className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-50 cursor-pointer transition flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-blue-900 block">Telebirr ({telebirrAccount.account_name})</span>
                          <span className="font-mono text-xs font-black text-gray-900">{telebirrAccount.account_number}</span>
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded shadow-2xs">
                          {copiedKey === "deposit_tb" ? "✓" : t("orderModal.copy")}
                        </span>
                      </div>

                      {/* CBE */}
                      <div
                        onClick={() => handleCopy(cbeAccount.account_number, "deposit_cbe")}
                        className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-50 cursor-pointer transition flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-purple-900 block">CBE ({cbeAccount.account_name})</span>
                          <span className="font-mono text-xs font-black text-gray-900">{cbeAccount.account_number}</span>
                        </div>
                        <span className="text-[10px] font-bold text-purple-700 bg-white px-1.5 py-0.5 rounded shadow-2xs">
                          {copiedKey === "deposit_cbe" ? "✓" : t("orderModal.copy")}
                        </span>
                      </div>

                      {/* Abyssinia */}
                      <div
                        onClick={() => handleCopy(abyssiniaAccount.account_number, "deposit_boa")}
                        className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-50 cursor-pointer transition flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-amber-900 block">Abyssinia ({abyssiniaAccount.account_name})</span>
                          <span className="font-mono text-xs font-black text-gray-900">{abyssiniaAccount.account_number}</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-800 bg-white px-1.5 py-0.5 rounded shadow-2xs">
                          {copiedKey === "deposit_boa" ? "✓" : t("orderModal.copy")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── MANDATORY SCREENSHOT ATTACHMENT BOX (REQUIRED FOR ALL METHODS) ── */}
              <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2 animate-fade-up">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <span>
                      {paymentMethod === "cash"
                        ? (isAmharic ? "የ 200 ብር ቅድመ ክፍያ ደረሰኝ ስክሪንሾት" : "200 ETB Advance Deposit Receipt Screenshot")
                        : t("orderModal.uploadScreenshot")}
                    </span>
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-gray-500">
                    {t("orderModal.uploadFormats")}
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  disabled={submitting}
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  className="hidden"
                />

                {!screenshotFile ? (
                  /* Upload Trigger Box */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-300 hover:border-[#006838] bg-emerald-50/20 hover:bg-emerald-50/40 rounded-xl p-3.5 text-center cursor-pointer transition group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-[#006838] group-hover:bg-[#006838]/10 flex items-center justify-center mx-auto mb-1.5 transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold text-gray-800 group-hover:text-[#006838] transition">
                      {t("orderModal.uploadPrompt")}
                    </p>
                    <p className="text-[11px] font-semibold text-[#006838] mt-1">
                      ⚠️ {paymentMethod === "cash"
                        ? (isAmharic ? "የትዕዛዝ ማረጋገጫ የ 200 ብር ቅድመ ክፍያ ደረሰኝ ማያያዝ ግዴታ ነው" : "Attaching the 200 ETB deposit receipt screenshot is required")
                        : t("orderModal.screenshotNotice")}
                    </p>
                  </div>
                ) : (
                  /* Selected Screenshot Preview */
                  <div className="bg-gray-50/80 rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                    <img
                      src={screenshotPreview}
                      alt="Payment screenshot preview"
                      className="w-14 h-14 rounded-lg object-cover border border-gray-200 bg-white shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-[#006838] flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                        <p className="text-xs font-bold text-gray-900 truncate">
                          {screenshotFile.name}
                        </p>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {formatFileSize(screenshotFile.size)}
                      </p>
                      <div className="flex gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={submitting}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {t("orderModal.changeScreenshot")}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveScreenshot}
                          disabled={submitting}
                          className="text-[11px] font-bold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                        >
                          {t("orderModal.removeScreenshot")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t("orderModal.note")}
                </label>
                <input
                  type="text"
                  disabled={submitting}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder={t("orderModal.notePlaceholder")}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder:text-gray-300 bg-white transition outline-none focus:border-[#006838] focus:ring-1 focus:ring-[#006838]"
                />
              </div>

            </div>

            {/* ── FOOTER BUTTONS ── */}
            <div className="px-6 sm:px-8 py-4 border-t border-gray-100 flex items-center gap-3 bg-white">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-8 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-sm hover:bg-gray-50 transition cursor-pointer shadow-2xs min-w-[130px]"
              >
                {t("orderModal.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3.5 rounded-xl bg-[#006838] hover:bg-[#00552e] text-white font-bold text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>{t("orderModal.submitting")}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{pendingOrder ? t("orderModal.retryPayment") : `${t("orderModal.submit")} (${formatPrice(totalPrice)})`}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
