import { useMemo } from 'react';

/**
 * Hook that computes permission flags from the user's role in the active lab.
 * @param {string|null} role - 'admin' | 'student' | null
 * @returns {{ role, can: object }}
 */
export default function usePermissions(role) {
  const can = useMemo(() => {
    const isAdmin = role === 'admin';
    const isMember = role === 'admin' || role === 'student';

    return {
      // Inventory
      viewInventory: isMember,
      editInventoryQty: isAdmin,
      deleteInventory: isAdmin,
      addInventory: isAdmin,
      discountStock: isMember,

      // Protocols
      createProtocol: isAdmin,
      editProtocol: isAdmin,
      deleteProtocol: isAdmin,

      // Buffer Recipes
      deleteRecipe: isAdmin,

      // Culture Logs
      addCultureLog: isMember,
      deleteCultureLog: isAdmin,
      addCulture: isAdmin,
      deleteCulture: isAdmin,

      // Admin
      manageMembers: isAdmin,
      viewAuditLog: isAdmin,
      editLabSettings: isAdmin,
    };
  }, [role]);

  return { role, can };
}
