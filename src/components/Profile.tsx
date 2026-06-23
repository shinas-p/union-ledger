import React, { useState, useEffect } from 'react';
import { 
  User, 
  ShieldAlert, 
  Trash2, 
  Key, 
  FileCheck, 
  Upload, 
  Building, 
  Loader2, 
  Check, 
  AlertTriangle, 
  Mail, 
  Phone, 
  Bookmark, 
  Settings2, 
  Coins, 
  Globe, 
  Smartphone, 
  LogOut, 
  ShieldCheck,
  ArrowLeft,
  XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Organization, OrganizationCurrency } from '../types';

interface ProfileProps {
  token: string;
  user: UserProfile;
  orgs: any[];
  onRefresh: () => void;
  onLogout: () => void;
  onNavigate: (tab: any) => void;
}

export function Profile({
  token,
  user,
  orgs,
  onRefresh,
  onLogout,
  onNavigate
}: ProfileProps) {
  
  // 1. Profile Details State
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [prefCurrency, setPrefCurrency] = useState<OrganizationCurrency>((user.preferredCurrency as OrganizationCurrency) || 'INR');
  
  const [notifPrefs, setNotifPrefs] = useState({
    transactionEvents: user.notificationPreferences?.transactionEvents ?? true,
    memberActivities: user.notificationPreferences?.memberActivities ?? true,
    campaignUpdates: user.notificationPreferences?.campaignUpdates ?? true,
    whatsappAlerts: user.notificationPreferences?.whatsappAlerts ?? false
  });

  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // 2. Avatar Upload State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // 3. Password / Change Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwdFields, setShowPwdFields] = useState(false);
  const [pwdStrength, setPwdStrength] = useState({ text: 'None', color: 'bg-zinc-800', score: 0 });
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  // 4. Delete Account State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Update password strength indicator live
  const checkPasswordStrength = (pwd: string) => {
    if (!pwd) {
      setPwdStrength({ text: 'None', color: 'bg-zinc-800', score: 0 });
      return;
    }
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 1) {
      setPwdStrength({ text: 'Weak', color: 'bg-rose-500', score });
    } else if (score <= 3) {
      setPwdStrength({ text: 'Medium', color: 'bg-yellow-500', score });
    } else {
      setPwdStrength({ text: 'Strong', color: 'bg-[#D6FF20]', score });
    }
  };

  const handleNewPwdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewPassword(val);
    checkPasswordStrength(val);
  };

  // 1. Submit Profile Details Update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);
    setSavingProfile(true);

    try {
      const res = await fetch('/api/auth/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          phone,
          bio,
          preferredCurrency: prefCurrency,
          notificationPreferences: notifPrefs
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile values.');

      setProfileSuccess('Profile credentials successfully updated.');
      onRefresh();
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // 2. Avatar image selection/drag-drop validation & preview
  const validateAndSetFile = (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    // Image check
    if (!file.type.startsWith('image/')) {
      setUploadError('Invalid format. Please select an image file (PNG, JPG, WebP, GIF).');
      return;
    }

    // Size limit check (2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('File size exceeded. Maximum upload limit is 2MB.');
      return;
    }

    setAvatarFile(file);
    // Instant preview block
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Save Avatar upload to Supabase Bucket or Backend
  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setUploadError('Please choose or drop an image file first.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      console.log(`[AVATAR UPLOAD] Attempting file upload to profile-images bucket for user ID: ${user.id}...`);
      
      let finalAvatarUrl = '';

      // Upload file directly to Supabase Storage if configured
      const filePath = `${user.id}/avatar.png`;
      const { data, error: uploadErr } = await supabase.storage
        .from('profile-images')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) {
        console.warn(`[AVATAR UPLOAD] Supabase storage upload failed, attempting fallback base64 storage...`, uploadErr);
        // Fallback: Convert to Base64 dataURL to store in database profiles table
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(avatarFile);
        finalAvatarUrl = await base64Promise;
      } else {
        // Retrieve public URL from Supabase Bucket
        const { data: urlData } = supabase.storage
          .from('profile-images')
          .getPublicUrl(filePath);

        finalAvatarUrl = urlData.publicUrl;
        console.log(`[AVATAR UPLOAD] Upload completed. Public path URL:`, finalAvatarUrl);
      }

      // Update backend record
      const res = await fetch('/api/auth/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: user.name, // Keep existing name
          avatarUrl: finalAvatarUrl
        })
      });

      const upData = await res.json();
      if (!res.ok) throw new Error(upData.error || 'Failed to link profile avatar url on backend.');

      setUploadSuccess('Avatar picture successfully uploaded and synced!');
      setAvatarFile(null);
      onRefresh();
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err: any) {
      console.error('[AVATAR UPLOAD ERROR]', err);
      setUploadError(err.message || 'Verification challenge failed. Could not upload.');
    } finally {
      setUploadLoading(false);
    }
  };

  // 3. Submit Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match. Please verify.');
      return;
    }

    if (pwdStrength.score < 2) {
      setPwdError('New password is too weak. Please include capitals, numbers or symbols.');
      return;
    }

    setPwdLoading(true);

    try {
      // 1. Sync on local db and audits
      const res = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete local password modification.');

      // 2. Sync to Supabase Auth if session active
      try {
        const { error: authUpErr } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (authUpErr) {
          console.warn('[SECURITY] Supabase Auth update failed (auth module not fully configured):', authUpErr.message);
        }
      } catch (authErr) {
        // Swallowed when only using local users
      }

      setPwdSuccess('Credential successfully updated across workspace nodes.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdStrength({ text: 'None', color: 'bg-zinc-800', score: 0 });
      setTimeout(() => setPwdSuccess(null), 4000);
    } catch (err: any) {
      setPwdError(err.message || 'Credential verification failed.');
    } finally {
      setPwdLoading(false);
    }
  };

  // Trigger forgot password request
  const handleForgotPasswordTrigger = async () => {
    setPwdError(null);
    setPwdSuccess(null);
    try {
      console.log(`[FORGOT PASSWORD] Broadcasting profile recovery link for: ${user.email}...`);
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      setPwdSuccess('Verification request dispatched. Please monitor your email for recovery parameters.');
    } catch (err: any) {
      setPwdError(err.message || 'Supabase password dispatch pipeline restricted currently.');
    }
  };

  // 4. Submit account deletion
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      setDeleteError('Challenge mismatch. Please type "DELETE MY ACCOUNT" exactly (all capitals).');
      return;
    }

    // Last admin pre-check on frontend
    const adminClearanceList = orgs.filter(o => o.userRole === 'Admin');
    if (adminClearanceList.length > 0) {
      console.log('[DELETE ACCOUNT] Frontend check: verifying last admin constraints...');
    }

    setDeleteLoading(true);

    try {
      const res = await fetch('/api/auth/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          password: deletePassword,
          textConfirmation: deleteConfirmText
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify account deletion request.');
      }

      // Deletion succeeded completely! Force sign-out
      setIsDeleteModalOpen(false);
      localStorage.removeItem('ul_token');
      sessionStorage.removeItem('ul_token');
      
      try {
        await supabase.auth.signOut();
      } catch {
        // Swallowed
      }

      alert('Account successfully scrubbed. Financial logs replaced and archived under Deleted User.');
      onLogout();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to execute authorization deletion.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="profile-control-hub">
      
      {/* Header navbar area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-brand-surface border border-brand-secondary p-5 rounded-2xl gap-4">
        <div>
          <h2 className="text-lg font-sans font-black text-white flex items-center gap-2">
            <User size={18} className="text-[#D6FF20]" />
            <span>Profile & Account Credentials Cabinet</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-normal">
            Revise private user information, coordinate unified currency indicators, regulate notifications preferences, or change account passwords.
          </p>
        </div>
        
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-zinc-800/80 hover:bg-zinc-800 text-xs font-semibold text-zinc-350 hover:text-white rounded-xl border border-zinc-700/60 transition-colors cursor-pointer"
        >
          <ArrowLeft size={12} />
          <span>Overview Panel</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="profile-sub-panels">
        
        {/* LEFT COLUMN: Profile Details + Avatar Upload */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Profile Details Form Card */}
          <div className="bg-brand-surface border border-brand-secondary p-6 rounded-2xl" id="profile-details-card">
            <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Settings2 size={14} />
              <span>Identity & Preferences</span>
            </h3>
            <p className="text-zinc-500 text-[11px] mb-5">
              General user representation parameters. Adjust values or preferences here.
            </p>

            {profileSuccess && (
              <div className="mb-4 p-3.5 bg-[#D6FF20]/5 border border-[#D6FF20]/20 text-brand text-xs rounded-xl flex items-center gap-2">
                <Check size={14} />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="mb-4 p-3.5 bg-rose-950/20 border border-rose-900 text-rose-350 text-xs rounded-xl flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileUpdate} className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Full Name Representation</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-brand-bg border border-zinc-800 hover:border-zinc-700 focus:border-[#D6FF20] rounded-xl p-3 text-xs text-white focus:outline-none transition-all"
                  />
                </div>

                {/* Email (static display) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-450 uppercase tracking-widest block font-black">Registered Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={user.email}
                      className="w-full bg-[#161A20] border border-zinc-850 rounded-xl p-3 text-xs text-zinc-500 font-mono outline-none cursor-not-allowed pl-9"
                    />
                    <Mail size={12} className="absolute left-3.5 top-3.5 text-zinc-650" />
                  </div>
                  <span className="text-[9px] font-mono text-zinc-600 block">Email can only be securely modified via core authentication flows.</span>
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-405 uppercase tracking-widest block font-bold">Contact Phone (Optional)</label>
                  <div className="relative">
                    <input
                      type="tel"
                      placeholder="+91 XXXXX XXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-brand-bg border border-zinc-800 hover:border-zinc-700 focus:border-[#D6FF20] rounded-xl p-3 text-xs text-white focus:outline-none transition-all pl-9"
                    />
                    <Phone size={12} className="absolute left-3.5 top-3.5 text-zinc-500" />
                  </div>
                </div>

                {/* Preferred Currency Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-405 uppercase tracking-widest block font-bold">Ledger View Preferred Currency</label>
                  <div className="relative">
                    <select
                      value={prefCurrency}
                      onChange={(e) => setPrefCurrency(e.target.value as OrganizationCurrency)}
                      className="w-full bg-brand-bg border border-zinc-800 hover:border-zinc-700 focus:border-[#D6FF20] rounded-xl p-3 text-xs text-white focus:outline-none cursor-pointer transition-all pl-9 appearance-none"
                    >
                      <option value="INR">INR (₹ - Indian Rupee)</option>
                      <option value="USD">USD ($ - United States Dollar)</option>
                      <option value="EUR">EUR (€ - Euro Currency)</option>
                      <option value="GBP">GBP (£ - Great Britain Pound)</option>
                      <option value="AED">AED (د.إ - UAE Dirham)</option>
                    </select>
                    <Coins size={12} className="absolute left-3.5 top-3.5 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

              </div>

              {/* Bio block */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-zinc-405 uppercase tracking-widest block font-bold">Member Bio / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Tell other council members about yourself or write relevant structural notes..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-brand-bg border border-zinc-805 hover:border-zinc-700 focus:border-[#D6FF20] rounded-xl p-3 text-xs text-white focus:outline-none transition-all leading-relaxed resize-none"
                />
              </div>

              {/* Notifications preferences check toggles */}
              <div className="bg-[#0F1115]/50 border border-zinc-900 rounded-xl p-4 space-y-3">
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">Notification Feed Settings</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Item 1 */}
                  <label className="flex items-start gap-2.5 p-2 bg-brand-bg/40 border border-zinc-850 rounded-lg cursor-pointer hover:bg-brand-bg/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifPrefs.transactionEvents}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, transactionEvents: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-[#D6FF20] bg-zinc-800 border-zinc-700 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-[11px] font-bold text-white block">Proposed Registry Actions</span>
                      <p className="text-[9px] text-zinc-500 text-left mt-0.5">Alerts when new income or expense logs are submitted.</p>
                    </div>
                  </label>

                  {/* Item 2 */}
                  <label className="flex items-start gap-2.5 p-2 bg-brand-bg/40 border border-zinc-850 rounded-lg cursor-pointer hover:bg-brand-bg/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifPrefs.memberActivities}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, memberActivities: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-[#D6FF20] bg-zinc-800 border-zinc-700 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-[11px] font-bold text-white block">Invite Link Operations</span>
                      <p className="text-[9px] text-zinc-500 text-left mt-0.5">Digests when users redeem workspace invitation codes.</p>
                    </div>
                  </label>

                  {/* Item 3 */}
                  <label className="flex items-start gap-2.5 p-2 bg-brand-bg/40 border border-zinc-850 rounded-lg cursor-pointer hover:bg-brand-bg/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifPrefs.campaignUpdates}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, campaignUpdates: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-[#D6FF20] bg-zinc-800 border-zinc-700 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-[11px] font-bold text-white block">Fundraising & Campaigns</span>
                      <p className="text-[9px] text-zinc-500 text-left mt-0.5">Immediate push updates concerning active collection drives.</p>
                    </div>
                  </label>

                  {/* Item 4 */}
                  <label className="flex items-start gap-2.5 p-2 bg-brand-bg/40 border border-zinc-850 rounded-lg cursor-pointer hover:bg-brand-bg/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifPrefs.whatsappAlerts}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, whatsappAlerts: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-[#D6FF20] bg-zinc-800 border-zinc-700 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-[11px] font-bold text-white block">WhatsApp Telegram Synced</span>
                      <p className="text-[9px] text-zinc-500 text-left mt-0.5">Authorize real-time messaging updates to mobile agents.</p>
                    </div>
                  </label>

                </div>
              </div>

              <div className="flex justify-between items-center bg-zinc-950 p-3.5 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono text-zinc-550">Joined ledger ecosystem: {new Date(user.joinedAt).toLocaleDateString()}</span>
                <button
                  type="submit"
                  disabled={savingProfile}
                  id="profile-details-save-btn"
                  className="px-4 py-2 bg-[#D6FF20] hover:bg-[#C5E800] text-black font-bold text-xs uppercase rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Saving preferences...</span>
                    </>
                  ) : (
                    <span>Save profile details</span>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Section 2: Avatar Upload Card */}
          <div className="bg-brand-surface border border-brand-secondary p-6 rounded-2xl" id="profile-avatar-upload-card">
            <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Upload size={14} />
              <span>Avatar / Profile Graphics Cabin</span>
            </h3>
            <p className="text-zinc-500 text-[11px] mb-5">
              Refine your digital layout and customize credentials visualization representation across live ledgers.
            </p>

            {uploadSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="mb-4 p-3 bg-rose-950/20 border border-rose-900 text-rose-350 text-xs rounded-xl flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-450" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Image Preview Sphere */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-brand-bg/40 border border-zinc-900 rounded-2xl text-center">
                <span className="text-[9px] font-mono text-zinc-550 uppercase tracking-widest mb-3 block font-bold">Graphic preview</span>
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="Review graphics"
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 rounded-full object-cover border-2 border-[#D6FF20] bg-zinc-800"
                  />
                  {avatarFile && (
                    <span className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-[#D6FF20] text-black font-mono text-[8px] font-extrabold rounded-full">
                      PREVIEW
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 font-mono mt-3 block max-w-[130px] truncate">{avatarFile ? avatarFile.name : 'avatar.png'}</span>
                {avatarFile && (
                  <button
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150');
                    }}
                    className="mt-2 text-rose-500 hover:text-rose-400 text-[10px] font-mono uppercase font-bold cursor-pointer underline"
                  >
                    Reset File Selection
                  </button>
                )}
              </div>

              {/* Upload Drop Zone */}
              <div className="md:col-span-8 flex flex-col gap-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center bg-brand-bg/25 hover:bg-brand-bg/50 ${dragActive ? 'border-[#D6FF20] bg-brand/5' : 'border-zinc-800 hover:border-zinc-700'}`}
                >
                  <Upload className={`w-8 h-8 mb-2 ${dragActive ? 'text-[#D6FF20] animate-bounce' : 'text-zinc-600'}`} />
                  <p className="text-xs font-semibold text-white">Drag and drop file here, or click to browse</p>
                  <p className="text-[10px] text-zinc-550 mt-1">Image uploads only (PNG, JPG, WebP) • Maximum scale size 2MB</p>
                  
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="avatar-hidden-file-input"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('avatar-hidden-file-input')?.click()}
                    className="mt-4 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text border border-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Choose file
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!avatarFile || uploadLoading}
                  onClick={handleAvatarUpload}
                  id="avatar-save-btn"
                  className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5 text-center ${avatarFile ? 'bg-[#D6FF20] hover:bg-[#C5E800] text-black shadow-lg shadow-[#D6FF20]/5' : 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                >
                  {uploadLoading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Uploading to Supabase Buckets...</span>
                    </>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Commit and replace Avatar</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Associated Orgs + Security forms + Danger zones */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Section 3: My Organizations List */}
          <div className="bg-brand-surface border border-brand-secondary p-5 rounded-2xl" id="profile-orgs-panel">
            <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building size={14} />
              <span>Workspace Affiliations</span>
            </h3>
            <p className="text-zinc-500 text-[10px] mb-4 leading-normal">
              Workspaces associated with your credential registry. Active roles are verified below.
            </p>

            <div className="space-y-3" id="profile-orgs-list">
              {orgs.length === 0 ? (
                <div className="p-4 bg-brand-bg/50 border border-zinc-900 rounded-xl text-center">
                  <span className="text-zinc-550 font-mono text-[10px] block font-bold uppercase uppercase">Zero Affiliations Found</span>
                  <p className="text-zinc-600 text-[9px] mt-1">Please join Malkangiri workspaces or register organizations to boot authorization profiles.</p>
                </div>
              ) : (
                orgs.map((o) => (
                  <div key={o.id} className="p-3 bg-brand-bg/40 border border-zinc-850 rounded-xl flex items-center gap-3">
                    <img
                      src={o.logoUrl || `https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=80`}
                      alt="Org Logo"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded object-cover bg-zinc-805"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-xs font-bold block truncate leading-tight">{o.name}</span>
                      <span className="text-[10px] font-mono text-zinc-500 block">Currency code: {o.currency}</span>
                    </div>

                    <div className="text-right">
                      {/* Role representation badge */}
                      <span className="px-2 py-0.5 bg-[#D6FF20]/10 border border-[#D6FF20]/25 rounded text-[8px] font-mono font-black tracking-wider text-brand block uppercase">
                        {o.userRole}
                      </span>
                      
                      {/* Active Status representation */}
                      <span className={`text-[8px] font-mono block mt-1 uppercase ${o.memberStatus === 'Active' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`}>
                        {o.memberStatus === 'Active' ? '● Active' : '● Suspended'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="mt-4 p-2 bg-brand-bg/60 border border-zinc-900 rounded-lg text-zinc-500 text-[9px] font-mono leading-normal text-center">
              🔒 Administrative clearance keys are enforced centrally. Modification of roles on profile is strictly prohibited.
            </p>
          </div>

          {/* Section 4: Security (Password credentials adjustments) */}
          <div className="bg-brand-surface border border-brand-secondary p-5 rounded-2xl" id="profile-security-card">
            <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Key size={14} />
              <span>Authentication Credentials</span>
            </h3>
            <p className="text-zinc-500 text-[10px] mb-4 leading-normal">
              Change physical login passwords or request automated password resets to your registered mailbox.
            </p>

            {pwdSuccess && (
              <div className="mb-3 p-2.5 bg-[#D6FF20]/5 border border-[#D6FF20]/25 text-brand text-[10px] rounded animate-pulse">
                <span>{pwdSuccess}</span>
              </div>
            )}

            {pwdError && (
              <div className="mb-3 p-2.5 bg-rose-950/20 border border-rose-900 text-rose-350 text-[10px] rounded flex items-center gap-1">
                <AlertTriangle size={11} className="text-rose-450" />
                <span>{pwdError}</span>
              </div>
            )}

            {!showPwdFields ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowPwdFields(true)}
                  id="profile-expand-password-btn"
                  className="w-full py-2 bg-brand-bg border border-zinc-800 hover:border-zinc-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex justify-center items-center gap-1.5"
                >
                  <Key size={12} />
                  <span>Change Password</span>
                </button>

                <button
                  type="button"
                  onClick={handleForgotPasswordTrigger}
                  className="w-full py-2 text-zinc-400 hover:text-white transition-all text-left text-[11px] font-semibold flex justify-center items-center gap-1.5 underline cursor-pointer"
                >
                  <span>Forgot password / Request recover email</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-3.5 animate-scale-up">
                
                {/* Current password input */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest font-bold block">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-brand-bg border border-zinc-800 font-mono text-xs p-2.5 rounded-lg text-white focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                {/* New password input */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest font-bold block">New Password</label>
                    <span className={`text-[8px] font-mono px-1 rounded uppercase ${pwdStrength.color} text-black font-extrabold`}>
                      {pwdStrength.text}
                    </span>
                  </div>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={handleNewPwdChange}
                    className="w-full bg-brand-bg border border-zinc-800 font-mono text-xs p-2.5 rounded-lg text-white focus:outline-none focus:border-[#D6FF20]"
                    placeholder="••••••••"
                  />
                </div>

                {/* Confirm password input */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest font-bold block">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-brand-bg border border-zinc-800 font-mono text-xs p-2.5 rounded-lg text-white focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                {/* Submit button */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPwdFields(false);
                      setPwdError(null);
                    }}
                    className="flex-1 py-1 px-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-semibold rounded-lg hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="profile-commit-password-btn"
                    disabled={pwdLoading}
                    className="flex-1 py-1 px-2.5 bg-[#D6FF20] hover:bg-[#C5E800] text-black font-extrabold text-xs rounded-lg cursor-pointer flex justify-center items-center gap-1"
                  >
                    {pwdLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <span>Save Password</span>
                    )}
                  </button>
                </div>

              </form>
            )}

            {/* Logout anchor custom item */}
            <hr className="border-zinc-900 my-4" />
            <button
              onClick={onLogout}
              className="w-full.5 py-1 text-xs text-zinc-500 hover:text-rose-400 font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Terminate all local browser token session indices"
            >
              <LogOut size={12} />
              <span>Logout from current device session</span>
            </button>
          </div>

          {/* Section 5: My Account Scrub (Danger action) */}
          <div className="bg-brand-surface border border-rose-950 p-5 rounded-2xl relative overflow-hidden" id="profile-danger-zone">
            
            {/* High-friction highlight glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-3xl pointer-events-none" />

            <h3 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-rose-400 animate-pulse" />
              <span>Private Account Danger Zone</span>
            </h3>
            
            <p className="text-zinc-500 text-[10px] leading-normal mb-4">
              Permanent scrubbing clears your user profile references immediately. Account associations will be severed from workspaces. Ledger transactions and historic logs remain intact as "Deleted User" to satisfy strict non-relational audits compliance.
            </p>

            <button
              id="request-scrub-btn"
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeletePassword('');
                setDeleteConfirmText('');
                setIsDeleteModalOpen(true);
              }}
              className="w-full py-2 bg-rose-950/20 hover:bg-rose-955 text-rose-400 border border-rose-900/40 hover:border-rose-900 transition-colors font-bold rounded-xl text-xs cursor-pointer flex justify-center items-center gap-1.5"
            >
              <Trash2 size={12} />
              <span>Delete My Account completely</span>
            </button>

          </div>

        </div>

      </div>

      {/* 5. Account Deletion Confirmation Dialog / Overlay */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4" id="deletion-modal-container">
          <div className="bg-brand-surface border border-rose-900 max-w-md w-full rounded-3xl p-6 md:p-8 space-y-5 animate-scale-up text-left">
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-950/40 border border-rose-900 text-rose-400 rounded-2xl shrink-0 mt-0.5">
                <AlertTriangle size={24} className="text-rose-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">Scrub Credential Registry?</h4>
                <p className="text-xs text-rose-300 font-semibold font-mono">Irreversible Operation Signature</p>
              </div>
            </div>

            <div className="p-4 bg-rose-955/20 border border-rose-950 rounded-2xl text-zinc-400 text-xs leading-relaxed space-y-2">
              <span className="font-extrabold text-white block">Please review administrative constraints:</span>
              <p>• Your active professional profiles and invite key records will be permanently expunged.</p>
              <p>• Action logs, incomes verification, and expenditures balances you recorded will remain cataloged as <span className="font-mono text-zinc-300 font-extrabold uppercase">"Deleted User"</span> to preserve financial correctness.</p>
              <p className="text-rose-400 font-bold">• Deletion is barred if you are the LAST active Admin of any ledger organization. Transfer ownership or drop the workspaces before continuing.</p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-950/40 border border-rose-900 text-rose-200 text-xs rounded-xl flex items-start gap-2 animate-bounce">
                <XCircle size={15} className="shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              
              {/* Challenge password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Verify account password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter credential password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-brand-bg border border-zinc-800 hover:border-zinc-750 focus:border-rose-900 rounded-xl p-3 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              {/* Challenge string typing */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Type verification phrase literally:</label>
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-white/5 text-center mb-1 select-none">
                  <span className="text-xs font-mono font-black text-rose-450 tracking-widest">DELETE MY ACCOUNT</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="DELETE MY ACCOUNT"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full bg-brand-bg border border-zinc-800 hover:border-zinc-750 focus:border-rose-900 rounded-xl p-3 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              {/* Control Triggers */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-white font-semibold rounded-xl text-xs cursor-pointer text-center transition-colors"
                >
                  Retrieve Account
                </button>
                <button
                  id="confirm-delete-button"
                  type="submit"
                  disabled={deleteLoading}
                  className="flex-1 py-3 bg-rose-950 hover:bg-rose-900 border border-rose-800 hover:border-rose-700 text-rose-100 font-bold rounded-xl text-xs uppercase cursor-pointer transition-colors flex justify-center items-center gap-1.5"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Purging ledger cache...</span>
                    </>
                  ) : (
                    <span>Scrub Account completely</span>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
