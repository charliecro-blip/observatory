import React, { useState } from "react";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTester } from "@/contexts/tester-context";
import { DEFAULT_TESTER_ID, DEFAULT_TESTER_NAME } from "@/lib/tester-profile";

export function TesterModal() {
  const { showModal, createAndApply, applyProfile } = useTester();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"create" | "returning">("create");
  const [returnId, setReturnId] = useState("");
  const [returnName, setReturnName] = useState("");

  if (!showModal) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createAndApply(name.trim());
  };

  const handleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const id = returnId.trim();
    const dn = returnName.trim();
    if (!id || !dn) return;
    applyProfile({ testerId: id, displayName: dn });
  };

  const handleCharlie = () => {
    applyProfile({ testerId: DEFAULT_TESTER_ID, displayName: DEFAULT_TESTER_NAME });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-border/60 bg-card/95 shadow-2xl p-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Moon className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-serif text-2xl tracking-wide text-foreground">Welcome to Observatory</h1>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Your body and the cosmos, in conversation.
          </p>
          <p className="text-xs text-muted-foreground/60 text-center">
            Create or enter your tester name to begin. Each tester has their own private data.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("create")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${
              mode === "create"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            New tester
          </button>
          <button
            onClick={() => setMode("returning")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${
              mode === "returning"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            Returning tester
          </button>
        </div>

        {mode === "create" ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Display name</label>
              <Input
                autoFocus
                placeholder="e.g. Alex, River, Sam..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/60"
              />
            </div>
            <Button type="submit" className="w-full" disabled={!name.trim()}>
              Create tester profile
            </Button>
          </form>
        ) : (
          <form onSubmit={handleReturn} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Tester ID</label>
              <Input
                autoFocus
                placeholder="obs_xxxxxxxx-xxxx-..."
                value={returnId}
                onChange={(e) => setReturnId(e.target.value)}
                className="bg-background/60 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Display name</label>
              <Input
                placeholder="Your name"
                value={returnName}
                onChange={(e) => setReturnName(e.target.value)}
                className="bg-background/60"
              />
            </div>
            <Button type="submit" className="w-full" disabled={!returnId.trim() || !returnName.trim()}>
              Resume tester profile
            </Button>
          </form>
        )}

        <div className="mt-4 pt-4 border-t border-border/30">
          <button
            onClick={handleCharlie}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Continue as Charlie (original dev profile)
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground/60 leading-relaxed">
          Tester profiles are for MVP separation only, not secure medical accounts.
        </p>
      </div>
    </div>
  );
}
