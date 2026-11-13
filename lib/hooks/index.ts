/**
 * Hooks Index
 * Export all custom hooks
 */

export * from './useProducts';
export * from './useCategories';
export * from './useCreateOrder';
export * from './useOrders';
export * from './useAdminOrders';
export * from './useKitchenOrders';
export * from './useUpdateOrderStatus';
export * from './useDashboardStats';
export * from './useOfflineQueue';
// useOrderAssistantChat is a local prototype. It is not re-exported: a barrel
// import would pull it into the production bundle. See metro.config.js and
// docs/SECURITY-CHECKLIST.md.
export * from './useOrderAlertSound';
