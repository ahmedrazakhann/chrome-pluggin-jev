'use client';
import { HsCode } from '@app-types/declaration';
import { HsCodeSearchModalProps } from '@app-types/ui';
import SearchModal from '@components/ui/searchModal';
import { HS_CODES } from '@constants/declarationData';

const HsCodeSearchModal: React.FC<HsCodeSearchModalProps> = ({ open, onSelect, onClose }) => (
  <SearchModal<HsCode>
    open={open}
    title="Search HS Code"
    filters={[
      { name: 'code', label: 'HS Code', type: 'text' },
      { name: 'description', label: 'Description', type: 'text' },
    ]}
    columns={[
      { key: 'code', label: 'HS Code', render: hs => hs.code },
      { key: 'description', label: 'Description', render: hs => hs.description },
      { key: 'duty', label: 'Duty', render: hs => `${Math.round(hs.dutyRate * 100)}%` },
    ]}
    rows={HS_CODES}
    rowKey={hs => hs.code}
    matches={(hs, values) =>
      (!values.code || hs.code.startsWith(values.code)) &&
      (!values.description || hs.description.toLowerCase().includes(values.description.toLowerCase()))
    }
    onSelect={onSelect}
    onClose={onClose}
  />
);

export default HsCodeSearchModal;
