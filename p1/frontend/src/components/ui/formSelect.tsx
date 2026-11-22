'use client';
import { FormSelectProps } from '@app-types/ui';
import FieldRow from '@components/ui/fieldRow';
import { INPUT_CLASS, INPUT_ERROR_CLASS } from '@constants/styles';
import { fieldError } from '@utils/form';

const FormSelect: React.FC<FormSelectProps> = ({
  formik,
  name,
  label,
  required,
  info,
  disabled,
  className,
  options,
  placeholder = '[Please Select]',
  onValueChange,
}) => {
  const error = fieldError(formik, name);

  return (
    <FieldRow label={label} htmlFor={name} required={required} info={info} error={error} className={className}>
      <select
        id={name}
        name={name}
        value={formik.values[name] ?? ''}
        onChange={event => {
          formik.setFieldValue(name, event.target.value);
          onValueChange?.(event.target.value);
        }}
        onBlur={formik.handleBlur}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        className={`${INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : ''}`}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
};

export default FormSelect;
