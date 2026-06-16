import React, { useState } from "react";
import { useListActivities, useCreateActivity, useUpdateActivity, useDeleteActivity, getListActivitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Activities() {
  const { data: activities, isLoading } = useListActivities();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", category: "", notes: "", active: true });

  const resetForm = () => {
    setFormData({ name: "", category: "", notes: "", active: true });
    setEditingId(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const openEdit = (act: any) => {
    setFormData({
      name: act.name,
      category: act.category || "",
      notes: act.notes || "",
      active: act.active,
    });
    setEditingId(act.id);
    setIsOpen(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateActivity.mutate(
        { id: editingId, data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
            setIsOpen(false);
            toast({ title: "Activity updated" });
          }
        }
      );
    } else {
      createActivity.mutate(
        { data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
            setIsOpen(false);
            toast({ title: "Activity added" });
          }
        }
      );
    }
  };

  const onDelete = (id: number) => {
    if (confirm("Remove this activity?")) {
      deleteActivity.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
            toast({ title: "Activity removed" });
          }
        }
      );
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-[100dvh]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-serif text-foreground tracking-tight">Activities</h1>
          <p className="text-muted-foreground mt-2">Habits and practices.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Activity</Button>
          </DialogTrigger>
          <DialogContent className="border-border/50 bg-background/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Activity" : "Add Activity"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input required value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="bg-background/50" />
              </div>
              <Button type="submit" className="w-full" disabled={createActivity.isPending || updateActivity.isPending}>
                {createActivity.isPending || updateActivity.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : activities?.length === 0 ? (
        <div className="p-12 text-center border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm">
          <p className="text-muted-foreground">No activities tracked yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities?.map(act => (
            <Card key={act.id} className="bg-card/40 backdrop-blur-md border-border/50 hover:border-primary/30 transition-colors group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-serif tracking-wide">{act.name}</CardTitle>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(act)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(act.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {act.category && (
                  <CardDescription className="text-primary/80 font-medium">
                    {act.category}
                  </CardDescription>
                )}
              </CardHeader>
              {act.notes && (
                <CardContent>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed">{act.notes}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
