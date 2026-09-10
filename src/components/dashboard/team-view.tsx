"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Shield, Trash2, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccessScopeManager } from "./access-scope-manager";
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "@/domain/rbac/roles";
import type { User, Role } from "@/generated/prisma/client";
import type { BranchListItem, ZoneListItem } from "@/types";
import { PremiumModal, SmartBadge } from "@nfc-os/ui";

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

interface TeamViewProps {
  initialMembers: User[];
  canManage: boolean;
  currentUserId: string;
  branches: BranchListItem[];
  zones: ZoneListItem[];
}

export function TeamView({ initialMembers, canManage, currentUserId, branches, zones }: TeamViewProps) {
  const [members, setMembers] = useState(initialMembers);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ email: string; name: string; role: AssignableRole }>({
    email: "",
    name: "",
    role: "OPERATOR",
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível convidar o membro");
      }
      const { member } = await res.json();
      setMembers((prev) => [...prev, member]);
      toast.success("Convite criado — a pessoa terá acesso ao entrar com esse e-mail");
      setOpen(false);
      setForm({ email: "", name: "", role: "OPERATOR" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(id: string, role: Role) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Não foi possível alterar o cargo");
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remover este membro da equipe?")) return;
    try {
      const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success("Membro removido");
    } catch {
      toast.error("Não foi possível remover o membro");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Convide sua equipe, defina cargos e restrinja acesso por unidade ou zona quando necessário.
          </p>
        </div>
        {canManage ? (
          <>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Convidar
            </Button>
            <PremiumModal
              open={open}
              onOpenChange={setOpen}
              icon={UserPlus}
              title="Convidar membro"
              footer={
                <Button type="submit" form="invite-form" disabled={saving}>
                  {saving ? "Enviando…" : "Enviar convite"}
                </Button>
              }
            >
              <form id="invite-form" onSubmit={handleInvite}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="member-name">Nome</Label>
                    <Input id="member-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-email">E-mail</Label>
                    <Input
                      id="member-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Select value={form.role} onValueChange={(v: AssignableRole) => setForm({ ...form, role: v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </form>
            </PremiumModal>
          </>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cargo</TableHead>
              {canManage ? <TableHead className="w-20">Acesso</TableHead> : null}
              {canManage ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <HoverCard openDelay={200}>
                    <HoverCardTrigger asChild>
                      <div className="flex w-fit items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback>{(member.name || member.email).slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name || member.email}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="right">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback>{(member.name || member.email).slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{member.name || "Sem nome definido"}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 space-y-1 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                        <p>Cargo: {ROLE_LABEL[member.role]}</p>
                        <p>Membro desde {new Date(member.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell>
                  <SmartBadge
                    label={member.status === "ACTIVE" ? "Ativo" : "Pendente"}
                    tone={member.status === "ACTIVE" ? "success" : "neutral"}
                  />
                </TableCell>
                <TableCell>
                  {canManage && member.role !== "OWNER" ? (
                    <Select value={member.role} onValueChange={(v: Role) => handleRoleChange(member.id, v)}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm">{ROLE_LABEL[member.role]}</span>
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell>
                    {member.role !== "OWNER" ? (
                      <AccessScopeManager
                        memberId={member.id}
                        memberName={member.name || member.email}
                        branches={branches}
                        zones={zones}
                        trigger={
                          <Button variant="ghost" size="icon" className="size-8" title="Restringir acesso">
                            <Shield className="size-4" />
                          </Button>
                        }
                      />
                    ) : null}
                  </TableCell>
                ) : null}
                {canManage ? (
                  <TableCell>
                    {member.role !== "OWNER" && member.id !== currentUserId ? (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleRemove(member.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
