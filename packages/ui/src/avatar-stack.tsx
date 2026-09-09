import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";

export interface AvatarStackPerson {
  id: string;
  name: string;
  imageUrl?: string | null;
}

/**
 * Avatar Stack — composição sobre `AvatarGroup`/`AvatarGroupCount` (já
 * existentes no shadcn/ui deste projeto); a única coisa que este componente
 * adiciona é o corte automático em `max` com um "+N" e o fallback por
 * iniciais, para nenhuma tela precisar reimplementar esse recorte à mão.
 */
export function AvatarStack({ people, max = 4 }: { people: AvatarStackPerson[]; max?: number }) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <AvatarGroup>
      {visible.map((person) => (
        <Avatar key={person.id} title={person.name}>
          <AvatarFallback>{person.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? <AvatarGroupCount>+{overflow}</AvatarGroupCount> : null}
    </AvatarGroup>
  );
}
