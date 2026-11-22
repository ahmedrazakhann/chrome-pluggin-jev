import { PortalButtonProps } from '@app-types/ui';

const VARIANTS: Record<NonNullable<PortalButtonProps['variant']>, string> = {
  dark: 'bg-portal-ink text-white hover:bg-black',
  orange: 'bg-portal-orange text-white hover:brightness-95',
  light: 'bg-white text-gray-700 ring-1 ring-portal-line hover:bg-gray-50',
  danger: 'bg-portal-red text-white hover:brightness-95',
};

const PortalButton: React.FC<PortalButtonProps> = ({
  children,
  type = 'button',
  variant = 'dark',
  disabled,
  startIcon,
  endIcon,
  className = '',
  onClick,
  title,
}) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    title={title}
    className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-sm px-4 py-1.5 text-[13px] font-semibold shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
  >
    {startIcon}
    {children}
    {endIcon}
  </button>
);

export default PortalButton;
