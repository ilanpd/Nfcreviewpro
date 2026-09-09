import { Check, Minus } from "lucide-react";
import { cn } from "cn";

interface PermissionMatrixProps<TRole extends string, TPermission extends string> {
  roles: TRole[];
  roleLabels: Record<TRole, string>;
  permissions: TPermission[];
  permissionLabels: Record<TPermission, string>;
  hasPermission: (role: TRole, permission: TPermission) => boolean;
  className?: string;
}

/**
 * Permission Matrix — visualiza a matriz de permissões do RBAC v2
 * (`domain/rbac/roles.ts`) como uma grade, em vez de um comerciante precisar
 * ler código ou adivinhar o que cada papel pode fazer. Genérico o
 * suficiente para renderizar qualquer combinação de papéis × permissões, não
 * amarrado aos tipos exatos do RBAC — assim `packages/ui` não depende do
 * app para compilar.
 */
export function PermissionMatrix<TRole extends string, TPermission extends string>({
  roles,
  roleLabels,
  permissions,
  permissionLabels,
  hasPermission,
  className,
}: PermissionMatrixProps<TRole, TPermission>) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border/60", className)}>
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Permissão</th>
            {roles.map((role) => (
              <th key={role} className="px-3 py-2 text-center font-medium text-muted-foreground">
                {roleLabels[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission) => (
            <tr key={permission} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2 text-foreground">{permissionLabels[permission]}</td>
              {roles.map((role) => {
                const allowed = hasPermission(role, permission);
                return (
                  <td key={role} className="px-3 py-2 text-center">
                    {allowed ? (
                      <Check className="mx-auto size-4 text-brand" />
                    ) : (
                      <Minus className="mx-auto size-4 text-muted-foreground/40" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
