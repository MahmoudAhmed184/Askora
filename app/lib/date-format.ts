const mediumDateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatMediumDateTime(value: Date | string) {
  return mediumDateTimeFormatter.format(
    typeof value === "string" ? new Date(value) : value,
  );
}
