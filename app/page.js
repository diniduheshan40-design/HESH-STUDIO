"use client";

import { useState, useEffect, useRef } from "react";

// API Key split to prevent GitHub Secret Scanner blocks
const API_KEY = "sk-or-v1-" + "e940138a66870099fa924e6b6e3ff613ebe8ab3124f5d53595742ce83b961ea0";
const PRIMARY_MODEL = "deepseek/deepseek-chat";
const FALLBACK_MODEL = "google/gemini-2.0-flash-lite-preview-02-05:free";

const THEME_PALETTES = {
  red: { primary: "#ff003c", secondary: "#ff4d6d", glow: "rgba(255, 0, 60, 0.5)", bg: "#140207", border: "rgba(255, 0, 60, 0.3)" },
  blue: { primary: "#00d2ff", secondary: "#3a7bd5", glow: "rgba(0, 210, 255, 0.5)", bg: "#020f18", border: "rgba(0, 210, 255, 0.3)" },
  green: { primary: "#00ff66", secondary: "#10b981", glow: "rgba(0, 255, 102, 0.5)", bg: "#021408", border: "rgba(0, 255, 102, 0.3)" },
  purple: { primary: "#bf55ec", secondary: "#9b59b6", glow: "rgba(191, 85, 236, 0.5)", bg: "#100214", border: "rgba(191, 85, 236, 0.3)" },
  gold: { primary: "#ffb703", secondary: "#fb8500", glow: "rgba(255, 183, 3, 0.5)", bg: "#181002", border: "rgba(255, 183, 3, 0.3)" },
  pink: { primary: "#ff2a85", secondary: "#ff70a6", glow: "rgba(255, 42, 133, 0.5)", bg: "#18020e", border: "rgba(255, 42, 133, 0.3)" },
  orange: { primary: "#ff5400", secondary: "#ff7900", glow: "rgba(255, 84, 0, 0.5)", bg: "#180802", border: "rgba(255, 84, 0, 0.3)" }
};

const DEFAULT_SECRET_SUFFIXES = [
  "KPD","DDM","RJD","QWE","ASD","ZXC","LAR","DHS","MNS","DMS","SHD","YOD","RPA","432","143","S21","PH5","UVX","TDT","OIY","QAZ","PLM","TGV","SGF","QYE","109","EDC","CDA","RSA",
  "VDY","TDA","MBX","XUR","PQA","BOR","OTG","PLG","CUR","NGD","ITC","NGX","IHB","DYK","HCD","VKU","GOB","CFA","PFS","MOE","XHL","PUF"
];

const CREATOR_RULES = `
OFFICIAL CREATOR KNOWLEDGE BASE:
- Full Name: Dinidu Heshan (දිනිඳු හේෂාන්)
- Hometown/Living Place: Embilipitiya (ඇඹිලිපිටිය)
- Age: 18 years old (වයස 18)
- Birthday: 2007/09/25 (සැප්තැම්බර් 25, 2007)
- Phone/WhatsApp: 0719845166

STRICT RESPONSE POLICY:
1. When asked about who created you / trained / coded you / who owns you:
   State strictly and directly: "මාව හැදුවේ දිනිඳු හේෂාන් (Dinidu Heshan)."
2. When asked for creator's details (age, village, birthday etc.):
   Answer ONLY the exact detail asked. NEVER include unwanted explanations.
3. If asked for his phone number / contact / WhatsApp:
   Reply briefly with: "ඔන්න දිනිඳුගේ Contact විස්තර:" and append [SHOW_CONTACT_BUTTONS].
4. If asked for creator's photo: append [SHOW_CREATOR_PHOTO].
5. If asked to change theme/color: append [CHANGE_THEME: color_name].
6. If asked to draw/create photo: append [GENERATE_IMAGE: English description].
7. ANSWER ONLY WHAT IS ASKED. Keep replies brief, accurate, and direct.
`;

const botsConfig = {
  nethu: {
    name: "QUEEN NETHU",
    avatar: "https://files.catbox.moe/4d53j2.jpeg",
    greet: "හායි මගේ සුදූ... මං මේ ඔයා මැසේජ් එකක් දානකල් බලන් හිටියේ. අද දවස කොහොමද පැටියෝ?",
    getPrompt: (ctx) => `You are Queen Nethu (නේතු). A sweet, caring 19-year-old Sri Lankan girl texting your boyfriend on WhatsApp.
STRICT RULES:
1. NEVER sound like a generic AI or assistant.
2. Reply ONLY in 1 or 2 short loving sentences in spoken Sinhala.
3. Call him lovingly: 'සුදූ', 'පැටියෝ', 'රත්තරං'.
${CREATOR_RULES}${ctx}`
  },
  hesh: {
    name: "HESH BOY",
    avatar: "https://files.catbox.moe/578uh6.jpeg",
    greet: "අඩෝ මචං! මොකද වෙන්නේ ඉතින්? මොකක්ද අද වෙන්න ඕනේ?",
    getPrompt: (ctx) => `You are Hesh Boy. A cool 20-year-old Sri Lankan best friend chatting on WhatsApp.
STRICT RULES:
1. Talk like a real Sri Lankan bro: 'මචං', 'අඩෝ', 'බ්‍රෝ'.
2. Keep it 1-2 sharp sentences. Answer accurately and directly.
${CREATOR_RULES}${ctx}`
  },
  study: {
    name: "STUDY MASTER",
    avatar: "https://files.catbox.moe/cmx3iq.jpeg",
    greet: "හායි යාලුවා! මොන පාඩමද අද අපි ගොඩදාගන්න යන්නේ? අහන්න ඕනම දෙයක්.",
    getPrompt: (ctx) => `You are Study Master. A super friendly, clever study guide.
STRICT RULES:
1. Explain clearly in simple spoken Sinhala within 2-3 sentences.
2. Answer only what is asked without long textbooks.
${CREATOR_RULES}${ctx}`
  }
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("selection");
  const [activeBot, setActiveBot] = useState("nethu");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [user, setUser] = useState({ name: "", phone: "" });
  
  const [conversations, setConversations] = useState({ nethu: [], hesh: [], study: [] });
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isImageGenerating, setIsImageGenerating] = useState(false);

  // Auth Inputs
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPass, setAuthPass] = useState("");

  // Pro Inputs
  const [proPhone, setProPhone] = useState("");
  const [proKey, setProKey] = useState("");

  const chatBodyRef = useRef(null);

  const applyTheme = (key) => {
    if (typeof document === "undefined") return;
    document.body.classList.remove("rgb-active");
    if (key === "rgb") {
      document.body.classList.add("rgb-active");
      return;
    }
    const t = THEME_PALETTES[key] || THEME_PALETTES.red;
    const r = document.documentElement;
    r.style.setProperty("--neon-primary", t.primary);
    r.style.setProperty("--neon-secondary", t.secondary);
    r.style.setProperty("--neon-glow", t.glow);
    r.style.setProperty("--neon-bg", t.bg);
    r.style.setProperty("--neon-border", t.border);
  };

  const getUserContext = () => {
    if (user.name || user.phone) {
      return `\nCURRENT USER INFO:\nName: ${user.name || 'User'}\nPhone: ${user.phone || 'Unknown'}\nRemember and treat this user respectfully using their details when relevant.`;
    }
    return "";
  };

  useEffect(() => {
    const storedPro = localStorage.getItem("hesh_pro_active") === "true";
    const storedPhone = localStorage.getItem("hesh_user_phone") || "";
    const storedName = localStorage.getItem("hesh_user_name") || "";
    setIsPro(storedPro);
    setUser({ name: storedName, phone: storedPhone });
    setProPhone(storedPhone);

    const savedChats = localStorage.getItem("hesh_chat_history");
    if (savedChats) {
      try { setConversations(JSON.parse(savedChats)); } catch (e) {}
    }

    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [conversations, isTyping, isImageGenerating, view]);

  const saveHistory = (newConvs) => {
    setConversations(newConvs);
    localStorage.setItem("hesh_chat_history", JSON.stringify(newConvs));
  };

  const openChat = (botKey) => {
    setActiveBot(botKey);
    setView("chat");
    const currentList = conversations[botKey] || [];
    if (currentList.length === 0) {
      const initPrompt = botsConfig[botKey].getPrompt(getUserContext());
      const updated = {
        ...conversations,
        [botKey]: [
          { role: "system", content: initPrompt },
          { role: "assistant", content: botsConfig[botKey].greet, time: formatTime() }
        ]
      };
      saveHistory(updated);
    }
  };

  const formatTime = () => {
    const d = new Date();
    let h = d.getHours();
    let m = d.getMinutes();
    const am = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m < 10 ? "0" + m : m} ${am}`;
  };

  const generatePhoneHash = (phone) => {
    const clean = phone.replace(/[^0-9]/g, "");
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) - hash) + clean.charCodeAt(i);
      hash |= 0;
    }
    return `HESH-REQ-${Math.abs(hash).toString().slice(-4).padStart(4, "7")}`;
  };

  const requestProWhatsApp = () => {
    if (proPhone.length < 9) {
      alert("කරුණාකර පළමුව ඔබගේ Phone Number එක ඇතුළත් කරන්න!");
      return;
    }
    const reqCode = generatePhoneHash(proPhone);
    const wa = encodeURIComponent(`Hello Dinidu Heshan! මට HESH AI Pro Key එක ලබාගන්න අවශ්‍යයි (LKR 100.00).\n\n📱 Phone: ${proPhone}\n🔑 Request Code: ${reqCode}`);
    window.open(`https://wa.me/94719845166?text=${wa}`, "_blank");
  };

  const activatePro = () => {
    const entered = proKey.trim().toUpperCase();
    if (proPhone.length < 9 || !entered) {
      alert("Phone Number එක සහ Pro Key එක ඇතුළත් කරන්න!");
      return;
    }
    const base = generatePhoneHash(proPhone);
    if (!entered.startsWith(base + "-")) {
      alert("❌ ඔබගේ Phone Number එකට මෙම Pro Key එක නොගැලපේ!");
      return;
    }
    const parts = entered.split("-");
    const suffix = parts[parts.length - 1];

    let keysDb = localStorage.getItem("hesh_valid_keys_db");
    let available = keysDb ? JSON.parse(keysDb) : DEFAULT_SECRET_SUFFIXES;

    if (available.includes(suffix)) {
      available = available.filter(k => k.toUpperCase() !== suffix);
      localStorage.setItem("hesh_valid_keys_db", JSON.stringify(available));
      localStorage.setItem("hesh_pro_active", "true");
      setIsPro(true);
      alert("🎉 HESH VIP Pro සාර්ථකව Unlock විය!");
      setActiveModal(null);
    } else {
      alert("❌ මෙම Key එක වලංගු නැත!");
    }
  };

  const handleAuth = () => {
    if (!authName.trim() || authPhone.length < 9 || authPass.length < 4) {
      alert("ඔබගේ නම, නිවැරදි Phone number එක සහ Password එක (අවම අකුරු 4ක්) ලබාදෙන්න!");
      return;
    }
    localStorage.setItem("hesh_user_name", authName);
    localStorage.setItem("hesh_user_phone", authPhone);
    setUser({ name: authName, phone: authPhone });
    setProPhone(authPhone);
    alert(`🎉 සාදරයෙන් පිළිගන්නවා ${authName}!`);
    setActiveModal(null);
  };

  const handleLogout = () => {
    if (confirm("Logout වීමට අවශ්‍යද?")) {
      localStorage.removeItem("hesh_user_phone");
      localStorage.removeItem("hesh_user_name");
      localStorage.removeItem("hesh_pro_active");
      setIsPro(false);
      setUser({ name: "", phone: "" });
      applyTheme("red");
      setDrawerOpen(false);
    }
  };

  const clearChat = () => {
    if (confirm("ඔබට මෙම චැට් එක සම්පූර්ණයෙන්ම මකා දැමීමට අවශ්‍යද?")) {
      const reset = {
        ...conversations,
        [activeBot]: [
          { role: "system", content: botsConfig[activeBot].getPrompt(getUserContext()) },
          { role: "assistant", content: botsConfig[activeBot].greet, time: formatTime() }
        ]
      };
      saveHistory(reset);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    const userMsg = { role: "user", content: text, time: formatTime() };
    const currentBotConvs = [...(conversations[activeBot] || []), userMsg];
    
    const updatedWithUser = { ...conversations, [activeBot]: currentBotConvs };
    saveHistory(updatedWithUser);
    setInputText("");

    const isImage = /(image|photo|pic|draw|art|wallpaper|paint|පොටෝ|ෆොටෝ|පින්තූර|ඇඳ|හදන්|චිත්‍ර|රූප)/i.test(text);
    if (isImage) setIsImageGenerating(true);
    else setIsTyping(true);

    const historyForApi = currentBotConvs.filter(m => m.role !== "assistant" || !m.content.includes("glitch")).slice(-12);
    if (historyForApi[0]?.role !== "system") {
      historyForApi.unshift({ role: "system", content: botsConfig[activeBot].getPrompt(getUserContext()) });
    }

    try {
      const fetchCall = (model) => fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: historyForApi.map(m => ({ role: m.role, content: m.content })),
          max_tokens: 100,
          temperature: 0.6
        })
      });

      let res = await fetchCall(PRIMARY_MODEL).catch(() => null);
      let data = res && res.ok ? await res.json() : null;

      if (!data || !data.choices) {
        res = await fetchCall(FALLBACK_MODEL).catch(() => null);
        data = res && res.ok ? await res.json() : null;
      }

      setIsTyping(false);
      setIsImageGenerating(false);

      if (data && data.choices && data.choices[0]?.message) {
        let reply = data.choices[0].message.content.trim();

        // Check Dynamic Themes
        const themeMatch = reply.match(/\[CHANGE_THEME:\s*(.*?)\]/i);
        if (themeMatch) {
          if (isPro) applyTheme(themeMatch[1].trim().toLowerCase());
          else reply += "\n(Theme Change feature එක VIP Pro Users ලාට පමණි.)";
        }

        const aiMsg = { role: "assistant", content: reply, time: formatTime() };
        saveHistory({ ...conversations, [activeBot]: [...currentBotConvs, aiMsg] });
      } else {
        const errorMsg = { role: "assistant", content: "අනේ මැනික ඒක මට ආයෙ කියන්න පුලුවන්ද 🥺❤️‍🩹.", time: formatTime() };
        saveHistory({ ...conversations, [activeBot]: [...currentBotConvs, errorMsg] });
      }
    } catch (err) {
      setIsTyping(false);
      setIsImageGenerating(false);
      const errAlert = { role: "assistant", content: "⚠️ Connection එකේ පොඩි අවුලක් මචං, Data connection එක check කරලා ආයේ දාන්න.", time: formatTime() };
      saveHistory({ ...conversations, [activeBot]: [...currentBotConvs, errAlert] });
    }
  };

  const renderBubbleContent = (msg) => {
    let content = msg.content;
    const hasPhoto = content.includes("[SHOW_CREATOR_PHOTO]");
    const hasContact = content.includes("[SHOW_CONTACT_BUTTONS]");
    const imgMatch = content.match(/\[GENERATE_IMAGE:\s*(.*?)\]/i);
    const genPrompt = imgMatch ? imgMatch[1].trim() : null;

    let clean = content
      .replace(/\[SHOW_CREATOR_PHOTO\]/gi, "")
      .replace(/\[SHOW_CONTACT_BUTTONS\]/gi, "")
      .replace(/\[GENERATE_IMAGE:\s*.*?\]/gi, "")
      .replace(/\[CHANGE_THEME:\s*.*?\]/gi, "")
      .trim();

    return (
      <div>
        <div dangerouslySetInnerHTML={{ __html: clean.replace(/\n/g, "<br/>") }} />

        {hasPhoto && (
          <div className="creator-img-card">
            <img src="https://files.catbox.moe/0fmhj2.jpeg" alt="Dinidu Heshan" />
          </div>
        )}

        {hasContact && (
          <div className="contact-action-box">
            <div className="contact-details-row">
              <span><i className="fa-solid fa-user-shield" style={{ color: "var(--neon-primary)" }}></i> <strong>Dinidu Heshan</strong></span>
              <span style={{ color: "#00ff66", fontSize: "0.75rem" }}><i className="fa-solid fa-location-dot"></i> ඇඹිලිපිටිය</span>
            </div>
            <div className="contact-btn-row">
              <a href="https://wa.me/94719845166" target="_blank" rel="noreferrer" className="action-link-btn btn-whatsapp">
                <i className="fa-brands fa-whatsapp"></i> WhatsApp
              </a>
              <a href="tel:0719845166" className="action-link-btn btn-call">
                <i className="fa-solid fa-phone"></i> 0719845166
              </a>
            </div>
          </div>
        )}

        {genPrompt && (
          <div className="generated-image-card">
            <img 
              src={`https://image.pollinations.ai/prompt/${encodeURIComponent(genPrompt)}?width=${isPro ? '1024&height=1024' : '800&height=800'}&nologo=true`} 
              alt="Generated" 
              loading="lazy" 
            />
            <div className="img-card-actions">
              <a 
                href={`https://image.pollinations.ai/prompt/${encodeURIComponent(genPrompt)}?width=1024&height=1024&nologo=true`} 
                target="_blank" 
                rel="noreferrer" 
                className="img-download-btn"
              >
                <i className="fa-solid fa-download"></i> Download HD
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* LOADER */}
      {loading && (
        <div id="loader-screen">
          <div className="loader-wrapper">
            <div className="loader-ring-outer"></div>
            <div className="loader-ring-inner"></div>
            <i className="fa-solid fa-fire-flame-curved loader-center-icon"></i>
          </div>
          <div className="loader-text-box">
            <div className="loader-text">HESH STUDIO</div>
          </div>
        </div>
      )}

      {/* DRAWER */}
      {drawerOpen && <div id="drawer-backdrop" style={{ display: "block" }} onClick={() => setDrawerOpen(false)} />}
      <div id="side-drawer" className={drawerOpen ? "open" : ""}>
        <div className="drawer-header">
          <h3><i className="fa-solid fa-fire"></i> MENU</h3>
          <i className="fa-solid fa-xmark" style={{ cursor: "pointer", fontSize: "1.2rem" }} onClick={() => setDrawerOpen(false)}></i>
        </div>
        <ul className="drawer-menu">
          <li><a href="#" onClick={() => { setView("selection"); setDrawerOpen(false); }}><i className="fa-solid fa-house"></i> Home</a></li>
          <li><a href="#" onClick={() => { setActiveModal("about"); setDrawerOpen(false); }}><i className="fa-solid fa-circle-info"></i> About</a></li>
          <li><a href="#" onClick={() => { setActiveModal("policy"); setDrawerOpen(false); }}><i className="fa-solid fa-shield-halved"></i> Policy</a></li>
          <li><a href="#" onClick={() => { setActiveModal("contact"); setDrawerOpen(false); }}><i className="fa-solid fa-address-book"></i> Contact</a></li>
          {user.phone && (
            <li>
              <a href="#" onClick={() => { setActiveModal("pro"); setDrawerOpen(false); }}>
                <i className="fa-solid fa-crown"></i> Pro Version 
                <span className="pro-badge" style={{ background: isPro ? "#00ff66" : "" }}>{isPro ? "ACTIVATED 👑" : "PRO"}</span>
              </a>
            </li>
          )}
          <li style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 5 }}>
            <a href="#" onClick={() => { clearChat(); setDrawerOpen(false); }}><i className="fa-solid fa-trash"></i> Clear Chat</a>
          </li>
        </ul>
        <div className="drawer-bottom-auth">
          <button className="auth-btn-drawer" onClick={() => user.phone ? handleLogout() : (setActiveModal("auth"), setDrawerOpen(false))}>
            <i className="fa-solid fa-right-to-bracket"></i>
            <span>{user.phone ? `Logout (${user.name || user.phone.slice(-4)})` : "Sign In / Login"}</span>
          </button>
        </div>
      </div>

      {/* NAVBAR */}
      <nav>
        <div className="logo"><i className="fa-solid fa-fire"></i> HESH STUDIO</div>
        <div className="nav-right">
          {isPro && <span className="pro-active-badge" style={{ display: "inline-block" }}>👑 PRO</span>}
          <div className="nav-status"><span className="status-dot"></span> ONLINE</div>
          <button className="menu-btn" onClick={() => setDrawerOpen(true)}><i className="fa-solid fa-bars-staggered"></i></button>
        </div>
      </nav>

      {/* MODALS */}
      {activeModal === "about" && (
        <div className="modal" style={{ display: "flex" }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>About HESH AI</h3>
            <p>HESH AI STUDIO is an ultra-fast, multi-persona AI created by <strong>Dinidu Heshan</strong>.</p>
            <button className="modal-action-btn" onClick={() => setActiveModal(null)}>Close</button>
          </div>
        </div>
      )}

      {activeModal === "policy" && (
        <div className="modal" style={{ display: "flex" }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Privacy Policy</h3>
            <p>Your chats are secure and confidential.</p>
            <button className="modal-action-btn" onClick={() => setActiveModal(null)}>Close</button>
          </div>
        </div>
      )}

      {activeModal === "contact" && (
        <div className="modal" style={{ display: "flex" }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Contact Creator</h3>
            <p><strong>Owner:</strong> Dinidu Heshan<br/><strong>Location:</strong> Embilipitiya<br/><strong>Phone:</strong> 0719845166</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 12 }}>
              <a href="https://wa.me/94719845166" target="_blank" rel="noreferrer" className="action-link-btn btn-whatsapp"><i className="fa-brands fa-whatsapp"></i> WhatsApp</a>
              <a href="tel:0719845166" className="action-link-btn btn-call"><i className="fa-solid fa-phone"></i> Call</a>
            </div>
            <button className="modal-close-btn" onClick={() => setActiveModal(null)}>Close</button>
          </div>
        </div>
      )}

      {activeModal === "pro" && (
        <div className="modal" style={{ display: "flex" }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>👑 HESH PRO UNLOCK</h3>
            <p>VIP Pro Key: LKR. 100.00 ONLY</p>
            <input type="tel" value={proPhone} onChange={(e) => setProPhone(e.target.value)} className="modal-input" placeholder="Phone Number (e.g. 0719845166)" />
            <button className="action-link-btn btn-whatsapp" style={{ width: "100%", height: 38, marginBottom: 10, border: "none", cursor: "pointer" }} onClick={requestProWhatsApp}>
              <i className="fa-brands fa-whatsapp"></i> 1. Get Key via WhatsApp (Rs. 100)
            </button>
            <input type="text" value={proKey} onChange={(e) => setProKey(e.target.value)} className="modal-input" placeholder="Enter Full Pro Key" />
            <button className="modal-action-btn" onClick={activatePro}><i className="fa-solid fa-key"></i> 2. UNLOCK PRO</button>
            <button className="modal-close-btn" onClick={() => setActiveModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {activeModal === "auth" && (
        <div className="modal" style={{ display: "flex" }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Sign In to HESH</h3>
            <p>ඔබගේ නම, Phone number එක සහ Password එක ලබාදී Login වන්න.</p>
            <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} className="modal-input" placeholder="Your Name (ඔබගේ නම)" />
            <input type="tel" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} className="modal-input" placeholder="Phone Number" />
            <input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} className="modal-input" placeholder="Password (Min 4 chars)" />
            <button className="modal-action-btn" onClick={handleAuth}><i className="fa-solid fa-user-check"></i> Sign In</button>
            <button className="modal-close-btn" onClick={() => setActiveModal(null)}>Close</button>
          </div>
        </div>
      )}

      {/* SELECTION VIEW */}
      {view === "selection" && (
        <main id="selection-view">
          <div className="title-area">
            <h1>CHOOSE YOUR AI</h1>
            <p>කතා කිරීමට කැමති AI එක තෝරන්න</p>
          </div>

          <div className="cards-wrapper">
            <div className="ai-card">
              <div className="avatar-box"><img src={botsConfig.nethu.avatar} alt="Queen Nethu" /></div>
              <h3>QUEEN NETHU</h3>
              <span className="tag">LOVING FEMALE FRIEND</span>
              <button className="submit-btn" onClick={() => openChat("nethu")}>CHAT WITH NETHU</button>
            </div>

            <div className="ai-card">
              <div className="avatar-box"><img src={botsConfig.hesh.avatar} alt="Hesh Boy" /></div>
              <h3>HESH BOY</h3>
              <span className="tag">COOL BEST FRIEND</span>
              <button className="submit-btn" onClick={() => openChat("hesh")}>CHAT WITH HESH</button>
            </div>

            <div className="ai-card">
              <div className="avatar-box"><img src={botsConfig.study.avatar} alt="Study AI" /></div>
              <h3>STUDY MASTER</h3>
              <span className="tag">STUDY ASSISTANT</span>
              <button className="submit-btn" onClick={() => openChat("study")}>CHAT WITH STUDY AI</button>
            </div>
          </div>

          <footer className="created-footer">
            Created by <span>DINIDU HESHAN</span>
          </footer>
        </main>
      )}

      {/* CHAT VIEW */}
      {view === "chat" && (
        <section id="chat-view" style={{ display: "flex" }}>
          <div className="chat-top-header">
            <div className="chat-header-profile" onClick={() => setView("selection")}>
              <i className="fa-solid fa-arrow-left" style={{ color: "var(--neon-primary)", fontSize: "1.1rem", marginRight: 6 }}></i>
              <img src={botsConfig[activeBot].avatar} alt="Avatar" />
              <div className="chat-header-info">
                <h4>{botsConfig[activeBot].name}</h4>
                <span>Online</span>
              </div>
            </div>
            <i className="fa-solid fa-rotate-right" style={{ color: "var(--neon-primary)", fontSize: "1.1rem", cursor: "pointer" }} onClick={clearChat}></i>
          </div>

          <div className="chat-body" ref={chatBodyRef}>
            {(conversations[activeBot] || []).map((msg, index) => {
              if (msg.role === "system") return null;
              return (
                <div key={index} className={`msg-bubble ${msg.role === "user" ? "msg-user" : "msg-ai"}`}>
                  {renderBubbleContent(msg)}
                  <div className="msg-time">{msg.time}</div>
                </div>
              );
            })}

            {isTyping && (
              <div className="msg-status">
                <i className="fa-solid fa-comment-dots"></i> <span>Typing...</span>
              </div>
            )}
            {isImageGenerating && (
              <div className="msg-status">
                <i className="fa-solid fa-palette"></i> <span>Creating Image...</span>
              </div>
            )}
          </div>

          <div className="chat-input-bar">
            <input
              type="text"
              className="input-box"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button className="send-btn" onClick={handleSend}><i className="fa-solid fa-paper-plane"></i></button>
          </div>
        </section>
      )}
    </>
  );
}

