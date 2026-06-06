const TOAST_RESULT_FIELD_NAME = "_toastResult";
const TOAST_RESULT_FIELD_VALUE = "prototype-toast";

export function wantsToastResult(formData: FormData) {
  return formData.get(TOAST_RESULT_FIELD_NAME) === TOAST_RESULT_FIELD_VALUE;
}

export { TOAST_RESULT_FIELD_NAME, TOAST_RESULT_FIELD_VALUE };
