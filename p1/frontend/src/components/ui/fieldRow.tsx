import { Info } from 'lucide-react';
import { FieldRowProps } from '@app-types/ui';

// Portal-style row: right-aligned label on the left, control on the right, error underneath.
const FieldRow: React.FC<FieldRowProps> = ({ label, htmlFor, required, info, error, children, className = '' }) => (
  <div className={`grid grid-cols-1 gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-start md:gap-3 ${className}`}>
    <label htmlFor={htmlFor} className="text-[12px] leading-tight text-portal-label md:pt-2.5 md:text-right">
      {label}:{required ? <span className="ml-0.5 text-portal-red">*</span> : null}
    </label>
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">{children}</div>
        {info ? (
          <span title={info} aria-label={info} className="shrink-0 cursor-help text-gray-700">
            <Info size={15} strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-portal-red">
          {error}
        </p>
      ) : null}
    </div>
  </div>
);

export default FieldRow;
