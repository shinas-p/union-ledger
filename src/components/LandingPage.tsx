import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Building,
  Coins,
  Target,
  Users,
  ScrollText,
  FileSpreadsheet,
  Globe,
  Bell,
  Heart,
  ArrowRight,
  Shield,
  HelpCircle,
  Download,
  CheckCircle,
  Menu,
  X,
  Lock,
  ChevronDown,
  Sparkles,
  Award,
  BookOpen,
  PieChart as PieIcon,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell 
} from 'recharts';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  isLoggedIn: boolean;
  onOpenJoinModal?: () => void;
}

export function LandingPage({ onNavigate, isLoggedIn, onOpenJoinModal }: LandingPageProps) {
  // Mobile navigation drawer toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // FAQ state toggles
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

  // Live PWA installation tracking state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Example mockup data interactive filters
  const [mockupFilter, setMockupFilter] = useState<'All' | 'Income' | 'Expense'>('All');

  // Sync SEO Title & Meta Description on mount
  useEffect(() => {
    document.title = "Union Ledger - Transparent Finance Management for Student Unions";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Track income, expenses, campaigns, approvals, and audits in one secure, accessible, dynamic financial platform suited for student organizations.");
    }
  }, []);

  // Monitor PWA installation prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('[PWA] beforeinstallprompt captured.');
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('[PWA] Installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Baseline check if already running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle installation event dispatch
  const triggerPWAInstall = async () => {
    if (!deferredPrompt) {
      // Fallback instruction helper if not supported natively on standard standalone browser criteria
      alert("Installation shortcut: Tap your browser's menu button (three dots or share button) and select 'Add to Home Screen' or 'Install' to save Union Ledger directly.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install choice outcome: ${outcome}`);
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const features = [
    {
      title: "Income Tracking",
      description: "Direct collections registration with detailed metadata categories.",
      icon: Coins,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100"
    },
    {
      title: "Expense Management",
      description: "Approve, request, and catalogue student event expenditures cleanly.",
      icon: Heart,
      color: "text-rose-600 bg-rose-50 border-rose-100"
    },
    {
      title: "Campaign Fundraising",
      description: "Set campaign target goals, track progress logs, and publish transparency gauges.",
      icon: Target,
      color: "text-blue-600 bg-blue-50 border-blue-100"
    },
    {
      title: "Role-Based Access",
      description: "Define separate auditor, treasurer, administrator, and viewer clearance layers.",
      icon: Shield,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100"
    },
    {
      title: "Organization Management",
      description: "Toggle seamlessly between different union chapters and activity councils.",
      icon: Building,
      color: "text-[#A8CC00] bg-lime-50 border-lime-100"
    },
    {
      title: "Audit Timeline",
      description: "Every modification maps directly to a tamper-resistant historical audit list.",
      icon: ScrollText,
      color: "text-amber-600 bg-amber-50 border-amber-100"
    },
    {
      title: "Transparency Portal",
      description: "Generate one-click public visual portals to win student constituent confidence.",
      icon: Globe,
      color: "text-cyan-600 bg-cyan-50 border-cyan-100"
    },
    {
      title: "Notifications",
      description: "Stay informed instantly of transaction approvals and incoming contributions.",
      icon: Bell,
      color: "text-purple-600 bg-purple-50 border-purple-100"
    },
    {
      title: "Reports & Exports",
      description: "Export clean CSV, TSV or ledger sheets instantly for audits and archiving.",
      icon: FileSpreadsheet,
      color: "text-teal-600 bg-teal-50 border-teal-100"
    },
    {
      title: "Multi-Organization Support",
      description: "Perfect for complex student associations that control numerous individual branches.",
      icon: Users,
      color: "text-purple-600 bg-purple-50 border-purple-150"
    }
  ];

  const steps = [
    {
      step: "01",
      title: "Create Organization",
      description: "Set up a clean organizational chapter workspace, complete with chosen local currency, visual banner rules, and branding codes."
    },
    {
      step: "02",
      title: "Invite Members",
      description: "Generate specific invite tokens directly configured as Admin, Treasurer, Auditor, or Viewer roles to establish access boundaries."
    },
    {
      step: "03",
      title: "Record Transactions",
      description: "Track each union budget dispatch, fundraiser receipt, or expense claim with high-fidelity classifications and custom timestamps."
    },
    {
      step: "04",
      title: "Approve & Audit",
      description: "Authorized members review actions, approve requests dynamically, and trace revisions chronologically within safe logs."
    },
    {
      step: "05",
      title: "Generate Reports",
      description: "Deploy public portals showing exact balances and target campaign metrics to build absolute peer trust."
    }
  ];

  const testimonials = [
    {
      quote: "Union Ledger completely cleared out our manual tracking excel friction. We managed double the student festival fundraisers with absolute confidence, since everyone's work was fully tracked and audited.",
      name: "Pranav Deshmukh",
      role: "Student Union Treasurer",
      avatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Pranav&backgroundColor=b6e3f4"
    },
    {
      quote: "As an auditor, looking at disorganized physical folders is painful. With Union Ledger, I can verify expense justifications, member authorizations, and bank matches online in half the duration.",
      name: "Dr. Anirudh Sen",
      role: "University Financial Auditor",
      avatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Anirudh&backgroundColor=f1f4c6"
    },
    {
      quote: "Transparency was our election milestone. By using the Public Portal aspect, we showed thousands of campus constituents exactly where their student council fees were deployed.",
      name: "Meera Nair",
      role: "Campus Organization President",
      avatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Meera&backgroundColor=ffdfbf"
    }
  ];

  const faqs = [
    {
      question: "What is Union Ledger?",
      answer: "Union Ledger is a full-featured financial management software tailored for university student unions, clubs, and societies. It introduces strict role boundaries (Treasurers, Auditors, Admins) to track funds, handle expense approvals, manage student fundraising campaigns, and publish transparent dashboards for constituents."
    },
    {
      question: "Can multiple organizations be managed?",
      answer: "Yes! The platform supports native Multi-Organization Workspace configurations. An logged-in user can join separate clubs using special invite links, or create entirely new portals and switch between them instantly from any view."
    },
    {
      question: "How are permissions controlled?",
      answer: "We support four key roles with granular clearance restrictions: Admins control access, Treasurers enter and approve ledger changes, Auditors inspect security timelines, and Viewers read approved records without modification abilities."
    },
    {
      question: "Can reports be exported?",
      answer: "Absolutely. All transactions lists, audits, and campaign reports are exportable to universal CSV sheets so they can be reviewed inside any general spreadsheet software or filed with school administrations."
    },
    {
      question: "Is data secure?",
      answer: "We protect all transactions registries and accounts using Enterprise Grade Supabase Auth alongside rigorous backend transaction confirmation engines. Every action is cryptographically tied to verified accounts, logging timestamps automatically."
    }
  ];

  // Dummy mockup transactions database
  const mockupTx = [
    { id: 1, text: "Constituent Annual Dues", amount: 125000, type: "Income", category: "Dues" },
    { id: 2, text: "Annual Cultural Fest", amount: -40000, type: "Expense", category: "Events" },
    { id: 3, text: "Tech Fair Banner Ads", amount: 12000, type: "Income", category: "Sponsorship" },
    { id: 4, text: "Speaker Lounge Catering", amount: -15000, type: "Expense", category: "Catering" },
    { id: 5, text: "Prizes & Trophy Shields", amount: -32500, type: "Expense", category: "Awards" },
  ];

  const filteredMockup = mockupFilter === 'All' 
    ? mockupTx 
    : mockupTx.filter(t => t.type === mockupFilter);

  // Recharts aggregate data
  const chartsData = [
    { name: 'Income', amount: 137000 },
    { name: 'Expenses', amount: 87500 },
    { name: 'Net Balance', amount: 49500 },
  ];

  const COLORS = ['#10B981', '#EF4444', '#A8CC00'];

  return (
    <div className="min-h-screen bg-white text-[#111111] overflow-x-hidden selection:bg-[#D6FF20] selection:text-[#111111]">
      
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="w-10 h-10 bg-[#111111] text-[#D6FF20] rounded-xl flex items-center justify-center font-black shadow-md border border-zinc-800">
              UL
            </div>
            <div>
              <span className="font-extrabold text-[17px] tracking-tight text-[#111111] block leading-none">Union Ledger</span>
              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block mt-0.5">Fintech Transparency</span>
            </div>
          </div>

          {/* Desktop Navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-600">
            <a href="#features" className="hover:text-[#111111] transition-colors">Key Features</a>
            <a href="#how-it-works" className="hover:text-[#111111] transition-colors">How it Works</a>
            <a href="#live-preview" className="hover:text-[#111111] transition-colors">Public Preview</a>
            <a href="#faqs" className="hover:text-[#111111] transition-colors">FAQs</a>
          </nav>

          {/* Dynamic Sign-in Access Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <button 
                onClick={() => onNavigate('/dashboard')}
                className="bg-[#111111] text-white hover:bg-zinc-800 font-bold text-xs tracking-wide py-2.5 px-5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>Launch App</span>
                <ArrowRight size={14} className="text-[#D6FF20]" />
              </button>
            ) : (
              <>
                <button 
                  onClick={() => onNavigate('/login')}
                  className="text-[#111111] hover:bg-zinc-50 font-bold text-xs tracking-wide py-2.5 px-4 rounded-xl cursor-pointer transition-all border border-zinc-200"
                >
                  Log In
                </button>
                <button 
                  onClick={() => onNavigate('/register')}
                  className="bg-[#111111] text-[#D6FF20] hover:bg-zinc-800 font-bold text-xs tracking-wide py-2.5 px-5 rounded-xl cursor-pointer transition-all border border-zinc-900 shadow-sm"
                >
                  Create Account
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger menu toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-zinc-650 hover:bg-zinc-50 rounded-lg cursor-pointer"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-zinc-900/60 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-4/5 max-w-sm bg-white p-6 shadow-2xl flex flex-col space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <span className="font-extrabold text-[#111111]">Navigation</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded hover:bg-zinc-100 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex flex-col space-y-4 font-bold text-zinc-700">
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-900">Key Features</a>
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-900">How It Works</a>
              <a href="#live-preview" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-900">Public Preview</a>
              <a href="#faqs" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-900">FAQs</a>
            </div>

            <div className="border-t border-zinc-100 pt-6 space-y-3">
              {isLoggedIn ? (
                <button 
                  onClick={() => { onNavigate('/dashboard'); setIsMobileMenuOpen(false); }}
                  className="w-full bg-[#111111] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"
                >
                  <span>Open App Dashboard</span>
                  <ArrowRight size={14} className="text-[#D6FF20]" />
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => { onNavigate('/login'); setIsMobileMenuOpen(false); }}
                    className="w-full border border-zinc-200 py-3 rounded-xl font-bold text-xs"
                  >
                    Log In
                  </button>
                  <button 
                    onClick={() => { onNavigate('/register'); setIsMobileMenuOpen(false); }}
                    className="w-full bg-[#111111] text-[#D6FF20] py-3 rounded-xl font-bold text-xs"
                  >
                    Create Account
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-20 md:py-28 overflow-hidden bg-gradient-to-b from-zinc-50/50 to-white">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Hero text */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#D6FF20]/15 border border-[#A8CC00]/20 rounded-full">
                <Sparkles size={14} className="text-[#A8CC00]" />
                <span className="text-[10px] font-mono text-[#111111] uppercase tracking-wider font-extrabold">Next-Gen Ledger Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#111111] leading-[1.08] font-sans">
                Transparent Finance Management for <span className="bg-gradient-to-r from-zinc-800 to-zinc-950 bg-clip-text text-transparent">Student Unions</span> & Clubs
              </h1>

              <p className="text-zinc-500 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl font-medium">
                Track income, expenses, campaigns, approvals, and audits in one secure platform. Build trust, prevent disarray, and publish live public-facing portals effortlessly.
              </p>

              {/* Dynamic PWA Install & Access Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4">
                <button
                  onClick={() => onNavigate(isLoggedIn ? '/dashboard' : '/register')}
                  className="bg-[#111111] text-[#D6FF20] hover:bg-[#222222] font-black text-xs tracking-wider uppercase py-4 px-8 rounded-2xl cursor-pointer transition-all transform hover:-translate-y-0.5 shadow-lg shadow-zinc-950/10 flex items-center justify-center gap-2"
                >
                  <span>Get Started Now</span>
                  <ArrowRight size={15} />
                </button>

                {isInstalled ? (
                  <button
                    onClick={() => onNavigate('/dashboard')}
                    className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 font-extrabold text-xs tracking-wider uppercase py-4 px-6 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={15} className="text-[#A8CC00]" />
                    <span>Open Standalone App</span>
                  </button>
                ) : (
                  <button
                    onClick={triggerPWAInstall}
                    className="border-2 border-dashed border-zinc-250 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 text-zinc-700 font-black text-xs tracking-wider uppercase py-4 px-6 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={15} className="text-[#A8CC05]" />
                    <span>Install Safe PWA</span>
                  </button>
                )}

                <button
                  onClick={() => onNavigate('/login')}
                  className="sm:hidden border border-zinc-200 py-3 rounded-2xl font-bold text-xs hover:bg-zinc-50"
                >
                  Login Clearance Portal
                </button>
              </div>

              {/* Badges indicators */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-zinc-100 max-w-lg">
                <div>
                  <span className="block text-2xl font-black text-[#111111] font-mono">100%</span>
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Transparent</span>
                </div>
                <div>
                  <span className="block text-2xl font-black text-[#111111] font-mono">FIPS</span>
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Security rules</span>
                </div>
                <div>
                  <span className="block text-2xl font-black text-[#111111] font-mono">&lt;2s</span>
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Live syncing</span>
                </div>
              </div>

            </div>

            {/* Dashboard Mockup Screenshot frame rendered natively in gorgeous CSS & HTML */}
            <div className="lg:col-span-5 relative mt-6 lg:mt-0">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-[#D6FF20] to-[#A8CC00] rounded-[32px] blur-xl opacity-20" />
              
              {/* Main Window */}
              <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                
                {/* Browser top-bar */}
                <div className="bg-zinc-900/90 px-4 py-3 flex items-center justify-between border-b border-zinc-800">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 block" />
                  </div>
                  <div className="bg-zinc-950 px-5 py-1 rounded-md text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                    <Lock size={10} className="text-[#A8CC00]" />
                    <span>https://unionledger.org/dashboard</span>
                  </div>
                  <span className="w-4 h-4 rounded-full bg-zinc-800/80 block" />
                </div>

                {/* Simulated App Area */}
                <div className="p-5 text-white space-y-4">
                  
                  {/* Mockup Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono text-zinc-500 uppercase block tracking-widest leading-none">Workspace Demo</span>
                      <span className="text-sm font-black tracking-tight mt-0.5 block">N.S.U. Arts & Commerce Council</span>
                    </div>
                    <div className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-[9px] font-mono flex items-center gap-1 text-[#D6FF20]">
                      <span className="w-1.5 h-1.5 bg-[#A8CC00] rounded-full animate-ping block" />
                      <span>Ledger Live</span>
                    </div>
                  </div>

                  {/* Mockup Metrics Cards */}
                  <div className="grid grid-cols-3 gap-2.5 font-mono">
                    <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
                      <span className="text-[8px] text-zinc-500 block uppercase">Total Balance</span>
                      <span className="text-[11px] font-bold text-[#D6FF20] block mt-0.5">₹37,500</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
                      <span className="text-[8px] text-zinc-500 block uppercase">Approved Income</span>
                      <span className="text-[11px] font-bold text-emerald-400 block mt-0.5">₹125,000</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
                      <span className="text-[8px] text-zinc-500 block uppercase">Active Expenses</span>
                      <span className="text-[11px] font-bold text-rose-400 block mt-0.5">₹87,500</span>
                    </div>
                  </div>

                  {/* Micro Recharts live aggregation */}
                  <div className="bg-zinc-900/60 border border-zinc-800/60 p-3 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-semibold block">Dynamic Cashflow Graph</span>
                      <span className="text-[9px] font-mono text-[#A8CC00]">Quarterly Snapshot</span>
                    </div>
                    <div className="h-28 w-full font-mono text-[9px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartsData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                          <XAxis dataKey="name" stroke="#52525b" fontSize={8} tickLine={false} />
                          <YAxis stroke="#52525b" fontSize={8} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', fontSize: '10px' }} labelStyle={{ color: '#fff' }} />
                          <Bar dataKey="amount" fill="#A8CC00" radius={[4, 4, 0, 0]}>
                            {chartsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Mockup filter interactive tabs */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold tracking-wider">Simulated Registry</span>
                      <div className="flex gap-1">
                        {['All', 'Income', 'Expense'].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setMockupFilter(tab as any)}
                            className={`text-[8px] px-2 py-0.5 rounded font-mono border transition-all cursor-pointer ${
                              mockupFilter === tab 
                                ? 'bg-[#D6FF20] text-black border-[#D6FF20] font-bold' 
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                      {filteredMockup.map((m) => (
                        <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex items-center justify-between text-[11px] hover:border-zinc-750 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${m.type === 'Income' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span className="font-semibold truncate max-w-[150px]">{m.text}</span>
                          </div>
                          <div className="font-mono text-[10px]">
                            <span className={m.type === 'Income' ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                              {m.type === 'Income' ? '+' : ''}₹{Math.abs(m.amount).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Tiny overlapping banner ornament to enrich detail */}
              <div className="absolute -bottom-5 -right-3 z-20 bg-white border border-zinc-200 shadow-xl rounded-2xl p-3 flex items-center gap-3.5 max-w-xs animate-pulse">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
                  <CheckCircle size={16} />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-400 block uppercase font-bold">Constituent Trust Metre</span>
                  <span className="text-xs font-black text-zinc-900 block leading-tight">Approved Audits (Global)</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="py-20 bg-zinc-50 border-y border-zinc-100 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <div className="inline-flex items-center gap-1 bg-[#111111] text-[#D6FF20] text-[9px] font-mono px-3 py-1 rounded-full uppercase tracking-widest font-extrabold">
              End-To-End Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
              Engineered Specially for Union Environments
            </h2>
            <p className="text-zinc-500 text-sm sm:text-base leading-relaxed">
              Every feature traces back to the concrete accountability problems of student treasuries, activity clubs, and academic chapters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, index) => {
              const Icon = feat.icon;
              return (
                <div 
                  key={index}
                  className="bg-white border border-zinc-200/80 rounded-2xl p-6.5 hover:shadow-xl hover:border-zinc-300 transition-all duration-300 transform hover:-translate-y-1 group"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${feat.color} mb-5 transition-transform duration-300 group-hover:scale-110`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="font-extrabold text-md text-zinc-900 mb-2">{feat.title}</h3>
                  <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed font-medium">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 4. How It Works - Timeline UI */}
      <section id="how-it-works" className="py-20 md:py-28 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
            <span className="text-[10px] font-mono text-[#A8CC00] font-black uppercase tracking-widest block">Clear Onboarding Streamlined</span>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">Getting Started is Simple</h2>
            <p className="text-zinc-500 text-xs sm:text-sm max-w-xl mx-auto font-medium">
              We designed an accelerated, modular onboarding timeline to integrate your student treasury system in record duration.
            </p>
          </div>

          {/* Timeline Process Cards Grid */}
          <div className="relative">
            {/* Core central timeline trace line (desktop horizontal, mobile ignored via responsive layouts) */}
            <div className="hidden lg:block absolute top-[68px] left-[10%] right-[10%] h-0.5 bg-zinc-100 z-0" />
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 relative z-10">
              {steps.map((st, idx) => (
                <div key={idx} className="bg-zinc-50/50 border border-zinc-100 hover:border-zinc-200/80 hover:bg-white rounded-2xl p-6 relative transition-all duration-300 hover:shadow-md">
                  
                  {/* Step bubble */}
                  <div className="w-12 h-12 bg-[#111111] text-[#D6FF20] font-black rounded-xl flex items-center justify-center font-mono text-base border border-zinc-800 shadow-sm mb-6 relative z-10">
                    {st.step}
                  </div>

                  <h3 className="font-extrabold text-md text-[#111111] mb-2">{st.title}</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed font-medium">
                    {st.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* 5. Transparency Section - Live Dashboard Metrics Visualizer Preview */}
      <section id="live-preview" className="py-16 bg-zinc-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(168,204,0,0.04),transparent)]" />
        
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-[32px] p-8 md:p-12 shadow-2xl text-center space-y-8">
            
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-[#A8CC00]/10 border border-[#A8CC00]/20 rounded-full">
              <Award size={14} className="text-[#A8CC00]" />
              <span className="text-[9px] font-mono uppercase text-[#A8CC00] tracking-widest font-black"> constituer confidence model </span>
            </div>

            <div className="space-y-3 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Build Trust Through Transparent Financial Reporting
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                Publish safe summaries displaying total collections and distributions. Your constituents get full visual confidence, without revealing private credentials.
              </p>
            </div>

            {/* Simulated Live Transparency gauge */}
            <div className="max-w-2xl mx-auto bg-zinc-950/90 border border-zinc-800/60 rounded-3xl p-6.5 text-left grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              
              {/* Metrics */}
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider block">Total Recieved Income</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">₹125,000</span>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider block">Disbursed Expenditure</span>
                  <span className="font-mono text-sm font-bold text-rose-400">₹87,500</span>
                </div>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-zinc-400 text-[10px] font-mono uppercase tracking-wider block font-black">Net Wallet Reserves</span>
                  <span className="font-mono text-md font-black text-[#D6FF20]">₹37,500</span>
                </div>
                
                {/* Visual bar progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                    <span>BUDGET DEPLOYED BALANCE</span>
                    <span className="text-[#A8CC00]">70% used</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-[#A8CC00] rounded-full" style={{ width: '70%' }} />
                  </div>
                </div>
              </div>

              {/* Graphic circle representation */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center flex flex-col items-center justify-center space-y-2">
                <div className="w-16 h-16 rounded-full border-4 border-[#A8CC00] border-t-zinc-800 flex items-center justify-center">
                  <span className="font-mono text-xs font-black">70.0%</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Ledger Safety Index</span>
                  <span className="text-[8px] text-zinc-500 mt-0.5 block leading-none">Continuous verification clearance</span>
                </div>
              </div>

            </div>

            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
              ⚡ LIVE PEER VERIFICATION PLATFORM ACTIVE • © UNION LEDGER
            </p>

          </div>
        </div>
      </section>

      {/* 6. Mobile App / PWA Install Section */}
      <section className="py-20 bg-white border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-[32px] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            
            {/* Ambient dot */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#D6FF20]/10 rounded-full blur-3xl -z-10" />

            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-zinc-500 border border-zinc-200 bg-white px-2.5 py-1 rounded-full text-[10px] font-mono">
                <Clock size={12} className="text-[#A8CC00]" />
                <span className="uppercase tracking-wide font-extrabold">Instant Offline Capabilities</span>
              </div>
              <h2 className="text-3xl font-black text-[#111111] tracking-tight leading-tight">
                Install Union Ledger on Your Mobile Web Portal
              </h2>
              <p className="text-zinc-505 text-xs sm:text-sm leading-relaxed">
                Access your finances directly without navigating complex app store procedures. Union Ledger runs natively as a secure PWA with local offline clearance, immediate launching, and direct peer notifications.
              </p>
            </div>

            {/* Install trigger buttons */}
            <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-3 w-full md:w-auto min-w-[200px]">
              {isInstalled ? (
                <button
                  onClick={() => onNavigate('/dashboard')}
                  className="bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-250 font-black text-xs uppercase tracking-widest py-4 px-6 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={15} className="text-[#A8CC00]" />
                  <span>Open Safe App</span>
                </button>
              ) : (
                <button
                  onClick={triggerPWAInstall}
                  className="bg-[#111111] text-[#D6FF20] hover:bg-zinc-900 font-black text-xs uppercase tracking-widest py-4 px-6 rounded-2xl cursor-pointer transition-all shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Download size={15} />
                  <span>Install App</span>
                </button>
              )}

              <button
                onClick={() => onNavigate(isLoggedIn ? '/dashboard' : '/login')}
                className="bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 font-extrabold text-xs uppercase tracking-widest py-4 px-6 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <span>Open Dashboard</span>
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 7. Testimonials Section */}
      <section className="py-20 bg-zinc-50/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-[10px] font-mono text-[#A8CC00] font-black uppercase tracking-widest bg-white border border-zinc-150 px-3 py-1 rounded-full">Constituent Satisfaction</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">Loved by Active Campus Associations</h2>
            <p className="text-zinc-500 text-xs sm:text-sm font-medium">
              Read how student groups, state chapters, and auditing compliance officers deploy Union Ledger to build ultimate visual confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((test, idx) => (
              <div key={idx} className="bg-white border border-zinc-200/80 rounded-2xl p-6 relative flex flex-col justify-between hover:shadow-lg transition-shadow">
                
                <p className="text-zinc-650 italic text-xs sm:text-sm leading-relaxed mb-6">
                  "{test.quote}"
                </p>

                <div className="flex items-center gap-3 border-t border-zinc-100 pt-4 mt-auto">
                  <img 
                    src={test.avatar} 
                    alt={test.name}
                    className="w-10 h-10 rounded-full border border-zinc-200"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-xs font-black text-zinc-900">{test.name}</h4>
                    <span className="text-[10px] text-zinc-500 block font-semibold">{test.role}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 8. FAQ Section */}
      <section id="faqs" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-1.5 text-zinc-500 border border-zinc-150 bg-zinc-50 px-2.5 py-1 rounded-full text-[10px] font-mono">
              <BookOpen size={12} className="text-[#A8CC02]" />
              <span className="uppercase tracking-wide font-extrabold">FAQ Documentation</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">Frequently Asked Queries</h2>
            <p className="text-zinc-500 text-xs sm:text-sm font-medium">
              Find quick answers regarding workspace access, regulatory database sync, and verification policies.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaqIndex === idx;
              return (
                <div 
                  key={idx} 
                  className="border border-zinc-200 rounded-2xl overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() => setActiveFaqIndex(isOpen ? null : idx)}
                    className="w-full text-left px-5 py-4 bg-zinc-50/50 hover:bg-zinc-50 flex items-center justify-between font-bold text-sm text-[#111111] transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown 
                      size={16} 
                      className={`text-zinc-450 transition-transform duration-200 ${isOpen ? 'rotate-180 text-black' : ''}`} 
                    />
                  </button>
                  
                  {isOpen && (
                    <div className="px-5 py-4 bg-white text-zinc-505 text-xs sm:text-sm leading-relaxed border-t border-zinc-100 animate-fade-in font-medium">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Hero-like Action Callout prior to Footer */}
      <section className="py-20 bg-zinc-50 border-t border-zinc-150 relative">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl font-black text-[#111111] tracking-tight">Ready to Align Your Student Organization?</h2>
          <p className="text-zinc-500 text-sm max-w-lg mx-auto font-medium">
            Boot your custom workspace in under two minutes. Link with peer auditors and establish pristine financial clarity today.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate(isLoggedIn ? '/dashboard' : '/register')}
              className="bg-[#111111] text-white hover:bg-zinc-800 py-3.5 px-8 rounded-xl font-bold text-xs tracking-wider uppercase transition-transform transform hover:-translate-y-0.5"
            >
              Get Started Free
            </button>
            <button
              onClick={onOpenJoinModal}
              className="bg-white text-zinc-900 border border-zinc-250 hover:bg-zinc-55 py-3.5 px-8 rounded-xl font-bold text-xs tracking-wider uppercase transition-all"
            >
              Join Workspace with Code
            </button>
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-zinc-950 text-white pt-16 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_bottom_right,rgba(168,204,0,0.03),rgba(0,0,0,0))]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 border-b border-zinc-800 pb-12">
            
            {/* Branding Column */}
            <div className="space-y-4 md:col-span-1.5 text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-white text-[#111111] rounded-xl flex items-center justify-center font-black">
                  UL
                </div>
                <span className="font-extrabold text-white text-[16px] tracking-tight">Union Ledger</span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed max-w-sm">
                Next-generation financial audit, distribution workflow, and transparency portal software engineered specifically for active student unions.
              </p>
            </div>

            {/* Quick Actions Links */}
            <div>
              <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold mb-4">Launch Applet</h4>
              <ul className="space-y-2.5 text-xs text-zinc-400">
                <li>
                  <button onClick={() => onNavigate('/login')} className="hover:text-white cursor-pointer transition-colors">
                    Sign In Portal
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/register')} className="hover:text-white cursor-pointer transition-colors">
                    Register New Account
                  </button>
                </li>
                <li>
                  <button onClick={onOpenJoinModal} className="hover:text-white cursor-pointer transition-colors">
                    Lock Join Code
                  </button>
                </li>
              </ul>
            </div>

            {/* Resources Support links */}
            <div>
              <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold mb-4">Legal clearance</h4>
              <ul className="space-y-2.5 text-xs text-zinc-400">
                <li><a href="#faqs" className="hover:text-white transition-colors">Knowledge Base Docs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Agreement</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>

            {/* Verified badge */}
            <div className="md:col-span-1 flex flex-col items-start md:items-end justify-between">
              <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/60 p-2.5 rounded-xl">
                <Shield size={14} className="text-[#A8CC00]" />
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider font-extrabold">FIPS 140-2 Encrypted</span>
              </div>
              <div className="text-left md:text-right mt-6 md:mt-0 space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">Server Node Clearance</span>
                <span className="px-2 py-0.5 bg-zinc-805/40 border border-zinc-800 rounded font-mono text-emerald-400 text-[10px]">● Online Operational</span>
              </div>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            <span>© 2026 Union Ledger Inc. All rights reserved.</span>
            <div className="flex gap-4">
              <span>Secure Gateway v2.4.1</span>
              <span>•</span>
              <span>UTC Connected</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
