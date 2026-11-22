'use client';
import { Carrier } from '@app-types/declaration';
import { CarrierSearchModalProps } from '@app-types/ui';
import SearchModal from '@components/ui/searchModal';
import { CARRIERS } from '@constants/declarationData';

const CarrierSearchModal: React.FC<CarrierSearchModalProps> = ({ open, channel, onSelect, onClose }) => {
  const rows = CARRIERS.filter(carrier => carrier.channel === channel);
  const operators = [...new Set(rows.map(carrier => carrier.operator))];

  return (
    <SearchModal<Carrier>
      open={open}
      title="Search Carrier"
      filters={[
        { name: 'code', label: channel === 'AIR' ? 'Flight No.' : 'Registration No.', type: 'text' },
        { name: 'operator', label: 'Operator', type: 'select', options: operators.map(operator => ({ value: operator, label: operator })) },
      ]}
      columns={[
        { key: 'code', label: 'Registration No.', render: carrier => carrier.code },
        { key: 'name', label: 'Name', render: carrier => carrier.name },
        { key: 'operator', label: 'Operator', render: carrier => carrier.operator },
      ]}
      rows={rows}
      rowKey={carrier => carrier.code}
      matches={(carrier, values) =>
        (!values.code || carrier.code.replace(/\s/g, '').includes(values.code.replace(/\s/g, '').toUpperCase())) &&
        (!values.operator || carrier.operator === values.operator)
      }
      onSelect={onSelect}
      onClose={onClose}
    />
  );
};

export default CarrierSearchModal;
