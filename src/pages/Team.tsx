// src/pages/team/Team.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Users, Pencil, Trash2, X, Check, Key } from "lucide-react";
import { useTranslation } from "react-i18next";

const ROLES = [
  { value: "ADMIN",        label: "admin",        color: "bg-red-100 text-red-800" },
  { value: "MANAGER",      label: "manager",      color: "bg-blue-100 text-blue-800" },
  { value: "RECEPTION",    label: "reception",    color: "bg-teal-100 text-teal-800" },
  { value: "HOUSEKEEPING", label: "housekeeping", color: "bg-green-100 text-green-800" },
  { value: "WAITER",       label: "waiter",       color: "bg-amber-100 text-amber-800" },
  { value: "KITCHEN",      label: "kitchen",      color: "bg-orange-100 text-orange-800" },
  { value: "CASHIER",      label: "cashier",      color: "bg-pink-100 text-pink-800" },
];

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

const emptyForm = { email: "", password: "", name: "", role: "" };

const Team: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // ── état UI ──────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate]   = useState(false);
  const [editId, setEditId]           = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [form, setForm]               = useState({ ...emptyForm });
  const [editForm, setEditForm]       = useState<Partial<typeof emptyForm & { id: number }>>({});
  const [formError, setFormError]     = useState("");

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn:  () => api.get("/users"),
  });

  // ── mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => api.post("/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      setFormError("");
    },
    onError: (err: any) => setFormError(err?.message || t('team.createError')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<typeof emptyForm> & { id: number }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditId(null);
      setEditForm({});
    },
    onError: (err: any) => setFormError(err?.message || t('team.updateError')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
  });

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.role) {
      setFormError(t('team.requiredFields'));
      return;
    }
    createMutation.mutate(form);
  };

  const startEdit = (u: UserRow) => {
    setEditId(u.id);
    setEditForm({ id: u.id, email: u.email, name: u.name ?? "", role: u.role, password: "" });
    setFormError("");
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;
    const payload: any = { id: editForm.id };
    if (editForm.email)    payload.email    = editForm.email;
    if (editForm.name)     payload.name     = editForm.name;
    if (editForm.role)     payload.role     = editForm.role;
    if (editForm.password) payload.password = editForm.password;
    updateMutation.mutate(payload);
  };

  const getRoleLabel = (role: string) => {
    const found = ROLES.find(r => r.value === role);
    if (found) return t(`team.roles.${found.label}`);
    return role;
  };

  const getRoleColor = (role: string) => {
    const found = ROLES.find(r => r.value === role);
    return found?.color ?? "bg-gray-100 text-gray-700";
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6">

          {/* Titre */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6" /> {t('team.title')}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {t('team.subtitle')}
              </p>
            </div>
            <Button onClick={() => { setShowCreate(true); setFormError(""); }}
              className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('team.newAccount')}
            </Button>
          </div>

          {/* Formulaire création */}
          {showCreate && (
            <Card className="mb-6 border-blue-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4" /> {t('team.createUser')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('common.email')} *</Label>
                    <Input value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="jean@hotel.com" className="mt-1" />
                  </div>
                  <div>
                    <Label>{t('team.password')} *</Label>
                    <Input type="password" value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder={t('team.passwordMinLength')} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t('team.fullName')}</Label>
                    <Input value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder={t('team.fullNamePlaceholder')} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t('team.role')} *</Label>
                    <Select value={form.role}
                      onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('team.selectRole')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>
                            {t(`team.roles.${r.label}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formError && (
                    <div className="md:col-span-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                      {formError}
                    </div>
                  )}
                  <div className="md:col-span-2 flex gap-2 justify-end">
                    <Button type="button" variant="outline"
                      onClick={() => { setShowCreate(false); setFormError(""); }}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? t('common.loading') : t('team.create')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Liste */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">{t('team.noUsers')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map(user => {
                const isEditing = editId === user.id;
                const roleColor = getRoleColor(user.role);
                const roleLabel = getRoleLabel(user.role);

                return (
                  <Card key={user.id}
                    className={`transition-all ${isEditing ? "border-blue-400 shadow-md" : ""}`}>
                    <CardContent className="p-4">

                      {isEditing ? (
                        /* ── Mode édition ── */
                        <form onSubmit={handleUpdate} className="space-y-3">
                          <div>
                            <Label className="text-xs">{t('common.email')}</Label>
                            <Input value={editForm.email ?? ""}
                              onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                              className="mt-1 h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">{t('team.fullName')}</Label>
                            <Input value={editForm.name ?? ""}
                              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                              className="mt-1 h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">{t('team.role')}</Label>
                            <Select value={editForm.role ?? ""}
                              onValueChange={v => setEditForm(p => ({ ...p, role: v }))}>
                              <SelectTrigger className="mt-1 h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map(r => (
                                  <SelectItem key={r.value} value={r.value}>
                                    {t(`team.roles.${r.label}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">{t('team.newPassword')}</Label>
                            <Input type="password" value={editForm.password ?? ""}
                              onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                              placeholder={t('team.passwordOptional')}
                              className="mt-1 h-8 text-sm" />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button type="submit" size="sm"
                              disabled={updateMutation.isPending}
                              className="flex-1 h-8 gap-1">
                              <Check className="w-3 h-3" />
                              {updateMutation.isPending ? "..." : t('common.save')}
                            </Button>
                            <Button type="button" size="sm" variant="outline"
                              onClick={() => setEditId(null)}
                              className="flex-1 h-8 gap-1">
                              <X className="w-3 h-3" /> {t('common.cancel')}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        /* ── Mode lecture ── */
                        <>
                          <div className="flex items-start justify-between mb-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {user.name || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 shrink-0 ${roleColor}`}>
                              {roleLabel}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground/60 mb-3">
                            {t('team.createdOn')} {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline"
                              onClick={() => startEdit(user)}
                              className="flex-1 h-8 gap-1 text-xs">
                              <Pencil className="w-3 h-3" /> {t('common.edit')}
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={() => setDeleteTarget(user)}
                              className="flex-1 h-8 gap-1 text-xs text-red-600 hover:text-red-700 hover:border-red-300">
                              <Trash2 className="w-3 h-3" /> {t('common.delete')}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Confirm suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('team.deleteConfirmDescription')} <strong>{deleteTarget?.name || deleteTarget?.email}</strong>.
              {t('team.deleteConfirmWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Team;