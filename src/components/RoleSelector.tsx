// components/RoleSelector.tsx
import { useAuth, Role } from '@/lib/role'; // Import depuis votre fichier RBAC

const roles: Role[] = [
  'admin', 'manager', 'reception', 'housekeeping', 'serveur', 
  'cuisine', 'bar', 'spa', 'compta'
];

const roleLabels: Record<Role, string> = {
  admin: "Administrateur",
  manager: "Manager",
  reception: "Réception",
  housekeeping: "Housekeeping",
  serveur: "Serveur",
  cuisine: "Cuisine",
  bar: "Bar",
  spa: "Spa",
  compta: "Comptabilité"
};

export function RoleSelector() {
  const { user, setRole } = useAuth();

  return (
    <div className="p-3 bg-gray-800 rounded-lg">
      <label className="block text-xs font-medium mb-2 text-gray-300">
        Rôle simulé (développement)
      </label>
      <select 
        value={user?.role || "manager"}
        onChange={(e) => setRole(e.target.value as Role)}
        className="w-full p-2 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {roles.map(r => (
          <option key={r} value={r}>{roleLabels[r]}</option>
        ))}
      </select>
      <p className="text-xs text-gray-400 mt-2">
        Changez de rôle pour tester les accès
      </p>
    </div>
  );
}