'use client';
import { Port } from '@app-types/declaration';
import { PortSearchModalProps } from '@app-types/ui';
import SearchModal from '@components/ui/searchModal';
import { COUNTRIES, PORTS } from '@constants/declarationData';
import { countryName } from '@utils/declaration';

const PortSearchModal: React.FC<PortSearchModalProps> = ({ open, channel, uaeOnly, onSelect, onClose }) => {
  const rows = PORTS.filter(port => port.channel === channel && (!uaeOnly || port.country === 'AE'));
  const countries = COUNTRIES.filter(country => rows.some(port => port.country === country.code));

  return (
    <SearchModal<Port>
      open={open}
      title="Search Port"
      filters={[
        { name: 'name', label: 'Location Name', type: 'text' },
        {
          name: 'country',
          label: 'Country',
          type: 'select',
          options: countries.map(country => ({ value: country.code, label: country.name.toUpperCase() })),
        },
      ]}
      columns={[
        { key: 'code', label: '', render: port => port.code },
        { key: 'name', label: 'Name', render: port => port.name },
        { key: 'country', label: 'Country', render: port => countryName(port.country).toUpperCase() },
      ]}
      rows={rows}
      rowKey={port => port.code}
      matches={(port, values) =>
        (!values.name ||
          port.name.toLowerCase().includes(values.name.toLowerCase()) ||
          port.code.toLowerCase() === values.name.toLowerCase()) &&
        (!values.country || port.country === values.country)
      }
      onSelect={onSelect}
      onClose={onClose}
    />
  );
};

export default PortSearchModal;
