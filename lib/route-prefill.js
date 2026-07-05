function buildInvoicePrefillFromSearchParams(searchParams) {
  return {
    customerId: searchParams.get('customerId') ?? '',
    appointmentId: searchParams.get('appointmentId') ?? '',
    medicalRecordId: searchParams.get('medicalRecordId') ?? '',
    petId: searchParams.get('petId') ?? '',
  };
}

function buildMedicalRecordPrefillFromSearchParams(searchParams) {
  return {
    appointmentId: searchParams.get('appointmentId') ?? '',
  };
}

module.exports = {
  buildInvoicePrefillFromSearchParams,
  buildMedicalRecordPrefillFromSearchParams,
};
