"use client";

import { useState, useRef, FormEvent } from "react";
import { Camera, Save, Loader2, User } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ProfileSettingsFormProps {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
  };
}

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [isUploading, setUploading] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setMessage(null);

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      setMessage({ type: "success", text: "Avatar uploaded successfully. Don't forget to save changes." });
    } catch (err: any) {
      console.error("Upload error:", err);
      setMessage({ type: "error", text: err.message || "Failed to upload avatar" });
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user.id) {
      setMessage({ type: "error", text: "User ID is missing. Please refresh the page." });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from("users")
        .update({
          first_name: firstName,
          last_name: lastName,
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);

      if (error) throw error;

      setMessage({ type: "success", text: "Profile updated successfully" });
      router.refresh();
    } catch (err: any) {
      console.error("Save error:", err);
      setMessage({ type: "error", text: err.message || "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Avatar Section */}
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl border border-white/40 bg-white/40 backdrop-blur-md shadow-sm">
        <div className="relative group">
          <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-xl bg-pink-500/5">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-pink-500/10">
                <User className="size-12 text-pink-500/40" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-0 right-0 p-2.5 rounded-full bg-pink-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>
        <div className="mt-4 text-center">
          <h3 className="text-lg font-bold text-foreground">Profile Photo</h3>
          <p className="text-sm text-foreground/40 font-medium">Click the camera icon to upload a new photo</p>
        </div>
      </div>

      {/* Info Section */}
      <div className="grid gap-6 p-8 rounded-3xl border border-white/40 bg-white/40 backdrop-blur-md shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-foreground/40 ml-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-white/60 bg-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500/40 transition-all font-bold text-foreground"
              placeholder="First name"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-foreground/40 ml-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-white/60 bg-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500/40 transition-all font-bold text-foreground"
              placeholder="Last name"
              required
            />
          </div>
        </div>

        <div className="space-y-2 opacity-50 cursor-not-allowed">
          <label className="text-xs font-black uppercase tracking-widest text-foreground/40 ml-1">Email Address</label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full h-12 px-4 rounded-2xl border border-white/60 bg-white/10 font-bold text-foreground/40 cursor-not-allowed"
          />
          <p className="text-[10px] font-medium text-foreground/30 ml-1 italic">Email cannot be changed from this dashboard.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl border ${message.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600' : 'border-rose-500/20 bg-rose-500/5 text-rose-600'} text-sm font-bold text-center animate-in fade-in slide-in-from-top-2 duration-300`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-8 h-14 rounded-2xl bg-pink-600 text-white font-black tracking-tight shadow-lg shadow-pink-500/20 hover:bg-pink-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
          Save changes
        </button>
      </div>
    </form>
  );
}
