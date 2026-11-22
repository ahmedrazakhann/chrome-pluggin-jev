import { SectionCardProps } from '@app-types/ui';

const SectionCard: React.FC<SectionCardProps> = ({ title, children, action }) => (
  <section className="mb-4">
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-bold text-portal-red">{title}</h3>
      {action}
    </div>
    <div className="rounded-sm border border-portal-line bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-4">{children}</div>
  </section>
);

export default SectionCard;
