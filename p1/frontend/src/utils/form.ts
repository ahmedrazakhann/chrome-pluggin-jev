import { FormikProps } from 'formik';

// The error to show for a field: only once the user has touched it or tried to continue.
export const fieldError = (formik: FormikProps<any>, name: string): string | undefined => {
  const error = formik.errors[name];
  return (formik.touched[name] || formik.submitCount > 0) && typeof error === 'string' ? error : undefined;
};

// Marks the given fields touched, validates, and reports whether those fields are valid.
export const validateFields = async (formik: FormikProps<any>, names: string[]) => {
  await formik.setTouched({ ...formik.touched, ...Object.fromEntries(names.map(name => [name, true])) }, false);
  const errors = await formik.validateForm();
  const invalid = names.filter(name => errors[name]);
  if (invalid.length) document.getElementById(invalid[0])?.focus();
  return invalid.length === 0;
};
