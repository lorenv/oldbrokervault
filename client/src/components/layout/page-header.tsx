import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 -mx-6 -mt-6 px-6 py-5 bg-gradient-to-r from-white via-slate-50/80 to-blue-50/50 border-b border-slate-200/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {icon && (
            <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-md">
              <span className="text-white">{icon}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">{title}</h1>
            {description && (
              <p className="text-slate-500 mt-0.5 text-sm">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
