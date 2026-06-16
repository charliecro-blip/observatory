import React, { useState } from "react";
import { useListSupplements, useCreateSupplement, useUpdateSupplement, useDeleteSupplement, getListSupplementsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Supplements() {
  const { data: supplements, isLoading } = useListSupplements();
  const createSupplement = useCreateSupplement();
  const updateSupplement = useUpdateSupplement();
  const deleteSupplement = useDeleteSupplement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", dosage: "", unit: "", frequency: "", notes: "", active: true });

  const resetForm = () => {
    setFormData({ name: "", dosage: "", unit: "", frequency: "", notes: "", active: true });
    setEditingId(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const openEdit = (supp: any) => {
    setFormData({
      name: supp.name,
      dosage: supp.dosage || "",
      unit: supp.unit || "",
      frequency: supp.frequency || "",
      notes: supp.notes || "",
      active: supp.active,
    });
    setEditingId(supp.id);
    setIsOpen(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateSupplement.mutate(
        { id: editingId, data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSupplementsQueryKey() });
            setIsOpen(false);
            toast({ title: "Supplement updated" });
          }
        }
      );
    } else {
      createSupplement.mutate(
        { data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSupplementsQueryKey() });
            setIsOpen(false);
            toast({ title: "Supplement added" });
          }
        }
      );
    }
  };

  const onDelete = (id: number) => {
    if (confirm("Remove this supplement?")) {
      deleteSupplement.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSupplementsQueryKey() });
            toast({ title: "Supplement removed" });
          }
        }
      );
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-[100dvh]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-serif text-foreground tracking-tight">Supplements</h1>
          <p className="text-muted-foreground mt-2">Your active stack.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Supplement</Button>
          </DialogTrigger>
          <DialogContent className="border-border/50 bg-background/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Supplement" : "Add Supplement"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input required value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dosage</Label>
                  <Input value={formData.dosage} onChange={(e) => setFormData(prev => ({ ...prev, dosage: e.target.value }))} className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={formData.unit} onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))} className="bg-background/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Input value={formData.frequency} onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))} placeholder="e.g. Daily, Morning" className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="bg-background/50" />
              </div>
              <Button type="submit" className="w-full" disabled={createSupplement.isPending || updateSupplement.isPending}>
                {createSupplement.isPending || updateSupplement.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : supplements?.length === 0 ? (
        <div className="p-12 text-center border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm">
          <p className="text-muted-foreground">No supplements tracked yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {supplements?.map(supp => (
            <Card key={supp.id} className="bg-card/40 backdrop-blur-md border-border/50 hover:border-primary/30 transition-colors group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-serif tracking-wide">{supp.name}</CardTitle>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(supp)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(supp.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {(supp.dosage || supp.frequency) && (
                  <CardDescription className="text-primary/80 font-medium">
                    {supp.dosage} {supp.unit} {supp.frequency && `• ${supp.frequency}`}
                  </CardDescription>
                )}
              </CardHeader>
              {supp.notes && (
                <CardContent>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed">{supp.notes}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
