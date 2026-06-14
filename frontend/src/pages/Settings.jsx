import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/auth/profile", { name });
      setUser(data);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <div className="bg-card border border-zinc-800 rounded-md p-6 sm:p-8">
          <h2 className="font-heading text-lg font-bold">Profile</h2>
          <p className="text-sm text-zinc-500 mt-1">Update your account details.</p>
          <form onSubmit={save} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500">Name</Label>
              <Input data-testid="settings-name" value={name} onChange={(e) => setName(e.target.value)}
                className="bg-[#0c0c0e] border-zinc-800 focus:border-zinc-500 rounded-sm h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500">Email</Label>
              <Input value={user?.email || ""} disabled
                className="bg-[#0c0c0e] border-zinc-800 rounded-sm h-11 opacity-60" />
            </div>
            <Button data-testid="settings-save" type="submit" disabled={saving}
              className="bg-white text-black hover:bg-zinc-200 rounded-sm h-11 px-6 font-bold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Save changes</>}
            </Button>
          </form>
        </div>

        {/* Plan */}
        <div className="bg-card border border-zinc-800 rounded-md p-6 sm:p-8">
          <h2 className="font-heading text-lg font-bold">Plan</h2>
          <div className="mt-4 flex items-center justify-between border border-zinc-800 rounded-sm p-4">
            <div className="flex items-center gap-3">
              <BadgeCheck className="w-5 h-5 text-signal" />
              <div>
                <p className="text-white font-medium">{user?.plan || "Free"} plan</p>
                <p className="text-xs text-zinc-500">You're all set to convert designs.</p>
              </div>
            </div>
            <a href="/pricing">
              <Button data-testid="settings-upgrade" variant="outline"
                className="border-zinc-700 bg-transparent hover:bg-zinc-900 text-white rounded-sm h-10">
                View plans
              </Button>
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
