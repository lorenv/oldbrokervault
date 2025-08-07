import { lazy } from "react";

// Lazy load heavy components to reduce initial bundle size
export const LazyBackupManager = lazy(() => import("@/components/BackupManager"));
export const LazyFieldToolbox = lazy(() => import("@/components/document/field-toolbox"));
export const LazyManageRolesDialog = lazy(() => import("@/components/template/manage-roles-dialog"));
export const LazyUploadModal = lazy(() => import("@/components/document/upload-modal"));