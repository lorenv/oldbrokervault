// Tree-shakeable icon imports to reduce bundle size
// Import only what we need from lucide-react

// Most commonly used icons
export {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  MoreHorizontal,
  Save,
  Trash2,
  Edit,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Settings,
  User,
  Mail,
  FileText,
  Upload,
  Copy,
  ExternalLink
} from "lucide-react";

// Admin/Settings specific icons - lazy loaded
export const loadAdminIcons = () => import("lucide-react").then(icons => ({
  Bell: icons.Bell,
  Shield: icons.Shield,
  CreditCard: icons.CreditCard,
  LogOut: icons.LogOut,
  Palette: icons.Palette,
  Database: icons.Database
}));

// Document specific icons - lazy loaded
export const loadDocumentIcons = () => import("lucide-react").then(icons => ({
  Users: icons.Users,
  Send: icons.Send,
  Clock: icons.Clock,
  CheckCircle: icons.CheckCircle,
  XCircle: icons.XCircle,
  AlertCircle: icons.AlertCircle,
  Calendar: icons.Calendar,
  Signature: icons.Signature
}));

// Template specific icons - lazy loaded
export const loadTemplateIcons = () => import("lucide-react").then(icons => ({
  Layout: icons.Layout,
  Layers: icons.Layers,
  Grid: icons.Grid,
  Move: icons.Move,
  RotateCcw: icons.RotateCcw,
  Square: icons.Square,
  Type: icons.Type
}));