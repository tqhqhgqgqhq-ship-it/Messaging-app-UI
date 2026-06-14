import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ObsidianBackground from "./components/ObsidianBackground";
import SignInView from "./components/auth/SignInView";
import SignUpView from "./components/auth/SignUpView";
import ForgotView from "./components/auth/ForgotView";
import ResetPasswordView from "./components/auth/ResetPasswordView";
import RecoveryTokenView from "./components/auth/RecoveryTokenView";
import MessagingApp from "./MessagingApp";

function NudgelLogo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="39" height="39" rx="12" fill="url(#nLogoGrad)" stroke="rgba(255,240,220,0.14)" />
      <path d="M12 28V14.5L15.6 14.5V28H12Z" fill="#f0e8d8" />
      <path d="M18 28V14.5H21.6C24.2 14.5 26 16.2 26 18.5C26 20.8 24.2 22.4 21.6 22.4H20.5V28H18ZM20.5 20.4H21.3C22.9 20.4 23.8 19.6 23.8 18.5C23.8 17.4 22.9 16.6 21.3 16.6H20.5V20.4Z" fill="#f0e8d8" />
      <path d="M28.2 28L25 22.2V14.5H27.4V21.5L30.5 28H28.2Z" fill="#f0e8d8" opacity="0.7" />
      <defs>
        <linearGradient id="nLogoGrad" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0" stopColor="#2a2a32" />
          <stop offset="0.5" stopColor="#1c1c24" />
          <stop offset="1" stopColor="#101016" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type Mode = "signin" | "signup" | "forgot" | "reset";

function AuthShell() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [newAccount, setNewAccount] = useState<{ token: string; email: string } | null>(null);
  const [recoverySession, setRecoverySession] = useState<{ email: string; token: string } | null>(null);

  // Show loading spinner while Firebase checks auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4A853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ✅ After successful sign-in/sign-up → show Messaging App homepage directly
  if (user) return <MessagingApp />;

  const showTabs = mode === "signin" || mode === "signup";
  const activeTab = mode === "signup" ? "signup" : "signin";

  return (
    <>
      <AnimatePresence>
        {newAccount && (
          <RecoveryTokenView
            key="recovery"
            token={newAccount.token}
            email={newAccount.email}
            onConfirmed={() => setNewAccount(null)}
          />
        )}
      </AnimatePresence>

      <div className="relative min-h-screen bg-[#050507] text-[#ece8e2] overflow-hidden">
        <ObsidianBackground />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-90"
          style={{ background: "radial-gradient(1100px 360px at 50% -40px, rgba(255,246,231,0.049), transparent 70%)" }}
        />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="w-full max-w-[580px] mx-auto px-6 md:px-10 py-12 md:py-16">
            <motion.div initial={{ opacity: 0, y: 30, scale: 0.988 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.82, ease: [0.25, 0.1, 0.25, 1] }} className="relative">
              <div className="absolute -inset-8 rounded-[44px] opacity-55 blur-[42px] pointer-events-none"
                style={{ background: "radial-gradient(480px 340px at 50% 85%, rgba(214,189,150,0.07), transparent 70%)" }}
              />
              <div className="relative rounded-[30px] border border-white/[0.116] bg-[linear-gradient(180deg,rgba(255,255,255,0.053),rgba(255,255,255,0.022))] backdrop-blur-[26px] shadow-[0_34px_120px_rgba(0,0,0,0.66),inset_0_1px_0_rgba(255,255,255,0.085)]">
                <div className="absolute top-0 left-7 right-7 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <div className="px-[30px] md:px-[42px] pt-[32px] md:pt-[36px] pb-[30px] md:pb-[34px]">
                  <div className="flex items-center justify-between mb-7">
                    <div className="flex items-center gap-3">
                      <NudgelLogo size={38} />
                      <div>
                        <div className="text-[16px] font-[680] tracking-[-0.018em] text-[#f1e8da]">Nudgel</div>
                        <div className="mono text-[10.2px] text-[#b0a896] -mt-[1px]">TURSO • 2.7</div>
                      </div>
                    </div>
                    <div className="text-[11.5px] text-[#9e968a] mono tracking-wide">SECURE</div>
                  </div>

                  {showTabs && (
                    <div className="mb-7">
                      <div className="relative rounded-[17.5px] p-[4.5px] bg-[#0a0a10] border border-white/[0.09] shadow-[inset_0_2px_3px_rgba(0,0,0,.98),inset_0_1px_0_rgba(255,255,255,.035),0_12px_40px_rgba(0,0,0,.52)]">
                        <div className="absolute top-[4.5px] left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/[0.11] to-transparent pointer-events-none rounded-full" />
                        <div className="grid grid-cols-2 relative text-[14.2px] font-[620] tracking-[-0.009em]">
                          <motion.div className="absolute top-0 bottom-0 rounded-[12.8px] z-[1]"
                            style={{
                              width: "50%",
                              background: "linear-gradient(180deg, #2c2c36 0%, #1c1c24 44%, #111117 100%)",
                              boxShadow: "inset 0 1px 0 rgba(255,247,230,0.17), inset 0 -1px 0 rgba(0,0,0,.95), 0 8px 26px rgba(0,0,0,.62), 0 0 30px rgba(218,191,148,.06)",
                              border: "1px solid rgba(255,236,205,0.145)",
                            }}
                            animate={{ x: activeTab === "signin" ? "0%" : "100%" }}
                            transition={{ type: "spring", stiffness: 480, damping: 36, mass: 0.6 }}
                          >
                            <span className="absolute inset-0 rounded-[12.8px] pointer-events-none"
                              style={{ background: "linear-gradient(180deg, rgba(255,244,220,0.115), rgba(255,244,220,0.025) 30%, transparent 58%, rgba(0,0,0,0.3))" }}
                            />
                            <span className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent pointer-events-none" />
                          </motion.div>
                          <button onClick={() => setMode("signin")} className={`relative z-[2] py-[13px] rounded-[12.5px] transition-colors duration-200 focus:outline-none ${activeTab === "signin" ? "text-[#f1e7d5]" : "text-[#9a9389] hover:text-[#d2c9bb]"}`}>Sign In</button>
                          <button onClick={() => setMode("signup")} className={`relative z-[2] py-[13px] rounded-[12.5px] transition-colors duration-200 focus:outline-none ${activeTab === "signup" ? "text-[#f1e7d5]" : "text-[#9a9389] hover:text-[#d2c9bb]"}`}>Sign Up</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {mode === "signin" && (
                      <motion.div key="signin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}>
                        <SignInView onForgot={() => setMode("forgot")} />
                      </motion.div>
                    )}
                    {mode === "signup" && (
                      <motion.div key="signup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}>
                        <SignUpView
                          onSuccess={(token, email) => {
                            setNewAccount({ token, email });
                            setMode("signin");
                          }}
                        />
                      </motion.div>
                    )}
                    {mode === "forgot" && (
                      <motion.div key="forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}>
                        <ForgotView
                          onBack={() => setMode("signin")}
                          onTokenVerified={(_email, _uid) => {
                            alert("Recovery token verified. To complete the password reset, please sign in with your current password first, then re-enter the recovery token in Settings.");
                            setMode("signin");
                          }}
                        />
                      </motion.div>
                    )}
                    {mode === "reset" && recoverySession && (
                      <motion.div key="reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}>
                        <ResetPasswordView
                          email={recoverySession.email}
                          token={recoverySession.token}
                          onDone={() => { setMode("signin"); setRecoverySession(null); }}
                          onNewToken={(_t) => { }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="text-center text-[12.1px] text-[#8e887e] mt-5 mono tracking-wide">
                Secured by Obsidian 2.7
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthShell />
    </AuthProvider>
  );
}
